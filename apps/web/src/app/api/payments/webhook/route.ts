import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { processPaymentWebhook } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const result = await processPaymentWebhook(
      raw,
      request.headers.get("x-biletflow-signature"),
    );
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
