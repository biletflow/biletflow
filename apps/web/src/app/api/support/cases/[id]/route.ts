import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { getSupportCaseOrThrow, presentSupportCase } from "@/lib/support";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const supportCase = await getSupportCaseOrThrow(user, id);
    return json({ case: presentSupportCase(supportCase) });
  } catch (error) {
    return errorResponse(error);
  }
}
