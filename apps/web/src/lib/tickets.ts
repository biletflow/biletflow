import { randomUUID } from "node:crypto";

import { prisma, type Prisma } from "@biletflow/db";
import { buildTicketCode } from "@biletflow/shared/qr.server";
import QRCode from "qrcode";

import { ApiError } from "./api-error";

export type AttendeeInput = {
  fullName: string;
  email: string;
  phone?: string;
};

export async function issueTickets(
  tx: Prisma.TransactionClient,
  input: {
    eventId: string;
    orderId: string;
    items: { id: string; ticketTypeId: string; quantity: number }[];
    attendees: AttendeeInput[];
    signingKey: string;
  },
) {
  const tickets = [];
  let cursor = 0;
  for (const item of input.items) {
    for (let index = 0; index < item.quantity; index += 1) {
      const attendeeInput = input.attendees[cursor];
      cursor += 1;
      if (!attendeeInput) throw new ApiError(400, "VALIDATION_FAILED");
      const attendee = await tx.attendee.create({
        data: {
          fullName: attendeeInput.fullName,
          email: attendeeInput.email,
          phone: attendeeInput.phone,
        },
      });
      const created = await tx.ticket.create({
        data: {
          // Placeholder is unique per row. The signed code replaces it before commit.
          code: `pending_${randomUUID()}`,
          eventId: input.eventId,
          orderId: input.orderId,
          orderItemId: item.id,
          ticketTypeId: item.ticketTypeId,
          attendeeId: attendee.id,
          status: "VALID",
        },
      });
      const ticket = await tx.ticket.update({
        where: { id: created.id },
        data: { code: buildTicketCode(created.id, input.signingKey) },
        include: {
          attendee: { select: { fullName: true, email: true } },
          ticketType: { select: { name: true } },
        },
      });
      tickets.push(ticket);
    }
  }
  return tickets;
}

export function ticketSigningKey() {
  const key = process.env.TICKET_SIGNING_KEY;
  if (!key) throw new Error("TICKET_SIGNING_KEY is not set");
  return key;
}

export async function listTicketsForUser(userId: string) {
  return prisma.ticket.findMany({
    where: { order: { userId } },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      status: true,
      issuedAt: true,
      attendee: { select: { fullName: true, email: true } },
      ticketType: { select: { name: true } },
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          timezone: true,
        },
      },
    },
  });
}

export async function qrPngForOwnedTicket(userId: string, ticketId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, order: { userId } },
    select: { code: true, status: true },
  });
  if (!ticket || ticket.status === "CANCELLED" || ticket.status === "REFUNDED") {
    throw new ApiError(404, "NOT_FOUND");
  }
  return QRCode.toBuffer(ticket.code, {
    type: "png",
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });
}

const PDF_STATUS_LABEL: Record<string, string> = {
  VALID: "Valid",
  CHECKED_IN: "Checked in",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export async function pdfForOwnedTicket(userId: string, ticketId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, order: { userId } },
    select: {
      id: true,
      code: true,
      status: true,
      sectionName: true,
      rowLabel: true,
      seatNumber: true,
      attendee: { select: { fullName: true } },
      ticketType: { select: { name: true } },
      order: { select: { reference: true } },
      event: {
        select: {
          title: true,
          startsAt: true,
          timezone: true,
          venue: { select: { name: true, address: true, city: true } },
        },
      },
    },
  });
  if (!ticket) throw new ApiError(404, "NOT_FOUND");

  const showQr = ticket.status === "VALID" || ticket.status === "CHECKED_IN";
  const qrPng = showQr
    ? await QRCode.toBuffer(ticket.code, {
        type: "png",
        margin: 1,
        width: 320,
        errorCorrectionLevel: "M",
      })
    : null;

  const venue = ticket.event.venue;
  const venueLine = venue
    ? [venue.name, venue.address, venue.city].filter(Boolean).join(" · ")
    : null;

  const seatBits = [ticket.sectionName, ticket.rowLabel, ticket.seatNumber]
    .filter(Boolean)
    .join(" / ");
  const ticketTypeName = seatBits
    ? `${ticket.ticketType.name} (${seatBits})`
    : ticket.ticketType.name;

  const { renderTicketPdf } = await import("./ticket-pdf");
  return renderTicketPdf({
    eventTitle: ticket.event.title,
    eventWhen: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: ticket.event.timezone,
    }).format(ticket.event.startsAt),
    venueLine,
    ticketTypeName,
    holderName: ticket.attendee.fullName,
    orderReference: ticket.order.reference,
    statusLabel: PDF_STATUS_LABEL[ticket.status] ?? ticket.status,
    showQr,
    qrPng,
  });
}
