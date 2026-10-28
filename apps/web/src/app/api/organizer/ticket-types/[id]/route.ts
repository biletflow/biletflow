import { prisma } from "@biletflow/db";
import { ticketTypeInputSchema } from "@biletflow/shared";

import { ApiError, errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { assertParsed, clientIp, json, readJson } from "@/lib/http";
import { presentTicketTypes, requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

async function ownedTicketType(user: { id: string; role: "ORGANIZER" | "PLATFORM_ADMIN" | "ATTENDEE" }, ticketTypeId: string) {
  const ticketType = await prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
  if (!ticketType) throw new ApiError(404, "NOT_FOUND");
  await requireOwnedEvent(user, ticketType.eventId);
  return ticketType;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const current = await ownedTicketType(user, id);
    const input = assertParsed(ticketTypeInputSchema.safeParse(await readJson(request)));
    if (input.quantity < current.sold + current.reserved) throw new ApiError(409, "CONFLICT");
    const ticketType = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticketType.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          priceKzt: input.priceKzt,
          quantity: input.quantity,
          maxPerOrder: input.maxPerOrder,
          salesStartAt: input.salesStartAt,
          salesEndAt: input.salesEndAt,
          isHidden: input.isHidden,
        },
      });
      await audit(tx, {
        actorUserId: user.id,
        eventId: current.eventId,
        action: "ticket_type.updated",
        entityType: "TicketType",
        entityId: id,
        description: "Ticket type updated",
        metadata: { priceKzt: updated.priceKzt, quantity: updated.quantity },
        ipAddress: clientIp(request.headers),
      });
      return updated;
    });
    const [presented] = await presentTicketTypes([ticketType]);
    return json({ ticketType: presented });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const current = await ownedTicketType(user, id);
    if (current.sold > 0 || current.reserved > 0) throw new ApiError(409, "CONFLICT");
    const issued = await prisma.ticket.count({ where: { ticketTypeId: id } });
    if (issued > 0) throw new ApiError(409, "CONFLICT");
    await prisma.$transaction(async (tx) => {
      await tx.ticketType.delete({ where: { id } });
      await audit(tx, {
        actorUserId: user.id,
        eventId: current.eventId,
        action: "ticket_type.deleted",
        entityType: "TicketType",
        entityId: id,
        description: "Ticket type deleted",
        metadata: { name: current.name },
        ipAddress: clientIp(request.headers),
      });
    });
    return json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
