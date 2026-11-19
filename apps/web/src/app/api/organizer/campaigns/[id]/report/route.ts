import { errorResponse } from "@/lib/api-error";
import { campaignReport } from "@/lib/campaigns";
import { json } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    return json({ report: await campaignReport(user, id) });
  } catch (error) {
    return errorResponse(error);
  }
}
