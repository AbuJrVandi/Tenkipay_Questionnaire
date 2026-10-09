import test from 'node:test';
import assert from 'node:assert/strict';
import { createSqlitePool } from '../server/sqlite.js';
import { ensureSchema } from '../server/schema.js';
import { registerAddress, verifiedRegistration } from '../server/adrehs.js';
import { initialQuestionnaire } from '../shared/questionnaire.js';

test('startup restores missing registration storage and preserves saved questionnaire and responses', async () => {
  const database = createSqlitePool(':memory:');
  try {
    await database.execute('INSERT INTO questionnaire_versions (version, schema_json) VALUES (?, ?)', [1, JSON.stringify(initialQuestionnaire)]);
    await database.execute('INSERT INTO questionnaires (id, schema_json) VALUES (1, ?)', [JSON.stringify(initialQuestionnaire)]);
    await database.execute('INSERT INTO submissions (id, request_key, questionnaire_version, answers) VALUES (?, ?, ?, ?)', ['response', 'request', 1, JSON.stringify({ consent: 'No' })]);
    await database.query('DROP TABLE adrehs_registrations');
    await ensureSchema(database, 'sqlite');
    await ensureSchema(database, 'sqlite');
    const gps = { latitude: 8.48, longitude: -13.23, accuracy: 4 };
    const address = await registerAddress(gps, database, async () => ({ ok: true, json: async () => ({ code: 'TEST CODE' }) }));
    assert.equal((await verifiedRegistration(address, gps, database)).code, 'TEST CODE');
    assert.equal((await database.query('SELECT * FROM submissions'))[0].length, 1);
    assert.equal((await database.query('SELECT * FROM questionnaires'))[0][0].schema_json, JSON.stringify(initialQuestionnaire));
  } finally { await database.end(); }
});

test('MySQL upgrades create the registration table and surface permission failures', async () => {
  const statements = [];
  await ensureSchema({ query: async sql => statements.push(sql) });
  assert.ok(statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS adrehs_registrations')));
  assert.ok(statements.every(sql => /^\s*CREATE TABLE IF NOT EXISTS/.test(sql)));
  await assert.rejects(() => ensureSchema({ query: async () => { throw new Error('CREATE denied'); } }), /CREATE denied/);
});
