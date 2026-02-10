import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core"],
  outputFileTracingIncludes: {
    "/api/audit": ["./node_modules/@sparticuz/chromium/bin/**"],
  },

  /* Enable gzip/brotli compression for smaller payloads */
  compress: true,

  /* Optimise production builds */
  productionBrowserSourceMaps: false,

  /* Cache headers for static assets */
  async headers() {
    return [
      {
        source: "/:path*.(svg|ico|woff|woff2|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
