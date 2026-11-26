import { prisma } from "@biletflow/db";

import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

/** Recent in-app notifications for the signed-in user (emails are also stored). */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        subject: true,
        body: true,
        readAt: true,
        sentAt: true,
        createdAt: true,
      },
    });
    return json({
      notifications: notifications.map((row) => ({
        ...row,
        readAt: row.readAt?.toISOString() ?? null,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    if (!body?.id) return json({ code: "VALIDATION_FAILED" }, 400);
    const result = await prisma.notification.updateMany({
      where: { id: body.id, userId: user.id, channel: "IN_APP" },
      data: { readAt: new Date() },
    });
    if (result.count === 0) return json({ code: "NOT_FOUND" }, 404);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
