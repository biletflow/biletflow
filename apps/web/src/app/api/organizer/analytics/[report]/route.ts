import { analyticsQuerySchema } from "@biletflow/shared";

import {
  analyticsAttendance,
  analyticsByTicketType,
  analyticsCampaigns,
  analyticsSalesOverTime,
  analyticsSummary,
} from "@/lib/analytics";
import { ApiError, errorResponse } from "@/lib/api-error";
import { assertParsed, json } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const reports = {
  summary: analyticsSummary,
  "sales-over-time": analyticsSalesOverTime,
  "by-ticket-type": analyticsByTicketType,
  campaigns: analyticsCampaigns,
  attendance: analyticsAttendance,
} as const;

export async function GET(request: Request, context: { params: Promise<{ report: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { report } = await context.params;
    const handler = reports[report as keyof typeof reports];
    if (!handler) throw new ApiError(404, "NOT_FOUND");
    const url = new URL(request.url);
    const query = assertParsed(
      analyticsQuerySchema.safeParse({
        eventId: url.searchParams.get("eventId") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        ticketTypeId: url.searchParams.get("ticketTypeId") || undefined,
      }),
    );
    return json(await handler(user, query));
  } catch (error) {
    return errorResponse(error);
  }
}
