import { prisma } from "@biletflow/db";

import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    await requireOwnedEvent(user, id);
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const entries = await prisma.auditLog.findMany({
      where: {
        eventId: id,
        ...(action ? { action } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        description: true,
        metadata: true,
        createdAt: true,
        actorUserId: true,
      },
    });
    return json({ entries });
  } catch (error) {
    return errorResponse(error);
  }
}
