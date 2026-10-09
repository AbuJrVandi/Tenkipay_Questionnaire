import { randomUUID } from 'node:crypto';
export async function generateAddress(gps, fetcher = fetch) {
  const endpoint = process.env.ADREHS_CREATE_URL || 'https://api.adrehs.org/addresses/generate';
  if (new URL(endpoint).protocol !== 'https:') throw Object.assign(new Error('Adrehs requires an HTTPS endpoint.'), { status: 503 });
  const result = await fetcher(endpoint, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(process.env.ADREHS_API_KEY ? { Authorization: `Bearer ${process.env.ADREHS_API_KEY}` } : {}) },
    body: JSON.stringify({ lat: gps.latitude, lng: gps.longitude }), signal: AbortSignal.timeout(15000)
  });
  if (!result.ok) throw Object.assign(new Error(result.status === 404 ? 'This point is outside Adrehs coverage.' : 'Adrehs could not confirm registration. Check the location on Adrehs before retrying.'), { status: 502 });
  const data = await result.json();
  if (![data.digital_id, data.code].some(code => typeof code === 'string' && code.trim() && code.length <= 80)) throw Object.assign(new Error('Adrehs returned an unexpected response. Please check on Adrehs.'), { status: 502 });
  const text = key => typeof data[key] === 'string' ? data[key] : '';
  return { code: text('digital_id') || text('code'), shortCode: text('code'), name: text('name'), address: text('address'), district: text('district'), districtCode: text('district_code'), region: text('region'), chiefdom: text('chiefdom'), section: text('section'), coords: data.coords || { lat: gps.latitude, lng: gps.longitude }, publicConsent: true, registeredAt: new Date().toISOString(), url: `https://adrehs.org/?code=${encodeURIComponent(text('code') || text('digital_id'))}` };
}

export async function registerAddress(gps, database, fetcher = fetch) {
  const address = await generateAddress(gps, fetcher);
  const registrationId = randomUUID();
  const saved = { ...address, registrationId };
  try {
    await database.execute('INSERT INTO adrehs_registrations (id, gps_json, address_json) VALUES (?, ?, ?)', [registrationId, JSON.stringify(gps), JSON.stringify(saved)]);
  } catch (cause) {
    throw Object.assign(new Error('Adrehs confirmed this address, but it could not be saved to the questionnaire database. Keep this location and retry when the service is available. The address may already exist on Adrehs.', { cause }), { status: 503 });
  }
  return saved;
}

export async function verifiedRegistration(value, gps, database) {
  const fail = () => { throw Object.assign(new Error('Create an Adrehs code for the current captured location before submitting.'), { status: 422 }); };
  if (!value?.registrationId || !gps) fail();
  const [rows] = await database.execute('SELECT gps_json, address_json FROM adrehs_registrations WHERE id = ?', [value.registrationId]);
  if (!rows.length) fail();
  const parse = input => typeof input === 'string' ? JSON.parse(input) : input;
  const savedGps = parse(rows[0].gps_json), address = parse(rows[0].address_json);
  if (savedGps.latitude !== gps.latitude || savedGps.longitude !== gps.longitude || address.code !== value.code || value.publicConsent !== true) fail();
  return address;
}
