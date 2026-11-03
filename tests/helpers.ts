import { connectDatabase } from '@barber/db';
import { sql } from 'drizzle-orm';
import { seed } from '../scripts/seed';
export function testDatabase() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || url === process.env.DATABASE_URL || new URL(url).pathname !== '/booking_barber_test')
    throw new Error(
      'Tests require a separate database named booking_barber_test. Refusing to touch another database.',
    );
  return connectDatabase(url);
}
export async function resetBusiness(db: ReturnType<typeof connectDatabase>['db']) {
  await db.execute(sql`TRUNCATE bookings, time_off, staff_services, staff, services, shop CASCADE`);
  await seed(db);
}
