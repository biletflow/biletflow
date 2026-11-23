import { identityVerificationSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import { submitIdentityVerification } from "@/lib/organizer-profile";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const input = assertParsed(identityVerificationSchema.safeParse(await readJson(request) ?? {}));
    const profile = await submitIdentityVerification(user, input.documentName, request.headers);
    return json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}
