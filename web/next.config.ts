import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // @ts-ignore
  turbo: {
    resolveAlias: {
      canvas: './src/lib/mock-canvas.js',
    },
  },
};

export default nextConfig;
