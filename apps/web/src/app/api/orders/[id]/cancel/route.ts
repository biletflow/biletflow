import { errorResponse } from "@/lib/api-error";
import { cancelReservation } from "@/lib/checkout";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const order = await cancelReservation(user.id, id, request.headers);
    return json({ order });
  } catch (error) {
    return errorResponse(error);
  }
}
