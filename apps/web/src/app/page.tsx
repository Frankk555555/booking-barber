import { BookingFlow } from '../components/booking-flow';
import { Header } from '../components/ui';
export default function Home() {
  return (
    <>
      <Header />
      <main className="page-shell">
        <section className="intro">
          <p className="eyebrow">
            <span className="tiny-line" /> A LITTLE TIME, JUST FOR YOU
          </p>
          <h1>
            จองเวลาสำหรับ<span>ตัวคุณเอง</span>
          </h1>
          <p>ทรงผมที่ชอบ กับเวลาที่ใช่ เลือกนัดของคุณได้เลย</p>
        </section>
        <BookingFlow />
        <footer className="site-footer">
          <span>ละมุน บาร์เบอร์</span>
          <span>ใส่ใจทุกทรง เคารพทุกเวลา</span>
        </footer>
      </main>
    </>
  );
}
