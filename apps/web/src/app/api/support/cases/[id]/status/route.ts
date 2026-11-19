import { supportStatusSchema } from "@biletflow/shared";
import { z } from "zod";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { presentSupportCase, updateSupportStatus } from "@/lib/support";

export const runtime = "nodejs";

const bodySchema = z.object({ status: supportStatusSchema });

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const input = assertParsed(bodySchema.safeParse(await readJson(request)));
    const supportCase = await updateSupportStatus(user, id, input.status);
    return json({ case: presentSupportCase(supportCase) });
  } catch (error) {
    return errorResponse(error);
  }
}
