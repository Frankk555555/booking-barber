import type { Metadata } from 'next';
import { Providers } from '../components/providers';
import './globals.css';
import './customer.css';
export const metadata: Metadata = {
  title: 'ละมุน บาร์เบอร์ | จองเวลาสำหรับคุณ',
  description: 'เลือกบริการ ช่าง และเวลาที่สะดวก จองคิวตัดผมได้ง่าย ไม่ต้องสมัครสมาชิก',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
