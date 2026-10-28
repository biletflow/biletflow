/**
 * Team demo (#88).
 *
 * Organizer publishes an event, an attendee takes a free ticket and a paid
 * ticket through the simulated gateway, then a scanner admits the paid QR.
 * Decline and Abandon are included and must not create tickets.
 *
 * Requires Postgres, a migrated schema, and:
 *   RUN_AUTH_INTEGRATION=1 pnpm --filter web exec vitest run src/lib/commerce.integration.test.ts
 *
 * This file is the one command for that run.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  "pnpm",
  ["--filter", "web", "exec", "vitest", "run", "src/lib/commerce.integration.test.ts"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, RUN_AUTH_INTEGRATION: "1" },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  "Demo complete: publish, free ticket, paid Approve, Decline and Abandon with no extra ticket, then QR check-in.",
);
