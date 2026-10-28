import { prisma } from "@biletflow/db";

import { errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { clientIp, json } from "@/lib/http";
import { presentEvent, requireOwnedEvent, uniqueSlug } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const source = await requireOwnedEvent(user, id);
    const slug = await uniqueSlug(`${source.title} copy`);
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          organizerId: source.organizerId,
          slug,
          title: `${source.title} (copy)`,
          description: source.description,
          category: source.category,
          coverImageUrl: source.coverImageUrl,
          venueId: source.venueId,
          visibility: source.visibility,
          seatingMode: source.seatingMode,
          startsAt: source.startsAt,
          endsAt: source.endsAt,
          timezone: source.timezone,
          registrationOpensAt: source.registrationOpensAt,
          registrationClosesAt: source.registrationClosesAt,
          capacity: source.capacity,
          refundPolicy: source.refundPolicy,
          status: "DRAFT",
          paidSalesActive: false,
          ticketTypes: {
            create: source.ticketTypes.map((ticketType) => ({
              name: ticketType.name,
              description: ticketType.description,
              priceKzt: ticketType.priceKzt,
              quantity: ticketType.quantity,
              maxPerOrder: ticketType.maxPerOrder,
              salesStartAt: ticketType.salesStartAt,
              salesEndAt: ticketType.salesEndAt,
              isHidden: ticketType.isHidden,
              displayOrder: ticketType.displayOrder,
            })),
          },
        },
        include: { ticketTypes: { orderBy: { displayOrder: "asc" } } },
      });
      await audit(tx, {
        actorUserId: user.id,
        eventId: created.id,
        action: "event.duplicated",
        entityType: "Event",
        entityId: created.id,
        description: "Event duplicated as a new draft",
        metadata: { sourceEventId: source.id },
        ipAddress: clientIp(request.headers),
      });
      return created;
    });
    return json({ event: await presentEvent(event) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
