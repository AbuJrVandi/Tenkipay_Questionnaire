import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureSchema } from '../server/schema.js';
import { registerAddress, verifiedRegistration } from '../server/adrehs.js';

test('startup applies the idempotent schema without replacing saved data', async () => {
  let statement = '';
  await ensureSchema({ query: async sql => { statement = sql; return { rows: [] }; } });
  assert.match(statement, /CREATE TABLE IF NOT EXISTS questionnaires/);
  assert.match(statement, /CREATE TABLE IF NOT EXISTS adrehs_registrations/);
  assert.match(statement, /CREATE TABLE IF NOT EXISTS app_migrations/);
  await assert.rejects(() => ensureSchema({ query: async () => { throw new Error('CREATE denied'); } }), /CREATE denied/);
});

test('Adrehs registrations are saved and must match the captured point', async () => {
  const gps = { latitude: 8.48, longitude: -13.23, accuracy: 4 };
  const address = await registerAddress(gps, { query: async () => ({ rows: [] }) }, async () => ({ ok: true, json: async () => ({ code: 'TEST CODE' }) }));
  const database = { query: async () => ({ rows: [{ gps_json: JSON.stringify(gps), address_json: JSON.stringify(address) }] }) };
  assert.equal((await verifiedRegistration(address, gps, database)).code, 'TEST CODE');
  await assert.rejects(() => verifiedRegistration(address, { ...gps, latitude: 8.49 }, database), /current captured location/);
});
