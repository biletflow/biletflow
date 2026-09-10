import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by infra/Dockerfile.web.
  output: "standalone",
  // Workspace packages ship TypeScript source, so Next must compile them.
  transpilePackages: ["@biletflow/shared", "@biletflow/db"],
  // The Dockerfile copies from the repo root, not apps/web.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
