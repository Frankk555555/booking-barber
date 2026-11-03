import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '@barber/db';
import { user, session, account, verification } from '@barber/db';
export function createAuth(
  db: Database,
  options: { secret: string; appUrl: string; allowSignup?: boolean },
) {
  return betterAuth({
    appName: 'Booking Barber',
    baseURL: options.appUrl,
    basePath: '/api/auth',
    secret: options.secret,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true, disableSignUp: !options.allowSignup, minPasswordLength: 12 },
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60, cookieCache: { enabled: false } },
    trustedOrigins: [options.appUrl],
    advanced: { useSecureCookies: options.appUrl.startsWith('https:') },
    rateLimit: { enabled: true, window: 60, max: 30 },
  });
}
export type Auth = ReturnType<typeof createAuth>;
