import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { initialQuestionnaire } from '../shared/questionnaire.js';
try {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 14 || password.startsWith('replace-')) throw new Error('Set ADMIN_PASSWORD to a unique password of at least 14 characters in .env.');
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  await pool.query('INSERT INTO questionnaires (id, schema_json) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(initialQuestionnaire)]);
  await pool.query('INSERT INTO questionnaire_versions (version, schema_json) VALUES (1, $1) ON CONFLICT (version) DO NOTHING', [JSON.stringify(initialQuestionnaire)]);
  await pool.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING', [process.env.ADMIN_EMAIL, await bcrypt.hash(password, 12)]);
  console.log('Database initialized. Existing admin passwords and responses were preserved.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }
