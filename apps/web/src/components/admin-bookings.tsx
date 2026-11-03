'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  api,
  unwrap,
  type BookingView,
  type Catalog,
  today,
  addDays,
  dateLabel,
  time,
  money,
  labels,
  manageLink,
} from '../lib/client';
import { Button, Loading, ErrorNotice, Empty, StatusBadge, Modal } from './ui';
import { BookingFlow } from './booking-flow';
import { SlotPicker } from './slots';
export function BookingsPanel({ catalog }: { catalog: Catalog }) {
  const [view, setView] = useState<'day' | 'week' | 'list'>('day');
  const [date, setDate] = useState(today());
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<BookingView | null>(null);
  const [adding, setAdding] = useState(false);
  const end = addDays(date, view === 'week' ? 6 : view === 'list' ? 29 : 0);
  const query = useQuery({
    queryKey: ['admin-bookings', date, end],
    queryFn: () => unwrap(api.api.admin.bookings.get({ query: { from: date, to: end } })),
    refetchInterval: 30000,
    staleTime: 0,
  });
  const filtered = (query.data ?? []).filter(
    (b) =>
      (status === 'all' || b.status === status) &&
      `${b.customerName} ${b.phone} ${b.reference} ${b.staffName}`
        .toLocaleLowerCase()
        .includes(filter.toLocaleLowerCase()),
  );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>ตารางนัดหมาย</h2>
          <p className="muted">คิวออนไลน์และหน้าร้านในตารางเดียว · อัปเดตทุก 30 วินาที</p>
        </div>
        <Button onClick={() => setAdding(true)}>+ เพิ่มนัด</Button>
      </div>
      <div className="booking-toolbar">
        <div className="segmented">
          {(['day', 'week', 'list'] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              className={view === v ? 'selected' : ''}
              onClick={() => setView(v)}
            >
              {v === 'day' ? 'รายวัน' : v === 'week' ? 'รายสัปดาห์' : 'รายการ'}
            </button>
          ))}
        </div>
        <label className="field compact-field">
          เริ่มวันที่
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <Button variant="quiet" onClick={() => setDate(today())}>
          วันนี้
        </Button>
      </div>
      <div className="booking-filters">
        <input
          aria-label="ค้นหานัด"
          placeholder="ค้นหาชื่อ เบอร์ ช่าง หรือเลขนัด"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select aria-label="กรองสถานะ" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">ทุกสถานะ</option>
          {Object.entries(labels).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
      {query.isPending ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty>ไม่มีนัดในช่วงวันที่หรือเงื่อนไขที่เลือก</Empty>
      ) : view === 'list' ? (
        <BookingsTable bookings={filtered} onSelect={setSelected} />
      ) : (
        <div className="calendar-scroll">
          <div className={`calendar-board ${view === 'week' ? 'weekly' : ''}`}>
            {view === 'week'
              ? Array.from({ length: 7 }, (_, i) => addDays(date, i)).map((d) => (
                  <div className="calendar-column" key={d}>
                    <h3>{dateLabel(d, true)}</h3>
                    <span className="small muted">
                      {
                        filtered.filter(
                          (b) =>
                            new Intl.DateTimeFormat('en-CA', {
                              timeZone: 'Asia/Bangkok',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            }).format(new Date(b.startAt)) === d,
                        ).length
                      }{' '}
                      นัด
                    </span>
                    {filtered
                      .filter(
                        (b) =>
                          new Intl.DateTimeFormat('en-CA', {
                            timeZone: 'Asia/Bangkok',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          }).format(new Date(b.startAt)) === d,
                      )
                      .map((b) => (
                        <BookingCard key={b.id} booking={b} onClick={() => setSelected(b)} />
                      ))}
                  </div>
                ))
              : catalog.staff.map((s) => (
                  <div className="calendar-column" key={s.id}>
                    <h3>{s.name}</h3>
                    <span className="small muted">
                      {filtered.filter((b) => b.staffId === s.id).length} นัด
                    </span>
                    {filtered
                      .filter((b) => b.staffId === s.id)
                      .map((b) => (
                        <BookingCard key={b.id} booking={b} onClick={() => setSelected(b)} />
                      ))}
                  </div>
                ))}
          </div>
        </div>
      )}
      {selected && (
        <BookingDialog booking={selected} catalog={catalog} onClose={() => setSelected(null)} />
      )}{' '}
      {adding && (
        <Modal title="เพิ่มนัดจากหน้าร้านหรือโทรศัพท์" onClose={() => setAdding(false)}>
          <BookingFlow admin />
        </Modal>
      )}
    </section>
  );
}
function BookingCard({ booking: b, onClick }: { booking: BookingView; onClick: () => void }) {
  return (
    <button className={`booking-card status-border-${b.status}`} onClick={onClick}>
      <span className="booking-card-time">
        {time(b.startAt)}–{time(b.endAt)}
      </span>
      <strong>{b.customerName}</strong>
      <span className="small muted">{b.items.map((i) => i.name).join(' + ')}</span>
      <span className="small">{b.staffName}</span>
      <StatusBadge status={b.status} />
    </button>
  );
}
function BookingsTable({
  bookings,
  onSelect,
}: {
  bookings: BookingView[];
  onSelect: (b: BookingView) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<BookingView>[]>(
    () => [
      {
        accessorKey: 'startAt',
        header: 'วันและเวลา',
        cell: ({ row }) => (
          <>
            <span>{dateLabel(row.original.startAt, true)}</span>
            <br />
            <span className="muted">
              {time(row.original.startAt)}–{time(row.original.endAt)}
            </span>
          </>
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'ผู้จอง',
        cell: ({ row }) => (
          <>
            <strong>{row.original.customerName}</strong>
            <br />
            <span className="muted">{row.original.phone}</span>
          </>
        ),
      },
      { accessorKey: 'staffName', header: 'ช่าง' },
      {
        accessorKey: 'totalPrice',
        header: 'ยอดรวม',
        cell: ({ row }) => money(row.original.totalPrice),
      },
      {
        accessorKey: 'status',
        header: 'สถานะ',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: 'จัดการ',
        cell: ({ row }) => (
          <Button variant="secondary" onClick={() => onSelect(row.original)}>
            ดูนัด
          </Button>
        ),
      },
    ],
    [onSelect],
  );
  const table = useReactTable({
    data: bookings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <div className="table-scroll">
      <table>
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th
                  key={h.id}
                  aria-sort={
                    h.column.getIsSorted() === 'asc'
                      ? 'ascending'
                      : h.column.getIsSorted() === 'desc'
                        ? 'descending'
                        : 'none'
                  }
                >
                  {h.column.getCanSort() ? (
                    <button onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())} ↕
                    </button>
                  ) : (
                    flexRender(h.column.columnDef.header, h.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function BookingDialog({
  booking: initial,
  catalog,
  onClose,
}: {
  booking: BookingView;
  catalog: Catalog;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [booking, setBooking] = useState(initial);
  const [moving, setMoving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [date, setDate] = useState(today());
  const [slot, setSlot] = useState('');
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');
  const mutation = useMutation({
    mutationFn: (action: BookingView['status'] | 'move') =>
      action === 'move'
        ? unwrap(api.api.admin.bookings({ id: booking.id }).reschedule.post({ startAt: slot }))
        : unwrap(api.api.admin.bookings({ id: booking.id }).status.patch({ status: action })),
    onSuccess: (data) => {
      setBooking(data);
      setMoving(false);
      setCancelling(false);
      setSlot('');
      void client.invalidateQueries({ queryKey: ['admin-bookings'] });
      void client.invalidateQueries({ queryKey: ['slots'] });
    },
    onError: () => {
      setSlot('');
      void client.invalidateQueries({ queryKey: ['slots'] });
    },
  });
  const issue = useMutation({
    mutationFn: () => unwrap(api.api.admin.bookings({ id: booking.id }).link.post()),
    onSuccess: async (data) => {
      const value = manageLink(data.token);
      setLink(value);
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    },
  });
  return (
    <Modal
      title={`นัด ${booking.reference}`}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <div className="booking-detail">
        <StatusBadge status={booking.status} />
        <h3>{booking.customerName}</h3>
        <a href={`tel:${booking.phone}`}>{booking.phone}</a>
        <p>
          {dateLabel(booking.startAt)} · {time(booking.startAt)}–{time(booking.endAt)}
        </p>
        <p>
          {booking.staffName} · {booking.items.map((i) => i.name).join(' + ')}
        </p>
        <p>
          {money(booking.totalPrice)} · {booking.totalDuration} นาที ·{' '}
          {booking.source === 'online' ? 'จองออนไลน์' : 'จองโดยร้าน'}
        </p>
      </div>
      <ErrorNotice error={mutation.error ?? issue.error} />
      {moving ? (
        <>
          <SlotPicker
            admin
            existing={booking}
            staffId={booking.staffId}
            serviceIds={[]}
            date={date}
            onDate={setDate}
            value={slot}
            onChange={setSlot}
            horizonDays={catalog.shop.horizonDays}
          />
          <div className="actions">
            <Button variant="secondary" onClick={() => setMoving(false)}>
              กลับ
            </Button>
            <Button disabled={!slot || mutation.isPending} onClick={() => mutation.mutate('move')}>
              ยืนยันเวลาใหม่
            </Button>
          </div>
        </>
      ) : cancelling ? (
        <div className="notice">
          <p>ยืนยันยกเลิกนัดนี้? ช่วงเวลาจะเปิดให้จองใหม่</p>
          <div className="actions">
            <Button variant="secondary" onClick={() => setCancelling(false)}>
              กลับ
            </Button>
            <Button
              variant="danger"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate('cancelled')}
            >
              ยืนยันยกเลิกนัด
            </Button>
          </div>
        </div>
      ) : (
        <div className="actions">
          {booking.status === 'confirmed' && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  mutation.reset();
                  setMoving(true);
                }}
              >
                เลื่อนนัด
              </Button>
              <Button
                disabled={mutation.isPending || new Date(booking.startAt) > new Date()}
                onClick={() => mutation.mutate('in_service')}
              >
                เริ่มให้บริการ
              </Button>
              <Button
                variant="quiet"
                disabled={mutation.isPending || new Date(booking.startAt) > new Date()}
                onClick={() => mutation.mutate('no_show')}
              >
                ไม่มาตามนัด
              </Button>
              <Button variant="danger" onClick={() => setCancelling(true)}>
                ยกเลิกนัด
              </Button>
            </>
          )}
          {booking.status === 'in_service' && (
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate('completed')}>
              เสร็จสิ้นบริการ
            </Button>
          )}
        </div>
      )}
      <div className="link-field">
        <Button variant="quiet" disabled={issue.isPending} onClick={() => issue.mutate()}>
          {copied ? 'คัดลอกลิงก์ลูกค้าแล้ว' : 'คัดลอกลิงก์ให้ลูกค้า'}
        </Button>
        {link && (
          <input
            aria-label="ลิงก์นัดสำหรับลูกค้า"
            value={link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </div>
    </Modal>
  );
}
