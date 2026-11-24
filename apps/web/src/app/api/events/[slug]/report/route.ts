import { eventReportSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { reportEvent } from "@/lib/admin";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request.headers);
    const { slug } = await context.params;
    const input = assertParsed(eventReportSchema.safeParse(await readJson(request)));
    const report = await reportEvent(user.id, slug, input.reason, input.details, request.headers);
    return json({ report }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
