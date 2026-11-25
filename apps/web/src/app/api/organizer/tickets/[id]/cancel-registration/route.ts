import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { cancelFreeRegistration } from "@/lib/refunds";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    return json(await cancelFreeRegistration(user, id, request.headers));
  } catch (error) {
    return errorResponse(error);
  }
}
