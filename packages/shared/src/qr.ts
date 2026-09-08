/**
 * QR payload parsing. This module is imported by the Expo scanner, so it must stay
 * free of `node:crypto` and other Node built-ins. Signature verification lives in
 * `qr.server.ts` and runs only on the server.
 */

export const ADMISSION_PREFIX = "BFT1";

export type ScannedPayload =
  | { kind: "ADMISSION_TICKET"; ticketCode: string; ticketId: string; signature: string }
  | { kind: "CAMPAIGN_QR"; url: string; token: string }
  | { kind: "UNKNOWN"; raw: string };

const ADMISSION_PATTERN = /^BFT1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/;

/**
 * Classifies a raw scanned string. The scanner must treat anything other than
 * `ADMISSION_TICKET` as non-admissible, including `CAMPAIGN_QR`: a promotional code
 * is never permission to enter an event.
 */
export function parseScannedPayload(raw: string): ScannedPayload {
  const value = raw.trim();

  const admission = ADMISSION_PATTERN.exec(value);
  if (admission) {
    const [, ticketId, signature] = admission;
    return {
      kind: "ADMISSION_TICKET",
      ticketCode: value,
      ticketId: ticketId!,
      signature: signature!,
    };
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const token = url.searchParams.get("c");
      if (token) {
        return { kind: "CAMPAIGN_QR", url: value, token };
      }
    } catch {
      // Fall through to UNKNOWN.
    }
  }

  return { kind: "UNKNOWN", raw: value };
}

export function isAdmissionPayload(raw: string): boolean {
  return parseScannedPayload(raw).kind === "ADMISSION_TICKET";
}

export function buildCampaignUrl(appUrl: string, eventSlug: string, qrToken: string): string {
  const url = new URL(`/e/${eventSlug}`, appUrl);
  url.searchParams.set("c", qrToken);
  return url.toString();
}
