import { errorResponse } from "@/lib/api-error";
import { acceptActivationTerms } from "@/lib/activation";
import { json } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const event = await requireOwnedEvent(user, id);
    const activation = await acceptActivationTerms(event.organizerId, event.id, request.headers);
    return json({ activation });
  } catch (error) {
    return errorResponse(error);
  }
}
