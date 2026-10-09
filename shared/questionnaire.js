import { createNetworkProfile, profileVisible, dailyAverage } from './network-profile.js';
const single = (id, number, section, label, options, extra = {}) => ({ id, number, section, label, type: 'single', options, required: true, ...extra });
const field = (id, number, section, label, extra = {}) => ({ id, number, section, label, type: 'text', required: true, ...extra });
export const sections = [
  { id: 'A', title: 'Participation & interest', description: 'A few questions to get started.' },
  { id: 'B', title: 'You & your business', description: 'Tell us about yourself and your proposed outlet.' },
  { id: 'C', title: 'Experience & customers', description: 'Help us understand the customers you serve.' },
  { id: 'D', title: 'Operational readiness', description: 'Let’s look at the resources available at your outlet.' },
  { id: 'E', title: 'Support & timeframe', description: 'Tell us what you need to take the next step.' },
  { id: 'F', title: 'Keeping in touch', description: 'You decide whether and how we contact you.' }
];
export const districts = ['Bo', 'Bombali', 'Bonthe', 'Falaba', 'Kailahun', 'Kambia', 'Karene', 'Kenema', 'Koinadugu', 'Kono', 'Moyamba', 'Port Loko', 'Pujehun', 'Tonkolili', 'Western Area Rural', 'Western Area Urban'];
const activity = ['Fewer than 20', '20–49', '50–99', '100 or more', 'Unsure'];
export const legacyQuestionnaire = {
  title: 'TenkiPay Agent Interest and Readiness Questionnaire',
  description: '',
  notice: 'Completing this questionnaire does not guarantee appointment or commit you to becoming an agent. Agent requirements, services and commission terms will be explained before you decide to proceed.',
  questions: [
    single('consent', '1', 'A', 'Do you agree to take part in this questionnaire?', ['Yes', 'No'], { help: 'Participation is voluntary. If you select No, the questionnaire will end.' }),
    single('interest', '2', 'A', 'Are you interested in becoming a TenkiPay agent?', ['Yes', 'Maybe', 'No']),
    field('applicantName', '3', 'B', 'Applicant’s name'),
    field('businessName', '3', 'B', 'Business name', { required: false, help: 'If applicable.' }),
    single('district', '4', 'B', 'District', districts, { type: 'select' }),
    field('community', '4', 'B', 'Town / community'),
    field('address', '4', 'B', 'Address or nearby landmark'),
    single('onSite', '4', 'B', 'Are you physically at the proposed agent outlet?', ['Yes', 'No']),
    single('gpsConsent', '4', 'B', 'Does the applicant agree to record this outlet’s location?', ['Yes', 'No'], { help: 'The point identifies the premises visited. It does not track movements.' }),
    single('gpsStatus', '4', 'B', 'Outlet GPS capture status', ['Captured', 'Not captured']),
    field('outletGps', '4', 'B', 'Record the proposed agent outlet’s GPS location', { type: 'gps', help: 'Stand outdoors near the outlet entrance. Aim for 5 m accuracy. Readings above 30 m need review.' }),
    field('gpsFailureReason', '4', 'B', 'Why could the outlet location not be captured?', { type: 'textarea' }),
    field('enumeratorId', '4', 'B', 'Enumerator / field officer ID'),
    field('visitDate', '4', 'B', 'Outlet visit date', { type: 'date' }),
    field('adrehs', '4', 'B', 'Register the outlet with Adrehs', { type: 'adrehs', required: false, help: 'Optional. Adrehs locations are publicly searchable. Only register the outlet with the applicant’s permission.' }),
    single('businessType', '5', 'B', 'What type of business do you currently operate?', ['Mobile money outlet', 'Retail shop', 'Financial services outlet', 'Other', 'I do not currently operate a business']),
    single('premises', '6', 'B', 'Do you have premises available for agent services?', ['Yes — owned premises', 'Yes — rented premises', 'No — I am still identifying a location']),
    single('experience', '7', 'C', 'Have you worked as a mobile money or payment agent?', ['I currently operate as an agent', 'I previously operated as an agent', 'I have no previous agent experience']),
    field('providers', '7', 'C', 'Which providers have you worked with?', { required: false }),
    single('dailyCustomers', '8a', 'C', 'Approximately how many customers visit your business on a typical day?', activity, { required: false }),
    single('dailyTransactions', '8b', 'C', 'Approximately how many agent transactions do you complete on a typical day?', activity, { required: false }),
    single('services', '9', 'C', 'Which payment services do customers commonly request at your business?', ['Depositing money into a wallet', 'Withdrawing cash', 'Sending or receiving money', 'Assistance making payments', 'Assistance opening or using an account', 'Other', 'None of these services'], { type: 'multi', exclusive: 'None of these services' }),
    single('resources', '10', 'D', 'Which resources would be available at your proposed outlet?', ['Smartphone', 'Computer or tablet', 'Mobile internet or Wi-Fi', 'Electricity', 'Backup power or charging facilities', 'Secure cash storage', 'None of the above'], { type: 'multi', exclusive: 'None of the above' }),
    single('deviceAvailability', '11', 'D', 'Would a smartphone, computer or tablet be available throughout operating hours?', ['Yes — my own device', 'Yes — a shared or business device', 'No', 'Unsure']),
    single('internet', '12', 'D', 'How reliable is internet connectivity at the proposed location?', ['Usually reliable', 'Sometimes interrupted', 'Frequently unavailable', 'Not yet assessed']),
    single('floatWillingness', '13', 'D', 'Would you be willing to maintain cash and money in your TenkiPay agent account to serve customers, subject to the required amounts?', ['Yes', 'Possibly — I need more information', 'No', 'Unsure'], { help: 'Korlie will explain the required amounts before assessing funding capacity.' }),
    single('staffing', '14', 'D', 'Who would serve customers at the outlet?', ['I would', 'An employee', 'Both myself and employees', 'Not yet decided']),
    single('challenges', '15', 'D', 'What challenges could affect your ability to operate as an agent?', ['Maintaining enough cash', 'Maintaining enough money in the agent account', 'Internet connectivity', 'Electricity', 'Security', 'Finding or training staff', 'Getting support when transactions fail', 'Other', 'No significant challenges'], { type: 'multi', maxChoices: 3, exclusive: 'No significant challenges', help: 'Choose up to three.' }),
    single('hoursUndecided', '16', 'D', 'Have you decided your operating days and hours?', ['Yes', 'Not yet decided']),
    field('operatingDays', '16', 'D', 'Days you would normally serve customers'),
    field('openingTime', '16', 'D', 'Opening time', { type: 'time' }),
    field('closingTime', '16', 'D', 'Closing time', { type: 'time' }),
    single('support', '17', 'E', 'What information or support would you need before deciding?', ['Commission structure', 'Required starting cash and agent account balance', 'Documents and steps required to become an agent', 'Training and a demonstration', 'Account and transaction security information', 'Details of agent support', 'Branding or promotional materials', 'Other'], { type: 'multi' }),
    single('timeframe', '18', 'E', 'If approved and trained, when could you start?', ['Within two weeks', 'More than two weeks to one month', 'More than one month to three months', 'More than three months', 'Unsure']),
    single('contactConsent', '19', 'F', 'May Korlie contact you about becoming a TenkiPay agent?', ['Yes', 'No']),
    field('contactName', '19', 'F', 'Contact name'),
    single('contactMethod', '19', 'F', 'Preferred contact method', ['WhatsApp', 'Phone call', 'Email']),
    field('phone', '19', 'F', 'Phone / WhatsApp number', { type: 'tel', help: 'Include the country code, for example +232.' }),
    field('email', '19', 'F', 'Email address', { type: 'email' }),
    field('contactTime', '19', 'F', 'Best time to contact you', { required: false })
  ]
};

// Location is collected before agent interest, immediately after participation consent.
const locationIds = ['onSite', 'gpsConsent', 'gpsStatus', 'outletGps', 'gpsFailureReason', 'adrehs'];
const locationQuestions = locationIds.map(id => ({ ...legacyQuestionnaire.questions.find(q => q.id === id), section: 'A', number: '1', ...(id === 'adrehs' ? { help: 'Confirm the captured point and public registry permission, then create its Adrehs code.' } : {}) }));
legacyQuestionnaire.questions = [legacyQuestionnaire.questions[0], ...locationQuestions, ...legacyQuestionnaire.questions.slice(1).filter(q => !locationIds.includes(q.id))];

export function requireLocation(schema) {
  const removed = ['onSite', 'gpsConsent', 'gpsStatus', 'gpsFailureReason'];
  return { ...schema, questions: schema.questions.filter(q => !removed.includes(q.id)).map(q => q.id === 'consent' ? { ...q, help: 'Participation is voluntary. By selecting Yes, you agree to record your current location for this survey. Location capture is required to continue; your browser will ask for permission. Be at the proposed outlet when completing the survey.' } : q.id === 'outletGps' ? { ...q, section: 'A', required: true, label: 'Capture your current location', help: 'Location capture starts automatically after consent. Enable precise location permission. A valid GPS reading is required to continue.' } : q) };
}
Object.assign(legacyQuestionnaire, requireLocation(legacyQuestionnaire));

export const initialQuestionnaire = createNetworkProfile(legacyQuestionnaire.questions.find(q => q.id === 'outletGps'), legacyQuestionnaire.questions.find(q => q.id === 'adrehs'), districts);

export function isVisible(q, a) {
  if (q.profile) return profileVisible(q, a);
  if (q.id === 'consent') return true;
  if (a.consent !== 'Yes') return false;
  if (['onSite', 'gpsConsent', 'gpsStatus', 'gpsFailureReason'].includes(q.id)) return false;
  if (q.id === 'outletGps') return true;
  if (q.id === 'adrehs') return !!a.outletGps;
  if (q.id === 'interest') return true;
  if (q.section !== 'F' && !['Yes', 'Maybe'].includes(a.interest)) return false;
  if (q.section === 'F' && !a.interest) return false;
  const existing = a.businessType && a.businessType !== 'I do not currently operate a business';
  if (['dailyCustomers', 'services'].includes(q.id)) return !!existing;
  if (q.id === 'dailyTransactions') return a.experience === 'I currently operate as an agent';
  if (q.id === 'providers') return ['I currently operate as an agent', 'I previously operated as an agent'].includes(a.experience);
  if (q.id === 'deviceAvailability') return Array.isArray(a.resources) && a.resources.some(v => ['Smartphone', 'Computer or tablet'].includes(v));
  if (['operatingDays', 'openingTime', 'closingTime'].includes(q.id)) return a.hoursUndecided === 'Yes';
  if (['gpsStatus', 'outletGps', 'gpsFailureReason'].includes(q.id)) {
    if (a.onSite !== 'Yes' || a.gpsConsent !== 'Yes') return false;
    if (q.id === 'outletGps') return a.gpsStatus === 'Captured';
    if (q.id === 'gpsFailureReason') return a.gpsStatus === 'Not captured';
  }
  if (['enumeratorId', 'visitDate'].includes(q.id)) return a.onSite === 'Yes';
  if (q.id === 'adrehs') return a.onSite === 'Yes' && a.gpsConsent === 'Yes' && a.gpsStatus === 'Captured' && !!a.outletGps;
  if (q.id === 'contactName') return a.contactConsent === 'Yes' && !a.applicantName;
  if (['contactMethod', 'contactTime'].includes(q.id)) return a.contactConsent === 'Yes';
  if (q.id === 'phone') return a.contactConsent === 'Yes' && ['WhatsApp', 'Phone call'].includes(a.contactMethod);
  if (q.id === 'email') return a.contactConsent === 'Yes' && a.contactMethod === 'Email';
  return true;
}

export function validateAnswers(schema, answers, section) {
  const errors = {};
  for (const q of schema.questions.filter(q => (!section || q.section === section) && isVisible(q, answers))) {
    const value = answers[q.id];
    const empty = value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
    if (q.required && empty) { errors[q.id] = 'Please answer this question.'; continue; }
    if (empty) continue;
    if (q.type === 'calculated') continue;
    if (q.type === 'repeat') {
      if (!Array.isArray(value) || !value.length || value.length > 50 || value.some(row => !row || typeof row.institution !== 'string' || !row.institution.trim() || row.institution.length > 200 || typeof row.paymentType !== 'string' || !row.paymentType.trim() || row.paymentType.length > 200)) errors[q.id] = 'Add an institution and payment type for each row (up to 50).';
    } else if (q.type === 'number') {
      if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < (q.min ?? 0) || (q.integer && !Number.isInteger(Number(value)))) errors[q.id] = q.integer ? 'Enter a valid whole number.' : 'Enter a valid nonnegative amount.';
    } else if (q.type === 'multi') {
      if (!Array.isArray(value) || value.some(v => !q.options.includes(v)) || new Set(value).size !== value.length) errors[q.id] = 'Select valid choices.';
      else if (q.maxChoices && value.length > q.maxChoices) errors[q.id] = `Choose up to ${q.maxChoices}.`;
      else if (q.exclusive && value.includes(q.exclusive) && value.length > 1) errors[q.id] = `Select “${q.exclusive}” on its own.`;
    } else if (q.options && !q.options.includes(value)) errors[q.id] = 'Select a valid choice.';
    else if (q.type === 'gps') {
      if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || !Number.isFinite(value.accuracy) || value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180 || value.accuracy < 0 || (value.altitude != null && !Number.isFinite(value.altitude))) errors[q.id] = 'Capture a valid GPS reading.';
    } else if (q.type === 'adrehs') {
      if (typeof value !== 'object' || value.publicConsent !== true || typeof value.code !== 'string' || value.code.length > 80) errors[q.id] = 'Confirm public registration permission and provide a valid code.';
    } else if (typeof value !== 'string' || value.length > 2000) errors[q.id] = 'Enter text of up to 2,000 characters.';
    else if (q.type === 'month' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) errors[q.id] = 'Enter a valid month and year.';
    else if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[q.id] = 'Enter a valid email address.';
    else if (q.type === 'tel' && !/^\+?[\d\s()-]{7,25}$/.test(value)) errors[q.id] = 'Enter a valid phone number.';
    else if (q.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) errors[q.id] = 'Enter a valid time.';
    else if (q.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors[q.id] = 'Enter a valid date.';
    if ((value === 'Other' || (Array.isArray(value) && value.includes('Other'))) && (typeof answers[`${q.id}_other`] !== 'string' || !answers[`${q.id}_other`].trim() || answers[`${q.id}_other`].length > 2000)) errors[`${q.id}_other`] = 'Please specify your answer.';
  }
  if (schema.template === 'existing-agent-network') {
    if ((!section || section === 'D') && answers.net_datesKnown === 'Dates confirmed' && answers.net_periodAvailable === 'Completed operating days available') {
      if (answers.net_periodStart && answers.net_periodEnd && answers.net_periodStart > answers.net_periodEnd) errors.net_periodEnd = 'End date must be on or after the start date.';
      if (answers.net_periodStart && answers.net_periodEnd && Number(answers.net_operatingDays) > (Date.parse(answers.net_periodEnd) - Date.parse(answers.net_periodStart)) / 86400000 + 1) errors.net_operatingDays = 'Operating days cannot exceed the reporting period.';
    }
    if ((!section || section === 'B') && answers.net_primaryChannel === 'Email' && !answers.email) errors.email = 'Provide the email address for your preferred channel.';
  }
  return errors;
}

export function cleanAnswers(schema, answers, { trimText = true } = {}) {
  const out = {};
  for (const q of schema.questions.filter(q => isVisible(q, answers))) {
    if (q.type === 'calculated') { const average = dailyAverage(answers); if (average !== '') out[q.id] = average; continue; }
    if (answers[q.id] === undefined || answers[q.id] === '') continue;
    out[q.id] = trimText && typeof answers[q.id] === 'string' ? answers[q.id].trim() : answers[q.id];
    if (answers[q.id] === 'Other' || (Array.isArray(answers[q.id]) && answers[q.id].includes('Other'))) out[`${q.id}_other`] = trimText ? answers[`${q.id}_other`]?.trim() : answers[`${q.id}_other`];
  }
  if (schema.template !== 'existing-agent-network' && out.contactConsent === 'Yes' && out.applicantName) out.contactName = out.applicantName;
  return out;
}
