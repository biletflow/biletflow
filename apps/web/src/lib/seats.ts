import { randomUUID } from "node:crypto";

import { prisma, type Prisma } from "@biletflow/db";

import { ApiError } from "./api-error";

/**
 * A seat is taken by one conditional insert. The partial live key matches
 * check-in: only one row per seat can keep activeKey = 'active'.
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
    ON CONFLICT ("seatId", "activeKey") DO NOTHING
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

  const [sections, holds, tickets] = await Promise.all([
    prisma.venueSection.findMany({
      where: { venueId: event.venueId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        rows: {
          orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
          include: { seats: { orderBy: { number: "asc" } } },
        },
      },
    }),
    prisma.seatHold.findMany({
      where: { eventId: event.id, activeKey: "active", expiresAt: { gt: new Date() } },
      select: { seatId: true },
    }),
    prisma.ticket.findMany({
      where: {
        eventId: event.id,
        seatId: { not: null },
        status: { in: ["VALID", "CHECKED_IN"] },
      },
      select: { seatId: true },
    }),
  ]);
  const taken = new Set<string>([
    ...holds.map((hold) => hold.seatId),
    ...tickets.flatMap((ticket) => (ticket.seatId ? [ticket.seatId] : [])),
  ]);

  return {
    sections: sections
      .map((section) => ({
        id: section.id,
        name: section.name,
        rows: section.rows
          .map((row) => ({
            id: row.id,
            label: row.label,
            seats: row.seats
              .filter((seat) => seat.status === "AVAILABLE" && !taken.has(seat.id))
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
