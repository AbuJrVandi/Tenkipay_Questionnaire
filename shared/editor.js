import { initialQuestionnaire, legacyQuestionnaire, sections } from './questionnaire.js';

export const questionTypes = { text: 'Short text', textarea: 'Long text', single: 'Single choice', multi: 'Multiple choice', select: 'Dropdown', email: 'Email', tel: 'Phone', date: 'Date', time: 'Time', number: 'Number', month: 'Month and year' };
export const protectedQuestions = { consent: 'Required for participation permission.', interest: 'Controls the questionnaire journey.', outletGps: 'Mandatory location capture. This system field cannot be edited or deleted.', adrehs: 'System-managed Adrehs location registration. This field cannot be edited or deleted.' };
export const locationLocked = q => ['outletGps', 'adrehs'].includes(q.id);
const dependencies = { businessType: ['dailyCustomers', 'services'], experience: ['dailyTransactions', 'providers'], resources: ['deviceAvailability'], hoursUndecided: ['operatingDays', 'openingTime', 'closingTime'], contactConsent: ['contactName', 'contactMethod', 'contactTime', 'phone', 'email'], contactMethod: ['phone', 'email'] };
export function deletionReason(question, questions) {
  if (question.profile) {
    const dependents = questions.filter(q => q.showWhen?.field === question.id);
    if (dependents.length) return 'Other questions depend on this answer. Remove dependent questions first.';
    if (['net_periodAvailable', 'net_revenueCollection', 'net_totalStatus', 'net_totalRevenue', 'net_daysKnown', 'net_operatingDays', 'net_status', 'net_followupMethod'].includes(question.id)) return 'Required for reporting-period, revenue or follow-up logic.';
  }
  if (protectedQuestions[question.id]) return protectedQuestions[question.id];
  const dependent = questions.filter(q => dependencies[question.id]?.includes(q.id));
  return dependent.length ? `Remove dependent questions first: ${dependent.map(q => q.label).join(', ')}.` : '';
}
export function structureLocked(q) { return q.profile && (['repeat', 'calculated'].includes(q.type) || initialQuestionnaire.questions.some(item => item.showWhen?.field === q.id) || ['net_periodAvailable', 'net_revenueCollection', 'net_daysKnown', 'net_totalStatus', 'net_totalRevenue', 'net_operatingDays', 'net_status', 'net_followupMethod', 'net_totalSource'].includes(q.id)) || !!protectedQuestions[q.id] || !!dependencies[q.id] || ['gps', 'adrehs'].includes(q.type); }
export function prepareQuestions(input, current, sectionList = sections) {
  const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };
  if (!Array.isArray(input) || input.length > 200) fail('Use up to 200 questions.');
  const ids = new Set();
  const coreIds = new Set([...initialQuestionnaire.questions, ...legacyQuestionnaire.questions].map(q => q.id));
  for (const q of current) if (!input.some(item => item?.id === q.id)) { const reason = deletionReason(q, input); if (reason) fail(reason); }
  return input.map(q => {
    if (!q || typeof q.id !== 'string' || ids.has(q.id)) fail('Each question needs a unique ID.');
    ids.add(q.id);
    if (typeof q.label !== 'string' || !q.label.trim() || q.label.length > 600 || (q.help != null && (typeof q.help !== 'string' || q.help.length > 1000))) fail('Each question needs wording of up to 600 characters and help text of up to 1,000 characters.');
    const previous = current.find(item => item.id === q.id);
    if (previous && locationLocked(previous)) {
      const locked = { ...previous, ...(previous.id === 'outletGps' ? { required: true } : {}) };
      for (const key of ['label', 'help', 'type', 'section', 'required']) {
        if (q[key] !== locked[key]) fail('Location fields are system-managed and cannot be edited.');
      }
      return locked;
    }
    if (coreIds.has(q.id) && !previous) fail('Invalid template question.');
    if (previous && (structureLocked(previous) || previous.profile && (previous.type === 'repeat' || previous.type === 'calculated' || initialQuestionnaire.questions.some(item => item.showWhen?.field === previous.id) || ['net_periodAvailable', 'net_revenueCollection', 'net_daysKnown', 'net_totalStatus', 'net_totalRevenue', 'net_operatingDays', 'net_status', 'net_followupMethod', 'net_totalSource'].includes(previous.id)))) return { ...previous, label: q.label.trim(), help: q.help || '' };
    if ((!coreIds.has(q.id) && !/^custom_[a-zA-Z0-9_-]{1,80}$/.test(q.id)) || !Object.hasOwn(questionTypes, q.type) || !sectionList.some(s => s.id === q.section) || typeof q.required !== 'boolean') fail('Check the new question type, section and required setting.');
    const result = { ...(previous?.profile ? { profile: true, showWhen: previous.showWhen, period: previous.period, revenue: previous.revenue, inactive: previous.inactive, noCalculation: previous.noCalculation, followupPhone: previous.followupPhone, followupEmail: previous.followupEmail, min: previous.min, integer: previous.integer } : {}), id: q.id, number: previous?.number || String(Math.max(0, ...current.map(item => parseInt(item.number) || 0)) + 1 + input.filter(item => item?.id?.startsWith('custom_') && !current.some(saved => saved.id === item.id)).findIndex(item => item.id === q.id)), section: q.section, type: q.type, required: q.required, label: q.label.trim(), help: q.help || '' };
    if (['single', 'multi', 'select'].includes(q.type)) {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 50 || q.options.some(o => typeof o !== 'string' || !o.trim() || o.length > 200)) fail('Choice questions need 2–50 nonempty options of up to 200 characters.');
      result.options = q.options.map(o => o.trim());
      if (new Set(result.options).size !== result.options.length) fail('Answer choices must be unique.');
    }
    if (q.type === previous?.type && result.options?.includes(previous.exclusive)) result.exclusive = previous.exclusive;
    if (q.type === 'multi' && previous?.maxChoices) result.maxChoices = previous.maxChoices;
    return result;
  });
}
