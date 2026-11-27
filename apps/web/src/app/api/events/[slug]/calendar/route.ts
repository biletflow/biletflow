import { errorResponse, ApiError } from "@/lib/api-error";
import { getPublicEventBySlug } from "@/lib/events";
import { eventCalendar } from "@/lib/calendar";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const event = await getPublicEventBySlug(slug);
    if (!event) throw new ApiError(404, "NOT_FOUND");
    return new Response(eventCalendar(event), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="biletflow-event.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
