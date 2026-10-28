import { prisma } from "@biletflow/db";
import { eventInputSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { assertParsed, clientIp, json, readJson } from "@/lib/http";
import { presentEvent, uniqueSlug } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const input = assertParsed(eventInputSchema.safeParse(await readJson(request)));
    const slug = await uniqueSlug(input.title);
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          organizerId: user.id,
          slug,
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
          status: "DRAFT",
        },
        include: { ticketTypes: true },
      });
      await audit(tx, {
        actorUserId: user.id,
        eventId: created.id,
        action: "event.created",
        entityType: "Event",
        entityId: created.id,
        description: "Event draft created",
        metadata: { title: created.title },
        ipAddress: clientIp(request.headers),
      });
      return created;
    });
    return json({ event: await presentEvent(event) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
