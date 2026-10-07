import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, ExternalLink, LocateFixed, MapPin, ShieldCheck, ChevronRight, Send, RotateCcw } from 'lucide-react';
import { api } from './api.js';
import { Brand, ErrorMessage, Loading } from './components.jsx';
import { sections, isVisible, validateAnswers, cleanAnswers } from '../shared/questionnaire.js';

function GpsField({ value, onChange }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const watch = useRef(null), timer = useRef(null);
  const started = useRef(false);
  const stop = () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); clearTimeout(timer.current); watch.current = null; setBusy(false); };
  useEffect(() => () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); clearTimeout(timer.current); }, []);
  useEffect(() => { const start = setTimeout(() => { if (!value && !started.current) { started.current = true; capture(); } }, 0); return () => clearTimeout(start); }, []);
  function capture() {
    if (!navigator.geolocation) return setError('This browser does not support GPS capture. Select “Not captured” and record the reason.');
    setError(''); setBusy(true); let best = null;
    watch.current = navigator.geolocation.watchPosition(position => {
      if (Date.now() - position.timestamp > 30000) return;
      const c = position.coords;
      if (!best || c.accuracy < best.accuracy) { best = { latitude: c.latitude, longitude: c.longitude, altitude: c.altitude, accuracy: c.accuracy, capturedAt: new Date(position.timestamp).toISOString() }; onChange(best); }
      if (c.accuracy <= 5) stop();
    }, err => { setError(err.code === 1 ? 'Location permission was denied. Enable it in your browser or select “Not captured”.' : 'A location could not be captured. Try outdoors or select “Not captured”.'); stop(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    timer.current = setTimeout(() => { stop(); if (!best) setError('No GPS reading received. Retry to continue with the survey.'); }, 30000);
  }
  return <div className="gps-box"><div className="gps-icon"><LocateFixed size={24}/></div><div><strong>{value ? 'Outlet location captured' : 'Capture your current location'}</strong><p>{value ? `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)} · ±${Math.round(value.accuracy)} m` : 'Use this device’s location while physically at the outlet.'}</p>{value?.accuracy > 30 && <p className="warning">Accuracy is above 30 m. Try again in a clearer spot. This point will be flagged for review.</p>}<button type="button" className="button secondary small" onClick={busy ? stop : capture}><LocateFixed size={16}/>{busy ? 'Stop capture' : value ? 'Capture again' : 'Capture GPS location'}</button>{busy && <p role="status">Improving accuracy… keep the device still.</p>}<ErrorMessage>{error}</ErrorMessage></div></div>;
}
function AdrehsField({ answers, value, onChange }) {
  const [permission, setPermission] = useState(value?.publicConsent || false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const gps = answers.outletGps;
  async function register() {
    setBusy(true); setError('');
    try { onChange(await api('/api/public/adrehs', { method: 'POST', body: JSON.stringify({ gps, publicConsent: permission, participationConsent: answers.consent === 'Yes' }) })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="adrehs-box"><div className="integration-title"><MapPin size={20}/><strong>Adrehs</strong><span>Sierra Leone’s digital address</span></div>{value?.code ? <div className="registered"><CheckCircle2 size={20}/><div><strong>{value.code}</strong><p>Registered with permission in the public address registry.</p><p>{[value.district, value.chiefdom, value.section].filter(Boolean).join(' ? ')}</p><a href={`https://adrehs.org/?code=${encodeURIComponent(value.code)}`} target="_blank" rel="noreferrer">View address <ExternalLink size={13}/></a></div></div> : <><p>Register the captured outlet point ({gps?.latitude.toFixed(5)}, {gps?.longitude.toFixed(5)}) to create a searchable address code. Only coordinates are sent to Adrehs.</p><label className="check-line"><input type="checkbox" checked={permission} onChange={e => setPermission(e.target.checked)}/>The applicant agrees to add this outlet location to the publicly searchable Adrehs registry.</label><button type="button" className="button secondary small" disabled={!permission || busy} onClick={register}><MapPin size={16}/>{busy ? 'Registering…' : 'Create Adrehs code'}</button><a className="text-link fallback-link" href="https://adrehs.org/generate.php" target="_blank" rel="noreferrer">Open Adrehs <ExternalLink size={13}/></a><ErrorMessage>{error}</ErrorMessage></>}</div>;
}
function Question({ q, answers, update, errors }) {
  const value = answers[q.id], other = value === 'Other' || (Array.isArray(value) && value.includes('Other'));
  const set = v => update(q.id, v);
  const toggle = option => {
    const current = Array.isArray(value) ? value : [];
    if (current.includes(option)) return set(current.filter(v => v !== option));
    if (option === q.exclusive) return set([option]);
    const next = [...current.filter(v => v !== q.exclusive), option];
    if (!q.maxChoices || next.length <= q.maxChoices) set(next);
  };
  return <fieldset className={`question ${errors[q.id] ? 'invalid' : ''}`} id={`question-${q.id}`}><legend><span className="q-number">{q.number}</span>{q.label}{q.required && <span className="required" aria-label="required">*</span>}</legend>{q.help && <p className="question-help" id={`help-${q.id}`}>{q.help}</p>}{q.type === 'single' || q.type === 'multi' ? <div className={`choices ${q.options.length <= 3 ? 'compact-choices' : ''}`}>{q.options.map(option => { const selected = Array.isArray(value) ? value.includes(option) : value === option; const limit = q.type === 'multi' && q.maxChoices && value?.length >= q.maxChoices && !selected && option !== q.exclusive; return <label className={`choice ${selected ? 'selected' : ''} ${limit ? 'disabled-choice' : ''}`} key={option}><input type={q.type === 'multi' ? 'checkbox' : 'radio'} name={q.id} value={option} checked={selected} disabled={!!limit} onChange={() => q.type === 'multi' ? toggle(option) : set(option)}/><span>{option}</span></label>; })}</div> : q.type === 'select' ? <select aria-label={q.label} value={value || ''} onChange={e => set(e.target.value)}><option value="">Select a district</option>{q.options.map(o => <option key={o}>{o}</option>)}</select> : q.type === 'gps' ? <GpsField value={value} onChange={set}/> : q.type === 'adrehs' ? <AdrehsField answers={answers} value={value} onChange={set}/> : q.type === 'textarea' ? <textarea aria-label={q.label} value={value || ''} maxLength={2000} onChange={e => set(e.target.value)}/> : <input aria-label={q.label} aria-invalid={!!errors[q.id]} type={q.type} value={value || ''} maxLength={2000} placeholder={q.type === 'tel' ? '+232 …' : q.type === 'email' ? 'you@example.com' : 'Your answer'} onChange={e => set(e.target.value)}/>}<ErrorMessage>{errors[q.id]}</ErrorMessage>{other && <div className="other-input"><label htmlFor={`${q.id}-other`}>Please specify <span className="required">*</span></label><input id={`${q.id}-other`} value={answers[`${q.id}_other`] || ''} maxLength={2000} onChange={e => update(`${q.id}_other`, e.target.value)}/><ErrorMessage>{errors[`${q.id}_other`]}</ErrorMessage></div>}</fieldset>;
}

export function PublicForm({ preview = false }) {
  const [schema, setSchema] = useState(null), [answers, setAnswers] = useState({}), [index, setIndex] = useState(0), [errors, setErrors] = useState({}), [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(null), [review, setReview] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => { api('/api/public/questionnaire').then(setSchema).catch(e => setError(e.message)); }, []);
  const active = sections.filter(s => schema?.questions.some(q => q.section === s.id && isVisible(q, answers)));
  const current = active[Math.min(index, active.length - 1)] || sections[0];
  function update(id, value) {
    setAnswers(prev => {
      const next = { ...prev, [id]: value };
      if (id === 'gpsConsent' && value === 'Yes' && next.onSite === 'Yes') next.gpsStatus = 'Captured';
      if (['outletGps', 'gpsConsent', 'onSite', 'gpsStatus'].includes(id)) delete next.adrehs;
      return cleanAnswers(schema, next);
    });
    setErrors(prev => ({ ...prev, [id]: undefined }));
  }
  function next() {
    const errs = validateAnswers(schema, answers, current.id); setErrors(errs);
    if (Object.keys(errs).length) { setTimeout(() => document.getElementById(`question-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 10); return; }
    if (index >= active.length - 1) setReview(true); else setIndex(index + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function submit() {
    const errs = validateAnswers(schema, answers); setErrors(errs);
    if (Object.keys(errs).length) { setReview(false); const q = schema.questions.find(q => q.id === Object.keys(errs)[0]); setIndex(Math.max(0, active.findIndex(s => s.id === q?.section))); return; }
    if (preview) { setDone({ preview: true }); return; }
    setBusy(true); setError('');
    try { setDone(await api('/api/public/submissions', { method: 'POST', body: JSON.stringify({ answers, version: schema.version, requestKey: requestKey.current }) })); window.scrollTo(0, 0); }
    catch (e) { setError(e.message); if (e.fields) { setErrors(e.fields); setReview(false); const q = schema.questions.find(q => q.id === Object.keys(e.fields)[0]); setIndex(Math.max(0, active.findIndex(s => s.id === q?.section))); } } finally { setBusy(false); }
  }
  if (!schema) return <div className="form-page">{error ? <div className="form-container"><ErrorMessage>{error}</ErrorMessage><button className="button secondary" onClick={() => location.reload()}>Retry</button></div> : <Loading label="Preparing your questionnaire…"/>}</div>;
  if (done) return <div className="form-page"><div className="thank-you"><div className="success-circle"><Check size={36}/></div><span className="eyebrow">{done.preview ? 'PREVIEW COMPLETE' : 'RESPONSE RECEIVED'}</span><h1>{answers.consent === 'No' ? 'Thank you for your time.' : 'Thank you. You’re all set.'}</h1><p>{done.preview ? 'This was a preview. No response was stored.' : answers.consent === 'No' ? 'Your choice has been respected. No applicant or contact details were collected.' : answers.contactConsent === 'Yes' ? 'Your response has been saved. Korlie may contact you using your preferred contact method about the next steps.' : 'Your response has been saved. We respect your choice not to be contacted.'}</p>{done.id && <div className="receipt">Your reference <strong>{done.id.slice(0, 8).toUpperCase()}</strong></div>}<p className="muted small-text">Completing this form does not guarantee appointment as an agent.</p><button className="button secondary" onClick={() => { setAnswers({}); setDone(null); setReview(false); setIndex(0); requestKey.current = crypto.randomUUID(); }}><RotateCcw size={16}/>Start a new response</button></div></div>;
  return <div className="form-page">{preview && <div className="preview-banner">Preview mode · Submissions are not saved. Adrehs registration is disabled.<a href="/admin">Back to workspace <ArrowRight size={15}/></a></div>}<main className="form-container"><div className="form-intro"><img className="form-title-logo" src="/tenkipay-logo.png" alt="TenkiPay"/><h1>{schema.title}</h1><div className="intro-meta"><span><Clock3 size={15}/>About 8–12 minutes</span><span><ShieldCheck size={15}/>Your participation is voluntary</span></div></div>{!schema.accepting && !preview ? <div className="form-card"><h2>This questionnaire is currently closed</h2><p>Please check back later. Thank you for your interest in TenkiPay.</p></div> : <><div className="step-progress"><div><span>{review ? 'Review your response' : `Section ${index + 1} of ${active.length}`}</span><strong>{review ? 'Almost there' : current.title}</strong></div><span>{review ? 100 : Math.round(index / active.length * 100)}%</span><div className="progress-track"><span style={{ width: `${review ? 100 : index / active.length * 100}%` }}/></div></div><form className="form-card" onSubmit={e => { e.preventDefault(); review ? submit() : next(); }} noValidate>{review ? <><div className="section-heading"><span className="section-letter"><Check size={20}/></span><div><h2>Ready to send?</h2><p>Review your answers before submitting.</p></div></div><div className="review-list">{schema.questions.filter(q => isVisible(q, answers) && answers[q.id] != null).map(q => <div key={q.id}><dt>{q.label}</dt><dd>{formatAnswer(answers[q.id])}</dd>{answers[`${q.id}_other`] && <dd>{answers[`${q.id}_other`]}</dd>}</div>)}</div><p className="form-notice">{schema.notice}</p></> : <><div className="section-heading"><span className="section-letter">{current.id}</span><div><h2>{current.title}</h2><p>{current.description}</p></div></div><p className="required-note"><span>*</span> Required fields</p>{schema.questions.filter(q => q.section === current.id && isVisible(q, answers)).map(q => preview && q.type === 'adrehs' ? <div key={q.id} className="form-notice">Adrehs registration is available on the live respondent form after permission.</div> : <Question key={q.id} q={q} answers={answers} update={update} errors={errors}/>)}</>}<ErrorMessage>{error}</ErrorMessage><div className="form-actions">{index > 0 || review ? <button type="button" className="button ghost" disabled={busy} onClick={() => { review ? setReview(false) : setIndex(index - 1); setErrors({}); window.scrollTo(0, 0); }}><ArrowLeft size={17}/>Back</button> : <span/>}<button className="button primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : review ? 'Submit response' : index >= active.length - 1 ? 'Review response' : 'Continue'}{review ? <Send size={16}/> : <ArrowRight size={17}/>}</button></div></form><div className="form-bottom"><ShieldCheck size={17}/><p>Your answers are accessible to authorised TenkiPay staff. Optional Adrehs registration publishes the outlet location separately.</p></div></>}</main></div>;
}
export function formatAnswer(value) { if (Array.isArray(value)) return value.join(' · '); if (value && typeof value === 'object') return value.code || `${value.latitude?.toFixed(6)}, ${value.longitude?.toFixed(6)} (±${Math.round(value.accuracy)} m)`; return String(value ?? '—'); }
