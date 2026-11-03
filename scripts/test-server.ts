import { testDatabase, resetBusiness } from '../tests/helpers';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createAuth } from '../apps/api/src/auth';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
const { db, pool } = testDatabase();
const secret = randomBytes(48).toString('base64url');
const appUrl = 'http://localhost:3100';
try {
  await migrate(db, { migrationsFolder: resolve(root, 'packages/db/migrations') });
  await resetBusiness(db);
  await db.execute(sql`TRUNCATE "user" CASCADE`);
  const credentials = { email: 'e2e@example.com', password: randomBytes(18).toString('base64url') };
  const auth = createAuth(db, { secret, appUrl, allowSignup: true });
  await auth.api.signUpEmail({ body: { name: 'เจ้าของร้านทดสอบ', ...credentials } });
  await Bun.write(resolve(root, '.local/e2e-admin.json'), JSON.stringify(credentials));
} finally {
  await pool.end();
}
const env = {
  ...process.env,
  DATABASE_URL: process.env.TEST_DATABASE_URL!,
  BETTER_AUTH_SECRET: secret,
  APP_URL: appUrl,
  API_PORT: '3101',
  API_ORIGIN: 'http://127.0.0.1:3101',
  NEXT_DIST_DIR: '.next-e2e',
};
const api = Bun.spawn(['bun', 'apps/api/src/index.ts'], {
  cwd: root,
  env,
  stdout: 'inherit',
  stderr: 'inherit',
});
const web = Bun.spawn(['bun', 'run', '--cwd', 'apps/web', 'dev', '--port', '3100'], {
  cwd: root,
  env,
  stdout: 'inherit',
  stderr: 'inherit',
});
function stop() {
  api.kill();
  web.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const code = await Promise.race([api.exited, web.exited]);
stop();
process.exit(code);
