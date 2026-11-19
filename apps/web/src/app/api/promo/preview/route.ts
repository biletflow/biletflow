import { applyPromoSchema } from "@biletflow/shared";
import { z } from "zod";

import { errorResponse } from "@/lib/api-error";
import { previewPromo } from "@/lib/campaigns";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const bodySchema = applyPromoSchema.extend({
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().cuid(),
        quantity: z.number().int().positive().max(100),
        unitPriceKzt: z.number().int().nonnegative(),
      }),
    )
    .max(20)
    .optional(),
});

export async function POST(request: Request) {
  try {
    await requireUser(request.headers);
    const input = assertParsed(bodySchema.safeParse(await readJson(request)));
    return json(await previewPromo(input));
  } catch (error) {
    return errorResponse(error);
  }
}
