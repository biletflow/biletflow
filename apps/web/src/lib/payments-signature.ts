import { createHmac, timingSafeEqual } from "node:crypto";

export function paymentWebhookSecret() {
  return process.env.PAYMENT_WEBHOOK_SECRET || "dev-payment-webhook-secret";
}

export function signWebhookBody(
  raw: string,
  secret = paymentWebhookSecret(),
): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

export function verifyWebhookSignature(
  raw: string,
  signature: string | null,
  secret = paymentWebhookSecret(),
) {
  if (!signature) return false;
  const expected = Buffer.from(signWebhookBody(raw, secret));
  const provided = Buffer.from(signature.trim());
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function sandboxPayUrl(intentId: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/sandbox/pay/${encodeURIComponent(intentId)}`;
}
