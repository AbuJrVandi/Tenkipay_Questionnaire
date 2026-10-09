import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAddress, verifiedRegistration } from '../server/adrehs.js';
import { numberQuestions } from '../shared/numbering.js';
const gps = { latitude: 8.48, longitude: -13.23, accuracy: 4 };
const upstream = async () => ({ ok: true, json: async () => ({ digital_id: 'WAU TEST CODE', code: 'TEST CODE', address: 'Outlet address', name: 'Outlet', district: 'WESTERN AREA URB', coords: { lat: gps.latitude, lng: gps.longitude } }) });
test('successful Adrehs reply is persisted and trusted metadata is restored on submission', async () => {
  let stored;
  const database = { execute: async (sql, parameters) => {
    if (sql.startsWith('INSERT')) { stored = { gps_json: parameters[1], address_json: parameters[2] }; return []; }
    return [[stored]];
  } };
  const result = await registerAddress(gps, database, upstream);
  assert.ok(result.registrationId);
  assert.equal(result.address, 'Outlet address');
  assert.equal(JSON.parse(stored.address_json).code, result.code);
  const verified = await verifiedRegistration({ ...result, address: 'Forged', district: 'Forged' }, gps, database);
  assert.equal(verified.address, 'Outlet address');
  assert.equal(verified.district, 'WESTERN AREA URB');
  await assert.rejects(() => verifiedRegistration(result, { ...gps, latitude: 9 }, database), /current captured location/);
  await assert.rejects(() => verifiedRegistration({ ...result, code: 'OTHER' }, gps, database), /current captured location/);
});
test('unconfirmed registration and database persistence failures are explicit', async () => {
  await assert.rejects(() => verifiedRegistration({}, gps, {}), /Create an Adrehs code/);
  await assert.rejects(() => verifiedRegistration({ registrationId: 'missing' }, gps, { execute: async () => [[]] }), /Create an Adrehs code/);
  await assert.rejects(() => registerAddress(gps, { execute: async () => { throw new Error('Database offline'); } }, upstream), /could not be saved to the questionnaire database/);
  await assert.rejects(() => registerAddress(gps, {}, async () => ({ ok: true, json: async () => ({ code: ' ' }) })), /unexpected response/);
});
test('numbering follows the stored order and preserves stable identities', () => {
  const questions = [{ id: 'consent', number: 'I' }, { id: 'outletGps', number: '1' }, { id: 'custom_x', number: '38' }];
  const numbered = numberQuestions(questions);
  assert.deepEqual(numbered.map(q => q.number), ['1', '2', '3']);
  assert.deepEqual(numbered.map(q => q.id), questions.map(q => q.id));
  assert.equal(questions[0].number, 'I');
});
