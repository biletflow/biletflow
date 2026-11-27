import { addSeatsSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { addSeatsToRow } from "@/lib/seats";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; rowId: string }> },
) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id, rowId } = await context.params;
    const event = await requireOwnedEvent(user, id);
    const input = assertParsed(addSeatsSchema.safeParse(await readJson(request)));
    return json(await addSeatsToRow(event.id, rowId, input.seats, user, request.headers), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
