import { prisma } from "@biletflow/db";
import { venueSectionSchema } from "@biletflow/shared";

import { ApiError, errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { assertParsed, clientIp, isUniqueViolation, json, readJson } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { assertCanEditVenueMap } from "@/lib/seats";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const event = await requireOwnedEvent(user, id);
    if (!event.venueId) throw new ApiError(409, "CONFLICT");
    await assertCanEditVenueMap(user, event.venueId);
    const input = assertParsed(venueSectionSchema.safeParse(await readJson(request)));
    try {
      const section = await prisma.$transaction(async (tx) => {
        const created = await tx.venueSection.create({
          data: {
            venueId: event.venueId!,
            name: input.name,
            displayOrder: input.displayOrder,
            priceCategory: input.priceCategory,
          },
        });
        await audit(tx, {
          actorUserId: user.id,
          eventId: event.id,
          action: "seating.section_created",
          entityType: "VenueSection",
          entityId: created.id,
          description: "Venue section created",
          metadata: { name: created.name },
          ipAddress: clientIp(request.headers),
        });
        return created;
      });
      return json(
        {
          id: section.id,
          name: section.name,
          displayOrder: section.displayOrder,
          priceCategory: section.priceCategory,
        },
        201,
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, "CONFLICT");
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
