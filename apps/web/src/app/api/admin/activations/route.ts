import { errorResponse } from "@/lib/api-error";
import { listActivationQueue } from "@/lib/admin";
import { json } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    return json({ activations: await listActivationQueue() });
  } catch (error) {
    return errorResponse(error);
  }
}
