import 'dotenv/config';
import mysql from 'mysql2/promise';
import { createSqlitePool } from './sqlite.js';
export const databaseDriver = process.env.DB_DRIVER || 'mysql';
if (!['sqlite', 'mysql'].includes(databaseDriver)) throw new Error('DB_DRIVER must be sqlite or mysql.');
if (process.env.NODE_ENV === 'production' && databaseDriver !== 'mysql') throw new Error('Production requires DB_DRIVER=mysql and the configured MYSQL_* database settings.');
export const pool = databaseDriver === 'sqlite' ? createSqlitePool(process.env.SQLITE_PATH || '.local/tenkipay.sqlite') : mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'tenkipay', connectionLimit: 10,
  timezone: 'Z', dateStrings: true, ...(process.env.MYSQL_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {})
});
export const parseJson = value => typeof value === 'string' ? JSON.parse(value) : value;
export async function getQuestionnaire(connection = pool) {
  const [rows] = await connection.query('SELECT * FROM questionnaires WHERE id = 1');
  if (!rows.length) throw new Error('Run npm run db:setup first.');
  return { ...parseJson(rows[0].schema_json), version: rows[0].version, accepting: !!rows[0].accepting, updatedAt: rows[0].updated_at };
}
