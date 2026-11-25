import { z } from "zod";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { simulateActivationFee } from "@/lib/payments";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  intentId: z.string().trim().min(1).max(120),
  outcome: z.enum(["APPROVED", "DECLINED", "ABANDONED"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const input = assertParsed(bodySchema.safeParse(await readJson(request)));
    return json(await simulateActivationFee(user.id, user.role, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
