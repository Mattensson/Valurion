import type { NextConfig } from "next";

// Extend type to allow top-level serverActions until types catch up
type NextConfigWithActions = NextConfig & { serverActions?: { bodySizeLimit?: string } };

const nextConfig: NextConfigWithActions = {
  serverExternalPackages: ['pdfjs-dist', 'ffmpeg-static', 'ffprobe-static', 'fluent-ffmpeg'],
  // Top-level config for Server Actions (applies the actual body limit)
  serverActions: {
    bodySizeLimit: '1gb',
  },
  // Keep experimental flag enabled for serverActions feature itself
  experimental: {
    serverActions: {
      bodySizeLimit: '1gb',
    },
  },
};

export default nextConfig;
