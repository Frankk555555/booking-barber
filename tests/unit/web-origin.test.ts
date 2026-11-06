import { expect, test } from 'bun:test';
import config from '../../apps/web/next.config';

test('local alternate host redirects to APP_URL before a customer starts booking', async () => {
  const previous = process.env.APP_URL;
  try {
    for (const appUrl of ['http://localhost:3000', 'http://127.0.0.1:3100']) {
      process.env.APP_URL = appUrl;
      const canonical = new URL(appUrl);
      expect(await config.redirects?.()).toContainEqual({
        source: '/:path*',
        has: [
          { type: 'host', value: canonical.hostname === 'localhost' ? '127.0.0.1' : 'localhost' },
        ],
        destination: `${canonical.origin}/:path*`,
        permanent: false,
      });
    }
    process.env.APP_URL = 'https://booking.example.com';
    expect(await config.redirects?.()).toEqual([]);
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
});
