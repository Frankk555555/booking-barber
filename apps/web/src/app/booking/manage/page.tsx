'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, today } from '../../../lib/client';
import {
  Header,
  Loading,
  ErrorNotice,
  Button,
  BookingReceipt,
  Modal,
} from '../../../components/ui';
import { SlotPicker } from '../../../components/slots';
export default function ManagePage() {
  const client = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [slot, setSlot] = useState('');
  const [action, setAction] = useState<'move' | 'cancel' | null>(null);
  useEffect(() => {
    setToken(window.location.hash.slice(1));
  }, []);
  const headers = { authorization: `Bearer ${token}` };
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => unwrap(api.api.catalog.get()) });
  const query = useQuery({
    queryKey: ['manage', token],
    queryFn: () => unwrap(api.api.manage.get({ headers })),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
    refetchInterval: 30000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      action === 'cancel'
        ? unwrap(api.api.manage.cancel.post(undefined, { headers }))
        : unwrap(api.api.manage.reschedule.post({ startAt: slot }, { headers })),
    onSuccess: () => {
      setAction(null);
      setSlot('');
      void client.invalidateQueries({ queryKey: ['manage', token] });
      void client.invalidateQueries({ queryKey: ['slots'] });
    },
    onError: () => {
      setSlot('');
      void client.invalidateQueries({ queryKey: ['slots'] });
      void client.invalidateQueries({ queryKey: ['manage', token] });
    },
  });
  return (
    <>
      <Header />
      <main className="manage-shell">
        {token === null ? (
          <Loading />
        ) : !token ? (
          <ErrorNotice
            error={new Error('ไม่พบลิงก์ส่วนตัว กรุณาเปิดลิงก์ที่ได้รับหลังจอง หรือติดต่อร้าน')}
          />
        ) : query.isPending || catalog.isPending ? (
          <Loading />
        ) : query.error || catalog.error ? (
          <ErrorNotice error={query.error ?? catalog.error} />
        ) : query.data && catalog.data ? (
          <>
            <p className="eyebrow">YOUR APPOINTMENT</p>
            <h1>นัดของคุณ</h1>
            <BookingReceipt
              booking={query.data.booking}
              token={token}
              shop={catalog.data.shop}
              compact
            />
            <div className="manage-actions">
              {query.data.canChange ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      mutation.reset();
                      setAction('move');
                    }}
                  >
                    เลื่อนนัด
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      mutation.reset();
                      setAction('cancel');
                    }}
                  >
                    ยกเลิกนัด
                  </Button>
                </>
              ) : (
                <p className="notice">
                  {query.data.booking.status === 'confirmed'
                    ? `แก้ไขนัดเองได้ก่อนเวลาอย่างน้อย ${query.data.cutoffHours} ชั่วโมง หากต้องการเปลี่ยนแปลง กรุณาติดต่อร้าน`
                    : 'นัดนี้ไม่สามารถแก้ไขผ่านเว็บไซต์ได้แล้ว'}
                </p>
              )}
            </div>
            {action && (
              <Modal
                title={action === 'cancel' ? 'ยืนยันการยกเลิกนัด' : 'เลือกเวลาใหม่'}
                onClose={() => {
                  if (!mutation.isPending) setAction(null);
                }}
              >
                <ErrorNotice error={mutation.error} />
                {action === 'move' ? (
                  <SlotPicker
                    staffId={query.data.booking.staffId}
                    serviceIds={[]}
                    existing={query.data.booking}
                    token={token}
                    date={date}
                    onDate={setDate}
                    value={slot}
                    onChange={setSlot}
                    horizonDays={catalog.data.shop.horizonDays}
                  />
                ) : (
                  <p>
                    เมื่อยกเลิกแล้ว ช่วงเวลานี้จะเปิดให้ผู้อื่นจอง และไม่สามารถคืนสถานะนัดเดิมได้
                  </p>
                )}
                <div className="actions">
                  <Button
                    variant="secondary"
                    disabled={mutation.isPending}
                    onClick={() => setAction(null)}
                  >
                    กลับ
                  </Button>
                  <Button
                    variant={action === 'cancel' ? 'danger' : 'primary'}
                    disabled={mutation.isPending || (action === 'move' && !slot)}
                    onClick={() => mutation.mutate()}
                  >
                    {mutation.isPending
                      ? 'กำลังบันทึก…'
                      : action === 'cancel'
                        ? 'ยืนยันยกเลิกนัด'
                        : 'ยืนยันเวลาใหม่'}
                  </Button>
                </div>
              </Modal>
            )}
          </>
        ) : null}
      </main>
    </>
  );
}
