'use client';
import { treaty } from '@elysiajs/eden';
import type { App } from '@barber/api';
import type { catalog, BookingView } from '../../../api/src/bookings';
import { createAuthClient } from 'better-auth/react';
export type Catalog = Awaited<ReturnType<typeof catalog>>;
export type { BookingView };
export const api = treaty<App>(
  typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin,
  { parseDate: false },
);
export const authClient = createAuthClient({ basePath: '/api/auth' });
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function unwrap<T>(
  promise: PromiseLike<{ data: T | null; error: null | { status: unknown; value: unknown } }>,
): Promise<T> {
  const result = await promise;
  if (result.error) {
    const value = result.error.value as { message?: string; details?: unknown };
    throw new ApiError(
      value?.message ?? 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่',
      typeof result.error.status === 'number' ? result.error.status : 500,
      value?.details,
    );
  }
  if (result.data === null) throw new ApiError('ไม่ได้รับข้อมูลจากระบบ', 500);
  return result.data;
}
export const money = (satang: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(satang / 100);
export const time = (value: string) =>
  new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
export const dateLabel = (value: string, short = false) =>
  new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: short ? 'short' : 'long',
    day: 'numeric',
    month: short ? 'short' : 'long',
  }).format(new Date(value.length === 10 ? value + 'T12:00:00+07:00' : value));
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function addDays(date: string, days: number) {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export const labels = {
  confirmed: 'ยืนยันแล้ว',
  in_service: 'กำลังให้บริการ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิกแล้ว',
  no_show: 'ไม่มาตามนัด',
};
export function manageLink(token: string) {
  return `${window.location.origin}/booking/manage#${token}`;
}
export async function requestKey(payload: unknown) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const digest = Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
  const storageKey = 'booking-request:' + digest;
  const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
  sessionStorage.setItem(storageKey, key);
  return key;
}
