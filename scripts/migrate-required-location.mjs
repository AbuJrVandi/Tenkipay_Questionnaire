import { pool, getQuestionnaire } from '../server/db.js';
import { requireLocation } from '../shared/questionnaire.js';
const connection = await pool.connect();
try {
  await connection.query('BEGIN');
  await connection.query('SELECT id FROM questionnaires WHERE id = 1 FOR UPDATE');
  const current = await getQuestionnaire(connection);
  const { version: oldVersion, accepting, updatedAt, ...fields } = current;
  const schema = requireLocation(fields), version = oldVersion + 1;
  await connection.query('INSERT INTO questionnaire_versions (version, schema_json) VALUES ($1, $2)', [version, JSON.stringify(schema)]);
  await connection.query('UPDATE questionnaires SET schema_json = $1, version = $2 WHERE id = 1', [JSON.stringify(schema), version]);
  await connection.query('COMMIT');
  console.log('Required automatic location capture enabled; historical responses preserved.');
} catch (error) { await connection.query('ROLLBACK'); throw error; }
finally { connection.release(); await pool.end(); }
