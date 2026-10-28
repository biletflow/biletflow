import { prisma } from "@biletflow/db";
import { ticketTypeInputSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { assertParsed, clientIp, json, readJson } from "@/lib/http";
import { presentTicketTypes, requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const event = await requireOwnedEvent(user, id);
    return json({ ticketTypes: await presentTicketTypes(event.ticketTypes) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const event = await requireOwnedEvent(user, id);
    const input = assertParsed(ticketTypeInputSchema.safeParse(await readJson(request)));
    const ticketType = await prisma.$transaction(async (tx) => {
      const created = await tx.ticketType.create({
        data: {
          eventId: event.id,
          name: input.name,
          description: input.description,
          priceKzt: input.priceKzt,
          quantity: input.quantity,
          maxPerOrder: input.maxPerOrder,
          salesStartAt: input.salesStartAt,
          salesEndAt: input.salesEndAt,
          isHidden: input.isHidden,
          displayOrder: event.ticketTypes.length,
        },
      });
      await audit(tx, {
        actorUserId: user.id,
        eventId: event.id,
        action: "ticket_type.created",
        entityType: "TicketType",
        entityId: created.id,
        description: "Ticket type created",
        metadata: { name: created.name, priceKzt: created.priceKzt, quantity: created.quantity },
        ipAddress: clientIp(request.headers),
      });
      return created;
    });
    const [presented] = await presentTicketTypes([ticketType]);
    return json({ ticketType: presented }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
