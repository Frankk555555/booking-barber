'use client';
import { useState, useEffect, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Scissors,
  Droplets,
  Sparkles,
  Check,
  ChevronRight,
  ArrowLeft,
  Clock3,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';
import {
  api,
  unwrap,
  money,
  time,
  dateLabel,
  today,
  requestKey,
  manageLink,
  type BookingView,
  ApiError,
} from '../lib/client';
import { Button, Loading, ErrorNotice, BookingReceipt, ShopInfo, Empty } from './ui';
import { SlotPicker } from './slots';
const steps = ['บริการ', 'ช่าง', 'วันและเวลา', 'ข้อมูลของคุณ', 'ยืนยัน'];
export function BookingFlow({
  admin = false,
  onCreated,
}: {
  admin?: boolean;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => unwrap(api.api.catalog.get()) });
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState(today());
  const [slot, setSlot] = useState('');
  const [done, setDone] = useState<{ booking: BookingView; token: string } | null>(null);
  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      const frame = requestAnimationFrame(() => headingRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [step]);
  const contact = useForm({
    defaultValues: { customerName: '', phone: '' },
    onSubmit: async () => {
      setStep(4);
    },
    onSubmitInvalid: ({ formApi }) => {
      if (formApi.getFieldMeta('customerName')?.errors.length) nameRef.current?.focus();
      else phoneRef.current?.focus();
    },
  });
  const [contactValues, setContactValues] = useState({ customerName: '', phone: '' });
  const submit = useMutation({
    mutationFn: async () => {
      const currentServices = catalog.data?.services.filter((s) => selected.includes(s.id)) ?? [];
      const payload = {
        staffId: barberId,
        serviceIds: selected,
        startAt: slot,
        ...contactValues,
        expectedPrice: currentServices.reduce((n, s) => n + s.price, 0),
        expectedDuration: currentServices.reduce((n, s) => n + s.duration, 0),
      };
      const key = await requestKey(payload);
      return unwrap(
        admin
          ? api.api.admin.bookings.post(payload, { headers: { 'idempotency-key': key } })
          : api.api.bookings.post(payload, { headers: { 'idempotency-key': key } }),
      );
    },
    onSuccess: (data) => {
      setDone(data);
      if (!admin) router.replace(manageLink(data.token));
      void queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['slots'] });
      onCreated?.();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setSlot('');
        setStep(error.details === 'QUOTE_CHANGED' ? 0 : 2);
        void queryClient.invalidateQueries({ queryKey: ['catalog'] });
        void queryClient.invalidateQueries({ queryKey: ['slots'] });
      }
    },
  });
  useEffect(() => {
    if (!catalog.data || done) return;
    const valid = selected.filter((id) => catalog.data.services.some((s) => s.id === id));
    if (valid.length !== selected.length) {
      setSelected(valid);
      setBarberId('');
      setSlot('');
      setStep(0);
    } else if (
      barberId &&
      !catalog.data.staff.some(
        (s) => s.id === barberId && selected.every((id) => s.serviceIds.includes(id)),
      )
    ) {
      setBarberId('');
      setSlot('');
      setStep(1);
    }
  }, [catalog.data, selected, barberId, done]);
  if (catalog.isPending) return <Loading />;
  if (catalog.error || !catalog.data)
    return (
      <ErrorNotice
        error={catalog.error}
        retry={() => {
          void catalog.refetch();
        }}
      />
    );
  const data = catalog.data;
  if (done) return <BookingReceipt {...done} shop={data.shop} />;
  const chosen = data.services.filter((s) => selected.includes(s.id));
  const barber = data.staff.find((s) => s.id === barberId);
  const total = chosen.reduce((n, s) => n + s.price, 0);
  const duration = chosen.reduce((n, s) => n + s.duration, 0);
  const eligible = data.staff.filter((s) => selected.every((id) => s.serviceIds.includes(id)));
  const canContinue =
    step === 0
      ? selected.length > 0
      : step === 1
        ? Boolean(barberId)
        : step === 2
          ? Boolean(slot)
          : true;
  return (
    <div className={`booking-layout ${admin ? 'embedded-booking' : ''}`}>
      <div className="booking-main">
        <nav className="steps" aria-label="ขั้นตอนการจอง">
          {steps.map((s, i) => (
            <button
              key={s}
              disabled={i > step || submit.isPending}
              aria-current={step === i ? 'step' : undefined}
              className={`step ${step === i ? 'current' : ''} ${step > i ? 'complete' : ''}`}
              onClick={() => setStep(i)}
            >
              <span>{step > i ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span>
              <span>{s}</span>
            </button>
          ))}
        </nav>
        <div className="step-panel">
          {admin && <p className="eyebrow">STEP {String(step + 1).padStart(2, '0')} / 05</p>}
          <h2 ref={headingRef} tabIndex={-1} className="step-heading">
            <span className="sr-only">
              ขั้นที่ {step + 1} จาก {steps.length}:{' '}
            </span>
            {
              [
                'วันนี้ ให้เราดูแลอะไรดีครับ',
                'เลือกช่างที่ใช่สำหรับคุณ',
                'เลือกเวลาที่สะดวก',
                'ขอรู้จักคุณอีกนิด',
                'ตรวจสอบนัดของคุณ',
              ][step]
            }
          </h2>
          <p className="muted step-description">
            {
              [
                'เลือกได้มากกว่าหนึ่งบริการ เราจะจัดเวลาให้ต่อเนื่องกัน',
                'ช่างที่แสดงสามารถดูแลบริการที่คุณเลือกได้ครบ',
                'เวลาที่แสดงเป็นช่วงว่างสำหรับทุกบริการที่เลือก',
                'ใช้ชื่อและเบอร์เพื่อติดต่อเรื่องนัด ไม่ต้องสมัครสมาชิก',
                'เมื่อยืนยันแล้ว ระบบจะจองเวลานี้ให้คุณทันที',
              ][step]
            }
          </p>
          <ErrorNotice error={submit.error} />
          {step === 0 && (
            <div className="service-list">
              {data.services.length === 0 && <Empty>ร้านยังไม่ได้เปิดบริการ กรุณาติดต่อร้าน</Empty>}
              {data.services.map((s) => {
                const Icon = s.name.includes('สระ')
                  ? Droplets
                  : s.name.includes('หนวด')
                    ? Sparkles
                    : Scissors;
                const checked = selected.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    className={`service-option ${checked ? 'selected' : ''}`}
                    aria-pressed={checked}
                    onClick={() => {
                      setSelected((prev) =>
                        checked ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                      );
                      setBarberId('');
                      setSlot('');
                      submit.reset();
                    }}
                  >
                    <span className="service-icon">
                      <Icon size={24} strokeWidth={1.4} />
                    </span>
                    <span className="service-copy">
                      <strong>{s.name}</strong>
                      <span>{s.description}</span>
                      <small>
                        <Clock3 size={13} />
                        {s.duration} นาที
                      </small>
                    </span>
                    <span className="service-price">
                      {money(s.price)}
                      <span className="check-box">{checked && <Check size={14} />}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {step === 1 && (
            <div className="barber-grid">
              {eligible.length === 0 && (
                <Empty>ยังไม่มีช่างที่รับบริการชุดนี้ กรุณากลับไปปรับรายการบริการ</Empty>
              )}
              {eligible.map((s, i) => (
                <button
                  key={s.id}
                  aria-pressed={barberId === s.id}
                  className={`barber-option ${barberId === s.id ? 'selected' : ''}`}
                  onClick={() => {
                    setBarberId(s.id);
                    setSlot('');
                  }}
                >
                  <span className={`avatar avatar-${i % 3}`}>
                    {s.name.replace('ช่าง', '').slice(0, 1)}
                  </span>
                  <strong>{s.name}</strong>
                  <span className="muted">{s.bio}</span>
                  <span className="barber-select">
                    {barberId === s.id ? (
                      <>
                        <Check size={15} />
                        เลือกแล้ว
                      </>
                    ) : (
                      'เลือกช่างคนนี้'
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          {step === 2 && (
            <SlotPicker
              staffId={barberId}
              serviceIds={selected}
              date={date}
              onDate={setDate}
              value={slot}
              onChange={setSlot}
              horizonDays={data.shop.horizonDays}
            />
          )}
          {step === 3 && (
            <form
              id={formId}
              className="contact-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void contact.handleSubmit();
              }}
            >
              <contact.Field
                name="customerName"
                validators={{
                  onChange: ({ value }) =>
                    value.trim().length < 2 ? 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร' : undefined,
                }}
              >
                {(field) => (
                  <div className="field">
                    <label htmlFor={`${formId}-name`}>ชื่อผู้จอง</label>
                    <input
                      id={`${formId}-name`}
                      ref={nameRef}
                      autoComplete="name"
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby={
                        field.state.meta.errors.length ? `${formId}-name-error` : undefined
                      }
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="ชื่อที่ให้เราเรียกคุณ"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                        setContactValues((v) => ({ ...v, customerName: e.target.value }));
                      }}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <span id={`${formId}-name-error`} className="field-error" role="status">
                        {field.state.meta.errors.join(' ')}
                      </span>
                    )}
                  </div>
                )}
              </contact.Field>
              <contact.Field
                name="phone"
                validators={{
                  onChange: ({ value }) =>
                    /^(0\d{8,9}|\+[1-9]\d{7,14})$/.test(value.replace(/[\s-]/g, ''))
                      ? undefined
                      : 'กรุณากรอกเบอร์โทรให้ถูกต้อง',
                }}
              >
                {(field) => (
                  <div className="field">
                    <label htmlFor={`${formId}-phone`}>เบอร์โทรศัพท์</label>
                    <input
                      id={`${formId}-phone`}
                      ref={phoneRef}
                      type="tel"
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby={
                        field.state.meta.errors.length ? `${formId}-phone-error` : undefined
                      }
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      maxLength={25}
                      placeholder="08X XXX XXXX"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                        setContactValues((v) => ({ ...v, phone: e.target.value }));
                      }}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <span id={`${formId}-phone-error`} className="field-error" role="status">
                        {field.state.meta.errors.join(' ')}
                      </span>
                    )}
                  </div>
                )}
              </contact.Field>
              <p className="privacy-note">
                <ShieldCheck size={18} />
                ข้อมูลนี้ใช้สำหรับนัดหมายและติดต่อเรื่องการจองของคุณเท่านั้น
              </p>
            </form>
          )}
          {step === 4 && (
            <div className="confirmation">
              <div>
                <span className="muted">ผู้จอง</span>
                <strong>{contactValues.customerName}</strong>
                <span>{contactValues.phone}</span>
              </div>
              <div>
                <span className="muted">นัดหมาย</span>
                <strong>{dateLabel(slot)}</strong>
                <span>
                  {time(slot)} น. · {duration} นาที · {barber?.name}
                </span>
              </div>
              <div>
                <span className="muted">บริการ</span>
                <strong>{chosen.map((s) => s.name).join(' + ')}</strong>
                <span>{money(total)} · ชำระที่ร้าน</span>
              </div>
              <p className="notice">
                เลื่อนหรือยกเลิกผ่านลิงก์ส่วนตัวได้ก่อนนัดอย่างน้อย {data.shop.cutoffHours} ชั่วโมง
                กรุณาเก็บลิงก์ไว้หลังจองสำเร็จ
              </p>
            </div>
          )}
          <div className="mobile-booking-total" role="status" aria-atomic="true">
            <div>
              <span>
                {chosen.length
                  ? `${chosen.length} บริการ · ${duration} นาที`
                  : 'ยังไม่ได้เลือกบริการ'}
              </span>
              <small>ชำระค่าบริการที่ร้าน</small>
            </div>
            <strong>
              <span className="sr-only">ยอดรวม </span>
              {money(total)}
            </strong>
          </div>
          <div className="step-actions">
            {step > 0 ? (
              <Button variant="quiet" disabled={submit.isPending} onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} />
                ย้อนกลับ
              </Button>
            ) : (
              <span />
            )}
            {step === 3 ? (
              <Button type="submit" form={formId}>
                ตรวจสอบนัด
                <ChevronRight size={17} />
              </Button>
            ) : step === 4 ? (
              <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
                {submit.isPending ? 'กำลังยืนยัน…' : 'ยืนยันการจอง'}
                <Check size={17} />
              </Button>
            ) : (
              <Button disabled={!canContinue} onClick={() => setStep(step + 1)}>
                ถัดไป
                <ChevronRight size={17} />
              </Button>
            )}
          </div>
        </div>
      </div>
      <aside className="booking-sidebar">
        <div className="summary">
          <div className="summary-title">
            <CalendarDays size={18} />
            <h3>นัดของคุณ</h3>
          </div>
          {chosen.length === 0 ? (
            <p className="muted summary-placeholder">
              บริการที่เลือกจะแสดงที่นี่
              <br />
              พร้อมราคาและระยะเวลารวม
            </p>
          ) : (
            <div className="summary-services">
              {chosen.map((s) => (
                <div className="row-between" key={s.id}>
                  <span>{s.name}</span>
                  <span>{money(s.price)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="summary-meta">
            <p>
              <Scissors size={16} />
              {barber?.name ?? 'ยังไม่ได้เลือกช่าง'}
            </p>
            <p>
              <CalendarDays size={16} />
              {slot
                ? dateLabel(slot, true) + ' · ' + time(slot) + ' น.'
                : 'ยังไม่ได้เลือกวันและเวลา'}
            </p>
            <p>
              <Clock3 size={16} />
              {duration > 0 ? `${duration} นาที` : 'ระยะเวลาตามบริการที่เลือก'}
            </p>
          </div>
          <div className="summary-total">
            <span>ยอดรวม</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="small muted">ชำระค่าบริการที่ร้านในวันนัด</p>
        </div>
        <div className="sidebar-note">
          <ShieldCheck size={20} />
          <div>
            <strong>จองง่าย ไม่ต้องสมัครสมาชิก</strong>
            <p>
              รับลิงก์ส่วนตัวไว้ดูและจัดการนัด
              <br />
              หลังยืนยันการจอง
            </p>
          </div>
        </div>
        <ShopInfo shop={data.shop} />
      </aside>
    </div>
  );
}
