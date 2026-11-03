# Booking Barber · ละมุน บาร์เบอร์

เว็บจองคิวภาษาไทยสำหรับร้านเดียว สาขาเดียว รองรับมือถือ ลูกค้าจองหลายบริการกับช่างคนเดียว และใช้ลิงก์ส่วนตัวเพื่อดู เลื่อน หรือยกเลิกนัด เจ้าของร้านจัดการบริการ ช่าง ตารางงาน และคิวหน้าร้านได้ในระบบเดียวกัน

## เทคโนโลยี

Next.js **15.5.28** App Router, React 19, TypeScript, Tailwind CSS v4 + native cascade layers, TanStack Query / Form / Table, Elysia บน Bun, Eden Treaty, PostgreSQL 18, Drizzle ORM (`pg`) และ Better Auth

แพ็กเกจที่ติดตั้งถูกล็อกเวอร์ชันไว้ใน `package.json` และ `bun.lock` ใช้ `bun install --frozen-lockfile` เพื่อให้ได้ชุดเดียวกัน

## เริ่มใช้งานบน Windows

ต้องมี Bun 1.4.4+, Node.js 22+ และ PostgreSQL 18 พร้อม command-line tools ตัวแอปไม่ต้องใช้ Docker

### เครื่องนี้ — เตรียมข้อมูลไว้แล้ว

```powershell
bun run db:start
bun run dev
```

เปิด <http://localhost:3000> และหลังร้าน <http://localhost:3000/admin> ใช้ `localhost` ตามนี้เพื่อให้ origin และ cookie ตรงกัน

อีเมลและรหัสผ่านแอดมินที่สุ่มสร้างให้เครื่องนี้อยู่ใน **`.local/admin-credentials.txt`** ไม่ได้ฝังในโค้ดและไม่เข้า Git

PostgreSQL ของแอปแยกเป็น cluster ใน `.local/postgres-data` รับเฉพาะ loopback บนพอร์ต **5433** ไม่เปลี่ยนแปลง PostgreSQL เดิมที่พอร์ต 5432 เครื่องนี้ยังไม่ได้ลงทะเบียน cluster ใหม่เป็น Windows service เพราะต้องใช้สิทธิ์ Windows Administrator จึงใช้ `db:start` หลังเปิดเครื่อง และ `db:stop` เมื่อต้องการหยุด ส่วนข้อมูลเก็บถาวรบนดิสก์

### เครื่องใหม่ — สร้าง cluster แยก

ติดตั้ง PostgreSQL 18 จาก [ผู้พัฒนา](https://www.postgresql.org/download/windows/) พร้อม command-line tools ก่อน แล้วรันจากโฟลเดอร์โปรเจกต์:

```powershell
bun install --frozen-lockfile
powershell -NoProfile -File scripts/setup-postgres.ps1
bun run db:setup
bun run db:migrate
bun scripts/migrate.ts --test
bun run db:seed
bun run admin:dev
bun run dev
```

สคริปต์ใช้เครื่องมือที่ `C:\Program Files\PostgreSQL\18\bin` และพอร์ต 5433; หากใช้ตำแหน่งอื่นให้ปรับ `$pgBin` / `$pgCtl` ในสคริปต์ PostgreSQL สคริปต์จะลองลงทะเบียน service `booking-barber-postgresql` หากมีสิทธิ์ Administrator มิฉะนั้นเริ่มเป็น process ของผู้ใช้

`db:setup` สร้าง role เฉพาะแอปที่ไม่มีสิทธิ์ superuser, ฐานข้อมูล `booking_barber` และ `booking_barber_test` พร้อม `.env` โดยไม่พิมพ์รหัสผ่านออกมา และปฏิเสธการเขียนทับ role / ฐานข้อมูล / `.env` เดิม

หากมี PostgreSQL ของตนเอง ให้สร้างฐานข้อมูลพัฒนาและทดสอบแยกกัน ติดตั้ง extension `btree_gist` แล้วคัดลอก `.env.example` เป็น `.env` ตั้ง connection URLs และ `BETTER_AUTH_SECRET` แบบสุ่มอย่างน้อย 32 ตัวอักษร จากนั้นเริ่มที่ `db:migrate` ไม่ต้องรัน `setup-postgres.ps1` หรือ `db:setup`

## คำสั่งที่ใช้บ่อย

| คำสั่ง                                       | การทำงาน                                                     |
| -------------------------------------------- | ------------------------------------------------------------ |
| `bun run dev`                                | เปิด API 3001 และ Next.js 3000 แบบพัฒนา                      |
| `bun run build`                              | สร้าง production frontend                                    |
| `bun run start`                              | เปิด API และ frontend จาก build ที่สร้างไว้                  |
| `bun run db:start` / `bun run db:stop`       | เริ่ม / หยุดเฉพาะ cluster ของโปรเจกต์                        |
| `bun run db:generate` / `bun run db:migrate` | สร้าง / ใช้ migration                                        |
| `bun run db:seed`                            | เพิ่มข้อมูลตั้งต้น โดยไม่เขียนทับร้านที่มีข้อมูลแล้ว         |
| `bun run admin:dev`                          | สร้างแอดมิน local ด้วยรหัสผ่านสุ่ม หากยังไม่มี               |
| `bun run admin:create`                       | สร้างแอดมินจาก `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` |
| `bun run admin:reset`                        | เปลี่ยนรหัสผ่านจาก environment และยกเลิก session เดิม        |
| `bun run db:backup`                          | สำรองฐานข้อมูลเป็นไฟล์ `.dump`                               |

API อยู่ใน `apps/api`, frontend อยู่ใน `apps/web`, schema และ migration อยู่ใน `packages/db` กติกาการจองอยู่ที่ API เท่านั้น Frontend ติดต่อผ่าน Eden Treaty และ Next.js rewrite `/api/*` โดยไม่เข้าถึงฐานข้อมูลโดยตรง

## การใช้งาน

1. เข้าหลังร้าน ตั้งชื่อร้าน เบอร์ติดต่อ ที่อยู่ เวลาเปิดร้าน และกติกาการจอง
2. เพิ่มหรือแก้ไขบริการ ราคา และระยะเวลา แล้วกำหนดบริการที่ช่างแต่ละคนทำได้
3. ตั้งเวลาทำงาน เวลาพัก และวันหยุด การเปลี่ยนเวลาที่ชนกับนัดเดิมจะถูกปฏิเสธพร้อมเลขนัดที่ต้องจัดการก่อน
4. ลูกค้าเลือกบริการ ช่าง วัน/เวลาว่าง กรอกชื่อและเบอร์ แล้วตรวจสอบก่อนยืนยัน ร้านเพิ่มนัดจากโทรศัพท์หรือหน้าร้านได้ด้วยปุ่ม “เพิ่มนัด”
5. หน้ายืนยันมีปุ่มคัดลอกลิงก์ส่วนตัว และดาวน์โหลดใบนัด `.txt` ไม่มีการส่ง SMS/LINE อัตโนมัติ หากลิงก์หายให้ติดต่อร้าน; แอดมินคัดลอกลิงก์ให้ลูกค้าจากรายละเอียดนัดได้
6. ลูกค้าเลื่อนเวลาโดยคงบริการและช่างเดิม หรือยกเลิกได้ก่อนนัดอย่างน้อย 2 ชั่วโมงตามค่าเริ่มต้น หลังเส้นตายให้ติดต่อร้าน
7. แอดมินเปลี่ยนสถานะจากยืนยันแล้ว → กำลังให้บริการ → เสร็จสิ้น หรือยกเลิก / ไม่มาตามนัด เริ่มบริการและทำเครื่องหมายไม่มาตามนัดได้เมื่อถึงเวลานัดแล้ว

## กติกาและความถูกต้อง

- แสดงเวลาประเทศไทย เก็บ timestamp แบบมี timezone และจำนวนเงินเป็นสตางค์
- เริ่มทุก 15 นาที จองล่วงหน้า 30 วัน ค่าเหล่านี้ปรับได้ในหลังร้าน
- รวมระยะเวลาบริการ ต้องว่างต่อเนื่องทั้งร้านและช่าง หักเวลาพัก / วันหยุด / นัดเดิม ช่วงติดกันอนุญาตให้เริ่มตรงเวลาที่นัดก่อนหน้าจบ
- ยังไม่มีเวลาพักคั่นอัตโนมัติและตารางงานข้ามเที่ยงคืน
- ตรวจเวลาซ้ำภายใน transaction ตอนยืนยัน ใช้ advisory transaction lock สำหรับการเปลี่ยนปฏิทินร้าน และ PostgreSQL GiST exclusion constraint ป้องกันช่วงเวลาทับกันอีกชั้น
- การเลื่อนนัดเป็น atomic ถ้าเวลาใหม่ไม่ว่าง นัดเดิมยังอยู่ การส่งคำขอซ้ำใช้ idempotency key เพื่อไม่สร้างนัดเพิ่ม
- ราคาและเวลาคำนวณที่ API เก็บ snapshot ของบริการในนัด การเปลี่ยนหรือปิดบริการไม่เปลี่ยนนัดเดิม
- ลิงก์จัดการนัดมี token ที่คาดเดาไม่ได้ อยู่ใน URL fragment ซึ่งไม่ส่งไปยังเว็บเซิร์ฟเวอร์ ใช้ Authorization header ติดต่อ API และเก็บเฉพาะ hash ในฐานข้อมูล ห้ามแชร์ลิงก์ให้ผู้ที่ไม่ควรจัดการนัด
- API ไม่บันทึก request body, token หรือเบอร์โทรใน log; มี rate limit, origin check, session และปิด public sign-up
- ไม่มีขั้นตอนสมัครลูกค้าและยังไม่ยืนยันว่าเบอร์โทรเป็นของผู้จอง เหมาะกับขอบเขต local v1 ที่ตกลงกัน

## ตรวจสอบระบบ

```powershell
bun run typecheck
bun run lint
bun run test
bun run test:integration
bunx playwright install chromium
bun run test:e2e
bun run build
```

Integration / browser tests ใช้เฉพาะฐานข้อมูลชื่อ `booking_barber_test` ตาม `TEST_DATABASE_URL` และต้องต่างจาก `DATABASE_URL` สคริปต์ปฏิเสธชื่ออื่น มีการล้างข้อมูล **เฉพาะฐานข้อมูลทดสอบนี้** อย่าเก็บข้อมูลจริงในฐานข้อมูลทดสอบ และอย่ารัน integration กับ browser tests พร้อมกัน

Playwright เปิดระบบทดสอบแยกบนเว็บ 3100 / API 3101 และใช้ `.next-e2e` แยกจาก build ปกติ ทดสอบเส้นทางลูกค้าและเจ้าของร้านทั้ง desktop และ mobile พร้อมภาพตัวอย่างใน `.local/previews` รายงาน HTML อยู่ใน `playwright-report`

## สำรองและกู้คืน

```powershell
bun run db:backup
bun scripts/restore.ts .\backups\booking-barber-YYYYMMDD-HHMMSS.dump booking_barber_restore_manual
```

สคริปต์กู้คืนสร้างได้เฉพาะฐานข้อมูล **ใหม่** ชื่อขึ้นต้น `booking_barber_restore_` และไม่เขียนทับฐานข้อมูลที่มีอยู่ ใช้ connection ผู้ดูแลจาก `.local/postgres-admin.url` หรือ `PG_ADMIN_URL`; ถ้า `pg_restore` อยู่ที่อื่นให้ตั้ง `PG_RESTORE_PATH`

หลังตรวจข้อมูลที่กู้คืนแล้ว เปลี่ยนเฉพาะชื่อฐานข้อมูลใน `DATABASE_URL` ของ `.env` เป็นฐานข้อมูลใหม่ จากนั้นรีสตาร์ตแอป เก็บ `.env`, `.local/postgres-admin.url` และ `.local/postgres-admin.password` ไว้เป็นความลับ สำรอง `BETTER_AUTH_SECRET` แยกอย่างปลอดภัยด้วยเพื่อให้ยังสร้างลิงก์นัดเดิมซ้ำได้

ไฟล์สำรองมีข้อมูลลูกค้า ควรเก็บในพื้นที่ส่วนตัวและทดสอบกู้คืนเป็นระยะ การสำรองแบบ `.dump` เก็บ schema / ข้อมูล / migration history แต่บัญชี PostgreSQL เป็นระดับ cluster ต้องสร้าง role เจ้าของฐานข้อมูลก่อนหากย้ายเครื่อง

## ขอบเขตเวอร์ชันนี้

ทำงาน local เท่านั้น ยังไม่มีการ deploy, ชำระเงิน, มัดจำ, SMS/LINE, บัญชีลูกค้า/ช่าง หรือหลายสาขา ควรตัดสินใจเรื่อง hosting, HTTPS, การส่งลิงก์, การยืนยันเบอร์ และนโยบายเก็บข้อมูลก่อนเปิดให้บุคคลทั่วไปใช้งานออนไลน์
