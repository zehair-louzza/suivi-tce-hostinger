import { useMemo } from 'react';
import type { Devis, Intervention } from '../lib/api';

export function normalizeDI(raw?: string | null): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 40);
}

interface Props {
  kind: 'devis' | 'intervention';
  value?: string | null;
  onChange: (next: string) => void;
  devisList: Devis[];
  interventionsList: Intervention[];
  /** id de la fiche en cours d'édition (pour ne pas se compter soi-même) */
  currentId?: number;
  /** intervention : reprendre client / site / corps d'état / objet du devis trouvé */
  onApplyDevis?: (d: Devis) => void;
}

const labelStyle = { fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' } as const;
const boxStyle = (tone: 'ok' | 'warn' | 'info') =>
  ({
    marginTop: 6,
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 1.45,
    border: `1px solid ${tone === 'ok' ? '#86efac' : tone === 'warn' ? '#fcd34d' : 'var(--border-default)'}`,
    background: tone === 'ok' ? 'rgba(34,197,94,.10)' : tone === 'warn' ? 'rgba(245,158,11,.12)' : 'var(--bg-elevated)',
    color: 'var(--text-primary)',
  }) as const;

/**
 * Numéro de DI = numéro de suivi d'un dossier d'intervention.
 * C'est la clé qui relie un devis à ses interventions (travaux, visites…).
 */
export function DossierDIField({ kind, value, onChange, devisList, interventionsList, currentId, onApplyDevis }: Props) {
  const di = normalizeDI(value);

  const knownDIs = useMemo(() => {
    const set = new Set<string>();
    devisList.forEach((d) => d.numeroDI && set.add(normalizeDI(d.numeroDI)));
    interventionsList.forEach((i) => i.numeroDI && set.add(normalizeDI(i.numeroDI)));
    return Array.from(set).sort();
  }, [devisList, interventionsList]);

  const devisSameDI = useMemo(
    () => (di ? devisList.filter((d) => normalizeDI(d.numeroDI) === di && !(kind === 'devis' && d.id === currentId)) : []),
    [di, devisList, kind, currentId]
  );
  const intvSameDI = useMemo(
    () => (di ? interventionsList.filter((i) => normalizeDI(i.numeroDI) === di && !(kind === 'intervention' && i.id === currentId)) : []),
    [di, interventionsList, kind, currentId]
  );

  const eur = (n?: number | null) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);

  return (
    <div style={{ gridColumn: '1 / -1' }} data-testid="di-field">
      <label style={labelStyle}>N° de DI (numéro de suivi du dossier)</label>
      <input
        className="input"
        list="di-suggestions"
        placeholder="Ex. DI-2026-0142 — même numéro sur le devis et sur ses interventions"
        value={value || ''}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onBlur={(e) => {
          const n = normalizeDI(e.target.value);
          if (n !== (value || '')) onChange(n);
        }}
        maxLength={40}
        data-testid="di-input"
      />
      <datalist id="di-suggestions">
        {knownDIs.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>

      {!di && (
        <div style={boxStyle('info')}>
          Le DI relie le devis à ses interventions. Saisissez le même numéro des deux côtés : le rattachement est automatique.
        </div>
      )}

      {di && kind === 'intervention' && devisSameDI.length > 0 && (
        <div style={boxStyle('ok')}>
          <strong>Dossier {di}</strong> — rattaché au devis <strong>{devisSameDI[0].reference || `DEV-${devisSameDI[0].id}`}</strong>
          {' · '}
          {devisSameDI[0].client} · {eur(devisSameDI[0].amount)} HT · {devisSameDI[0].statutCommercial}
          {intvSameDI.length > 0 && <> · {intvSameDI.length} autre{intvSameDI.length > 1 ? 's' : ''} intervention{intvSameDI.length > 1 ? 's' : ''} sur ce dossier</>}
          {onApplyDevis && (
            <div style={{ marginTop: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onApplyDevis(devisSameDI[0])}>
                Reprendre client, site, corps d’état et objet du devis
              </button>
            </div>
          )}
          {devisSameDI.length > 1 && (
            <div style={{ marginTop: 4, color: '#b45309' }}>
              {devisSameDI.length} devis portent ce DI : le plus récent est retenu.
            </div>
          )}
        </div>
      )}

      {di && kind === 'intervention' && devisSameDI.length === 0 && (
        <div style={boxStyle('warn')}>
          Aucun devis ne porte le DI <strong>{di}</strong>
          {intvSameDI.length > 0 ? ` (${intvSameDI.length} intervention${intvSameDI.length > 1 ? 's' : ''} sur ce dossier)` : ''}.
          L’intervention reste un dossier direct ; elle sera rattachée automatiquement dès qu’un devis portera ce DI.
        </div>
      )}

      {di && kind === 'devis' && (
        <div style={boxStyle(devisSameDI.length > 0 ? 'warn' : 'ok')}>
          {devisSameDI.length > 0 ? (
            <>
              Attention : {devisSameDI.length} autre{devisSameDI.length > 1 ? 's' : ''} devis porte
              {devisSameDI.length > 1 ? 'nt' : ''} déjà ce DI ({devisSameDI.map((d) => d.reference || `DEV-${d.id}`).join(', ')}).
              Un DI correspond normalement à un seul dossier.
            </>
          ) : (
            <>
              Dossier {di} — {intvSameDI.length} intervention{intvSameDI.length > 1 ? 's' : ''} déjà rattachée
              {intvSameDI.length > 1 ? 's' : ''} à ce DI{intvSameDI.length > 0 ? ' (elles seront liées à ce devis à l’enregistrement)' : ''}.
            </>
          )}
        </div>
      )}
    </div>
  );
}
