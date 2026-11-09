'use client';
import { Suspense, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Scissors, Users, Settings2, LogOut, LockKeyhole } from 'lucide-react';
import { authClient, api, unwrap } from '../../lib/client';
import { useAdminNavigation } from '../../lib/admin-navigation';
import { Header, Loading, ErrorNotice, Button } from '../../components/ui';
import { BookingsPanel } from '../../components/admin-bookings';
import { ServicesPanel, StaffPanel, SettingsPanel } from '../../components/admin-settings';
import './admin.css';
export default function AdminPage() {
  return (
    <div className="customer-experience admin-experience">
      <Suspense fallback={<Loading />}>
        <AdminContent />
      </Suspense>
    </div>
  );
}
function AdminContent() {
  const session = authClient.useSession();
  return (
    <>
      <Header admin />
      {session.isPending ? (
        <Loading />
      ) : session.error ? (
        <main className="manage-shell">
          <ErrorNotice error={session.error} />
          <Button
            onClick={() => {
              void session.refetch();
            }}
          >
            ลองอีกครั้ง
          </Button>
        </main>
      ) : !session.data ? (
        <Login />
      ) : (
        <Dashboard name={session.data.user.name} />
      )}
    </>
  );
}
function Login() {
  const mutation = useMutation({
    mutationFn: async (value: { email: string; password: string }) => {
      const result = await authClient.signIn.email(value);
      if (result.error)
        throw new Error(
          result.error.status === 429
            ? 'ทำรายการถี่เกินไป กรุณารอสักครู่'
            : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        );
    },
  });
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value).catch(() => {});
    },
  });
  return (
    <main className="login-shell">
      <span className="login-icon">
        <LockKeyhole size={26} />
      </span>
      <h1>ดูแลทุกนัด จากที่เดียว</h1>
      <p className="muted">เข้าสู่ระบบสำหรับเจ้าของร้านและผู้ดูแล</p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <ErrorNotice error={mutation.error} />
        <form.Field name="email">
          {(field) => (
            <label className="field">
              อีเมล
              <input
                type="email"
                autoComplete="username"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <label className="field">
              รหัสผ่าน
              <input
                type="password"
                autoComplete="current-password"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <Button disabled={mutation.isPending}>
          {mutation.isPending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
      <p className="small muted">หากลืมรหัสผ่าน ให้ผู้ดูแลเครื่องใช้คำสั่ง admin:reset ตามคู่มือ</p>
    </main>
  );
}
function Dashboard({ name }: { name: string }) {
  const client = useQueryClient();
  const { params, update } = useAdminNavigation();
  const requestedTab = params.get('tab') ?? '';
  const tab = ['services', 'staff', 'settings'].includes(requestedTab) ? requestedTab : 'bookings';
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: () => unwrap(api.api.admin.catalog.get()),
    refetchInterval: 30000,
  });
  const logout = useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut();
      if (result.error) throw new Error('ออกจากระบบไม่สำเร็จ');
      client.clear();
    },
  });
  const tabs = [
    { id: 'bookings', label: 'นัดหมาย', icon: CalendarDays },
    { id: 'services', label: 'บริการ', icon: Scissors },
    { id: 'staff', label: 'ช่างและตารางงาน', icon: Users },
    { id: 'settings', label: 'ตั้งค่าร้าน', icon: Settings2 },
  ];
  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>{query.data?.shop.name ?? 'จัดการร้าน'}</h1>
          <p className="muted">สวัสดี {name}</p>
        </div>
        <Button variant="secondary" disabled={logout.isPending} onClick={() => logout.mutate()}>
          <LogOut size={16} />
          ออกจากระบบ
        </Button>
      </div>
      <nav className="admin-tabs" aria-label="เมนูจัดการร้าน">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            className={tab === id ? 'selected' : ''}
            onClick={() => update({ tab: id })}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      <div className="workspace-feedback" role="status" aria-live="polite" aria-atomic="true">
        {notice && <p className="notice">{notice}</p>}
      </div>
      <ErrorNotice error={logout.error} />
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="admin-content">
          {tab === 'bookings' ? (
            <BookingsPanel catalog={query.data} />
          ) : tab === 'services' ? (
            <ServicesPanel data={query.data} onSaved={setNotice} />
          ) : tab === 'staff' ? (
            <StaffPanel data={query.data} onSaved={setNotice} />
          ) : (
            <SettingsPanel data={query.data} />
          )}
        </div>
      )}
    </main>
  );
}
