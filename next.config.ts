import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Large kitchen photo + per-zone PNG cutouts easily exceed the 10MB proxy /
  // 1MB server-action defaults. Vercel still enforces ~4.5MB at the edge — the
  // wizard compresses client-side for that — but local/self-host needs headroom.
  experimental: {
    proxyClientMaxBodySize: "50mb",
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "strapi.zrkgroup.com",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "pub-901502176f964fd18fa9e875b6346c6f.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
