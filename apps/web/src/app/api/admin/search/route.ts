import { errorResponse } from "@/lib/api-error";
import { searchAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return json(await searchAdmin(query));
  } catch (error) {
    return errorResponse(error);
  }
}
