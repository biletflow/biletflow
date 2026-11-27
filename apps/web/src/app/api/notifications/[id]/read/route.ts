import { prisma } from "@biletflow/db";

import { ApiError, errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    await prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    const row = await prisma.notification.findFirst({
      where: { id, userId: user.id },
      select: { id: true, readAt: true },
    });
    if (!row?.readAt) throw new ApiError(404, "NOT_FOUND");
    return json({ id: row.id, readAt: row.readAt.toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
