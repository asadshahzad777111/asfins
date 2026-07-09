import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
