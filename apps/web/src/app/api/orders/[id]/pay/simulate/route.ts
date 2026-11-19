import { z } from "zod";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { simulateOrderPayment } from "@/lib/payments";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  outcome: z.enum(["APPROVED", "DECLINED", "ABANDONED"]),
});

/** Authenticated simulated settlement for mobile (no WebView, no client webhook secret). */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const body = assertParsed(bodySchema.safeParse(await readJson(request)));
    return json(
      await simulateOrderPayment(user.id, user.role, id, body.outcome, request.headers),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
