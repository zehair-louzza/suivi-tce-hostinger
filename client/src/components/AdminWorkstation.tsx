import { getCompanyName } from '../lib/companyHQ';
import { PasswordRules } from './PasswordRules';
import { validatePassword, passwordErrorMessage } from '../../../shared/passwordPolicy';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  automationApi,
  type AutomationSettings,
  interventionApi,
  User,
  UserPermissions,
  ROLE_DEFINITIONS,
  getEffectivePermissions,
  isPermissionAllowedForRole,
  Intervention,
  Devis,
  formatDateFR,
} from '../lib/api';
import toast from 'react-hot-toast';
import { PhotoLightbox, PhotoItem } from './PhotoLightbox';
import { useAuth } from '../stores/authStore';
import { AppearancePanel } from './AppearancePanel';
import { ProAlertIcon, ProFileTextIcon, ProMailIcon } from './ProIcons';
import { ROLE_ESPACE, ROLE_PERIMETRE, canUserAccessSection } from '../../../shared/types';

interface AdminWorkstationProps {
  techniciens: string[];
  interventionsList: Intervention[];
  devisList: Devis[];
  onOpenInterventionDrawer: (intv: Intervention) => void;
  onOpenDevisDrawer: (devis: Devis) => void;
  onSwitchToMobilePreview: (technicien: string) => void;
  initialSubTab?: 'users' | 'roles_guide' | 'pointages' | 'rapports' | 'billing_rules' | 'emails_smtp' | 'danger_zone' | 'appearance' | 'automations';
  onOpenSendReportEmail?: (intv: Intervention) => void;
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

const INTERACTIVE_PERMS: { key: keyof UserPermissions; label: string; short: string; color: string }[] = [
  { key: 'canManageUsers', label: 'Workstation Admin', short: 'Admin', color: '#ef4444' },
  { key: 'canEditDevis', label: 'Devis', short: 'Devis', color: '#0284c7' },
  { key: 'canViewFinancials', label: 'Chiffrage HT', short: 'Chiffrage', color: '#0284c7' },
  { key: 'canConvertDevis', label: 'Conversion devis → intervention', short: 'Conversion', color: '#0ea5e9' },
  { key: 'canEditPlanning', label: 'Planning Gantt', short: 'Planning', color: '#8b5cf6' },
  { key: 'canEditInterventions', label: 'Interventions', short: 'Interv.', color: '#10b981' },
  { key: 'canWriteReports', label: 'Rapports', short: 'Rapports', color: '#10b981' },
  { key: 'canManageBilling', label: 'Facturation', short: 'Facturation', color: '#f59e0b' },
  { key: 'canManageReferentiels', label: 'Référentiels', short: 'Référentiels', color: '#6366f1' },
  { key: 'mobileOnly', label: 'App Mobile', short: 'Mobile', color: '#64748b' },
];

/** Réglages des automatisations « technicien » de la société. */
function AutomationsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['automatisations'], queryFn: async () => (await automationApi.get()).data.data });
  const mut = useMutation({
    mutationFn: (p: Partial<AutomationSettings>) => automationApi.update(p),
    onSuccess: () => {
      toast.success('Automatisations mises à jour');
      queryClient.invalidateQueries({ queryKey: ['automatisations'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Modification impossible'),
  });
  const actif = query.data?.autoTechnicienActif !== false;
  const delai = query.data?.autoTechnicienDelaiMinutes ?? 15;
  const delaiAlerte = query.data?.autoTechnicienAlerteMinutes ?? 5;
  const heuresBureau = query.data?.autoTechnicienHeuresBureau !== false;
  const devisActif = query.data?.autoDevisActif !== false;
  const rapportActif = query.data?.autoRapportActif !== false;
  const dureeLabel = (m: number) => (m < 60 ? `${m} minutes` : `${m / 60} heure${m >= 120 ? 's' : ''}`);
  const optionsDelai = Array.from(new Set([5, 10, 15, 30, 60, 120, 240, 480, delai])).sort((a, b) => a - b);
  const optionsAlerte = Array.from(new Set([5, 10, 15, 30, 60, delaiAlerte])).sort((a, b) => a - b);
  return (
    <div className="pro-table-container" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }} data-testid="admin-automations-section">
      <div>
        <h3 style={{ margin: 0, fontSize: '16px' }}>Réponse des techniciens aux affectations</h3>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Quand un technicien est affecté à une mission, il l'accepte ou la refuse (avec un motif). S'il ne répond pas, il est relancé, puis le
          planificateur et la direction sont alertés. Rien n'est envoyé hors de votre société, seules les nouvelles affectations sont concernées, et chaque action
          automatique est inscrite dans l'historique de la mission.
        </p>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={actif}
          disabled={query.isLoading || mut.isPending}
          onChange={(e) => mut.mutate({ autoTechnicienActif: e.target.checked })}
          data-testid="auto-technicien-toggle"
        />
        Activer la confirmation des missions par les techniciens
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '360px', fontWeight: 600, fontSize: '13px' }}>
        Sans réponse, relancer le technicien après
        <select
          value={delai}
          disabled={!actif || query.isLoading || mut.isPending}
          onChange={(e) => mut.mutate({ autoTechnicienDelaiMinutes: Number(e.target.value) })}
          data-testid="auto-technicien-delai"
        >
          {optionsDelai.map((m) => (
            <option key={m} value={m}>{dureeLabel(m)}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '360px', fontWeight: 600, fontSize: '13px' }}>
        Toujours sans réponse, alerter le planificateur et la direction après la relance, au bout de
        <select
          value={delaiAlerte}
          disabled={!actif || query.isLoading || mut.isPending}
          onChange={(e) => mut.mutate({ autoTechnicienAlerteMinutes: Number(e.target.value) })}
          data-testid="auto-technicien-alerte"
        >
          {optionsAlerte.map((m) => (
            <option key={m} value={m}>{dureeLabel(m)}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={heuresBureau}
          disabled={!actif || query.isLoading || mut.isPending}
          onChange={(e) => mut.mutate({ autoTechnicienHeuresBureau: e.target.checked })}
          data-testid="auto-technicien-heures"
        />
        Pause de fin de semaine : aucune relance ni alerte du samedi 17 h au lundi 6 h (heure de Paris) ; elles partent le lundi à 6 h. Jour et nuit les autres jours.
      </label>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
        Le technicien est prévenu et relancé uniquement dans l'application (cloche), sans e-mail. Le planificateur et la direction reçoivent l'alerte dans l'application et par e-mail.
      </p>

      <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle, #e2e8f0)', margin: '6px 0' }} />
      <div>
        <h3 style={{ margin: 0, fontSize: '16px' }}>Devis envoyés aux clients</h3>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          L'envoi d'un devis au client reste toujours manuel (adresse confirmée, devis vérifié). Une fois envoyé, le client répond par un lien personnel
          valable 30 jours. Sans réponse, il est relancé à J+3 et J+7 (du lundi au samedi, de 8 h à 19 h, heure de Paris), puis le devis passe à
          « Expiré ». Un silence n'est jamais une acceptation, et rien n'est supprimé.
        </p>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={devisActif}
          disabled={query.isLoading || mut.isPending}
          onChange={(e) => mut.mutate({ autoDevisActif: e.target.checked })}
          data-testid="auto-devis-toggle"
        />
        Relancer automatiquement les clients (J+3 / J+7) et marquer les devis « Expiré » au bout de 30 jours
      </label>
      <div>
        <h3 style={{ margin: '8px 0 0', fontSize: '16px' }}>Rapports envoyés aux clients</h3>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Le rapport n'est envoyé qu'après validation en interne, toujours à la main (adresse confirmée, rapport vérifié). Le client le valide ou émet
          des réserves via un lien personnel valable 30 jours. Sans réponse, il est relancé à J+3 et J+7 (du lundi au samedi, de 8 h à 19 h, heure de
          Paris), puis la direction est alertée. Un silence n'est jamais une validation, et rien n'est supprimé.
        </p>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={rapportActif}
          disabled={query.isLoading || mut.isPending}
          onChange={(e) => mut.mutate({ autoRapportActif: e.target.checked })}
          data-testid="auto-rapport-toggle"
        />
        Relancer automatiquement les clients (J+3 / J+7) sur les rapports sans réponse et alerter à l'expiration du lien
      </label>
    </div>
  );
}

const MATRIX_SECTIONS: { id: any; label: string }[] = [
  { id: 'aujourdhui', label: 'Mon travail / Tableau de bord' },
  { id: 'demandes', label: 'Demandes reçues' },
  { id: 'planning', label: 'Planning' },
  { id: 'devis', label: 'Devis' },
  { id: 'interventions', label: 'Interventions' },
  { id: 'carte', label: 'Carte et tournées' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'rentabilite', label: 'Comptabilité & équipe' },
  { id: 'clients', label: 'Profils & donneurs d’ordre' },
  { id: 'referentiels', label: 'Paramètres métier' },
  { id: 'admin', label: 'Utilisateurs et accès' },
  { id: 'mobile_tech', label: 'App mobile technicien' },
];

/** Tableau « qui voit quoi » : calculé avec les mêmes règles que le menu réel, sur les droits par défaut de chaque profil. */
function RolesMatrix() {
  const roles = Object.values(ROLE_DEFINITIONS);
  const fakeUser = (code: string): any => ({
    id: 999,
    role: code,
    name: 'x',
    technicienNom: code === 'TECHNICIEN' ? 'x' : null,
    permissions: getEffectivePermissions(code, null),
  });
  return (
    <div className="pro-table-container pro-table-scroll" style={{ overflowX: 'auto' }} data-testid="roles-matrix">
      <table className="pro-table" style={{ width: '100%', minWidth: '640px' }}>
        <thead>
          <tr>
            <th>Écran du menu</th>
            {roles.map((r) => (
              <th key={r.code} style={{ textAlign: 'center', color: r.badgeColor }}>{r.label.split('(')[0].trim()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX_SECTIONS.map((sec) => (
            <tr key={sec.id}>
              <td style={{ fontSize: '12px', fontWeight: 600 }}>{sec.label}</td>
              {roles.map((r) => {
                const ok = canUserAccessSection(sec.id, fakeUser(r.code));
                return (
                  <td key={r.code} style={{ textAlign: 'center', color: ok ? '#059669' : '#cbd5e1', fontWeight: 700 }}>
                    {ok ? '✓' : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 12px 10px' }}>
        Droits par défaut de chaque profil. Les réglages individuels peuvent retirer un accès, jamais dépasser le plafond du profil.
      </p>
    </div>
  );
}

/** Droits réellement appliqués à un utilisateur : ses réglages, bornés par le plafond de son profil. */
function effectivePermsOf(u: User): UserPermissions {
  return getEffectivePermissions(u.role, u.permissions ? JSON.stringify(u.permissions) : null);
}

export function AdminWorkstation({
  techniciens,
  interventionsList,
  devisList,
  onOpenInterventionDrawer,
  onOpenDevisDrawer,
  onSwitchToMobilePreview,
  initialSubTab,
  onOpenSendReportEmail,
}: AdminWorkstationProps) {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [subTab, setSubTab] = useState<
    'users' | 'roles_guide' | 'pointages' | 'rapports' | 'billing_rules' | 'emails_smtp' | 'danger_zone' | 'appearance' | 'automations'
  >(initialSubTab || 'users');
  const [showDestroyModal, setShowDestroyModal] = useState(false);

  // États Configuration & Diagnostic E-mails / SMTP
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpReplyTo, setSmtpReplyTo] = useState('');
  const [testRecipientEmail, setTestRecipientEmail] = useState(user?.email || '');

  // Invitations par e-mail
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('CONDUCTEUR_TRAVAUX');
  const [inviteTechNom, setInviteTechNom] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState<{ email: string; link: string; error: string | null } | null>(null);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [lastSmtpTestResult, setLastSmtpTestResult] = useState<any>(null);
  const [destroyPassword, setDestroyPassword] = useState('');
  const [destroyConfirmPhrase, setDestroyConfirmPhrase] = useState('');
  const [isDestroying, setIsDestroying] = useState(false);

  // Règle Métier ANELEC : « On ne facture pas les devis, on facture uniquement les interventions »
  // Option sur la console Admin, AUTO-DÉCOCHÉE par défaut (false)
  const [allowDirectDevisBilling, setAllowDirectDevisBilling] = useState<boolean>(() => {
    return localStorage.getItem('anelec_allow_direct_devis_billing') === 'true'; // false par défaut
  });

  const handleToggleAllowDirectDevisBilling = (checked: boolean) => {
    setAllowDirectDevisBilling(checked);
    localStorage.setItem('anelec_allow_direct_devis_billing', String(checked));
    if (checked) {
      toast.success(
        'Option activée : Les devis peuvent exceptionnellement être facturés directement.',
        { duration: 4000 }
      );
    } else {
      toast.success(
        'Règle stricte rétablie : On ne facture que les interventions (les devis ne sont pas facturés).',
        { icon: '✓' }
      );
    }
  };

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

  const smtpStatusQuery = useQuery({
    queryKey: ['admin-smtp-status'],
    queryFn: async () => {
      const res = await adminApi.getSmtpStatus();
      return res.data;
    },
  });

  useEffect(() => {
    if (smtpStatusQuery.data?.config) {
      const c = smtpStatusQuery.data.config;
      if (c.host) setSmtpHost(c.host);
      if (c.port) setSmtpPort(c.port);
      if (c.user) setSmtpUser(c.user);
      if (c.fromName) setSmtpFromName(c.fromName);
      setSmtpReplyTo(c.replyTo || '');
    }
  }, [smtpStatusQuery.data]);

  const invitationsQuery = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: async () => {
      const res = await adminApi.listInvitations();
      return res.data.data;
    },
  });

  const afterInvitationSent = (res: { data: import('../lib/api').InvitationSendResult }) => {
    queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    queryClient.invalidateQueries({ queryKey: ['admin-smtp-status'] });
    if (res.data.emailSent) {
      toast.success(
        res.data.fromAddress ? `${res.data.message} (depuis ${res.data.fromAddress})` : res.data.message
      );
      setLastInviteLink(null);
    } else {
      toast.error(res.data.message);
      if (res.data.inviteLink) {
        setLastInviteLink({ email: res.data.data.email, link: res.data.inviteLink, error: res.data.deliveryError });
      }
    }
  };

  const createInvitationMut = useMutation({
    mutationFn: adminApi.createInvitation,
    onSuccess: (res) => {
      afterInvitationSent(res);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteTechNom('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Invitation impossible');
    },
  });

  const resendInvitationMut = useMutation({
    mutationFn: adminApi.resendInvitation,
    onSuccess: afterInvitationSent,
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Renvoi impossible');
    },
  });

  const revokeInvitationMut = useMutation({
    mutationFn: adminApi.revokeInvitation,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      toast.success(res.data.message);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Révocation impossible');
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

  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);

  const handleToggleSinglePermission = async (u: User, permKey: keyof UserPermissions, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isPermissionAllowedForRole(u.role, permKey)) {
      toast.error(`Ce droit ne peut pas être accordé au profil « ${ROLE_DEFINITIONS[u.role]?.label || u.role} ».`);
      return;
    }
    const current = effectivePermsOf(u);
    const updated = { ...current, [permKey]: !current[permKey] };
    try {
      await updateUserMut.mutateAsync({
        id: u.id,
        payload: {
          permissions: updated,
        },
      });
      toast.success(`Droit « ${PERMISSION_LABELS.find((x) => x.key === permKey)?.label || permKey} » mis à jour pour ${u.name}`);
    } catch {
      toast.error('Erreur mise à jour droit');
    }
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditTechNom(u.technicienNom || '');
    setEditPassword('');
    setEditPerms(effectivePermsOf(u));
  };

  const buildAutoReportFromDeclaration = (intv: Intervention): string => {
    const lines: string[] = [];
    lines.push(`RAPPORT OFFICIEL D'INTERVENTION — ${getCompanyName()}`);
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
      (Boolean(i.photos && i.photos.length > 0) && !['Validé & Clôturé', 'Envoyé au client', 'Validé par le client', 'Réserves client'].includes(i.statutRapport || ''))
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Barre supérieure de la Workstation Admin (Harmonisé Volet 2) */}
      <div className="fsm-toolbar" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Poste de Commandement Administrateur, Droits & Rapports
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Gestion des accès et permissions, contrôle des pointages techniciens et validation des déclarations de chantiers.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', maxWidth: '100%' }}>
          <div
            className="segmented-control drawer-subtabs-strip"
            style={{
              maxWidth: '100%',
              overflowX: 'auto',
              display: 'flex',
              flexWrap: 'nowrap',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            <button
              type="button"
              className={`segmented-btn ${subTab === 'users' ? 'active' : ''}`}
              onClick={() => setSubTab('users')}
              style={{ flexShrink: 0 }}
            >
              <span className="desktop-only-el">Utilisateurs & Droits ({users.length})</span>
              <span className="mobile-only-el">Users ({users.length})</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'roles_guide' ? 'active' : ''}`}
              onClick={() => setSubTab('roles_guide')}
              style={{ flexShrink: 0 }}
            >
              <span className="desktop-only-el">Définition des Rôles & Droits</span>
              <span className="mobile-only-el">Rôles</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'pointages' ? 'active' : ''}`}
              onClick={() => setSubTab('pointages')}
              style={{ flexShrink: 0 }}
            >
              <span className="desktop-only-el">Pointages Matin / Soir Techniciens</span>
              <span className="mobile-only-el">Pointages</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'rapports' ? 'active' : ''}`}
              onClick={() => setSubTab('rapports')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
            >
              <span className="desktop-only-el">Déclarations & Rédaction Rapports ({declarationsList.length})</span>
              <span className="mobile-only-el">Rapports ({declarationsList.length})</span>
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
            <button
              type="button"
              className={`segmented-btn ${subTab === 'billing_rules' ? 'active' : ''}`}
              onClick={() => setSubTab('billing_rules')}
              style={{ flexShrink: 0 }}
            >
              <span className="desktop-only-el">Règles Facturation</span>
              <span className="mobile-only-el">Règles</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'emails_smtp' ? 'active' : ''}`}
              onClick={() => setSubTab('emails_smtp')}
              style={{ flexShrink: 0 }}
            >
              <span className="desktop-only-el">E-mails & SMTP ({smtpStatusQuery.data?.logs?.length || 0})</span>
              <span className="mobile-only-el">E-mails</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'automations' ? 'active' : ''}`}
              onClick={() => setSubTab('automations')}
              style={{ flexShrink: 0 }}
              data-testid="admin-tab-automations"
            >
              <span className="desktop-only-el">Automatisations</span>
              <span className="mobile-only-el">Auto</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setSubTab('appearance')}
              style={{ flexShrink: 0 }}
              data-testid="admin-tab-appearance"
            >
              <span className="desktop-only-el">Apparence & Thèmes</span>
              <span className="mobile-only-el">Apparence</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'danger_zone' ? 'active' : ''}`}
              onClick={() => setSubTab('danger_zone')}
              style={{
                color: subTab === 'danger_zone' ? '#dc2626' : '#ef4444',
                fontWeight: 700,
                borderColor: subTab === 'danger_zone' ? '#dc2626' : undefined,
                flexShrink: 0,
              }}
            >
              <span className="desktop-only-el">Zone Danger & Clôture</span>
              <span className="mobile-only-el">Danger</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => setShowInviteModal(true)}
              data-testid="invite-user-open"
            >
              ✉ Inviter par e-mail
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => {
                handleSelectRoleForCreate('CHIFFRAGE_DEVIS');
                setShowCreateModal(true);
              }}
            >
              + Désigner un Utilisateur
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SOUS-ONGLET 1 : UTILISATEURS & ATTRIBUTION DES DROITS DE MODIFICATION
         ===================================================================== */}
      {subTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%' }}>
          <div className="desktop-only-block pro-table-container pro-table-scroll" style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table className="pro-table" style={{ width: '100%', minWidth: '860px' }}>
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Utilisateur</th>
                  <th style={{ width: '140px' }}>Rôle Métier</th>
                  <th style={{ width: '130px' }}>App Mobile</th>
                  <th>Droits de Modification (Cliquer pour activer/désactiver)</th>
                  <th style={{ width: '70px' }}>Statut</th>
                  <th style={{ textAlign: 'right', width: '130px' }}>Actions Admin</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleDef = ROLE_DEFINITIONS[u.role];
                  const perms = effectivePermsOf(u);

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
                          {u.name} {u.id === 1 && '• Fondateur'}
                        </div>
                        <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {u.email}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="badge badge-info" style={{ fontSize: '10.5px' }}>{u.technicienNom}</span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '1px 5px', fontSize: '10px' }}
                              onClick={() => onSwitchToMobilePreview(u.technicienNom!)}
                            >
                              Mobile
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Poste Bureau
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '420px' }}>
                          {INTERACTIVE_PERMS.map((p) => {
                            const allowed = isPermissionAllowedForRole(u.role, p.key);
                            const isGranted = allowed && Boolean(perms[p.key]);
                            return (
                              <button
                                key={p.key}
                                type="button"
                                disabled={!allowed}
                                data-locked={!allowed ? 'true' : undefined}
                                onClick={(e) => handleToggleSinglePermission(u, p.key, e)}
                                title={
                                  allowed
                                    ? `Cliquer pour ${isGranted ? 'retirer' : 'attribuer'} le droit : ${p.label}`
                                    : `Droit non attribuable au profil « ${roleDef?.label || u.role} » : ${p.label}`
                                }
                                style={{
                                  border: !allowed ? '1px solid #e2e8f0' : isGranted ? `1px solid ${p.color}60` : '1px dashed #cbd5e1',
                                  background: !allowed ? '#f1f5f9' : isGranted ? `${p.color}15` : '#f8fafc',
                                  color: !allowed ? '#b6c0cc' : isGranted ? p.color : '#94a3b8',
                                  borderRadius: '6px',
                                  padding: '2px 6px',
                                  fontSize: '10.5px',
                                  fontWeight: isGranted ? 700 : 500,
                                  cursor: allowed ? 'pointer' : 'not-allowed',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span>{!allowed ? '🔒' : isGranted ? '✓' : '+'}</span>
                                <span>{p.short}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.active !== false ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10.5px' }}>
                          {u.active !== false ? 'Actif' : 'Off'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 7px', fontSize: '10.5px' }}
                            onClick={() => openEditUserModal(u)}
                            title="Modifier les informations complètes ou réinitialiser le mot de passe"
                          >
                            Éditer
                          </button>
                          {u.id !== 1 && (
                            confirmDeleteUserId === u.id ? (
                              <div style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ background: '#dc2626', color: '#ffffff', padding: '2px 6px', fontSize: '10px', border: 'none', borderRadius: '4px', fontWeight: 700 }}
                                  onClick={() => {
                                    deleteUserMut.mutate(u.id);
                                    setConfirmDeleteUserId(null);
                                  }}
                                >
                                  Oui
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 6px', fontSize: '10px' }}
                                  onClick={() => setConfirmDeleteUserId(null)}
                                >
                                  Non
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#dc2626', padding: '2px 7px', fontSize: '10.5px' }}
                                onClick={() => setConfirmDeleteUserId(u.id)}
                                title="Supprimer ce compte"
                              >
                                ✕
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cartes Mobile Utilisateurs Admin */}
          <div className="mobile-only-block mobile-card-grid" style={{ width: '100%', maxWidth: '100%' }}>
            {users.map((u) => {
              const roleDef = ROLE_DEFINITIONS[u.role];
              const perms = effectivePermsOf(u);
              const activePermCount = Object.entries(perms).filter(
                ([k, v]) => k !== 'mobileOnly' && Boolean(v)
              ).length;
              return (
                <div key={u.id} className="mobile-record-card" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {u.name} {u.id === 1 && '• Fondateur'}
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: `${roleDef?.badgeColor || '#2563eb'}18`,
                        color: roleDef?.badgeColor || '#2563eb',
                        border: `1px solid ${roleDef?.badgeColor || '#2563eb'}40`,
                      }}
                    >
                      {roleDef?.label || u.role}
                    </span>
                  </div>

                  <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {u.email}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>{activePermCount} droit(s) actif(s)</span>
                    {u.technicienNom && (
                      <span className="badge badge-info" style={{ fontSize: '10.5px' }}>
                        {u.technicienNom}
                      </span>
                    )}
                  </div>

                  {/* Boutons d'activation directe des droits sur mobile */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '4px 0' }}>
                    {INTERACTIVE_PERMS.map((p) => {
                      const allowed = isPermissionAllowedForRole(u.role, p.key);
                      const isGranted = allowed && Boolean(perms[p.key]);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          disabled={!allowed}
                          onClick={(e) => handleToggleSinglePermission(u, p.key, e)}
                          title={allowed ? `Cliquer pour ${isGranted ? 'désactiver' : 'activer'} ${p.label}` : `Droit non attribuable à ce profil : ${p.label}`}
                          style={{
                            border: !allowed ? '1px solid #e2e8f0' : isGranted ? `1px solid ${p.color}60` : '1px dashed #cbd5e1',
                            background: !allowed ? '#f1f5f9' : isGranted ? `${p.color}15` : '#f8fafc',
                            color: !allowed ? '#b6c0cc' : isGranted ? p.color : '#94a3b8',
                            borderRadius: '6px',
                            padding: '3px 7px',
                            fontSize: '10.5px',
                            fontWeight: isGranted ? 700 : 500,
                            cursor: allowed ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <span>{!allowed ? '🔒' : isGranted ? '✓' : '+'}</span>
                          <span>{p.short}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '11.5px' }}
                      onClick={() => openEditUserModal(u)}
                    >
                      Paramètres Complets
                    </button>
                    {u.id !== 1 && (
                      confirmDeleteUserId === u.id ? (
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: '#dc2626', color: '#ffffff', padding: '6px 10px', fontSize: '11.5px', border: 'none', borderRadius: '6px', fontWeight: 700 }}
                            onClick={() => {
                              deleteUserMut.mutate(u.id);
                              setConfirmDeleteUserId(null);
                            }}
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 10px', fontSize: '11.5px' }}
                            onClick={() => setConfirmDeleteUserId(null)}
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '6px 10px', fontSize: '11.5px' }}
                          onClick={() => setConfirmDeleteUserId(u.id)}
                        >
                          ✕ Supprimer
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invitations par e-mail */}
          <div className="pro-table-container" style={{ padding: '16px' }} data-testid="invitations-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0 }}>
                  Invitations par e-mail ({(invitationsQuery.data || []).filter((i) => i.status === 'EN_ATTENTE').length} en attente)
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Le collaborateur reçoit un lien personnel (valable 7 jours) pour créer son accès dans votre entreprise.
                  {smtpStatusQuery.data?.config?.ownMailbox && smtpStatusQuery.data.config.user
                    ? ` Envoi depuis ${smtpStatusQuery.data.config.user}.`
                    : ' Envoi via l’expéditeur plateforme (configurez votre boîte dans « E-mails & SMTP »).'}
                </p>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowInviteModal(true)}>
                ✉ Nouvelle invitation
              </button>
            </div>

            {lastInviteLink && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  fontSize: '12px',
                  marginBottom: '10px',
                  lineHeight: 1.5,
                }}
              >
                <strong>L’e-mail à {lastInviteLink.email} n’a pas pu partir</strong>
                {lastInviteLink.error ? ` (${lastInviteLink.error})` : ''}. Transmettez-lui ce lien vous-même :
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <input className="input" readOnly value={lastInviteLink.link} style={{ flex: 1, fontSize: '11px' }} onFocus={(e) => e.currentTarget.select()} />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(lastInviteLink.link).then(
                        () => toast.success('Lien copié'),
                        () => toast.error('Copie impossible : sélectionnez le lien')
                      );
                    }}
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}

            {(invitationsQuery.data || []).length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Aucune invitation pour le moment.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(invitationsQuery.data || []).map((inv) => {
                  const statusLabel =
                    inv.status === 'EN_ATTENTE' ? 'En attente' : inv.status === 'ACCEPTEE' ? 'Acceptée' : inv.status === 'EXPIREE' ? 'Expirée' : 'Révoquée';
                  const statusColor = inv.status === 'EN_ATTENTE' ? '#d97706' : inv.status === 'ACCEPTEE' ? '#059669' : '#64748b';
                  return (
                    <div
                      key={inv.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        padding: '8px 10px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="font-mono" style={{ fontSize: '12px', fontWeight: 700, overflowWrap: 'anywhere' }}>{inv.email}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {inv.roleLabel}
                          {inv.invitedByName ? ` · invité par ${inv.invitedByName}` : ''}
                          {inv.status === 'EN_ATTENTE' ? ` · expire le ${new Date(inv.expiresAt).toLocaleDateString('fr-FR')}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: statusColor }}>{statusLabel}</span>
                        {inv.status === 'EN_ATTENTE' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={resendInvitationMut.isPending}
                              onClick={() => resendInvitationMut.mutate(inv.id)}
                            >
                              Renvoyer
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                              disabled={revokeInvitationMut.isPending}
                              onClick={() => revokeInvitationMut.mutate(inv.id)}
                            >
                              Révoquer
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SOUS-ONGLET 2 : DÉFINITION COMPLÈTE DES RÔLES & DROITS PAR INTERVENANT
         ===================================================================== */}
      {subTab === 'roles_guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '100%' }}>
        <RolesMatrix />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', maxWidth: '100%' }}>
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

              {ROLE_ESPACE[r.code] && (
                <>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    Ce profil valide :
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {ROLE_PERIMETRE[ROLE_ESPACE[r.code]].vousValidez.map((t, idx) => (
                      <li key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t}</li>
                    ))}
                  </ul>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    Hors de son périmètre :
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {ROLE_PERIMETRE[ROLE_ESPACE[r.code]].horsPerimetre.map((t, idx) => (
                      <li key={idx} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t}</li>
                    ))}
                  </ul>
                </>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Droits non attribuables à ce profil :{' '}
                  {(() => {
                    const locked = PERMISSION_LABELS.filter((x) => !isPermissionAllowedForRole(r.code, x.key)).map((x) => x.label);
                    return locked.length ? locked.join(' · ') : 'aucun';
                  })()}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    handleSelectRoleForCreate(r.code);
                    setShowCreateModal(true);
                  }}
                >
                  Créer un compte « {r.label.split('(')[0].split('/')[0].trim()} »
                </button>
              </div>
            </div>
          ))}
        </div>
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
                        ? 'En service'
                        : isTerminee
                        ? 'Journée clôturée'
                        : 'Non pointé'}
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
                        • ARRIVÉE BUREAU (MATIN)
                      </div>
                      <div className="font-mono" style={{ fontSize: '15px', fontWeight: 800, color: pt?.heureArriveeBureau ? '#059669' : 'var(--text-muted)' }}>
                        {pt?.heureArriveeBureau || '— : —'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        • FIN DERNIÈRE INTV. (SOIR)
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
                        • Activer Matin
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
                        • Désactiver Soir
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                      title={`Ouvrir la vue mobile de ${tech}`}
                      onClick={() => onSwitchToMobilePreview(tech)}
                    >
                      Vue mobile
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

          <div className="desktop-only-block pro-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '105px' }}>Réf. & Type</th>
                  <th style={{ minWidth: '120px', maxWidth: '160px' }}>Client & Site</th>
                  <th style={{ width: '140px' }}>Tech & Horaires</th>
                  <th>Déclaration Terrain & Actions</th>
                  <th style={{ width: '110px' }}>Photos</th>
                  <th style={{ width: '90px' }}>Rapport</th>
                  <th style={{ textAlign: 'right', width: '170px' }}>Actions Rédacteur</th>
                </tr>
              </thead>
              <tbody>
                {declarationsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      Aucune déclaration terrain enregistrée pour le moment.
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
                          <div className="font-mono" style={{ fontWeight: 700, color: '#2563eb', fontSize: '11px' }}>
                            {intv.reference || `INT-${intv.id}`}
                          </div>
                          <span className={`badge ${intv.isVisiteDevis ? 'badge-purple' : 'badge-info'}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                            {intv.isVisiteDevis ? 'Visite' : intv.typeIntervention || 'Travaux'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '160px' }}>
                          <div style={{ fontWeight: 700, fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{intv.client || '—'}</div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{intv.chantier}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '11.5px' }}>{intv.entreprise || 'Non affecté'}</div>
                          <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                            {formatDateFR(intv.datePlanifiee)} •{' '}
                            {intv.heureDebutReelle ? (
                              <span style={{ color: '#059669', fontWeight: 700 }}>
                                {intv.heureDebutReelle} → {intv.heureFinReelle || 'En cours'}
                              </span>
                            ) : (
                              <span>
                                {intv.heureDebut || '—'}-{intv.heureFin || '—'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ maxWidth: '300px' }}>
                          {intv.actionsRealisees && intv.actionsRealisees.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '3px' }}>
                              {intv.actionsRealisees.slice(0, 3).map((act, idx) => (
                                <span key={idx} className="badge badge-success" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                                  ✓ {act}
                                </span>
                              ))}
                              {intv.actionsRealisees.length > 3 && (
                                <span className="badge badge-neutral" style={{ fontSize: '9.5px', padding: '1px 4px' }}>
                                  +{intv.actionsRealisees.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          {intv.elementsChiffrage && (
                            <div style={{ fontSize: '10.5px', color: '#7c3aed', fontWeight: 600 }}>
                              Chiffrage : {intv.elementsChiffrage}
                            </div>
                          )}
                          {intv.compteRendu && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {intv.compteRendu.slice(0, 90)}
                              {intv.compteRendu.length > 90 ? '...' : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          {intv.photos && intv.photos.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div
                                style={{ display: 'flex', gap: '3px', cursor: 'pointer' }}
                                onClick={() => {
                                  setLightboxPhotos(intv.photos as any);
                                  setLightboxIndex(0);
                                }}
                                title="Voir les photos"
                              >
                                {intv.photos.slice(0, 2).map((ph: any, idx: number) => (
                                  <img
                                    key={ph.id || idx}
                                    src={ph.url}
                                    alt=""
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      borderRadius: '5px',
                                      objectFit: 'cover',
                                      border: '1px solid var(--border-default)',
                                    }}
                                  />
                                ))}
                              </div>
                              <button
                                type="button"
                                className="badge badge-info"
                                style={{ cursor: 'pointer', border: 'none', padding: '2px 5px', fontSize: '10px' }}
                                onClick={() => {
                                  setLightboxPhotos(intv.photos as any);
                                  setLightboxIndex(0);
                                }}
                              >
                                ⊞ {intv.photos.length}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Aucune</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              ['Validé & Clôturé', 'Validé par le client'].includes(intv.statutRapport || '')
                                ? 'badge-success'
                                : intv.compteRendu || (intv.actionsRealisees && intv.actionsRealisees.length > 0)
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                            style={{ fontSize: '10px', padding: '1px 6px' }}
                          >
                            {intv.statutRapport || 'À rédiger'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ padding: '2px 7px', fontSize: '10.5px' }}
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
                              Valider
                            </button>
                            {parentDevis && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 6px', fontSize: '10.5px' }}
                                onClick={() => onOpenDevisDrawer(parentDevis)}
                              >
                                Devis
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10.5px' }}
                              onClick={() => onOpenInterventionDrawer(intv)}
                            >
                              Fiche
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

          {/* Vue Mobile : Cartes tactiles Déclarations Techniciens */}
          <div className="mobile-only-block mobile-card-grid">
            {declarationsList.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                Aucune déclaration terrain enregistrée pour le moment.
              </div>
            ) : (
              declarationsList.map((intv) => {
                const parentDevis = intv.devisId
                  ? devisList.find((d) => d.id === intv.devisId)
                  : null;

                return (
                  <div
                    key={intv.id}
                    className="mobile-touch-card"
                    style={{
                      background: '#fff',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      padding: '12px 14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="font-mono" style={{ fontWeight: 800, color: '#2563eb', fontSize: '12px' }}>
                          {intv.reference || `INT-${intv.id}`}
                        </span>
                        <span className={`badge ${intv.isVisiteDevis ? 'badge-purple' : 'badge-info'}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                          {intv.isVisiteDevis ? 'Visite' : 'Travaux'}
                        </span>
                      </div>
                      {intv.rapportFinal ? (
                        <span className="badge badge-success" style={{ fontSize: '10px' }}>✓ Rédigé</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '10px' }}>À Rédiger</span>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {intv.client || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {intv.chantier || 'Site client'} • {intv.entreprise || 'Non assigné'}
                      </div>
                    </div>

                    {intv.compteRendu && (
                      <div
                        style={{
                          fontSize: '11.5px',
                          background: '#f8fafc',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                        }}
                      >
                        • {intv.compteRendu.slice(0, 120)}{intv.compteRendu.length > 120 ? '...' : ''}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>⊞ Preuves : <strong>{intv.photos?.length || 0} photo(s)</strong></span>
                      <span className="font-mono">{intv.datePlanifiee || 'Non fixée'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '11.5px' }}
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
                        {intv.rapportFinal ? 'Modifier' : 'Rédiger'}
                      </button>
                      {parentDevis && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11.5px' }}
                          onClick={() => onOpenDevisDrawer(parentDevis)}
                        >
                          Devis
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11.5px' }}
                        onClick={() => onOpenInterventionDrawer(intv)}
                      >
                        Fiche
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 5 : RÈGLES DE FACTURATION & OPTION D'ARBITRAGE DEVIS (AUTO-DÉCOCHÉE)
         ===================================================================== */}
      {subTab === 'billing_rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            className="glass-analytics-card"
            style={{
              padding: '24px',
              borderLeft: '4px solid #2563eb',
              gap: '16px',
            }}
          >
            <div>
              <span
                style={{
                  padding: '2px 9px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: '#2563eb',
                }}
              >
                GOUVERNANCE & RÈGLES FINANCIÈRES
              </span>
              <h3 style={{ fontSize: '17px', fontWeight: 800, marginTop: '6px' }}>
                Règles de Facturation & Clôture Comptable
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                Configurez les directives appliquées par les agents de facturation pour le tri des dossiers éligibles et le traitement des créances B2B et B2C.
              </p>
            </div>

            {/* Encadré Règle Principale ANELEC */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(37, 99, 235, 0.05)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ProFileTextIcon size={20} />
                <strong style={{ fontSize: '14px', color: '#1d4ed8' }}>
                  Principe Fondamental : « On ne facture pas les devis, on facture uniquement les interventions. »
                </strong>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                Dans le modèle de gestion TCE, un <strong>devis est une offre préalable</strong> (avec ou sans visite de repérage), tandis que la <strong>facture sanctionne des travaux réels exécutés et contrôlés</strong>. Par conséquent, les devis non convertis en intervention ne sont jamais proposés à la facturation client.
              </p>
            </div>

            {/* Option à choisir sur la console Admin (Auto-décochée par défaut) */}
            <div
              style={{
                padding: '18px',
                borderRadius: '14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ maxWidth: '640px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <label
                    htmlFor="toggle-direct-devis-billing"
                    style={{ fontSize: '13.5px', fontWeight: 800, cursor: 'pointer', color: 'var(--text-primary)' }}
                  >
                    Autoriser la facturation directe depuis les Devis (hors flux Intervention)
                  </label>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '10px',
                      fontWeight: 800,
                      background: allowDirectDevisBilling ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: allowDirectDevisBilling ? '#dc2626' : '#059669',
                    }}
                  >
                    {allowDirectDevisBilling ? 'Activé (Exception)' : '✓ Auto-décochée par défaut (Règle stricte active)'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                  Si cette case est <strong>décochée (état par défaut automatique)</strong>, l'espace facturation applique strictement la règle : seules les interventions exécutées sont facturables. Si vous cochez cette option, les devis acceptés pourront exceptionnellement faire l'objet d'une émission de facture d'acompte directe.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                  <input
                    id="toggle-direct-devis-billing"
                    type="checkbox"
                    checked={allowDirectDevisBilling}
                    onChange={(e) => handleToggleAllowDirectDevisBilling(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                  <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
                    {allowDirectDevisBilling ? 'Cochée' : 'Auto-décochée'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SOUS-ONGLET 5B : CONFIGURATION SMTP, TEST D'ENVOI & JOURNAL DES EMAILS
         ===================================================================== */}
      {subTab === 'emails_smtp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '22px',
              borderRadius: '14px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Colonne 1 : Paramètres Serveur SMTP Zoho / Hostinger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#0284c7',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  EXPÉDITEUR OFFICIEL & SERVEUR SMTP
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '4px 0 4px 0' }}>
                  Boîte d’envoi de {smtpStatusQuery.data?.config?.companyName || 'votre entreprise'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  Renseignez le serveur SMTP de la messagerie de votre entreprise (Zoho, Microsoft 365, Google Workspace, OVH…) avec un{' '}
                  <strong>mot de passe d’application</strong>. Vos rapports, devis et invitations partiront alors de votre propre adresse.
                  Le mot de passe est chiffré et n’est jamais affiché.
                </p>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  background: smtpStatusQuery.data?.config?.ownMailbox ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.1)',
                  border: smtpStatusQuery.data?.config?.ownMailbox ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.4)',
                }}
                data-testid="mail-sender-banner"
              >
                {smtpStatusQuery.data?.config?.ownMailbox ? (
                  <>
                    <strong>Envoi depuis votre boîte :</strong> {smtpStatusQuery.data.config.user || '—'}
                    {smtpStatusQuery.data.config.lastTestAt && (
                      <>
                        {' '}
                        · dernier test {smtpStatusQuery.data.config.lastTestOk ? 'réussi' : 'en échec'} le{' '}
                        {new Date(smtpStatusQuery.data.config.lastTestAt).toLocaleString('fr-FR')}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <strong>Expéditeur plateforme actif.</strong> Vos e-mails partent « au nom de {smtpStatusQuery.data?.config?.companyName || 'votre entreprise'} via ANELEC TCE »,
                    les réponses arrivant sur <strong>{smtpStatusQuery.data?.config?.replyTo || smtpStatusQuery.data?.config?.mainEmail || 'l’adresse de votre administrateur'}</strong>.
                    Renseignez votre boîte ci-dessous pour envoyer depuis votre propre adresse.
                  </>
                )}
                {smtpStatusQuery.data?.config?.lastError && !smtpStatusQuery.data.config.lastTestOk && (
                  <div style={{ marginTop: '4px', color: '#b45309' }}>Dernière erreur : {smtpStatusQuery.data.config.lastError}</div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Hôte SMTP</label>
                  <input
                    type="text"
                    className="input"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.votre-domaine.fr"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Port (465 / 587)</label>
                  <input
                    type="number"
                    className="input"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value) || 465)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Adresse Expéditeur (SMTP User)</label>
                  <input
                    type="email"
                    className="input"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="contact@votre-entreprise.fr"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Nom Affiché</label>
                  <input
                    type="text"
                    className="input"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder={smtpStatusQuery.data?.config?.companyName || 'Nom de votre entreprise'}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Répondre à (facultatif)</label>
                <input
                  type="email"
                  className="input"
                  value={smtpReplyTo}
                  onChange={(e) => setSmtpReplyTo(e.target.value)}
                  placeholder={smtpStatusQuery.data?.config?.mainEmail || smtpUser || 'adresse principale de l’entreprise'}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>
                  Mot de passe SMTP / mot de passe d'application{' '}
                  {smtpStatusQuery.data?.config?.hasPassword && (
                    <span style={{ color: '#059669', fontWeight: 800 }}>(✓ Configuré)</span>
                  )}
                </label>
                <input
                  type="password"
                  className="input"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={
                    smtpStatusQuery.data?.config?.hasPassword
                      ? '•••••••••••• (Laisser vide pour conserver l’actuel)'
                      : 'Saisir le mot de passe d’application de la messagerie'
                  }
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                {smtpStatusQuery.data?.config?.configured && smtpStatusQuery.data.config.ownMailbox && user?.companyId !== 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      if (!window.confirm('Supprimer votre boîte d’envoi ? Les e-mails repartiront via l’expéditeur plateforme.')) return;
                      try {
                        const res = await adminApi.resetSmtpConfig();
                        setSmtpPass('');
                        setSmtpHost('');
                        setSmtpUser('');
                        setSmtpFromName('');
                        setSmtpReplyTo('');
                        await smtpStatusQuery.refetch();
                        toast.success(res.data.message);
                      } catch (err: any) {
                        toast.error(err.response?.data?.error || 'Suppression impossible');
                      }
                    }}
                  >
                    Revenir à l’expéditeur plateforme
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSavingSmtp}
                  onClick={async () => {
                    setIsSavingSmtp(true);
                    try {
                      await adminApi.updateSmtpConfig({
                        host: smtpHost,
                        port: smtpPort,
                        secure: smtpPort === 465,
                        user: smtpUser,
                        fromName: smtpFromName,
                        replyTo: smtpReplyTo.trim(),
                        ...(smtpPass.trim() ? { pass: smtpPass.trim() } : {}),
                      });
                      setSmtpPass('');
                      await smtpStatusQuery.refetch();
                      toast.success('Boîte d’envoi enregistrée : envoyez un e-mail de test pour la valider');
                    } catch (err: any) {
                      toast.error(err.response?.data?.error || 'Erreur sauvegarde SMTP');
                    } finally {
                      setIsSavingSmtp(false);
                    }
                  }}
                >
                  {isSavingSmtp ? 'Enregistrement...' : '✓ Enregistrer la Configuration SMTP'}
                </button>
              </div>
            </div>

            {/* Colonne 2 : Banc de Test d'Envoi en Direct */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#059669',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  DIAGNOSTIC & VÉRIFICATION EN DIRECT
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '4px 0' }}>
                  Tester l'envoi d'e-mail vers une adresse cible
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  Envoyez-vous un e-mail pour vérifier que votre boîte d’envoi fonctionne, ou saisissez une autre adresse.
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[user?.email].filter((a): a is string => Boolean(a)).map((addr) => (
                  <button
                    key={addr}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '11px',
                      background: testRecipientEmail === addr ? 'rgba(2, 132, 199, 0.12)' : undefined,
                      borderColor: testRecipientEmail === addr ? '#0284c7' : undefined,
                      fontWeight: testRecipientEmail === addr ? 700 : 500,
                    }}
                    onClick={() => setTestRecipientEmail(addr)}
                  >
                    {addr}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  className="input"
                  style={{ flex: 1 }}
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  placeholder="destinataire@exemple.com"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isTestingSmtp}
                  onClick={async () => {
                    setIsTestingSmtp(true);
                    try {
                      const res = await adminApi.testSmtpEmail(testRecipientEmail);
                      setLastSmtpTestResult(res.data.delivery);
                      await smtpStatusQuery.refetch();
                      toast.success(res.data.message);
                    } catch (err: any) {
                      toast.error(err.response?.data?.error || 'Erreur lors du test SMTP');
                    } finally {
                      setIsTestingSmtp(false);
                    }
                  }}
                >
                  {isTestingSmtp ? 'Test...' : '→ Envoyer un E-mail Test'}
                </button>
              </div>

              {lastSmtpTestResult && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: lastSmtpTestResult.sent ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: lastSmtpTestResult.sent ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '12px',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 800, color: lastSmtpTestResult.sent ? '#065f46' : '#991b1b' }}>
                    {lastSmtpTestResult.sent ? '✓' : '✕'} Résultat du test :{' '}
                    {lastSmtpTestResult.sent
                      ? `envoyé depuis ${lastSmtpTestResult.fromAddress || 'la boîte configurée'} (${lastSmtpTestResult.hostUsed})`
                      : lastSmtpTestResult.error || 'échec de l’envoi'}
                  </div>
                  {lastSmtpTestResult.previewUrl && (
                    <div style={{ marginTop: '4px' }}>
                      <ProMailIcon size={14} style={{ marginRight: 6 }} />
                      <a
                        href={lastSmtpTestResult.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        Ouvrir et inspecter l'e-mail envoyé dans le navigateur
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Journal des Emails envoyés */}
          <div className="pro-table-container" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0 }}>
                  Journal d'Audit des E-mails Envoyés ({smtpStatusQuery.data?.logs?.length || 0})
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Traçabilité complète des confirmations de comptes, réinitialisations, créations collaborateurs, rapports d'interventions et devis.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => smtpStatusQuery.refetch()}
              >
                ↻ Actualiser
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="pro-table" style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Horodatage</th>
                    <th>Type d'envoi</th>
                    <th>Destinataire</th>
                    <th>Objet</th>
                    <th>Canal d'acheminement</th>
                    <th>Actions / Lien</th>
                  </tr>
                </thead>
                <tbody>
                  {(smtpStatusQuery.data?.logs || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        Aucun e-mail enregistré dans le journal pour le moment.
                      </td>
                    </tr>
                  ) : (
                    (smtpStatusQuery.data?.logs || []).map((log: any) => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('fr-FR') : '—'}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              background: 'rgba(2, 132, 199, 0.1)',
                              color: '#0284c7',
                            }}
                          >
                            {log.type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{log.toEmail}</td>
                        <td>{log.subject}</td>
                        <td>
                          <span
                            style={{
                              color: log.sent ? '#059669' : '#dc2626',
                              fontWeight: 700,
                            }}
                          >
                            {log.sent ? '✓ ' : '✕ '}
                            {log.channel}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {log.previewUrl && (
                              <a
                                href={log.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'underline' }}
                              >
                                ◉ Voir E-mail
                              </a>
                            )}
                            {log.activationLink && (
                              <a
                                href={log.activationLink}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#059669', fontWeight: 700, textDecoration: 'underline' }}
                              >
                                ↗ Lien d'activation
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      
      {/* =====================================================================
          SOUS-ONGLET 7 : APPARENCE & THÈMES — défaut entreprise + personnalisation
         ===================================================================== */}
      {subTab === 'automations' && <AutomationsPanel />}

      {subTab === 'appearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} data-testid="admin-appearance-section">
          <AppearancePanel />
        </div>
      )}

      {/* =====================================================================
          SOUS-ONGLET 6 : ZONE DE DANGER - CLÔTURE DU COMPTE & SUPPRESSION BASE
         ===================================================================== */}
      {subTab === 'danger_zone' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '24px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '2px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <ProAlertIcon size={28} />
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', margin: 0 }}>
                  Zone de Danger : Clôture du Compte et Effacement Intégral de la Base de Données
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Suppression irréversible de votre entreprise et de l'ensemble de ses données rattachées.
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#b91c1c', marginBottom: '10px' }}>
                Avertissement Légal & Engagement RGPD (Action Définitive et Non Réversible)
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '12px' }}>
                Conformément aux réglementations RGPD et à nos engagements de stricte confidentialité (données cloisonnées hébergées en France sur Supabase / Hostinger), la demande de suppression de compte entraîne la <strong>destruction immédiate, complète et irréversible</strong> de toutes vos données sans possibilité de récupération :
              </p>
              <ul style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '20px', margin: 0 }}>
                <li><strong>Tous vos Devis :</strong> devis chiffrés, brouillons, devis validés, facturés et historiques d'affaires.</li>
                <li><strong>Toutes vos Interventions :</strong> fiches chantiers, plannings techniciens, déclarations, heures, rapports PDF signés et photos.</li>
                <li><strong>Tous vos Référentiels :</strong> grille de compétences, corps d'état, techniciens et véhicules.</li>
                <li><strong>Tous les Pointages :</strong> historique complet des pointages matin/soir et feuilles de présence.</li>
                <li><strong>Tous les Comptes Collaborateurs :</strong> accès administrateurs, planificateurs, chiffreurs et techniciens.</li>
                <li><strong>Votre Entité Entreprise :</strong> raison sociale, SIRET/SIREN, clés et configurations.</li>
              </ul>
            </div>

            {user?.companyId === 1 && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(234, 179, 8, 0.12)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  fontSize: '12px',
                  color: '#854d0e',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                <strong>Protection Espace Fondateur ANELEC GROUPE (ID 1) :</strong> Pour sécuriser l'espace racine contre toute fausse manipulation, une phrase d'authentification stricte est exigée en complément du mot de passe administrateur.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <button
                type="button"
                className="btn btn-danger"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  padding: '12px 22px',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onClick={() => {
                  setDestroyPassword('');
                  setDestroyConfirmPhrase('');
                  setShowDestroyModal(true);
                }}
              >
                <span>✕</span>
                <span>Supprimer Définitivement mon Compte et ma Base de Données</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALE : CRÉATION D'UN UTILISATEUR AVEC DROITS PERSONNALISÉS
         ===================================================================== */}
      {showInviteModal && (
        <div className="inspector-backdrop" onClick={() => setShowInviteModal(false)}>
          <div
            className="pro-table-container"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '520px', maxWidth: '95vw', margin: '8vh auto', padding: '20px', background: 'var(--bg-surface)' }}
            data-testid="invite-user-modal"
          >
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Inviter un collaborateur par e-mail</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Il recevra un lien personnel pour créer son accès dans <strong>{user?.companyName || 'votre entreprise'}</strong>, avec le profil choisi.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createInvitationMut.mutate({
                  email: inviteEmail.trim(),
                  role: inviteRole,
                  technicienNom: inviteRole === 'TECHNICIEN' ? inviteTechNom.trim() || null : null,
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Adresse e-mail du collaborateur</label>
                <input
                  type="email"
                  className="input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="prenom.nom@exemple.fr"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Profil</label>
                <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  {Object.values(ROLE_DEFINITIONS)
                    .filter((r) => r.code !== 'ADMIN' || user?.role === 'ADMIN')
                    .map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {ROLE_DEFINITIONS[inviteRole]?.summary}
                </p>
              </div>
              {inviteRole === 'TECHNICIEN' && (
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Nom du technicien (tel qu’affiché au planning)</label>
                  <input className="input" value={inviteTechNom} onChange={(e) => setInviteTechNom(e.target.value)} placeholder="Laisser vide pour reprendre son nom" />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={createInvitationMut.isPending || !inviteEmail.trim()}>
                  {createInvitationMut.isPending ? 'Envoi…' : 'Envoyer l’invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              Choisissez un profil métier puis ajustez ses droits. Les droits grisés ne peuvent pas être accordés à ce profil.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const pwProblems = validatePassword(newPassword, { email: newEmail, name: newName });
                if (pwProblems.length > 0) {
                  toast.error(passwordErrorMessage(pwProblems));
                  return;
                }
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
                    placeholder="prenom.nom@votre-entreprise.fr"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Mot de passe initial *</label>
                  <input
                    type="password"
                    className="input"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="Min. 12 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <PasswordRules password={newPassword} context={{ email: newEmail, name: newName }} />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Profil métier *</label>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {PERMISSION_LABELS.map((p) => (
                    <label
                      key={p.key}
                      title={
                        isPermissionAllowedForRole(newRole, p.key)
                          ? undefined
                          : 'Ce droit ne peut pas être accordé à ce profil (plafond du profil)'
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        cursor: isPermissionAllowedForRole(newRole, p.key) ? 'pointer' : 'not-allowed',
                        opacity: isPermissionAllowedForRole(newRole, p.key) ? 1 : 0.45,
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={!isPermissionAllowedForRole(newRole, p.key)}
                        checked={Boolean(newPerms[p.key]) && isPermissionAllowedForRole(newRole, p.key)}
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
                if (editPassword.trim()) {
                  const editProblems = validatePassword(editPassword.trim(), { email: editingUser.email, name: editingUser.name });
                  if (editProblems.length > 0) {
                    toast.error(passwordErrorMessage(editProblems));
                    return;
                  }
                }
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Profil métier</label>
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
                    autoComplete="new-password"
                    maxLength={128}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                  {editPassword && (
                    <PasswordRules password={editPassword} context={{ email: editingUser.email, name: editingUser.name }} />
                  )}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {PERMISSION_LABELS.map((p) => (
                    <label
                      key={p.key}
                      title={
                        isPermissionAllowedForRole(editRole, p.key)
                          ? undefined
                          : 'Ce droit ne peut pas être accordé à ce profil (plafond du profil)'
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        cursor: isPermissionAllowedForRole(editRole, p.key) ? 'pointer' : 'not-allowed',
                        opacity: isPermissionAllowedForRole(editRole, p.key) ? 1 : 0.45,
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={!isPermissionAllowedForRole(editRole, p.key)}
                        checked={Boolean(editPerms[p.key]) && isPermissionAllowedForRole(editRole, p.key)}
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
                ↻ Régénérer depuis la déclaration technicien
              </button>
            </div>

            {selectedReportIntv.photos && selectedReportIntv.photos.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 700 }}>
                    Photos prises par le technicien ({selectedReportIntv.photos.length}) :
                  </div>
                  <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
                    Cliquez sur une photo pour l'agrandir / la télécharger
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

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedReportIntv(null)}
                  >
                    Fermer
                  </button>
                  {onOpenSendReportEmail && (
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: '#00bf63',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onClick={() => {
                        onOpenSendReportEmail({
                          ...selectedReportIntv,
                          rapportFinal: draftRapportFinal,
                          statutRapport: draftStatutRapport,
                        });
                      }}
                    >
                      Envoyer au client (lien sécurisé)
                    </button>
                  )}
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
      
      {/* =====================================================================
          MODALE DE CONFIRMATION : DESTRUCTION TOTALE ET IRRÉVERSIBLE DU COMPTE
         ===================================================================== */}
      {showDestroyModal && (
        <div className="inspector-backdrop" onClick={() => !isDestroying && setShowDestroyModal(false)}>
          <div
            className="pro-table-container"
            style={{
              maxWidth: '560px',
              width: '92%',
              padding: '24px',
              background: 'var(--bg-elevated)',
              border: '2px solid #dc2626',
              boxShadow: '0 20px 40px rgba(220, 38, 38, 0.25)',
              borderRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <ProAlertIcon size={26} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#dc2626' }}>
                Confirmation Obligatoire : Destruction Définitive
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Vous êtes sur le point d'effacer <strong>définitivement et irrémédiablement</strong> l'ensemble de votre espace entreprise, vos devis, chantiers, plannings, pointages et comptes collaborateurs.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                  Mot de passe Administrateur *
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="Saisissez votre mot de passe pour valider"
                  value={destroyPassword}
                  onChange={(e) => setDestroyPassword(e.target.value)}
                  disabled={isDestroying}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                  {user?.companyId === 1 ? (
                    <>Phrase de confirmation stricte (tapez : <span style={{ color: '#dc2626', fontFamily: 'monospace' }}>SUPPRIMER ANELEC GROUPE DEFINITIVEMENT</span>) *</>
                  ) : (
                    <>Confirmation formelle (tapez : <span style={{ color: '#dc2626', fontFamily: 'monospace' }}>SUPPRIMER</span>) *</>
                  )}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={user?.companyId === 1 ? 'SUPPRIMER ANELEC GROUPE DEFINITIVEMENT' : 'SUPPRIMER'}
                  value={destroyConfirmPhrase}
                  onChange={(e) => setDestroyConfirmPhrase(e.target.value)}
                  disabled={isDestroying}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDestroyModal(false)}
                disabled={isDestroying}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 800,
                  opacity: (!destroyPassword || !destroyConfirmPhrase || isDestroying) ? 0.6 : 1,
                }}
                disabled={!destroyPassword || !destroyConfirmPhrase || isDestroying}
                onClick={async () => {
                  const isRoot = user?.companyId === 1;
                  if (isRoot && destroyConfirmPhrase.trim() !== 'SUPPRIMER ANELEC GROUPE DEFINITIVEMENT') {
                    toast.error('Veuillez saisir la phrase exacte : SUPPRIMER ANELEC GROUPE DEFINITIVEMENT');
                    return;
                  }
                  if (!isRoot && destroyConfirmPhrase.trim() !== 'SUPPRIMER') {
                    toast.error('Veuillez saisir le mot exact : SUPPRIMER');
                    return;
                  }
                  setIsDestroying(true);
                  try {
                    const res = await adminApi.destroyCompany({
                      password: destroyPassword,
                      confirmPhrase: destroyConfirmPhrase.trim(),
                    });
                    toast.success(res.data.message || 'Compte et données supprimés définitivement', { duration: 6000 });
                    setShowDestroyModal(false);
                    await logout();
                    window.location.href = '/login';
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || 'Erreur lors de la suppression du compte');
                  } finally {
                    setIsDestroying(false);
                  }
                }}
              >
                {isDestroying ? 'Destruction en cours...' : 'Confirmer la suppression irréversible'}
              </button>
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
