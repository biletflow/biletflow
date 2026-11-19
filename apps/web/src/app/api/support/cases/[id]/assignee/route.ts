import { z } from "zod";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { presentSupportCase, updateSupportAssignee } from "@/lib/support";

export const runtime = "nodejs";

const bodySchema = z.object({
  assigneeId: z.string().cuid().nullable(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const input = assertParsed(bodySchema.safeParse(await readJson(request)));
    const supportCase = await updateSupportAssignee(
      user,
      id,
      input.assigneeId,
    );
    return json({ case: presentSupportCase(supportCase) });
  } catch (error) {
    return errorResponse(error);
  }
}
