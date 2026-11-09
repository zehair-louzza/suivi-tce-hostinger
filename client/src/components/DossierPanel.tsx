import { useMemo, useState } from 'react';
import type { Devis, Intervention } from '../lib/api';
import {
  CASE_LABEL, amountOf, buildLedgerContext, dossierCase, findDossier, isBilled, isDone, isVisite,
} from '../lib/dossiers';

interface Props {
  kind: 'devis' | 'intervention';
  current: Partial<Devis> | Partial<Intervention>;
  creating: boolean;
  devisList: Devis[];
  interventionsList: Intervention[];
  onOpenDevis: (d: Devis) => void;
  onOpenIntervention: (i: Intervention) => void;
  /** Cas 1 : nouvelle intervention rattachée à ce devis */
  onNewIntervention: (d: Devis) => void;
  /** Cas 3 : nouveau devis issu de cette intervention */
  onNewDevisFromIntervention: (i: Intervention) => void;
  /** Création d'intervention : choisir un devis source (cas 1) ou aucun (cas 2) */
  onPickSourceDevis?: (d: Devis | null) => void;
}

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDay = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—');

const card = { padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)' } as const;
const chip = (tone: string) => ({ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: tone, color: '#fff' }) as const;
const rowBtn = { display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, padding: '6px 8px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-surface, transparent)', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, color: 'var(--text-primary)' } as const;

export function DossierPanel({
  kind, current, creating, devisList, interventionsList, onOpenDevis, onOpenIntervention,
  onNewIntervention, onNewDevisFromIntervention, onPickSourceDevis,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<'directe' | 'devis'>('directe');
  const ctx = useMemo(() => buildLedgerContext(devisList, interventionsList), [devisList, interventionsList]);
  const c = current as any;
  const dossier = useMemo(
    () => findDossier({ kind, id: creating ? undefined : c.id, numeroDI: c.numeroDI, devisId: c.devisId || c.origineDevisId }, devisList, interventionsList),
    [kind, creating, c.id, c.numeroDI, c.devisId, c.origineDevisId, devisList, interventionsList],
  );
  const cas = dossierCase(kind, dossier);
  const devis = dossier?.devis;
  const items = dossier ? [...dossier.visites, ...dossier.travaux] : [];

  // Sélecteur de source à la création d'une intervention
  if (kind === 'intervention' && creating) {
    const candidates = [...devisList]
      .filter((d) => !String(d.statutCommercial || '').toLowerCase().startsWith('refus'))
      .sort((a, b) => {
        const acc = (x: Devis) => (String(x.statutCommercial || '').toLowerCase().startsWith('accept') ? 0 : 1);
        return acc(a) - acc(b) || (b.id || 0) - (a.id || 0);
      });
    return (
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Origine de l’intervention</div>
        <div className="segmented" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {([['directe', 'Intervention directe'], ['devis', 'Sur un devis']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`segmented-btn ${sourceMode === id ? 'active' : ''}`}
              onClick={() => {
                setSourceMode(id);
                if (id === 'directe') onPickSourceDevis?.(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {sourceMode === 'devis' ? (
          <select
            className="form-input"
            value={c.devisId || ''}
            onChange={(e) => {
              const d = devisList.find((x) => x.id === Number(e.target.value));
              onPickSourceDevis?.(d || null);
            }}
          >
            <option value="">— Choisir le devis —</option>
            {candidates.map((d) => (
              <option key={d.id} value={d.id}>
                {[d.numeroDI, d.reference, d.client, d.objet].filter(Boolean).join(' · ')} ({d.statutCommercial})
              </option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Aucun devis lié. Après l’intervention, vous pourrez créer le devis depuis sa fiche : le numéro de DI les reliera.
          </div>
        )}
        {sourceMode === 'devis' && devis && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            Client, site, corps d’état, objet et DI repris du devis · montant {eur(dossier!.devisMontant)}.
          </div>
        )}
      </div>
    );
  }

  const totalLabel = dossier
    ? `${dossier.travaux.length} intervention${dossier.travaux.length > 1 ? 's' : ''}${dossier.visites.length ? ` · ${dossier.visites.length} visite${dossier.visites.length > 1 ? 's' : ''}` : ''}`
    : '';
  const tone = cas === 'directe' ? '#f59e0b' : cas === 'devis-suite-intervention' ? '#8b5cf6' : cas === 'sur-devis' ? '#0ea5e9' : '#64748b';

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={chip(tone)}>{CASE_LABEL[cas]}</span>
          <strong style={{ fontSize: 13 }}>{dossier?.di ? `Dossier ${dossier.di}` : 'Pas de numéro de DI'}</strong>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Masquer le dossier' : 'Voir tout le dossier'}
        </button>
      </div>

      {dossier && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginTop: 10, fontSize: 12 }}>
          <div><div style={{ color: 'var(--text-secondary)' }}>Devis</div><strong>{devis ? eur(dossier.devisMontant) : 'aucun'}</strong></div>
          <div><div style={{ color: 'var(--text-secondary)' }}>CA réalisé</div><strong>{eur(dossier.caRealise)}</strong></div>
          <div><div style={{ color: 'var(--text-secondary)' }}>Facturé</div><strong>{eur(dossier.facture)}</strong></div>
          <div><div style={{ color: 'var(--text-secondary)' }}>Reste à facturer</div><strong>{eur(dossier.resteAFacturer)}</strong></div>
          <div><div style={{ color: 'var(--text-secondary)' }}>Activité</div><strong>{totalLabel || '—'}</strong></div>
        </div>
      )}
      {!dossier && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
          {creating ? 'Saisissez un numéro de DI pour rattacher cette fiche à un dossier.' : 'Aucun dossier associé pour le moment.'}
        </div>
      )}

      {dossier && dossier.anomalies.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#b45309' }}>⚠ {dossier.anomalies.join(' · ')}</div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {kind === 'devis' && !creating && c.id && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNewIntervention(c as Devis)}>
            + Créer une intervention sur ce devis
          </button>
        )}
        {kind === 'intervention' && !creating && c.id && !devis && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNewDevisFromIntervention(c as Intervention)}>
            Créer un devis depuis cette intervention
          </button>
        )}
        {kind === 'intervention' && devis && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenDevis(devis)}>
            Ouvrir le devis {devis.reference || ''}
          </button>
        )}
        {kind === 'devis' && !creating && dossier && dossier.resteAFacturer > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>
            {eur(dossier.resteAFacturer)} terminés et non facturés
          </span>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {devis && (
            <button type="button" style={rowBtn} onClick={() => onOpenDevis(devis)}>
              <span><strong>Devis {devis.reference || `#${devis.id}`}</strong> · {devis.objet || devis.client} · {devis.statutCommercial}</span>
              <span>{eur(Number(devis.amount) || 0)} · {fmtDay(devis.dateCreated)}</span>
            </button>
          )}
          {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aucune intervention liée.</div>}
          {items.map((i) => (
            <button type="button" key={i.id} style={rowBtn} onClick={() => onOpenIntervention(i)}>
              <span>
                <strong>{isVisite(i) ? 'Visite' : 'Intervention'} {i.reference || `#${i.id}`}</strong> · {i.objet || i.typeIntervention || '—'} · {i.statutOperationnel}
              </span>
              <span>
                {isVisite(i) ? 'non facturable' : `${eur(amountOf(i, ctx))}${isDone(i) ? (isBilled(i) ? ' · facturée' : ' · à facturer') : ''}`} · {fmtDay(i.dateReelle || i.datePlanifiee)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
