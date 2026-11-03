import { beforeAll, beforeEach, afterAll, describe, expect, test } from 'bun:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { bookings, services, staffServices, connectDatabase } from '@barber/db';
import { testDatabase, resetBusiness } from '../helpers';
import { createAuth } from '../../apps/api/src/auth';
import { createApp } from '../../apps/api/src/app';
import {
  catalog,
  createBooking,
  byToken,
  availability,
  reschedule,
  cancel,
  saveSettings,
  addTimeOff,
  saveStaff,
  updateStatus,
  type BookingView,
} from '../../apps/api/src/bookings';
import { atMinute } from '../../apps/api/src/scheduling';
const { db, pool } = testDatabase();
const secret = randomBytes(48).toString('base64url');
const appUrl = 'http://localhost:3000';
let clock = new Date('2030-01-07T01:00:00Z');
const auth = createAuth(db, { secret, appUrl });
const app = createApp({ db, auth, secret, appUrl, now: () => clock });
let data: Awaited<ReturnType<typeof catalog>>;
let cookie = '';
const json = <T>(response: Response) => response.json() as Promise<T>;
function call(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(appUrl + '/api' + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
function input(start = '2030-01-08T10:00:00+07:00', staffId?: string) {
  return {
    staffId: staffId ?? data.staff.find((s) => s.name === 'ช่างต้น')!.id,
    serviceIds: [data.services.find((s) => s.name === 'ตัดผม')!.id],
    startAt: start,
    customerName: 'ลูกค้าทดสอบ',
    phone: '0812345678',
  };
}
const create = (start?: string, staffId?: string) =>
  createBooking(db, input(start, staffId), randomUUID(), 'online', secret, clock);
beforeAll(async () => {
  await db.execute(sql`TRUNCATE "user" CASCADE`);
  const bootstrap = createAuth(db, { secret, appUrl, allowSignup: true });
  const password = randomBytes(18).toString('base64url');
  await bootstrap.api.signUpEmail({
    body: { name: 'Test Owner', email: 'test@example.com', password },
  });
  const response = await call(
    '/auth/sign-in/email',
    'POST',
    { email: 'test@example.com', password },
    { origin: appUrl },
  );
  expect(response.status).toBe(200);
  cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  expect(cookie.length).toBeGreaterThan(0);
});
beforeEach(async () => {
  clock = new Date('2030-01-07T01:00:00Z');
  await resetBusiness(db);
  data = await catalog(db);
});
afterAll(async () => {
  await pool.end();
});
describe('booking API with real PostgreSQL', () => {
  test('requires renewed confirmation when a displayed quote is stale', async () => {
    const response = await call(
      '/bookings',
      'POST',
      { ...input(), expectedPrice: 1, expectedDuration: 30 },
      { 'idempotency-key': randomUUID() },
    );
    expect(response.status).toBe(409);
    expect(await db.select().from(bookings)).toHaveLength(0);
  });
  test('a holiday racing with a booking cannot invalidate an accepted appointment', async () => {
    const results = await Promise.allSettled([
      create(),
      addTimeOff(
        db,
        {
          staffId: input().staffId,
          startAt: input().startAt,
          endAt: '2030-01-08T10:30:00+07:00',
          reason: 'ปิดรับ',
        },
        clock,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  test('sums multiple services, checks all staff skills, never exposes internal tokens', async () => {
    const body = {
      ...input(),
      serviceIds: data.services.filter((s) => ['ตัดผม', 'สระผม'].includes(s.name)).map((s) => s.id),
    };
    const response = await call(
      '/bookings',
      'POST',
      { ...body, totalPrice: 1 },
      { 'idempotency-key': randomUUID() },
    );
    expect(response.status).toBe(200);
    const result = await json<{ booking: BookingView; token: string }>(response);
    expect(result.booking.totalPrice).toBe(35000);
    expect(result.booking.totalDuration).toBe(45);
    expect(result.token).toHaveLength(43);
    expect(result.booking).not.toHaveProperty('tokenHash');
    expect(result.booking).not.toHaveProperty('idempotencyKey');
    await db.delete(staffServices).where(eq(staffServices.serviceId, body.serviceIds[0]));
    await expect(availability(db, { ...body, date: '2030-01-09' }, clock)).rejects.toThrow('ครบ');
  });
  test('availability subtracts breaks, time off and bookings; includes exact closing boundary', async () => {
    const b = input();
    await addTimeOff(
      db,
      {
        staffId: b.staffId,
        startAt: '2030-01-08T14:00:00+07:00',
        endAt: '2030-01-08T15:00:00+07:00',
        reason: 'พักพิเศษ',
      },
      clock,
    );
    await create();
    const result = await availability(db, { ...b, date: '2030-01-08' }, clock);
    expect(result.slots).toContain(atMinute('2030-01-08', 1110).toISOString());
    for (const minute of [600, 615, 705, 720, 765, 825, 840, 870])
      expect(result.slots).not.toContain(atMinute('2030-01-08', minute).toISOString());
    expect(result.slots).toContain(atMinute('2030-01-08', 630).toISOString());
  });
  test('rejects past, beyond-horizon, off-grid and malformed requests', async () => {
    for (const startAt of [
      '2030-01-07T07:00:00+07:00',
      '2030-03-01T10:00:00+07:00',
      '2030-01-08T10:01:00+07:00',
    ]) {
      const r = await call(
        '/bookings',
        'POST',
        { ...input(), startAt },
        { 'idempotency-key': randomUUID() },
      );
      expect(r.status).toBe(400);
    }
    const r = await call(
      '/availability?' +
        new URLSearchParams({
          staffId: input().staffId,
          serviceIds: 'invalid',
          date: '2030-01-08',
        }),
    );
    expect(r.status).toBe(400);
  });
  test('only one simultaneous overlapping request succeeds', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        call('/bookings', 'POST', input(), { 'idempotency-key': randomUUID() }),
      ),
    );
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(7);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });
  test('concurrent replays return the same booking and private link', async () => {
    const key = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        call('/bookings', 'POST', input(), { 'idempotency-key': key }),
      ),
    );
    const bodies = await Promise.all(
      responses.map((r) => json<{ booking: BookingView; token: string }>(r)),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(new Set(bodies.map((b) => b.booking.id)).size).toBe(1);
    expect(new Set(bodies.map((b) => b.token)).size).toBe(1);
    const mismatch = await call(
      '/bookings',
      'POST',
      { ...input(), customerName: 'อีกคน' },
      { 'idempotency-key': key },
    );
    expect(mismatch.status).toBe(409);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });
  test('the database constraint also rejects overlaps outside the application service', async () => {
    const created = await create();
    const original = await byToken(db, created.token);
    let code = '';
    try {
      await db.insert(bookings).values({
        ...original,
        id: randomUUID(),
        reference: randomUUID(),
        tokenHash: randomUUID(),
        idempotencyKey: randomUUID(),
      });
    } catch (error) {
      code = (error as { cause?: { code?: string } }).cause?.code ?? '';
    }
    expect(code).toBe('23P01');
  });
  test('failed reschedule keeps the original; adjacent appointments are allowed', async () => {
    const a = await create();
    await create('2030-01-08T11:00:00+07:00');
    await expect(
      reschedule(db, { token: a.token }, '2030-01-08T11:00:00+07:00', clock),
    ).rejects.toThrow('จอง');
    expect((await byToken(db, a.token)).startAt.toISOString()).toBe(
      new Date(input().startAt).toISOString(),
    );
    const moved = await reschedule(db, { token: a.token }, '2030-01-08T10:30:00+07:00', clock);
    expect(moved.endAt).toBe(new Date('2030-01-08T11:00:00+07:00').toISOString());
  });
  test('cancelling releases the slot and is safely repeatable', async () => {
    const b = await create();
    await cancel(db, b.token, clock);
    await cancel(db, b.token, clock);
    const next = await create();
    expect(next.booking.id).not.toBe(b.booking.id);
    const original = await byToken(db, b.token);
    expect(original.status).toBe('cancelled');
  });
  test('customer cutoff is enforced at exactly two hours; admin can override', async () => {
    const b = await create('2030-01-07T10:00:00+07:00');
    const view = await call('/manage', 'GET', undefined, { authorization: `Bearer ${b.token}` });
    expect((await json<{ canChange: boolean }>(view)).canChange).toBe(true);
    clock = new Date(+clock + 1);
    const denied = await call('/manage/cancel', 'POST', undefined, {
      authorization: `Bearer ${b.token}`,
    });
    expect(denied.status).toBe(403);
    const admin = await call(
      `/admin/bookings/${b.booking.id}/status`,
      'PATCH',
      { status: 'cancelled' },
      { cookie, origin: appUrl },
    );
    expect(admin.status).toBe(200);
  });
  test('tokens cannot select another booking or access admin data', async () => {
    const a = await create();
    const b = await create('2030-01-08T11:00:00+07:00');
    const response = await call('/manage?id=' + b.booking.id, 'GET', undefined, {
      authorization: `Bearer ${a.token}`,
    });
    expect((await json<{ booking: BookingView }>(response)).booking.id).toBe(a.booking.id);
    expect(
      (await call('/manage', 'GET', undefined, { authorization: 'Bearer ' + 'x'.repeat(43) }))
        .status,
    ).toBe(404);
    expect((await call('/admin/catalog')).status).toBe(401);
    expect(
      (await call(`/admin/bookings/${b.booking.id}/status`, 'PATCH', { status: 'cancelled' }))
        .status,
    ).toBe(401);
    const signup = await call(
      '/auth/sign-up/email',
      'POST',
      {
        name: 'Intruder',
        email: 'intruder@example.com',
        password: randomBytes(18).toString('hex'),
      },
      { origin: appUrl },
    );
    expect(signup.status).not.toBe(200);
  });
  test('existing snapshots survive service price, duration and activity changes', async () => {
    const b = await create();
    await db
      .update(services)
      .set({ name: 'เปลี่ยนชื่อ', price: 99900, duration: 90, active: false })
      .where(eq(services.id, input().serviceIds[0]));
    const stored = await byToken(db, b.token);
    expect(stored.totalPrice).toBe(25000);
    expect(stored.totalDuration).toBe(30);
    expect(stored.items[0].name).toBe('ตัดผม');
    const moved = await reschedule(db, { token: b.token }, '2030-01-09T10:00:00+07:00', clock);
    expect(moved.totalDuration).toBe(30);
  });
  test('conflicting holidays, staff and shop hours roll back with booking references', async () => {
    const b = await create();
    await expect(
      addTimeOff(
        db,
        { staffId: null, startAt: b.booking.startAt, endAt: b.booking.endAt, reason: 'ปิดร้าน' },
        clock,
      ),
    ).rejects.toThrow('นัดเดิม');
    const settings = data.shop;
    await expect(saveSettings(db, { ...settings, hours: [] }, clock)).rejects.toThrow('นัดเดิม');
    const barber = data.staff.find((s) => s.id === b.booking.staffId)!;
    await expect(saveStaff(db, { ...barber, hours: [] }, clock, barber.id)).rejects.toThrow(
      'นัดเดิม',
    );
    const current = await catalog(db, true);
    expect(current.timeOff).toHaveLength(0);
    expect(current.shop.hours.length).toBe(7);
  });
  test('status transitions and offline bookings share the online calendar', async () => {
    const response = await call('/admin/bookings', 'POST', input('2030-01-07T09:00:00+07:00'), {
      cookie,
      origin: appUrl,
      'idempotency-key': randomUUID(),
    });
    expect(response.status).toBe(200);
    const b = await json<{ booking: BookingView }>(response);
    expect(b.booking.source).toBe('admin');
    const conflict = await call('/bookings', 'POST', input('2030-01-07T09:00:00+07:00'), {
      'idempotency-key': randomUUID(),
    });
    expect(conflict.status).toBe(409);
    await expect(updateStatus(db, b.booking.id, 'in_service', clock)).rejects.toThrow('ยังไม่ถึง');
    clock = new Date('2030-01-07T02:00:00Z');
    expect((await updateStatus(db, b.booking.id, 'in_service', clock)).status).toBe('in_service');
    expect((await updateStatus(db, b.booking.id, 'completed', clock)).status).toBe('completed');
    await expect(updateStatus(db, b.booking.id, 'confirmed', clock)).rejects.toThrow('ลำดับ');
  });
  test('persisted appointments are readable through a new database connection', async () => {
    const b = await create();
    const second = connectDatabase(process.env.TEST_DATABASE_URL!);
    try {
      expect((await byToken(second.db, b.token)).id).toBe(b.booking.id);
    } finally {
      await second.pool.end();
    }
  });
  test('rejects mutations from another origin', async () => {
    const response = await call('/bookings', 'POST', input(), {
      origin: 'https://another.example',
      'idempotency-key': randomUUID(),
    });
    expect(response.status).toBe(403);
    expect(await db.select().from(bookings)).toHaveLength(0);
  });
});
