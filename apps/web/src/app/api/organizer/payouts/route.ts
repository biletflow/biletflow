import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { listPayouts } from "@/lib/organizer-profile";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    return json({ payouts: await listPayouts(user) });
  } catch (error) {
    return errorResponse(error);
  }
}
