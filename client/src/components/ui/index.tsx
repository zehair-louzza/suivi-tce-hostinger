import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { X, ChevronDown, Check, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const STATUS_TONE: Record<string, 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'indigo' | 'purple'> = {
  'À préparer': 'slate',
  'Envoyé': 'blue',
  'En négociation': 'amber',
  'Accepté': 'green',
  'Refusé': 'red',
  'À planifier': 'amber',
  'Planifiée': 'blue',
  'En cours': 'indigo',
  'Non terminée': 'red',
  'Terminée — à valider': 'teal',
  'À valider': 'teal',
  'Clôturée': 'green',
  'Brouillon': 'slate',
  'À vérifier': 'amber',
  'À facturer': 'blue',
  'Facturée': 'green',
  'Payée': 'green',
  'En retard': 'red',
  'Contentieux': 'red',
};

export const KIND_LABEL: Record<string, string> = {
  travaux: 'Travaux',
  visite: 'Visite devis',
  urgence: 'Urgence',
};

export function useIsMobile() {
  const q = '(max-width: 767px)';
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

/* ---------------- Primitives ---------------- */
export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  iconRight?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  block?: boolean;
}

export function Btn({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconR,
  children,
  className = '',
  block,
  ...rest
}: BtnProps) {
  return (
    <button
      type="button"
      className={`m-btn m-btn--${variant} m-btn--${size} ${block ? 'm-btn--block' : ''} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children && <span>{children}</span>}
      {IconR && <IconR size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

export interface IconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon | React.ComponentType<any>;
  label: string;
  size?: number;
  badge?: number | string;
}

export function IconBtn({ icon: Icon, label, className = '', size = 16, badge, ...rest }: IconBtnProps) {
  return (
    <button type="button" className={`m-icon-btn ${className}`} title={label} aria-label={label} {...rest}>
      <Icon size={size} />
      {badge ? <span className="m-icon-badge">{badge}</span> : null}
    </button>
  );
}

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'indigo' | 'purple';
  dot?: boolean;
}

export function Pill({ tone = 'slate', children, dot = true, className = '', ...rest }: PillProps) {
  return (
    <span className={`m-pill m-tone-${tone} ${className}`} {...rest}>
      {dot && <i className="m-pill-dot" />}
      {children}
    </span>
  );
}

export function StatusPill({ status, children, ...rest }: { status: string; children?: ReactNode } & PillProps) {
  return <Pill tone={STATUS_TONE[status] || 'slate'} {...rest}>{children || status}</Pill>;
}

export function KindTag({ kind }: { kind: 'travaux' | 'visite' | 'urgence' | string }) {
  return <span className={`m-kind m-kind--${kind}`}>{KIND_LABEL[kind] || kind}</span>;
}

export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  pad?: boolean;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  testid?: string;
}

export function Card({ title, subtitle, actions, children, className = '', pad = true, testid, icon: Icon, ...rest }: CardProps) {
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

export interface KpiProps {
  label: string;
  value: ReactNode;
  delta?: string;
  up?: boolean;
  hint?: ReactNode;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  tone?: 'blue' | 'green' | 'amber' | 'teal' | 'indigo' | 'red';
  spark?: number[];
  onClick?: () => void;
  testid?: string;
  className?: string;
}

export function Kpi({ label, value, delta, up = true, hint, icon: Icon, tone = 'blue', onClick, testid, className = '' }: KpiProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`m-kpi m-kpi-tone-${tone} ${onClick ? 'is-click' : ''} ${className}`}
      onClick={onClick}
      data-testid={testid}
    >
      <div className="m-kpi-top">
        {Icon && <span className="m-kpi-icon"><Icon size={16} /></span>}
        <span className="m-kpi-label">{label}</span>
        {delta && <span className={`m-kpi-delta ${up ? 'is-up' : 'is-down'}`}>{delta}</span>}
      </div>
      <div className="m-kpi-value">{value}</div>
      {hint && <div className="m-kpi-foot"><span className="m-kpi-hint">{hint}</span></div>}
    </Tag>
  );
}

export interface PageProps {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  subnav?: ReactNode;
  children: ReactNode;
  testid?: string;
}

export function Page({ title, subtitle, eyebrow, actions, subnav, children, testid }: PageProps) {
  return (
    <div className="m-page" data-testid={testid}>
      <header className="m-page-head">
        <div className="m-page-titles">
          <span className="m-eyebrow">{eyebrow || 'ANELEC GROUPE · TCE'}</span>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="m-page-actions">{actions}</div>}
      </header>
      {subnav && <div className="m-page-sub">{subnav}</div>}
      {children}
    </div>
  );
}

export interface SubNavItem {
  id: string;
  label: string;
  count?: number;
  alert?: boolean;
  icon?: LucideIcon | React.ComponentType<{ size?: number }>;
}

export function SubNav({
  items,
  value,
  onChange,
  testid,
}: {
  items: SubNavItem[];
  value: string;
  onChange: (id: string) => void;
  testid?: string;
}) {
  return (
    <nav className="m-subnav" data-testid={testid}>
      {items.map((it) => {
        const Icon = it.icon;
        const active = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            className={`m-subnav-item ${active ? 'is-active' : ''}`}
            onClick={() => onChange(it.id)}
            data-testid={testid ? `${testid}-${it.id}` : undefined}
          >
            {Icon && <Icon size={14} />}
            <span>{it.label}</span>
            {it.count != null && <em className={it.alert ? 'is-alert' : ''}>{it.count}</em>}
          </button>
        );
      })}
    </nav>
  );
}

export interface SegmentedOption {
  id: string;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ size?: number }>;
  count?: number;
}

export function Segmented({
  options,
  value,
  onChange,
  testid,
  size = 'md',
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  testid?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`m-seg ${size === 'sm' ? 'm-seg--sm' : ''}`} role="tablist" data-testid={testid}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`m-seg-btn ${active ? 'is-active' : ''}`}
            onClick={() => onChange(opt.id)}
            data-testid={testid ? `${testid}-${opt.id}` : undefined}
          >
            {Icon && <Icon size={14} />}
            <span>{opt.label}</span>
            {opt.count != null && <em>{opt.count}</em>}
          </button>
        );
      })}
    </div>
  );
}

export interface DropdownOption {
  id: string;
  label: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  icon: Icon,
  testid,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (id: string) => void;
  icon?: LucideIcon | React.ComponentType<{ size?: number }>;
  testid?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div className="m-dd" ref={ref}>
      <button
        type="button"
        className="m-dd-btn"
        onClick={() => setOpen((o) => !o)}
        data-testid={testid}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {Icon && <Icon size={14} />}
        <span>{current?.label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="m-menu m-menu--left" role="listbox" data-testid={testid ? `${testid}-menu` : undefined}>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={opt.id === value}
              className={`m-menu-item ${opt.id === value ? 'is-active' : ''}`}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              data-testid={testid ? `${testid}-opt-${opt.id}` : undefined}
            >
              <span>{opt.label}</span>
              {opt.id === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher…',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="m-input">
      <Search size={15} />
      <input type="text" value={value} onChange={onChange} placeholder={placeholder} {...rest} />
    </div>
  );
}

export function Avatar({
  name,
  initials,
  color,
  size = 28,
}: {
  name: string;
  initials?: string;
  color?: string;
  size?: number;
}) {
  const init =
    initials ||
    name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  return (
    <span
      className="m-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundColor: color || 'var(--primary)',
      }}
      title={name}
    >
      {init}
    </span>
  );
}

export function Progress({
  value,
  tone = 'primary',
}: {
  value: number;
  tone?: 'primary' | 'danger' | 'amber' | 'ok';
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="m-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={`m-progress-bar m-progress--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface DataTableColumn<T> {
  key: string;
  label: ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  mobileCard,
  testid,
  empty = 'Aucun élément',
  rowClass,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  mobileCard?: (row: T) => ReactNode;
  testid?: string;
  empty?: ReactNode;
  rowClass?: (row: T) => string;
}) {
  const isMobile = useIsMobile();
  if (!rows.length) {
    return (
      <div className="m-empty" data-testid={testid ? `${testid}-empty` : undefined}>
        {empty}
      </div>
    );
  }

  if (isMobile && mobileCard) {
    return (
      <div className="m-mlist" data-testid={testid}>
        {rows.map((r) => (
          <div
            key={rowKey(r)}
            className="m-mcard"
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            role={onRowClick ? 'button' : undefined}
            data-testid={testid ? `${testid}-row-${rowKey(r)}` : undefined}
          >
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
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align || 'left' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`${onRowClick ? 'is-click' : ''} ${rowClass ? rowClass(r) : ''}`}
              data-testid={testid ? `${testid}-row-${rowKey(r)}` : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || 'left' }} className={c.className}>
                  {c.render ? c.render(r) : (r as any)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs({
  items,
  value,
  onChange,
  testid,
}: {
  items: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
  testid?: string;
}) {
  return (
    <div className="m-tabs" role="tablist" data-testid={testid}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          className={`m-tab ${value === it.id ? 'is-active' : ''}`}
          onClick={() => onChange(it.id)}
          data-testid={testid ? `${testid}-${it.id}` : undefined}
        >
          {it.label}
          {it.count != null && <em>{it.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  testid,
  head,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  testid?: string;
  head?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="m-overlay m-overlay--drawer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
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

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  width = 560,
  testid,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon | React.ComponentType<{ size?: number }>;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  testid?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="m-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="m-modal"
        style={{ width: `min(90vw, ${width}px)` }}
        role="dialog"
        aria-modal="true"
        data-testid={testid}
      >
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

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="m-field">
      <label className="m-field-label">
        {label} {required && <b>*</b>}
      </label>
      {children}
      {hint && <span className="m-field-hint">{hint}</span>}
    </div>
  );
}

export function Input({
  icon: Icon,
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon | React.ComponentType<{ size?: number }>;
}) {
  return (
    <label className={`m-input ${Icon ? 'has-icon' : ''} ${className}`}>
      {Icon && <Icon size={15} />}
      <input {...rest} />
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  testid,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  testid?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      className={`m-switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
      data-testid={testid}
    >
      <span className="m-switch-track">
        <span className="m-switch-thumb" />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export interface MenuItemDef {
  label?: string;
  icon?: LucideIcon | React.ComponentType<{ size?: number }>;
  onClick?: () => void;
  danger?: boolean;
  hint?: string;
  sep?: boolean;
  testid?: string;
}

export function Menu({
  trigger,
  items,
  align = 'right',
  testid,
}: {
  trigger: React.ReactElement;
  items: MenuItemDef[];
  align?: 'left' | 'right';
  testid?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="m-dd" ref={ref} onClick={(e) => e.stopPropagation()}>
      {React.cloneElement(trigger as React.ReactElement<any>, {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        'data-testid': testid,
        'aria-expanded': open,
      })}
      {open && (
        <div className={`m-menu m-menu--${align}`} role="menu">
          {items.map((it, i) =>
            it.sep ? (
              <div key={i} className="m-menu-sep" style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
            ) : (
              <button
                key={it.label || i}
                type="button"
                role="menuitem"
                className={`m-menu-item ${it.danger ? 'is-danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
                data-testid={it.testid}
                style={it.danger ? { color: 'var(--danger)' } : undefined}
              >
                {it.icon && <it.icon size={15} />}
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {it.hint && <kbd className="m-mono" style={{ fontSize: '10px', opacity: 0.7 }}>{it.hint}</kbd>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

