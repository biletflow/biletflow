import { errorResponse } from "@/lib/api-error";
import { eventStats } from "@/lib/checkin";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    return json(await eventStats(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}
