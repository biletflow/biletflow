import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { deleteFreeSeat } from "@/lib/seats";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; seatId: string }> },
) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id, seatId } = await context.params;
    const event = await requireOwnedEvent(user, id);
    return json(await deleteFreeSeat(event.id, seatId, user, request.headers));
  } catch (error) {
    return errorResponse(error);
  }
}
