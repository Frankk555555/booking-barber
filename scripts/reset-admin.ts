import { connectDatabase, user, account, session } from '@barber/db';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, DATABASE_URL: url } = process.env;
if (!email || !password || password.length < 12 || !url)
  throw new Error('Set ADMIN_EMAIL, ADMIN_PASSWORD (12+ characters) and DATABASE_URL.');
const { db, pool } = connectDatabase(url);
try {
  await db.transaction(async (tx) => {
    const [owner] = await tx.select().from(user).where(eq(user.email, email));
    if (!owner) throw new Error('Admin not found');
    const updated = await tx
      .update(account)
      .set({ password: await hashPassword(password), updatedAt: new Date() })
      .where(and(eq(account.userId, owner.id), eq(account.providerId, 'credential')))
      .returning();
    if (!updated.length) throw new Error('Password account not found');
    await tx.delete(session).where(eq(session.userId, owner.id));
  });
  console.log('Password changed and old sessions revoked. Clear ADMIN_PASSWORD after use.');
} finally {
  await pool.end();
}
