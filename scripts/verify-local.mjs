import 'dotenv/config';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { pool } from '../server/db.js';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 8.48876, longitude: -13.23863, accuracy: 4 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5173/admin');
  await page.getByLabel('Email address').fill('test@tenkipay.test');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('heading', { name: 'Every response. A new possibility.' }).waitFor();
  await page.screenshot({ path: '.local/dashboard.png', fullPage: true });
  await page.getByRole('button', { name: 'Share form', exact: true }).click();
  await page.getByRole('img', { name: 'QR code linking to the TenkiPay questionnaire' }).waitFor();
  await page.getByLabel('Respondent link').fill('https://example.com/form');
  await page.waitForFunction(() => document.querySelector('.share-qr-image')?.src.startsWith('data:image/png'));
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download QR code' }).click();
  assert.equal((await downloadEvent).suggestedFilename(), 'tenkipay-questionnaire-qr.png');
  await page.getByRole('button', { name: 'Close dialog' }).click();

  assert.equal((await context.request.get('http://localhost:5173/api/health')).status(), 200);
  for (const format of ['csv', 'json', 'xlsx']) assert.equal((await context.request.get(`http://localhost:5173/api/admin/export/${format}`)).status(), 200);
  await page.goto('http://localhost:5173/form');
  await page.locator('input[name="consent"][value="Yes"]').check();
  await page.getByText('Outlet location captured', { exact: true }).waitFor();
  // Stub only the external write during browser QA; never publish an invented outlet.
  await page.route('**/api/public/adrehs', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'WAU QA TEST', district: 'WESTERN AREA URB', chiefdom: 'CENTRAL II', section: 'QA ONLY', publicConsent: true }) }));
  await page.getByLabel('The applicant agrees to add this outlet location to the publicly searchable Adrehs registry.').check();
  await page.getByRole('button', { name: 'Create Adrehs code', exact: true }).click();
  await page.getByText('WAU QA TEST', { exact: true }).waitFor();
  await page.screenshot({ path: '.local/form-location.png', fullPage: true });
  await page.locator('input[name="interest"][value="No"]').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[name="contactConsent"][value="No"]').check();
  await page.getByRole('button', { name: 'Review response' }).click();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await page.getByRole('heading', { name: 'Thank you. You’re all set.' }).waitFor();
  const [records] = await pool.query("SELECT id, answers FROM submissions WHERE JSON_UNQUOTE(JSON_EXTRACT(answers, '$.adrehs.code')) = 'WAU QA TEST'");
  assert.equal(records.length, 1);
  const answers = typeof records[0].answers === 'string' ? JSON.parse(records[0].answers) : records[0].answers;
  assert.equal(answers.outletGps.latitude, 8.48876); assert.equal(answers.adrehs.district, 'WESTERN AREA URB');
  // Remove only the exact QA record created by this run.
  await pool.execute('DELETE FROM submissions WHERE id = ?', [records[0].id]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/form');
  await page.getByText('Do you agree to take part in this questionnaire?', { exact: false }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '.local/form-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Verified admin login, exports, automatic GPS capture, Adrehs UI, saved MySQL location metadata and mobile layout. External creation mocked; QA record removed.');
} finally { await browser.close(); await pool.end(); }
