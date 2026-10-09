import { createHash } from 'node:crypto';
import { pool, getQuestionnaire, databaseDriver } from '../server/db.js';
import { districts, isVisible, cleanAnswers, validateAnswers } from '../shared/questionnaire.js';
const day = offset => new Date(Date.UTC(2026, 9, 8 + offset)).toISOString().slice(0, 10);
function stableId(value) {
  const hash = createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
function makeAnswers(schema, index) {
  const serial = String(index + 1).padStart(3, '0');
  const district = districts[index % districts.length];
  const interview = day(-(index % 30));
  const inactive = index % 8 >= 5;
  const reportingEnd = day(-(index % 30) - (inactive ? 6 : 1));
  const reportingStart = day(-(index % 30) - (inactive ? 35 : 30));
  const answers = {
    consent: index >= 46 ? 'No' : 'Yes',
    outletGps: { latitude: Number((7.1 + index % 16 * 0.15).toFixed(6)), longitude: Number((-12.9 + index % 12 * 0.12).toFixed(6)), accuracy: index % 9 === 0 ? 45 : 4 + index % 12, capturedAt: `${interview}T10:00:00.000Z` },
    net_interviewDate: interview, net_interviewer: `DEMO-OFFICER-${index % 4 + 1}`, net_method: 'On-site visit',
    net_recordType: index % 3 === 0 ? 'Update of existing record' : 'Initial profile verification',
    net_idStatus: index % 11 === 0 ? 'Unavailable — requires verification' : 'Available', net_agentId: `DEMO-AGENT-${serial}`,
    businessName: `Demo ${district} Agent Outlet ${serial}`, net_outletName: `Demo Outlet ${serial}`, net_outletId: `DEMO-OUTLET-${serial}`,
    applicantName: `Demo Agent ${serial}`, net_role: index % 3 === 0 ? 'Manager' : 'Registered agent / owner',
    net_multipleOutlets: index % 4 === 0 ? 'Yes' : 'No', net_outletCount: String(2 + index % 3),
    district, community: `Demo community ${index % 6 + 1}`, address: `Fictional outlet ${serial}, demonstration address only`, net_landmark: 'Illustrative market entrance',
    net_locationChanged: index % 5 === 0 ? 'Yes' : 'No', net_previousLocation: 'Previous fictional demonstration address',
    net_primaryName: `Demo Operational Contact ${serial}`, net_primaryRole: 'Outlet manager', phone: `+23200000${serial}`, email: `demo.agent${serial}@example.test`,
    net_primaryChannel: index % 3 === 0 ? 'Email' : 'Phone call', net_altPermission: index % 4 === 0 ? 'Yes' : 'No', net_altName: `Demo Alternative Contact ${serial}`, net_altRole: 'Supervisor', net_altPhone: `+23200001${serial}`,
    net_status: index % 8 < 5 ? 'Actively providing services' : index % 8 < 7 ? 'Temporarily inactive' : 'Stopped providing services',
    net_stoppedDate: day(-(index % 30) - 5), net_stoppedReason: index % 2 ? 'Equipment replacement needed.' : 'Outlet relocation is pending.',
    net_startKnown: index % 7 === 0 ? 'Unsure' : 'Month and year known', net_startMonth: `2025-${String(index % 12 + 1).padStart(2, '0')}`,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], net_hours: index % 6 === 0 ? 'Hours vary' : 'Fixed hours', openingTime: '08:00', closingTime: '18:00', net_hoursExplanation: 'Hours vary with market activity, generally 08:00–18:00.',
    services: index % 8 === 7 ? ['No services currently offered'] : ['Deposits into customer wallets', 'Cash withdrawals', 'Assisted payments'],
    resources: index % 4 === 0 ? ['Smartphone', 'Internet connection', 'Electricity', 'Backup power or charging facilities', 'Secure cash storage'] : ['Smartphone', 'Internet connection', 'Electricity'],
    net_periodAvailable: index % 10 === 0 ? 'No completed operating days in the reporting period' : 'Completed operating days available',
    net_datesKnown: index % 13 === 0 ? 'Dates cannot be confirmed' : 'Dates confirmed', net_periodStart: reportingStart, net_periodEnd: reportingEnd,
    net_daysKnown: index % 7 === 0 ? 'Unable to confirm' : 'Days confirmed', net_operatingDays: String(15 + index % 11),
    net_revenueCollection: index % 4 < 2 ? 'Yes' : index % 4 === 2 ? 'No' : 'Unsure',
    net_institutions: [{ institution: `Demo institution ${serial}`, paymentType: index % 2 ? 'Utility bills' : 'School fees' }],
    net_revenueTypes: index % 2 ? ['Utility bills', 'Business or merchant payments'] : ['School or university fees'],
    net_totalStatus: index % 9 === 0 ? 'Records unavailable and unable to estimate' : 'Amount available', net_totalRevenue: String(3000 + index * 425), net_totalSource: index % 3 === 0 ? 'Respondent’s estimate' : 'Transaction records',
    net_typicalStatus: 'Estimate available', net_typicalRevenue: String(120 + index * 18), net_transactionKnown: 'Number available', net_revenueTransactions: String(5 + index % 20),
    net_reconciliation: index % 3 === 0 ? 'On some operating days' : 'Yes, every operating day', net_unresolved: index % 6 === 0 ? 'Yes' : 'No', net_unresolvedCount: '2', net_unresolvedValue: '250', net_unresolvedIssue: 'Failed or delayed payment', net_unresolvedDetails: 'Two demonstration payments remain pending; no customer data included.',
    net_activity: ['1–5', '6–10', '11–20', '21–50', 'More than 50'][index % 5], net_demand: index % 2 ? 'Cash withdrawals' : 'Wallet deposits',
    net_training: ['Yes', 'Partly', 'No', 'I did not receive training'][index % 4], net_usability: ['Very easy', 'Easy', 'Neither easy nor difficult', 'Difficult'][index % 4],
    net_transactionBarriers: index % 4 === 0 ? ['No significant barriers'] : ['Poor internet connectivity', 'Insufficient cash'],
    net_growthBarriers: index % 5 === 0 ? ['No significant barriers'] : ['Limited customer awareness', 'Outlet location or visibility'],
    net_cashEase: index % 3 ? 'Easy' : 'Difficult', net_balanceEase: index % 4 ? 'Easy' : 'Difficult',
    net_supportKnown: index % 7 === 0 ? 'No' : 'Yes', net_supportContacted: index % 3 === 0 ? 'Yes' : 'No',
    net_supportSatisfaction: ['Satisfied', 'Very satisfied', 'Dissatisfied'][index % 3], net_supportResolved: index % 2 ? 'Partly resolved' : 'Fully resolved',
    net_supportNeeds: index % 6 === 0 ? ['No additional support needed'] : ['Refresher training', 'Faster technical support', 'Branding and customer awareness support'],
    net_overallSatisfaction: ['Very satisfied', 'Satisfied', 'Neither satisfied nor dissatisfied', 'Dissatisfied'][index % 4],
    net_continue: index % 8 === 7 ? 'No' : index % 5 === 0 ? 'Undecided' : 'Yes', net_continueReason: 'The demonstration outlet needs improved connectivity and working capital.', net_resumeChanges: 'Replace equipment and complete refresher training.',
    net_improvement: 'Provide clearer reconciliation reports and faster support during operating hours.',
    net_verification: index % 9 === 0 ? 'Some details require confirmation' : 'Yes', net_corrections: 'Verify the illustrative agent ID and outlet details.',
    net_followup: index % 4 === 0 ? 'No' : index % 4 === 1 ? 'Yes — use a different contact' : 'Yes — use the operational contact provided', net_followupName: `Demo Feedback Contact ${serial}`, net_followupMethod: index % 2 ? 'Email' : 'Phone call', net_followupEmail: `demo.feedback${serial}@example.test`, net_followupPhone: `+23200002${serial}`,
    net_interviewerStatus: index % 9 === 0 ? 'Further verification required' : 'Details confirmed', net_outstanding: 'Demo record — do not contact or use for operational decisions.', net_verifiedDate: interview, net_verifiedBy: `DEMO-VERIFIER-${index % 3 + 1}`
  };
  for (const q of schema.questions) {
    if (!q.required || !isVisible(q, answers) || answers[q.id] != null || ['adrehs', 'calculated'].includes(q.type)) continue;
    answers[q.id] = q.options ? q.type === 'multi' ? [q.options[0]] : q.options[0] : q.type === 'date' ? interview : q.type === 'month' ? '2025-01' : q.type === 'time' ? '09:00' : q.type === 'number' ? String(q.min || 0) : q.type === 'tel' ? '+23200000000' : q.type === 'email' ? 'demo@example.test' : 'Demonstration answer';
  }
  const cleaned = cleanAnswers(schema, answers);
  const errors = validateAnswers(schema, cleaned);
  if (Object.keys(errors).length) throw new Error(`Demo ${serial} failed validation: ${JSON.stringify(errors)}`);
  return { ...cleaned, demoData: true, demoDataset: 'tenkipay-network-demo-v1', demoNotice: 'Synthetic profile, contacts and GPS for local demonstration only. No public Adrehs address created.' };
}
try {
  if (databaseDriver !== 'sqlite' || process.env.NODE_ENV === 'production') throw new Error('Demo seeding is restricted to local SQLite testing.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const schema = await getQuestionnaire(connection);
    if (schema.template !== 'existing-agent-network') throw new Error('The existing-agent questionnaire must be installed first.');
    let added = 0;
    for (let index = 0; index < 48; index++) {
      const id = stableId(`tenkipay-network-demo-v1:${index}`);
      const [existing] = await connection.execute('SELECT id FROM submissions WHERE id = ?', [id]);
      if (existing.length) continue;
      const answers = makeAnswers(schema, index);
      await connection.execute('INSERT INTO submissions (id, request_key, questionnaire_version, answers, district, contact_consent, gps_review, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, stableId(`demo-request:${index}`), schema.version, JSON.stringify(answers), answers.district || null, Boolean(answers.net_followup?.startsWith('Yes')), Boolean(answers.outletGps?.accuracy > 30), `${day(-(index % 30))} ${String(9 + index % 9).padStart(2, '0')}:30:00`]);
      added++;
    }
    await connection.execute('INSERT INTO audit_log (action, details) VALUES (?, ?)', ['demo.responses.seeded', JSON.stringify({ dataset: 'tenkipay-network-demo-v1', added, expected: 48, questionnaireVersion: schema.version })]);
    await connection.commit();
    console.log(`Added ${added} demo responses. Dataset contains 48 clearly labelled synthetic records; existing responses preserved. No Adrehs writes made.`);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { await pool.end(); }
