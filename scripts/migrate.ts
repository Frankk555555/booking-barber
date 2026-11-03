import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { connectDatabase } from '@barber/db';
import { resolve } from 'node:path';
const url = process.argv.includes('--test')
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;
if (!url) throw new Error('Missing database connection URL');
const { db, pool } = connectDatabase(url);
try {
  await migrate(db, { migrationsFolder: resolve(import.meta.dir, '../packages/db/migrations') });
  console.log('Migrations applied.');
} finally {
  await pool.end();
}
