import 'dotenv/config';
import assert from 'node:assert/strict';
import { app } from '../server/app.js';
import { pool } from '../server/db.js';
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { Origin: 'http://localhost:5173', 'X-TenkiPay-Client': 'web', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@tenkipay.test', password: 'password123' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base + '/api/admin/analytics')).status, 401);
  for (const path of ['/api/health', '/api/admin/analytics', '/api/admin/export/csv', '/api/admin/export/xlsx', '/api/admin/export/json']) assert.equal((await fetch(base + path, { headers: { Cookie: cookie } })).status, 200);
  const schema = await (await fetch(base + '/api/public/questionnaire')).json();
  assert.equal(schema.questions[1].id, 'outletGps');
  console.log('Verified MySQL connection, requested login, private endpoint protection, location-first schema, analytics and all exports.');
} finally { await new Promise(resolve => server.close(resolve)); await pool.end(); }
