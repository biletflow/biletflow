import { prisma } from "@biletflow/db";
import { z } from "zod";
import { errorResponse, ApiError } from "@/lib/api-error";
import { presentActivation } from "@/lib/activation";
import { processPaymentWebhook } from "@/lib/payments";
import { signWebhookBody } from "@/lib/payments-signature";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
const schema = z.object({ intentId: z.string().min(1).max(120), outcome: z.enum(["APPROVED", "DECLINED", "ABANDONED"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    const event = await requireOwnedEvent(user, id);
    const input = assertParsed(schema.safeParse(await readJson(request)));
    const payment = await prisma.payment.findFirst({
      where: { providerIntentId: input.intentId, purpose: "ACTIVATION_FEE", simulated: true, activation: { eventId: event.id, organizerId: event.organizerId } },
      select: { id: true },
    });
    if (!payment) throw new ApiError(404, "NOT_FOUND");
    const payload = JSON.stringify({ ...input, eventKey: input.intentId + ":" + input.outcome });
    await processPaymentWebhook(payload, signWebhookBody(payload));
    return json({ activation: await presentActivation(event.id, event.organizerId) });
  } catch (error) {
    return errorResponse(error);
  }
}
