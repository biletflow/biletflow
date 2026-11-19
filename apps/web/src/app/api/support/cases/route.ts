import { createSupportCaseSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";
import {
  createSupportCase,
  listSupportCases,
  presentSupportCase,
} from "@/lib/support";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const cases = await listSupportCases(user);
    return json({ cases: cases.map(presentSupportCase) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const input = assertParsed(
      createSupportCaseSchema.safeParse(await readJson(request)),
    );
    const supportCase = await createSupportCase(user, input);
    return json({ case: presentSupportCase(supportCase) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
