import { describe, expect, it } from "vitest";

import { buildCampaignUrl, parseScannedPayload } from "./qr";
import { buildTicketCode, generateCampaignToken, verifyTicketCode } from "./qr.server";

const KEY = "test-signing-key";

describe("admission codes", () => {
  it("round-trips a signed ticket code", () => {
    const code = buildTicketCode("ckticket123", KEY);
    expect(verifyTicketCode(code, KEY)).toEqual({ valid: true, ticketId: "ckticket123" });
  });

  it("rejects a code signed with a different key", () => {
    const code = buildTicketCode("ckticket123", KEY);
    expect(verifyTicketCode(code, "other-key").valid).toBe(false);
  });

  it("rejects a tampered ticket id", () => {
    const code = buildTicketCode("ckticket123", KEY);
    const tampered = code.replace("ckticket123", "ckticket999");
    expect(verifyTicketCode(tampered, KEY).valid).toBe(false);
  });

  it("classifies a ticket code as admissible", () => {
    const parsed = parseScannedPayload(buildTicketCode("ckticket123", KEY));
    expect(parsed.kind).toBe("ADMISSION_TICKET");
  });
});

describe("campaign QR codes are never admissible", () => {
  it("classifies a campaign link as CAMPAIGN_QR, not a ticket", () => {
    const url = buildCampaignUrl(
      "https://biletflow.kz",
      "jazz-night",
      generateCampaignToken(),
    );
    const parsed = parseScannedPayload(url);

    expect(parsed.kind).toBe("CAMPAIGN_QR");
    expect(parsed.kind).not.toBe("ADMISSION_TICKET");
  });

  it("does not accept a campaign token smuggled into the admission format", () => {
    const token = generateCampaignToken();
    expect(verifyTicketCode(`BFT1.${token}.${token}`, KEY).valid).toBe(false);
  });

  it("classifies unrelated payloads as unknown", () => {
    expect(parseScannedPayload("hello world").kind).toBe("UNKNOWN");
    expect(parseScannedPayload("").kind).toBe("UNKNOWN");
  });
});
