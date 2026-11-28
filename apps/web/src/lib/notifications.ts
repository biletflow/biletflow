import { prisma, type NotificationType, type Prisma } from "@biletflow/db";

import { sendMail } from "./mail";
import { notificationCopy, notificationLocale } from "./notification-copy";

type OrderNotifyInput = {
  orderId: string;
  userId: string;
  reference: string;
  eventTitle: string;
  totalKzt: number;
  ticketCount: number;
  locale?: string | null;
};

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}

async function alreadySent(
  userId: string,
  type: NotificationType,
  orderId: string,
) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      channel: "EMAIL",
      payload: { path: ["orderId"], equals: orderId },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function deliver(input: {
  userId: string;
  email: string;
  type: NotificationType;
  subject: string;
  body: string;
  payload: Prisma.InputJsonValue;
}) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      channel: "EMAIL",
      subject: input.subject,
      body: input.body,
      payload: input.payload,
    },
  });
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      channel: "IN_APP",
      subject: input.subject,
      body: input.body,
      payload: input.payload,
      sentAt: new Date(),
    },
  });

  try {
    await sendMail({
      to: input.email,
      subject: input.subject,
      text: input.body,
    });
    await prisma.notification.update({
      where: { id: row.id },
      data: { sentAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    await prisma.notification.update({
      where: { id: row.id },
      data: { error: message.slice(0, 500) },
    });
  }
}

async function userEmail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, locale: true },
  });
  return user;
}

export async function notifyOrderPaid(input: OrderNotifyInput) {
  if (await alreadySent(input.userId, "ORDER_CONFIRMATION", input.orderId)) {
    return { skipped: true };
  }
  const user = await userEmail(input.userId);
  if (!user) return { skipped: true };

  const locale = notificationLocale(user.locale);
  const copy = notificationCopy[locale];
  const ticketsUrl = `${appBaseUrl()}/${locale}/tickets`;
  const subject = copy.order(input.reference);
  const body = [
    copy.confirmation(input.reference, input.eventTitle),
    "",
    copy.quantity(input.ticketCount),
    copy.total(input.totalKzt),
    "",
    copy.view(ticketsUrl),
    ...(input.totalKzt > 0 ? ["", copy.testPayment] : []),
  ].join("\n");

  await deliver({
    userId: input.userId,
    email: user.email,
    type: "ORDER_CONFIRMATION",
    subject,
    body,
    payload: {
      orderId: input.orderId,
      reference: input.reference,
      ticketCount: input.ticketCount,
    },
  });

  // Companion ticket-delivery record for the same successful settlement.
  if (!(await alreadySent(input.userId, "TICKET_DELIVERY", input.orderId))) {
    await deliver({
      userId: input.userId,
      email: user.email,
      type: "TICKET_DELIVERY",
      subject: copy.tickets(input.reference),
      body: [
        copy.ready(input.eventTitle),
        copy.view(ticketsUrl),
      ].join("\n"),
      payload: {
        orderId: input.orderId,
        reference: input.reference,
        ticketCount: input.ticketCount,
      },
    });
  }

  return { skipped: false };
}

export async function notifyPaymentFailed(input: {
  orderId: string;
  userId: string;
  reference: string;
  eventTitle: string;
  reason: "FAILED" | "ABANDONED" | "EXPIRED";
}) {
  if (await alreadySent(input.userId, "PAYMENT_FAILED", input.orderId)) {
    return { skipped: true };
  }
  const user = await userEmail(input.userId);
  if (!user) return { skipped: true };

  const copy = notificationCopy[notificationLocale(user.locale)];
  const subject = copy.failed(input.reference);
  const body = copy.tryAgain(input.eventTitle);

  await deliver({
    userId: input.userId,
    email: user.email,
    type: "PAYMENT_FAILED",
    subject,
    body,
    payload: {
      orderId: input.orderId,
      reference: input.reference,
      reason: input.reason,
    },
  });
  return { skipped: false };
}

export async function notifyReservationCancelled(input: {
  orderId: string;
  userId: string;
  reference: string;
  eventTitle: string;
}) {
  // No dedicated cancel enum; key idempotency on payload.cancelledOrderId.
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      channel: "EMAIL",
      payload: { path: ["cancelledOrderId"], equals: input.orderId },
    },
    select: { id: true },
  });
  if (existing) return { skipped: true };

  const user = await userEmail(input.userId);
  if (!user) return { skipped: true };

  const copy = notificationCopy[notificationLocale(user.locale)];
  const subject = copy.reservation(input.reference);
  const body = copy.released(input.eventTitle);

  await deliver({
    userId: input.userId,
    email: user.email,
    type: "EVENT_UPDATED",
    subject,
    body,
    payload: {
      cancelledOrderId: input.orderId,
      orderId: input.orderId,
      reference: input.reference,
    },
  });
  return { skipped: false };
}

export async function notifyRefundCompleted(input: {
  orderId: string;
  userId: string;
  reference: string;
  eventTitle: string;
  amountKzt: number;
}) {
  if (await alreadySent(input.userId, "REFUND_COMPLETED", input.orderId)) {
    return { skipped: true };
  }
  const user = await userEmail(input.userId);
  if (!user) return { skipped: true };
  const copy = notificationCopy[notificationLocale(user.locale)];
  const subject = copy.refund(input.reference);
  const body = [
    copy.refundAmount(input.eventTitle, input.amountKzt),
    copy.invalid,
  ].join("\n");
  await deliver({
    userId: input.userId,
    email: user.email,
    type: "REFUND_COMPLETED",
    subject,
    body,
    payload: {
      orderId: input.orderId,
      reference: input.reference,
      amountKzt: input.amountKzt,
    },
  });
  return { skipped: false };
}

export async function notifyEventCancelled(input: {
  orderId: string;
  userId: string;
  reference: string;
  eventTitle: string;
  reason: string;
  refunded: boolean;
}) {
  if (await alreadySent(input.userId, "EVENT_CANCELLED", input.orderId)) {
    return { skipped: true };
  }
  const user = await userEmail(input.userId);
  if (!user) return { skipped: true };
  const copy = notificationCopy[notificationLocale(user.locale)];
  const subject = copy.cancelled(input.eventTitle);
  const body = [
    copy.reason(input.reference, input.reason),
    input.refunded
      ? copy.cancelledRefund
      : copy.released(input.eventTitle),
  ].join("\n");
  await deliver({
    userId: input.userId,
    email: user.email,
    type: "EVENT_CANCELLED",
    subject,
    body,
    payload: {
      orderId: input.orderId,
      reference: input.reference,
      refunded: input.refunded,
    },
  });
  return { skipped: false };
}

export async function notifyCancelledEventOrders(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, cancellationReason: true },
  });
  if (!event) return;
  const orders = await prisma.order.findMany({
    where: { eventId, status: { in: ["REFUNDED", "CANCELLED"] } },
    select: { id: true, userId: true, reference: true, status: true },
  });
  for (const order of orders) {
    await notifyEventCancelled({
      orderId: order.id,
      userId: order.userId,
      reference: order.reference,
      eventTitle: event.title,
      reason: event.cancellationReason ?? "Cancelled",
      refunded: order.status === "REFUNDED",
    });
  }
}

export async function notifySupportMessage(input: {
  recipientId: string;
  caseId: string;
  messageId: string;
  reference: string;
  subject: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.recipientId,
      type: "SUPPORT_MESSAGE",
      channel: "EMAIL",
      payload: { path: ["messageId"], equals: input.messageId },
    },
    select: { id: true },
  });
  if (existing) return { skipped: true };
  const user = await userEmail(input.recipientId);
  if (!user) return { skipped: true };
  const copy = notificationCopy[notificationLocale(user.locale)];
  const subject = copy.support(input.reference);
  const body = copy.supportReply(input.subject);
  await deliver({
    userId: input.recipientId,
    email: user.email,
    type: "SUPPORT_MESSAGE",
    subject,
    body,
    payload: {
      caseId: input.caseId,
      messageId: input.messageId,
      reference: input.reference,
    },
  });
  return { skipped: false };
}
