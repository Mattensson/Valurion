import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'ffmpeg-static', 'ffprobe-static', 'fluent-ffmpeg'],
  experimental: {
    serverActions: {
      bodySizeLimit: '1gb',
    },
  },
};

export default nextConfig;
