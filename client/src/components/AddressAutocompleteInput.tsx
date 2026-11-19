import React, { useEffect, useRef, useState } from 'react';
import { AddressSuggestion, searchAddressSuggestions } from '../lib/geocoding';

interface AddressAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  required?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

/**
 * Champ d'adresse avec autocomplétion BAN / IGN Géoplateforme.
 * Conserve toujours la saisie libre si l'utilisateur ne clique pas sur une suggestion.
 */
export function AddressAutocompleteInput({
  id,
  value,
  onChange,
  onSelectSuggestion,
  placeholder,
  className = 'input',
  style,
  required,
  disabled,
  'data-testid': dataTestId,
  onKeyDown,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    const onDocMouseDown = (ev: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const q = (value || '').trim();
    if (q.length < 3 || disabled) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const hits = await searchAddressSuggestions(q, 5);
      if (!cancelled) {
        setSuggestions(hits);
        setOpen(hits.length > 0);
        setActiveIdx(-1);
      }
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, disabled]);

  const pick = (s: AddressSuggestion) => {
    justSelectedRef.current = true;
    onChange(s.label);
    onSelectSuggestion?.(s);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        return;
      }
      if (e.key === 'Enter' && activeIdx >= 0 && suggestions[activeIdx]) {
        e.preventDefault();
        pick(suggestions[activeIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: '1 1 260px', minWidth: 0, width: '100%' }}>
      <input
        id={id}
        type="text"
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        data-testid={dataTestId}
        style={style}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 60,
            margin: 0,
            padding: 4,
            listStyle: 'none',
            background: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #cbd5e1)',
            borderRadius: 10,
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.16)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, idx) => (
            <li key={`${s.label}-${s.lat}-${s.lng}`} role="option" aria-selected={idx === activeIdx}>
              <button
                type="button"
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  pick(s);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 7,
                  background: idx === activeIdx ? 'var(--color-primary-soft, #eff6ff)' : 'transparent',
                  color: 'var(--color-text, #0f172a)',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontWeight: 600 }}>{s.label}</span>
                {(s.postcode || s.city) && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #64748b)' }}>
                    {[s.postcode, s.city].filter(Boolean).join(' ')} · {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
