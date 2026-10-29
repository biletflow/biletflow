import { prisma, type UserRole } from "@biletflow/db";
import {
  parseScannedPayload,
  type CheckInInput,
  type CheckInResult,
} from "@biletflow/shared";
import { verifyTicketCode } from "@biletflow/shared/qr.server";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp, isUniqueViolation } from "./http";
import { ticketSigningKey } from "./tickets";

type Scanner = {
  id: string;
  role: UserRole;
  staffAssignments: { eventId: string; role: string }[];
};

const CAMPAIGN_MESSAGE = "This is a promotional code, not a ticket";

export function canScan(user: Scanner, eventId: string, organizerId?: string) {
  if (user.role === "PLATFORM_ADMIN") return true;
  if (organizerId && user.id === organizerId) return true;
  return user.staffAssignments.some(
    (assignment) =>
      assignment.eventId === eventId &&
      (assignment.role === "EVENT_ADMIN" || assignment.role === "CO_ORGANIZER"),
  );
}

export async function checkIn(
  user: Scanner,
  input: CheckInInput,
  headers: Headers,
): Promise<CheckInResult> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, organizerId: true },
  });
  if (!event) throw new ApiError(404, "NOT_FOUND");
  if (!canScan(user, event.id, event.organizerId)) throw new ApiError(403, "FORBIDDEN");

  const parsed = parseScannedPayload(input.payload);
  if (parsed.kind === "CAMPAIGN_QR") {
    return { result: "NOT_A_TICKET", message: CAMPAIGN_MESSAGE };
  }
  if (parsed.kind !== "ADMISSION_TICKET") {
    return { result: "NOT_A_TICKET", message: "This scan is not a ticket" };
  }

  const verified = verifyTicketCode(parsed.ticketCode, ticketSigningKey());
  if (!verified.valid || !verified.ticketId) {
    return { result: "INVALID", message: "Ticket code is invalid" };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: verified.ticketId },
    include: {
      attendee: { select: { fullName: true } },
      ticketType: { select: { name: true } },
      checkIns: { where: { activeKey: "active" }, take: 1 },
    },
  });
  if (!ticket || ticket.code !== parsed.ticketCode) {
    return { result: "INVALID", message: "Ticket code is invalid" };
  }
  if (ticket.eventId !== event.id) {
    return ticketResult("WRONG_EVENT", "Ticket is for a different event", ticket);
  }
  if (ticket.status === "CANCELLED") {
    return ticketResult("CANCELLED", "Ticket is cancelled", ticket);
  }
  if (ticket.status === "REFUNDED") {
    return ticketResult("REFUNDED", "Ticket was refunded", ticket);
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.checkInRecord.create({
        data: {
          ticketId: ticket.id,
          eventId: event.id,
          checkedInById: user.id,
          deviceLabel: input.deviceLabel,
          activeKey: "active",
        },
      });
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: "CHECKED_IN" },
      });
      await audit(tx, {
        actorUserId: user.id,
        eventId: event.id,
        action: "ticket.checked_in",
        entityType: "Ticket",
        entityId: ticket.id,
        description: "Ticket checked in",
        metadata: { checkInRecordId: created.id },
        ipAddress: clientIp(headers),
      });
      return created;
    });
    return ticketResult("VALID", "Ticket checked in", ticket, record.checkedInAt.toISOString());
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.checkInRecord.findFirst({
      where: { ticketId: ticket.id, activeKey: "active" },
    });
    return ticketResult(
      "ALREADY_CHECKED_IN",
      "Ticket was already checked in",
      ticket,
      existing?.checkedInAt.toISOString() ?? null,
    );
  }
}

function ticketResult(
  result: CheckInResult["result"],
  message: string,
  ticket: {
    id: string;
    attendee: { fullName: string };
    ticketType: { name: string };
    sectionName: string | null;
    rowLabel: string | null;
    seatNumber: string | null;
  },
  checkedInAt: string | null = null,
): CheckInResult {
  const seat = [ticket.sectionName, ticket.rowLabel, ticket.seatNumber]
    .filter(Boolean)
    .join(" ");
  return {
    result,
    message,
    ticket: {
      id: ticket.id,
      attendeeName: ticket.attendee.fullName,
      ticketTypeName: ticket.ticketType.name,
      seatLabel: seat || null,
      checkedInAt,
    },
  };
}

export async function reverseCheckIn(
  user: Scanner,
  checkInRecordId: string,
  reason: string,
  headers: Headers,
) {
  const record = await prisma.checkInRecord.findUnique({
    where: { id: checkInRecordId },
    include: { event: { select: { organizerId: true } } },
  });
  if (!record || record.reversedAt) throw new ApiError(404, "NOT_FOUND");
  if (!canScan(user, record.eventId, record.event.organizerId)) {
    throw new ApiError(403, "FORBIDDEN");
  }
  const staff = user.staffAssignments.find(
    (assignment) => assignment.eventId === record.eventId,
  );
  const allowed =
    user.role === "PLATFORM_ADMIN" ||
    user.id === record.event.organizerId ||
    staff?.role === "EVENT_ADMIN" ||
    staff?.role === "CO_ORGANIZER";
  if (!allowed) throw new ApiError(403, "FORBIDDEN");

  await prisma.$transaction(async (tx) => {
    await tx.checkInRecord.update({
      where: { id: record.id },
      data: {
        reversedById: user.id,
        reversedAt: new Date(),
        reversalReason: reason,
        activeKey: record.id,
      },
    });
    await tx.ticket.update({
      where: { id: record.ticketId },
      data: { status: "VALID" },
    });
    await audit(tx, {
      actorUserId: user.id,
      eventId: record.eventId,
      action: "ticket.check_in_reversed",
      entityType: "CheckInRecord",
      entityId: record.id,
      description: "Check-in reversed",
      metadata: { reason },
      ipAddress: clientIp(headers),
    });
  });
  return { reversed: true };
}

export async function eventStats(user: Scanner, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true },
  });
  if (!event) throw new ApiError(404, "NOT_FOUND");
  if (!canScan(user, event.id, event.organizerId)) throw new ApiError(403, "FORBIDDEN");
  const [registered, checkedIn] = await Promise.all([
    prisma.ticket.count({
      where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } },
    }),
    prisma.ticket.count({ where: { eventId, status: "CHECKED_IN" } }),
  ]);
  return { registered, checkedIn };
}

export async function searchAttendees(user: Scanner, eventId: string, query: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true },
  });
  if (!event) throw new ApiError(404, "NOT_FOUND");
  if (!canScan(user, event.id, event.organizerId)) throw new ApiError(403, "FORBIDDEN");
  const tickets = await prisma.ticket.findMany({
    where: {
      eventId,
      OR: [
        { attendee: { fullName: { contains: query, mode: "insensitive" } } },
        { attendee: { email: { contains: query, mode: "insensitive" } } },
        { order: { reference: { contains: query, mode: "insensitive" } } },
      ],
    },
    take: 50,
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      status: true,
      attendee: { select: { fullName: true, email: true } },
      ticketType: { select: { name: true } },
      order: { select: { reference: true } },
    },
  });
  return tickets.map((ticket) => ({
    ticketId: ticket.id,
    status: ticket.status,
    attendeeName: ticket.attendee.fullName,
    email: ticket.attendee.email,
    ticketTypeName: ticket.ticketType.name,
    orderReference: ticket.order.reference,
  }));
}
