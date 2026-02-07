import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
