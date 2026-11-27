import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { listTicketsForUser } from "@/lib/tickets";

export const runtime = "nodejs";

function presentTicket(
  ticket: Awaited<ReturnType<typeof listTicketsForUser>>[number],
) {
  return {
    id: ticket.id,
    orderId: ticket.orderId,
    status: ticket.status,
    issuedAt: ticket.issuedAt.toISOString(),
    attendeeName: ticket.attendee.fullName,
    attendeeEmail: ticket.attendee.email,
    ticketTypeName: ticket.ticketType.name,
    seatId: ticket.seatId,
    sectionName: ticket.sectionName,
    rowLabel: ticket.rowLabel,
    seatNumber: ticket.seatNumber,
    event: {
      id: ticket.event.id,
      title: ticket.event.title,
      slug: ticket.event.slug,
      startsAt: ticket.event.startsAt.toISOString(),
      timezone: ticket.event.timezone,
    },
  };
}

/** Owned tickets for the signed-in attendee (mobile My Tickets). */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const tickets = await listTicketsForUser(user.id);
    return json({ tickets: tickets.map(presentTicket) });
  } catch (error) {
    return errorResponse(error);
  }
}
