import type { NextConfig } from "next";

import path from 'path';

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // @ts-ignore
  turbo: {
    resolveAlias: {
      canvas: path.join(process.cwd(), 'src/lib/mock-canvas.js'),
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
