export function aggregate(rows, schema) {
  if (schema.template === 'existing-agent-network') rows = rows.filter(r => r.template === schema.template || r.answers.net_recordType);
  const accepted = rows.filter(r => r.answers.consent === 'Yes');
  const applicants = schema.template === 'existing-agent-network' ? accepted : accepted.filter(r => ['Yes', 'Maybe'].includes(r.answers.interest));
  const counts = id => {
    const q = schema.questions.find(q => q.id === id);
    const map = new Map((q?.options || []).map(o => [o, 0]));
    for (const row of accepted) {
      const v = row.answers[id];
      for (const item of Array.isArray(v) ? v : v ? [v] : []) map.set(item, (map.get(item) || 0) + 1);
    }
    return [...map].map(([name, value]) => ({ name, value }));
  };
  const dates = new Map();
  for (const row of rows) { const day = String(row.created_at).slice(0, 10); dates.set(day, (dates.get(day) || 0) + 1); }
  const trend = [];
  if (dates.size) {
    const first = new Date([...dates.keys()].sort()[0] + 'T00:00:00Z');
    const last = new Date([...dates.keys()].sort().at(-1) + 'T00:00:00Z');
    for (let date = first; date <= last; date.setUTCDate(date.getUTCDate() + 1)) { const day = date.toISOString().slice(0, 10); trend.push({ date: day, responses: dates.get(day) || 0 }); }
  }
  return {
    demoResponses: rows.filter(r => r.answers.demoData === true).length,
    activeOutlets: accepted.filter(r => r.answers.net_status === 'Actively providing services').length,
    total: rows.length, participants: accepted.length, interested: accepted.filter(r => r.answers.interest === 'Yes').length,
    contactable: accepted.filter(r => r.answers.contactConsent === 'Yes' || r.answers.net_followup?.startsWith('Yes')).length,
    districts: new Set(applicants.map(r => r.answers.district).filter(Boolean)).size,
    gpsReview: rows.filter(r => r.gps_review).length,
    locations: { captured: accepted.filter(r => r.answers.outletGps).length, registered: accepted.filter(r => r.answers.adrehs?.code).length, accurate: accepted.filter(r => r.answers.outletGps?.accuracy <= 30).length, districts: Object.entries(accepted.reduce((acc, r) => { const district = r.answers.adrehs?.district; if (district) acc[district] = (acc[district] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value })) },
    interest: counts('interest'), district: counts('district').filter(d => d.value).sort((a, b) => b.value - a.value),
    customerActivity: counts('dailyCustomers').filter(d => d.name !== 'Unsure'), customerUnknown: counts('dailyCustomers').find(d => d.name === 'Unsure')?.value || 0,
    trend, questions: Object.fromEntries(schema.questions.filter(q => q.options).map(q => [q.id, counts(q.id)]))
  };
}
export function exportColumns(schema, rows) {
  const keys = new Set(schema.questions.map(q => q.id));
  for (const row of rows) for (const key of Object.keys(row.answers)) keys.add(key);
  const columns = ['Response ID', 'Submitted (UTC)', 'Questionnaire version', 'GPS needs review'];
  const answerKeys = [...keys].filter(k => k !== 'outletGps' && k !== 'adrehs');
  columns.push(...answerKeys.map(k => schema.questions.find(q => q.id === k)?.label || k), 'GPS latitude', 'GPS longitude', 'GPS altitude', 'GPS accuracy (m)', 'Adrehs code', 'Adrehs public permission', 'Adrehs district', 'Adrehs region', 'Adrehs chiefdom', 'Adrehs section', 'Adrehs address', 'Adrehs place name', 'Adrehs short code', 'Adrehs registration ID');
  return { columns, records: rows.map(r => [r.id, String(r.created_at), r.questionnaire_version, r.gps_review ? 'Yes' : 'No', ...answerKeys.map(k => Array.isArray(r.answers[k]) ? r.answers[k].map(v => typeof v === 'object' ? `${v.institution}: ${v.paymentType}` : v).join('; ') : r.answers[k] ?? ''), r.answers.outletGps?.latitude ?? '', r.answers.outletGps?.longitude ?? '', r.answers.outletGps?.altitude ?? '', r.answers.outletGps?.accuracy ?? '', r.answers.adrehs?.code ?? '', r.answers.adrehs?.publicConsent ? 'Yes' : '', r.answers.adrehs?.district || '', r.answers.adrehs?.region || '', r.answers.adrehs?.chiefdom || '', r.answers.adrehs?.section || '', r.answers.adrehs?.address || '', r.answers.adrehs?.name || '', r.answers.adrehs?.shortCode || '', r.answers.adrehs?.registrationId || '']) };
}
export const safeCell = v => typeof v === 'string' && /^[\s]*[=+@\-\t\r]/.test(v) ? `'${v}` : v;
export const csvCell = v => `"${String(safeCell(v)).replaceAll('"', '""')}"`;
