'use client';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DayHours } from '@barber/db';
import { api, unwrap, type Catalog, money, dateLabel, time, today, addDays } from '../lib/client';
import { Button, ErrorNotice, Modal, Empty } from './ui';
import { HoursEditor } from './hours-editor';
function useRefresh() {
  const q = useQueryClient();
  return () => {
    void q.invalidateQueries({ queryKey: ['admin-catalog'] });
    void q.invalidateQueries({ queryKey: ['catalog'] });
    void q.invalidateQueries({ queryKey: ['slots'] });
  };
}
export function ServicesPanel({
  data,
  onSaved,
}: {
  data: Catalog;
  onSaved: (message: string) => void;
}) {
  const [editing, setEditing] = useState<Catalog['services'][number] | 'new' | null>(null);
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>บริการของร้าน</h2>
          <p className="muted">ราคาและระยะเวลาใช้เหมือนกันทุกช่าง</p>
        </div>
        <Button
          onClick={() => {
            onSaved('');
            setEditing('new');
          }}
        >
          + เพิ่มบริการ
        </Button>
      </div>
      <div className="management-list">
        {data.services.map((s) => (
          <div key={s.id} className="management-row">
            <div>
              <strong>{s.name}</strong>
              <p className="muted small">{s.description}</p>
            </div>
            <span>
              {money(s.price)} · {s.duration} นาที
            </span>
            <span className={`badge ${s.active ? 'status-confirmed' : 'status-cancelled'}`}>
              {s.active ? 'เปิดรับจอง' : 'ปิดรับจอง'}
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                onSaved('');
                setEditing(s);
              }}
            >
              แก้ไข
            </Button>
          </div>
        ))}
      </div>
      {editing && (
        <Modal
          title={editing === 'new' ? 'เพิ่มบริการ' : 'แก้ไขบริการ'}
          onClose={() => setEditing(null)}
        >
          <ServiceForm
            initial={editing === 'new' ? undefined : editing}
            onDone={() => {
              setEditing(null);
              onSaved('บันทึกบริการแล้ว');
            }}
          />
        </Modal>
      )}
    </section>
  );
}
function ServiceForm({
  initial,
  onDone,
}: {
  initial?: Catalog['services'][number];
  onDone: () => void;
}) {
  const refresh = useRefresh();
  const mutation = useMutation({
    mutationFn: (v: {
      name: string;
      description: string;
      price: number;
      duration: number;
      active: boolean;
    }) =>
      unwrap(
        initial
          ? api.api.admin.services({ id: initial.id }).put(v)
          : api.api.admin.services.post(v),
      ),
    onSuccess: () => {
      refresh();
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      price: String((initial?.price ?? 0) / 100),
      duration: String(initial?.duration ?? 30),
      active: initial?.active ?? true,
    },
    onSubmit: async ({ value }) => {
      await mutation
        .mutateAsync({
          ...value,
          price: Math.round(Number(value.price) * 100),
          duration: Number(value.duration),
        })
        .catch(() => {});
    },
  });
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <ErrorNotice error={mutation.error} />
      <form.Field name="name">
        {(field) => (
          <label className="field">
            ชื่อบริการ
            <input
              required
              maxLength={100}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <label className="field">
            รายละเอียด
            <textarea
              maxLength={500}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </label>
        )}
      </form.Field>
      <div className="form-grid">
        <form.Field name="price">
          {(field) => (
            <label className="field">
              ราคา (บาท)
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="duration">
          {(field) => (
            <label className="field">
              ระยะเวลา (นาที)
              <input
                type="number"
                min="1"
                max="720"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
      </div>
      <form.Field name="active">
        {(field) => (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(e) => field.handleChange(e.target.checked)}
            />
            เปิดรับจองบริการนี้
          </label>
        )}
      </form.Field>
      <p className="small muted">การเปลี่ยนแปลงไม่กระทบราคาและเวลาของนัดเดิม</p>
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? 'กำลังบันทึก…' : 'บันทึกบริการ'}
      </Button>
    </form>
  );
}
export function StaffPanel({
  data,
  onSaved,
}: {
  data: Catalog;
  onSaved: (message: string) => void;
}) {
  const [editing, setEditing] = useState<Catalog['staff'][number] | 'new' | null>(null);
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>ช่างและตารางงาน</h2>
          <p className="muted">กำหนดบริการที่ทำได้และเวลารับงานของแต่ละคน</p>
        </div>
        <Button
          onClick={() => {
            onSaved('');
            setEditing('new');
          }}
        >
          + เพิ่มช่าง
        </Button>
      </div>
      <div className="staff-management-grid">
        {data.staff.map((s, i) => (
          <article key={s.id} className="staff-card">
            <div className="row-between">
              <span className={`avatar avatar-${i % 3}`}>
                {s.name.replace('ช่าง', '').slice(0, 1)}
              </span>
              <span className={`badge ${s.active ? 'status-confirmed' : 'status-cancelled'}`}>
                {s.active ? 'เปิดรับจอง' : 'ปิดรับจอง'}
              </span>
            </div>
            <h3>{s.name}</h3>
            <p className="muted">{s.bio}</p>
            <p className="small">
              {data.services
                .filter((v) => s.serviceIds.includes(v.id))
                .map((v) => v.name)
                .join(' · ') || 'ยังไม่ได้เลือกบริการ'}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                onSaved('');
                setEditing(s);
              }}
            >
              แก้ไขข้อมูลและตารางงาน
            </Button>
          </article>
        ))}
      </div>
      {editing && (
        <Modal
          title={editing === 'new' ? 'เพิ่มช่าง' : 'แก้ไขช่างและตารางงาน'}
          onClose={() => setEditing(null)}
        >
          <StaffForm
            initial={editing === 'new' ? undefined : editing}
            data={data}
            onDone={() => {
              setEditing(null);
              onSaved('บันทึกข้อมูลช่างและตารางงานแล้ว');
            }}
          />
        </Modal>
      )}
    </section>
  );
}
function StaffForm({
  initial,
  data,
  onDone,
}: {
  initial?: Catalog['staff'][number];
  data: Catalog;
  onDone: () => void;
}) {
  const refresh = useRefresh();
  const [value, setValue] = useState({
    name: initial?.name ?? '',
    bio: initial?.bio ?? '',
    active: initial?.active ?? true,
    serviceIds: initial?.serviceIds ?? [],
    hours: initial?.hours ?? data.shop.hours.map((h) => ({ ...h, breaks: [] })),
  });
  const mutation = useMutation({
    mutationFn: () =>
      unwrap(
        initial
          ? api.api.admin.staff({ id: initial.id }).put(value)
          : api.api.admin.staff.post(value),
      ),
    onSuccess: () => {
      refresh();
      onDone();
    },
  });
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <ErrorNotice error={mutation.error} />
      <label className="field">
        ชื่อช่าง
        <input
          required
          maxLength={100}
          value={value.name}
          onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
        />
      </label>
      <label className="field">
        แนะนำตัว
        <textarea
          maxLength={500}
          value={value.bio}
          onChange={(e) => setValue((v) => ({ ...v, bio: e.target.value }))}
        />
      </label>
      <fieldset>
        <legend>บริการที่ทำได้</legend>
        <div className="check-options">
          {data.services.map((s) => (
            <label key={s.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={value.serviceIds.includes(s.id)}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    serviceIds: e.target.checked
                      ? [...v.serviceIds, s.id]
                      : v.serviceIds.filter((id) => id !== s.id),
                  }))
                }
              />
              {s.name}
              {!s.active && ' (ปิดรับจอง)'}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(e) => setValue((v) => ({ ...v, active: e.target.checked }))}
        />
        เปิดรับจองกับช่างคนนี้
      </label>
      <h3>เวลาทำงานและเวลาพัก</h3>
      <HoursEditor value={value.hours} onChange={(hours) => setValue((v) => ({ ...v, hours }))} />
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? 'กำลังบันทึก…' : 'บันทึกข้อมูลช่าง'}
      </Button>
    </form>
  );
}
export function SettingsPanel({ data }: { data: Catalog }) {
  return (
    <div className="settings-panels">
      <ShopForm data={data} />
      <TimeOffPanel data={data} />
    </div>
  );
}
function ShopForm({ data }: { data: Catalog }) {
  const refresh = useRefresh();
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState(data.shop);
  const mutation = useMutation({
    mutationFn: () => {
      const { id: _id, ...input } = value;
      return unwrap(api.api.admin.settings.put(input));
    },
    onSuccess: () => {
      setSaved(true);
      refresh();
    },
  });
  return (
    <form
      className="panel form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        mutation.mutate();
      }}
    >
      <h2>ตั้งค่าร้าน</h2>
      <ErrorNotice error={mutation.error} />
      {saved && (
        <p className="notice" role="status">
          บันทึกการตั้งค่าแล้ว
        </p>
      )}
      <label className="field">
        ชื่อร้าน
        <input
          required
          maxLength={100}
          value={value.name}
          onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
        />
      </label>
      <label className="field">
        เบอร์ติดต่อร้าน
        <input
          required
          type="tel"
          minLength={9}
          maxLength={25}
          value={value.phone}
          onChange={(e) => setValue((v) => ({ ...v, phone: e.target.value }))}
        />
      </label>
      <label className="field">
        ที่อยู่
        <textarea
          maxLength={500}
          value={value.address}
          onChange={(e) => setValue((v) => ({ ...v, address: e.target.value }))}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          ช่วงเวลาเริ่ม (นาที)
          <input
            type="number"
            min="5"
            max="60"
            required
            value={value.slotMinutes}
            onChange={(e) => setValue((v) => ({ ...v, slotMinutes: Number(e.target.value) }))}
          />
        </label>
        <label className="field">
          จองล่วงหน้า (วัน)
          <input
            type="number"
            min="1"
            max="180"
            required
            value={value.horizonDays}
            onChange={(e) => setValue((v) => ({ ...v, horizonDays: Number(e.target.value) }))}
          />
        </label>
        <label className="field">
          แก้ไขก่อนนัด (ชั่วโมง)
          <input
            type="number"
            min="0"
            max="168"
            required
            value={value.cutoffHours}
            onChange={(e) => setValue((v) => ({ ...v, cutoffHours: Number(e.target.value) }))}
          />
        </label>
      </div>
      <h3>เวลาเปิดร้าน</h3>
      <HoursEditor
        value={value.hours as DayHours[]}
        onChange={(hours) => setValue((v) => ({ ...v, hours }))}
      />
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
      </Button>
    </form>
  );
}
function TimeOffPanel({ data }: { data: Catalog }) {
  const refresh = useRefresh();
  const [show, setShow] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.api.admin['time-off']({ id }).delete()),
    onSuccess: () => {
      refresh();
      setRemoving(null);
    },
  });
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>วันหยุดและช่วงปิดรับ</h2>
          <p className="muted small">เลือกปิดทั้งร้านหรือเฉพาะช่าง</p>
        </div>
        <Button variant="secondary" onClick={() => setShow(true)}>
          + เพิ่ม
        </Button>
      </div>
      <ErrorNotice error={remove.error} />
      {!data.timeOff.length ? (
        <Empty>ยังไม่มีวันหยุดพิเศษ</Empty>
      ) : (
        data.timeOff.map((o) => (
          <div className="time-off-row" key={o.id}>
            <strong>{o.reason}</strong>
            <span>{o.staffId ? data.staff.find((s) => s.id === o.staffId)?.name : 'ทั้งร้าน'}</span>
            <span className="muted small">
              {dateLabel(o.startAt, true)} {time(o.startAt)} – {dateLabel(o.endAt, true)}{' '}
              {time(o.endAt)}
            </span>
            <button className="text-link" onClick={() => setRemoving(o.id)}>
              ลบช่วงปิดรับ
            </button>
          </div>
        ))
      )}
      {show && (
        <Modal title="เพิ่มช่วงปิดรับจอง" onClose={() => setShow(false)}>
          <TimeOffForm data={data} onDone={() => setShow(false)} />
        </Modal>
      )}
      {removing && (
        <Modal title="ลบช่วงปิดรับจอง?" onClose={() => setRemoving(null)}>
          <p>ช่วงเวลานี้จะกลับมาเปิดรับจองตามตารางงานปกติ</p>
          <div className="actions">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              กลับ
            </Button>
            <Button disabled={remove.isPending} onClick={() => remove.mutate(removing)}>
              ยืนยันลบ
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function TimeOffForm({ data, onDone }: { data: Catalog; onDone: () => void }) {
  const refresh = useRefresh();
  const [value, setValue] = useState({
    staffId: '',
    startDate: today(),
    startTime: '09:00',
    endDate: addDays(today(), 1),
    endTime: '09:00',
    reason: '',
  });
  const mutation = useMutation({
    mutationFn: () =>
      unwrap(
        api.api.admin['time-off'].post({
          staffId: value.staffId || null,
          startAt: new Date(`${value.startDate}T${value.startTime}:00+07:00`).toISOString(),
          endAt: new Date(`${value.endDate}T${value.endTime}:00+07:00`).toISOString(),
          reason: value.reason,
        }),
      ),
    onSuccess: () => {
      refresh();
      onDone();
    },
  });
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <ErrorNotice error={mutation.error} />
      <label className="field">
        ปิดรับสำหรับ
        <select
          value={value.staffId}
          onChange={(e) => setValue((v) => ({ ...v, staffId: e.target.value }))}
        >
          <option value="">ทั้งร้าน</option>
          {data.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        เหตุผล
        <input
          required
          maxLength={200}
          value={value.reason}
          onChange={(e) => setValue((v) => ({ ...v, reason: e.target.value }))}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          วันที่เริ่ม
          <input
            type="date"
            required
            value={value.startDate}
            onChange={(e) => setValue((v) => ({ ...v, startDate: e.target.value }))}
          />
        </label>
        <label className="field">
          เวลาเริ่ม
          <input
            type="time"
            required
            value={value.startTime}
            onChange={(e) => setValue((v) => ({ ...v, startTime: e.target.value }))}
          />
        </label>
        <label className="field">
          วันที่สิ้นสุด
          <input
            type="date"
            required
            value={value.endDate}
            onChange={(e) => setValue((v) => ({ ...v, endDate: e.target.value }))}
          />
        </label>
        <label className="field">
          เวลาสิ้นสุด
          <input
            type="time"
            required
            value={value.endTime}
            onChange={(e) => setValue((v) => ({ ...v, endTime: e.target.value }))}
          />
        </label>
      </div>
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? 'กำลังบันทึก…' : 'บันทึกช่วงปิดรับ'}
      </Button>
    </form>
  );
}
