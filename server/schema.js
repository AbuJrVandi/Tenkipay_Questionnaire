import { readFile } from 'node:fs/promises';

// Add missing tables on upgrades without replacing questionnaires or responses.
export async function ensureSchema(database) {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await database.query(sql);
}
