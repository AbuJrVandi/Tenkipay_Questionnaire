import { numberQuestions } from './numbering.js';
const yesNo = ['Yes', 'No'];
const unsure = ['Yes', 'No', 'Unsure'];
const satisfaction = ['Very satisfied', 'Satisfied', 'Neither satisfied nor dissatisfied', 'Dissatisfied', 'Very dissatisfied'];
const ease = ['Very easy', 'Easy', 'Neither easy nor difficult', 'Difficult', 'Very difficult'];
export function createNetworkProfile(gps, adrehs, districts) {
  const questions = [];
  const add = (id, number, section, label, type = 'text', extra = {}) => questions.push({ id, number: String(number), section, label, type, required: true, profile: true, ...extra });
  const choice = (id, n, s, label, options, extra = {}) => add(id, n, s, label, 'single', { options, ...extra });
  const multi = (id, n, s, label, options, extra = {}) => add(id, n, s, label, 'multi', { options, ...extra });
  const number = (id, n, s, label, extra = {}) => add(id, n, s, label, 'number', { min: 0, ...extra });
  const when = (field, values) => ({ showWhen: { field, values: Array.isArray(values) ? values : [values] } });
  choice('consent', 1, 'A', 'Do you agree to participate in this questionnaire?', yesNo, { help: 'Participation is voluntary. Selecting Yes includes permission to capture your current location. GPS capture is mandatory to continue. Complete this questionnaire at the outlet; do not estimate or invent coordinates.' });
  questions.push({ ...gps, profile: true, section: 'A', required: true });
  if (adrehs) questions.push({ ...adrehs, profile: true, section: 'A' });
  add('net_interviewDate', 'I', 'A', 'Interview date', 'date');
  add('net_interviewer', 'I', 'A', 'Interviewer name or ID');
  choice('net_method', 'I', 'A', 'Interview method', ['On-site visit', 'Phone', 'Other'], { help: 'GPS still captures the completing device’s location and must be captured at the outlet, including for assisted interviews.' });
  choice('net_recordType', 'I', 'A', 'Record type', ['Initial profile verification', 'Update of existing record'], { help: 'For updates, confirm existing outlet details and record changes where necessary.' });
  choice('net_idStatus', 2, 'A', 'Is the TenkiPay agent ID available?', ['Available', 'Unavailable — requires verification']);
  add('net_agentId', 2, 'A', 'TenkiPay agent ID', 'text', when('net_idStatus', 'Available'));
  add('businessName', 2, 'A', 'Registered agent / business name');
  add('net_outletName', 2, 'A', 'Outlet name, if different', 'text', { required: false });
  add('net_outletId', 2, 'A', 'Outlet ID, if assigned', 'text', { required: false });
  add('applicantName', 3, 'A', 'Respondent name');
  choice('net_role', 3, 'A', 'Respondent role', ['Registered agent / owner', 'Manager', 'Operator', 'Other']);
  choice('net_multipleOutlets', 4, 'A', 'Does this agent operate more than one TenkiPay outlet?', unsure, { help: 'Record only the outlet covered by this interview.' });
  number('net_outletCount', 4, 'A', 'Number of outlets', { min: 2, integer: true, ...when('net_multipleOutlets', 'Yes') });
  add('district', 5, 'B', 'District', 'select', { options: districts });
  add('community', 5, 'B', 'Town / community');
  add('address', 5, 'B', 'Address or location description');
  add('net_landmark', 5, 'B', 'Nearby landmark', 'text', { required: false });
  choice('net_locationChanged', 6, 'B', 'Has the outlet location changed since registration or the last update provided to Korlie?', unsure);
  add('net_previousLocation', 6, 'B', 'Previous location, if known', 'text', { required: false, ...when('net_locationChanged', 'Yes') });
  add('net_primaryName', 7, 'B', 'Primary operational contact: name');
  add('net_primaryRole', 7, 'B', 'Primary operational contact: role');
  add('phone', 7, 'B', 'Primary operational phone number', 'tel', { help: 'Include the country code, for example +232.' });
  add('net_whatsapp', 7, 'B', 'WhatsApp number, if different', 'tel', { required: false });
  add('email', 7, 'B', 'Operational email address, if available', 'email', { required: false });
  choice('net_primaryChannel', 7, 'B', 'Preferred operational contact channel', ['Phone call', 'WhatsApp', 'Email']);
  choice('net_altPermission', 8, 'B', 'Would you like to provide an alternative operational contact?', yesNo, { help: 'Optional. Select Yes only with that person’s permission.', required: false });
  for (const [id, label, type] of [['net_altName', 'Name', 'text'], ['net_altRole', 'Role', 'text'], ['net_altPhone', 'Phone number', 'tel']]) add(id, 8, 'B', `Alternative operational contact: ${label}`, type, when('net_altPermission', 'Yes'));
  choice('net_status', 9, 'C', 'What is the outlet’s current TenkiPay operating status?', ['Actively providing services', 'Temporarily inactive', 'Stopped providing services']);
  const inactive = when('net_status', ['Temporarily inactive', 'Stopped providing services']);
  add('net_stoppedDate', 9, 'C', 'Date paused / stopped, if known', 'date', { required: false, ...inactive });
  add('net_stoppedReason', 9, 'C', 'Main reason for pausing / stopping', 'textarea', inactive);
  choice('net_startKnown', 10, 'C', 'When did this outlet begin providing TenkiPay services?', ['Month and year known', 'Unsure']);
  add('net_startMonth', 10, 'C', 'Month and year services began', 'month', when('net_startKnown', 'Month and year known'));
  multi('operatingDays', 11, 'C', 'Normal operating days', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], { help: 'For inactive outlets, record the last normal schedule.' });
  choice('net_hours', 11, 'C', 'Are normal operating hours fixed or variable?', ['Fixed hours', 'Hours vary']);
  add('openingTime', 11, 'C', 'Opening time', 'time', when('net_hours', 'Fixed hours'));
  add('closingTime', 11, 'C', 'Closing time', 'time', when('net_hours', 'Fixed hours'));
  add('net_hoursExplanation', 11, 'C', 'Explain varying hours', 'textarea', when('net_hours', 'Hours vary'));
  multi('services', 12, 'C', 'Which TenkiPay services does the outlet currently offer?', ['Deposits into customer wallets', 'Cash withdrawals', 'Assisted payments', 'Other', 'No services currently offered'], { exclusive: 'No services currently offered' });
  multi('resources', 13, 'C', 'Which resources are available for TenkiPay operations?', ['Smartphone', 'Computer or tablet', 'Internet connection', 'Electricity', 'Backup power or charging facilities', 'Secure cash storage', 'None of the above'], { exclusive: 'None of the above' });
  choice('net_periodAvailable', 14, 'D', 'Are there completed operating days in the reporting period?', ['Completed operating days available', 'No completed operating days in the reporting period'], { help: 'Include operating days with no transactions; exclude days the outlet was closed. If none, period-based activity questions will be skipped.' });
  choice('net_datesKnown', 14, 'D', 'Can the reporting-period dates be confirmed?', ['Dates confirmed', 'Dates cannot be confirmed'], { period: true });
  add('net_periodStart', 14, 'D', 'Reporting period: start date', 'date', { period: true, ...when('net_datesKnown', 'Dates confirmed') });
  add('net_periodEnd', 14, 'D', 'Reporting period: end date', 'date', { period: true, ...when('net_datesKnown', 'Dates confirmed') });
  choice('net_daysKnown', 14, 'D', 'Can the actual operating days be confirmed?', ['Days confirmed', 'Unable to confirm'], { period: true });
  number('net_operatingDays', 14, 'D', 'Days the outlet actually operated', { min: 1, integer: true, period: true, ...when('net_daysKnown', 'Days confirmed') });
  choice('net_revenueCollection', 15, 'D', 'Did the outlet collect payments on behalf of institutions or businesses through TenkiPay during this period?', unsure, { period: true, help: 'Exclude wallet deposits, cash withdrawals, agent commissions and separately charged service fees.' });
  const revenue = { period: true, revenue: true };
  add('net_institutions', 16, 'D', 'Institutions / businesses you collected payments for', 'repeat', { ...revenue, help: 'Add one row for each institution or business and its payment type.' });
  multi('net_revenueTypes', 17, 'D', 'What types of revenue payments did you collect?', ['Government fees or charges', 'School or university fees', 'Utility bills', 'Business or merchant payments', 'Other'], revenue);
  choice('net_totalStatus', 18, 'D', 'Total revenue collected: information availability', ['Amount available', 'Records unavailable and unable to estimate', 'Not responsible for this information'], revenue);
  number('net_totalRevenue', 18, 'D', 'Total revenue collected during the reporting period (SLE)', { ...revenue, ...when('net_totalStatus', 'Amount available') });
  choice('net_totalSource', 18, 'D', 'Source of total revenue amount', ['Transaction records', 'Respondent’s estimate'], { ...revenue, ...when('net_totalStatus', 'Amount available') });
  add('net_dailyAverage', 19, 'D', 'Calculated average daily revenue collection (SLE)', 'calculated', { ...revenue, required: false, help: 'Total revenue divided by actual operating days. Calculated automatically; the source remains attached to the total.' });
  choice('net_typicalStatus', 19, 'D', 'If calculation is unavailable, can typical-day revenue be estimated?', ['Estimate available', 'Unable to estimate', 'Not responsible for this information'], { ...revenue, noCalculation: true });
  number('net_typicalRevenue', 19, 'D', 'Estimated revenue on a typical operating day (SLE)', { ...revenue, noCalculation: true, ...when('net_typicalStatus', 'Estimate available') });
  choice('net_transactionKnown', 20, 'D', 'Can typical daily revenue-collection transactions be estimated?', ['Number available', 'Unable to estimate', 'Not responsible for this information'], revenue);
  number('net_revenueTransactions', 20, 'D', 'Revenue-collection transactions on a typical operating day', { ...revenue, integer: true, ...when('net_transactionKnown', 'Number available') });
  choice('net_reconciliation', 21, 'D', 'Were revenue collections checked against transaction records each operating day?', ['Yes, every operating day', 'On some operating days', 'No', 'Unsure', 'Not responsible for this'], revenue);
  choice('net_unresolved', 22, 'D', 'Are any revenue payments from this period still unconfirmed or unresolved?', [...unsure, 'Not responsible for this'], revenue);
  const unresolved = { ...revenue, ...when('net_unresolved', 'Yes') };
  number('net_unresolvedCount', 22, 'D', 'Number of affected payments, if known', { ...unresolved, required: false, integer: true });
  number('net_unresolvedValue', 22, 'D', 'Approximate total affected value (SLE), if known', { ...unresolved, required: false });
  choice('net_unresolvedIssue', 22, 'D', 'Main unresolved payment issue', ['Failed or delayed payment', 'Payment status unclear', 'Payment not recognised by the receiving institution', 'Receipt or reference unavailable', 'Reversal or refund pending', 'Reconciliation discrepancy', 'Other'], unresolved);
  add('net_unresolvedDetails', 22, 'D', 'Brief explanation of the unresolved issue', 'textarea', { ...unresolved, help: 'Do not include customer details.' });
  choice('net_activity', 23, 'E', 'Completed TenkiPay transactions on a typical operating day', ['None', '1–5', '6–10', '11–20', '21–50', 'More than 50', 'Unsure'], { period: true, help: 'Include all TenkiPay services, including revenue collection.' });
  choice('net_demand', 24, 'E', 'Which TenkiPay service had the highest customer demand?', ['Wallet deposits', 'Cash withdrawals', 'Assisted payments', 'Other', 'No clear pattern', 'No customer requests'], { period: true });
  choice('net_training', 25, 'E', 'Did you receive enough training to operate TenkiPay confidently?', ['Yes', 'Partly', 'No', 'I did not receive training', 'Not applicable — I do not operate the platform']);
  choice('net_usability', 26, 'E', 'How easy was TenkiPay to use during the reporting period?', [...ease, 'Not enough experience to assess'], { period: true });
  multi('net_transactionBarriers', 27, 'E', 'Main barriers to completing transactions during the reporting period', ['Insufficient cash', 'Insufficient TenkiPay agent account balance', 'Difficulty replenishing cash or account balance', 'Poor internet connectivity', 'Power or device problems', 'Platform errors or unavailable services', 'Requested payment services were not offered', 'Other', 'No significant barriers'], { period: true, maxChoices: 3, exclusive: 'No significant barriers', help: 'Choose up to three.' });
  multi('net_growthBarriers', 28, 'E', 'Main barriers to attracting more customers or increasing revenue collections', ['Limited customer awareness', 'Low demand for available services', 'Customers prefer other payment options', 'Outlet location or visibility', 'Requested payment services were not offered', 'Other', 'No significant barriers'], { maxChoices: 3, exclusive: 'No significant barriers', help: 'Choose up to three. If there are no completed operating days, record expected barriers.' });
  for (const [id, label] of [['net_cashEase', 'cash'], ['net_balanceEase', 'your TenkiPay agent account balance']]) choice(id, 29, 'E', `How easy was it to replenish ${label}?`, [...ease, 'Not responsible for this', 'Not needed during this period'], { period: true });
  choice('net_supportKnown', 30, 'F', 'Do you know how to contact TenkiPay support?', unsure, { period: true });
  choice('net_supportContacted', 31, 'F', 'Did you contact TenkiPay support during the reporting period?', yesNo, { period: true });
  choice('net_supportSatisfaction', '32a', 'F', 'How satisfied were you with your most recent support request?', [...satisfaction, 'I have not received a response'], { period: true, ...when('net_supportContacted', 'Yes') });
  choice('net_supportResolved', '32b', 'F', 'Was the issue resolved?', ['Fully resolved', 'Partly resolved', 'Not resolved', 'Still being handled'], { period: true, ...when('net_supportContacted', 'Yes') });
  multi('net_supportNeeds', 33, 'F', 'What support would help this outlet most?', ['Refresher training', 'Faster technical support', 'Cash and agent account balance management guidance', 'Better collection reports and reconciliation assistance', 'Easier receipt generation or retrieval', 'Security and fraud prevention guidance', 'Branding and customer awareness support', 'More institutions or payment services', 'Other', 'No additional support needed'], { maxChoices: 3, exclusive: 'No additional support needed', help: 'Choose up to three.' });
  choice('net_overallSatisfaction', 34, 'G', 'Overall, how satisfied are you with your experience as a TenkiPay agent?', [...satisfaction, 'Not enough experience to assess']);
  choice('net_continue', 35, 'G', 'Do you intend to continue operating, or resume operating, as a TenkiPay agent?', ['Yes', 'Undecided', 'No', 'I am not responsible for this decision']);
  add('net_continueReason', 35, 'G', 'Main reason for being undecided or not continuing', 'textarea', when('net_continue', ['Undecided', 'No']));
  add('net_resumeChanges', 35, 'G', 'What would need to change before operations could resume?', 'textarea', { ...when('net_continue', 'Yes'), inactive: true });
  add('net_improvement', 36, 'G', 'Most important improvement you would like TenkiPay to make', 'textarea', { required: false });
  choice('net_verification', 38, 'G', 'To the best of your knowledge, are the identification, outlet, contact and operating details correct?', ['Yes', 'Corrections needed', 'Some details require confirmation'], { help: 'Location verification is captured at the start through the mandatory GPS field.' });
  add('net_corrections', 38, 'G', 'Corrections or details requiring confirmation', 'textarea', when('net_verification', ['Corrections needed', 'Some details require confirmation']));
  choice('net_followup', 39, 'G', 'May Korlie contact you specifically to follow up on your survey feedback?', ['Yes — use the operational contact provided', 'Yes — use a different contact', 'No']);
  const different = when('net_followup', 'Yes — use a different contact');
  add('net_followupName', 39, 'G', 'Follow-up contact name', 'text', different);
  choice('net_followupMethod', 39, 'G', 'Preferred follow-up method', ['Phone call', 'WhatsApp', 'Email'], different);
  add('net_followupPhone', 39, 'G', 'Follow-up phone / WhatsApp number', 'tel', { ...different, followupPhone: true });
  add('net_followupEmail', 39, 'G', 'Follow-up email address', 'email', { ...different, followupEmail: true });
  choice('net_interviewerStatus', 'V', 'G', 'Interviewer verification status', ['Details confirmed', 'Corrections pending', 'Further verification required']);
  add('net_outstanding', 'V', 'G', 'Outstanding details or follow-up action', 'textarea', { required: false });
  add('net_verifiedDate', 'V', 'G', 'Verification date', 'date');
  add('net_verifiedBy', 'V', 'G', 'Verified by');
  return { template: 'existing-agent-network', title: 'TenkiPay Agent Network Profile and Experience Questionnaire', description: 'Korlie Limited is collecting information from existing TenkiPay agents to update the agent network database and understand their operational experience. This questionnaire records outlet details, location, services and revenue collection activity, alongside challenges and support needs. Complete one questionnaire per outlet.', notice: 'Participation is voluntary. Do not provide passwords, PINs, customer information or confidential account details. GPS capture at the outlet is required after participation consent. Optional Adrehs registration publishes the outlet location only with separate permission.', completionMessage: 'Thank you for helping us maintain an accurate TenkiPay agent network database and improve agent services.', sections: [
    { id: 'A', title: 'Participation & agent identification', description: 'Confirm participation, capture the outlet location, and identify the agent and interviewer.' },
    { id: 'B', title: 'Outlet location & operational contacts', description: 'Confirm this outlet’s address and contact details.' },
    { id: 'C', title: 'Operating status & services', description: 'Describe the outlet’s current status, schedule and available resources.' },
    { id: 'D', title: 'Reporting period & revenue collection', description: 'Active outlets: use the last 30 completed calendar days. Recently activated outlets: use activation to yesterday. Inactive outlets: use the 30 days ending on the final operating day, or the full period if shorter. Use the same period for activity, revenue and support questions.' },
    { id: 'E', title: 'Transaction activity & operational experience', description: 'Tell us about transaction activity, training, and operational or growth barriers.' },
    { id: 'F', title: 'Agent support', description: 'Help us understand support experiences and what assistance would help most.' },
    { id: 'G', title: 'Overall experience & verification', description: 'Share your overall feedback, verify the profile, and choose whether we may follow up.' }
  ], questions: numberQuestions(questions) };
}

export function profileVisible(q, a) {
  if (q.id === 'consent') return true;
  if (a.consent !== 'Yes') return false;
  if (q.id === 'adrehs') return !!a.outletGps;
  if (q.period && a.net_periodAvailable !== 'Completed operating days available') return false;
  if (q.revenue && a.net_revenueCollection !== 'Yes') return false;
  if (q.showWhen && !q.showWhen.values.includes(a[q.showWhen.field])) return false;
  if (q.inactive && !['Temporarily inactive', 'Stopped providing services'].includes(a.net_status)) return false;
  if (q.noCalculation && calculationAvailable(a)) return false;
  if (q.followupPhone && !['Phone call', 'WhatsApp'].includes(a.net_followupMethod)) return false;
  if (q.followupEmail && a.net_followupMethod !== 'Email') return false;
  return true;
}
export function calculationAvailable(a) {
  return a.net_totalStatus === 'Amount available' && a.net_daysKnown === 'Days confirmed' && a.net_totalRevenue !== '' && a.net_totalRevenue != null && Number.isFinite(Number(a.net_totalRevenue)) && Number(a.net_totalRevenue) >= 0 && Number.isInteger(Number(a.net_operatingDays)) && Number(a.net_operatingDays) > 0;
}
export function dailyAverage(a) { return calculationAvailable(a) ? (Number(a.net_totalRevenue) / Number(a.net_operatingDays)).toFixed(2) : ''; }
