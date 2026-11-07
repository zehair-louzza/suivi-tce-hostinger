import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronDown, Check, CheckCircle2, AlertTriangle, Info, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { STATUS_TONE, KIND_LABEL } from '../data/sample';

/* ---------------- Contexte maquette ---------------- */
export const MockCtx = createContext(null);
export const useMock = () => useContext(MockCtx);

export function useIsMobile() {
  const q = '(max-width: 767px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="m-toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`m-toast m-toast--${t.tone}`} data-testid="mock-toast">
            {t.tone === 'success' ? <CheckCircle2 size={17} /> : t.tone === 'warn' ? <AlertTriangle size={17} /> : <Info size={17} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Primitives ---------------- */
export function Btn({ variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, children, className = '', block, ...rest }) {
  return (
    <button type="button" className={`m-btn m-btn--${variant} m-btn--${size} ${block ? 'm-btn--block' : ''} ${className}`} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children && <span>{children}</span>}
      {IconR && <IconR size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

export function IconBtn({ icon: Icon, label, className = '', size = 16, badge, ...rest }) {
  return (
    <button type="button" className={`m-icon-btn ${className}`} title={label} aria-label={label} {...rest}>
      <Icon size={size} />
      {badge ? <span className="m-icon-badge">{badge}</span> : null}
    </button>
  );
}

export function Pill({ tone = 'slate', children, dot = true, className = '', ...rest }) {
  return (
    <span className={`m-pill m-tone-${tone} ${className}`} {...rest}>
      {dot && <i className="m-pill-dot" />}
      {children}
    </span>
  );
}

export function StatusPill({ status, children, ...rest }) {
  return <Pill tone={STATUS_TONE[status] || 'slate'} {...rest}>{children || status}</Pill>;
}

export function KindTag({ kind }) {
  return <span className={`m-kind m-kind--${kind}`}>{KIND_LABEL[kind]}</span>;
}

export function Card({ title, subtitle, actions, children, className = '', pad = true, testid, icon: Icon, ...rest }) {
  return (
    <section className={`m-card ${className}`} data-testid={testid} {...rest}>
      {(title || actions) && (
        <header className="m-card-head">
          <div className="m-card-titles">
            {title && <h2>{Icon && <Icon size={16} className="m-card-icon" />}{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="m-card-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'm-card-body' : 'm-card-body m-card-body--flush'}>{children}</div>
    </section>
  );
}

function Spark({ data }) {
  if (!data) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(' ');
  return (
    <svg className="m-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Kpi({ label, value, delta, up = true, hint, icon: Icon, tone = 'blue', spark, onClick, testid, action, className = '' }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`m-kpi m-kpi-tone-${tone} ${onClick ? 'is-click' : ''} ${className}`} onClick={onClick} data-testid={testid}>
      <div className="m-kpi-top">
        {Icon && <span className="m-kpi-icon"><Icon size={16} /></span>}
        <span className="m-kpi-label">{label}</span>
        {delta && (
          <span className={`m-kpi-delta ${up ? 'is-up' : 'is-down'}`}>
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {delta}
          </span>
        )}
      </div>
      <div className="m-kpi-value">{value}</div>
      <div className="m-kpi-foot">
        {hint && <span className="m-kpi-hint">{hint}</span>}
        {spark && <Spark data={spark} />}
      </div>
      {action && <span className="m-kpi-action">{action}</span>}
    </Tag>
  );
}

export function SubNav({ items, value, onChange, testid = 'mock-subnav' }) {
  return (
    <nav className="m-subnav" data-testid={testid}>
      {items.map((it) => (
        <button key={it.id} type="button" className={`m-subnav-item ${value === it.id ? 'is-active' : ''}`} onClick={() => onChange(it.id)} data-testid={`${testid}-${it.id}`}>
          {it.icon && <it.icon size={15} />}
          <span>{it.label}</span>
          {it.count != null && <em className={it.alert ? 'is-alert' : ''}>{it.count}</em>}
        </button>
      ))}
    </nav>
  );
}

export function Segmented({ options, value, onChange, testid, size = 'md' }) {
  return (
    <div className={`m-seg m-seg--${size}`} data-testid={testid} role="tablist">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className={`m-seg-btn ${value === o.id ? 'is-active' : ''}`} onClick={() => onChange(o.id)} data-testid={testid ? `${testid}-${o.id}` : undefined}>
          {o.icon && <o.icon size={14} />}
          {o.label && <span>{o.label}</span>}
          {o.count != null && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function Page({ eyebrow, title, subtitle, actions, subnav, children, className = '', testid }) {
  return (
    <div className={`m-page ${subnav ? 'has-sub' : ''} ${className}`} data-testid={testid}>
      <header className="m-page-head">
        <div className="m-page-titles">
          {eyebrow && <span className="m-eyebrow">{eyebrow}</span>}
          <h1 data-testid="mock-page-title">{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="m-page-actions">{actions}</div>}
      </header>
      {subnav && <div className="m-page-sub">{subnav}</div>}
      <div className="m-page-body">{children}</div>
    </div>
  );
}

export function Avatar({ name, initials, color, size = 30 }) {
  const ini = initials || (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="m-avatar" style={{ width: size, height: size, fontSize: size * 0.38, '--av': color || 'var(--primary)' }} title={name}>
      {ini}
    </span>
  );
}

export function Progress({ value, tone = 'primary', label }) {
  return (
    <div className="m-progress" title={label}>
      <span className={`m-progress-bar m-progress--${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Input({ icon: Icon, className = '', ...rest }) {
  return (
    <label className={`m-input ${Icon ? 'has-icon' : ''} ${className}`}>
      {Icon && <Icon size={15} />}
      <input {...rest} />
    </label>
  );
}

export function SearchInput(props) {
  return <Input icon={Search} {...props} />;
}

export function Field({ label, hint, children, required, className = '' }) {
  return (
    <div className={`m-field ${className}`}>
      <span className="m-field-label">{label}{required && <b> *</b>}</span>
      {children}
      {hint && <span className="m-field-hint">{hint}</span>}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, testid, sub }) {
  return (
    <label className={`m-check ${checked ? 'is-on' : ''}`} data-testid={testid}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange && onChange(e.target.checked)} />
      <span className="m-check-box">{checked && <Check size={12} strokeWidth={3} />}</span>
      <span className="m-check-label">{label}{sub && <small>{sub}</small>}</span>
    </label>
  );
}

export function Switch({ checked, onChange, label, testid }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} className={`m-switch ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)} data-testid={testid}>
      <span className="m-switch-track"><span className="m-switch-thumb" /></span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function useOutside(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  return ref;
}

export function Dropdown({ value, options, onChange, testid, icon: Icon, placeholder, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const cur = options.find((o) => o.id === value);
  return (
    <div className="m-dd" ref={ref}>
      <button type="button" className="m-dd-btn" onClick={() => setOpen((o) => !o)} data-testid={testid} aria-expanded={open}>
        {Icon && <Icon size={15} />}
        <span>{cur ? cur.label : placeholder}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className={`m-menu m-menu--${align}`} role="listbox">
          {options.map((o) => (
            <button key={o.id} type="button" className={`m-menu-item ${o.id === value ? 'is-active' : ''}`} onClick={() => { onChange(o.id); setOpen(false); }} data-testid={testid ? `${testid}-option-${o.id}` : undefined}>
              <span>{o.label}</span>
              {o.id === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Menu({ trigger, items, align = 'right', testid }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div className="m-dd" ref={ref} onClick={(e) => e.stopPropagation()}>
      {React.cloneElement(trigger, { onClick: () => setOpen((o) => !o), 'data-testid': testid, 'aria-expanded': open })}
      {open && (
        <div className={`m-menu m-menu--${align}`} role="menu">
          {items.map((it, i) => it.sep ? <div key={i} className="m-menu-sep" /> : (
            <button key={it.label} type="button" role="menuitem" className={`m-menu-item ${it.danger ? 'is-danger' : ''}`} onClick={() => { setOpen(false); it.onClick && it.onClick(); }} data-testid={it.testid}>
              {it.icon && <it.icon size={15} />}
              <span>{it.label}</span>
              {it.hint && <kbd>{it.hint}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useEsc(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, subtitle, icon: Icon, children, footer, width = 560, testid }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="m-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-modal" style={{ '--mw': `${width}px` }} role="dialog" aria-modal="true" data-testid={testid}>
        <header className="m-modal-head">
          {Icon && <span className="m-modal-icon"><Icon size={18} /></span>}
          <div className="m-modal-titles">
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconBtn icon={X} label="Fermer" onClick={onClose} data-testid={testid ? `${testid}-close` : undefined} />
        </header>
        <div className="m-modal-body">{children}</div>
        {footer && <footer className="m-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, testid, head }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="m-overlay m-overlay--drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="m-drawer" role="dialog" aria-modal="true" data-testid={testid}>
        <header className="m-drawer-head">
          <div className="m-modal-titles">
            {head}
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconBtn icon={X} label="Fermer" onClick={onClose} data-testid={testid ? `${testid}-close` : undefined} />
        </header>
        <div className="m-drawer-body">{children}</div>
        {footer && <footer className="m-drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

export function DataTable({ columns, rows, rowKey, onRowClick, mobileCard, testid, empty = 'Aucun élément', rowClass }) {
  const isMobile = useIsMobile();
  if (!rows.length) return <div className="m-empty" data-testid={testid ? `${testid}-empty` : undefined}>{empty}</div>;
  if (isMobile && mobileCard) {
    return (
      <div className="m-mlist" data-testid={testid}>
        {rows.map((r) => (
          <div key={rowKey(r)} className="m-mcard" onClick={onRowClick ? () => onRowClick(r) : undefined} role={onRowClick ? 'button' : undefined} data-testid={testid ? `${testid}-row-${rowKey(r)}` : undefined}>
            {mobileCard(r)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="m-table-wrap">
      <table className="m-table" data-testid={testid}>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={{ width: c.width, textAlign: c.align || 'left' }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={`${onRowClick ? 'is-click' : ''} ${rowClass ? rowClass(r) : ''}`} data-testid={testid ? `${testid}-row-${rowKey(r)}` : undefined}>
              {columns.map((c) => <td key={c.key} style={{ textAlign: c.align || 'left' }} className={c.className}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs({ items, value, onChange, testid }) {
  return (
    <div className="m-tabs" role="tablist" data-testid={testid}>
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} className={`m-tab ${value === it.id ? 'is-active' : ''}`} onClick={() => onChange(it.id)} data-testid={testid ? `${testid}-${it.id}` : undefined}>
          {it.label}{it.count != null && <em>{it.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="m-empty m-empty--rich">
      {Icon && <span className="m-empty-icon"><Icon size={22} /></span>}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Logo({ variant = 'color', compact }) {
  const src = variant === 'white' ? '/brand/anelec-logo-white.png' : '/brand/anelec-logo.png';
  if (compact) return <img src="/brand/anelec-mark.png" alt="ANELEC GROUPE" className="m-logo-mark" />;
  return <img src={src} alt="ANELEC GROUPE" className="m-logo" />;
}

export function Stat({ label, value, sub }) {
  return (
    <div className="m-stat">
      <span className="m-stat-label">{label}</span>
      <strong className="m-stat-value">{value}</strong>
      {sub && <span className="m-stat-sub">{sub}</span>}
    </div>
  );
}

export function useMemoOnce(fn) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, []);
}
