import type { NextConfig } from "next";

import path from 'path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'ffmpeg-static', 'ffprobe-static', 'fluent-ffmpeg'],
  experimental: {
    serverActions: {
      bodySizeLimit: '1gb',
    },
  },
};

export default nextConfig;
