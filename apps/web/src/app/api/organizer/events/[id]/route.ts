import { prisma } from "@biletflow/db";
import { eventInputSchema } from "@biletflow/shared";

import { ApiError, errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { assertParsed, clientIp, json, readJson } from "@/lib/http";
import { presentEvent, requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

async function idFrom(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) throw new ApiError(404, "NOT_FOUND");
  return id;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const event = await requireOwnedEvent(user, await idFrom(context));
    return json({ event: await presentEvent(event) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const eventId = await idFrom(context);
    await requireOwnedEvent(user, eventId);
    const input = assertParsed(eventInputSchema.safeParse(await readJson(request)));
    const event = await prisma.$transaction(async (tx) => {
      const current = await tx.event.findUnique({ where: { id: eventId } });
      if (!current) throw new ApiError(404, "NOT_FOUND");
      if (current.status === "CANCELLED" || current.status === "COMPLETED") {
        throw new ApiError(409, "CONFLICT");
      }
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          title: input.title,
          description: input.description,
          category: input.category,
          coverImageUrl: input.coverImageUrl,
          venueId: input.venueId,
          visibility: input.visibility,
          seatingMode: input.seatingMode,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: input.timezone,
          registrationOpensAt: input.registrationOpensAt,
          registrationClosesAt: input.registrationClosesAt,
          capacity: input.capacity,
          refundPolicy: input.refundPolicy,
          calendarSequence:
            current.status === "PUBLISHED" ? { increment: 1 } : current.calendarSequence,
        },
        include: { ticketTypes: { orderBy: { displayOrder: "asc" } } },
      });
      await audit(tx, {
        actorUserId: user.id,
        eventId,
        action: "event.updated",
        entityType: "Event",
        entityId: eventId,
        description: "Event details updated",
        metadata: { title: updated.title },
        ipAddress: clientIp(request.headers),
      });
      return updated;
    });
    return json({ event: await presentEvent(event) });
  } catch (error) {
    return errorResponse(error);
  }
}
