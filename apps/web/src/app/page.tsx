import { BookingFlow } from '../components/booking-flow';
import { Header } from '../components/ui';
export default function Home() {
  return (
    <div className="customer-experience">
      <Header />
      <main className="page-shell">
        <section className="intro">
          <div>
            <h1>จองคิวตัดผม</h1>
            <p>เลือกบริการที่ชอบ แล้วเลือกช่างและเวลาที่สะดวก</p>
          </div>
          <p className="intro-note">
            ไม่ต้องสมัครสมาชิก
            <br />
            ชำระค่าบริการที่ร้านในวันนัด
          </p>
        </section>
        <BookingFlow />
        <footer className="site-footer">
          <span>ละมุน บาร์เบอร์</span>
          <span>ใส่ใจทุกทรง เคารพทุกเวลา</span>
        </footer>
      </main>
    </div>
  );
}
