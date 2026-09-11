import path from "node:path";

import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Next would otherwise regenerate AGENTS.md and CLAUDE.md inside apps/web on every
  // dev start; the repo keeps its agent instructions at the root.
  agentRules: false,
  // Required by infra/Dockerfile.web.
  output: "standalone",
  // Workspace packages ship TypeScript source, so Next must compile them.
  transpilePackages: ["@biletflow/shared", "@biletflow/db"],
  // The Dockerfile copies from the repo root, not apps/web.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withNextIntl(nextConfig);
