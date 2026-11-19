import { postSupportMessageSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { postSupportMessage, presentSupportCase } from "@/lib/support";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const input = assertParsed(
      postSupportMessageSchema.safeParse(await readJson(request)),
    );
    const supportCase = await postSupportMessage(user, id, input.body);
    return json({ case: presentSupportCase(supportCase) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
