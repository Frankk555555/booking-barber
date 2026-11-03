import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
const adminFile = Bun.file(resolve(root, '.local/postgres-admin.url'));
const adminUrl =
  process.env.PG_ADMIN_URL ??
  ((await adminFile.exists()) ? (await adminFile.text()).trim() : undefined);
if (!adminUrl)
  throw new Error(
    'Run scripts/setup-postgres.ps1 or set PG_ADMIN_URL (database administrator connection).',
  );
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
try {
  const envFile = Bun.file(resolve(root, '.env'));
  if (await envFile.exists())
    throw new Error('.env already exists. Nothing changed. Use the existing configuration.');
  const password = randomBytes(24).toString('hex');
  const secret = randomBytes(48).toString('base64url');
  const exists = await admin.query("select 1 from pg_roles where rolname = 'booking_barber_app'");
  if (exists.rowCount)
    throw new Error('Role booking_barber_app already exists. Refusing to change its password.');
  for (const database of ['booking_barber', 'booking_barber_test']) {
    const found = await admin.query('select 1 from pg_database where datname = $1', [database]);
    if (found.rowCount) throw new Error(`${database} exists. Refusing to change existing data.`);
  }
  await admin.query(
    `CREATE ROLE booking_barber_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
  );
  const endpoint = new URL(adminUrl);
  endpoint.username = 'booking_barber_app';
  endpoint.password = password;
  for (const database of ['booking_barber', 'booking_barber_test']) {
    await admin.query(`CREATE DATABASE ${database} OWNER booking_barber_app`);
    const connection = new URL(adminUrl);
    connection.pathname = '/' + database;
    const client = new pg.Client({ connectionString: connection.href });
    await client.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    } finally {
      await client.end();
    }
  }
  endpoint.pathname = '/booking_barber';
  const live = endpoint.href;
  endpoint.pathname = '/booking_barber_test';
  await Bun.write(
    resolve(root, '.env'),
    `DATABASE_URL=${live}\nTEST_DATABASE_URL=${endpoint.href}\nBETTER_AUTH_SECRET=${secret}\nAPP_URL=http://localhost:3000\nAPI_PORT=3001\nADMIN_EMAIL=owner@example.com\nADMIN_NAME=เจ้าของร้าน\nADMIN_PASSWORD=\n`,
  );
  console.log(
    'Created isolated app role, development/test databases and .env. No credentials printed.',
  );
} finally {
  await admin.end();
}
