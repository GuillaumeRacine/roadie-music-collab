import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Disable static optimization for pages with searchParams
    missingSuspenseWithCSRBailout: false,
  },
}

export default nextConfig;
