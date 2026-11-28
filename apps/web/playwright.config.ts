import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel: process.env.E2E_BROWSER_CHANNEL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev --webpack --hostname 127.0.0.1 --port ${new URL(baseURL).port || "3000"}`,
    url: new URL("/api/me", baseURL).href,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 120000,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
