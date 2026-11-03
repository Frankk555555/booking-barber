import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
export function connectDatabase(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  pool.on('error', () =>
    console.error('PostgreSQL connection interrupted; new requests will reconnect.'),
  );
  return { db: drizzle(pool, { schema }), pool };
}
export type Database = ReturnType<typeof connectDatabase>['db'];
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Store = Database | Transaction;
export * from './schema';
