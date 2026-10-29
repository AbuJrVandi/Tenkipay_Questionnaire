import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyQuestionnaire as schema, cleanAnswers, validateAnswers, isVisible } from '../shared/questionnaire.js';
import { currentAgent } from './fixtures.js';
import { aggregate, csvCell, exportColumns } from '../server/analytics.js';
import { generateAddress } from '../server/adrehs.js';
const visible = (id, a) => isVisible(schema.questions.find(q => q.id === id), a);
test('captured Adrehs code is retained in collected answers, analytics and spreadsheet exports', () => {
  const answers = cleanAnswers(schema, { ...currentAgent, adrehs: { code: 'WAU W3J AN4', publicConsent: true, district: 'WESTERN AREA URB' } });
  assert.equal(answers.adrehs.code, 'WAU W3J AN4');
  assert.deepEqual(validateAnswers(schema, answers), {});
  const rows = [{ id: 'test', created_at: '2026-10-07 10:00:00', questionnaire_version: 1, gps_review: 0, answers }];
  assert.equal(aggregate(rows, schema).locations.registered, 1);
  const output = exportColumns(schema, rows);
  assert.equal(output.records[0][output.columns.indexOf('Adrehs code')], 'WAU W3J AN4');
});
test('location workflow is directly after consent and available before agent interest', () => {
  assert.equal(schema.questions[1].id, 'outletGps');
  assert.equal(visible('outletGps', { consent: 'Yes' }), true);
  assert.equal(visible('outletGps', { consent: 'Yes', onSite: 'Yes', gpsConsent: 'Yes', gpsStatus: 'Captured' }), true);
  assert.equal(visible('outletGps', { consent: 'No', onSite: 'Yes', gpsConsent: 'Yes', gpsStatus: 'Captured' }), false);
});
test('consent refusal ends the form and strips applicant / contact data', () => {
  const answers = cleanAnswers(schema, { ...currentAgent, consent: 'No' });
  assert.deepEqual(answers, { consent: 'No' }); assert.deepEqual(validateAnswers(schema, answers), {});
});
test('no interest skips questions 3–18 but allows permitted contact', () => {
  const answers = cleanAnswers(schema, { ...currentAgent, interest: 'No', contactName: 'Contact Test' });
  assert.equal(answers.applicantName, undefined); assert.equal(answers.resources, undefined); assert.deepEqual(answers.outletGps, currentAgent.outletGps);
  const complete = { ...answers, contactName: 'Contact Test' }; assert.deepEqual(validateAnswers(schema, complete), {});
});
test('current-agent questionnaire and all three contact paths validate', () => {
  for (const method of ['WhatsApp', 'Phone call', 'Email']) {
    const answers = cleanAnswers(schema, { ...currentAgent, contactMethod: method, email: 'test@example.com' });
    assert.deepEqual(validateAnswers(schema, answers), {}); assert.equal(answers.contactName, currentAgent.applicantName);
    assert.equal(method === 'Email' ? answers.phone : answers.email, undefined);
  }
});
test('declined contact strips all contact data', () => {
  const answers = cleanAnswers(schema, { ...currentAgent, contactConsent: 'No', contactName: 'Test', email: 'test@example.com' });
  for (const id of ['phone', 'email', 'contactMethod', 'contactName']) assert.equal(answers[id], undefined);
  assert.deepEqual(validateAnswers(schema, answers), {});
});
test('new business has no customer activity or requested services; former agent has providers only', () => {
  const answers = cleanAnswers(schema, { ...currentAgent, businessType: 'I do not currently operate a business', experience: 'I previously operated as an agent' });
  for (const id of ['dailyCustomers', 'dailyTransactions', 'services']) assert.equal(answers[id], undefined);
  assert.equal(answers.providers, 'Test provider'); assert.deepEqual(validateAnswers(schema, answers), {});
});
test('device question is conditional and malformed resources are rejected', () => {
  assert.equal(visible('deviceAvailability', { ...currentAgent, resources: ['Electricity'] }), false);
  assert.ok(validateAnswers(schema, { ...currentAgent, resources: 'Smartphone' }).resources);
});
test('none choices are exclusive and challenges allow at most three', () => {
  assert.ok(validateAnswers(schema, { ...currentAgent, resources: ['None of the above', 'Smartphone'] }).resources);
  assert.ok(validateAnswers(schema, { ...currentAgent, services: ['None of these services', 'Withdrawing cash'] }).services);
  assert.ok(validateAnswers(schema, { ...currentAgent, challenges: ['Maintaining enough cash', 'Security', 'Electricity', 'Internet connectivity'] }).challenges);
  assert.ok(validateAnswers(schema, { ...currentAgent, challenges: ['No significant challenges', 'Security'] }).challenges);
});
test('other requires explanation and malformed dates, emails, GPS are rejected', () => {
  assert.ok(validateAnswers(schema, { ...currentAgent, businessType: 'Other' }).businessType_other);
  assert.ok(validateAnswers(schema, { ...currentAgent, visitDate: '2026-02-30' }).visitDate);
  assert.ok(validateAnswers(schema, { ...currentAgent, contactMethod: 'Email', email: 'bad' }).email);
  assert.ok(validateAnswers(schema, { ...currentAgent, outletGps: { latitude: 100, longitude: 0, accuracy: 4 } }).outletGps);
});
test('location is required for every consenting participant, regardless of legacy GPS choices', () => {
  for (const extra of [{ onSite: 'No' }, { gpsConsent: 'No' }, { gpsStatus: 'Not captured' }]) {
    assert.ok(validateAnswers(schema, { ...currentAgent, ...extra, outletGps: undefined }).outletGps);
  }
  assert.deepEqual(validateAnswers(schema, cleanAnswers(schema, { consent: 'No' })), {});
});
test('GPS readings above 30m are valid but reviewable; hours may be undecided', () => {
  const answers = cleanAnswers(schema, { ...currentAgent, outletGps: { ...currentAgent.outletGps, accuracy: 45 }, hoursUndecided: 'Not yet decided' });
  assert.equal(answers.openingTime, undefined); assert.deepEqual(validateAnswers(schema, answers), {});
});
test('analytics excludes refusals from interest denominator, fills missing dates, and keeps histogram bins', () => {
  const stats = aggregate([{ answers: currentAgent, created_at: '2026-10-01 10:00:00', gps_review: 0 }, { answers: { consent: 'No' }, created_at: '2026-10-03 10:00:00', gps_review: 0 }], schema);
  assert.equal(stats.total, 2); assert.equal(stats.participants, 1); assert.equal(stats.interested, 1); assert.equal(stats.trend[1].responses, 0); assert.equal(stats.customerActivity.length, 4);
});
test('CSV escaping protects formulas, delimiters and line breaks', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"'); assert.equal(csvCell('a,b\nc'), '"a,b\nc"'); assert.equal(csvCell('+23212345678'), '"\'+23212345678"');
});
test('Adrehs adapter follows official lat/lng contract and retains returned digital ID', async () => {
  let request;
  const result = await generateAddress(currentAgent.outletGps, async (url, options) => { request = { url, ...options }; return { ok: true, json: async () => ({ code: 'ABC DEF', digital_id: 'BO ABC DEF', district: 'BO' }) }; });
  assert.deepEqual(JSON.parse(request.body), { lat: 7.96, lng: -11.74 }); assert.equal(result.code, 'BO ABC DEF'); assert.equal(result.publicConsent, true);
});
test('Adrehs failures are reported without inventing a code', async () => {
  await assert.rejects(() => generateAddress(currentAgent.outletGps, async () => ({ ok: false, status: 404 })), /outside Adrehs coverage/);
  await assert.rejects(() => generateAddress(currentAgent.outletGps, async () => ({ ok: true, json: async () => ({}) })), /unexpected response/);
});
