import pg from 'pg';
import { resolve } from 'node:path';
const [fileName, database] = process.argv.slice(2);
if (!fileName || !database || !/^booking_barber_restore_[a-z0-9_]+$/.test(database))
  throw new Error(
    'Usage: bun scripts/restore.ts <backup.dump> booking_barber_restore_<name>. Only a NEW restore database is allowed.',
  );
const backup = resolve(fileName);
if (!(await Bun.file(backup).exists())) throw new Error('Backup file not found');
const adminFile = Bun.file(resolve(import.meta.dir, '../.local/postgres-admin.url'));
const adminUrl =
  process.env.PG_ADMIN_URL ??
  ((await adminFile.exists()) ? (await adminFile.text()).trim() : undefined);
if (!adminUrl || !process.env.DATABASE_URL) throw new Error('Set PG_ADMIN_URL and DATABASE_URL');
const source = new URL(process.env.DATABASE_URL);
const adminEndpoint = new URL(adminUrl);
if (source.hostname !== adminEndpoint.hostname || source.port !== adminEndpoint.port)
  throw new Error('Admin and app connections must refer to the same PostgreSQL server');
const owner = decodeURIComponent(source.username);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner)) throw new Error('Unsupported role name');
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
try {
  const existing = await admin.query('select 1 from pg_database where datname = $1', [database]);
  if (existing.rowCount) throw new Error('Target already exists. Refusing to overwrite it.');
  await admin.query(`CREATE DATABASE "${database}" OWNER "${owner}"`);
} finally {
  await admin.end();
}
const command =
  process.env.PG_RESTORE_PATH ?? 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe';
const child = Bun.spawn(
  [
    command,
    '-h',
    source.hostname,
    '-p',
    source.port || '5432',
    '-U',
    owner,
    '-d',
    database,
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    backup,
  ],
  {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(source.password) },
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
const code = await child.exited;
if (code !== 0)
  throw new Error(
    'Restore failed. The new restore database was left for inspection; original databases were not changed.',
  );
console.log(
  `Restored into ${database}. Original database is unchanged. To use it, change only the database name in DATABASE_URL and restart the app.`,
);
