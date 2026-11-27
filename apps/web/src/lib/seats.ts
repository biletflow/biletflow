import { randomUUID } from "node:crypto";

import { prisma, type Prisma } from "@biletflow/db";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp } from "./http";

export type EventSeatStatus = "AVAILABLE" | "HELD" | "SOLD";

/**
 * A seat is taken by one conditional insert. activeKey stays "active" for one
 * live hold per seat per event. A second event in the same venue is a different key.
 */
export async function holdSeat(
  tx: Prisma.TransactionClient,
  input: { seatId: string; eventId: string; userId: string; orderId: string; expiresAt: Date },
) {
  await tx.$executeRaw`
    UPDATE "SeatHold"
    SET "status" = 'RELEASED'::"SeatHoldStatus",
        "activeKey" = "id"
    WHERE "seatId" = ${input.seatId}
      AND "eventId" = ${input.eventId}
      AND "activeKey" = 'active'
      AND "expiresAt" <= NOW()
  `;
  const id = randomUUID();
  const inserted = await tx.$executeRaw`
    INSERT INTO "SeatHold" (
      "id", "seatId", "eventId", "userId", "orderId", "status", "expiresAt", "activeKey"
    )
    SELECT
      ${id},
      s."id",
      ${input.eventId},
      ${input.userId},
      ${input.orderId},
      'ACTIVE'::"SeatHoldStatus",
      ${input.expiresAt},
      'active'
    FROM "Seat" s
    WHERE s."id" = ${input.seatId}
      AND s."status" = 'AVAILABLE'::"SeatStatus"
      AND NOT EXISTS (
        SELECT 1 FROM "SeatHold" h
        WHERE h."seatId" = s."id"
          AND h."eventId" = ${input.eventId}
          AND h."activeKey" = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "Ticket" t
        WHERE t."seatId" = s."id"
          AND t."eventId" = ${input.eventId}
          AND t."status" IN ('VALID'::"TicketStatus", 'CHECKED_IN'::"TicketStatus")
      )
    ON CONFLICT ("seatId", "eventId", "activeKey") DO NOTHING
  `;
  if (inserted !== 1) throw new ApiError(409, "SOLD_OUT");
}

export async function releaseOrderSeats(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$executeRaw`
    UPDATE "SeatHold"
    SET "status" = 'RELEASED'::"SeatHoldStatus",
        "activeKey" = "id"
    WHERE "orderId" = ${orderId}
      AND "activeKey" = 'active'
  `;
}

export async function convertOrderSeats(tx: Prisma.TransactionClient, orderId: string) {
  return tx.$executeRaw`
    UPDATE "SeatHold"
    SET "status" = 'CONVERTED'::"SeatHoldStatus",
        "activeKey" = "id"
    WHERE "orderId" = ${orderId}
      AND "activeKey" = 'active'
      AND "status" = 'ACTIVE'::"SeatHoldStatus"
  `;
}

async function seatBoard(eventId: string, venueId: string) {
  const [sections, holds, tickets] = await Promise.all([
    prisma.venueSection.findMany({
      where: { venueId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        rows: {
          orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
          include: { seats: { orderBy: { number: "asc" } } },
        },
      },
    }),
    prisma.seatHold.findMany({
      where: { eventId, activeKey: "active", expiresAt: { gt: new Date() } },
      select: { seatId: true },
    }),
    prisma.ticket.findMany({
      where: {
        eventId,
        seatId: { not: null },
        status: { in: ["VALID", "CHECKED_IN"] },
      },
      select: { seatId: true },
    }),
  ]);
  return {
    sections,
    held: new Set(holds.map((hold) => hold.seatId)),
    sold: new Set(tickets.flatMap((ticket) => (ticket.seatId ? [ticket.seatId] : []))),
  };
}

function eventSeatStatus(
  seatId: string,
  held: Set<string>,
  sold: Set<string>,
): EventSeatStatus {
  if (sold.has(seatId)) return "SOLD";
  if (held.has(seatId)) return "HELD";
  return "AVAILABLE";
}

export async function listFreeSeats(slug: string) {
  const event = await prisma.event.findFirst({
    where: {
      slug,
      seatingMode: "ASSIGNED",
      status: "PUBLISHED",
      visibility: { in: ["PUBLIC", "UNLISTED"] },
      venueId: { not: null },
    },
    select: { id: true, venueId: true },
  });
  if (!event?.venueId) throw new ApiError(404, "NOT_FOUND");
  const board = await seatBoard(event.id, event.venueId);

  return {
    sections: board.sections
      .map((section) => ({
        id: section.id,
        name: section.name,
        rows: section.rows
          .map((row) => ({
            id: row.id,
            label: row.label,
            seats: row.seats
              .filter(
                (seat) =>
                  seat.status === "AVAILABLE" &&
                  eventSeatStatus(seat.id, board.held, board.sold) === "AVAILABLE",
              )
              .map((seat) => ({
                id: seat.id,
                number: seat.number,
                isAccessible: seat.isAccessible,
              })),
          }))
          .filter((row) => row.seats.length > 0),
      }))
      .filter((section) => section.rows.length > 0),
  };
}

export async function listEventSeats(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, venueId: true },
  });
  if (!event?.venueId) throw new ApiError(404, "NOT_FOUND");
  const board = await seatBoard(event.id, event.venueId);
  return {
    sections: board.sections.map((section) => ({
      id: section.id,
      name: section.name,
      displayOrder: section.displayOrder,
      rows: section.rows.map((row) => ({
        id: row.id,
        label: row.label,
        seats: row.seats.map((seat) => ({
          id: seat.id,
          number: seat.number,
          isAccessible: seat.isAccessible,
          status: eventSeatStatus(seat.id, board.held, board.sold),
        })),
      })),
    })),
  };
}

export async function deleteFreeSeat(
  eventId: string,
  seatId: string,
  actorId: string,
  headers: Headers,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, venueId: true },
  });
  if (!event?.venueId) throw new ApiError(404, "NOT_FOUND");
  const seat = await prisma.seat.findFirst({
    where: { id: seatId, row: { section: { venueId: event.venueId } } },
    select: { id: true },
  });
  if (!seat) throw new ApiError(404, "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    const blockingHold = await tx.seatHold.findFirst({
      where: { seatId, activeKey: "active", expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    const blockingTicket = await tx.ticket.findFirst({
      where: { seatId, status: { in: ["VALID", "CHECKED_IN"] } },
      select: { id: true },
    });
    if (blockingHold || blockingTicket) throw new ApiError(409, "CONFLICT");
    await tx.orderItem.updateMany({ where: { seatId }, data: { seatId: null } });
    await tx.ticket.updateMany({ where: { seatId }, data: { seatId: null } });
    await tx.seat.delete({ where: { id: seatId } });
    await audit(tx, {
      actorUserId: actorId,
      eventId,
      action: "seating.seat_deleted",
      entityType: "Seat",
      entityId: seatId,
      description: "Free seat removed from the venue map",
      ipAddress: clientIp(headers),
    });
  });
  return { id: seatId };
}
