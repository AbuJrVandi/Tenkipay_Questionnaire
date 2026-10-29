import { initialQuestionnaire } from '../shared/questionnaire.js';

// Add a new release ID when intentionally publishing another template upgrade.
export const questionnaireRelease = '2026-10-agent-network-v1';

export async function applyQuestionnaireRelease(database) {
  const connection = await database.connect();
  try {
    await connection.query('BEGIN');
    // Serialize deployments with editor saves and other application instances.
    const { rows } = await connection.query('SELECT * FROM questionnaires WHERE id = 1 FOR UPDATE');
    if (!rows.length) throw new Error('Run npm run db:setup before starting the application.');
    const applied = await connection.query('SELECT id FROM app_migrations WHERE id = $1', [questionnaireRelease]);
    if (applied.rows.length) {
      await connection.query('COMMIT');
      return { changed: false, version: rows[0].version };
    }

    const current = typeof rows[0].schema_json === 'string' ? JSON.parse(rows[0].schema_json) : rows[0].schema_json;
    let version = rows[0].version;
    // Already-upgraded installations retain their saved editor customizations.
    // Legacy installations receive the same definition shipped to development.
    const changed = current.template !== initialQuestionnaire.template;
    if (changed) {
      const definition = structuredClone(initialQuestionnaire);
      version += 1;
      definition.version = version;
      await connection.query('INSERT INTO questionnaire_versions (version, schema_json) VALUES ($1, $2)', [version, JSON.stringify(definition)]);
      await connection.query('UPDATE questionnaires SET version = $1, schema_json = $2 WHERE id = 1', [version, JSON.stringify(definition)]);
      await connection.query('INSERT INTO audit_log (action, details) VALUES ($1, $2)', ['questionnaire.release', JSON.stringify({ release: questionnaireRelease, previousVersion: rows[0].version, version, template: definition.template })]);
    }
    await connection.query('INSERT INTO app_migrations (id) VALUES ($1)', [questionnaireRelease]);
    await connection.query('COMMIT');
    return { changed, version };
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}
