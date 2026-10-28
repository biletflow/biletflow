import { eventCancelSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { cancelEvent, presentEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const input = assertParsed(eventCancelSchema.safeParse(await readJson(request)));
    const event = await cancelEvent(user, id, input.reason, request.headers);
    return json({ event: await presentEvent(event) });
  } catch (error) {
    return errorResponse(error);
  }
}
