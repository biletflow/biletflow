import { errorResponse } from "@/lib/api-error";
import { searchAttendees } from "@/lib/checkin";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 1) return json({ attendees: [] });
    return json({ attendees: await searchAttendees(user, id, query) });
  } catch (error) {
    return errorResponse(error);
  }
}
