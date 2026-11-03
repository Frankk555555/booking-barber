'use client';
import type { DayHours } from '@barber/db';
import { Button } from './ui';
const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const toTime = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const toMinute = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
export function HoursEditor({
  value,
  onChange,
}: {
  value: DayHours[];
  onChange: (hours: DayHours[]) => void;
}) {
  function update(day: number, patch: Partial<DayHours>) {
    onChange(value.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  }
  return (
    <div className="hours-editor">
      {days.map((day, index) => {
        const h = value.find((h) => h.day === index);
        return (
          <div className="hours-day" key={day}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(h)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, { day: index, start: 540, end: 1140, breaks: [] }]
                      : value.filter((v) => v.day !== index),
                  )
                }
              />
              {day}
            </label>
            {h ? (
              <div className="hours-controls">
                <div className="time-range">
                  <input
                    type="time"
                    aria-label={`เวลาเปิด ${day}`}
                    required
                    value={toTime(h.start)}
                    onChange={(e) => update(index, { start: toMinute(e.target.value) })}
                  />
                  <span>–</span>
                  <input
                    type="time"
                    aria-label={`เวลาปิด ${day}`}
                    required
                    value={toTime(h.end)}
                    onChange={(e) => update(index, { end: toMinute(e.target.value) })}
                  />
                </div>
                {h.breaks.map((b, bi) => (
                  <div className="time-range" key={bi}>
                    <span className="small">พัก</span>
                    <input
                      type="time"
                      aria-label={`เริ่มพัก ${day} ${bi + 1}`}
                      value={toTime(b.start)}
                      required
                      onChange={(e) =>
                        update(index, {
                          breaks: h.breaks.map((v, i) =>
                            i === bi ? { ...v, start: toMinute(e.target.value) } : v,
                          ),
                        })
                      }
                    />
                    <span>–</span>
                    <input
                      type="time"
                      aria-label={`จบพัก ${day} ${bi + 1}`}
                      required
                      value={toTime(b.end)}
                      onChange={(e) =>
                        update(index, {
                          breaks: h.breaks.map((v, i) =>
                            i === bi ? { ...v, end: toMinute(e.target.value) } : v,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="text-link"
                      aria-label={`ลบช่วงพัก ${day} ${bi + 1}`}
                      onClick={() => update(index, { breaks: h.breaks.filter((_, i) => i !== bi) })}
                    >
                      ลบ
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="quiet"
                  disabled={h.breaks.length >= 8}
                  onClick={() =>
                    update(index, {
                      breaks: [
                        ...h.breaks,
                        { start: Math.max(h.start, 720), end: Math.min(h.end, 780) },
                      ],
                    })
                  }
                >
                  + เวลาพัก
                </Button>
              </div>
            ) : (
              <span className="muted">ปิด</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
