import test from 'node:test';
import assert from 'node:assert/strict';
import { createSqlitePool } from '../server/sqlite.js';
import { initialQuestionnaire } from '../shared/questionnaire.js';
import { deleteResponses } from '../server/response-deletion.js';
test('SQLite supports versions, JSON filters, dates, sessions, transactions and deletion', async () => {
  const pool = createSqlitePool(':memory:');
  const id = '12345678-1234-1234-1234-123456789012';
  try {
    await pool.execute('INSERT INTO questionnaire_versions (version, schema_json) VALUES (?, ?)', [1, JSON.stringify(initialQuestionnaire)]);
    await pool.execute('INSERT INTO questionnaires (id, schema_json) VALUES (1, ?)', [JSON.stringify(initialQuestionnaire)]);
    await pool.execute('INSERT INTO admins (email, password_hash) VALUES (?, ?)', ['qa@example.test', 'hash']);
    await pool.execute('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))', ['token', 1]);
    assert.equal((await pool.query('SELECT * FROM sessions WHERE expires_at > UTC_TIMESTAMP()'))[0].length, 1);
    await pool.execute('INSERT INTO submissions (id, request_key, questionnaire_version, answers, contact_consent) VALUES (?, ?, ?, ?, ?)', [id, id, 1, JSON.stringify({ applicantName: 'QA agent' }), true]);
    const [matched] = await pool.query("SELECT * FROM submissions WHERE LOWER(JSON_UNQUOTE(JSON_EXTRACT(answers, '$.applicantName'))) LIKE ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)", ['%qa%', '2099-01-01']);
    assert.equal(matched.length, 1);
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('DELETE FROM submissions WHERE id = ?', [id]);
    await connection.rollback(); connection.release();
    assert.equal((await pool.query('SELECT * FROM submissions'))[0].length, 1);
    assert.deepEqual(await deleteResponses(pool, [id], 1), { deleted: 1 });
    assert.equal((await pool.query('SELECT * FROM submissions'))[0].length, 0);
    assert.equal((await pool.query('SELECT * FROM audit_log WHERE action = ?', ['responses.deleted']))[0].length, 1);
  } finally { await pool.end(); }
});
