import { errorResponse } from "@/lib/api-error";
import { getOwnedOrder, presentOrder } from "@/lib/checkout";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const order = await getOwnedOrder(user.id, user.role, id);
    return json({ order: presentOrder(order) });
  } catch (error) {
    return errorResponse(error);
  }
}
