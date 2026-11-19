import { errorResponse } from "@/lib/api-error";
import {
  campaignUpdateSchema,
  updateCampaign,
} from "@/lib/campaigns";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const input = assertParsed(
      campaignUpdateSchema.safeParse(await readJson(request)),
    );
    const campaign = await updateCampaign(user, id, input, request.headers);
    return json({ campaign });
  } catch (error) {
    return errorResponse(error);
  }
}
