import 'dotenv/config';
import pg from 'pg';

const { Pool, types } = pg;

// Keep timestamp columns as strings, as the application and exports expect.
types.setTypeParser(types.builtins.TIMESTAMP, value => value);
types.setTypeParser(types.builtins.TIMESTAMPTZ, value => value);

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined;
const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, max: 10, ssl }
  : {
      host: process.env.PGHOST || '127.0.0.1',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'tenkipay',
      max: 10,
      ssl
    };

export const pool = new Pool(config);
export const parseJson = value => typeof value === 'string' ? JSON.parse(value) : value;
export async function getQuestionnaire(connection = pool) {
  const { rows } = await connection.query('SELECT * FROM questionnaires WHERE id = 1');
  if (!rows.length) throw new Error('Run npm run db:setup first.');
  return { ...parseJson(rows[0].schema_json), version: rows[0].version, accepting: !!rows[0].accepting, updatedAt: rows[0].updated_at };
}
