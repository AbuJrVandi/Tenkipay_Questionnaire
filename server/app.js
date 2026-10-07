import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { existsSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { pool, getQuestionnaire, parseJson } from './db.js';
import { cleanAnswers, validateAnswers, initialQuestionnaire } from '../shared/questionnaire.js';
import { aggregate, exportColumns, csvCell, safeCell } from './analytics.js';
import { generateAddress } from './adrehs.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const app = express();
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { 'script-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'style-src': ["'self'", "'unsafe-inline'"], 'connect-src': ["'self'"], 'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null } }, strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false }));
app.use(express.json({ limit: '128kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please wait a minute.' } }));
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const allowed = new Set([process.env.APP_ORIGIN || 'http://localhost:5173']);
    if (process.env.NODE_ENV !== 'production') ['http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'].forEach(o => allowed.add(o));
    if (!allowed.has(req.get('origin')) || req.get('x-tenkipay-client') !== 'web') return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  next();
});
async function requireAdmin(req, res, next) {
  const token = req.cookies.tenkipay_session;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return res.status(401).json({ error: 'Please sign in to continue.' });
  const [rows] = await pool.execute('SELECT a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()', [hash(token)]);
  if (!rows.length) return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  req.admin = rows[0]; next();
}
const audit = (admin, action, details = {}) => pool.execute('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)', [admin.id, action, JSON.stringify(details)]);
const limiter = (limit, minutes) => rateLimit({ limit, windowMs: minutes * 60000, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } });
app.get('/api/health', async (_req, res) => { try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); } catch { res.status(503).json({ status: 'unavailable', error: 'MySQL is unavailable. Check the database configuration.' }); } });
app.post('/api/auth/login', limiter(10, 15), async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || password.length > 200) return res.status(400).json({ error: 'Enter your email and password.' });
  const [rows] = await pool.execute('SELECT * FROM admins WHERE email = ?', [email.trim().toLowerCase()]);
  const valid = await bcrypt.compare(password, rows[0]?.password_hash || '$2b$12$zTUlEaHRhkQS1EFKhIizsONxfiyK.iVifhGpWVa.QQMjuEmReYXHq');
  if (!rows[0] || !valid) return res.status(401).json({ error: 'The email or password is incorrect.' });
  const token = randomBytes(32).toString('hex');
  await pool.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
  await pool.execute('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))', [hash(token), rows[0].id]);
  await audit(rows[0], 'login');
  res.cookie('tenkipay_session', token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 }).json({ email: rows[0].email });
});
app.get('/api/auth/me', requireAdmin, (req, res) => res.json(req.admin));
app.post('/api/auth/logout', requireAdmin, async (req, res) => { await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [hash(req.cookies.tenkipay_session)]); res.clearCookie('tenkipay_session', cookieOptions).json({ ok: true }); });
app.get('/api/public/questionnaire', async (_req, res) => res.json(await getQuestionnaire()));
app.post('/api/public/submissions', limiter(30, 15), async (req, res) => {
  const { answers, version, requestKey } = req.body;
  if (!answers || Array.isArray(answers) || typeof answers !== 'object' || !uuidPattern.test(requestKey || '')) return res.status(400).json({ error: 'Invalid submission.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM questionnaires WHERE id = 1 FOR SHARE');
    const [existing] = await connection.execute('SELECT id FROM submissions WHERE request_key = ?', [requestKey]);
    if (existing.length) { await connection.commit(); return res.json({ id: existing[0].id, duplicate: true }); }
    const schema = await getQuestionnaire(connection);
    if (!schema.accepting) { await connection.rollback(); return res.status(409).json({ error: 'This questionnaire is not currently accepting responses.' }); }
    if (version !== schema.version) { await connection.rollback(); return res.status(409).json({ error: 'The questionnaire was updated. Reload the form and review your answers before submitting.', code: 'VERSION_CHANGED' }); }
    const cleaned = cleanAnswers(schema, answers);
    const errors = validateAnswers(schema, cleaned);
    if (Object.keys(errors).length) { await connection.rollback(); return res.status(422).json({ error: 'Please check the highlighted answers.', fields: errors }); }
    const id = randomUUID();
    const review = cleaned.consent === 'Yes' && (cleaned.outletGps ? cleaned.outletGps.accuracy > 30 : ['Yes', 'Maybe'].includes(cleaned.interest));
    await connection.execute('INSERT INTO submissions (id, request_key, questionnaire_version, answers, interest, district, contact_consent, gps_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, requestKey, version, JSON.stringify(cleaned), cleaned.interest || null, cleaned.district || null, cleaned.contactConsent === 'Yes', review]);
    await connection.commit(); res.status(201).json({ id });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') { const [rows] = await pool.execute('SELECT id FROM submissions WHERE request_key = ?', [requestKey]); if (rows.length) return res.json({ id: rows[0].id, duplicate: true }); }
    throw error;
  } finally { connection.release(); }
});
app.post('/api/public/adrehs', limiter(10, 15), async (req, res) => {
  const { gps, publicConsent, participationConsent } = req.body;
  if (publicConsent !== true || participationConsent !== true) return res.status(422).json({ error: 'Participation and public registry permission are required.' });
  if (!gps || !Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude) || !Number.isFinite(gps.accuracy) || gps.accuracy < 0 || gps.latitude < -90 || gps.latitude > 90 || gps.longitude < -180 || gps.longitude > 180) return res.status(422).json({ error: 'Capture a valid outlet GPS point first.' });
  const schema = await getQuestionnaire();
  if (!schema.accepting) return res.status(409).json({ error: 'The form is closed.' });
  res.json(await generateAddress(gps));
});
app.use('/api/admin', requireAdmin);
app.get('/api/admin/questionnaire', async (_req, res) => res.json(await getQuestionnaire()));
app.put('/api/admin/questionnaire', async (req, res) => {
  const input = req.body;
  if (typeof input.title !== 'string' || input.title.trim().length < 5 || input.title.length > 200 || typeof input.description !== 'string' || input.description.length > 3000 || typeof input.notice !== 'string' || input.notice.length > 3000 || typeof input.accepting !== 'boolean' || !Array.isArray(input.questions) || input.questions.length !== initialQuestionnaire.questions.length) return res.status(422).json({ error: 'Check the form title, description and questions.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM questionnaires WHERE id = 1 FOR UPDATE');
    const current = await getQuestionnaire(connection);
    if (input.version !== current.version) { await connection.rollback(); return res.status(409).json({ error: 'Another update was saved. Reload the editor before saving.' }); }
    const questions = current.questions.map(q => {
      const edit = input.questions.find(item => item.id === q.id);
      if (!edit || typeof edit.label !== 'string' || !edit.label.trim() || edit.label.length > 600 || (edit.help != null && (typeof edit.help !== 'string' || edit.help.length > 1000))) throw Object.assign(new Error('Each question needs a label of up to 600 characters.'), { status: 422 });
      return { ...q, label: edit.label.trim(), help: edit.help || '' };
    });
    const schema = { title: input.title.trim(), description: input.description.trim(), notice: input.notice.trim(), questions };
    const version = current.version + 1;
    await connection.execute('INSERT INTO questionnaire_versions (version, schema_json) VALUES (?, ?)', [version, JSON.stringify(schema)]);
    await connection.execute('UPDATE questionnaires SET schema_json = ?, version = ?, accepting = ? WHERE id = 1', [JSON.stringify(schema), version, input.accepting]);
    await connection.execute('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)', [req.admin.id, 'questionnaire.updated', JSON.stringify({ version })]);
    await connection.commit(); res.json({ ...schema, version, accepting: input.accepting });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
});
function filters(query) {
  const conditions = [], params = [];
  for (const key of ['from', 'to']) if (query[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(query[key]) || !Number.isFinite(Date.parse(query[key])))) throw Object.assign(new Error('Invalid date filter.'), { status: 400 });
  if (query.from && query.to && query.from > query.to) throw Object.assign(new Error('Start date must be before end date.'), { status: 400 });
  if (query.from) { conditions.push('created_at >= ?'); params.push(query.from); }
  if (query.to) { conditions.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(query.to); }
  for (const key of ['district', 'interest']) if (query[key]) { if (typeof query[key] !== 'string' || query[key].length > 100) throw Object.assign(new Error('Invalid filter.'), { status: 400 }); conditions.push(`${key} = ?`); params.push(query[key]); }
  if (query.search) { if (typeof query.search !== 'string' || query.search.length > 100) throw Object.assign(new Error('Search is too long.'), { status: 400 }); conditions.push('(LOWER(JSON_UNQUOTE(JSON_EXTRACT(answers, "$.applicantName"))) LIKE ? OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(answers, "$.businessName"))) LIKE ?)'); params.push(`%${query.search.toLowerCase()}%`, `%${query.search.toLowerCase()}%`); }
  return { where: conditions.length ? ' WHERE ' + conditions.join(' AND ') : '', params };
}
async function allRows(query) { const { where, params } = filters(query); const [rows] = await pool.execute('SELECT * FROM submissions' + where + ' ORDER BY created_at DESC, id DESC', params); return rows.map(r => ({ ...r, answers: parseJson(r.answers) })); }
app.get('/api/admin/analytics', async (req, res) => res.json(aggregate(await allRows(req.query), await getQuestionnaire())));
app.get('/api/admin/responses', async (req, res) => {
  const { where, params } = filters(req.query);
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page) || 1));
  const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM submissions' + where, params);
  const [rows] = await pool.query('SELECT * FROM submissions' + where + ' ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET ?', [...params, (page - 1) * 20]);
  res.json({ total: count.total, page, pageSize: 20, rows: rows.map(r => ({ ...r, answers: parseJson(r.answers) })) });
});
app.get('/api/admin/responses/:id', async (req, res) => {
  const [rows] = await pool.execute('SELECT s.*, v.schema_json FROM submissions s JOIN questionnaire_versions v ON v.version = s.questionnaire_version WHERE s.id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Response not found.' });
  res.json({ ...rows[0], answers: parseJson(rows[0].answers), schema: parseJson(rows[0].schema_json), schema_json: undefined });
});
app.get('/api/admin/export/:format', async (req, res) => {
  if (!['csv', 'json', 'xlsx'].includes(req.params.format)) return res.status(400).json({ error: 'Choose CSV, JSON or XLSX.' });
  const rows = await allRows(req.query), schema = await getQuestionnaire();
  await audit(req.admin, 'responses.exported', { format: req.params.format, count: rows.length });
  const name = `tenkipay-responses-${new Date().toISOString().slice(0, 10)}.${req.params.format}`;
  res.attachment(name);
  if (req.params.format === 'json') {
    const versions = [...new Set(rows.map(r => r.questionnaire_version))];
    const [history] = versions.length ? await pool.query('SELECT version, schema_json FROM questionnaire_versions WHERE version IN (?)', [versions]) : [[]];
    return res.json({ exportedAt: new Date().toISOString(), count: rows.length, questionnaireVersions: history.map(v => ({ version: v.version, schema: parseJson(v.schema_json) })), responses: rows.map(({ request_key, ...r }) => r) });
  }
  const { columns, records } = exportColumns(schema, rows);
  if (req.params.format === 'csv') return res.type('text/csv; charset=utf-8').send('\uFEFF' + [columns, ...records].map(row => row.map(csvCell).join(',')).join('\r\n'));
  const book = new ExcelJS.Workbook(); book.creator = 'TenkiPay'; book.created = new Date();
  const sheet = book.addWorksheet('Agent responses', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(columns); records.forEach(row => sheet.addRow(row.map(safeCell)));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087E68' } };
  sheet.columns.forEach(column => { column.width = 28; column.alignment = { vertical: 'top', wrapText: true }; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  const dictionary = book.addWorksheet('Field dictionary'); dictionary.addRow(['Field ID', 'Current question', 'Type', 'Note']);
  schema.questions.forEach(q => dictionary.addRow([q.id, q.label, q.type, 'Questionnaire version is included per response. JSON export includes historical wording.']));
  dictionary.columns.forEach(c => { c.width = 40; });
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); await book.xlsx.write(res); res.end();
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
if (existsSync(path.resolve('dist/index.html'))) { app.use(express.static(path.resolve('dist'))); app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html'))); }
app.use((error, _req, res, _next) => {
  if (res.headersSent) return res.end();
  const status = error.status || (error.code?.startsWith('ER_') || error.code === 'ECONNREFUSED' ? 503 : error.name === 'TimeoutError' ? 504 : 500);
  console.error('Request failed:', error.code || error.name, status);
  res.status(status).json({ error: status < 500 || error.status ? error.message : status === 503 ? 'The database is unavailable. Please try again shortly.' : 'The request could not be completed. Please try again.' });
});
