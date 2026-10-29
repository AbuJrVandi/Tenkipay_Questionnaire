import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';

if (existsSync('.env')) throw new Error('.env already exists. Local bootstrap will not overwrite credentials.');

const database = 'tenkipay';
const role = 'tenkipay';
const dbPassword = randomBytes(24).toString('hex');
const adminPassword = randomBytes(18).toString('base64url');
const adminUrl = process.env.PG_ADMIN_URL || 'postgres://postgres@127.0.0.1:5432/postgres';
const adminUrlParts = new URL(adminUrl);
const databaseHost = adminUrlParts.hostname ? `${adminUrlParts.hostname}:${adminUrlParts.port || 5432}` : '127.0.0.1:5432';
const client = new pg.Client({ connectionString: adminUrl });

try {
  await client.connect();
  const existingRole = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  const password = client.escapeLiteral(dbPassword);
  if (existingRole.rowCount) await client.query(`ALTER ROLE ${role} WITH LOGIN PASSWORD ${password}`);
  else await client.query(`CREATE ROLE ${role} WITH LOGIN PASSWORD ${password}`);

  const existingDatabase = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (!existingDatabase.rowCount) await client.query(`CREATE DATABASE ${database} OWNER ${role} ENCODING 'UTF8' TEMPLATE template0`);
  await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${role}`);
} catch (error) {
  throw new Error(`PostgreSQL bootstrap failed. Set PG_ADMIN_URL to an administrator connection string if the default does not work.\n${error.message}`);
} finally {
  await client.end();
}

const databaseUrl = `postgres://${role}:${encodeURIComponent(dbPassword)}@${databaseHost}/${database}`;
writeFileSync('.env', `NODE_ENV=development\nPORT=3001\nAPP_ORIGIN=http://localhost:5173\nDATABASE_URL=${databaseUrl}\nDATABASE_SSL=false\nADMIN_EMAIL=admin@tenkipay.local\nADMIN_PASSWORD=${adminPassword}\nTRUST_PROXY=false\nADREHS_CREATE_URL=https://api.adrehs.org/addresses/generate\n`);
mkdirSync('.local', { recursive: true });
writeFileSync('.local/LOGIN.txt', `TenkiPay local administrator\n\nURL: http://localhost:5173/admin\nEmail: admin@tenkipay.local\nPassword: ${adminPassword}\n\nThese credentials are for this local installation only. Keep this file private.\n`);
console.log('Local PostgreSQL role and database configured. Configuration saved in .env. Admin sign-in details saved in .local/LOGIN.txt.');
