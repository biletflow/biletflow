import { reverseCheckInSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { reverseCheckIn } from "@/lib/checkin";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const input = assertParsed(reverseCheckInSchema.safeParse(await readJson(request)));
    return json(await reverseCheckIn(user, input.checkInRecordId, input.reason, request.headers));
  } catch (error) {
    return errorResponse(error);
  }
}
