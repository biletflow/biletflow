import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import {
  listPublicEventsPayload,
  parseEventListFilters,
} from "@/lib/public-events";

export const runtime = "nodejs";

/** Public catalog. Auth is optional; only PUBLISHED + PUBLIC events are listed. */
export async function GET(request: Request) {
  try {
    const filters = parseEventListFilters(new URL(request.url));
    return json(await listPublicEventsPayload(filters));
  } catch (error) {
    return errorResponse(error);
  }
}
