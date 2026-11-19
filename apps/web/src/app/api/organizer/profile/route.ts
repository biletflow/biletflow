import { organizerProfileSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import {
  getOrganizerProfile,
  upsertOrganizerProfile,
} from "@/lib/organizer-profile";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    return json({ profile: await getOrganizerProfile(user) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const input = assertParsed(
      organizerProfileSchema.safeParse(await readJson(request)),
    );
    const profile = await upsertOrganizerProfile(user, input, request.headers);
    return json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}
