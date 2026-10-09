import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { isVisible } from '../shared/questionnaire.js';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
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
  // Complete a preview through all seven sections without creating a response.
  await page.goto('http://localhost:5173/form?preview=1');
  await page.getByRole('heading', { name: 'TenkiPay Agent Network Profile and Experience Questionnaire', exact: true }).waitFor();
  const definition = await (await context.request.get('http://localhost:5173/api/public/questionnaire')).json();
  const answers = { consent: 'Yes', outletGps: { latitude: 8.48, longitude: -13.23, accuracy: 4 } };
  await page.locator('input[name="consent"][value="Yes"]').check();
  await page.getByText('Outlet location captured', { exact: true }).waitFor();
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
  await page.getByText('PREVIEW COMPLETE', { exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:5173/admin');
  await page.getByLabel('Email address').fill('test@tenkipay.test');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByText('Profile responses', { exact: true }).waitFor();
  const stats = await context.request.get('http://localhost:5173/api/admin/analytics?from=2026-01-01');
  assert.equal(stats.status(), 200);
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
  console.log('Verified live questionnaire, GPS capture, conditional identification fields, mobile layout, admin editor, location API protection, date-filtered analytics and exports. No responses or external Adrehs registrations created.');
} finally { await browser.close(); }
