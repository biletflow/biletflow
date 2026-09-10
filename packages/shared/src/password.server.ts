/**
 * Server-only password hashing. Not exported from the package index: it depends on
 * `node:crypto` and must never reach the Expo bundle.
 *
 * better-auth is configured to use these two functions via
 * `emailAndPassword.password = { hash, verify }`, so seeded users and users who sign up
 * through the UI share one hash format.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
// r=8 keeps memory within Node's default 32MB scrypt budget; raising it needs `maxmem`.
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

// `promisify(scrypt)` resolves to the 3-argument overload and drops the options
// parameter, so the wrapper is written out by hand.
function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, PARAMS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;

  const derived = await scryptAsync(password, salt);
  const storedBuffer = Buffer.from(stored, "hex");

  if (storedBuffer.length !== derived.length) return false;
  return timingSafeEqual(storedBuffer, derived);
}
