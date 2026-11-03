import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_ORIGIN ?? 'http://127.0.0.1:3001'}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
