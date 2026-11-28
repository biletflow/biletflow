import { prisma } from "@biletflow/db";
import { ApiError, errorResponse } from "@/lib/api-error";
import { requireUser } from "@/lib/session";
import { eventCalendar } from "@/lib/calendar";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id, status: "PAID" },
      include: { event: { include: { venue: true } } },
    });
    if (!order) throw new ApiError(404, "NOT_FOUND");
    const origin = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    return new Response(eventCalendar({
      ...order.event,
      description: order.event.description,
      url: `${origin}/ru/events/${order.event.slug}`,
    }), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="biletflow-event.ics"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
