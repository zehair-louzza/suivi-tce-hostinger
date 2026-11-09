// « Ma file » : ce que la personne connectée doit faire, selon son rôle.
//
// Une seule liste au lieu d'une navigation à explorer. Les files sont construites à partir
// des données déjà chargées : rien n'est inventé, et chaque ligne ouvre la fiche concernée.
import { useMemo, useState } from 'react';
import type { Devis, Intervention, User } from '../lib/api';
import type { Demande } from '../lib/api';
import { getEffectivePermissions } from '../lib/api';

export type RoleFile = 'chiffrage' | 'travaux' | 'terrain' | 'direction';

export interface MaFileViewProps {
  user: User | null | undefined;
  devisList: Devis[];
  interventionsList: Intervention[];
  demandes: Demande[];
  queues: {
    devisARelancer: Devis[];
    devisAcceptesSansIntv: Devis[];
    visitesDevisAPlanifier: Devis[];
    intvAPlanifier: Intervention[];
    intvEnRetard: Intervention[];
    intvAFacturer: Intervention[];
    rapportsEnAttente: Intervention[];
  };
  onOpenDevis: (d: Devis) => void;
  onOpenIntervention: (i: Intervention) => void;
  onGoDemandes: () => void;
}

const ROLE_LABEL: Record<RoleFile, string> = {
  chiffrage: 'Chiffrage',
  travaux: 'Conduite de travaux',
  terrain: 'Terrain',
  direction: 'Direction',
};

const cle = (x: { client?: string | null; numeroDI?: string | null; reference?: string | null }) =>
  [x.client, x.numeroDI || x.reference].filter(Boolean).join(' · ') || '—';

const card = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 12,
  padding: '16px 18px',
} as const;

const ligne = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 12,
  alignItems: 'center',
  padding: '11px 13px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 9,
};

/** Rôle de départ déduit des permissions : chacun arrive sur sa propre file. */
function roleParDefaut(user: User | null | undefined): RoleFile {
  const perms = user?.permissions || getEffectivePermissions((user?.role || '').toUpperCase(), null);
  if (perms.canManageBilling || perms.canManageUsers) return 'direction';
  if (perms.canEditDevis) return 'chiffrage';
  if (perms.canEditPlanning) return 'travaux';
  return 'terrain';
}

export function MaFileView({
  user,
  devisList,
  interventionsList,
  demandes,
  queues,
  onOpenDevis,
  onOpenIntervention,
  onGoDemandes,
}: MaFileViewProps) {
  const [role, setRole] = useState<RoleFile>(() => roleParDefaut(user));

  const demandesADecider = useMemo(() => demandes.filter((d) => d.statut === 'A_DECIDER'), [demandes]);

  // Terrain : les interventions de la personne connectée, sinon toutes celles planifiées
  const monNom = (user?.technicienNom || '').trim().toLowerCase();
  const mesInterventions = useMemo(() => {
    const planifiees = interventionsList.filter(
      (i) => !['Clôturée', 'Annulée'].includes(String(i.statutOperationnel)) && i.datePlanifiee
    );
    if (!monNom) return planifiees.slice(0, 8);
    return planifiees.filter((i) => String(i.entreprise || '').toLowerCase().includes(monNom)).slice(0, 8);
  }, [interventionsList, monNom]);

  const sections: Record<RoleFile, { titre: string; items: { id: string; texte: string; sous: string; action: () => void }[] }> = {
    chiffrage: {
      titre: 'À chiffrer et à relancer',
      items: [
        ...queues.visitesDevisAPlanifier.map((d) => ({
          id: `v${d.id}`,
          texte: `${cle(d)} — visite à planifier`,
          sous: [d.site, d.objet].filter(Boolean).join(' · '),
          action: () => onOpenDevis(d),
        })),
        ...devisList
          .filter((d) => !Number(d.amount) && !String(d.statutCommercial || '').startsWith('Refus'))
          .map((d) => ({
            id: `c${d.id}`,
            texte: `${cle(d)} — montant à saisir`,
            sous: [d.site, d.objet].filter(Boolean).join(' · '),
            action: () => onOpenDevis(d),
          })),
        ...queues.devisARelancer.map((d) => ({
          id: `r${d.id}`,
          texte: `${cle(d)} — à relancer`,
          sous: [d.statutCommercial, d.prochaineAction].filter(Boolean).join(' · '),
          action: () => onOpenDevis(d),
        })),
      ],
    },
    travaux: {
      titre: 'À planifier et à débloquer',
      items: [
        ...queues.devisAcceptesSansIntv.map((d) => ({
          id: `a${d.id}`,
          texte: `${cle(d)} — devis accepté, sans intervention`,
          sous: [d.site, d.objet].filter(Boolean).join(' · '),
          action: () => onOpenDevis(d),
        })),
        ...queues.intvAPlanifier.map((i) => ({
          id: `p${i.id}`,
          texte: `${cle(i)} — à planifier`,
          sous: [i.chantier, i.objet].filter(Boolean).join(' · '),
          action: () => onOpenIntervention(i),
        })),
        ...queues.intvEnRetard.map((i) => ({
          id: `t${i.id}`,
          texte: `${cle(i)} — en retard`,
          sous: [i.chantier, i.statutOperationnel].filter(Boolean).join(' · '),
          action: () => onOpenIntervention(i),
        })),
      ],
    },
    terrain: {
      titre: monNom ? 'Mes interventions' : 'Interventions planifiées',
      items: [
        ...mesInterventions.map((i) => ({
          id: `m${i.id}`,
          texte: `${cle(i)} — ${i.objet || i.typeIntervention || 'intervention'}`,
          sous: [String(i.datePlanifiee || '').slice(0, 10).split('-').reverse().join('/'), i.heureDebut, i.chantier]
            .filter(Boolean)
            .join(' · '),
          action: () => onOpenIntervention(i),
        })),
        ...queues.rapportsEnAttente.map((i) => ({
          id: `rap${i.id}`,
          texte: `${cle(i)} — rapport à terminer`,
          sous: [i.chantier, i.statutRapport].filter(Boolean).join(' · '),
          action: () => onOpenIntervention(i),
        })),
      ],
    },
    direction: {
      titre: 'À facturer et à surveiller',
      items: [
        ...queues.intvAFacturer.map((i) => ({
          id: `f${i.id}`,
          texte: `${cle(i)} — terminée, non facturée`,
          sous: [i.chantier, i.statutOperationnel].filter(Boolean).join(' · '),
          action: () => onOpenIntervention(i),
        })),
        ...queues.rapportsEnAttente.map((i) => ({
          id: `dr${i.id}`,
          texte: `${cle(i)} — rapport à valider`,
          sous: [i.chantier, i.statutRapport].filter(Boolean).join(' · '),
          action: () => onOpenIntervention(i),
        })),
        ...devisList
          .filter((d) => !String(d.numeroDI || '').trim())
          .map((d) => ({
            id: `sd${d.id}`,
            texte: `${d.client} — devis sans numéro de DI`,
            sous: [d.reference, d.objet].filter(Boolean).join(' · '),
            action: () => onOpenDevis(d),
          })),
      ],
    },
  };

  const courant = sections[role];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Ma file{user?.name ? ` — ${user.name}` : ''}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 'auto' }}>
          {(Object.keys(ROLE_LABEL) as RoleFile[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`btn btn-sm ${role === r ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRole(r)}
              data-testid={`mafile-role-${r}`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {demandesADecider.length > 0 && (
        <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>
              {demandesADecider.length} demande{demandesADecider.length > 1 ? 's' : ''} à décider
            </strong>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {demandesADecider
                .slice(0, 3)
                .map((d) => d.cleDossier)
                .join(' · ')}
              {demandesADecider.length > 3 ? ' …' : ''}
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onGoDemandes}>
            Ouvrir les demandes
          </button>
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <strong style={{ fontSize: 14.5 }}>{courant.titre}</strong>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {courant.items.length} élément{courant.items.length > 1 ? 's' : ''}
          </span>
        </div>

        {courant.items.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rien n’attend sur cette file. </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courant.items.slice(0, 20).map((it) => (
              <div key={it.id} style={ligne}>
                <div style={{ flex: '999 1 280px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.texte}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{it.sous || '—'}</div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={it.action}>
                  Ouvrir
                </button>
              </div>
            ))}
            {courant.items.length > 20 && (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                et {courant.items.length - 20} autre{courant.items.length - 20 > 1 ? 's' : ''}…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
