import test from 'node:test';
import assert from 'node:assert/strict';
import { initialQuestionnaire, legacyQuestionnaire } from '../shared/questionnaire.js';
import { applyQuestionnaireRelease, questionnaireRelease } from '../server/questionnaire-release.js';

function createDatabase(definition = legacyQuestionnaire) {
  const state = {
    questionnaire: { id: 1, version: 1, schema_json: JSON.stringify(definition), accepting: false, updated_at: null },
    versions: [{ version: 1, schema_json: JSON.stringify(definition) }],
    submissions: [{ id: 'historic-response', request_key: 'historic-request', questionnaire_version: 1, answers: JSON.stringify({ consent: 'No' }) }],
    migrations: [],
    audit: []
  };
  function client({ failMigration = false } = {}) {
    let transaction = structuredClone(state);
    return {
      async query(text, parameters = []) {
        if (text === 'BEGIN') { transaction = structuredClone(state); return { rows: [] }; }
        if (text === 'COMMIT') { Object.assign(state, transaction); return { rows: [] }; }
        if (text === 'ROLLBACK') return { rows: [] };
        if (text.startsWith('SELECT * FROM questionnaires')) return { rows: [{ ...transaction.questionnaire }] };
        if (text.startsWith('SELECT id FROM app_migrations')) return { rows: transaction.migrations.filter(row => row.id === parameters[0]).map(row => ({ id: row.id })) };
        if (text.startsWith('INSERT INTO questionnaire_versions')) { transaction.versions.push({ version: parameters[0], schema_json: parameters[1] }); return { rows: [] }; }
        if (text.startsWith('UPDATE questionnaires')) { Object.assign(transaction.questionnaire, { version: parameters[0], schema_json: parameters[1] }); return { rows: [] }; }
        if (text.startsWith('INSERT INTO audit_log')) { transaction.audit.push({ action: parameters[0], details: parameters[1] }); return { rows: [] }; }
        if (text.startsWith('INSERT INTO app_migrations')) {
          if (failMigration) throw new Error('Simulated write failure');
          transaction.migrations.push({ id: parameters[0] });
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${text}`);
      },
      release() {}
    };
  }
  return { database: { connect: async () => client() }, failingDatabase: { connect: async () => client({ failMigration: true }) }, state };
}

test('deployment upgrades the old questionnaire and retains response history and paused collection', async () => {
  const { database, state } = createDatabase();
  assert.deepEqual(await applyQuestionnaireRelease(database), { changed: true, version: 2 });
  assert.equal(state.questionnaire.version, 2);
  const { version, ...definition } = JSON.parse(state.questionnaire.schema_json);
  assert.equal(version, 2);
  assert.deepEqual(definition, initialQuestionnaire);
  assert.equal(state.questionnaire.accepting, false);
  assert.deepEqual(JSON.parse(state.versions[0].schema_json), legacyQuestionnaire);
  assert.equal(state.submissions[0].questionnaire_version, 1);
  assert.deepEqual(JSON.parse(state.submissions[0].answers), { consent: 'No' });
  assert.deepEqual(await applyQuestionnaireRelease(database), { changed: false, version: 2 });
  assert.equal(state.versions.length, 2);
  assert.equal(state.audit.length, 1);
  assert.equal(state.migrations[0].id, questionnaireRelease);
});

test('already-upgraded questionnaires and later editor changes survive deploys', async () => {
  const custom = { ...initialQuestionnaire, title: 'Our edited questionnaire title' };
  const { database, state } = createDatabase(custom);
  assert.deepEqual(await applyQuestionnaireRelease(database), { changed: false, version: 1 });
  const updated = { ...custom, description: 'Saved by the administrator after deployment.' };
  state.questionnaire.schema_json = JSON.stringify(updated);
  await applyQuestionnaireRelease(database);
  assert.deepEqual(JSON.parse(state.questionnaire.schema_json), updated);
  assert.equal(state.versions.length, 1);
});

test('a failed deployment upgrade rolls back the definition, history and release marker', async () => {
  const { failingDatabase, state } = createDatabase();
  await assert.rejects(() => applyQuestionnaireRelease(failingDatabase), /Simulated write failure/);
  assert.deepEqual(JSON.parse(state.questionnaire.schema_json), legacyQuestionnaire);
  assert.equal(state.versions.length, 1);
  assert.equal(state.migrations.length, 0);
  assert.equal(state.audit.length, 0);
});
