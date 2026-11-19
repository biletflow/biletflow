import { campaignInputSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import {
  createEventCampaign,
  listEventCampaigns,
} from "@/lib/campaigns";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    return json({ campaigns: await listEventCampaigns(user, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const input = assertParsed(
      campaignInputSchema.safeParse(await readJson(request)),
    );
    const campaign = await createEventCampaign(
      user,
      id,
      input,
      request.headers,
    );
    return json({ campaign }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
