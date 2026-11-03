import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  jsonb,
  primaryKey,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export type Interval = { start: number; end: number };
export type DayHours = Interval & { day: number; breaks: Interval[] };
export type BookingItem = { serviceId: string; name: string; price: number; duration: number };
export const statuses = ['confirmed', 'in_service', 'completed', 'cancelled', 'no_show'] as const;
export type BookingStatus = (typeof statuses)[number];
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
});
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: instant('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: instant('access_token_expires_at'),
  refreshTokenExpiresAt: instant('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
});
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: instant('expires_at').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
});
export const shop = pgTable(
  'shop',
  {
    id: integer('id').primaryKey().default(1),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    address: text('address').notNull(),
    hours: jsonb('hours').$type<DayHours[]>().notNull(),
    slotMinutes: integer('slot_minutes').notNull().default(15),
    horizonDays: integer('horizon_days').notNull().default(30),
    cutoffHours: integer('cutoff_hours').notNull().default(2),
  },
  (t) => [
    check('singleton_shop', sql`${t.id} = 1`),
    check(
      'positive_settings',
      sql`${t.slotMinutes} > 0 AND ${t.horizonDays} > 0 AND ${t.cutoffHours} >= 0`,
    ),
  ],
);
export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    price: integer('price').notNull(),
    duration: integer('duration').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [check('valid_service', sql`${t.price} >= 0 AND ${t.duration} > 0`)],
);
export const staff = pgTable('staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  bio: text('bio').notNull().default(''),
  active: boolean('active').notNull().default(true),
  hours: jsonb('hours').$type<DayHours[]>().notNull(),
});
export const staffServices = pgTable(
  'staff_services',
  {
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })],
);
export const timeOff = pgTable(
  'time_off',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id').references(() => staff.id),
    startAt: instant('start_at').notNull(),
    endAt: instant('end_at').notNull(),
    reason: text('reason').notNull().default('วันหยุด'),
  },
  (t) => [check('valid_time_off', sql`${t.endAt} > ${t.startAt}`)],
);
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull().unique(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id),
    staffName: text('staff_name').notNull(),
    customerName: text('customer_name').notNull(),
    phone: text('phone').notNull(),
    startAt: instant('start_at').notNull(),
    endAt: instant('end_at').notNull(),
    items: jsonb('items').$type<BookingItem[]>().notNull(),
    totalPrice: integer('total_price').notNull(),
    totalDuration: integer('total_duration').notNull(),
    status: text('status', { enum: statuses }).notNull().default('confirmed'),
    source: text('source', { enum: ['online', 'admin'] }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    requestHash: text('request_hash').notNull(),
    createdAt: instant('created_at').notNull().defaultNow(),
    updatedAt: instant('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('bookings_start').on(t.startAt),
    index('bookings_staff_start').on(t.staffId, t.startAt),
    check(
      'valid_booking',
      sql`${t.endAt} > ${t.startAt} AND ${t.totalPrice} >= 0 AND ${t.totalDuration} > 0`,
    ),
    check(
      'valid_booking_status',
      sql`${t.status} IN ('confirmed','in_service','completed','cancelled','no_show')`,
    ),
  ],
);
