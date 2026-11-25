import { prisma, type NotificationType, type Prisma } from "@biletflow/db";

import { sendMail } from "./mail";

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

  const ticketsUrl = `${appBaseUrl()}/${user.locale || "ru"}/tickets`;
  const subject = `BiletFlow order ${input.reference} confirmed`;
  const body = [
    `Your order ${input.reference} for "${input.eventTitle}" is confirmed.`,
    "",
    `Tickets issued: ${input.ticketCount}`,
    `Total: ₸${input.totalKzt}`,
    "",
    `View tickets: ${ticketsUrl}`,
    "",
    "This is a simulated academic notification (Mailpit in development).",
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
      subject: `BiletFlow tickets for ${input.reference}`,
      body: [
        `Your admission tickets for "${input.eventTitle}" are ready.`,
        `Open My tickets to show the QR or download the PDF: ${ticketsUrl}`,
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

  const subject = `BiletFlow payment ${input.reason.toLowerCase()} for ${input.reference}`;
  const body = [
    `Payment for order ${input.reference} ("${input.eventTitle}") did not complete (${input.reason}).`,
    "No tickets were issued. You can start checkout again from the event page.",
  ].join("\n");

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

  const subject = `BiletFlow reservation cancelled (${input.reference})`;
  const body = [
    `Your unpaid reservation ${input.reference} for "${input.eventTitle}" was cancelled.`,
    "Inventory was released. No payment was taken.",
  ].join("\n");

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

export async function notifyFreeRegistrationCancelled(input: {
  ticketId: string; userId: string; reference: string; email: string; eventTitle: string;
}) {
  await deliver({
    userId: input.userId,
    email: input.email,
    type: "EVENT_CANCELLED",
    subject: "BiletFlow registration cancelled (" + input.reference + ")",
    body: "Your registration for " + input.eventTitle + " was cancelled. The ticket is no longer valid.",
    payload: { cancelledTicketId: input.ticketId, reference: input.reference },
  });
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
  const subject = `BiletFlow refund for ${input.reference}`;
  const body = [
    `Order ${input.reference} for "${input.eventTitle}" was refunded.`,
    `Amount: ₸${input.amountKzt}. This is a simulated refund. No card was charged or credited.`,
    "The admission tickets on this order are no longer valid.",
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
  const subject = `BiletFlow event cancelled: ${input.eventTitle}`;
  const body = [
    `"${input.eventTitle}" was cancelled.`,
    `Order ${input.reference}. Reason: ${input.reason}`,
    input.refunded
      ? "A simulated refund was recorded and the tickets are no longer valid."
      : "The unpaid reservation was released. No payment was taken.",
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
  const subject = `BiletFlow support ${input.reference}`;
  const body = [
    `There is a new message on support case ${input.reference}.`,
    `Subject: ${input.subject}`,
    "Open the case in BiletFlow to reply.",
  ].join("\n");
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
