import React, { useMemo, useState } from 'react';
import { Monitor, Smartphone, ChevronDown, Search, Check } from 'lucide-react';
import { DIRECTIONS } from '../data/directions';
import { ALL_SCREENS, SCREEN_BY_ID } from '../data/screens';
import { useOutsideClose } from './hooks';

export function BrandLink({ to = '/' }) {
  return (
    <a href={to} className="g-brand" data-testid="gallery-brand-home-link">
      <img src="/brand/anelec-mark.png" alt="" />
      <span>
        <strong>Maquettes ANELEC</strong>
        <small>Refonte UI/UX · 5 directions</small>
      </span>
    </a>
  );
}

export function DirectionSwitcher({ value, onChange, compact }) {
  return (
    <div className="g-seg" role="tablist" aria-label="Direction de design" data-testid="gallery-viewer-direction-switcher">
      {DIRECTIONS.map((d) => (
        <button
          key={d.id}
          type="button"
          role="tab"
          aria-selected={value === d.id}
          className={`g-seg-btn ${value === d.id ? 'is-active' : ''}`}
          onClick={() => onChange(d.id)}
          title={`${d.num}. ${d.name} — ${d.tagline}`}
          data-testid={`gallery-direction-tab-${d.id}`}
        >
          <span className="g-dot" style={{ background: d.swatches[0] }} />
          <span className="g-seg-num">{d.num}</span>
          {!compact && <span className="g-seg-label">{d.name}</span>}
        </button>
      ))}
    </div>
  );
}

export function DeviceToggle({ value, onChange }) {
  return (
    <div className="g-seg g-seg--icons" data-testid="gallery-viewer-device-toggle">
      <button type="button" className={`g-seg-btn ${value === 'desktop' ? 'is-active' : ''}`} onClick={() => onChange('desktop')} data-testid="gallery-device-desktop" title="Ordinateur">
        <Monitor size={15} /> <span className="g-hide-sm">Ordinateur</span>
      </button>
      <button type="button" className={`g-seg-btn ${value === 'mobile' ? 'is-active' : ''}`} onClick={() => onChange('mobile')} data-testid="gallery-device-mobile" title="Mobile">
        <Smartphone size={15} /> <span className="g-hide-sm">Mobile</span>
      </button>
    </div>
  );
}

export function ScreenPicker({ value, onChange, testid = 'gallery-viewer-screen-switcher' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useOutsideClose(open, () => setOpen(false));
  const current = SCREEN_BY_ID[value];
  const groups = useMemo(() => {
    const list = ALL_SCREENS.filter((s) => s.label.toLowerCase().includes(q.toLowerCase()));
    const out = {};
    list.forEach((s) => { (out[s.group] = out[s.group] || []).push(s); });
    return out;
  }, [q]);
  const idx = ALL_SCREENS.findIndex((s) => s.id === value);
  return (
    <div className="g-picker" ref={ref}>
      <button type="button" className="g-picker-btn" onClick={() => setOpen((o) => !o)} data-testid={testid} aria-expanded={open}>
        <span className="g-picker-idx">{String(idx + 1).padStart(2, '0')}</span>
        <span className="g-picker-label">{current ? current.label : 'Écran'}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="g-pop" role="listbox" data-testid="gallery-screen-list">
          <div className="g-pop-search">
            <Search size={14} />
            <input autoFocus placeholder="Rechercher un écran…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="gallery-screen-search-input" />
          </div>
          <div className="g-pop-list">
            {Object.entries(groups).map(([g, items]) => (
              <div key={g}>
                <div className="g-pop-group">{g}</div>
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`g-pop-item ${s.id === value ? 'is-active' : ''}`}
                    onClick={() => { onChange(s.id); setOpen(false); setQ(''); }}
                    data-testid={`gallery-screen-option-${s.id}`}
                  >
                    <span>{s.label}</span>
                    {s.id === value && <Check size={14} />}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(groups).length === 0 && <div className="g-pop-empty">Aucun écran trouvé</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function PhoneFrame({ src, scale = 1, title, testid }) {
  return (
    <div className="g-phone-wrap" style={{ width: 414 * scale, height: 868 * scale }}>
      <div className="g-phone" style={{ transform: `scale(${scale})` }} data-testid={testid}>
        <div className="g-phone-notch" />
        <iframe title={title} src={src} width="390" height="844" loading="lazy" />
      </div>
    </div>
  );
}

export function ScaledDesktop({ src, width, title, testid, baseW = 1440, baseH = 900, interactive = true }) {
  const scale = width ? width / baseW : 0.3;
  return (
    <div className="g-scaled" style={{ height: baseH * scale }} data-testid={testid}>
      <iframe
        title={title}
        src={src}
        width={baseW}
        height={baseH}
        loading="lazy"
        style={{ transform: `scale(${scale})`, pointerEvents: interactive ? 'auto' : 'none' }}
        tabIndex={interactive ? 0 : -1}
      />
    </div>
  );
}
