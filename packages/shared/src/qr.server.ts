/**
 * Server-only QR signing. Never import this from the Expo app or from client
 * components: it reads signing keys and depends on `node:crypto`.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { ADMISSION_PREFIX } from "./qr";

const SIGNATURE_BYTES = 16;

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function sign(value: string, key: string): string {
  return base64url(createHmac("sha256", key).update(value).digest().subarray(0, SIGNATURE_BYTES));
}

/** Builds the value stored in `Ticket.code` and encoded into the admission QR image. */
export function buildTicketCode(ticketId: string, signingKey: string): string {
  return `${ADMISSION_PREFIX}.${ticketId}.${sign(ticketId, signingKey)}`;
}

/**
 * Verifies the HMAC before any database lookup, so a forged code is rejected without
 * touching Postgres. A valid signature only proves the code was issued by us; the
 * caller must still check `Ticket.status` and event assignment.
 */
export function verifyTicketCode(
  code: string,
  signingKey: string,
): { valid: boolean; ticketId?: string } {
  const parts = code.trim().split(".");
  if (parts.length !== 3 || parts[0] !== ADMISSION_PREFIX) return { valid: false };

  const [, ticketId, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(ticketId, signingKey));
  const provided = Buffer.from(signature);

  if (expected.length !== provided.length) return { valid: false };
  if (!timingSafeEqual(expected, provided)) return { valid: false };

  return { valid: true, ticketId };
}

/**
 * Opaque campaign token. It carries no discount value: the server resolves the token
 * to a PromoCode row and recalculates the discount on every request.
 */
export function generateCampaignToken(): string {
  return base64url(randomBytes(18));
}

export function generatePromoCode(prefix = "BF"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let suffix = "";
  for (const byte of bytes) {
    suffix += alphabet[byte % alphabet.length];
  }
  return `${prefix}${suffix}`;
}
