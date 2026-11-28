import { errorResponse } from "@/lib/api-error";
import { searchAdmin } from "@/lib/admin";
import { listAdminUsers } from "@/lib/dashboard";
import { json } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    const params = new URL(request.url).searchParams;
    if (params.get("view") === "directory") {
      return json({ users: await listAdminUsers(100) });
    }
    const query = params.get("q") ?? "";
    return json(await searchAdmin(query));
  } catch (error) {
    return errorResponse(error);
  }
}
