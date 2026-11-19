import { errorResponse } from "@/lib/api-error";
import { requireUser } from "@/lib/session";
import { pdfForOwnedTicket } from "@/lib/tickets";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const pdf = await pdfForOwnedTicket(user.id, id);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="biletflow-ticket-${id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
