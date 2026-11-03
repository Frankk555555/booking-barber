'use client';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap, today, addDays, time, dateLabel, type BookingView } from '../lib/client';
import { Loading, ErrorNotice, Empty } from './ui';
export function SlotPicker({
  staffId,
  serviceIds,
  date,
  onDate,
  value,
  onChange,
  horizonDays,
  existing,
  token,
  admin = false,
}: {
  staffId: string;
  serviceIds: string[];
  date: string;
  onDate: (date: string) => void;
  value: string;
  onChange: (slot: string) => void;
  horizonDays: number;
  existing?: BookingView;
  token?: string;
  admin?: boolean;
}) {
  const query = useQuery({
    queryKey: ['slots', staffId, serviceIds.join(','), date, existing?.id, admin, token],
    queryFn: () =>
      existing
        ? admin
          ? unwrap(
              api.api.admin.bookings({ id: existing.id }).availability.get({ query: { date } }),
            )
          : unwrap(
              api.api.manage.availability.get({
                query: { date },
                headers: { authorization: `Bearer ${token}` },
              }),
            )
        : unwrap(
            api.api.availability.get({
              query: { staffId, serviceIds: serviceIds.join(','), date },
            }),
          ),
    enabled: Boolean(staffId && date),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  return (
    <div className="slot-picker">
      <label className="field">
        เลือกวันที่
        <input
          type="date"
          min={today()}
          max={addDays(today(), horizonDays)}
          value={date}
          onChange={(e) => {
            onDate(e.target.value);
            onChange('');
          }}
        />
      </label>
      <div className="date-strip">
        {Array.from({ length: 7 }, (_, i) => addDays(today(), i))
          .filter((d) => d <= addDays(today(), horizonDays))
          .map((d) => (
            <button
              key={d}
              className={`date-chip ${date === d ? 'selected' : ''}`}
              onClick={() => {
                onDate(d);
                onChange('');
              }}
              aria-pressed={date === d}
            >
              <span>{iLabel(d)}</span>
              <strong>{new Date(d + 'T12:00:00Z').getUTCDate()}</strong>
              <span>{dateLabel(d, true).split(' ').slice(-1).join(' ')}</span>
            </button>
          ))}
      </div>
      <div className="row-between">
        <h3>เวลาที่ว่าง</h3>
        <span className="muted small">เวลาประเทศไทย</span>
      </div>
      {query.isPending ? (
        <Loading text="กำลังหาเวลาที่เหมาะกับคุณ…" />
      ) : query.error ? (
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : !query.data?.slots.length ? (
        <Empty>วันนี้ยังไม่มีเวลาว่าง ลองเลือกวันอื่นได้ครับ</Empty>
      ) : (
        <div className="time-grid">
          {query.data.slots.map((slot) => (
            <button
              key={slot}
              type="button"
              aria-pressed={value === slot}
              className={`time-slot ${value === slot ? 'selected' : ''}`}
              onClick={() => onChange(slot)}
            >
              {time(slot)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function iLabel(d: string) {
  return d === today()
    ? 'วันนี้'
    : new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short' }).format(
        new Date(d + 'T12:00:00Z'),
      );
}
