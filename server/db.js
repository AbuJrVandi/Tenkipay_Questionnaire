import 'dotenv/config';
import pg from 'pg';

const { Pool, types } = pg;

// Keep timestamp columns as strings, as the application and exports expect.
types.setTypeParser(types.builtins.TIMESTAMP, value => value);
types.setTypeParser(types.builtins.TIMESTAMPTZ, value => value);

// Managed providers such as Aiven require TLS and publish a CA certificate.
// When DATABASE_SSL is set explicitly, it is authoritative over URL SSL options.
const configuredSsl = process.env.DATABASE_SSL;
const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
const sslEnabled = configuredSsl === 'true' || (configuredSsl !== 'false' && Boolean(ca));
const ssl = sslEnabled
  ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false', ...(ca ? { ca } : {}) }
  : configuredSsl === 'false' ? false : undefined;
const stripSslOptions = configuredSsl !== undefined || Boolean(ca);
const connectionString = process.env.DATABASE_URL && stripSslOptions
  ? (() => {
      try {
        const url = new URL(process.env.DATABASE_URL);
        for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) url.searchParams.delete(key);
        return url.toString();
      } catch { return process.env.DATABASE_URL; }
    })()
  : process.env.DATABASE_URL;
const shared = { max: 10, ...(ssl !== undefined ? { ssl } : {}) };
const config = connectionString
  ? { connectionString, ...shared }
  : {
      host: process.env.PGHOST || '127.0.0.1',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'tenkipay',
      ...shared
    };

export const pool = new Pool(config);
export const databaseDriver = 'postgres';
export const parseJson = value => typeof value === 'string' ? JSON.parse(value) : value;
export async function getQuestionnaire(connection = pool) {
  const { rows } = await connection.query('SELECT * FROM questionnaires WHERE id = 1');
  if (!rows.length) throw new Error('Run npm run db:setup first.');
  return { ...parseJson(rows[0].schema_json), version: rows[0].version, accepting: !!rows[0].accepting, updatedAt: rows[0].updated_at };
}
