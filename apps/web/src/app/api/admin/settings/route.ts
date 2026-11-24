import { platformSettingsSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/admin";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    return json({ settings: await getPlatformSettings() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    const input = assertParsed(platformSettingsSchema.safeParse(await readJson(request)));
    return json({ settings: await updatePlatformSettings(user, input, request.headers) });
  } catch (error) {
    return errorResponse(error);
  }
}
