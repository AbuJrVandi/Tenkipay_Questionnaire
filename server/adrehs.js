export async function generateAddress(gps, fetcher = fetch) {
  const endpoint = process.env.ADREHS_CREATE_URL || 'https://api.adrehs.org/addresses/generate';
  if (new URL(endpoint).protocol !== 'https:') throw Object.assign(new Error('Adrehs requires an HTTPS endpoint.'), { status: 503 });
  const result = await fetcher(endpoint, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(process.env.ADREHS_API_KEY ? { Authorization: `Bearer ${process.env.ADREHS_API_KEY}` } : {}) },
    body: JSON.stringify({ lat: gps.latitude, lng: gps.longitude }), signal: AbortSignal.timeout(15000)
  });
  if (!result.ok) throw Object.assign(new Error(result.status === 404 ? 'This point is outside Adrehs coverage.' : 'Adrehs could not confirm registration. Check the location on Adrehs before retrying.'), { status: 502 });
  const data = await result.json();
  if (typeof data.digital_id !== 'string' && typeof data.code !== 'string') throw Object.assign(new Error('Adrehs returned an unexpected response. Please check on Adrehs.'), { status: 502 });
  return { code: data.digital_id || data.code, shortCode: data.code || '', district: data.district || '', districtCode: data.district_code || '', region: data.region || '', chiefdom: data.chiefdom || '', section: data.section || '', coords: data.coords || { lat: gps.latitude, lng: gps.longitude }, publicConsent: true, registeredAt: new Date().toISOString(), url: `https://adrehs.org/?code=${encodeURIComponent(data.code || data.digital_id)}` };
}
