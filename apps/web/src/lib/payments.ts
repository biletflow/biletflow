import { randomBytes } from "node:crypto";

import { prisma, type PaymentStatus, type Prisma } from "@biletflow/db";
import { paymentWebhookSchema } from "@biletflow/shared";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp, isUniqueViolation } from "./http";
import { convertReservation, releaseInventory } from "./inventory";
import { maybeActivate } from "./activation";
import { sandboxPayUrl, verifyWebhookSignature } from "./payments-signature";
import { issueTickets, ticketSigningKey, type AttendeeInput } from "./tickets";

function intentId() {
  return `sim_${randomBytes(12).toString("hex")}`;
}

export async function startOrderPayment(userId: string, orderId: string, headers: Headers) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true },
  });
  if (!order || order.userId !== userId) throw new ApiError(404, "NOT_FOUND");
  if (order.status !== "AWAITING_PAYMENT") throw new ApiError(409, "CONFLICT");
  if (order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
    await expireOrder(order.id, userId, headers);
    throw new ApiError(409, "HOLD_EXPIRED");
  }

  const open = order.payments.find((payment) => payment.status === "CREATED");
  if (open) {
    return paymentPayload(open.providerIntentId, open.id, open.amountKzt, open.status);
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        purpose: "TICKET_ORDER",
        orderId: order.id,
        provider: "simulated",
        providerIntentId: intentId(),
        status: "CREATED",
        amountKzt: order.totalKzt,
        feeKzt: order.feeKzt,
        simulated: true,
      },
    });
    await audit(tx, {
      actorUserId: userId,
      eventId: order.eventId,
      action: "payment.started",
      entityType: "Payment",
      entityId: created.id,
      description: "Simulated ticket payment started",
      metadata: { amountKzt: created.amountKzt },
      ipAddress: clientIp(headers),
    });
    return created;
  });
  return paymentPayload(
    payment.providerIntentId,
    payment.id,
    payment.amountKzt,
    payment.status,
  );
}

async function expireOrder(orderId: string, userId: string, headers: Headers) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!current || current.status !== "AWAITING_PAYMENT") return;
    for (const item of current.items) {
      await releaseInventory(tx, item.ticketTypeId, item.quantity);
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "EXPIRED" } });
    await audit(tx, {
      actorUserId: userId,
      eventId: current.eventId,
      action: "order.expired",
      entityType: "Order",
      entityId: orderId,
      description: "Checkout hold expired and inventory was released",
      ipAddress: clientIp(headers),
    });
  });
}

function paymentPayload(
  providerIntentId: string,
  id: string,
  amountKzt: number,
  status: PaymentStatus,
) {
  return {
    payment: { id, intentId: providerIntentId, amountKzt, status },
    url: sandboxPayUrl(providerIntentId),
  };
}

export async function processPaymentWebhook(raw: string, signature: string | null) {
  if (!verifyWebhookSignature(raw, signature)) throw new ApiError(401, "UNAUTHENTICATED");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "VALIDATION_FAILED");
  }
  const parsed = paymentWebhookSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_FAILED");
  const { intentId: providerIntentId, outcome, eventKey } = parsed.data;

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({
        data: { provider: "simulated", eventKey },
      });
      const payment = await tx.payment.findUnique({
        where: { providerIntentId },
        include: { order: { include: { items: true } }, activation: true },
      });
      if (!payment) throw new ApiError(404, "NOT_FOUND");
      if (payment.status !== "CREATED" && payment.status !== "PROCESSING") {
        return { duplicate: false, ignored: true, tickets: 0 };
      }
      if (payment.purpose === "ACTIVATION_FEE") {
        await settleActivation(tx, payment, outcome);
        return { duplicate: false, ignored: false, tickets: 0 };
      }
      const order = payment.order;
      if (!order) throw new ApiError(409, "CONFLICT");
      const failed = outcome !== "APPROVED" || order.status !== "AWAITING_PAYMENT";
      const expired = Boolean(order.expiresAt && order.expiresAt.getTime() <= Date.now());
      if (failed || expired) {
        await releasePaidHold(
          tx,
          payment.id,
          order,
          outcome === "ABANDONED" ? "ABANDONED" : "FAILED",
          expired && outcome === "APPROVED" ? "EXPIRED" : "CANCELLED",
        );
        return { duplicate: false, ignored: false, tickets: 0 };
      }

      for (const item of order.items) {
        await convertReservation(tx, item.ticketTypeId, item.quantity);
      }
      const issued = await issueTickets(tx, {
        eventId: order.eventId,
        orderId: order.id,
        items: order.items,
        attendees: readAttendees(order.attendees, order.items),
        signingKey: ticketSigningKey(),
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCEEDED", succeededAt: new Date() },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      await audit(tx, {
        actorUserId: order.userId,
        eventId: order.eventId,
        action: "order.paid",
        entityType: "Order",
        entityId: order.id,
        description: "Paid order settled and tickets issued",
        metadata: { tickets: issued.length, amountKzt: payment.amountKzt },
      });
      return { duplicate: false, ignored: false, tickets: issued.length };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { duplicate: true, ignored: false, tickets: 0 };
  }
}

function readAttendees(
  value: Prisma.JsonValue | null,
  items: { quantity: number }[],
): AttendeeInput[] {
  const expected = items.reduce((sum, item) => sum + item.quantity, 0);
  if (!Array.isArray(value) || value.length !== expected) {
    throw new ApiError(409, "CONFLICT");
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ApiError(409, "CONFLICT");
    }
    const fullName = "fullName" in entry ? entry.fullName : undefined;
    const email = "email" in entry ? entry.email : undefined;
    const phone = "phone" in entry ? entry.phone : undefined;
    if (typeof fullName !== "string" || typeof email !== "string") {
      throw new ApiError(409, "CONFLICT");
    }
    return {
      fullName,
      email,
      phone: typeof phone === "string" ? phone : undefined,
    };
  });
}

async function releasePaidHold(
  tx: Prisma.TransactionClient,
  paymentId: string,
  order: {
    id: string;
    eventId: string;
    userId: string;
    items: { ticketTypeId: string; quantity: number }[];
  },
  status: "FAILED" | "ABANDONED",
  orderStatus: "CANCELLED" | "EXPIRED",
) {
  const current = await tx.order.findUnique({ where: { id: order.id } });
  if (current?.status === "AWAITING_PAYMENT") {
    for (const item of order.items) {
      await releaseInventory(tx, item.ticketTypeId, item.quantity);
    }
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: orderStatus,
        cancelledAt: orderStatus === "CANCELLED" ? new Date() : null,
      },
    });
  }
  await tx.payment.update({
    where: { id: paymentId },
    data: {
      status,
      failureReason: status === "ABANDONED" ? "abandoned" : "declined",
    },
  });
  await audit(tx, {
    actorUserId: order.userId,
    eventId: order.eventId,
    action: status === "ABANDONED" ? "payment.abandoned" : "payment.declined",
    entityType: "Payment",
    entityId: paymentId,
    description:
      status === "ABANDONED"
        ? "Simulated payment abandoned; no ticket issued"
        : "Simulated payment declined; no ticket issued",
  });
}

async function settleActivation(
  tx: Prisma.TransactionClient,
  payment: { id: string; activationId: string | null; amountKzt: number },
  outcome: "APPROVED" | "DECLINED" | "ABANDONED",
) {
  if (!payment.activationId) throw new ApiError(409, "CONFLICT");
  const activation = await tx.paidSalesActivation.findUnique({
    where: { id: payment.activationId },
  });
  if (!activation) throw new ApiError(404, "NOT_FOUND");
  if (outcome !== "APPROVED") {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: outcome === "ABANDONED" ? "ABANDONED" : "FAILED",
        failureReason: outcome === "ABANDONED" ? "abandoned" : "declined",
      },
    });
    await audit(tx, {
      actorUserId: activation.organizerId,
      eventId: activation.eventId,
      action: "activation.payment_failed",
      entityType: "PaidSalesActivation",
      entityId: activation.id,
      description: "Simulated activation fee was not paid",
    });
    return;
  }
  await tx.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCEEDED", succeededAt: new Date() },
  });
  const updated = await tx.paidSalesActivation.update({
    where: { id: activation.id },
    data: { feePaid: true },
  });
  await maybeActivate(tx, updated);
  await audit(tx, {
    actorUserId: activation.organizerId,
    eventId: activation.eventId,
    action: "activation.fee_paid",
    entityType: "PaidSalesActivation",
    entityId: activation.id,
    description: "Simulated activation fee paid",
    metadata: { amountKzt: payment.amountKzt },
  });
}

export async function paymentPage(providerIntentId: string) {
  return prisma.payment.findUnique({
    where: { providerIntentId },
    include: { order: true, activation: { include: { event: true } } },
  });
}
