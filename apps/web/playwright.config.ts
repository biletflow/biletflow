import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec next dev --webpack --hostname 127.0.0.1",
    url: "http://localhost:3000/api/me",
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 120000,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
