import type { NextConfig } from "next";

import path from 'path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist'],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
