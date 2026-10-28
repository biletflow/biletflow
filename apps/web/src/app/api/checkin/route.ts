import { checkInSchema } from "@biletflow/shared";

import { checkIn } from "@/lib/checkin";
import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const input = assertParsed(checkInSchema.safeParse(await readJson(request)));
    return json(await checkIn(user, input, request.headers));
  } catch (error) {
    return errorResponse(error);
  }
}
