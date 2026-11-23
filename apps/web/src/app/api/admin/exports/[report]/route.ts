import { ApiError, errorResponse } from "@/lib/api-error";
import { exportOrdersCsv } from "@/lib/admin";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ report: string }> }) {
  try {
    await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    const { report } = await context.params;
    if (report !== "orders.csv") throw new ApiError(404, "NOT_FOUND");
    const body = await exportOrdersCsv();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"orders.csv\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
