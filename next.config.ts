import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is authenticated, per-request data, so the classic dynamic rendering model is used (no Cache Components).
  serverExternalPackages: ["pg"],
  experimental: {
    // Document uploads: up to 10 MB per file, several files per request
    serverActions: { bodySizeLimit: "55mb" },
    proxyClientMaxBodySize: "55mb",
  },
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
