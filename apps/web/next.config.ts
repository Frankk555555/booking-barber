import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  async redirects() {
    const appUrl = new URL(process.env.APP_URL ?? 'http://localhost:3000');
    if (!['localhost', '127.0.0.1'].includes(appUrl.hostname)) return [];
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: appUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost' }],
        destination: `${appUrl.origin}/:path*`,
        permanent: false,
      },
    ];
  },
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
