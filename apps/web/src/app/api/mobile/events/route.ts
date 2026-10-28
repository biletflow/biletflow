import { prisma } from "@biletflow/db";

import { ApiError, errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    if (user.staffAssignments.length === 0) throw new ApiError(403, "FORBIDDEN");
    const events = await prisma.event.findMany({
      where: { staff: { some: { userId: user.id } } },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
      orderBy: { startsAt: "asc" },
    });
    return json({ events });
  } catch (error) {
    return errorResponse(error);
  }
}
