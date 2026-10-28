import { errorResponse } from "@/lib/api-error";
import { presentActivation } from "@/lib/activation";
import { json } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const event = await requireOwnedEvent(user, id);
    return json({ activation: await presentActivation(event.id, event.organizerId) });
  } catch (error) {
    return errorResponse(error);
  }
}
