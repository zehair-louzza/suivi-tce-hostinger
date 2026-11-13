// Règles d'accès par rôle — fonctions PURES (aucune base de données) pour pouvoir être testées à fond.
//
// Principe (OWASP « deny by default ») : le serveur décide, jamais l'écran. Chaque route qui lit ou modifie
// une donnée métier passe par ces fonctions. Les droits sont toujours relus dans la base à chaque requête.
import { getEffectivePermissions, ROLE_DEFINITIONS, type UserPermissions } from '../../shared/types.js';

export interface AccessUser {
  id: number;
  email?: string | null;
  role?: string | null;
  name?: string | null;
  technicienNom?: string | null;
  permissionsJson?: string | null;
}

export interface Access {
  userId: number;
  role: string;
  perms: UserPermissions;
  /** Direction : tout, dans SA seule entreprise */
  isAdmin: boolean;
  /** Profil terrain : ne voit que ce qui lui est affecté */
  isFieldOnly: boolean;
  /** Nom sous lequel les missions lui sont affectées */
  boundTech: string;
  canSeeAmounts: boolean;
  /** Demandes reçues : direction, chiffrage, conducteur (ceux qui trient la file d'entrée) */
  canTriageDemandes: boolean;
  /** Pointages et positions GPS de toute l'équipe : direction et conducteur uniquement */
  canSeeTeam: boolean;
}

const NO_PERMISSIONS: UserPermissions = {
  canManageUsers: false,
  canManageReferentiels: false,
  canEditDevis: false,
  canViewFinancials: false,
  canConvertDevis: false,
  canEditPlanning: false,
  canEditInterventions: false,
  canWriteReports: false,
  canManageBilling: false,
  canDeleteRecords: false,
  canAccessMobileTech: false,
  mobileOnly: false,
};

const OWNER_EMAIL = 'louzza.zehair@gmail.com';

export function accessFor(user: AccessUser | null | undefined, tokenRole?: string | null): Access {
  const baseRole = ((user?.role || tokenRole || '') as string).toUpperCase();
  // Même règle que le reste de l'application : le compte fondateur est administrateur de SA seule entreprise
  const isOwner = user?.id === 1 || (user?.email || '').toLowerCase() === OWNER_EMAIL;
  const role = isOwner ? 'ADMIN' : baseRole;
  // Rôle inconnu = aucun droit (refus par défaut). Avant, un rôle inconnu héritait des droits du conducteur.
  const perms = ROLE_DEFINITIONS[role] ? getEffectivePermissions(role, user?.permissionsJson) : { ...NO_PERMISSIONS };
  const isAdmin = isOwner || role === 'ADMIN' || Boolean(perms.canManageUsers);
  const isMobileOnly =
    !isAdmin &&
    (role === 'TECHNICIEN' ||
      Boolean(perms.mobileOnly) ||
      (Boolean(user?.technicienNom) && !perms.canEditDevis && !perms.canManageBilling && !perms.canEditPlanning));
  const isFieldOnly = isMobileOnly || role === 'TECHNICIEN';
  return {
    userId: user?.id ?? 0,
    role,
    perms,
    isAdmin,
    isFieldOnly,
    boundTech: (user?.technicienNom || user?.name || '').trim(),
    canSeeAmounts: isAdmin || Boolean(perms.canViewFinancials),
    canTriageDemandes: isAdmin || (!isFieldOnly && (Boolean(perms.canEditDevis) || Boolean(perms.canEditPlanning))),
    canSeeTeam: isAdmin || role === 'CONDUCTEUR_TRAVAUX',
  };
}

/** Une mission est « à moi » si son technicien correspond à mon nom (jamais si je n'ai pas de nom). */
export function techMatches(bound: string, value?: string | null): boolean {
  const b = (bound || '').trim().toLowerCase();
  const v = (value || '').trim().toLowerCase();
  if (!b || !v) return false;
  return v.includes(b) || b.includes(v);
}

const ACCEPTED_DEVIS = ['Accepté', 'Signé', 'Facturé', 'Gagné'];

/**
 * Lecture d'UN devis. Même règle que la liste, plus : le conducteur lit les devis acceptés pour les convertir.
 */
export function canReadDevis(
  a: Access,
  d: { visiteTechnicien?: string | null; statutCommercial?: string | null }
): boolean {
  if (a.isAdmin) return true;
  if (a.isFieldOnly) return techMatches(a.boundTech, d.visiteTechnicien);
  if (a.perms.canEditDevis) return true;
  if (techMatches(a.boundTech, d.visiteTechnicien)) return true;
  return Boolean(a.perms.canConvertDevis) && ACCEPTED_DEVIS.includes((d.statutCommercial || '').trim());
}

/** Lecture d'UNE intervention : un profil terrain ne lit que les siennes (même règle que la liste). */
export function canReadIntervention(
  a: Access,
  i: { entreprise?: string | null; technicien?: string | null }
): boolean {
  if (!a.isFieldOnly) return true;
  return techMatches(a.boundTech, i.entreprise) || techMatches(a.boundTech, i.technicien);
}

/** Retire les montants d'un devis (identique au masquage historique de la liste). */
export function censorDevis<T extends { computed?: any }>(d: T): T {
  return { ...d, amount: null, montantHt: null, computed: { ...(d.computed || {}), totalFactureHt: 0 } };
}

/** Retire les montants d'une intervention (identique au masquage historique de la liste). */
export function censorIntervention<T extends object>(i: T): T {
  return { ...i, amount: 0, montantHt: null };
}
