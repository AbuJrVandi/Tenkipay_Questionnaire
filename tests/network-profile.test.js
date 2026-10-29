import test from 'node:test';
import assert from 'node:assert/strict';
import { initialQuestionnaire as schema, isVisible, validateAnswers, cleanAnswers } from '../shared/questionnaire.js';
import { prepareQuestions } from '../shared/editor.js';
const gps = { latitude: 8.48, longitude: -13.23, accuracy: 5 };
test('typing preserves spaces and newlines while submission trims only outer whitespace', () => {
  const input = { consent: 'Yes', businessName: 'TenkiPay ', net_improvement: 'First line\n', net_role: 'Other', net_role_other: 'Field officer ' };
  const draft = cleanAnswers(schema, input, { trimText: false });
  assert.equal(draft.businessName, 'TenkiPay ');
  assert.equal(draft.net_improvement, 'First line\n');
  assert.equal(draft.net_role_other, 'Field officer ');
  const submitted = cleanAnswers(schema, { ...draft, businessName: draft.businessName + 'Agent Outlet' });
  assert.equal(submitted.businessName, 'TenkiPay Agent Outlet');
  assert.equal(submitted.net_role_other, 'Field officer');
  assert.ok(validateAnswers(schema, { consent: 'Yes', outletGps: gps, businessName: '   ' }).businessName);
});
function complete(overrides = {}) {
  const a = { consent: 'Yes', outletGps: gps, ...overrides };
  for (const q of schema.questions) {
    if (!isVisible(q, a) || !q.required || a[q.id] !== undefined) continue;
    a[q.id] = q.options ? q.type === 'multi' ? [q.options[0]] : q.options[0] : q.type === 'date' ? '2026-10-01' : q.type === 'month' ? '2025-01' : q.type === 'time' ? '09:00' : q.type === 'number' ? String(q.min || 0) : q.type === 'repeat' ? [{ institution: 'Test school', paymentType: 'School fees' }] : q.type === 'tel' ? '+23276123456' : q.type === 'email' ? 'test@example.com' : 'Test';
  }
  return a;
}
test('new template has seven sections and mandatory GPS immediately after consent', () => {
  assert.equal(schema.sections.length, 7);
  assert.equal(schema.questions[1].id, 'outletGps');
  assert.equal(schema.questions[1].required, true);
  assert.deepEqual(cleanAnswers(schema, { consent: 'No', net_agentId: 'secret', outletGps: gps }), { consent: 'No' });
  assert.deepEqual(validateAnswers(schema, complete()), {});
  assert.equal(prepareQuestions(schema.questions, schema.questions, schema.sections).length, schema.questions.length);
});
test('no completed operating days skips period-based questions but retains training, growth and support needs', () => {
  const a = complete({ net_periodAvailable: 'No completed operating days in the reporting period' });
  assert.deepEqual(validateAnswers(schema, a), {});
  const visible = schema.questions.filter(q => isVisible(q, a));
  assert.equal(visible.some(q => q.period), false);
  for (const id of ['net_training', 'net_growthBarriers', 'net_supportNeeds', 'net_verification']) assert.ok(visible.some(q => q.id === id));
});
test('revenue refusal strips revenue details; support refusal skips support rating', () => {
  const a = complete({ net_revenueCollection: 'No', net_supportContacted: 'No', net_totalRevenue: '500' });
  const clean = cleanAnswers(schema, a);
  assert.equal(clean.net_totalRevenue, undefined);
  assert.equal(clean.net_supportSatisfaction, undefined);
  assert.deepEqual(validateAnswers(schema, clean), {});
});
test('daily average is server-derived, handles zero revenue, and rejects invalid amounts and periods', () => {
  const a = complete({ net_totalRevenue: '1000', net_operatingDays: '10', net_periodStart: '2026-09-01', net_periodEnd: '2026-09-30', net_dailyAverage: '99999' });
  assert.equal(cleanAnswers(schema, a).net_dailyAverage, '100.00');
  assert.deepEqual(validateAnswers(schema, a), {});
  assert.equal(cleanAnswers(schema, { ...a, net_totalRevenue: '0' }).net_dailyAverage, '0.00');
  assert.ok(validateAnswers(schema, { ...a, net_operatingDays: '31' }).net_operatingDays);
  assert.ok(validateAnswers(schema, { ...a, net_totalRevenue: '-5' }).net_totalRevenue);
});
test('repeat institutions and alternative follow-up paths validate', () => {
  const a = complete({ net_followup: 'Yes — use a different contact', net_followupMethod: 'Email' });
  assert.deepEqual(validateAnswers(schema, a), {});
  assert.equal(cleanAnswers(schema, a).net_followupPhone, undefined);
  assert.ok(validateAnswers(schema, { ...a, net_institutions: [{ institution: '', paymentType: '' }] }).net_institutions);
  assert.ok(validateAnswers(schema, { ...a, net_transactionBarriers: ['No significant barriers', 'Other'] }).net_transactionBarriers);
});
