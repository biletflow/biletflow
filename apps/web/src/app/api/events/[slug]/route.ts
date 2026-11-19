import { ApiError, errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { getPublicEventPayload } from "@/lib/public-events";

export const runtime = "nodejs";

/** Public event detail by slug (PUBLIC or UNLISTED published events). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const payload = await getPublicEventPayload(slug);
    if (!payload) throw new ApiError(404, "NOT_FOUND");
    return json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
