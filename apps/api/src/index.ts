import { connectDatabase } from '@barber/db';
import { createAuth } from './auth';
import { createApp } from './app';
const url = process.env.DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;
const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
if (!url || !secret || secret.length < 32 || secret.startsWith('REPLACE_'))
  throw new Error('กรุณาตั้ง DATABASE_URL และ BETTER_AUTH_SECRET ใน .env');
const { db, pool } = connectDatabase(url);
const auth = createAuth(db, { secret, appUrl });
const app = createApp({ db, auth, secret, appUrl }).listen({
  hostname: '127.0.0.1',
  port: Number(process.env.API_PORT ?? 3001),
});
console.log(`Booking API: http://localhost:${app.server?.port}`);
async function stop() {
  await app.stop();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
