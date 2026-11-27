import { randomUUID } from "node:crypto";

import { prisma, type Prisma } from "@biletflow/db";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp, isUniqueViolation } from "./http";

export type EventSeatStatus = "AVAILABLE" | "HELD" | "SOLD" | "UNAVAILABLE";

type MapEditor = { id: string; role: "ATTENDEE" | "ORGANIZER" | "PLATFORM_ADMIN" };

/** Platform admin, or the only organizer who has events at this venue. */
export async function assertCanEditVenueMap(user: MapEditor, venueId: string) {
  if (user.role === "PLATFORM_ADMIN") return;
  const other = await prisma.event.findFirst({
    where: { venueId, organizerId: { not: user.id } },
    select: { id: true },
  });
  if (other) throw new ApiError(403, "FORBIDDEN");
}

/**
 * A seat is taken by one conditional insert. activeKey stays "active" for one
 * live hold per seat per event. A second event in the same venue is a different key.
 */
export async function holdSeat(
  tx: Prisma.TransactionClient,
  input: { seatId: string; eventId: string; userId: string; orderId: string; expiresAt: Date },
) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Seat" WHERE "id" = ${input.seatId} FOR UPDATE
  `;
  if (locked.length !== 1) throw new ApiError(409, "SOLD_OUT");
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
  seat: { id: string; status: string },
  held: Set<string>,
  sold: Set<string>,
): EventSeatStatus {
  if (sold.has(seat.id)) return "SOLD";
  if (held.has(seat.id)) return "HELD";
  if (seat.status !== "AVAILABLE") return "UNAVAILABLE";
  return "AVAILABLE";
}

export async function listFreeSeats(slug: string, includeUnavailable = false) {
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
              .filter((seat) => includeUnavailable || eventSeatStatus(seat, board.held, board.sold) === "AVAILABLE")
              .map((seat) => ({
                id: seat.id,
                number: seat.number,
                isAccessible: seat.isAccessible,
                ...(includeUnavailable ? { status: eventSeatStatus(seat, board.held, board.sold) } : {}),
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
          status: eventSeatStatus(seat, board.held, board.sold),
        })),
      })),
    })),
  };
}

export async function deleteFreeSeat(
  eventId: string,
  seatId: string,
  actor: MapEditor,
  headers: Headers,
) {
  await prisma.$transaction(async (tx) => {
    // Match checkout's Event -> Seat lock order before writing the audit log.
    await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, venueId: true },
    });
    if (!event?.venueId) throw new ApiError(404, "NOT_FOUND");
    await assertCanEditVenueMap(actor, event.venueId);
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT s."id"
      FROM "Seat" s
      JOIN "SeatRow" r ON r."id" = s."seatRowId"
      JOIN "VenueSection" sec ON sec."id" = r."venueSectionId"
      WHERE s."id" = ${seatId}
        AND sec."venueId" = ${event.venueId}
      FOR UPDATE OF s
    `;
    if (locked.length !== 1) throw new ApiError(404, "NOT_FOUND");
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
      actorUserId: actor.id,
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

export async function addSeatsToRow(
  eventId: string,
  rowId: string,
  seats: { number: string; isAccessible: boolean }[],
  actor: MapEditor,
  headers: Headers,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, venueId: true },
  });
  if (!event?.venueId) throw new ApiError(409, "CONFLICT");
  await assertCanEditVenueMap(actor, event.venueId);
  const row = await prisma.seatRow.findFirst({
    where: { id: rowId, section: { venueId: event.venueId } },
    select: { id: true },
  });
  if (!row) throw new ApiError(404, "NOT_FOUND");
  try {
    const created = await prisma.$transaction(async (tx) => {
      const inserted = await tx.seat.createManyAndReturn({
        data: seats.map((seat) => ({
          seatRowId: row.id,
          number: seat.number,
          isAccessible: seat.isAccessible,
        })),
      });
      await audit(tx, {
        actorUserId: actor.id,
        eventId,
        action: "seating.seats_added",
        entityType: "SeatRow",
        entityId: row.id,
        description: "Seats added to an existing row",
        metadata: { seats: inserted.length },
        ipAddress: clientIp(headers),
      });
      return inserted;
    });
    return {
      seats: created.map((seat) => ({
        id: seat.id,
        number: seat.number,
        isAccessible: seat.isAccessible,
        status: "AVAILABLE" as const,
      })),
    };
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(409, "CONFLICT");
    throw error;
  }
}
