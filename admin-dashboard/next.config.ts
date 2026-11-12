import type { NextConfig } from "next";

/**
 * Cache Components (and Partial Prefetching, which requires it) are disabled
 * deliberately for the MVP. Every dashboard route is session-gated and reads
 * live personnel data, so classic dynamic rendering is simpler and safer.
 * Revisit when adopting the next Next.js major, where both become default.
 */
const nextConfig: NextConfig = {
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["qrcode"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
