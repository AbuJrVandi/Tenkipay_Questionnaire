import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Keep the existing repository interface while supporting the application's
// small set of MySQL-specific expressions on the local SQLite database.
export function sqliteStatement(sql, parameters = []) {
  let text = sql.replace(/ FOR (UPDATE|SHARE)\b/gi, '')
    .replace(/INSERT IGNORE INTO/gi, 'INSERT OR IGNORE INTO')
    .replace(/DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 8 HOUR\)/gi, "datetime('now', '+8 hours')")
    .replace(/DATE_ADD\(\?, INTERVAL 1 DAY\)/gi, "datetime(?, '+1 day')")
    .replace(/UTC_TIMESTAMP\(\)/gi, "datetime('now')")
    .replace(/JSON_UNQUOTE\((JSON_EXTRACT\([^)]*\))\)/gi, '$1');
  const bindings = [];
  let index = 0;
  text = text.replace(/\?/g, () => {
    const value = parameters[index++];
    if (Array.isArray(value)) { bindings.push(...value); return value.map(() => '?').join(', ') || 'NULL'; }
    bindings.push(typeof value === 'boolean' ? Number(value) : value);
    return '?';
  });
  if (index !== parameters.length) throw new Error('SQL parameter count mismatch.');
  return { text, bindings };
}

export function createSqlitePool(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const database = new DatabaseSync(filename, { timeout: 5000 });
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  database.exec(readFileSync(new URL('./sqlite-schema.sql', import.meta.url), 'utf8'));
  let tail = Promise.resolve();
  async function acquire() {
    const previous = tail;
    let unlock;
    tail = new Promise(resolve => { unlock = resolve; });
    await previous;
    return unlock;
  }
  function run(sql, parameters = []) {
    // Schema is initialized above. Existing MySQL setup/migration scripts may
    // safely request the same tables, but must not run their dialect's DDL.
    if (/^\s*CREATE TABLE IF NOT EXISTS\b/i.test(sql)) return [{ affectedRows: 0 }];
    const { text, bindings } = sqliteStatement(sql, parameters);
    try {
      const statement = database.prepare(text);
      if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(text)) return [statement.all(...bindings)];
      const result = statement.run(...bindings);
      return [{ affectedRows: Number(result.changes), insertId: Number(result.lastInsertRowid) }];
    } catch (error) {
      if (/UNIQUE constraint failed/.test(error.message)) error.code = 'ER_DUP_ENTRY';
      throw error;
    }
  }
  async function execute(sql, parameters) { const unlock = await acquire(); try { return run(sql, parameters); } finally { unlock(); } }
  return {
    driver: 'sqlite', filename, query: execute, execute,
    async getConnection() {
      const unlock = await acquire(); let active = false, released = false;
      return {
        query: async (sql, parameters) => run(sql, parameters), execute: async (sql, parameters) => run(sql, parameters),
        async beginTransaction() { database.exec('BEGIN IMMEDIATE'); active = true; },
        async commit() { database.exec('COMMIT'); active = false; },
        async rollback() { if (active) { database.exec('ROLLBACK'); active = false; } },
        release() { if (released) return; if (active) database.exec('ROLLBACK'); released = true; unlock(); }
      };
    },
    async end() { const unlock = await acquire(); try { database.close(); } finally { unlock(); } }
  };
}
