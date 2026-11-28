import { prisma } from "@biletflow/db";
import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireRole } from "@/lib/session";

export async function GET(request: Request) {
  try {
    await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const venues = await prisma.venue.findMany({
      select: { id: true, name: true, city: true, address: true },
      orderBy: [{ city: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    return json({ venues });
  } catch (error) {
    return errorResponse(error);
  }
}
