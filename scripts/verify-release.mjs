import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

// Exercise the compiled site against an isolated, upgraded database.
process.env.NODE_ENV = 'development';
process.env.DB_DRIVER = 'sqlite';
process.env.SQLITE_PATH = ':memory:';
const { pool } = await import('../server/db.js');
const { initialQuestionnaire, legacyQuestionnaire } = await import('../shared/questionnaire.js');
const { applyQuestionnaireRelease } = await import('../server/questionnaire-release.js');
let server, browser;
try {
  await pool.execute('INSERT INTO questionnaire_versions (version, schema_json) VALUES (?, ?)', [1, JSON.stringify(legacyQuestionnaire)]);
  await pool.execute('INSERT INTO questionnaires (id, schema_json) VALUES (1, ?)', [JSON.stringify(legacyQuestionnaire)]);
  await applyQuestionnaireRelease(pool);
  await pool.execute('INSERT INTO admins (email, password_hash) VALUES (?, ?)', ['release-check@example.test', 'unused']);
  const token = randomBytes(32).toString('hex');
  await pool.execute('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))', [createHash('sha256').update(token).digest('hex'), 1]);
  const { app } = await import('../server/app.js');
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.APP_ORIGIN = origin;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: 'tenkipay_session', value: token, url: origin }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(`${origin}/admin`);
  assert.equal(response.headers()['cache-control'], 'no-store');
  await page.getByText('Profile responses', { exact: true }).waitFor();
  await page.getByText('Active outlets', { exact: true }).waitFor();
  assert.equal(await page.getByText('Local database', { exact: true }).count(), 0);
  assert.equal(await page.getByText('LOCAL', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await page.getByRole('heading', { name: 'Turn answers into understanding.', exact: true }).waitFor();
  await page.getByText('Profile responses', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Questionnaire', exact: true }).click();
  await page.locator('#form-title').waitFor();
  assert.equal(await page.locator('#form-title').inputValue(), initialQuestionnaire.title);
  assert.equal(await page.locator('.editor-tabs button').count(), 7);
  await page.goto(`${origin}/form`);
  await page.getByRole('heading', { name: initialQuestionnaire.title, exact: true }).waitFor();
  const publicSchema = await (await context.request.get(`${origin}/api/public/questionnaire`)).json();
  assert.deepEqual(publicSchema.questions, initialQuestionnaire.questions);
  assert.deepEqual(errors, []);
  console.log('Compiled Overview, Analytics, editor and public form use the upgraded questionnaire; local labels removed; HTML revalidation verified.');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.end();
}
