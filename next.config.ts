import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "strapi.zrkgroup.com",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
