import React from 'react';
import { ArrowUpRight, Check, X, AlertCircle, LoaderCircle } from 'lucide-react';
export const Brand = ({ dark = false }) => <a className={`brand ${dark ? 'brand-dark' : ''}`} href="/" aria-label="TenkiPay home"><img src="/tenkipay-logo.png" alt="TenkiPay" className="brand-logo"/></a>;
export const Loading = ({ label = 'Loading your workspace…' }) => <div className="loading" role="status"><LoaderCircle className="spin" size={25}/><span>{label}</span></div>;
export const ErrorMessage = ({ children }) => children ? <div className="error-banner" role="alert"><AlertCircle size={18}/><span>{children}</span></div> : null;
export const Badge = ({ children, tone = 'green' }) => <span className={`badge ${tone}`}><span/>{children}</span>;
export function Modal({ title, children, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21}/></button></div>{children}</dialog>;
}
export const Empty = ({ icon: Icon = Check, title, children }) => <div className="empty"><span className="empty-icon"><Icon size={26}/></span><h3>{title}</h3><p>{children}</p></div>;
