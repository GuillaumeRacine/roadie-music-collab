import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    // Silence workspace root inference warning when launched from monorepo root
    root: __dirname,
  },
};

export default nextConfig;
