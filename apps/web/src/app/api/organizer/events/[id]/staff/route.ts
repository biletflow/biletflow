import { prisma } from "@biletflow/db";
import { z } from "zod";
import { ApiError, errorResponse } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const eligible = { role: "ATTENDEE", status: "ACTIVE" } as const;
const identity = { id: true, name: true, email: true } as const;
type Context = { params: Promise<{ id: string }> };

async function scope(request: Request, context: Context) {
  const actor = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
  const { id } = await context.params;
  await requireOwnedEvent(actor, id);
  return { actor, id };
}

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await scope(request, context);
    const email = new URL(request.url).searchParams.get("email");
    const assignments = await prisma.staffAssignment.findMany({
      where: { eventId: id, role: "EVENT_ADMIN" },
      select: { user: { select: identity } },
      orderBy: { createdAt: "asc" },
    });
    const candidate = email === null ? null : await prisma.user.findFirst({
      where: { ...eligible, email: assertParsed(emailSchema.safeParse(email)) },
      select: identity,
    });
    return json({ staff: assignments.map((row) => row.user), candidate });
  } catch (error) {
    return errorResponse(error);
  }
}

async function change(request: Request, context: Context, assign: boolean) {
  try {
    const { actor, id } = await scope(request, context);
    const { userId } = assertParsed(z.object({ userId: z.string().min(1).max(128) }).safeParse(await readJson(request)));
    const key = { eventId: id, userId, role: "EVENT_ADMIN" } as const;
    await prisma.$transaction(async (tx) => {
      if (assign && !await tx.user.findFirst({ where: { ...eligible, id: userId }, select: { id: true } })) {
        throw new ApiError(404, "NOT_FOUND");
      }
      const result = assign
        ? await tx.staffAssignment.createMany({ data: [key], skipDuplicates: true })
        : await tx.staffAssignment.deleteMany({ where: key });
      if (result.count) {
        await audit(tx, {
          actorUserId: actor.id, eventId: id, entityId: userId, entityType: "StaffAssignment",
          action: assign ? "event.admin_assigned" : "event.admin_revoked",
          description: assign ? "Event admin assigned" : "Event admin access revoked",
        });
      }
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export function POST(request: Request, context: Context) {
  return change(request, context, true);
}

export function DELETE(request: Request, context: Context) {
  return change(request, context, false);
}
