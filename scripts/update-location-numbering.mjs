import { pool, getQuestionnaire } from '../server/db.js';
import { ensureSchema } from '../server/schema.js';
import { numberQuestions } from '../shared/numbering.js';
try {
  await ensureSchema(pool);
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query('SELECT id FROM questionnaires WHERE id = 1 FOR UPDATE');
    const current = await getQuestionnaire(connection);
    const { version: oldVersion, accepting, updatedAt, ...definition } = current;
    const schema = { ...definition, questions: numberQuestions(current.questions).map(q => q.id === 'net_verification' ? { ...q, help: 'Location verification is captured at the start through the mandatory GPS field.' } : q) };
    if (JSON.stringify(schema) === JSON.stringify(definition)) {
      await connection.query('ROLLBACK'); console.log('Numbering is already up to date. Registration storage is ready.');
    } else {
      const version = oldVersion + 1;
      await connection.query('INSERT INTO questionnaire_versions (version, schema_json) VALUES ($1, $2)', [version, JSON.stringify(schema)]);
      await connection.query('UPDATE questionnaires SET schema_json = $1, version = $2 WHERE id = 1', [JSON.stringify(schema), version]);
      await connection.query('INSERT INTO audit_log (action, details) VALUES ($1, $2)', ['questionnaire.numbering.updated', JSON.stringify({ oldVersion, version })]);
      await connection.query('COMMIT'); console.log(`Published consistent question numbering as v${version}. GPS position and earlier responses preserved. Registration storage is ready.`);
    }
  } catch (error) { await connection.query('ROLLBACK'); throw error; } finally { connection.release(); }
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { await pool.end(); }
