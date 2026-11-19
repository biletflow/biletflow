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
