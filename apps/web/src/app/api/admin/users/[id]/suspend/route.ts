import { suspendSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { suspendUser } from "@/lib/admin";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const input = assertParsed(suspendSchema.safeParse(await readJson(request)));
    return json(await suspendUser(user, id, input.reason, request.headers));
  } catch (error) {
    return errorResponse(error);
  }
}
