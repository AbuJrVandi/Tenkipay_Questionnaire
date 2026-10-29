import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { pool, getQuestionnaire } from '../server/db.js';
import { initialQuestionnaire } from '../shared/questionnaire.js';
try {
  const current = await getQuestionnaire();
  const locationIds = ['onSite', 'gpsConsent', 'gpsStatus', 'outletGps', 'gpsFailureReason', 'adrehs'];
  const moved = initialQuestionnaire.questions.filter(q => locationIds.includes(q.id)).map(q => ({ ...q, label: current.questions.find(c => c.id === q.id)?.label || q.label }));
  const schema = { title: current.title, description: current.description, notice: current.notice, questions: [current.questions.find(q => q.id === 'consent'), ...moved, ...current.questions.filter(q => q.id !== 'consent' && !locationIds.includes(q.id))] };
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    const version = current.version + 1;
    await connection.query('INSERT INTO questionnaire_versions (version, schema_json) VALUES ($1, $2)', [version, JSON.stringify(schema)]);
    await connection.query('UPDATE questionnaires SET version = $1, schema_json = $2 WHERE id = 1', [version, JSON.stringify(schema)]);
    await connection.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash', ['test@tenkipay.test', await bcrypt.hash('password123', 12)]);
    await connection.query('COMMIT');
  } catch (e) { await connection.query('ROLLBACK'); throw e; } finally { connection.release(); }
  let env = readFileSync('.env', 'utf8').replace(/^ADMIN_EMAIL=.*$/m, 'ADMIN_EMAIL=test@tenkipay.test').replace(/^ADMIN_PASSWORD=.*$/m, 'ADMIN_PASSWORD=password123');
  writeFileSync('.env', env);
  writeFileSync('.local/LOGIN.txt', 'Local application login\nURL: http://localhost:5173/admin\nEmail: test@tenkipay.test\nPassword: password123\n');
  console.log('Local administrator configured; location-first questionnaire migrated. PostgreSQL connection verified.');
} finally { await pool.end(); }
