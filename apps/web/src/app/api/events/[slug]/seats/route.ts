import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { listFreeSeats } from "@/lib/seats";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    return json(await listFreeSeats(slug));
  } catch (error) {
    return errorResponse(error);
  }
}
