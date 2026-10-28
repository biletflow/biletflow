import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { startOrderPayment } from "@/lib/payments";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    return json(await startOrderPayment(user.id, id, request.headers));
  } catch (error) {
    return errorResponse(error);
  }
}
