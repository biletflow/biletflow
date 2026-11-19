import { prisma, type Prisma } from "@biletflow/db";

import { ApiError, errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const authorizedScope = new URL(request.url).searchParams.get("scope") === "authorized";
    let where: Prisma.EventWhereInput = { staff: { some: { userId: user.id } } };
    if (authorizedScope) {
      where = user.role === "PLATFORM_ADMIN" ? {} : {
        OR: [
          { organizerId: user.id },
          { staff: { some: { userId: user.id, role: { in: ["EVENT_ADMIN", "CO_ORGANIZER"] } } } },
        ],
      };
    } else if (user.staffAssignments.length === 0) {
      throw new ApiError(403, "FORBIDDEN");
    }
    const events = await prisma.event.findMany({
      where,
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
