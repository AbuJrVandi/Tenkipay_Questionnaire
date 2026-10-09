import { pool, databaseDriver } from '../server/db.js';
import { registerAddress } from '../server/adrehs.js';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { isVisible } from '../shared/questionnaire.js';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let requestKey, registrationId;
try {
  assert.equal(databaseDriver, 'sqlite');
  const before = (await pool.query('SELECT COUNT(*) AS total FROM submissions'))[0][0].total;
  const context = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 8.48, longitude: -13.23, accuracy: 4 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5173/form?preview=1');
  await page.getByRole('heading', { name: 'TenkiPay Agent Network Profile and Experience Questionnaire', exact: true }).waitFor();
  await page.locator('input[name="consent"][value="Yes"]').check();
  await page.getByText('Outlet location captured', { exact: true }).waitFor();
  const businessName = page.getByRole('textbox', { name: 'Registered agent / business name', exact: true });
  await businessName.pressSequentially('TenkiPay Agent Outlet');
  assert.equal(await businessName.inputValue(), 'TenkiPay Agent Outlet');
  await businessName.press('Space');
  assert.equal(await businessName.inputValue(), 'TenkiPay Agent Outlet ');
  await page.locator('input[name="net_idStatus"][value="Unavailable — requires verification"]').check();
  assert.equal(await page.locator('#question-net_agentId').count(), 0);
  await page.locator('input[name="net_multipleOutlets"][value="Yes"]').check();
  await page.locator('#question-net_outletCount').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '.local/network-profile-mobile.png', fullPage: true });
  // Submit a complete local QA profile, including a stored mocked Adrehs registration.
  await page.goto('http://localhost:5173/form');
  await page.getByRole('heading', { name: 'TenkiPay Agent Network Profile and Experience Questionnaire', exact: true }).waitFor();
  const definition = await (await context.request.get('http://localhost:5173/api/public/questionnaire')).json();
  const qaAddress = await registerAddress({ latitude: 8.48, longitude: -13.23, accuracy: 4 }, pool, async () => ({ ok: true, json: async () => ({ digital_id: 'WAU QA SQLITE', code: 'QA SQLITE', address: 'Temporary SQLite test address' }) }));
  registrationId = qaAddress.registrationId;
  await page.route('**/api/public/adrehs', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(qaAddress) }));
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/public/submissions')) requestKey = request.postDataJSON().requestKey; });
  const answers = { consent: 'Yes', outletGps: { latitude: 8.48, longitude: -13.23, accuracy: 4 } };
  await page.locator('input[name="consent"][value="Yes"]').check();
  await page.getByText('Outlet location captured', { exact: true }).waitFor();
  await page.getByLabel('The respondent confirms this outlet location and agrees to add it to the publicly searchable Adrehs registry.').check();
  await page.getByRole('textbox', { name: 'Adrehs address code', exact: true }).waitFor();
  for (const section of definition.sections) {
    for (const q of definition.questions.filter(q => q.section === section.id)) {
      if (!q.required || !isVisible(q, answers) || ['consent', 'outletGps'].includes(q.id)) continue;
      const field = page.locator(`#question-${q.id}`);
      if (q.options) {
        const value = q.id === 'net_revenueCollection' ? 'No' : q.options[0];
        answers[q.id] = q.type === 'multi' ? [value] : value;
        if (q.type === 'select') await field.locator('select').selectOption(value);
        else await field.locator('input').filter({ hasNot: page.locator('.other-input input') }).first().check();
        if (q.id === 'net_revenueCollection') await field.locator('input[value="No"]').check();
      } else {
        const value = q.type === 'date' ? '2026-10-01' : q.type === 'month' ? '2025-01' : q.type === 'time' ? '09:00' : q.type === 'number' ? String(q.min || 0) : q.type === 'tel' ? '+23276123456' : 'QA preview';
        answers[q.id] = value;
        await field.locator(q.type === 'textarea' ? 'textarea' : 'input').fill(value);
      }
    }
    await page.getByRole('button', { name: section.id === 'G' ? 'Review response' : 'Continue', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Submit response', exact: true }).click();
  await page.locator('.receipt').waitFor();
  const savedResponse = (await pool.execute('SELECT * FROM submissions WHERE request_key = ?', [requestKey]))[0][0];
  assert.ok(savedResponse);
  const savedAnswers = JSON.parse(savedResponse.answers);
  assert.equal(savedAnswers.adrehs.code, 'WAU QA SQLITE');
  assert.equal(savedAnswers.adrehs.address, 'Temporary SQLite test address');
  assert.equal(savedAnswers.outletGps.latitude, 8.48);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:5173/admin');
  await page.getByLabel('Email address').fill('test@tenkipay.test');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByText('Profile responses', { exact: true }).waitFor();
  const stats = await context.request.get('http://localhost:5173/api/admin/analytics?from=2026-01-01');
  assert.equal(stats.status(), 200);
  assert.equal((await stats.json()).total, before + 1);
  const found = await context.request.get('http://localhost:5173/api/admin/responses?search=QA');
  assert.equal(found.status(), 200);
  assert.equal((await found.json()).total, 1);
  assert.equal((await pool.query('SELECT COUNT(*) AS total FROM submissions'))[0][0].total, before + 1);
  await page.getByRole('button', { name: 'Questionnaire', exact: true }).click();
  await page.locator('#edit-outletGps').waitFor();
  assert.ok(await page.locator('#edit-outletGps').evaluate(el => el.readOnly));
  await page.locator('.editor-tabs button').filter({ hasText: 'Overall experience' }).click();
  await page.locator('#edit-net_verifiedBy').waitFor();
  await page.screenshot({ path: '.local/network-profile-editor.png', fullPage: true });
  const saved = await (await context.request.get('http://localhost:5173/api/admin/questionnaire')).json();
  assert.equal(saved.template, 'existing-agent-network');
  assert.equal(saved.questions[1].id, 'outletGps');
  const invalid = await context.request.put('http://localhost:5173/api/admin/questionnaire', { headers: { origin: 'http://localhost:5173', 'x-tenkipay-client': 'web' }, data: { ...saved, questions: saved.questions.map(q => q.id === 'outletGps' ? { ...q, required: false } : q) } });
  assert.equal(invalid.status(), 422);
  for (const format of ['csv', 'json', 'xlsx']) assert.equal((await context.request.get(`http://localhost:5173/api/admin/export/${format}`)).status(), 200);
  assert.deepEqual(errors, []);
  console.log('Verified complete live-form submission persisted in SQLite with GPS and Adrehs details; response search and analytics include it, exports work. External Adrehs creation was mocked; exact local QA data removed.');
} finally {
  if (requestKey) await pool.execute('DELETE FROM submissions WHERE request_key = ?', [requestKey]);
  if (registrationId) await pool.execute('DELETE FROM adrehs_registrations WHERE id = ?', [registrationId]);
  await browser.close(); await pool.end();
}
