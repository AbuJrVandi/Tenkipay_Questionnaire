import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { initialQuestionnaire } from '../shared/questionnaire.js';
try {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 14 || password.startsWith('replace-')) throw new Error('Set ADMIN_PASSWORD to a unique password of at least 14 characters in .env.');
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').filter(s => s.trim())) await pool.query(statement);
  await pool.execute('INSERT IGNORE INTO questionnaires (id, schema_json) VALUES (1, ?)', [JSON.stringify(initialQuestionnaire)]);
  await pool.execute('INSERT IGNORE INTO questionnaire_versions (version, schema_json) VALUES (1, ?)', [JSON.stringify(initialQuestionnaire)]);
  await pool.execute('INSERT IGNORE INTO admins (email, password_hash) VALUES (?, ?)', [process.env.ADMIN_EMAIL, await bcrypt.hash(password, 12)]);
  console.log('Database initialized. Existing admin passwords and responses were preserved.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }
