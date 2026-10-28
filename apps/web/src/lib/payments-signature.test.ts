import { describe, expect, it } from "vitest";

import { signWebhookBody, verifyWebhookSignature } from "./payments-signature";

describe("payment webhook signature", () => {
  it("accepts the HMAC of the raw body and rejects a different body", () => {
    const raw = JSON.stringify({ intentId: "sim_1", outcome: "APPROVED", eventKey: "sim_1:APPROVED" });
    const signature = signWebhookBody(raw, "test-secret");
    expect(verifyWebhookSignature(raw, signature, "test-secret")).toBe(true);
    expect(verifyWebhookSignature(`${raw} `, signature, "test-secret")).toBe(false);
    expect(verifyWebhookSignature(raw, null, "test-secret")).toBe(false);
    expect(verifyWebhookSignature(raw, signature, "other-secret")).toBe(false);
  });
});
