import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  Plus,
  MoreHorizontal,
  Clock,
  Send,
  Edit3,
  Trash2,
  Shield,
  KeyRound,
  Check,
  Minus,
} from 'lucide-react';
import {
  Page,
  Tabs,
  Card,
  Btn,
  IconBtn,
  Pill,
  Avatar,
  StatusPill,
  DataTable,
  Menu,
  Modal,
  Field,
  Input,
  Dropdown,
} from './ui';
import toast from 'react-hot-toast';

interface UtilisateursStudioViewProps {
  techniciens: string[];
}

const MODULES = [
  'Tableau de bord & Pilotage',
  'Planning & Dispatching Gantt',
  'Devis & Chiffrage commercial',
  'Interventions TCE & Travaux',
  'Carte & Tournées GPS',
  'Facturation B2B / B2C',
  'Comptabilité & Rentabilité',
  'Donneurs d’ordre & Fiches',
  'Paramètres métier & Référentiels',
  'Utilisateurs & Droits d’accès',
  'Application Mobile Technicien',
];

const ROLES = ['Administrateur', 'Direction', 'Bureau', 'Technicien'];

const ROLE_RIGHTS: Record<string, ('none' | 'view' | 'edit')[]> = {
  Administrateur: ['edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit'],
  Direction: ['view', 'view', 'edit', 'view', 'view', 'edit', 'edit', 'edit', 'view', 'none', 'none'],
  Bureau: ['edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'view', 'edit', 'none', 'none', 'none'],
  Technicien: ['none', 'view', 'none', 'view', 'view', 'none', 'none', 'none', 'none', 'none', 'edit'],
};

const RIGHT_LABEL = { none: 'Aucun', view: 'Lecture', edit: 'Édition' };
const RIGHT_TONE = { none: '#94A3B8', view: '#2563EB', edit: '#16A34A' };

export function UtilisateursStudioView({ techniciens }: UtilisateursStudioViewProps) {
  const [activeTab, setActiveTab] = useState('users');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Bureau');

  // List of users
  const [usersList, setUsersList] = useState([
    {
      id: 1,
      name: 'Zeh Lopez',
      email: 'contact@anelecgroupe.com',
      role: 'Administrateur',
      tech: null,
      rights: '11/11',
      last: 'Aujourd’hui, 10:28',
      status: 'Actif',
    },
    {
      id: 2,
      name: 'Anouar Chef',
      email: 'anouar@anelecgroupe.com',
      role: 'Technicien',
      tech: 'Anouar',
      rights: '3/11',
      last: 'Aujourd’hui, 09:14',
      status: 'Actif',
    },
    {
      id: 3,
      name: 'Sarah Gestion',
      email: 'sarah.gestion@anelecgroupe.com',
      role: 'Bureau',
      tech: null,
      rights: '8/11',
      last: 'Aujourd’hui, 08:45',
      status: 'Actif',
    },
    {
      id: 4,
      name: 'Karim Terrain',
      email: 'karim@anelecgroupe.com',
      role: 'Technicien',
      tech: 'Karim',
      rights: '3/11',
      last: 'Hier, 18:22',
      status: 'Actif',
    },
    {
      id: 5,
      name: 'Lina Direction',
      email: 'direction@anelecgroupe.com',
      role: 'Direction',
      tech: null,
      rights: '9/11',
      last: 'Il y a 2 jours',
      status: 'Actif',
    },
  ]);

  const handleSendInvite = () => {
    if (!inviteEmail.includes('@')) {
      toast.error('Adresse e-mail invalide');
      return;
    }

    const newUser = {
      id: Date.now(),
      name: inviteName.trim() || inviteEmail.split('@')[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      tech: inviteRole === 'Technicien' ? techniciens[0] : null,
      rights: inviteRole === 'Administrateur' ? '11/11' : inviteRole === 'Direction' ? '9/11' : '8/11',
      last: '—',
      status: 'Invitation envoyée',
    };

    setUsersList((prev) => [...prev, newUser]);
    toast.success(`Invitation sécurisée transmise à ${inviteEmail}`);
    setIsInviteOpen(false);
    setInviteName('');
    setInviteEmail('');
  };

  const pointagesData = useMemo(() => {
    return techniciens.map((tName, idx) => ({
      tech: tName,
      matin: `07:${45 + (idx * 4) % 15}`,
      soir: `17:${15 + (idx * 6) % 30}`,
      total: '8,0 h',
      statut: 'Conforme',
    }));
  }, [techniciens]);

  const columnsUsers = [
    {
      key: 'name',
      label: 'Collaborateur',
      render: (u: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar name={u.name} size={26} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-strong)' }}>{u.name}</strong>
            <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rôle',
      width: 140,
      render: (u: any) => (
        <Pill
          tone={
            u.role === 'Administrateur'
              ? 'red'
              : u.role === 'Direction'
              ? 'purple'
              : u.role === 'Bureau'
              ? 'blue'
              : 'teal'
          }
        >
          {u.role}
        </Pill>
      ),
    },
    {
      key: 'tech',
      label: 'Fiche technicien',
      width: 150,
      render: (u: any) =>
        u.tech ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Avatar name={u.tech} size={20} />
            <strong style={{ fontSize: '12.5px' }}>{u.tech}</strong>
          </span>
        ) : (
          <span className="m-muted m-small">—</span>
        ),
    },
    {
      key: 'rights',
      label: 'Droits',
      width: 90,
      render: (u: any) => <span className="m-mono">{u.rights}</span>,
    },
    {
      key: 'last',
      label: 'Dernière connexion',
      width: 160,
      render: (u: any) => <span className="m-small m-muted">{u.last}</span>,
    },
    {
      key: 'status',
      label: 'Statut',
      width: 150,
      render: (u: any) => <StatusPill status={u.status} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right' as const,
      width: 60,
      render: (u: any) => (
        <Menu
          trigger={<IconBtn icon={MoreHorizontal} label="Options utilisateur" />}
          items={[
            {
              label: 'Modifier le rôle',
              icon: Edit3,
              onClick: () => toast.success(`Rôle de ${u.name} modifié`),
            },
            {
              label: 'Réinitialiser le mot de passe',
              icon: KeyRound,
              onClick: () => toast.success('Lien de réinitialisation sécurisé envoyé par e-mail'),
            },
            { sep: true },
            {
              label: 'Désactiver le compte',
              icon: Trash2,
              danger: true,
              onClick: () => toast.error(`Compte de ${u.name} suspendu`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <Page
      testid="screen-utilisateurs"
      title="Utilisateurs & accès"
      subtitle="Gestion des comptes collaborateurs, matrice des permissions et pointages terrain."
      actions={
        <Btn variant="primary" icon={Plus} onClick={() => setIsInviteOpen(true)}>
          Inviter un collaborateur
        </Btn>
      }
    >
      <Tabs
        testid="users-tabs"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'users', label: 'Collaborateurs', count: usersList.length },
          { id: 'rights', label: 'Matrice des droits par rôle' },
          { id: 'pointages', label: 'Pointages hebdomadaires', count: pointagesData.length },
        ]}
      />

      {/* ONGLET 1 : COLLABORATEURS */}
      {activeTab === 'users' && (
        <Card
          title="Collaborateurs ANELEC"
          subtitle="Comptes actifs, rôles et privilèges d’accès au système."
          icon={Users}
        >
          <DataTable
            columns={columnsUsers}
            rows={usersList}
            rowKey={(u) => u.email}
          />
        </Card>
      )}

      {/* ONGLET 2 : MATRICE DES DROITS */}
      {activeTab === 'rights' && (
        <Card
          title="Matrice des droits par rôle"
          subtitle="Ce que chaque profil d’utilisateur peut consulter ou modifier sur la plateforme."
          icon={Shield}
        >
          <div className="m-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="m-table m-table--compact">
              <thead>
                <tr>
                  <th style={{ width: 260 }}>Module / Service métier</th>
                  {ROLES.map((r) => (
                    <th key={r} style={{ textAlign: 'center' }}>
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((modName, idx) => (
                  <tr key={modName}>
                    <td>
                      <strong style={{ fontSize: '13px', color: 'var(--text-strong)' }}>
                        {modName}
                      </strong>
                    </td>
                    {ROLES.map((roleName) => {
                      const right = ROLE_RIGHTS[roleName]?.[idx] || 'none';
                      const tone = RIGHT_TONE[right];
                      const label = RIGHT_LABEL[right];

                      return (
                        <td key={roleName} style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: tone,
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {right === 'none' ? <Minus size={13} /> : <Check size={13} />}
                            {label}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ONGLET 3 : POINTAGES */}
      {activeTab === 'pointages' && (
        <Card
          title="Contrôle des pointages terrain"
          subtitle="Heures de début et fin de vacation transmises en direct par l’application mobile."
          icon={Clock}
          actions={
            <Btn
              size="sm"
              icon={ShieldCheck}
              onClick={() => toast.success('Tous les pointages de la journée ont été validés')}
            >
              Valider la journée
            </Btn>
          }
        >
          <DataTable
            columns={[
              {
                key: 'tech',
                label: 'Technicien',
                render: (p: any) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar name={p.tech} size={22} />
                    <strong>{p.tech}</strong>
                  </span>
                ),
              },
              {
                key: 'matin',
                label: 'Prise de poste matin',
                align: 'center' as const,
                render: (p: any) => <span className="m-mono">{p.matin}</span>,
              },
              {
                key: 'soir',
                label: 'Fin de vacation soir',
                align: 'center' as const,
                render: (p: any) => <span className="m-mono">{p.soir}</span>,
              },
              {
                key: 'total',
                label: 'Amplitude totale',
                align: 'right' as const,
                render: (p: any) => <span className="m-mono" style={{ fontWeight: 700 }}>{p.total}</span>,
              },
              {
                key: 'statut',
                label: 'Conformité',
                align: 'center' as const,
                render: (p: any) => <Pill tone="green">{p.statut}</Pill>,
              },
            ]}
            rows={pointagesData}
            rowKey={(p) => p.tech}
          />
        </Card>
      )}

      {/* MODAL INVITER COLLABORATEUR */}
      <Modal
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Inviter un collaborateur"
        subtitle="Il recevra un e-mail avec un lien d’activation sécurisé à usage unique."
        width={480}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setIsInviteOpen(false)}>
              Annuler
            </Btn>
            <Btn variant="primary" icon={Send} onClick={handleSendInvite}>
              Envoyer l’invitation
            </Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field label="Nom et prénom" required>
            <Input
              placeholder="ex. Lina Haddad"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </Field>
          <Field label="Adresse e-mail professionnelle" required>
            <Input
              placeholder="prenom.nom@anelecgroupe.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </Field>
          <Field label="Rôle attribué" required hint="Les droits d’accès seront automatiquement appliqués selon la matrice.">
            <Dropdown
              options={[
                { id: 'Administrateur', label: 'Administrateur (accès complet)' },
                { id: 'Direction', label: 'Direction (gestion & chiffres)' },
                { id: 'Bureau', label: 'Bureau (planning & devis)' },
                { id: 'Technicien', label: 'Technicien (mobile terrain)' },
              ]}
              value={inviteRole}
              onChange={setInviteRole}
            />
          </Field>
        </div>
      </Modal>
    </Page>
  );
}
