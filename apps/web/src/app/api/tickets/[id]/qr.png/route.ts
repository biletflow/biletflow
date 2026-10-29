import { errorResponse } from "@/lib/api-error";
import { requireUser } from "@/lib/session";
import { qrPngForOwnedTicket } from "@/lib/tickets";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const png = await qrPngForOwnedTicket(user.id, id);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
