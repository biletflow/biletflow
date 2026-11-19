import { payoutAccountSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { assertParsed, json, readJson } from "@/lib/http";
import {
  createPayoutAccount,
  listPayoutAccounts,
} from "@/lib/organizer-profile";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    return json({ accounts: await listPayoutAccounts(user) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const input = assertParsed(
      payoutAccountSchema.safeParse(await readJson(request)),
    );
    const account = await createPayoutAccount(user, input, request.headers);
    return json({ account }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
