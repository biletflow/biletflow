import { prisma, type Prisma, type TicketType, type UserRole } from "@biletflow/db";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp } from "./http";
import { refundInventory, releaseInventory } from "./inventory";

type SessionUser = {
  id: string;
  role: UserRole;
};

export async function requireOwnedEvent(user: SessionUser, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { ticketTypes: { orderBy: { displayOrder: "asc" } } },
  });
  if (!event) throw new ApiError(404, "NOT_FOUND");
  if (user.role !== "PLATFORM_ADMIN" && event.organizerId !== user.id) {
    throw new ApiError(403, "FORBIDDEN");
  }
  return event;
}

export function slugify(title: string) {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "event";
}

export async function uniqueSlug(title: string) {
  const base = slugify(title);
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const existing = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new ApiError(409, "CONFLICT");
}

export async function presentTicketTypes(ticketTypes: TicketType[]) {
  if (ticketTypes.length === 0) return [];
  const counts = await prisma.ticket.groupBy({
    by: ["ticketTypeId"],
    where: {
      ticketTypeId: { in: ticketTypes.map((ticketType) => ticketType.id) },
      status: "CHECKED_IN",
    },
    _count: { _all: true },
  });
  const checkedIn = new Map(
    counts.map((row) => [row.ticketTypeId, row._count._all]),
  );
  return ticketTypes.map((ticketType) => ({
    id: ticketType.id,
    eventId: ticketType.eventId,
    name: ticketType.name,
    description: ticketType.description,
    priceKzt: ticketType.priceKzt,
    quantity: ticketType.quantity,
    sold: ticketType.sold,
    reserved: ticketType.reserved,
    refunded: ticketType.refunded,
    maxPerOrder: ticketType.maxPerOrder,
    salesStartAt: ticketType.salesStartAt,
    salesEndAt: ticketType.salesEndAt,
    isHidden: ticketType.isHidden,
    displayOrder: ticketType.displayOrder,
    checkedIn: checkedIn.get(ticketType.id) ?? 0,
    available: Math.max(0, ticketType.quantity - ticketType.sold - ticketType.reserved),
  }));
}

export async function presentEvent(
  event: Prisma.EventGetPayload<{ include: { ticketTypes: true } }>,
) {
  const ticketTypes = await presentTicketTypes(
    [...event.ticketTypes].sort((a, b) => a.displayOrder - b.displayOrder),
  );
  return {
    id: event.id,
    organizerId: event.organizerId,
    slug: event.slug,
    title: event.title,
    description: event.description,
    category: event.category,
    coverImageUrl: event.coverImageUrl,
    venueId: event.venueId,
    status: event.status,
    visibility: event.visibility,
    seatingMode: event.seatingMode,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    capacity: event.capacity,
    refundPolicy: event.refundPolicy,
    paidSalesActive: event.paidSalesActive,
    paidSalesSuspended: event.paidSalesSuspended,
    publishedAt: event.publishedAt,
    cancelledAt: event.cancelledAt,
    cancellationReason: event.cancellationReason,
    calendarSequence: event.calendarSequence,
    ticketTypes,
  };
}

export async function loadEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { ticketTypes: { orderBy: { displayOrder: "asc" } } },
  });
  if (!event) throw new ApiError(404, "NOT_FOUND");
  return event;
}

export async function cancelEvent(
  user: SessionUser,
  eventId: string,
  reason: string,
  headers: Headers,
) {
  await requireOwnedEvent(user, eventId);
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) throw new ApiError(404, "NOT_FOUND");
    if (event.status === "CANCELLED") throw new ApiError(409, "CONFLICT");

    const orders = await tx.order.findMany({
      where: {
        eventId,
        status: { in: ["PENDING", "AWAITING_PAYMENT", "PAID"] },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    for (const order of orders) {
      if (order.status === "PAID") {
        for (const item of order.items) {
          await refundInventory(tx, item.ticketTypeId, item.quantity);
        }
        await tx.ticket.updateMany({
          where: { orderId: order.id, status: { in: ["VALID", "CHECKED_IN"] } },
          data: { status: "REFUNDED", invalidatedAt: new Date() },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: "REFUNDED" },
        });
        for (const payment of order.payments) {
          if (payment.status !== "SUCCEEDED") continue;
          await tx.refund.create({
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
          });
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: "REFUNDED" },
          });
        }
      } else {
        for (const item of order.items) {
          await releaseInventory(tx, item.ticketTypeId, item.quantity);
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
      }
    }

    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
        calendarSequence: { increment: 1 },
        paidSalesActive: false,
      },
      include: { ticketTypes: { orderBy: { displayOrder: "asc" } } },
    });
    await audit(tx, {
      actorUserId: user.id,
      eventId,
      action: "event.cancelled",
      entityType: "Event",
      entityId: eventId,
      description: "Event cancelled and paid orders refunded",
      metadata: { reason, orders: orders.length },
      ipAddress: clientIp(headers),
    });
    return updated;
  });
}
