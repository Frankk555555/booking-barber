import type { DayHours, Interval } from '@barber/db';
import { insist } from './errors';
export const ZONE = 'Asia/Bangkok';
export function localDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function validDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date
  );
}
export function atMinute(date: string, minute: number): Date {
  return new Date(new Date(date + 'T00:00:00+07:00').getTime() + minute * 60000);
}
export function minuteOfDay(date: Date): number {
  const shifted = new Date(date.getTime() + 7 * 3600000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}
export function overlaps(
  a: { startAt: Date; endAt: Date },
  b: { startAt: Date; endAt: Date },
): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}
export function validateHours(hours: DayHours[]) {
  insist(new Set(hours.map((h) => h.day)).size === hours.length, 'วันทำงานซ้ำกัน');
  for (const h of hours) {
    insist(
      Number.isInteger(h.day) && h.day >= 0 && h.day <= 6 && validInterval(h),
      'เวลาทำงานไม่ถูกต้อง',
    );
    for (const b of h.breaks)
      insist(
        validInterval(b) && b.start >= h.start && b.end <= h.end,
        'เวลาพักต้องอยู่ภายในเวลาทำงาน',
      );
  }
}
function validInterval(i: Interval) {
  return (
    Number.isInteger(i.start) &&
    Number.isInteger(i.end) &&
    i.start >= 0 &&
    i.start < i.end &&
    i.end <= 1440
  );
}
export function withinHours(startAt: Date, endAt: Date, hours: DayHours[]): boolean {
  const date = localDate(startAt);
  const day = new Date(date + 'T00:00:00Z').getUTCDay();
  const h = hours.find((h) => h.day === day);
  if (!h) return false;
  return (
    startAt >= atMinute(date, h.start) &&
    endAt <= atMinute(date, h.end) &&
    !h.breaks.some((b) =>
      overlaps(
        { startAt, endAt },
        { startAt: atMinute(date, b.start), endAt: atMinute(date, b.end) },
      ),
    )
  );
}
export function inBookingWindow(start: Date, now: Date, horizonDays: number) {
  return (
    Number.isFinite(start.getTime()) &&
    start > now &&
    start.getTime() <= now.getTime() + horizonDays * 86400000
  );
}
export function canCustomerChange(startAt: Date, now: Date, cutoffHours: number) {
  return startAt.getTime() - now.getTime() >= cutoffHours * 3600000 && startAt > now;
}
export function onGrid(startAt: Date, step: number) {
  return (
    startAt.getUTCSeconds() === 0 &&
    startAt.getUTCMilliseconds() === 0 &&
    minuteOfDay(startAt) % step === 0
  );
}
export function defaultHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, day) => ({ day, start: 540, end: 1140, breaks: [] }));
}
