import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFile, writeFile } from 'node:fs/promises';
import { createSqlitePool } from '../server/sqlite.js';
const target = createSqlitePool('.local/tenkipay.sqlite');
let source;
try {
  const [[existing]] = await target.query('SELECT COUNT(*) AS total FROM questionnaires');
  if (existing.total) throw new Error('SQLite already contains a questionnaire; migration stopped to avoid overwriting data.');
  source = await mysql.createConnection({ host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE || 'tenkipay', dateStrings: true });
  await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const connection = await target.getConnection();
  try {
    await connection.beginTransaction();
    for (const table of ['questionnaire_versions', 'questionnaires', 'admins', 'sessions', 'submissions', 'audit_log', 'adrehs_registrations']) {
      const [rows] = await source.query(`SELECT * FROM ${table}`);
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row).map(value => value && typeof value === 'object' ? JSON.stringify(value) : value);
        await connection.execute(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
      }
      const [[count]] = await connection.query(`SELECT COUNT(*) AS total FROM ${table}`);
      if (count.total !== rows.length) throw new Error(`Migration count mismatch for ${table}.`);
      console.log(`${table}: ${rows.length} records preserved`);
    }
    const [integrity] = await connection.query('PRAGMA foreign_key_check');
    if (integrity.length) throw new Error('Migration failed foreign-key verification.');
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  await source.rollback();
  let env = await readFile('.env', 'utf8');
  env = env.replace(/^DB_DRIVER=.*\r?\n?/m, '').replace(/^SQLITE_PATH=.*\r?\n?/m, '');
  await writeFile('.env', `DB_DRIVER=sqlite\nSQLITE_PATH=.local/tenkipay.sqlite\n${env}`);
  console.log('Local application configured for SQLite. Original MySQL data remains intact.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { if (source) await source.end(); await target.end(); }
