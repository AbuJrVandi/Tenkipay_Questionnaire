import { pool, getQuestionnaire } from '../server/db.js';
import { requireLocation } from '../shared/questionnaire.js';
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  await connection.query('SELECT id FROM questionnaires WHERE id = 1 FOR UPDATE');
  const current = await getQuestionnaire(connection);
  const { version: oldVersion, accepting, updatedAt, ...fields } = current;
  const schema = requireLocation(fields), version = oldVersion + 1;
  await connection.execute('INSERT INTO questionnaire_versions (version, schema_json) VALUES (?, ?)', [version, JSON.stringify(schema)]);
  await connection.execute('UPDATE questionnaires SET schema_json = ?, version = ? WHERE id = 1', [JSON.stringify(schema), version]);
  await connection.commit();
  console.log('Required automatic location capture enabled; historical responses preserved.');
} catch (error) { await connection.rollback(); throw error; }
finally { connection.release(); await pool.end(); }
