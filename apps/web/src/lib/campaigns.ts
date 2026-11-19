import { prisma } from "@biletflow/db";
import { buildCampaignUrl, computeOrderTotals, type CampaignInput } from "@biletflow/shared";
import {
  generateCampaignToken,
  generatePromoCode,
} from "@biletflow/shared/qr.server";
import QRCode from "qrcode";
import { z } from "zod";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp } from "./http";
import { requireOwnedEvent } from "./organizer";

type SessionUser = { id: string; role: "ATTENDEE" | "ORGANIZER" | "PLATFORM_ADMIN" };

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  maxRedemptions: z.number().int().positive().max(1_000_000).nullable().optional(),
  perUserLimit: z.number().int().positive().max(100).optional(),
  ticketTypeIds: z.array(z.string().cuid()).optional(),
});

export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

const campaignInclude = {
  promoCode: true,
  ticketTypes: { select: { ticketTypeId: true } },
} as const;

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}

export function presentCampaign(
  campaign: {
    id: string;
    eventId: string;
    name: string;
    discountType: "PERCENT" | "FIXED_KZT";
    discountValue: number;
    status: "ACTIVE" | "DISABLED";
    startsAt: Date | null;
    endsAt: Date | null;
    maxRedemptions: number | null;
    redeemed: number;
    perUserLimit: number;
    createdAt: Date;
    promoCode: { code: string; qrToken: string; isActive: boolean } | null;
    ticketTypes: { ticketTypeId: string }[];
    event?: { slug: string };
  },
) {
  const qrToken = campaign.promoCode?.qrToken ?? null;
  const campaignUrl =
    qrToken && campaign.event
      ? buildCampaignUrl(appBaseUrl(), campaign.event.slug, qrToken)
      : null;

  return {
    id: campaign.id,
    eventId: campaign.eventId,
    name: campaign.name,
    discountType: campaign.discountType,
    discountValue: campaign.discountValue,
    status: campaign.status,
    startsAt: campaign.startsAt?.toISOString() ?? null,
    endsAt: campaign.endsAt?.toISOString() ?? null,
    maxRedemptions: campaign.maxRedemptions,
    redeemed: campaign.redeemed,
    perUserLimit: campaign.perUserLimit,
    ticketTypeIds: campaign.ticketTypes.map((row) => row.ticketTypeId),
    promoCode: campaign.promoCode?.code ?? null,
    campaignUrl,
    qrPngPath: `/api/organizer/campaigns/${campaign.id}/qr.png`,
    createdAt: campaign.createdAt.toISOString(),
  };
}

async function requireOwnedCampaign(user: SessionUser, campaignId: string) {
  const campaign = await prisma.promotionalCampaign.findUnique({
    where: { id: campaignId },
    include: {
      ...campaignInclude,
      event: { select: { id: true, slug: true, organizerId: true } },
    },
  });
  if (!campaign) throw new ApiError(404, "NOT_FOUND");
  if (user.role !== "PLATFORM_ADMIN" && campaign.event.organizerId !== user.id) {
    throw new ApiError(403, "FORBIDDEN");
  }
  return campaign;
}

export async function listEventCampaigns(user: SessionUser, eventId: string) {
  const event = await requireOwnedEvent(user, eventId);
  const campaigns = await prisma.promotionalCampaign.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    include: {
      ...campaignInclude,
      event: { select: { slug: true } },
    },
  });
  return campaigns.map(presentCampaign);
}

export async function createEventCampaign(
  user: SessionUser,
  eventId: string,
  input: CampaignInput,
  headers: Headers,
) {
  const event = await requireOwnedEvent(user, eventId);
  if (input.ticketTypeIds.length > 0) {
    const allowed = new Set(event.ticketTypes.map((type) => type.id));
    if (input.ticketTypeIds.some((id) => !allowed.has(id))) {
      throw new ApiError(400, "VALIDATION_FAILED");
    }
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.promotionalCampaign.create({
      data: {
        eventId: event.id,
        name: input.name,
        discountType: input.discountType,
        discountValue: input.discountValue,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        maxRedemptions: input.maxRedemptions,
        perUserLimit: input.perUserLimit,
        status: "ACTIVE",
        promoCode: {
          create: {
            code: generatePromoCode(),
            qrToken: generateCampaignToken(),
          },
        },
        ticketTypes: {
          create: input.ticketTypeIds.map((ticketTypeId) => ({ ticketTypeId })),
        },
      },
      include: {
        ...campaignInclude,
        event: { select: { slug: true } },
      },
    });
    await audit(tx, {
      actorUserId: user.id,
      eventId: event.id,
      action: "campaign.created",
      entityType: "PromotionalCampaign",
      entityId: created.id,
      description: `Campaign "${created.name}" created`,
      ipAddress: clientIp(headers),
    });
    return created;
  });

  return presentCampaign(campaign);
}

export async function updateCampaign(
  user: SessionUser,
  campaignId: string,
  input: CampaignUpdateInput,
  headers: Headers,
) {
  const existing = await requireOwnedCampaign(user, campaignId);
  if (input.ticketTypeIds) {
    const event = await requireOwnedEvent(user, existing.eventId);
    const allowed = new Set(event.ticketTypes.map((type) => type.id));
    if (input.ticketTypeIds.some((id) => !allowed.has(id))) {
      throw new ApiError(400, "VALIDATION_FAILED");
    }
  }

  const campaign = await prisma.$transaction(async (tx) => {
    if (input.ticketTypeIds) {
      await tx.campaignTicketType.deleteMany({ where: { campaignId } });
      if (input.ticketTypeIds.length > 0) {
        await tx.campaignTicketType.createMany({
          data: input.ticketTypeIds.map((ticketTypeId) => ({
            campaignId,
            ticketTypeId,
          })),
        });
      }
    }

    const updated = await tx.promotionalCampaign.update({
      where: { id: campaignId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.maxRedemptions !== undefined
          ? { maxRedemptions: input.maxRedemptions }
          : {}),
        ...(input.perUserLimit !== undefined
          ? { perUserLimit: input.perUserLimit }
          : {}),
      },
      include: {
        ...campaignInclude,
        event: { select: { slug: true } },
      },
    });

    if (input.status === "DISABLED" && updated.promoCode) {
      await tx.promoCode.update({
        where: { id: updated.promoCode.id },
        data: { isActive: false },
      });
    }
    if (input.status === "ACTIVE" && updated.promoCode) {
      await tx.promoCode.update({
        where: { id: updated.promoCode.id },
        data: { isActive: true },
      });
    }

    await audit(tx, {
      actorUserId: user.id,
      eventId: existing.eventId,
      action: "campaign.updated",
      entityType: "PromotionalCampaign",
      entityId: campaignId,
      description: `Campaign "${updated.name}" updated`,
      metadata: {
        status: input.status,
        name: input.name,
        maxRedemptions: input.maxRedemptions,
        perUserLimit: input.perUserLimit,
      },
      ipAddress: clientIp(headers),
    });

    return updated;
  });

  return presentCampaign(campaign);
}

export async function campaignQrPng(user: SessionUser, campaignId: string) {
  const campaign = await requireOwnedCampaign(user, campaignId);
  if (!campaign.promoCode) throw new ApiError(404, "NOT_FOUND");
  const url = buildCampaignUrl(
    appBaseUrl(),
    campaign.event.slug,
    campaign.promoCode.qrToken,
  );
  // Teal-on-mint so campaign QRs are visually distinct from admission tickets.
  return QRCode.toBuffer(url, {
    type: "png",
    margin: 2,
    width: 360,
    errorCorrectionLevel: "M",
    color: { dark: "#0f766e", light: "#ecfdf5" },
  });
}

export async function campaignReport(user: SessionUser, campaignId: string) {
  const campaign = await requireOwnedCampaign(user, campaignId);
  const [redemptions, orderAgg, ticketCount] = await Promise.all([
    prisma.promoRedemption.count({ where: { campaignId } }),
    prisma.order.aggregate({
      where: { campaignId, status: "PAID" },
      _sum: { subtotalKzt: true, discountKzt: true, totalKzt: true },
      _count: { _all: true },
    }),
    prisma.ticket.count({
      where: { order: { campaignId, status: "PAID" } },
    }),
  ]);

  const gross = orderAgg._sum.subtotalKzt ?? 0;
  const discount = orderAgg._sum.discountKzt ?? 0;
  const net = orderAgg._sum.totalKzt ?? 0;

  return {
    campaignId: campaign.id,
    name: campaign.name,
    redemptions,
    orders: orderAgg._count._all,
    tickets: ticketCount,
    grossKzt: gross,
    discountKzt: discount,
    netKzt: net,
  };
}

export async function previewPromo(input: {
  eventId: string;
  code?: string;
  campaignToken?: string;
  items?: { ticketTypeId: string; quantity: number; unitPriceKzt: number }[];
}) {
  if (!input.code && !input.campaignToken) {
    throw new ApiError(400, "VALIDATION_FAILED");
  }

  const promoCode = await prisma.promoCode.findFirst({
    where: {
      isActive: true,
      ...(input.code ? { code: input.code } : {}),
      ...(input.campaignToken ? { qrToken: input.campaignToken } : {}),
      campaign: { eventId: input.eventId },
    },
    include: { campaign: { include: { ticketTypes: true } } },
  });
  if (!promoCode) throw new ApiError(400, "PROMO_INVALID");

  const campaign = promoCode.campaign;
  const now = new Date();
  if (campaign.status !== "ACTIVE") throw new ApiError(400, "PROMO_INVALID");
  if (
    (campaign.startsAt && campaign.startsAt > now) ||
    (campaign.endsAt && campaign.endsAt < now)
  ) {
    throw new ApiError(400, "PROMO_INVALID");
  }

  if (input.items && campaign.ticketTypes.length > 0) {
    const allowed = new Set(campaign.ticketTypes.map((row) => row.ticketTypeId));
    if (input.items.some((item) => !allowed.has(item.ticketTypeId))) {
      throw new ApiError(400, "PROMO_INVALID");
    }
  }

  const totals = input.items
    ? computeOrderTotals(input.items, {
        type: campaign.discountType,
        value: campaign.discountValue,
      })
    : null;

  return {
    valid: true,
    code: promoCode.code,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      discountType: campaign.discountType,
      discountValue: campaign.discountValue,
    },
    totals,
  };
}
