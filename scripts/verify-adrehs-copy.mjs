import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ permissions: ['geolocation', 'clipboard-read', 'clipboard-write'], geolocation: { latitude: 8.48, longitude: -13.23, accuracy: 4 } });
  const page = await context.newPage();
  let registrations = 0;
  await page.route('**/api/public/adrehs', async route => {
    registrations++;
    const request = route.request().postDataJSON();
    assert.equal(request.publicConsent, true);
    assert.equal(request.gps.latitude, 8.48);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'WAU QA COPY', shortCode: 'QA COPY', address: 'QA address only', publicConsent: true, registrationId: 'qa-only' }) });
  });
  await page.goto('http://localhost:5173/form');
  await page.locator('input[name="consent"][value="Yes"]').check();
  await page.getByText('Outlet location captured', { exact: true }).waitFor();
  assert.equal(registrations, 0);
  await page.getByLabel('The respondent confirms this outlet location and agrees to add it to the publicly searchable Adrehs registry.').check();
  const code = page.getByRole('textbox', { name: 'Adrehs address code', exact: true });
  await code.waitFor();
  assert.equal(await code.inputValue(), 'WAU QA COPY');
  assert.equal(registrations, 1);
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'WAU QA COPY');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log('Verified confirmation-triggered generation, visible address code, clipboard copy and mobile layout. Adrehs response mocked; no external address or questionnaire record created.');
} finally { await browser.close(); }
