import { prisma, type UserRole } from "@biletflow/db";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { lockEventSales } from "./event-sales";
import { clientIp } from "./http";
import { refundInventory } from "./inventory";
import { notifyFreeRegistrationCancelled, notifyRefundCompleted } from "./notifications";

type Actor = { id: string; role: UserRole };

const HOURS: Record<string, number> = {
  UNTIL_48H_BEFORE: 48,
  UNTIL_24H_BEFORE: 24,
};

export function refundWindowOpen(
  policy: string,
  startsAt: Date,
  now = new Date(),
) {
  const hours = HOURS[policy];
  if (hours === undefined) return false;
  return startsAt.getTime() - now.getTime() >= hours * 60 * 60 * 1000;
}

export async function refundOrder(
  user: Actor,
  orderId: string,
  reason: string | undefined,
  headers: Headers,
) {
  const settled = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id: orderId }, select: { eventId: true } });
    if (!existing) throw new ApiError(404, "NOT_FOUND");
    await lockEventSales(tx, existing.eventId);
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: true,
        tickets: { select: { id: true, status: true } },
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            refundPolicy: true,
            organizerId: true,
          },
        },
      },
    });
    if (!order) throw new ApiError(404, "NOT_FOUND");
    const allowed =
      user.role === "PLATFORM_ADMIN" ||
      order.userId === user.id ||
      order.event.organizerId === user.id;
    if (!allowed) throw new ApiError(404, "NOT_FOUND");

    const priorRefund = await tx.refund.findFirst({
      where: { orderId: order.id, status: "SUCCEEDED" },
    });
    if (order.status === "REFUNDED" || priorRefund) {
      return {
        duplicate: true,
        orderId: order.id,
        reference: order.reference,
        status: "REFUNDED" as const,
        refundId: priorRefund?.id ?? null,
        amountKzt: priorRefund?.amountKzt ?? 0,
        userId: order.userId,
        eventTitle: order.event.title,
      };
    }
    if (order.status !== "PAID") throw new ApiError(409, "CONFLICT");
    if (
      user.role !== "PLATFORM_ADMIN" &&
      user.id !== order.event.organizerId &&
      !refundWindowOpen(order.event.refundPolicy, order.event.startsAt)
    ) {
      throw new ApiError(409, "CONFLICT");
    }
    if (order.tickets.some((ticket) => ticket.status === "CHECKED_IN")) {
      throw new ApiError(409, "CONFLICT");
    }

    const invalidated = await tx.ticket.updateMany({
      where: { orderId: order.id, status: "VALID" },
      data: { status: "REFUNDED", invalidatedAt: new Date() },
    });
    if (invalidated.count !== order.tickets.length) throw new ApiError(409, "CONFLICT");
    for (const item of order.items) {
      await refundInventory(tx, item.ticketTypeId, item.quantity);
    }
    const payment = order.payments.find((row) => row.status === "SUCCEEDED");
    const refund = payment
      ? await tx.refund.create({
          data: {
            orderId: order.id,
            paymentId: payment.id,
            initiatedById: user.id,
            amountKzt: payment.amountKzt,
            reason,
            status: "SUCCEEDED",
            simulated: true,
            processedAt: new Date(),
          },
        })
      : null;
    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      });
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED" },
    });
    await audit(tx, {
      actorUserId: user.id,
      eventId: order.event.id,
      action: "order.refunded",
      entityType: "Order",
      entityId: order.id,
      description: "Simulated refund completed and tickets invalidated",
      metadata: {
        amountKzt: refund?.amountKzt ?? 0,
        reason: reason ?? null,
      },
      ipAddress: clientIp(headers),
    });
    return {
      duplicate: false,
      orderId: order.id,
      reference: order.reference,
      status: "REFUNDED" as const,
      refundId: refund?.id ?? null,
      amountKzt: refund?.amountKzt ?? 0,
      userId: order.userId,
      eventTitle: order.event.title,
    };
  });

  if (!settled.duplicate) {
    await notifyRefundCompleted({
      orderId: settled.orderId,
      userId: settled.userId,
      reference: settled.reference,
      eventTitle: settled.eventTitle,
      amountKzt: settled.amountKzt,
    });
  }

  return {
    order: {
      id: settled.orderId,
      reference: settled.reference,
      status: settled.status,
    },
    refund: settled.refundId
      ? {
          id: settled.refundId,
          amountKzt: settled.amountKzt,
          status: "SUCCEEDED" as const,
          simulated: true,
        }
      : null,
    duplicate: settled.duplicate,
  };
}

export async function cancelFreeRegistration(user: Actor, ticketId: string, headers: Headers) {
  const cancelled = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: { select: { organizerId: true, title: true } },
        attendee: { select: { email: true } },
        order: { select: { totalKzt: true, userId: true, reference: true } },
      },
    });
    if (!ticket || (user.role !== "PLATFORM_ADMIN" && user.id !== ticket.event.organizerId)) {
      throw new ApiError(404, "NOT_FOUND");
    }
    if (ticket.order.totalKzt !== 0) throw new ApiError(409, "CONFLICT");
    await lockEventSales(tx, ticket.eventId);
    const [order] = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status" FROM "Order" WHERE "id" = ${ticket.orderId} FOR UPDATE
    `;
    if (order?.status !== "PAID" && order?.status !== "CANCELLED") throw new ApiError(409, "CONFLICT");
    const now = new Date();
    const { count } = await tx.ticket.updateMany({
      where: { id: ticketId, status: "VALID", order: { status: "PAID" } },
      data: { status: "CANCELLED", invalidatedAt: now },
    });
    if (!count) {
      const current = await tx.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
      if (current?.status === "CANCELLED") return null;
      throw new ApiError(409, "CONFLICT");
    }
    await refundInventory(tx, ticket.ticketTypeId, 1);
    const remaining = await tx.ticket.count({
      where: { orderId: ticket.orderId, status: { in: ["VALID", "CHECKED_IN"] } },
    });
    if (remaining === 0) {
      await tx.order.update({
        where: { id: ticket.orderId },
        data: { status: "CANCELLED", cancelledAt: now },
      });
    }
    await audit(tx, {
      actorUserId: user.id, eventId: ticket.eventId, action: "ticket.registration_cancelled",
      entityType: "Ticket", entityId: ticketId,
      description: "Free registration cancelled and ticket invalidated", ipAddress: clientIp(headers),
    });
    return {
      ticketId, userId: ticket.order.userId, reference: ticket.order.reference,
      email: ticket.attendee.email, eventTitle: ticket.event.title,
    };
  });
  if (cancelled) await notifyFreeRegistrationCancelled(cancelled);
  return { ticket: { id: ticketId, status: "CANCELLED" }, duplicate: !cancelled };
}
