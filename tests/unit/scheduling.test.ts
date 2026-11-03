import { describe, expect, test } from 'bun:test';
import {
  atMinute,
  localDate,
  withinHours,
  overlaps,
  canCustomerChange,
  onGrid,
  validDate,
  validateHours,
} from '../../apps/api/src/scheduling';
const hours = [{ day: 1, start: 540, end: 1140, breaks: [{ start: 720, end: 780 }] }];
describe('Bangkok scheduling boundaries', () => {
  test('uses the Thai calendar date across UTC midnight', () => {
    expect(localDate(new Date('2030-01-06T18:00:00Z'))).toBe('2030-01-07');
    expect(atMinute('2030-01-07', 540).toISOString()).toBe('2030-01-07T02:00:00.000Z');
  });
  test('permits adjacent appointments and ending exactly at closing', () => {
    expect(
      overlaps(
        { startAt: atMinute('2030-01-07', 540), endAt: atMinute('2030-01-07', 570) },
        { startAt: atMinute('2030-01-07', 570), endAt: atMinute('2030-01-07', 600) },
      ),
    ).toBe(false);
    expect(withinHours(atMinute('2030-01-07', 1110), atMinute('2030-01-07', 1140), hours)).toBe(
      true,
    );
  });
  test('rejects breaks, closed days, and extending beyond closing', () => {
    expect(withinHours(atMinute('2030-01-07', 705), atMinute('2030-01-07', 735), hours)).toBe(
      false,
    );
    expect(withinHours(atMinute('2030-01-08', 540), atMinute('2030-01-08', 570), hours)).toBe(
      false,
    );
    expect(withinHours(atMinute('2030-01-07', 1125), atMinute('2030-01-07', 1155), hours)).toBe(
      false,
    );
  });
  test('accepts exactly two hours, rejects one millisecond later including across days', () => {
    const start = new Date('2030-01-07T18:00:00Z');
    const now = new Date('2030-01-07T16:00:00Z');
    expect(canCustomerChange(start, now, 2)).toBe(true);
    expect(canCustomerChange(start, new Date(+now + 1), 2)).toBe(false);
    expect(canCustomerChange(now, now, 0)).toBe(false);
  });
  test('validates real Gregorian dates and slot alignment', () => {
    expect(validDate('2030-02-30')).toBe(false);
    expect(validDate('2032-02-29')).toBe(true);
    expect(onGrid(atMinute('2030-01-07', 555), 15)).toBe(true);
    expect(onGrid(atMinute('2030-01-07', 556), 15)).toBe(false);
    expect(onGrid(new Date('2030-01-07T02:15:01Z'), 15)).toBe(false);
  });
  test('rejects overnight hours, duplicate weekdays, and out-of-hours breaks', () => {
    expect(() => validateHours([{ day: 1, start: 1140, end: 540, breaks: [] }])).toThrow();
    expect(() => validateHours([...hours, ...hours])).toThrow();
    expect(() =>
      validateHours([{ day: 1, start: 540, end: 600, breaks: [{ start: 600, end: 660 }] }]),
    ).toThrow();
  });
});
