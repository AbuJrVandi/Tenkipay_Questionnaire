import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext();
const ids = [];
const headers = { origin: 'http://localhost:5173', 'x-tenkipay-client': 'web' };
try {
  const page = await context.newPage();
  await page.goto('http://localhost:5173/admin');
  await page.getByLabel('Email address').fill('test@tenkipay.test');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByText('Profile responses', { exact: true }).waitFor();
  const before = await (await context.request.get('http://localhost:5173/api/admin/responses')).json();
  const schema = await (await context.request.get('http://localhost:5173/api/public/questionnaire')).json();
  for (let i = 0; i < 3; i++) {
    const requestKey = randomUUID();
    const payload = { version: schema.version, requestKey, answers: { consent: 'No' } };
    const submitted = await context.request.post('http://localhost:5173/api/public/submissions', { headers, data: payload });
    assert.equal(submitted.status(), 201);
    ids.push((await submitted.json()).id);
    const retry = await context.request.post('http://localhost:5173/api/public/submissions', { headers, data: payload });
    assert.equal((await retry.json()).id, ids.at(-1));
  }
  await page.getByRole('button', { name: /^Responses/ }).click();
  await page.getByRole('button', { name: 'Show latest', exact: true }).click();
  await page.getByLabel(`Select response ${ids[0]}`, { exact: true }).waitFor();
  assert.equal((await context.request.put(`http://localhost:5173/api/admin/responses/${ids[0]}`, { headers, data: { answers: {} } })).status(), 404);
  await page.getByRole('button', { name: `Delete response ${ids[0]}`, exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await page.getByLabel(`Select response ${ids[0]}`, { exact: true }).waitFor({ state: 'detached' });
  for (const id of ids.slice(1)) await page.getByLabel(`Select response ${id}`, { exact: true }).check();
  await page.getByRole('button', { name: 'Delete selected (2)', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  for (const id of ids.slice(1)) await page.getByLabel(`Select response ${id}`, { exact: true }).waitFor({ state: 'detached' });
  const after = await (await context.request.get('http://localhost:5173/api/admin/responses')).json();
  assert.equal(after.total, before.total);
  assert.equal((await context.request.post('http://localhost:5173/api/admin/responses/delete', { headers, data: { ids: [] } })).status(), 422);
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.delete(`http://localhost:5173/api/admin/responses/${ids[0]}`, { headers })).status(), 401);
  await anonymous.close();
  console.log('Verified actual submissions appear, retries do not duplicate, single and bulk UI deletion work, counts reconcile, editing is unavailable and unauthorized deletion is rejected. Only three newly created QA responses were deleted.');
} finally {
  for (const id of ids) await context.request.delete(`http://localhost:5173/api/admin/responses/${id}`, { headers }).catch(() => {});
  await browser.close();
}
