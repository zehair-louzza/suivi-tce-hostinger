// Écran « Demandes reçues » : la file d'entrée du suivi.
//
// Une demande porte le numéro de DI du donneur d'ordre ; elle sort par l'une des trois voies
// (visite, devis, intervention directe). Les particuliers n'ont pas de DI : référence interne.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { ClientProfile, DecisionDemande, TypeDemandeur } from '../lib/api';
import { demandeApi } from '../lib/api';

export interface DemandesStudioViewProps {
  clientProfiles: ClientProfile[];
  corpsEtatList: string[];
  prioritesList: string[];
  canalList: readonly string[];
  /** Ouvre la fiche produite par l'orientation */
  onOpenDevis: (id: number) => void;
  onOpenIntervention: (id: number) => void;
}

const DECISION_LABEL: Record<DecisionDemande, string> = {
  VISITE: 'Visite technique',
  DEVIS: 'Chiffrer',
  INTERVENTION: 'Envoyer un technicien',
};

const fmtDay = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—');

const joursDepuis = (s?: string | null): number | null => {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

const card = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 12,
  padding: '16px 18px',
} as const;

const chipDI = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  fontWeight: 600,
  padding: '3px 8px',
  borderRadius: 6,
  background: 'rgba(37,99,235,.12)',
  color: '#1E40AF',
} as const;

const chipRef = { ...chipDI, background: 'rgba(245,158,11,.16)', color: '#92400E' } as const;

export function DemandesStudioView({
  clientProfiles,
  corpsEtatList,
  prioritesList,
  canalList,
  onOpenDevis,
  onOpenIntervention,
}: DemandesStudioViewProps) {
  const queryClient = useQueryClient();
  const [filtre, setFiltre] = useState<'A_DECIDER' | 'ORIENTEE' | 'ALL'>('A_DECIDER');
  const [search, setSearch] = useState('');
  const [isFormOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['demandes'],
    queryFn: async () => (await demandeApi.list({ limit: 300 })).data.data,
  });
  const demandes = data || [];

  const invalider = () => {
    queryClient.invalidateQueries({ queryKey: ['demandes'] });
    queryClient.invalidateQueries({ queryKey: ['devis'] });
    queryClient.invalidateQueries({ queryKey: ['interventions'] });
  };

  const orienterMut = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: DecisionDemande }) => demandeApi.orienter(id, decision),
    onSuccess: (res) => {
      invalider();
      const c = res.data.created;
      toast.success(`${c.libelle} créé depuis la demande`);
      if (c.devisId) onOpenDevis(c.devisId);
      else if (c.interventionId) onOpenIntervention(c.interventionId);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err?.response?.data?.message || "Erreur lors de l'orientation"),
  });

  const annulerMut = useMutation({
    mutationFn: ({ id, motif }: { id: number; motif: string }) => demandeApi.update(id, { statut: 'ANNULEE', motif }),
    onSuccess: () => {
      invalider();
      toast.success('Demande annulée');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de l’annulation'),
  });

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return demandes
      .filter((d) => (filtre === 'ALL' ? true : d.statut === filtre))
      .filter((d) =>
        q === ''
          ? true
          : [d.client, d.numeroDI, d.referenceInterne, d.site, d.objet, d.corpsEtat]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(q)
      );
  }, [demandes, filtre, search]);

  const aDecider = demandes.filter((d) => d.statut === 'A_DECIDER');
  const nbB2B = visibles.filter((d) => !d.isB2C).length;
  const nbB2C = visibles.filter((d) => d.isB2C).length;
  const enRetard = aDecider.filter((d) => (joursDepuis(d.dateReception) ?? 0) >= 2).length;

  return (
    <div style={{ padding: '22px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>Demandes reçues</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            Chaque demande porte le numéro de DI de son donneur d’ordre. Trois sorties : visite, chiffrage, ou
            intervention directe.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setFormOpen((v) => !v)} data-testid="btn-new-demande">
          {isFormOpen ? 'Fermer le formulaire' : '+ Enregistrer une demande'}
        </button>
      </header>

      {isFormOpen && (
        <FormulaireDemande
          clientProfiles={clientProfiles}
          corpsEtatList={corpsEtatList}
          prioritesList={prioritesList}
          canalList={canalList}
          onDone={() => {
            setFormOpen(false);
            invalider();
          }}
          onOpenDevis={onOpenDevis}
          onOpenIntervention={onOpenIntervention}
        />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {(
          [
            ['A_DECIDER', `À décider · ${aDecider.length}`],
            ['ORIENTEE', `Orientées · ${demandes.filter((d) => d.statut === 'ORIENTEE').length}`],
            ['ALL', `Toutes · ${demandes.length}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn btn-sm ${filtre === id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltre(id)}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginLeft: 4 }}>
          {nbB2B} donneur{nbB2B > 1 ? 's' : ''} d’ordre · {nbB2C} particulier{nbB2C > 1 ? 's' : ''}
          {enRetard > 0 && <strong style={{ color: '#B45309' }}> · {enRetard} au-delà de 2 jours</strong>}
        </span>
        <input
          className="input"
          placeholder="Rechercher un client, un DI, un site…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', maxWidth: 280 }}
        />
      </div>

      {isLoading && <div style={{ ...card, color: 'var(--text-secondary)', fontSize: 13 }}>Chargement des demandes…</div>}

      {!isLoading && visibles.length === 0 && (
        <div style={{ ...card, fontSize: 13, color: 'var(--text-secondary)' }}>
          {demandes.length === 0
            ? 'Aucune demande enregistrée. Utilisez « Enregistrer une demande » dès qu’un donneur d’ordre envoie un DI.'
            : 'Aucune demande ne correspond à ce filtre.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.map((d) => {
          const jours = joursDepuis(d.dateReception);
          const tardive = d.statut === 'A_DECIDER' && (jours ?? 0) >= 2;
          const borderLeft = d.isB2C ? '3px solid #F59E0B' : tardive ? '3px solid #DC2626' : '3px solid transparent';
          return (
            <div key={d.id} style={{ ...card, borderLeft, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <div style={{ flex: '1 1 230px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>{d.client}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {d.numeroDI ? (
                    <span style={chipDI}>{d.numeroDI}</span>
                  ) : (
                    <span style={chipRef}>{d.referenceInterne || 'sans référence'}</span>
                  )}
                  {d.isB2C && <span style={{ fontSize: 11.5, color: '#92400E', fontWeight: 600 }}>Particulier</span>}
                  {d.priorite && d.priorite !== 'Normale' && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#B91C1C' }}>{d.priorite}</span>
                  )}
                </div>
              </div>

              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div style={{ fontSize: 13.5 }}>{d.objet || '—'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {[d.site, d.corpsEtat, d.canalReception].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>

              <div style={{ flex: '0 0 110px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {fmtDay(d.dateReception)}
                <br />
                {d.statut === 'A_DECIDER' ? (
                  <span style={{ color: tardive ? '#B91C1C' : '#15803D', fontWeight: 600 }}>
                    {jours === 0 ? 'aujourd’hui' : `J+${jours}`}
                  </span>
                ) : (
                  <span style={{ fontWeight: 600 }}>{d.statut === 'ORIENTEE' ? 'Orientée' : 'Annulée'}</span>
                )}
              </div>

              <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {d.statut === 'A_DECIDER' &&
                  (['INTERVENTION', 'DEVIS', 'VISITE'] as DecisionDemande[]).map((dec, idx) => (
                    <button
                      key={dec}
                      type="button"
                      className={`btn btn-sm ${idx === 0 ? 'btn-primary' : 'btn-secondary'}`}
                      disabled={orienterMut.isPending}
                      onClick={() => orienterMut.mutate({ id: d.id, decision: dec })}
                    >
                      {DECISION_LABEL[dec]}
                    </button>
                  ))}

                {d.statut === 'A_DECIDER' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={annulerMut.isPending}
                    onClick={() => {
                      const motif = window.prompt('Motif de l’annulation de la demande ?') || '';
                      if (motif.trim()) annulerMut.mutate({ id: d.id, motif: motif.trim() });
                    }}
                  >
                    Annuler
                  </button>
                )}

                {d.statut === 'ORIENTEE' && d.devisId && (
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => onOpenDevis(d.devisId!)}>
                    Ouvrir le devis
                  </button>
                )}
                {d.statut === 'ORIENTEE' && d.interventionId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => onOpenIntervention(d.interventionId!)}
                  >
                    Ouvrir l’intervention
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Six champs à la saisie ; le reste est demandé à l'étape où il a du sens.
 * Le choix devis ou intervention est obligatoire : la pièce est créée dans la foulée,
 * la demande reste dans la file comme trace, déjà orientée.
 */
function FormulaireDemande({
  clientProfiles,
  corpsEtatList,
  prioritesList,
  canalList,
  onDone,
  onOpenDevis,
  onOpenIntervention,
}: {
  clientProfiles: ClientProfile[];
  corpsEtatList: string[];
  prioritesList: string[];
  canalList: readonly string[];
  onDone: () => void;
  onOpenDevis: (id: number) => void;
  onOpenIntervention: (id: number) => void;
}) {
  const [type, setType] = useState<TypeDemandeur>('DONNEUR_ORDRE');
  const [client, setClient] = useState('');
  const [numeroDI, setNumeroDI] = useState('');
  const [site, setSite] = useState('');
  const [objet, setObjet] = useState('');
  const [corpsEtat, setCorpsEtat] = useState(corpsEtatList[0] || 'Électricité');
  const [priorite, setPriorite] = useState(prioritesList.includes('Normale') ? 'Normale' : prioritesList[0] || 'Normale');
  const [canal, setCanal] = useState(canalList[0] || 'E-mail');
  /** Ce que la demande appelle : à choisir, rien n'est présupposé */
  const [nature, setNature] = useState<DecisionDemande | null>(null);

  const isB2C = type === 'PARTICULIER';
  const donneurs = clientProfiles.filter((c) => c.type === 'DONNEUR_ORDRE' || c.type === 'ENTREPRISE');
  const particuliers = clientProfiles.filter((c) => c.type === 'PARTICULIER');
  const suggestions = isB2C ? particuliers : donneurs;

  const createMut = useMutation({
    mutationFn: async () => {
      const creation = await demandeApi.create({
        typeDemandeur: type,
        client: client.trim(),
        numeroDI: isB2C ? null : numeroDI.trim(),
        site: site.trim() || null,
        objet: objet.trim() || null,
        corpsEtat,
        priorite,
        canalReception: canal,
      });
      // La demande est orientée dans la foulée : la pièce choisie est créée immédiatement
      const orientation = await demandeApi.orienter(creation.data.data.id, nature as DecisionDemande);
      return { demande: creation.data.data, created: orientation.data.created };
    },
    onSuccess: ({ demande, created }) => {
      toast.success(`${created.libelle} créé — dossier ${demande.cleDossier}`);
      onDone();
      if (created.devisId) onOpenDevis(created.devisId);
      else if (created.interventionId) onOpenIntervention(created.interventionId);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Erreur à l’enregistrement'),
  });

  const manquant = !client.trim() || (!isB2C && !numeroDI.trim()) || !nature;

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Qui demande ?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(
            [
              ['DONNEUR_ORDRE', 'Donneur d’ordre ou entreprise', 'Le numéro de DI vient du client et sert de clé de suivi.'],
              ['PARTICULIER', 'Particulier', 'Pas de DI : une référence interne est générée.'],
            ] as const
          ).map(([id, titre, aide]) => (
            <label
              key={id}
              style={{
                flex: '1 1 260px',
                display: 'flex',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                border: type === id ? '2px solid var(--accent-primary, #1D4ED8)' : '1px solid var(--border-default)',
                background: type === id ? 'rgba(37,99,235,.06)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="type-demandeur"
                checked={type === id}
                onChange={() => {
                  setType(id);
                  setClient('');
                }}
                style={{ marginTop: 2 }}
              />
              <span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{titre}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{aide}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
        <div>
          <label htmlFor="dem-client" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {isB2C ? 'Nom du client' : 'Donneur d’ordre'}
          </label>
          <input
            id="dem-client"
            className="input"
            list="dem-clients"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder={isB2C ? 'Ex. Mme Berthier' : 'Ex. Eiffage Construction'}
            data-testid="dem-client"
          />
          <datalist id="dem-clients">
            {suggestions.map((c) => (
              <option key={c.id} value={c.nom} />
            ))}
          </datalist>
        </div>

        {!isB2C && (
          <div>
            <label htmlFor="dem-di" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              N° de DI du donneur d’ordre <span style={{ color: '#B91C1C' }}>· obligatoire</span>
            </label>
            <input
              id="dem-di"
              className="input"
              value={numeroDI}
              onChange={(e) => setNumeroDI(e.target.value.toUpperCase())}
              placeholder="Ex. DI-2026-0147"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
              maxLength={40}
              data-testid="dem-di"
            />
          </div>
        )}

        <div>
          <label htmlFor="dem-site" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Site ou chantier
          </label>
          <input id="dem-site" className="input" value={site} onChange={(e) => setSite(e.target.value)} />
        </div>

        <div>
          <label htmlFor="dem-corps" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Corps d’état
          </label>
          <select id="dem-corps" className="input" value={corpsEtat} onChange={(e) => setCorpsEtat(e.target.value)}>
            {corpsEtatList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="dem-objet" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Objet de la demande
          </label>
          <input id="dem-objet" className="input" value={objet} onChange={(e) => setObjet(e.target.value)} />
        </div>

        <div>
          <label htmlFor="dem-prio" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Urgence
          </label>
          <select id="dem-prio" className="input" value={priorite} onChange={(e) => setPriorite(e.target.value)}>
            {prioritesList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dem-canal" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Reçue par
          </label>
          <select id="dem-canal" className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>
            {canalList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Cette demande appelle <span style={{ color: '#B91C1C' }}>· choix obligatoire</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              ['DEVIS', 'Un devis', 'Chiffrage à préparer, visite possible depuis la fiche'],
              ['INTERVENTION', 'Une intervention', 'Travaux directs, à planifier'],
            ] as const
          ).map(([id, titre, aide]) => (
            <button
              key={id}
              type="button"
              className={`btn ${nature === id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setNature(id)}
              data-testid={`dem-nature-${id.toLowerCase()}`}
              title={aide}
            >
              {titre}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={manquant || createMut.isPending}
          onClick={() => createMut.mutate()}
          data-testid="dem-submit"
        >
          {createMut.isPending
            ? 'Enregistrement…'
            : nature === 'DEVIS'
            ? 'Enregistrer et créer le devis'
            : nature === 'INTERVENTION'
            ? 'Enregistrer et créer l’intervention'
            : 'Enregistrer la demande'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Montant, technicien, créneau, photos et facturation sont demandés à leur étape.
        </span>
      </div>
    </div>
  );
}
