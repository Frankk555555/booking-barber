import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const day = (offset: number) => {
  const now = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
};
async function login(page: Page) {
  const credentials = JSON.parse(await readFile(resolve('.local/e2e-admin.json'), 'utf8')) as {
    email: string;
    password: string;
  };
  await page.goto('/admin');
  await page.getByLabel('อีเมล', { exact: true }).fill(credentials.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ตารางนัดหมาย', exact: true })).toBeVisible();
}
async function fillBooking(scope: Page | Locator, offset: number, customer: string) {
  await scope.getByRole('button', { name: /ตัดผม.*ออกแบบทรง/ }).click();
  await scope.getByRole('button', { name: /สระผม.*สระสะอาด/ }).click();
  await scope.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await scope.getByRole('button', { name: /ช่างต้น.*เลือกช่างคนนี้/ }).click();
  await scope.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await scope.getByLabel('เลือกวันที่', { exact: true }).fill(day(offset));
  await expect(scope.locator('.time-slot').first()).toBeVisible();
  await scope.locator('.time-slot').first().click();
  await scope.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await scope.getByLabel('ชื่อผู้จอง', { exact: true }).fill(customer);
  await scope.getByLabel('เบอร์โทรศัพท์', { exact: true }).fill('0812345678');
  await scope.getByRole('button', { name: 'ตรวจสอบนัด', exact: true }).click();
  await scope.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click();
  await expect(scope.getByRole('heading', { name: 'จองเรียบร้อย แล้วพบกันครับ' })).toBeVisible();
}
test('customer books, downloads receipt, reschedules and cancels using a private link', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await fillBooking(page, info.project.name === 'mobile' ? 2 : 1, `ลูกค้า ${info.project.name}`);
  await expect(page.locator('.receipt-total')).toContainText('350');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'บันทึกใบนัด', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toContain('BB-');
  const link = await page.locator('.link-field input').inputValue();
  expect(link).toMatch(/^http:\/\/localhost:3100\/booking\/manage#[A-Za-z0-9_-]{43}$/);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'นัดของคุณ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'เลื่อนนัด', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('เลือกวันที่').fill(day(info.project.name === 'mobile' ? 5 : 4));
  await expect(modal.locator('.time-slot').first()).toBeVisible();
  await modal.locator('.time-slot').first().click();
  await modal.getByRole('button', { name: 'ยืนยันเวลาใหม่' }).click();
  await expect(modal).not.toBeVisible();
  await page.reload();
  await expect(page.locator('.receipt-paper')).toContainText(`ลูกค้า ${info.project.name}`);
  await page.getByRole('button', { name: 'ยกเลิกนัด', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ยืนยันยกเลิกนัด' }).click();
  await expect(page.locator('.receipt-paper')).toContainText('ยกเลิกแล้ว');
  expect(errors).toEqual([]);
});
test('owner manages services, staff, shop settings and offline bookings', async ({
  page,
}, info) => {
  await login(page);
  await page.getByRole('button', { name: '+ เพิ่มนัด', exact: true }).click();
  await fillBooking(
    page.getByRole('dialog'),
    info.project.name === 'mobile' ? 8 : 7,
    `หน้าร้าน ${info.project.name}`,
  );
  await page.getByRole('dialog').getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await page.getByLabel('เริ่มวันที่').fill(day(info.project.name === 'mobile' ? 8 : 7));
  await expect(
    page.locator('.booking-card').filter({ hasText: `หน้าร้าน ${info.project.name}` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'รายสัปดาห์', exact: true }).click();
  await expect(page.locator('.calendar-column')).toHaveCount(7);
  await page.getByRole('button', { name: 'รายการ', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: 'บริการ', exact: true }).click();
  await page.getByRole('button', { name: '+ เพิ่มบริการ', exact: true }).click();
  const service = page.getByRole('dialog');
  await service.getByLabel('ชื่อบริการ').fill(`จัดแต่งทรง ${info.project.name}`);
  await service.getByLabel('ราคา (บาท)').fill('80');
  await service.getByLabel('ระยะเวลา (นาที)').fill('15');
  await service.getByRole('button', { name: 'บันทึกบริการ' }).click();
  await expect(
    page.locator('.management-row').filter({ hasText: `จัดแต่งทรง ${info.project.name}` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'ช่างและตารางงาน', exact: true }).click();
  await page.getByRole('button', { name: '+ เพิ่มช่าง', exact: true }).click();
  const staff = page.getByRole('dialog');
  await staff.getByLabel('ชื่อช่าง', { exact: true }).fill(`ช่างใหม่ ${info.project.name}`);
  await staff.getByLabel('แนะนำตัว').fill('ช่างทดสอบตารางงาน');
  await staff.getByLabel('ตัดผม', { exact: true }).check();
  await staff.getByRole('button', { name: 'บันทึกข้อมูลช่าง' }).click();
  await expect(
    page.locator('.staff-card').filter({ hasText: `ช่างใหม่ ${info.project.name}` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'ตั้งค่าร้าน', exact: true }).click();
  await page.getByRole('textbox', { name: 'ที่อยู่', exact: true }).fill('ร้านทดสอบ กรุงเทพมหานคร');
  await page.getByRole('button', { name: 'บันทึกการตั้งค่า' }).click();
  await expect(page.getByText('บันทึกการตั้งค่าแล้ว', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ตารางนัดหมาย', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ตั้งค่าร้าน', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'ที่อยู่', exact: true })).toHaveValue(
    'ร้านทดสอบ กรุงเทพมหานคร',
  );
});
test('responsive pages fit the viewport and render without browser errors', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'วันนี้ ให้เราดูแลอะไรดีครับ' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await mkdir(resolve('.local/previews'), { recursive: true });
  await page.screenshot({
    path: resolve(`.local/previews/booking-${info.project.name}.png`),
    fullPage: true,
  });
  await login(page);
  await page.getByLabel('เริ่มวันที่').fill(day(info.project.name === 'mobile' ? 8 : 7));
  await expect(page.locator('.booking-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: resolve(`.local/previews/admin-${info.project.name}.png`),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
