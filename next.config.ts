import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core"],
  outputFileTracingIncludes: {
    "/api/audit": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
