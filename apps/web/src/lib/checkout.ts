import { randomBytes } from "node:crypto";

import { prisma, type Prisma } from "@biletflow/db";
import {
  computeOrderTotals,
  type CreateOrderInput,
  type DiscountType,
} from "@biletflow/shared";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp, isUniqueViolation } from "./http";
import { redeemCampaign, releaseInventory, reserveInventory, sellInventory } from "./inventory";
import { issueTickets, ticketSigningKey, type AttendeeInput } from "./tickets";

const orderInclude = {
  items: true,
  tickets: {
    include: {
      attendee: { select: { fullName: true, email: true } },
      ticketType: { select: { name: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export type PresentedOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function presentOrder(order: PresentedOrder) {
  return {
    id: order.id,
    reference: order.reference,
    eventId: order.eventId,
    status: order.status,
    subtotalKzt: order.subtotalKzt,
    discountKzt: order.discountKzt,
    feeKzt: order.feeKzt,
    totalKzt: order.totalKzt,
    currency: order.currency,
    clientIdempotencyKey: order.clientIdempotencyKey,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    items: order.items.map((item) => ({
      id: item.id,
      ticketTypeId: item.ticketTypeId,
      quantity: item.quantity,
      unitPriceKzt: item.unitPriceKzt,
      discountKzt: item.discountKzt,
      totalKzt: item.totalKzt,
    })),
    tickets: order.tickets.map((ticket) => ({
      id: ticket.id,
      code: ticket.code,
      status: ticket.status,
      ticketTypeId: ticket.ticketTypeId,
      ticketTypeName: ticket.ticketType.name,
      attendeeName: ticket.attendee.fullName,
      attendeeEmail: ticket.attendee.email,
    })),
  };
}

async function holdMinutes() {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: "CHECKOUT_HOLD_MINUTES" },
  });
  const parsed = Number(setting?.value ?? 15);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

function reference() {
  return `BF-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function allocateDiscount(lineTotals: number[], discountKzt: number) {
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
  if (discountKzt <= 0 || subtotal <= 0) return lineTotals.map(() => 0);
  let remaining = discountKzt;
  return lineTotals.map((line, index) => {
    if (index === lineTotals.length - 1) return remaining;
    const share = Math.floor((discountKzt * line) / subtotal);
    remaining -= share;
    return share;
  });
}

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
  headers: Headers,
) {
  const existing = await prisma.order.findUnique({
    where: { clientIdempotencyKey: input.clientIdempotencyKey },
    include: orderInclude,
  });
  if (existing) {
    if (existing.userId !== userId) throw new ApiError(409, "CONFLICT");
    return presentOrder(existing);
  }

  const minutes = await holdMinutes();
  try {
    const order = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: input.eventId },
        include: { ticketTypes: true },
      });
      if (!event || event.status !== "PUBLISHED") throw new ApiError(404, "NOT_FOUND");
      if (event.seatingMode !== "GENERAL_ADMISSION") {
        throw new ApiError(409, "CONFLICT");
      }
      const now = new Date();
      if (
        (event.registrationOpensAt && event.registrationOpensAt > now) ||
        (event.registrationClosesAt && event.registrationClosesAt < now)
      ) {
        throw new ApiError(409, "CONFLICT");
      }

      const types = new Map(event.ticketTypes.map((ticketType) => [ticketType.id, ticketType]));
      const lines = input.items.map((item) => {
        const ticketType = types.get(item.ticketTypeId);
        if (!ticketType || ticketType.isHidden) throw new ApiError(404, "NOT_FOUND");
        if (item.quantity > ticketType.maxPerOrder) throw new ApiError(400, "VALIDATION_FAILED");
        if (
          (ticketType.salesStartAt && ticketType.salesStartAt > now) ||
          (ticketType.salesEndAt && ticketType.salesEndAt < now)
        ) {
          throw new ApiError(409, "CONFLICT");
        }
        return {
          ticketType,
          quantity: item.quantity,
          lineKzt: ticketType.priceKzt * item.quantity,
        };
      });
      const ticketCount = lines.reduce((sum, line) => sum + line.quantity, 0);
      if (input.attendees.length !== ticketCount) {
        throw new ApiError(400, "VALIDATION_FAILED");
      }

      const priced = lines.some((line) => line.ticketType.priceKzt > 0);
      if (priced && (!event.paidSalesActive || event.paidSalesSuspended)) {
        throw new ApiError(409, "CONFLICT");
      }

      const promo = await resolvePromo(tx, event.id, userId, input, lines);
      const totals = computeOrderTotals(
        lines.map((line) => ({
          unitPriceKzt: line.ticketType.priceKzt,
          quantity: line.quantity,
        })),
        promo?.discount,
      );
      const discounts = allocateDiscount(
        lines.map((line) => line.lineKzt),
        totals.discountKzt,
      );
      const free = totals.totalKzt === 0;

      const created = await tx.order.create({
        data: {
          reference: reference(),
          eventId: event.id,
          userId,
          status: free ? "PAID" : "AWAITING_PAYMENT",
          subtotalKzt: totals.subtotalKzt,
          discountKzt: totals.discountKzt,
          feeKzt: totals.feeKzt,
          totalKzt: totals.totalKzt,
          campaignId: promo?.campaignId,
          promoCodeId: promo?.promoCodeId,
          clientIdempotencyKey: input.clientIdempotencyKey,
          attendees: JSON.parse(JSON.stringify(input.attendees)) as Prisma.InputJsonValue,
          expiresAt: free ? null : new Date(now.getTime() + minutes * 60_000),
          paidAt: free ? now : null,
          items: {
            create: lines.map((line, index) => ({
              ticketTypeId: line.ticketType.id,
              quantity: line.quantity,
              unitPriceKzt: line.ticketType.priceKzt,
              discountKzt: discounts[index] ?? 0,
              totalKzt: line.lineKzt - (discounts[index] ?? 0),
            })),
          },
        },
        include: { items: true },
      });

      for (const item of created.items) {
        if (free) await sellInventory(tx, item.ticketTypeId, item.quantity);
        else await reserveInventory(tx, item.ticketTypeId, item.quantity);
      }

      if (promo) {
        await redeemCampaign(tx, promo.campaignId);
        await tx.promoRedemption.create({
          data: {
            campaignId: promo.campaignId,
            promoCodeId: promo.promoCodeId,
            orderId: created.id,
            userId,
            discountKzt: totals.discountKzt,
          },
        });
      }

      const tickets = free
        ? await issueTickets(tx, {
            eventId: event.id,
            orderId: created.id,
            items: created.items,
            attendees: input.attendees as AttendeeInput[],
            signingKey: ticketSigningKey(),
          })
        : [];

      await audit(tx, {
        actorUserId: userId,
        eventId: event.id,
        action: free ? "order.paid" : "order.reserved",
        entityType: "Order",
        entityId: created.id,
        description: free
          ? "Free order paid and tickets issued"
          : "Paid order reserved pending payment",
        metadata: {
          totalKzt: totals.totalKzt,
          tickets: tickets.length,
        },
        ipAddress: clientIp(headers),
      });

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: orderInclude,
      });
    });
    return presentOrder(order);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const replay = await prisma.order.findUnique({
      where: { clientIdempotencyKey: input.clientIdempotencyKey },
      include: orderInclude,
    });
    if (!replay || replay.userId !== userId) throw new ApiError(409, "CONFLICT");
    return presentOrder(replay);
  }
}

async function resolvePromo(
  tx: Prisma.TransactionClient,
  eventId: string,
  userId: string,
  input: CreateOrderInput,
  lines: { ticketType: { id: string } }[],
): Promise<
  | { campaignId: string; promoCodeId: string; discount: { type: DiscountType; value: number } }
  | undefined
> {
  if (!input.promoCode && !input.campaignToken) return undefined;
  const promoCode = await tx.promoCode.findFirst({
    where: {
      isActive: true,
      ...(input.promoCode ? { code: input.promoCode } : {}),
      ...(input.campaignToken ? { qrToken: input.campaignToken } : {}),
      campaign: { eventId },
    },
    include: { campaign: { include: { ticketTypes: true } } },
  });
  if (!promoCode) throw new ApiError(400, "PROMO_INVALID");
  if (input.promoCode && input.campaignToken) {
    if (promoCode.code !== input.promoCode || promoCode.qrToken !== input.campaignToken) {
      throw new ApiError(400, "PROMO_INVALID");
    }
  }
  const campaign = promoCode.campaign;
  const now = new Date();
  if (campaign.status !== "ACTIVE") throw new ApiError(400, "PROMO_INVALID");
  if (
    (campaign.startsAt && campaign.startsAt > now) ||
    (campaign.endsAt && campaign.endsAt < now)
  ) {
    throw new ApiError(400, "PROMO_INVALID");
  }
  if (campaign.ticketTypes.length > 0) {
    const allowed = new Set(campaign.ticketTypes.map((row) => row.ticketTypeId));
    if (lines.some((line) => !allowed.has(line.ticketType.id))) {
      throw new ApiError(400, "PROMO_INVALID");
    }
  }
  const prior = await tx.promoRedemption.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId } },
  });
  if (prior) throw new ApiError(400, "PROMO_INVALID");
  return {
    campaignId: campaign.id,
    promoCodeId: promoCode.id,
    discount: { type: campaign.discountType, value: campaign.discountValue },
  };
}

export async function getOwnedOrder(userId: string, role: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (!order) throw new ApiError(404, "NOT_FOUND");
  if (role !== "PLATFORM_ADMIN" && order.userId !== userId) {
    throw new ApiError(404, "NOT_FOUND");
  }
  return order;
}

export async function cancelReservation(userId: string, orderId: string, headers: Headers) {
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!current || current.userId !== userId) throw new ApiError(404, "NOT_FOUND");
    if (current.status !== "AWAITING_PAYMENT" && current.status !== "PENDING") {
      throw new ApiError(409, "CONFLICT");
    }
    for (const item of current.items) {
      await releaseInventory(tx, item.ticketTypeId, item.quantity);
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: orderInclude,
    });
    await audit(tx, {
      actorUserId: userId,
      eventId: current.eventId,
      action: "order.cancelled",
      entityType: "Order",
      entityId: orderId,
      description: "Checkout reservation released",
      ipAddress: clientIp(headers),
    });
    return updated;
  });
  return presentOrder(order);
}
