import { connectDatabase, user } from '@barber/db';
import { createAuth } from '../apps/api/src/auth';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
const secret = process.env.BETTER_AUTH_SECRET;
const url = process.env.DATABASE_URL;
if (!secret || !url) throw new Error('Missing .env configuration');
const { db, pool } = connectDatabase(url);
const email = process.env.ADMIN_EMAIL ?? 'owner@example.com';
try {
  const [exists] = await db.select().from(user).where(eq(user.email, email));
  if (exists) {
    console.log('Admin already exists. Existing password preserved.');
  } else {
    const password = randomBytes(18).toString('base64url');
    const auth = createAuth(db, {
      secret,
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
      allowSignup: true,
    });
    await auth.api.signUpEmail({
      body: { name: process.env.ADMIN_NAME ?? 'เจ้าของร้าน', email, password },
    });
    await Bun.write(
      resolve(import.meta.dir, '../.local/admin-credentials.txt'),
      `Local development admin\nEmail: ${email}\nPassword: ${password}\nURL: http://localhost:3000/admin\n\nKeep this file private. It is ignored by Git.\n`,
    );
    console.log('Created admin. Credentials saved privately in .local/admin-credentials.txt.');
  }
} finally {
  await pool.end();
}
