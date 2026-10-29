import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareQuestions } from '../shared/editor.js';
import { legacyQuestionnaire as initialQuestionnaire, cleanAnswers, validateAnswers } from '../shared/questionnaire.js';
import { aggregate } from '../server/analytics.js';
import { currentAgent } from './fixtures.js';
const core = initialQuestionnaire.questions;
const custom = { id: 'custom_test', section: 'B', type: 'single', label: 'Preferred training?', required: true, options: ['In person', 'Online'] };
test('location fields cannot be edited, made optional or deleted', () => {
  for (const id of ['outletGps', 'adrehs']) {
    assert.throws(() => prepareQuestions(core.filter(q => q.id !== id), core));
    assert.throws(() => prepareQuestions(core.map(q => q.id === id ? { ...q, label: 'Changed' } : q), core));
  }
  assert.throws(() => prepareQuestions(core.map(q => q.id === 'outletGps' ? { ...q, required: false } : q), core));
  assert.equal(prepareQuestions(core, core).find(q => q.id === 'outletGps').required, true);
});
test('added question validates, survives answer cleaning and appears in analytics', () => {
  const questions = prepareQuestions([...core, custom], core);
  const schema = { ...initialQuestionnaire, questions };
  assert.ok(validateAnswers(schema, currentAgent).custom_test);
  const answers = cleanAnswers(schema, { ...currentAgent, custom_test: 'Online' });
  assert.deepEqual(validateAnswers(schema, answers), {});
  assert.equal(answers.custom_test, 'Online');
  assert.equal(aggregate([{ answers, created_at: '2026-10-08' }], schema).questions.custom_test.find(v => v.name === 'Online').value, 1);
});
test('rejects invalid choices, duplicate IDs, removed saved questions and invalid types', () => {
  assert.throws(() => prepareQuestions([...core, { ...custom, options: ['Same', ' Same '] }], core));
  assert.throws(() => prepareQuestions([...core, custom, custom], core));
  assert.throws(() => prepareQuestions(core.slice(1), core));
  const saved = prepareQuestions([...core, custom], core);
  assert.equal(prepareQuestions([...core, { ...custom, type: 'text' }], saved).at(-1).type, 'text');
  assert.equal(prepareQuestions(core, saved).length, core.length);
  assert.throws(() => prepareQuestions(core.filter(q => q.id !== 'resources'), core));
  assert.equal(prepareQuestions(core.filter(q => !['resources', 'deviceAvailability'].includes(q.id)), core).length, core.length - 2);
  assert.throws(() => prepareQuestions([...core, { ...custom, type: 'unknown' }], core));
});
