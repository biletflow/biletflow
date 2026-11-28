import { prisma, type UserRole } from "@biletflow/db";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { lockOrder } from "./checkout";
import { clientIp } from "./http";
import { refundInventory } from "./inventory";
import { notifyRefundCompleted } from "./notifications";

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
    if (!(await lockOrder(tx, orderId))) throw new ApiError(404, "NOT_FOUND");
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
    if (order.status !== "PAID") throw new ApiError(409, "CONFLICT", "REFUND_UNPAID");
    if (
      user.role !== "PLATFORM_ADMIN" &&
      !refundWindowOpen(order.event.refundPolicy, order.event.startsAt)
    ) {
      throw new ApiError(409, "CONFLICT",
        order.event.refundPolicy === "NO_REFUNDS" ? "REFUND_NOT_ALLOWED" : order.event.refundPolicy === "UNTIL_48H_BEFORE" ? "REFUND_WINDOW_48H" : "REFUND_WINDOW_24H");
    }
    if (order.tickets.some((ticket) => ticket.status === "CHECKED_IN")) {
      throw new ApiError(409, "CONFLICT", "REFUND_CHECKED_IN");
    }

    for (const item of order.items) {
      await refundInventory(tx, item.ticketTypeId, item.quantity);
    }
    await tx.ticket.updateMany({
      where: { orderId: order.id, status: "VALID" },
      data: { status: "REFUNDED", invalidatedAt: new Date() },
    });
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
