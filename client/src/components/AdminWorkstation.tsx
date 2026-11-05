import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  interventionApi,
  User,
  UserPermissions,
  ROLE_DEFINITIONS,
  getEffectivePermissions,
  Intervention,
  Devis,
  formatDateFR,
} from '../lib/api';
import toast from 'react-hot-toast';
import { PhotoLightbox, PhotoItem } from './PhotoLightbox';

interface AdminWorkstationProps {
  techniciens: string[];
  interventionsList: Intervention[];
  devisList: Devis[];
  onOpenInterventionDrawer: (intv: Intervention) => void;
  onOpenDevisDrawer: (devis: Devis) => void;
  onSwitchToMobilePreview: (technicien: string) => void;
  initialSubTab?: 'users' | 'roles_guide' | 'pointages' | 'rapports';
}

const PERMISSION_LABELS: { key: keyof UserPermissions; label: string; desc: string }[] = [
  {
    key: 'canManageUsers',
    label: 'Workstation Admin & Utilisateurs',
    desc: 'Créer des comptes, attribuer les rôles et modifier les permissions',
  },
  {
    key: 'canManageReferentiels',
    label: 'Référentiels & Compétences Métier',
    desc: 'Ajouter des techniciens, corps d’état et modifier la matrice de compétences',
  },
  {
    key: 'canEditDevis',
    label: 'Création & Modification Devis (22 col.)',
    desc: 'Saisir les demandes de devis, relances, statuts commerciaux et visites',
  },
  {
    key: 'canViewFinancials',
    label: 'Accès Chiffrage & Montants HT',
    desc: 'Voir et modifier les montants HT des devis et budgets d’intervention',
  },
  {
    key: 'canConvertDevis',
    label: 'Conversion Devis → Intervention',
    desc: 'Transformer un devis en visite technique ou en intervention travaux',
  },
  {
    key: 'canEditPlanning',
    label: 'Pilotage Planning Gantt & Auto-Dispatch',
    desc: 'Déplacer les créneaux, affecter les techniciens et lancer l’auto-planification',
  },
  {
    key: 'canEditInterventions',
    label: 'Modification des Interventions (23 col.)',
    desc: 'Modifier les fiches d’intervention, statuts opérationnels et suivis terrain',
  },
  {
    key: 'canWriteReports',
    label: 'Rédaction & Validation des Rapports',
    desc: 'Exploiter les déclarations techniciens & photos pour rédiger le rapport officiel',
  },
  {
    key: 'canManageBilling',
    label: 'Facturation & Clôture Financière',
    desc: 'Saisir les numéros de facture et passer les dossiers en « Facturée »',
  },
  {
    key: 'canDeleteRecords',
    label: 'Suppression de Devis / Interventions',
    desc: 'Autoriser la suppression définitive d’enregistrements',
  },
  {
    key: 'mobileOnly',
    label: 'Interface Mobile Technicien Uniquement',
    desc: 'Ouvre directement l’application mobile terrain épurée à la connexion',
  },
];

export function AdminWorkstation({
  techniciens,
  interventionsList,
  devisList,
  onOpenInterventionDrawer,
  onOpenDevisDrawer,
  onSwitchToMobilePreview,
  initialSubTab,
}: AdminWorkstationProps) {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<'users' | 'roles_guide' | 'pointages' | 'rapports'>(
    initialSubTab || 'users'
  );

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Lightbox photos
  const [lightboxPhotos, setLightboxPhotos] = useState<PhotoItem[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Date filtre pointages
  const [pointageDate, setPointageDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Formulaire nouvel utilisateur
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('CHIFFRAGE_DEVIS');
  const [newTechNom, setNewTechNom] = useState<string>('');
  const [newPerms, setNewPerms] = useState<UserPermissions>(() =>
    getEffectivePermissions('CHIFFRAGE_DEVIS', null)
  );

  // Edition d'un utilisateur existant
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<string>('USER');
  const [editTechNom, setEditTechNom] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editPerms, setEditPerms] = useState<UserPermissions>(() =>
    getEffectivePermissions('ADMIN', null)
  );

  // Rédaction de rapport à partir des déclarations technicien
  const [selectedReportIntv, setSelectedReportIntv] = useState<Intervention | null>(null);
  const [draftRapportFinal, setDraftRapportFinal] = useState<string>('');
  const [draftResultatTechnique, setDraftResultatTechnique] = useState<string>('');
  const [draftStatutRapport, setDraftStatutRapport] = useState<string>('Validé & Clôturé');

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await adminApi.listUsers();
      return res.data.data;
    },
  });

  const pointagesQuery = useQuery({
    queryKey: ['admin-pointages', pointageDate],
    queryFn: async () => {
      const res = await adminApi.listPointages({ dateJour: pointageDate });
      return res.data.data;
    },
  });

  const createUserMut = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(res.data.message || 'Utilisateur créé');
      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateUserMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => adminApi.updateUser(id, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(res.data.message || 'Droits mis à jour');
      setEditingUser(null);
      setEditPassword('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteUserMut = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Utilisateur supprimé');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Suppression refusée');
    },
  });

  const clockInMut = useMutation({
    mutationFn: adminApi.clockIn,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success(res.data.message);
    },
  });

  const clockOutMut = useMutation({
    mutationFn: adminApi.clockOut,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success(res.data.message);
    },
  });

  const updateIntvReportMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => interventionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Rapport consolidé et enregistré avec succès');
      setSelectedReportIntv(null);
    },
  });

  const users = usersQuery.data || [];
  const pointages = pointagesQuery.data || [];

  const handleSelectRoleForCreate = (rCode: string) => {
    setNewRole(rCode);
    setNewPerms(getEffectivePermissions(rCode, null));
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditTechNom(u.technicienNom || '');
    setEditPassword('');
    setEditPerms(u.permissions || getEffectivePermissions(u.role, null));
  };

  const buildAutoReportFromDeclaration = (intv: Intervention): string => {
    const lines: string[] = [];
    lines.push(`RAPPORT OFFICIEL D'INTERVENTION — ANELEC GROUPE`);
    lines.push(`Référence : ${intv.reference || `INT-${intv.id}`} (${intv.isVisiteDevis ? 'Visite Technique Devis' : intv.typeIntervention || 'Intervention Travaux'})`);
    lines.push(`Client / Donneur d'ordre : ${intv.client || '—'}`);
    lines.push(`Site / Adresse : ${intv.chantier || '—'}`);
    lines.push(`Corps d'état : ${intv.corpsEtat || 'Tous corps d’état'}`);
    lines.push(`Technicien intervenant : ${intv.entreprise || 'Non renseigné'}`);
    lines.push(
      `Date & Horaires : Le ${formatDateFR(intv.datePlanifiee)} • Créneau prévu : ${intv.heureDebut || '—'}-${intv.heureFin || '—'} • Exécution réelle pointée : ${intv.heureDebutReelle || intv.heureDebut || '—'} à ${intv.heureFinReelle || intv.heureFin || '—'}`
    );
    lines.push('');
    if (intv.actionsRealisees && intv.actionsRealisees.length > 0) {
      lines.push(`1. PRESTATIONS & ACTIONS RÉALISÉES SUR SITE :`);
      intv.actionsRealisees.forEach((act) => {
        lines.push(`   ✓ ${act}`);
      });
      lines.push('');
    }
    if (intv.compteRendu) {
      lines.push(`2. CONSTATATIONS TECHNIQUES & COMPTE RENDU TERRAIN :`);
      lines.push(`   ${intv.compteRendu}`);
      lines.push('');
    }
    if (intv.elementsChiffrage) {
      lines.push(`3. ÉLÉMENTS RELEVÉS POUR CHIFFRAGE / DEVIS :`);
      lines.push(`   ${intv.elementsChiffrage}`);
      lines.push('');
    }
    if (intv.photos && intv.photos.length > 0) {
      lines.push(`4. DOSSIER PHOTOGRAPHIQUE JOINT :`);
      lines.push(`   ${intv.photos.length} photo(s) horodatée(s) prise(s) sur site (${intv.photos.map((p: any) => p.category || 'Terrain').join(', ')}).`);
      lines.push('');
    }
    lines.push(`5. CONCLUSION & RÉSULTAT TECHNIQUE :`);
    lines.push(`   ${intv.resultatTechnique || 'Intervention réalisée conformément aux règles de l’art.'}`);
    return lines.join('\n');
  };

  const declarationsList = interventionsList.filter(
    (i) =>
      (i.actionsRealisees && i.actionsRealisees.length > 0) ||
      (i.photos && i.photos.length > 0) ||
      Boolean(i.heureDebutReelle) ||
      Boolean(i.compteRendu) ||
      Boolean(i.elementsChiffrage) ||
      i.statutRapport === 'Déclaré par technicien' ||
      i.statutOperationnel === 'Terminée - à valider' ||
      i.statutOperationnel === 'En cours'
  );

  const pendingDeclarationsCount = declarationsList.filter(
    (i) =>
      i.statutRapport === 'Déclaré par technicien' ||
      (Boolean(i.photos && i.photos.length > 0) && i.statutRapport !== 'Validé & Clôturé')
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Barre supérieure de la Workstation Admin */}
      <div className="fsm-toolbar" style={{ borderLeft: '4px solid #dc2626' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(220, 38, 38, 0.12)',
                color: '#dc2626',
                fontWeight: 800,
                fontSize: '11px',
              }}
            >
              SUPER-ADMIN WORKSTATION
            </span>
            <h2 style={{ fontSize: '15px', fontWeight: 800 }}>
              Poste de Commandement Administrateur, Droits Utilisateurs & Rapports Terrain
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Gérez les comptes intervenants et leurs droits de modification, suivez les pointages matin/soir des techniciens et consolidez les rapports.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${subTab === 'users' ? 'active' : ''}`}
              onClick={() => setSubTab('users')}
            >
              Utilisateurs & Droits ({users.length})
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'roles_guide' ? 'active' : ''}`}
              onClick={() => setSubTab('roles_guide')}
            >
              Définition des Rôles & Droits
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'pointages' ? 'active' : ''}`}
              onClick={() => setSubTab('pointages')}
            >
              Pointages Matin / Soir Techniciens
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'rapports' ? 'active' : ''}`}
              onClick={() => setSubTab('rapports')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              Déclarations & Rédaction Rapports ({declarationsList.length})
              {pendingDeclarationsCount > 0 && (
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    animation: 'pulse 2s infinite',
                  }}
                >
                  {pendingDeclarationsCount} en attente
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              handleSelectRoleForCreate('CHIFFRAGE_DEVIS');
              setShowCreateModal(true);
            }}
          >
            + Désigner un Utilisateur
          </button>
        </div>
      </div>

      {/* =====================================================================
          SOUS-ONGLET 1 : UTILISATEURS & ATTRIBUTION DES DROITS DE MODIFICATION
         ===================================================================== */}
      {subTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="pro-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôle Métier ANELEC</th>
                  <th>Technicien Lié (App Mobile)</th>
                  <th>Droits de Modification Actifs</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Actions Admin</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleDef = ROLE_DEFINITIONS[u.role] || ROLE_DEFINITIONS.ADMIN;
                  const perms = u.permissions || getEffectivePermissions(u.role, null);
                  const activePermCount = Object.entries(perms).filter(
                    ([k, v]) => k !== 'mobileOnly' && Boolean(v)
                  ).length;

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {u.name} {u.id === 1 && '👑'}
                        </div>
                        <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {u.email}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            background: `${roleDef?.badgeColor || '#2563eb'}18`,
                            color: roleDef?.badgeColor || '#2563eb',
                            border: `1px solid ${roleDef?.badgeColor || '#2563eb'}40`,
                          }}
                        >
                          {roleDef?.label || u.role}
                        </span>
                      </td>
                      <td>
                        {u.technicienNom ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="badge badge-info">{u.technicienNom}</span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 7px', fontSize: '10.5px' }}
                              onClick={() => onSwitchToMobilePreview(u.technicienNom!)}
                            >
                              📱 Voir son App Mobile
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            Poste Bureau / Direction
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '430px' }}>
                          {perms.canManageUsers && <span className="badge badge-danger">Admin & Droits</span>}
                          {perms.canEditDevis && <span className="badge badge-info">Modif. Devis</span>}
                          {perms.canViewFinancials && <span className="badge badge-info">Chiffrage HT</span>}
                          {perms.canEditPlanning && <span className="badge badge-purple">Planning Gantt</span>}
                          {perms.canEditInterventions && <span className="badge badge-success">Modif. Interventions</span>}
                          {perms.canWriteReports && <span className="badge badge-success">Rédaction Rapports</span>}
                          {perms.canManageBilling && <span className="badge badge-warning">Facturation</span>}
                          {perms.mobileOnly && <span className="badge badge-warning">📱 Version Mobile Dédiée</span>}
                          <span className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            ({activePermCount} droits)
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.active !== false ? 'badge-success' : 'badge-danger'}`}>
                          {u.active !== false ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditUserModal(u)}
                          >
                            Configurer Droits
                          </button>
                          {u.id !== 1 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#dc2626' }}
                              onClick={() => {
                                if (window.confirm(`Supprimer le compte de ${u.name} ?`)) {
                                  deleteUserMut.mutate(u.id);
                                }
                              }}
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SOUS-ONGLET 2 : DÉFINITION COMPLÈTE DES RÔLES & DROITS PAR INTERVENANT
         ===================================================================== */}
      {subTab === 'roles_guide' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
          {Object.values(ROLE_DEFINITIONS).map((r) => (
            <div
              key={r.code}
              className="pro-table-container"
              style={{
                padding: '16px 18px',
                borderTop: `4px solid ${r.badgeColor}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    background: `${r.badgeColor}18`,
                    color: r.badgeColor,
                  }}
                >
                  {r.label}
                </span>
                <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Code: {r.code}
                </span>
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {r.summary}
              </p>

              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                Droits & Responsabilités Clés :
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {r.keyResponsibilities.map((resp, idx) => (
                  <li key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {resp}
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Pré-configuré dans la matrice IAM
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    handleSelectRoleForCreate(r.code);
                    setShowCreateModal(true);
                  }}
                >
                  Créer un compte « {r.label.split('/')[0].trim()} »
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =====================================================================
          SOUS-ONGLET 3 : POINTAGES JOURNALIERS DES TECHNICIENS (MATIN / SOIR)
         ===================================================================== */}
      {subTab === 'pointages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="fsm-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '13.5px', fontWeight: 700 }}>
                  Registre des Pointages Journaliers (Arrivée Bureau Matin & Fin Dernière Intervention Soir)
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Chaque technicien active son arrivée au bureau le matin sur son mobile et désactive sa journée le soir après sa dernière intervention.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Jour contrôlé :</label>
              <input
                type="date"
                className="input"
                style={{ width: '155px' }}
                value={pointageDate}
                onChange={(e) => setPointageDate(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPointageDate(new Date().toISOString().slice(0, 10))}
              >
                Aujourd'hui
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {techniciens.map((tech) => {
              const pt = pointages.find((p) => p.technicien === tech && p.dateJour === pointageDate);
              const techIntvsDay = interventionsList.filter(
                (i) => i.entreprise === tech && i.datePlanifiee === pointageDate
              );
              const finishedDayIntvs = techIntvsDay.filter((i) =>
                ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel)
              );
              const lastIntvRef =
                pt?.derniereInterventionRef ||
                finishedDayIntvs[finishedDayIntvs.length - 1]?.reference ||
                techIntvsDay[techIntvsDay.length - 1]?.reference ||
                null;

              const isEnService = pt && pt.statutJournee === 'EN_SERVICE';
              const isTerminee = pt && pt.statutJournee === 'TERMINEE';

              return (
                <div
                  key={tech}
                  className="pro-table-container"
                  style={{
                    padding: '14px 16px',
                    borderLeft: isEnService
                      ? '4px solid #10b981'
                      : isTerminee
                      ? '4px solid #2563eb'
                      : '4px solid #94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px' }}>{tech}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {techIntvsDay.length} mission(s) prévue(s) ce jour ({finishedDayIntvs.length} terminée(s))
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        isEnService ? 'badge-success' : isTerminee ? 'badge-info' : 'badge-neutral'
                      }`}
                    >
                      {isEnService
                        ? '🟢 En service'
                        : isTerminee
                        ? '🔵 Journée clôturée'
                        : '⚪ Non pointé'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      background: 'var(--bg-elevated)',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        ☀️ ARRIVÉE BUREAU (MATIN)
                      </div>
                      <div className="font-mono" style={{ fontSize: '15px', fontWeight: 800, color: pt?.heureArriveeBureau ? '#059669' : 'var(--text-muted)' }}>
                        {pt?.heureArriveeBureau || '— : —'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        🌙 FIN DERNIÈRE INTV. (SOIR)
                      </div>
                      <div className="font-mono" style={{ fontSize: '15px', fontWeight: 800, color: pt?.heureFinJournee ? '#2563eb' : 'var(--text-muted)' }}>
                        {pt?.heureFinJournee || '— : —'}
                      </div>
                    </div>
                  </div>

                  {pt?.dureeMinutes != null && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Amplitude journalière :</span>
                      <strong className="font-mono">
                        {Math.floor(pt.dureeMinutes / 60)}h{String(pt.dureeMinutes % 60).padStart(2, '0')}
                      </strong>
                    </div>
                  )}

                  {lastIntvRef && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Dernière mission : <strong className="font-mono">{lastIntvRef}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', flexWrap: 'wrap' }}>
                    {!pt?.heureArriveeBureau && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          clockInMut.mutate({
                            technicien: tech,
                            dateJour: pointageDate,
                          })
                        }
                      >
                        ☀️ Activer Matin
                      </button>
                    )}
                    {isEnService && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          clockOutMut.mutate({
                            technicien: tech,
                            dateJour: pointageDate,
                            derniereInterventionRef: lastIntvRef || undefined,
                          })
                        }
                      >
                        🌙 Désactiver Soir
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => onSwitchToMobilePreview(tech)}
                    >
                      📱 Ouvrir Mobile de {tech}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          SOUS-ONGLET 4 : DÉCLARATIONS TECHNICIENS & RÉDACTION DES RAPPORTS
         ===================================================================== */}
      {subTab === 'rapports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="fsm-toolbar">
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700 }}>
                Centre de Rédaction des Rapports & Chiffrage (Depuis les Déclarations Techniciens)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Consultez les comptes rendus, actions pré-remplies, éléments de chiffrage et photos envoyés depuis l'interface mobile technicien pour rédiger le rapport final ou chiffrer le devis.
              </p>
            </div>
          </div>

          <div className="pro-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th>Réf. & Type</th>
                  <th>Client & Site</th>
                  <th>Technicien & Horaires Réels</th>
                  <th>Actions Pré-remplies & Déclaration Terrain</th>
                  <th>Photos</th>
                  <th>Statut Rapport</th>
                  <th style={{ textAlign: 'right' }}>Actions Rédacteur / Chiffrage</th>
                </tr>
              </thead>
              <tbody>
                {declarationsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                      Aucune déclaration terrain enregistrée pour le moment. Utilisez l'App Mobile Technicien pour tester une déclaration avec actions pré-remplies et photos.
                    </td>
                  </tr>
                ) : (
                  declarationsList.map((intv) => {
                    const parentDevis = intv.devisId
                      ? devisList.find((d) => d.id === intv.devisId)
                      : null;

                    return (
                      <tr key={intv.id}>
                        <td>
                          <div className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {intv.reference || `INT-${intv.id}`}
                          </div>
                          <span className={`badge ${intv.isVisiteDevis ? 'badge-purple' : 'badge-info'}`}>
                            {intv.isVisiteDevis ? '📐 Visite Devis' : intv.typeIntervention || 'Travaux'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{intv.client || '—'}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{intv.chantier}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{intv.entreprise || 'Non affecté'}</div>
                          <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {formatDateFR(intv.datePlanifiee)} •{' '}
                            {intv.heureDebutReelle ? (
                              <span style={{ color: '#059669', fontWeight: 700 }}>
                                Réel: {intv.heureDebutReelle} → {intv.heureFinReelle || 'En cours'}
                              </span>
                            ) : (
                              <span>
                                Prévu: {intv.heureDebut || '—'}-{intv.heureFin || '—'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ maxWidth: '340px' }}>
                          {intv.actionsRealisees && intv.actionsRealisees.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                              {intv.actionsRealisees.slice(0, 3).map((act, idx) => (
                                <span key={idx} className="badge badge-success" style={{ fontSize: '10px' }}>
                                  ✓ {act}
                                </span>
                              ))}
                              {intv.actionsRealisees.length > 3 && (
                                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                                  +{intv.actionsRealisees.length - 3} autres
                                </span>
                              )}
                            </div>
                          )}
                          {intv.elementsChiffrage && (
                            <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>
                              📐 Chiffrage : {intv.elementsChiffrage}
                            </div>
                          )}
                          {intv.compteRendu && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                              {intv.compteRendu.slice(0, 110)}
                              {intv.compteRendu.length > 110 ? '...' : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          {intv.photos && intv.photos.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div
                                style={{ display: 'flex', gap: '4px', cursor: 'pointer' }}
                                onClick={() => {
                                  setLightboxPhotos(intv.photos as any);
                                  setLightboxIndex(0);
                                }}
                                title="Cliquer pour voir les photos en plein écran"
                              >
                                {intv.photos.slice(0, 2).map((ph: any, idx: number) => (
                                  <img
                                    key={ph.id || idx}
                                    src={ph.url}
                                    alt=""
                                    style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '6px',
                                      objectFit: 'cover',
                                      border: '1px solid var(--border-default)',
                                    }}
                                  />
                                ))}
                              </div>
                              <button
                                type="button"
                                className="badge badge-info"
                                style={{ cursor: 'pointer', border: 'none' }}
                                onClick={() => {
                                  setLightboxPhotos(intv.photos as any);
                                  setLightboxIndex(0);
                                }}
                              >
                                📷 {intv.photos.length} photo(s)
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Aucune</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              intv.statutRapport === 'Validé & Clôturé'
                                ? 'badge-success'
                                : intv.compteRendu || (intv.actionsRealisees && intv.actionsRealisees.length > 0)
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                          >
                            {intv.statutRapport || 'À rédiger'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedReportIntv(intv);
                                setDraftRapportFinal(
                                  intv.rapportFinal || buildAutoReportFromDeclaration(intv)
                                );
                                setDraftResultatTechnique(
                                  intv.resultatTechnique || 'Intervention réalisée sans réserve'
                                );
                                setDraftStatutRapport('Validé & Clôturé');
                              }}
                            >
                              📝 Rédiger / Valider Rapport
                            </button>
                            {parentDevis && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => onOpenDevisDrawer(parentDevis)}
                              >
                                Chiffrer Devis
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => onOpenInterventionDrawer(intv)}
                            >
                              Fiche 23 col.
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALE : CRÉATION D'UN UTILISATEUR AVEC DROITS PERSONNALISÉS
         ===================================================================== */}
      {showCreateModal && (
        <div className="inspector-backdrop" onClick={() => setShowCreateModal(false)}>
          <div
            className="pro-table-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '680px',
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: '4vh auto',
              padding: '20px',
              background: 'var(--bg-surface)',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>
              Désigner un Nouvel Utilisateur & Configurer ses Droits
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Sélectionnez un profil métier ANELEC puis ajustez finement ses autorisations de modification.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMut.mutate({
                  name: newName,
                  email: newEmail,
                  password: newPassword,
                  role: newRole,
                  technicienNom: newRole === 'TECHNICIEN' ? newTechNom || newName : newTechNom || null,
                  permissions: newPerms,
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Nom complet *</label>
                  <input
                    type="text"
                    className="input"
                    required
                    placeholder="Ex: Anouar / Assistante Rapports..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Email de connexion *</label>
                  <input
                    type="email"
                    className="input"
                    required
                    placeholder="prenom@anelecgroupe.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Mot de passe initial *</label>
                  <input
                    type="password"
                    className="input"
                    required
                    minLength={6}
                    placeholder="Min. 6 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Rôle Métier ANELEC *</label>
                  <select
                    className="select"
                    value={newRole}
                    onChange={(e) => handleSelectRoleForCreate(e.target.value)}
                  >
                    {Object.values(ROLE_DEFINITIONS).map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>
                    Technicien Terrain associé (si Mobile)
                  </label>
                  <select
                    className="select"
                    value={newTechNom}
                    onChange={(e) => setNewTechNom(e.target.value)}
                  >
                    <option value="">— Aucun (Poste Bureau) —</option>
                    {techniciens.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                  Matrice des Droits de Modification (Personnalisable) :
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {PERMISSION_LABELS.map((p) => (
                    <label
                      key={p.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(newPerms[p.key])}
                        onChange={(e) =>
                          setNewPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))
                        }
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 700 }}>{p.label}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={createUserMut.isPending}>
                  {createUserMut.isPending ? 'Création...' : 'Créer l’utilisateur avec ces droits'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALE : MODIFICATION DES DROITS D'UN UTILISATEUR EXISTANT
         ===================================================================== */}
      {editingUser && (
        <div className="inspector-backdrop" onClick={() => setEditingUser(null)}>
          <div
            className="pro-table-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '680px',
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: '4vh auto',
              padding: '20px',
              background: 'var(--bg-surface)',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>
              Modifier les Droits de : {editingUser.name} ({editingUser.email})
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateUserMut.mutate({
                  id: editingUser.id,
                  payload: {
                    role: editRole,
                    technicienNom: editTechNom || null,
                    permissions: editPerms,
                    ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
                  },
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Rôle Métier ANELEC</label>
                  <select
                    className="select"
                    value={editRole}
                    onChange={(e) => {
                      const r = e.target.value;
                      setEditRole(r);
                      setEditPerms(getEffectivePermissions(r, null));
                    }}
                  >
                    {Object.values(ROLE_DEFINITIONS).map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Technicien Terrain Lié</label>
                  <select
                    className="select"
                    value={editTechNom}
                    onChange={(e) => setEditTechNom(e.target.value)}
                  >
                    <option value="">— Aucun (Poste Bureau) —</option>
                    {techniciens.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>
                    Réinitialiser mot de passe (optionnel)
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Laisser vide pour conserver"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                  Permissions Granulaires Actives :
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {PERMISSION_LABELS.map((p) => (
                    <label
                      key={p.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(editPerms[p.key])}
                        onChange={(e) =>
                          setEditPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))
                        }
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 700 }}>{p.label}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={updateUserMut.isPending}>
                  Enregistrer les droits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALE : CONSOLIDATION & RÉDACTION DU RAPPORT FINAL DEPUIS DÉCLARATION
         ===================================================================== */}
      {selectedReportIntv && (
        <div className="inspector-backdrop" onClick={() => setSelectedReportIntv(null)}>
          <div
            className="pro-table-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '740px',
              maxWidth: '95vw',
              maxHeight: '92vh',
              overflowY: 'auto',
              margin: '3vh auto',
              padding: '20px',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800 }}>
                  Rédaction & Validation du Rapport Officiel — {selectedReportIntv.reference}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Basé sur la déclaration terrain de <strong>{selectedReportIntv.entreprise || 'Technicien'}</strong> ({selectedReportIntv.client} • {selectedReportIntv.chantier})
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setDraftRapportFinal(buildAutoReportFromDeclaration(selectedReportIntv))
                }
              >
                🔄 Régénérer depuis la déclaration technicien
              </button>
            </div>

            {selectedReportIntv.photos && selectedReportIntv.photos.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 700 }}>
                    Photos prises par le technicien ({selectedReportIntv.photos.length}) :
                  </div>
                  <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
                    🔍 Cliquez sur une photo pour l'agrandir / la télécharger
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {selectedReportIntv.photos.map((ph: any, idx: number) => (
                    <div
                      key={ph.id || idx}
                      onClick={() => {
                        setLightboxPhotos(selectedReportIntv.photos as any);
                        setLightboxIndex(idx);
                      }}
                      style={{
                        minWidth: '130px',
                        maxWidth: '130px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-elevated)',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                      }}
                      title="Agrandir la photo"
                    >
                      <img
                        src={ph.url}
                        alt={ph.caption || 'Photo terrain'}
                        style={{ width: '100%', height: '84px', objectFit: 'cover' }}
                      />
                      <div style={{ padding: '4px 6px', fontSize: '10px' }}>
                        <strong>{ph.category || 'PHOTO'}</strong>
                        <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ph.caption || 'Sans légende'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>
                  Résultat technique synthétique
                </label>
                <input
                  type="text"
                  className="input"
                  value={draftResultatTechnique}
                  onChange={(e) => setDraftResultatTechnique(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>
                  Rapport Final Officiel (modifiable avant validation / envoi client)
                </label>
                <textarea
                  className="input"
                  rows={13}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.45 }}
                  value={draftRapportFinal}
                  onChange={(e) => setDraftRapportFinal(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>Statut du rapport :</label>
                  <select
                    className="select"
                    style={{ width: '210px' }}
                    value={draftStatutRapport}
                    onChange={(e) => setDraftStatutRapport(e.target.value)}
                  >
                    <option value="Rapport rédigé">Rapport rédigé (En attente)</option>
                    <option value="Validé & Clôturé">Validé & Clôturé (Prêt à facturer)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedReportIntv(null)}
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      updateIntvReportMut.mutate({
                        id: selectedReportIntv.id,
                        data: {
                          rapportFinal: draftRapportFinal,
                          resultatTechnique: draftResultatTechnique,
                          statutRapport: draftStatutRapport,
                          ...(draftStatutRapport === 'Validé & Clôturé'
                            ? { statutOperationnel: 'Clôturée', traitement: 'Traité' }
                            : {}),
                        },
                      });
                    }}
                  >
                    Valider & Enregistrer le Rapport Officiel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Visionneuse plein écran de photos (Lightbox) */}
      {lightboxPhotos && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxPhotos(null)}
        />
      )}
    </div>
  );
}
