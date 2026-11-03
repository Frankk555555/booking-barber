import { Elysia, t, status as httpStatus } from 'elysia';
import { sql } from 'drizzle-orm';
import type { Database } from '@barber/db';
import type { Auth } from './auth';
import { DomainError, insist } from './errors';
import * as booking from './bookings';
const uuid = t.String({ format: 'uuid' });
const iso = t.String({ format: 'date-time' });
const interval = {
  start: t.Integer({ minimum: 0, maximum: 1439 }),
  end: t.Integer({ minimum: 1, maximum: 1440 }),
};
const hours = t.Array(
  t.Object({
    day: t.Integer({ minimum: 0, maximum: 6 }),
    ...interval,
    breaks: t.Array(t.Object(interval), { maxItems: 8 }),
  }),
  { maxItems: 7 },
);
const newBooking = t.Object({
  expectedPrice: t.Optional(t.Integer({ minimum: 0, maximum: 1000000000 })),
  expectedDuration: t.Optional(t.Integer({ minimum: 1, maximum: 7200 })),
  staffId: uuid,
  serviceIds: t.Array(uuid, { minItems: 1, maxItems: 10 }),
  startAt: iso,
  customerName: t.String({ minLength: 2, maxLength: 100 }),
  phone: t.String({ minLength: 9, maxLength: 25 }),
});
const serviceInput = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.String({ maxLength: 500 }),
  price: t.Integer({ minimum: 0, maximum: 100000000 }),
  duration: t.Integer({ minimum: 1, maximum: 720 }),
  active: t.Boolean(),
});
const staffInput = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  bio: t.String({ maxLength: 500 }),
  active: t.Boolean(),
  hours,
  serviceIds: t.Array(uuid, { maxItems: 100 }),
});
const settingsInput = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  phone: t.String({ minLength: 9, maxLength: 25 }),
  address: t.String({ maxLength: 500 }),
  hours,
  slotMinutes: t.Integer({ minimum: 5, maximum: 60 }),
  horizonDays: t.Integer({ minimum: 1, maximum: 180 }),
  cutoffHours: t.Integer({ minimum: 0, maximum: 168 }),
});
function token(request: Request) {
  const h = request.headers.get('authorization');
  insist(h && h.startsWith('Bearer '), 'กรุณาใช้ลิงก์ส่วนตัวของนัด', 401);
  return h.slice(7);
}
function idempotency(request: Request) {
  const key = request.headers.get('idempotency-key');
  insist(key, 'ไม่พบรหัสคำขอ');
  return key;
}
export function createApp(options: {
  db: Database;
  auth: Auth;
  secret: string;
  appUrl: string;
  now?: () => Date;
}) {
  const { db, auth, secret, appUrl } = options;
  const now = options.now ?? (() => new Date());
  const limits = new Map<string, { count: number; expires: number }>();
  return new Elysia({ prefix: '/api', serve: { maxRequestBodySize: 65536 } })
    .onError(({ error, code }) => {
      if (error instanceof DomainError)
        return httpStatus(error.status, { message: error.message, details: error.details });
      if (code === 'VALIDATION' || code === 'PARSE')
        return httpStatus(400, { message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
      if (code === 'NOT_FOUND') return httpStatus(404, { message: 'ไม่พบรายการ' });
      const cause = 'cause' in error ? (error.cause as { code?: string }) : undefined;
      if (cause?.code === '23P01' || cause?.code === '23505')
        return httpStatus(409, { message: 'ข้อมูลชนกับรายการที่มีอยู่ กรุณาโหลดใหม่' });
      if (cause?.code === '23503') return httpStatus(400, { message: 'ไม่พบข้อมูลที่อ้างอิง' });
      console.error('API failure:', code, cause?.code ?? 'unknown');
      return httpStatus(500, { message: 'ระบบขัดข้อง กรุณาลองใหม่หรือติดต่อร้าน' });
    })
    .onBeforeHandle(({ request, path, server, set }) => {
      set.headers['cache-control'] = 'no-store';
      set.headers['referrer-policy'] = 'no-referrer';
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        const origin = request.headers.get('origin');
        insist(!origin || origin === appUrl, 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น', 403);
      }
      if (path.startsWith('/api/auth') || path.startsWith('/api/admin') || path === '/api/health')
        return;
      const key = server?.requestIP(request)?.address ?? 'local';
      const timestamp = Date.now();
      let bucket = limits.get(key);
      if (!bucket || bucket.expires <= timestamp) {
        if (limits.size > 10000) {
          for (const [k, v] of limits) if (v.expires <= timestamp) limits.delete(k);
          insist(limits.size <= 10000, 'มีผู้ใช้งานมาก กรุณารอสักครู่', 429);
        }
        bucket = { count: 0, expires: timestamp + 60000 };
        limits.set(key, bucket);
      }
      bucket.count++;
      if (bucket.count > 180) {
        set.headers['retry-after'] = '60';
        throw new DomainError(429, 'ทำรายการถี่เกินไป กรุณารอสักครู่');
      }
    })
    .all('/auth/*', ({ request }) => auth.handler(request))
    .get('/health', async () => {
      await db.execute(sql`select 1`);
      return { ok: true };
    })
    .get('/catalog', () => booking.catalog(db))
    .get(
      '/availability',
      ({ query }) =>
        booking.availability(db, { ...query, serviceIds: query.serviceIds.split(',') }, now()),
      {
        query: t.Object({
          staffId: uuid,
          serviceIds: t.String({ minLength: 1, maxLength: 400 }),
          date: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
        }),
      },
    )
    .post(
      '/bookings',
      ({ body, request }) =>
        booking.createBooking(db, body, idempotency(request), 'online', secret, now()),
      { body: newBooking },
    )
    .get('/manage', ({ request }) => booking.manageView(db, token(request), now()))
    .get(
      '/manage/availability',
      async ({ request, query }) => {
        const b = await booking.byToken(db, token(request));
        const view = await booking.manageView(db, token(request), now());
        insist(view.canChange, 'นัดนี้ไม่สามารถเลื่อนผ่านเว็บไซต์ได้ กรุณาติดต่อร้าน', 403);
        return booking.availability(
          db,
          { staffId: b.staffId, serviceIds: [], date: query.date },
          now(),
          b,
        );
      },
      { query: t.Object({ date: t.String() }) },
    )
    .post(
      '/manage/reschedule',
      ({ body, request }) => booking.reschedule(db, { token: token(request) }, body.startAt, now()),
      { body: t.Object({ startAt: iso }) },
    )
    .post('/manage/cancel', ({ request }) => booking.cancel(db, token(request), now()))
    .group('/admin', (app) =>
      app
        .resolve(async ({ request }) => {
          const session = await auth.api.getSession({ headers: request.headers });
          insist(session?.user, 'กรุณาเข้าสู่ระบบ', 401);
          return { admin: session.user };
        })
        .get('/catalog', () => booking.catalog(db, true))
        .get('/bookings', ({ query }) => booking.listBookings(db, query.from, query.to), {
          query: t.Object({ from: t.String(), to: t.String() }),
        })
        .post(
          '/bookings',
          ({ body, request }) =>
            booking.createBooking(db, body, idempotency(request), 'admin', secret, now()),
          { body: newBooking },
        )
        .get(
          '/bookings/:id/availability',
          async ({ params, query }) => {
            const b = await booking.byId(db, params.id);
            insist(b.status === 'confirmed', 'นัดนี้เลื่อนไม่ได้แล้ว', 409);
            return booking.availability(
              db,
              { staffId: b.staffId, serviceIds: [], date: query.date },
              now(),
              b,
            );
          },
          { params: t.Object({ id: uuid }), query: t.Object({ date: t.String() }) },
        )
        .post(
          '/bookings/:id/reschedule',
          ({ params, body }) => booking.reschedule(db, { id: params.id }, body.startAt, now()),
          { params: t.Object({ id: uuid }), body: t.Object({ startAt: iso }) },
        )
        .patch(
          '/bookings/:id/status',
          ({ params, body }) => booking.updateStatus(db, params.id, body.status, now()),
          {
            params: t.Object({ id: uuid }),
            body: t.Object({
              status: t.Union([
                t.Literal('confirmed'),
                t.Literal('in_service'),
                t.Literal('completed'),
                t.Literal('cancelled'),
                t.Literal('no_show'),
              ]),
            }),
          },
        )
        .post(
          '/bookings/:id/link',
          async ({ params }) => {
            const b = await booking.byId(db, params.id);
            const token = booking.privateToken(b.id, secret);
            insist(
              booking.hash(token) === b.tokenHash,
              'ลิงก์เดิมใช้กุญแจเก่า กรุณาตรวจสอบการตั้งค่าระบบ',
              409,
            );
            return { token };
          },
          { params: t.Object({ id: uuid }) },
        )
        .put('/settings', ({ body }) => booking.saveSettings(db, body, now()), {
          body: settingsInput,
        })
        .post('/services', ({ body }) => booking.saveService(db, body), { body: serviceInput })
        .put('/services/:id', ({ params, body }) => booking.saveService(db, body, params.id), {
          params: t.Object({ id: uuid }),
          body: serviceInput,
        })
        .post('/staff', ({ body }) => booking.saveStaff(db, body, now()), { body: staffInput })
        .put('/staff/:id', ({ params, body }) => booking.saveStaff(db, body, now(), params.id), {
          params: t.Object({ id: uuid }),
          body: staffInput,
        })
        .post('/time-off', ({ body }) => booking.addTimeOff(db, body, now()), {
          body: t.Object({
            staffId: t.Union([uuid, t.Null()]),
            startAt: iso,
            endAt: iso,
            reason: t.String({ minLength: 1, maxLength: 200 }),
          }),
        })
        .delete('/time-off/:id', ({ params }) => booking.removeTimeOff(db, params.id), {
          params: t.Object({ id: uuid }),
        }),
    );
}
export type App = ReturnType<typeof createApp>;
