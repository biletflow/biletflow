import { prisma } from "@biletflow/db";
import { seatRowSchema } from "@biletflow/shared";

import { ApiError, errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { assertParsed, clientIp, isUniqueViolation, json, readJson } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { assertCanEditVenueMap } from "@/lib/seats";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; sectionId: string }> },
) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id, sectionId } = await context.params;
    const event = await requireOwnedEvent(user, id);
    if (!event.venueId) throw new ApiError(409, "CONFLICT");
    await assertCanEditVenueMap(user, event.venueId);
    const section = await prisma.venueSection.findFirst({
      where: { id: sectionId, venueId: event.venueId },
      select: { id: true },
    });
    if (!section) throw new ApiError(404, "NOT_FOUND");
    const input = assertParsed(seatRowSchema.safeParse(await readJson(request)));
    try {
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.seatRow.create({
          data: {
            venueSectionId: section.id,
            label: input.label,
            seats: {
              create: input.seats.map((seat) => ({
                number: seat.number,
                isAccessible: seat.isAccessible,
              })),
            },
          },
          include: { seats: { orderBy: { number: "asc" } } },
        });
        await audit(tx, {
          actorUserId: user.id,
          eventId: event.id,
          action: "seating.row_created",
          entityType: "SeatRow",
          entityId: created.id,
          description: "Seat row created",
          metadata: { label: created.label, seats: created.seats.length },
          ipAddress: clientIp(request.headers),
        });
        return created;
      });
      return json(
        {
          id: row.id,
          label: row.label,
          seats: row.seats.map((seat) => ({
            id: seat.id,
            number: seat.number,
            isAccessible: seat.isAccessible,
          })),
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
