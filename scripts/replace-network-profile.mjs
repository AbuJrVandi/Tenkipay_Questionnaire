import { pool, getQuestionnaire } from '../server/db.js';
import { initialQuestionnaire } from '../shared/questionnaire.js';

const connection = await pool.connect();
try {
  await connection.query('BEGIN');
  await connection.query('SELECT id FROM questionnaires WHERE id = 1 FOR UPDATE');
  const current = await getQuestionnaire(connection);
  if (current.template === initialQuestionnaire.template) {
    console.log('Existing-agent questionnaire is already installed; no changes made.');
    await connection.query('ROLLBACK');
  } else {
    const schema = structuredClone(initialQuestionnaire);
    // Preserve the live location wording, settings and position after consent.
    for (const id of ['outletGps', 'adrehs']) {
      const live = current.questions.find(q => q.id === id);
      if (live) schema.questions = schema.questions.map(q => q.id === id ? { ...live, profile: true, section: 'A', ...(id === 'outletGps' ? { required: true } : {}) } : q);
    }
    const version = current.version + 1;
    await connection.query('INSERT INTO questionnaire_versions (version, schema_json) VALUES ($1, $2)', [version, JSON.stringify(schema)]);
    await connection.query('UPDATE questionnaires SET version = $1, schema_json = $2 WHERE id = 1', [version, JSON.stringify(schema)]);
    await connection.query('INSERT INTO audit_log (action, details) VALUES ($1, $2)', ['questionnaire.replaced', JSON.stringify({ previousVersion: current.version, version, template: schema.template, source: 'User-provided existing-agent questionnaire' })]);
    await connection.query('COMMIT');
    console.log(`Published existing-agent questionnaire v${version}: ${schema.questions.length} fields. Historical versions and responses preserved.`);
  }
} catch (error) { await connection.query('ROLLBACK'); console.error(error.message); process.exitCode = 1; }
finally { connection.release(); await pool.end(); }
