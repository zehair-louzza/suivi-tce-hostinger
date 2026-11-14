// « Mon travail » : ce que la personne connectée doit faire et valider, selon son rôle — et rien d'autre.
//
// Une seule liste au lieu d'une navigation à explorer. Les files sont construites à partir
// des données déjà chargées : rien n'est inventé, et chaque ligne ouvre la fiche concernée.
import { useMemo, useState } from 'react';
import type { Devis, Intervention, User } from '../lib/api';
import type { Demande } from '../lib/api';
import { espaceRoleOf, ROLE_PERIMETRE, type EspaceRole } from '../../../shared/types';

export type RoleFile = EspaceRole;

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
  direction: 'Direction',
  chiffrage: 'Chiffrage',
  travaux: 'Conduite de travaux',
  rapports: 'Rapports et facturation',
  terrain: 'Terrain',
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

type Item = { id: string; texte: string; sous: string; action: () => void };
type Bloc = { id: string; titre: string; genre: 'valider' | 'traiter'; aide: string; items: Item[] };

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
  const monRole = espaceRoleOf(user);
  // Seule la direction peut regarder la file des autres profils (pour superviser) ; les autres ne voient que la leur.
  const peutSuperviser = monRole === 'direction';
  const [vue, setVue] = useState<RoleFile>(monRole);
  const role: RoleFile = peutSuperviser ? vue : monRole;
  const perms = user?.permissions;
  const voitMontants = peutSuperviser || Boolean(perms?.canViewFinancials);

  const demandesADecider = useMemo(() => demandes.filter((d) => d.statut === 'A_DECIDER'), [demandes]);

  const monNom = (user?.technicienNom || '').trim().toLowerCase();
  const mesInterventions = useMemo(() => {
    const planifiees = interventionsList.filter(
      (i) => !['Clôturée', 'Annulée'].includes(String(i.statutOperationnel)) && i.datePlanifiee
    );
    if (!monNom) return planifiees.slice(0, 8);
    return planifiees.filter((i) => String(i.entreprise || '').toLowerCase().includes(monNom)).slice(0, 8);
  }, [interventionsList, monNom]);

  const devisItem = (d: Devis, suffixe: string, sous?: string): Item => ({
    id: `d${d.id}${suffixe}`,
    texte: `${cle(d)} — ${suffixe}`,
    sous: sous ?? [d.site, d.objet].filter(Boolean).join(' · '),
    action: () => onOpenDevis(d),
  });
  const intvItem = (i: Intervention, suffixe: string, sous?: string): Item => ({
    id: `i${i.id}${suffixe}`,
    texte: `${cle(i)} — ${suffixe}`,
    sous: sous ?? [i.chantier, i.statutOperationnel].filter(Boolean).join(' · '),
    action: () => onOpenIntervention(i),
  });

  const aValiderEnInterne = devisList.filter((d) => d.statutCommercial === 'À valider en interne');
  const rapportsAValider = queues.rapportsEnAttente.filter(
    (i) => i.statutOperationnel === 'Terminée - à valider' || i.statutRapport === 'Déclaré par technicien'
  );
  const rapportsARediger = queues.rapportsEnAttente.filter((i) => !rapportsAValider.includes(i));
  const reponsesRefusees = interventionsList.filter(
    (i) => i.reponseTechnicien === 'REFUSEE' && !i.entreprise && !['Clôturée', 'Annulée'].includes(String(i.statutOperationnel))
  );
  const reponsesEnAttente = interventionsList.filter((i) => i.reponseTechnicien === 'EN_ATTENTE');

  const blocs: Record<RoleFile, Bloc[]> = {
    chiffrage: [
      {
        id: 'cv',
        titre: 'À valider avant envoi au client',
        genre: 'valider',
        aide: 'Devis chiffrés en attente de votre validation interne.',
        items: aValiderEnInterne.map((d) => devisItem(d, 'à valider avant envoi')),
      },
      {
        id: 'ct',
        titre: 'À chiffrer et à relancer',
        genre: 'traiter',
        aide: 'Visites à organiser, montants à saisir, relances.',
        items: [
          ...queues.visitesDevisAPlanifier.map((d) => devisItem(d, 'visite à planifier')),
          ...(voitMontants
            ? devisList
                .filter((d) => !Number(d.amount) && !String(d.statutCommercial || '').startsWith('Refus'))
                .map((d) => devisItem(d, 'montant à saisir'))
            : []),
          ...queues.devisARelancer.map((d) =>
            devisItem(d, 'à relancer', [d.statutCommercial, d.prochaineAction].filter(Boolean).join(' · '))
          ),
          ...queues.devisAcceptesSansIntv.map((d) => devisItem(d, 'accepté — à transformer en intervention')),
        ],
      },
    ],
    travaux: [
      {
        id: 'tr',
        titre: 'Réponses des techniciens',
        genre: 'traiter',
        aide: 'Missions refusées à réaffecter, ou affectées sans réponse du technicien.',
        items: [
          ...reponsesRefusees.map((i) =>
            intvItem(i, 'refusée — à réaffecter', [i.motifRefus ? `Motif : ${i.motifRefus}` : '', i.chantier].filter(Boolean).join(' · '))
          ),
          ...reponsesEnAttente.map((i) =>
            intvItem(i, 'en attente de réponse', [i.entreprise, i.chantier].filter(Boolean).join(' · '))
          ),
        ],
      },
      {
        id: 'tv',
        titre: 'Interventions terminées à clôturer',
        genre: 'valider',
        aide: 'Le terrain a terminé : vous vérifiez puis vous clôturez.',
        items: rapportsAValider.map((i) => intvItem(i, 'terminée — à clôturer')),
      },
      {
        id: 'tt',
        titre: 'À planifier et à débloquer',
        genre: 'traiter',
        aide: 'Affecter un technicien, replanifier, débloquer les retards.',
        items: [
          ...queues.devisAcceptesSansIntv.map((d) => devisItem(d, 'devis accepté, sans intervention')),
          ...queues.intvAPlanifier.map((i) => intvItem(i, 'à planifier', [i.chantier, i.objet].filter(Boolean).join(' · '))),
          ...queues.intvEnRetard.map((i) => intvItem(i, 'en retard')),
        ],
      },
    ],
    rapports: [
      {
        id: 'rv',
        titre: 'Rapports à valider',
        genre: 'valider',
        aide: 'Relire le compte rendu du terrain, puis clôturer.',
        items: rapportsAValider.map((i) => intvItem(i, 'rapport à valider', [i.chantier, i.statutRapport].filter(Boolean).join(' · '))),
      },
      {
        id: 'rf',
        titre: 'À facturer',
        genre: 'valider',
        aide: 'Interventions clôturées sans facture : renseigner le numéro et le statut.',
        items: queues.intvAFacturer
          .filter((i) => i.statutOperationnel === 'Clôturée')
          .map((i) => intvItem(i, 'clôturée, non facturée')),
      },
      {
        id: 'rt',
        titre: 'Rapports à rédiger',
        genre: 'traiter',
        aide: 'Comptes rendus incomplets à finaliser.',
        items: rapportsARediger.map((i) => intvItem(i, 'rapport à terminer', [i.chantier, i.statutRapport].filter(Boolean).join(' · '))),
      },
    ],
    terrain: [
      {
        id: 'mt',
        titre: monNom ? 'Mes interventions' : 'Interventions planifiées',
        genre: 'traiter',
        aide: 'Vos missions à venir : arrivée, fin, compte rendu et photos.',
        items: mesInterventions.map((i) =>
          intvItem(
            i,
            String(i.objet || i.typeIntervention || 'intervention'),
            [String(i.datePlanifiee || '').slice(0, 10).split('-').reverse().join('/'), i.heureDebut, i.chantier]
              .filter(Boolean)
              .join(' · ')
          )
        ),
      },
      {
        id: 'mr',
        titre: 'Comptes rendus à terminer',
        genre: 'traiter',
        aide: 'Terminé sur place mais compte rendu ou photos manquants.',
        items: queues.rapportsEnAttente
          .filter((i) => i.statutOperationnel !== 'Terminée - à valider')
          .map((i) => intvItem(i, 'compte rendu à terminer')),
      },
    ],
    direction: [
      {
        id: 'dr',
        titre: 'Réponses des techniciens',
        genre: 'traiter',
        aide: 'Missions refusées à réaffecter, ou affectées sans réponse du technicien.',
        items: [
          ...reponsesRefusees.map((i) =>
            intvItem(i, 'refusée — à réaffecter', [i.motifRefus ? `Motif : ${i.motifRefus}` : '', i.chantier].filter(Boolean).join(' · '))
          ),
          ...reponsesEnAttente.map((i) =>
            intvItem(i, 'en attente de réponse', [i.entreprise, i.chantier].filter(Boolean).join(' · '))
          ),
        ],
      },
      {
        id: 'dv',
        titre: 'À valider',
        genre: 'valider',
        aide: 'Devis à valider en interne, rapports terminés et réserves à lever.',
        items: [
          ...aValiderEnInterne.map((d) => devisItem(d, 'devis à valider en interne')),
          ...rapportsAValider.map((i) => intvItem(i, 'rapport à valider')),
          ...interventionsList
            .filter(
              (i) =>
                i.statutRapport === 'Réserve / Finition à prévoir' &&
                !['Clôturée', 'Annulée'].includes(String(i.statutOperationnel))
            )
            .map((i) => intvItem(i, 'réserve à lever')),
        ],
      },
      {
        id: 'df',
        titre: 'À facturer et à surveiller',
        genre: 'traiter',
        aide: 'Terminées non facturées, devis sans numéro de DI.',
        items: [
          ...queues.intvAFacturer.map((i) => intvItem(i, 'terminée, non facturée')),
          ...devisList
            .filter((d) => !String(d.numeroDI || '').trim())
            .map((d) => devisItem(d, 'devis sans numéro de DI', [d.reference, d.objet].filter(Boolean).join(' · '))),
        ],
      },
    ],
  };

  const courants = blocs[role];
  const perimetre = ROLE_PERIMETRE[role];
  const total = courants.reduce((n, b) => n + b.items.length, 0);
  const aValider = courants.filter((b) => b.genre === 'valider').reduce((n, b) => n + b.items.length, 0);
  const peutVoirDemandes = role === 'direction' || role === 'chiffrage' || role === 'travaux';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="mon-travail">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Mon travail{user?.name ? ` — ${user.name}` : ''}
        </h2>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
          }}
        >
          {perimetre.titre}
        </span>
        {peutSuperviser && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 'auto' }} title="Supervision : voir la file d'un autre profil">
            {(Object.keys(ROLE_LABEL) as RoleFile[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`btn btn-sm ${role === r ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setVue(r)}
                data-testid={`mafile-role-${r}`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{aValider}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>à valider par vous</div>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{total - aValider}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>à traiter</div>
        </div>
        {peutVoirDemandes && demandesADecider.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5 }}>
              <strong>{demandesADecider.length}</strong> demande{demandesADecider.length > 1 ? 's' : ''} à décider
              {' — '}
              <span style={{ color: 'var(--text-secondary)' }}>
                {demandesADecider.slice(0, 3).map((d) => d.cleDossier).join(' · ')}
                {demandesADecider.length > 3 ? ' …' : ''}
              </span>
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={onGoDemandes}>
              Ouvrir les demandes
            </button>
          </div>
        )}
      </div>

      {courants.map((bloc) => (
        <div key={bloc.id} style={card} data-testid={`bloc-${bloc.id}`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <strong style={{ fontSize: 14.5 }}>{bloc.titre}</strong>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.4,
                padding: '2px 8px',
                borderRadius: 999,
                background: bloc.genre === 'valider' ? 'rgba(217,119,6,0.14)' : 'rgba(37,99,235,0.12)',
                color: bloc.genre === 'valider' ? '#b45309' : '#1d4ed8',
              }}
            >
              {bloc.genre === 'valider' ? 'À VALIDER PAR VOUS' : 'À TRAITER'}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {bloc.items.length} élément{bloc.items.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>{bloc.aide}</div>
          {bloc.items.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rien n’attend ici.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bloc.items.slice(0, 15).map((it) => (
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
              {bloc.items.length > 15 && (
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  et {bloc.items.length - 15} autre{bloc.items.length - 15 > 1 ? 's' : ''}…
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div style={{ ...card, display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }} data-testid="perimetre">
        <div>
          <strong style={{ fontSize: 14 }}>Vous validez</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {perimetre.vousValidez.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong style={{ fontSize: 14 }}>Hors de votre périmètre</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {perimetre.horsPerimetre.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
