import { readFile } from 'node:fs/promises';
import { pool, getQuestionnaire } from '../server/db.js';
import { numberQuestions } from '../shared/numbering.js';
try {
  const sql = await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').filter(s => s.trim())) await pool.query(statement);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM questionnaires WHERE id = 1 FOR UPDATE');
    const current = await getQuestionnaire(connection);
    const { version: oldVersion, accepting, updatedAt, ...definition } = current;
    const schema = { ...definition, questions: numberQuestions(current.questions).map(q => q.id === 'net_verification' ? { ...q, help: 'Location verification is captured at the start through the mandatory GPS field.' } : q) };
    if (JSON.stringify(schema) === JSON.stringify(definition)) {
      await connection.rollback(); console.log('Numbering is already up to date. Registration storage is ready.');
    } else {
      const version = oldVersion + 1;
      await connection.execute('INSERT INTO questionnaire_versions (version, schema_json) VALUES (?, ?)', [version, JSON.stringify(schema)]);
      await connection.execute('UPDATE questionnaires SET schema_json = ?, version = ? WHERE id = 1', [JSON.stringify(schema), version]);
      await connection.execute('INSERT INTO audit_log (action, details) VALUES (?, ?)', ['questionnaire.numbering.updated', JSON.stringify({ oldVersion, version })]);
      await connection.commit(); console.log(`Published consistent question numbering as v${version}. GPS position and earlier responses preserved. Registration storage is ready.`);
    }
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { await pool.end(); }
