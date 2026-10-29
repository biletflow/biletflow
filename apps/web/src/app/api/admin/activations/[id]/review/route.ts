import { activationReviewSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { reviewActivation } from "@/lib/activation";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const input = assertParsed(activationReviewSchema.safeParse(await readJson(request)));
    const activation = await reviewActivation(
      user.id,
      id,
      input.decision,
      input.note,
      request.headers,
    );
    return json({ activation });
  } catch (error) {
    return errorResponse(error);
  }
}
