import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Silence Next 16 Turbopack/webpack mixed-config warning; we only tweak webpack in dev.
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable persistent filesystem cache in dev to prevent
      // PackFileCacheStrategy ENOENT + TypeError e[o] errors
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
