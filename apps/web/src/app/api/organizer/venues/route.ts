import { prisma } from "@biletflow/db";
import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const venues = await prisma.venue.findMany({
      orderBy: [{ city: "asc" }, { name: "asc" }],
      select: { id: true, name: true, city: true, address: true },
    });
    return json({ venues });
  } catch (error) {
    return errorResponse(error);
  }
}
