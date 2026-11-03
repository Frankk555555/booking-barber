import { and, eq, ne, lt, gt, gte, inArray, sql, asc, desc } from 'drizzle-orm';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  bookings,
  shop,
  services,
  staff,
  staffServices,
  timeOff,
  type Store,
  type Database,
  type Transaction,
  type BookingStatus,
  type BookingItem,
} from '@barber/db';
import { DomainError, insist } from './errors';
import {
  atMinute,
  localDate,
  validDate,
  withinHours,
  overlaps,
  inBookingWindow,
  onGrid,
  canCustomerChange,
  validateHours,
} from './scheduling';
export type NewBooking = {
  expectedPrice?: number;
  expectedDuration?: number;
  staffId: string;
  serviceIds: string[];
  startAt: string;
  customerName: string;
  phone: string;
};
type BookingRow = typeof bookings.$inferSelect;
export function bookingView(b: BookingRow) {
  return {
    id: b.id,
    reference: b.reference,
    staffId: b.staffId,
    staffName: b.staffName,
    customerName: b.customerName,
    phone: b.phone,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    items: b.items,
    totalPrice: b.totalPrice,
    totalDuration: b.totalDuration,
    status: b.status,
    source: b.source,
    createdAt: b.createdAt.toISOString(),
  };
}
export type BookingView = ReturnType<typeof bookingView>;
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const privateToken = (id: string, secret: string) =>
  createHmac('sha256', secret)
    .update('barber-manage-v1:' + id)
    .digest('base64url');
export async function locked<T>(db: Database, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7320261103)`);
    return fn(tx);
  });
}
export async function settings(db: Store) {
  const [value] = await db.select().from(shop).where(eq(shop.id, 1));
  insist(value, 'ยังไม่ได้ตั้งค่าร้าน กรุณารัน db:seed', 503);
  return value;
}
export async function catalog(db: Store, admin = false) {
  const s = await settings(db);
  const allServices = await db
    .select()
    .from(services)
    .orderBy(desc(services.duration), asc(services.price));
  const allStaff = await db.select().from(staff).orderBy(asc(staff.name));
  const skills = await db.select().from(staffServices);
  const off = admin ? await db.select().from(timeOff).orderBy(asc(timeOff.startAt)) : [];
  return {
    shop: s,
    services: allServices.filter((x) => admin || x.active),
    staff: allStaff
      .filter((x) => admin || x.active)
      .map((x) => ({
        ...x,
        serviceIds: skills.filter((sk) => sk.staffId === x.id).map((sk) => sk.serviceId),
      })),
    timeOff: off.map((x) => ({
      ...x,
      startAt: x.startAt.toISOString(),
      endAt: x.endAt.toISOString(),
    })),
  };
}
async function quote(db: Store, staffId: string, serviceIds: string[]) {
  insist(
    serviceIds.length > 0 &&
      serviceIds.length <= 10 &&
      new Set(serviceIds).size === serviceIds.length,
    'กรุณาเลือกบริการ 1–10 รายการโดยไม่ซ้ำกัน',
  );
  insist(
    serviceIds.every((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    ),
    'รหัสบริการไม่ถูกต้อง',
  );
  const [barber] = await db.select().from(staff).where(eq(staff.id, staffId));
  insist(barber?.active, 'ไม่พบช่างที่พร้อมรับจอง', 404);
  const selected = await db
    .select()
    .from(services)
    .where(and(inArray(services.id, serviceIds), eq(services.active, true)));
  insist(
    selected.length === serviceIds.length,
    'มีบริการที่ปิดรับจองแล้ว กรุณาเลือกบริการใหม่',
    409,
  );
  const skills = await db.select().from(staffServices).where(eq(staffServices.staffId, staffId));
  insist(
    serviceIds.every((id) => skills.some((s) => s.serviceId === id)),
    'ช่างไม่สามารถให้บริการที่เลือกได้ครบ',
  );
  const items: BookingItem[] = selected.map((s) => ({
    serviceId: s.id,
    name: s.name,
    price: s.price,
    duration: s.duration,
  }));
  return {
    barber,
    items,
    duration: items.reduce((n, i) => n + i.duration, 0),
    price: items.reduce((n, i) => n + i.price, 0),
  };
}
async function blocks(db: Store, staffId: string, start: Date, end: Date, ignoreId?: string) {
  const appointments = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.staffId, staffId),
        ne(bookings.status, 'cancelled'),
        lt(bookings.startAt, end),
        gt(bookings.endAt, start),
      ),
    );
  const off = await db
    .select()
    .from(timeOff)
    .where(and(lt(timeOff.startAt, end), gt(timeOff.endAt, start)));
  return [
    ...appointments.filter((x) => x.id !== ignoreId),
    ...off.filter((x) => x.staffId === null || x.staffId === staffId),
  ];
}
export async function availability(
  db: Store,
  input: { staffId: string; serviceIds: string[]; date: string },
  now: Date,
  existing?: BookingRow,
) {
  insist(validDate(input.date), 'วันที่ไม่ถูกต้อง');
  const s = await settings(db);
  const q = existing
    ? {
        barber: (await db.select().from(staff).where(eq(staff.id, existing.staffId)))[0],
        duration: existing.totalDuration,
        price: existing.totalPrice,
      }
    : await quote(db, input.staffId, input.serviceIds);
  insist(q.barber?.active, 'ช่างคนนี้ปิดรับจองแล้ว', 409);
  const occupied = await blocks(
    db,
    input.staffId,
    atMinute(input.date, 0),
    atMinute(input.date, 1440),
    existing?.id,
  );
  const slots: string[] = [];
  for (let m = 0; m < 1440; m += s.slotMinutes) {
    const startAt = atMinute(input.date, m);
    const endAt = new Date(+startAt + q.duration * 60000);
    if (
      inBookingWindow(startAt, now, s.horizonDays) &&
      withinHours(startAt, endAt, s.hours) &&
      withinHours(startAt, endAt, q.barber.hours) &&
      !occupied.some((b) => overlaps({ startAt, endAt }, b))
    )
      slots.push(startAt.toISOString());
  }
  return { slots, totalDuration: q.duration, totalPrice: q.price };
}
async function assertSlot(
  db: Store,
  staffId: string,
  startAt: Date,
  duration: number,
  now: Date,
  ignoreId?: string,
) {
  const s = await settings(db);
  const [barber] = await db.select().from(staff).where(eq(staff.id, staffId));
  insist(barber?.active, 'ช่างคนนี้ปิดรับจองแล้ว', 409);
  insist(
    inBookingWindow(startAt, now, s.horizonDays),
    'กรุณาเลือกเวลาในอนาคตภายในช่วงที่เปิดรับจอง',
  );
  insist(onGrid(startAt, s.slotMinutes), 'เวลาเริ่มไม่ตรงกับช่วงเวลาที่ร้านกำหนด');
  const endAt = new Date(+startAt + duration * 60000);
  insist(
    withinHours(startAt, endAt, s.hours) && withinHours(startAt, endAt, barber.hours),
    'ช่วงเวลานี้อยู่นอกเวลาทำงานหรือทับเวลาพัก',
    409,
  );
  insist(
    (await blocks(db, staffId, startAt, endAt, ignoreId)).length === 0,
    'เวลานี้เพิ่งถูกจองหรือปิดรับแล้ว กรุณาเลือกเวลาใหม่',
    409,
  );
  return endAt;
}
export async function createBooking(
  db: Database,
  input: NewBooking,
  key: string,
  source: 'online' | 'admin',
  secret: string,
  now: Date,
) {
  const name = input.customerName.trim();
  const phone = input.phone.replace(/[\s-]/g, '');
  insist(name.length >= 2 && name.length <= 100, 'กรุณากรอกชื่อ 2–100 ตัวอักษร');
  insist(/^(0\d{8,9}|\+[1-9]\d{7,14})$/.test(phone), 'เบอร์โทรไม่ถูกต้อง');
  insist(key.length >= 16 && key.length <= 128, 'รหัสคำขอไม่ถูกต้อง');
  const requestHash = hash(
    JSON.stringify({
      ...input,
      customerName: name,
      phone,
      serviceIds: [...input.serviceIds].sort(),
      source,
    }),
  );
  return locked(db, async (tx) => {
    const [old] = await tx.select().from(bookings).where(eq(bookings.idempotencyKey, key));
    if (old) {
      insist(old.requestHash === requestHash, 'รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว', 409);
      const token = privateToken(old.id, secret);
      insist(hash(token) === old.tokenHash, 'กรุณาติดต่อร้านเพื่อขอลิงก์นัด', 409);
      return { booking: bookingView(old), token };
    }
    const q = await quote(tx, input.staffId, input.serviceIds);
    if (
      (input.expectedPrice !== undefined && input.expectedPrice !== q.price) ||
      (input.expectedDuration !== undefined && input.expectedDuration !== q.duration)
    )
      throw new DomainError(
        409,
        'ราคาหรือระยะเวลาบริการเปลี่ยนแล้ว กรุณาตรวจสอบรายการอีกครั้ง',
        'QUOTE_CHANGED',
      );
    const startAt = new Date(input.startAt);
    const endAt = await assertSlot(tx, input.staffId, startAt, q.duration, now);
    const id = randomUUID();
    const token = privateToken(id, secret);
    const [created] = await tx
      .insert(bookings)
      .values({
        id,
        reference: 'BB-' + randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase(),
        staffId: input.staffId,
        staffName: q.barber.name,
        customerName: name,
        phone,
        startAt,
        endAt,
        items: q.items,
        totalPrice: q.price,
        totalDuration: q.duration,
        status: 'confirmed',
        source,
        tokenHash: hash(token),
        idempotencyKey: key,
        requestHash,
      })
      .returning();
    return { booking: bookingView(created), token };
  });
}
export async function byToken(db: Store, token: string) {
  insist(/^[A-Za-z0-9_-]{43}$/.test(token), 'ลิงก์นัดไม่ถูกต้อง', 404);
  const [b] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.tokenHash, hash(token)));
  insist(b, 'ไม่พบนัด กรุณาตรวจสอบลิงก์หรือติดต่อร้าน', 404);
  return b;
}
export async function byId(db: Store, id: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
  insist(b, 'ไม่พบนัด', 404);
  return b;
}
export async function manageView(db: Store, token: string, now: Date) {
  const b = await byToken(db, token);
  const s = await settings(db);
  return {
    booking: bookingView(b),
    canChange: b.status === 'confirmed' && canCustomerChange(b.startAt, now, s.cutoffHours),
    cutoffHours: s.cutoffHours,
  };
}
async function mutable(db: Store, b: BookingRow, admin: boolean, now: Date) {
  insist(b.status === 'confirmed', 'นัดนี้ไม่สามารถแก้ไขได้แล้ว', 409);
  if (!admin) {
    const s = await settings(db);
    insist(
      canCustomerChange(b.startAt, now, s.cutoffHours),
      `ต้องแก้ไขก่อนนัดอย่างน้อย ${s.cutoffHours} ชั่วโมง กรุณาติดต่อร้าน`,
      403,
    );
  }
}
export async function reschedule(
  db: Database,
  identity: { token: string } | { id: string },
  start: string,
  now: Date,
) {
  return locked(db, async (tx) => {
    const admin = 'id' in identity;
    const b = admin ? await byId(tx, identity.id) : await byToken(tx, identity.token);
    await mutable(tx, b, admin, now);
    const startAt = new Date(start);
    const endAt = await assertSlot(tx, b.staffId, startAt, b.totalDuration, now, b.id);
    const [updated] = await tx
      .update(bookings)
      .set({ startAt, endAt, updatedAt: now })
      .where(eq(bookings.id, b.id))
      .returning();
    return bookingView(updated);
  });
}
export async function cancel(db: Database, token: string, now: Date) {
  return locked(db, async (tx) => {
    const b = await byToken(tx, token);
    if (b.status === 'cancelled') return bookingView(b);
    await mutable(tx, b, false, now);
    const [updated] = await tx
      .update(bookings)
      .set({ status: 'cancelled', updatedAt: now })
      .where(eq(bookings.id, b.id))
      .returning();
    return bookingView(updated);
  });
}
export async function updateStatus(db: Database, id: string, status: BookingStatus, now: Date) {
  return locked(db, async (tx) => {
    const b = await byId(tx, id);
    if (b.status === status) return bookingView(b);
    const allowed: Record<BookingStatus, BookingStatus[]> = {
      confirmed: ['in_service', 'cancelled', 'no_show'],
      in_service: ['completed'],
      completed: [],
      cancelled: [],
      no_show: [],
    };
    insist(allowed[b.status].includes(status), 'ไม่สามารถเปลี่ยนสถานะตามลำดับนี้ได้', 409);
    if (status !== 'cancelled') insist(b.startAt <= now, 'ยังไม่ถึงเวลาให้บริการ', 409);
    const [updated] = await tx
      .update(bookings)
      .set({ status, updatedAt: now })
      .where(eq(bookings.id, id))
      .returning();
    return bookingView(updated);
  });
}
export async function listBookings(db: Store, from: string, to: string) {
  insist(
    validDate(from) &&
      validDate(to) &&
      to >= from &&
      +atMinute(to, 0) - +atMinute(from, 0) <= 366 * 86400000,
    'ช่วงวันที่ไม่ถูกต้อง',
  );
  return (
    await db
      .select()
      .from(bookings)
      .where(
        and(gte(bookings.startAt, atMinute(from, 0)), lt(bookings.startAt, atMinute(to, 1440))),
      )
      .orderBy(asc(bookings.startAt))
  ).map(bookingView);
}
export async function assertCalendarPreserved(tx: Transaction, now: Date) {
  const s = await settings(tx);
  const barbers = await tx.select().from(staff);
  const off = await tx.select().from(timeOff);
  const future = await tx
    .select()
    .from(bookings)
    .where(and(gt(bookings.endAt, now), inArray(bookings.status, ['confirmed', 'in_service'])));
  const conflicts = future.filter((b) => {
    const barber = barbers.find((x) => x.id === b.staffId);
    return (
      !barber ||
      !withinHours(b.startAt, b.endAt, s.hours) ||
      !withinHours(b.startAt, b.endAt, barber.hours) ||
      off.some((o) => (o.staffId === null || o.staffId === b.staffId) && overlaps(b, o))
    );
  });
  if (conflicts.length)
    throw new DomainError(
      409,
      'ตารางใหม่ชนกับนัดเดิม กรุณาเลื่อนหรือยกเลิกนัดเหล่านี้ก่อน',
      conflicts.map((b) => ({
        id: b.id,
        reference: b.reference,
        startAt: b.startAt.toISOString(),
      })),
    );
}
export async function saveSettings(
  db: Database,
  value: Omit<typeof shop.$inferInsert, 'id'>,
  now: Date,
) {
  validateHours(value.hours);
  return locked(db, async (tx) => {
    const [saved] = await tx.update(shop).set(value).where(eq(shop.id, 1)).returning();
    await assertCalendarPreserved(tx, now);
    return saved;
  });
}
export async function saveService(
  db: Database,
  value: Omit<typeof services.$inferInsert, 'id'>,
  id?: string,
) {
  return locked(db, async (tx) => {
    if (id) {
      const [s] = await tx.update(services).set(value).where(eq(services.id, id)).returning();
      insist(s, 'ไม่พบบริการ', 404);
      return s;
    }
    return (await tx.insert(services).values(value).returning())[0];
  });
}
export async function saveStaff(
  db: Database,
  value: Omit<typeof staff.$inferInsert, 'id'> & { serviceIds: string[] },
  now: Date,
  id?: string,
) {
  validateHours(value.hours);
  return locked(db, async (tx) => {
    const { serviceIds, ...data } = value;
    insist(new Set(serviceIds).size === serviceIds.length, 'บริการซ้ำกัน');
    if (serviceIds.length) {
      const found = await tx.select().from(services).where(inArray(services.id, serviceIds));
      insist(found.length === serviceIds.length, 'ไม่พบบริการที่เลือก');
    }
    const [saved] = id
      ? await tx.update(staff).set(data).where(eq(staff.id, id)).returning()
      : await tx.insert(staff).values(data).returning();
    insist(saved, 'ไม่พบช่าง', 404);
    await tx.delete(staffServices).where(eq(staffServices.staffId, saved.id));
    if (serviceIds.length)
      await tx
        .insert(staffServices)
        .values(serviceIds.map((serviceId) => ({ staffId: saved.id, serviceId })));
    await assertCalendarPreserved(tx, now);
    return { ...saved, serviceIds };
  });
}
export async function addTimeOff(
  db: Database,
  input: { staffId: string | null; startAt: string; endAt: string; reason: string },
  now: Date,
) {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  insist(
    Number.isFinite(+startAt) && Number.isFinite(+endAt) && endAt > startAt,
    'เวลาวันหยุดไม่ถูกต้อง',
  );
  return locked(db, async (tx) => {
    const [saved] = await tx
      .insert(timeOff)
      .values({ ...input, startAt, endAt })
      .returning();
    await assertCalendarPreserved(tx, now);
    return { ...saved, startAt: saved.startAt.toISOString(), endAt: saved.endAt.toISOString() };
  });
}
export async function removeTimeOff(db: Database, id: string) {
  return locked(db, async (tx) => {
    const found = await tx.delete(timeOff).where(eq(timeOff.id, id)).returning();
    insist(found.length, 'ไม่พบวันหยุด', 404);
    return { ok: true };
  });
}
export { localDate };
