import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('booking keeps totals near mobile actions and focuses steps and invalid fields', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: /ตัดผม.*ออกแบบทรง/ }).click();
  const total = page.locator('.mobile-booking-total');
  if (info.project.name === 'mobile') {
    for (const width of [320, 390, 760]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(total).toBeVisible();
      await expect(total).toContainText('1 บริการ · 30 นาที');
      await expect(total).toContainText('250');
      const summaryBox = await total.boundingBox();
      const actionsBox = await page.locator('.step-actions').boundingBox();
      expect(actionsBox!.y - (summaryBox!.y + summaryBox!.height)).toBeLessThanOrEqual(20);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
  } else {
    await expect(total).toBeHidden();
  }
  await mkdir(resolve('.local/previews'), { recursive: true });
  await page.screenshot({
    path: resolve(`.local/previews/booking-total-${info.project.name}.png`),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await expect(page.locator('.step-heading')).toBeFocused();
  await expect(page.locator('.step-heading')).toContainText('ขั้นที่ 2 จาก 5');
  await page.getByRole('button', { name: /ช่างต้น.*เลือกช่างคนนี้/ }).click();
  await page.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  const future = new Date(Date.now() + 15 * 86400000);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(future);
  await page.getByLabel('เลือกวันที่', { exact: true }).fill(date);
  await page.locator('.time-slot').first().click();
  await page.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await expect(page.locator('.step-heading')).toBeFocused();
  await page.getByRole('button', { name: 'ตรวจสอบนัด', exact: true }).click();
  const name = page.getByLabel('ชื่อผู้จอง', { exact: true });
  const phone = page.getByLabel('เบอร์โทรศัพท์', { exact: true });
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription('กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร');
  await name.fill('ลูกค้าทดสอบ');
  await phone.fill('123');
  await page.getByRole('button', { name: 'ตรวจสอบนัด', exact: true }).click();
  await expect(phone).toBeFocused();
  await expect(phone).toHaveAccessibleDescription('กรุณากรอกเบอร์โทรให้ถูกต้อง');
  await page.screenshot({
    path: resolve(`.local/previews/booking-error-${info.project.name}.png`),
    fullPage: true,
  });
  await phone.fill('0812345678');
  await page.getByRole('button', { name: 'ตรวจสอบนัด', exact: true }).click();
  await expect(page.locator('.step-heading')).toBeFocused();
  await expect(page.locator('.confirmation')).toContainText('0812345678');
});
