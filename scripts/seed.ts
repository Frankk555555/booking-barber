import { connectDatabase, shop, services, staff, staffServices } from '@barber/db';
import { sql } from 'drizzle-orm';
import { defaultHours } from '../apps/api/src/scheduling';
export async function seed(db: ReturnType<typeof connectDatabase>['db']) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7320261103)`);
    await tx
      .insert(shop)
      .values({
        id: 1,
        name: 'ละมุน บาร์เบอร์',
        phone: '021234567',
        address: 'กรุงเทพมหานคร · กรุณานัดหมายก่อนเข้ารับบริการ',
        hours: defaultHours(),
      })
      .onConflictDoNothing();
    const existing = await tx.select().from(services);
    if (existing.length) return;
    const list = await tx
      .insert(services)
      .values([
        {
          name: 'ตัดผม',
          description: 'ออกแบบทรงที่ใช่ เก็บรายละเอียดให้เข้ากับคุณ',
          price: 25000,
          duration: 30,
        },
        {
          name: 'สระผม',
          description: 'สระสะอาด ผ่อนคลาย พร้อมจัดแต่งทรง',
          price: 10000,
          duration: 15,
        },
        {
          name: 'โกนหนวด',
          description: 'เก็บแนวหนวดเครา เรียบร้อยอย่างเป็นธรรมชาติ',
          price: 15000,
          duration: 15,
        },
      ])
      .returning();
    const barbers = await tx
      .insert(staff)
      .values([
        {
          name: 'ช่างต้น',
          bio: 'ถนัดทรงคลาสสิกและเฟด ใส่ใจทุกรายละเอียด',
          hours: defaultHours().map((h) => ({ ...h, breaks: [{ start: 720, end: 780 }] })),
        },
        {
          name: 'ช่างเมฆ',
          bio: 'ทรงร่วมสมัย ดูแลง่าย พร้อมแนะนำทรงที่เหมาะกับคุณ',
          hours: defaultHours().map((h) => ({ ...h, breaks: [{ start: 780, end: 840 }] })),
        },
      ])
      .returning();
    await tx
      .insert(staffServices)
      .values(barbers.flatMap((b) => list.map((s) => ({ staffId: b.id, serviceId: s.id }))));
  });
}
if (import.meta.main) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing DATABASE_URL');
  const { db, pool } = connectDatabase(url);
  try {
    await seed(db);
    console.log('Seed complete; existing shop data preserved.');
  } finally {
    await pool.end();
  }
}
