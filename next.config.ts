import type { NextConfig } from 'next';

/**
 * Zero server runtime is a constitutional requirement (Principle II).
 * `output: 'export'` makes server-only features a BUILD ERROR rather than a
 * silent runtime dependency, so a violation fails the build instead of shipping.
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
