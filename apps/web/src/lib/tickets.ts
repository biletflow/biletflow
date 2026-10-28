import { randomUUID } from "node:crypto";

import type { Prisma } from "@biletflow/db";
import { buildTicketCode } from "@biletflow/shared/qr.server";

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
