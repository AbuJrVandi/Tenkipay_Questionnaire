import test from 'node:test';
import assert from 'node:assert/strict';
import { createSqlitePool } from '../server/sqlite.js';
import { initialQuestionnaire, legacyQuestionnaire } from '../shared/questionnaire.js';
import { applyQuestionnaireRelease, questionnaireRelease } from '../server/questionnaire-release.js';

async function seed(database, definition = legacyQuestionnaire) {
  await database.execute('INSERT INTO questionnaire_versions (version, schema_json) VALUES (?, ?)', [1, JSON.stringify(definition)]);
  await database.execute('INSERT INTO questionnaires (id, schema_json, accepting) VALUES (1, ?, ?)', [JSON.stringify(definition), false]);
  await database.execute('INSERT INTO submissions (id, request_key, questionnaire_version, answers) VALUES (?, ?, ?, ?)', ['historic-response', 'historic-request', 1, JSON.stringify({ consent: 'No' })]);
}

test('deployment upgrades the old questionnaire and retains response history and paused collection', async () => {
  const database = createSqlitePool(':memory:');
  try {
    await seed(database);
    assert.deepEqual(await applyQuestionnaireRelease(database), { changed: true, version: 2 });
    const [[current]] = await database.query('SELECT * FROM questionnaires WHERE id = 1');
    const { version, ...definition } = JSON.parse(current.schema_json);
    assert.equal(version, 2);
    assert.deepEqual(definition, initialQuestionnaire);
    assert.equal(current.accepting, 0);
    const [[history]] = await database.execute('SELECT schema_json FROM questionnaire_versions WHERE version = ?', [1]);
    assert.deepEqual(JSON.parse(history.schema_json), legacyQuestionnaire);
    const [[response]] = await database.query('SELECT * FROM submissions');
    assert.equal(response.questionnaire_version, 1);
    assert.deepEqual(JSON.parse(response.answers), { consent: 'No' });
    assert.deepEqual(await applyQuestionnaireRelease(database), { changed: false, version: 2 });
    assert.equal((await database.query('SELECT * FROM questionnaire_versions'))[0].length, 2);
    assert.equal((await database.query('SELECT * FROM audit_log'))[0].length, 1);
    assert.equal((await database.query('SELECT * FROM app_migrations'))[0][0].id, questionnaireRelease);
  } finally { await database.end(); }
});

test('already-upgraded questionnaires and later editor changes survive deploys', async () => {
  const database = createSqlitePool(':memory:');
  try {
    const custom = { ...initialQuestionnaire, title: 'Our edited questionnaire title' };
    await seed(database, custom);
    assert.deepEqual(await applyQuestionnaireRelease(database), { changed: false, version: 1 });
    const updated = { ...custom, description: 'Saved by the administrator after deployment.' };
    await database.execute('UPDATE questionnaires SET schema_json = ? WHERE id = 1', [JSON.stringify(updated)]);
    await applyQuestionnaireRelease(database);
    assert.deepEqual(JSON.parse((await database.query('SELECT * FROM questionnaires'))[0][0].schema_json), updated);
    assert.equal((await database.query('SELECT * FROM questionnaire_versions'))[0].length, 1);
  } finally { await database.end(); }
});

test('a failed deployment upgrade rolls back the definition, history and release marker', async () => {
  const database = createSqlitePool(':memory:');
  try {
    await seed(database);
    const failingDatabase = { async getConnection() {
      const connection = await database.getConnection();
      return { ...connection, async execute(sql, parameters) {
        if (sql.startsWith('INSERT INTO app_migrations')) throw new Error('Simulated write failure');
        return connection.execute(sql, parameters);
      } };
    } };
    await assert.rejects(() => applyQuestionnaireRelease(failingDatabase), /Simulated write failure/);
    assert.deepEqual(JSON.parse((await database.query('SELECT * FROM questionnaires'))[0][0].schema_json), legacyQuestionnaire);
    assert.equal((await database.query('SELECT * FROM questionnaire_versions'))[0].length, 1);
    assert.equal((await database.query('SELECT * FROM app_migrations'))[0].length, 0);
    assert.equal((await database.query('SELECT * FROM audit_log'))[0].length, 0);
  } finally { await database.end(); }
});

test('simultaneous startup upgrades publish only one questionnaire version', async () => {
  const database = createSqlitePool(':memory:');
  try {
    await seed(database);
    const results = await Promise.all([applyQuestionnaireRelease(database), applyQuestionnaireRelease(database)]);
    assert.equal(results.filter(result => result.changed).length, 1);
    assert.equal((await database.query('SELECT * FROM questionnaire_versions'))[0].length, 2);
  } finally { await database.end(); }
});
