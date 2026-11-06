'use client';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Scissors,
  ArrowUpRight,
  X,
  Check,
  Phone,
  MapPin,
  CircleAlert,
  LoaderCircle,
} from 'lucide-react';
import {
  api,
  unwrap,
  ApiError,
  type Catalog,
  type BookingView,
  money,
  time,
  dateLabel,
  labels,
  manageLink,
} from '../lib/client';
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Header({ admin = false }: { admin?: boolean }) {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => unwrap(api.api.catalog.get()) });
  return (
    <header className={`site-header${admin ? ' admin-header' : ''}`}>
      <div className="header-inner">
        <Link
          href="/"
          className="brand"
          aria-label={`${catalog.data?.shop.name ?? 'ละมุน บาร์เบอร์'} หน้าหลัก`}
        >
          <span className="brand-mark">
            <Scissors size={23} strokeWidth={1.5} />
          </span>
          <span>
            {catalog.data?.shop.name ?? 'ละมุน บาร์เบอร์'}
            <span className="brand-sub">{admin ? 'BARBER & CARE' : 'จองคิวตัดผม'}</span>
          </span>
        </Link>
        <div className="header-right">
          <span className="header-note">เวลาดี ๆ เริ่มที่การดูแลตัวเอง</span>
          <Link className="header-link" href={admin ? '/' : '/admin'}>
            {admin ? 'หน้าจองคิว' : 'สำหรับร้าน'}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}
export function Loading({ text = 'กำลังโหลดข้อมูล…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      {text}
    </div>
  );
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  const details =
    error instanceof ApiError && Array.isArray(error.details)
      ? (error.details as { reference: string; startAt: string }[])
      : [];
  return (
    <div className="notice error" role="alert">
      <CircleAlert size={19} />
      <div>
        <p>{error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่'}</p>
        {details.map((x) => (
          <p key={x.reference}>
            {x.reference} · {dateLabel(x.startAt, true)} {time(x.startAt)}
          </p>
        ))}
        {retry && (
          <button className="text-link" onClick={retry}>
            ลองอีกครั้ง
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function StatusBadge({ status }: { status: BookingView['status'] }) {
  return <span className={`badge status-${status}`}>{labels[status]}</span>;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="ปิดหน้าต่าง" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ShopInfo({ shop }: { shop: Catalog['shop'] }) {
  return (
    <div className="shop-info">
      <p>
        <Phone size={15} />
        <a href={`tel:${shop.phone}`}>{shop.phone}</a>
      </p>
      <p>
        <MapPin size={15} />
        {shop.address}
      </p>
    </div>
  );
}
export function BookingReceipt({
  booking,
  token,
  shop,
  compact = false,
}: {
  booking: BookingView;
  token: string;
  shop: Catalog['shop'];
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(manageLink(token));
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกและคัดลอกลิงก์ด้านล่าง');
    }
  }
  function save() {
    const text = `${shop.name}\nใบนัด ${booking.reference}\n${dateLabel(booking.startAt)} ${time(booking.startAt)}–${time(booking.endAt)}\n${booking.staffName}\nคุณ ${booking.customerName}\n${booking.items.map((i) => `${i.name} ${money(i.price)}`).join('\n')}\nรวม ${money(booking.totalPrice)} · ${booking.totalDuration} นาที\nสถานะ: ${labels[booking.status]}\nจัดการนัด: ${manageLink(token)}\nติดต่อร้าน: ${shop.phone}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ใบนัด-${booking.reference}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="receipt">
      {!compact && (
        <>
          <span className="success-mark">
            <Check size={30} />
          </span>
          <p className="eyebrow">YOUR TIME IS RESERVED</p>
          <h1>จองเรียบร้อย แล้วพบกันครับ</h1>
          <p className="muted">เก็บลิงก์ส่วนตัวไว้ เพื่อดูหรือจัดการนัดได้ทุกเมื่อ</p>
        </>
      )}
      <div className="receipt-paper">
        <div className="row-between">
          <span className="eyebrow">{booking.reference}</span>
          <StatusBadge status={booking.status} />
        </div>
        <h2>{dateLabel(booking.startAt)}</h2>
        <p className="receipt-time">
          {time(booking.startAt)}–{time(booking.endAt)} <span>น.</span>
        </p>
        <p className="muted">
          {booking.staffName} · คุณ{booking.customerName}
        </p>
        <div className="receipt-items">
          {booking.items.map((i) => (
            <div className="row-between" key={i.serviceId}>
              <span>{i.name}</span>
              <span>{money(i.price)}</span>
            </div>
          ))}
        </div>
        <div className="row-between receipt-total">
          <span>รวม {booking.totalDuration} นาที</span>
          <strong>{money(booking.totalPrice)}</strong>
        </div>
      </div>
      <div className="actions">
        <Button onClick={copy}>{copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ส่วนตัว'}</Button>
        <Button variant="secondary" onClick={save}>
          บันทึกใบนัด
        </Button>
      </div>
      <label className="field link-field">
        ลิงก์ส่วนตัว — ผู้มีลิงก์นี้สามารถจัดการนัดของคุณได้
        <input
          readOnly
          value={typeof window === 'undefined' ? '' : manageLink(token)}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      {copyError && <p role="status">{copyError}</p>}
      <ShopInfo shop={shop} />
    </section>
  );
}
