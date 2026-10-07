import 'dotenv/config';
import { pool, parseJson } from '../server/db.js';
const code = 'WAU W3J AN4';
try {
  const response = await fetch(`https://api.adrehs.org/addresses/${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Adrehs lookup failed (${response.status}). No response was changed.`);
  const address = await response.json();
  if (!Number.isFinite(address.coords?.lat) || !Number.isFinite(address.coords?.lng)) throw new Error('Adrehs did not return coordinates. No response was changed.');
  const [rows] = await pool.query('SELECT id, answers FROM submissions');
  const distance = (gps) => {
    const rad = v => v * Math.PI / 180;
    const a = Math.sin(rad(gps.latitude - address.coords.lat) / 2) ** 2 + Math.cos(rad(gps.latitude)) * Math.cos(rad(address.coords.lat)) * Math.sin(rad(gps.longitude - address.coords.lng) / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const matches = rows.filter(row => { const a = parseJson(row.answers); return a.consent === 'Yes' && a.outletGps && !a.adrehs?.code && distance(a.outletGps) <= Math.max(30, Math.min(a.outletGps.accuracy || 30, 100)); });
  if (matches.length !== 1) throw new Error(`Found ${matches.length} matching responses. No records changed; select the intended response before attaching this code.`);
  const row = matches[0], answers = parseJson(row.answers);
  answers.adrehs = { code: address.digital_id || code, shortCode: address.code || '', district: address.district || '', region: address.region || '', chiefdom: address.chiefdom || '', section: address.section || '', coords: address.coords, publicConsent: true, linkedAt: new Date().toISOString(), source: 'administrator-confirmed-existing-code' };
  await pool.execute('UPDATE submissions SET answers = ? WHERE id = ?', [JSON.stringify(answers), row.id]);
  console.log('Verified matching captured GPS and saved WAU W3J AN4 with its administrative areas to the existing response.');
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { await pool.end(); }
