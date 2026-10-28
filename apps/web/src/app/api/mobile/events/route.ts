import { prisma } from "@biletflow/db";
import { ApiError, errorResponse } from "@/lib/api-error";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    if (!user.staffAssignments.some((assignment) => assignment.role === "EVENT_ADMIN")) {
      throw new ApiError(403, "FORBIDDEN");
    }
    const events = await prisma.event.findMany({
      where: {
        staff: { some: { userId: user.id, role: "EVENT_ADMIN" } },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
      orderBy: { startsAt: "asc" },
    });
    return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
