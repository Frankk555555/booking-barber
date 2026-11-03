import { connectDatabase } from '@barber/db';
import { createAuth } from '../apps/api/src/auth';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const secret = process.env.BETTER_AUTH_SECRET;
if (
  !email ||
  !password ||
  password.length < 12 ||
  !secret ||
  secret.length < 32 ||
  !process.env.DATABASE_URL
)
  throw new Error(
    'Set ADMIN_EMAIL, ADMIN_PASSWORD (12+ characters), DATABASE_URL and BETTER_AUTH_SECRET. Never commit credentials.',
  );
const { db, pool } = connectDatabase(process.env.DATABASE_URL);
try {
  const auth = createAuth(db, {
    secret,
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    allowSignup: true,
  });
  await auth.api.signUpEmail({
    body: { email, password, name: process.env.ADMIN_NAME ?? 'เจ้าของร้าน' },
  });
  console.log('Admin created. Public sign-up remains disabled. Clear ADMIN_PASSWORD after use.');
} finally {
  await pool.end();
}
