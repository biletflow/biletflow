import { refundOrderSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { refundOrder } from "@/lib/refunds";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const body = await readJson(request);
    const raw = body && typeof body === "object" && !Array.isArray(body) ? body : {};
    const input = assertParsed(refundOrderSchema.safeParse({ ...raw, orderId: id }));
    const result = await refundOrder(user, id, input.reason, request.headers);
    return json(result, result.duplicate ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
