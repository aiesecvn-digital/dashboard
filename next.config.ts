import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: process.env.NODE_ENV === 'production' ? '/web-tracking-dashboard' : '',
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
