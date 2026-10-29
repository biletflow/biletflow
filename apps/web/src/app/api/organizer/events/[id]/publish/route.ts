import { prisma } from "@biletflow/db";

import { ApiError, errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { clientIp, json } from "@/lib/http";
import { presentEvent, requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    await requireOwnedEvent(user, id);
    const event = await prisma.$transaction(async (tx) => {
      const current = await tx.event.findUnique({ where: { id } });
      if (!current) throw new ApiError(404, "NOT_FOUND");
      if (current.status !== "DRAFT") throw new ApiError(409, "CONFLICT");
      const visible = await tx.ticketType.count({
        where: { eventId: id, isHidden: false },
      });
      if (visible < 1) throw new ApiError(409, "CONFLICT");
      const updated = await tx.event.update({
        where: { id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
        include: { ticketTypes: { orderBy: { displayOrder: "asc" } } },
      });
      await audit(tx, {
        actorUserId: user.id,
        eventId: id,
        action: "event.published",
        entityType: "Event",
        entityId: id,
        description: "Event published",
        ipAddress: clientIp(request.headers),
      });
      return updated;
    });
    return json({ event: await presentEvent(event) });
  } catch (error) {
    return errorResponse(error);
  }
}
