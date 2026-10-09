import { readFile } from 'node:fs/promises';

// Add missing tables on upgrades without replacing questionnaires or responses.
export async function ensureSchema(database, driver = 'mysql') {
  if (driver === 'sqlite') return database.initializeSchema();
  const file = './schema.sql';
  const sql = await readFile(new URL(file, import.meta.url), 'utf8');
  for (const statement of sql.split(';').filter(value => value.trim())) {
    await database.query(statement);
  }
}
