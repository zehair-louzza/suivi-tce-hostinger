// POLITIQUE D'ACCÈS UNIQUE : « ce rôle peut-il faire cette action ? »
//
// Refus par défaut : une action absente de cette table est refusée à tout le monde. Chaque route du serveur
// déclare l'action qu'elle exerce (voir guardCore.ts) et le serveur refuse de démarrer si une route n'en
// déclare aucune. Fonctions pures : testées pour les 5 rôles (test/policy.test.ts).
//
// Les règles « sur l'objet précis » (ex. : un technicien ne lit que SES missions) restent appliquées
// dans les routes avec access.ts ; cette table décide si l'action est permise au rôle, tout court.
import { accessFor, type Access } from './access.js';

type Rule = (a: Access) => boolean;

const anyMember: Rule = () => true;
const admin: Rule = (a) => a.isAdmin;

export const POLICY = {
  // --- Devis
  'devis.list': anyMember, // le contenu est filtré par rôle dans la route
  'devis.read': anyMember, // idem, objet par objet
  'devis.stats': (a) => !a.isFieldOnly,
  'devis.create': (a) => a.isAdmin || a.perms.canEditDevis,
  'devis.update': (a) => a.isAdmin || a.isFieldOnly || a.perms.canEditDevis || a.perms.canConvertDevis,
  'devis.delete': (a) => a.isAdmin || a.perms.canDeleteRecords,
  'devis.convert': (a) => a.isAdmin || a.perms.canConvertDevis || a.perms.canEditDevis,
  'devis.sendEmail': (a) => a.isAdmin || (!a.isFieldOnly && a.perms.canEditDevis),

  // --- Interventions
  'interventions.list': anyMember,
  'interventions.read': anyMember,
  'interventions.stats': (a) => !a.isFieldOnly,
  // Création : direction, conducteur, chargé d'études (visites de chiffrage). Jamais le terrain ni les rapports.
  'interventions.create': (a) => a.isAdmin || (!a.isFieldOnly && a.perms.canEditPlanning),
  'interventions.update': (a) =>
    a.isAdmin ||
    a.isFieldOnly ||
    a.perms.canEditInterventions ||
    a.perms.canWriteReports ||
    a.perms.canEditPlanning ||
    a.perms.canManageBilling,
  'interventions.delete': (a) => a.isAdmin || a.perms.canDeleteRecords,
  'interventions.sendReport': (a) =>
    a.isAdmin ||
    (!a.isFieldOnly && (a.perms.canWriteReports || a.perms.canEditInterventions || a.perms.canManageBilling)),

  // --- Demandes reçues
  'demandes.list': (a) => a.canTriageDemandes,
  'demandes.create': (a) => a.canTriageDemandes,
  'demandes.update': (a) => a.canTriageDemandes,
  'demandes.orienter': (a) => a.canTriageDemandes,

  // --- Paramètres métier et GPS
  'referentiels.read': anyMember,
  'referentiels.write': (a) => a.isAdmin || a.perms.canManageReferentiels,
  'gps.post': anyMember, // chacun ne peut déposer que sa propre position (forcée côté serveur)

  // --- Administration
  'admin.users.list': admin,
  'admin.users.create': admin,
  'admin.users.update': admin,
  'admin.users.delete': admin,
  'admin.invitations.manage': admin,
  'admin.company.destroy': admin,
  'admin.smtp.manage': admin,
  'admin.appearance.read': admin,
  'admin.appearance.update': admin,
  'admin.siege.update': admin,
  'admin.pointages.read': anyMember, // direction et conducteur : l'équipe ; les autres : le leur (filtré dans la route)
  'admin.pointages.clock': anyMember, // chacun pointe pour lui-même (forcé côté serveur)
} satisfies Record<string, Rule>;

export type Action = keyof typeof POLICY;

/** Refus par défaut : action inconnue ou règle absente = non. */
export function can(access: Access, action: string): boolean {
  // Propriété propre uniquement (jamais 'toString', '__proto__'…) et résultat strictement `true`
  if (!Object.prototype.hasOwnProperty.call(POLICY, action)) return false;
  const rule = (POLICY as Record<string, Rule>)[action];
  return rule(access) === true;
}

/** Libellés métier des actions, pour des refus compréhensibles (« Votre profil ne permet pas de … »). */
export const ACTION_LABELS: Record<Action, string> = {
  'devis.list': 'consulter les devis',
  'devis.read': 'consulter ce devis',
  'devis.stats': 'consulter les statistiques des devis',
  'devis.create': 'créer un devis',
  'devis.update': 'modifier ce devis',
  'devis.delete': 'supprimer un devis',
  'devis.convert': 'transformer un devis en intervention',
  'devis.sendEmail': 'envoyer un devis par email',
  'interventions.list': 'consulter les interventions',
  'interventions.read': 'consulter cette intervention',
  'interventions.stats': 'consulter les statistiques des interventions',
  'interventions.create': 'créer une intervention',
  'interventions.update': 'modifier cette intervention',
  'interventions.delete': 'supprimer une intervention',
  'interventions.sendReport': 'envoyer un rapport par email',
  'demandes.list': 'consulter les demandes reçues',
  'demandes.create': 'enregistrer une demande',
  'demandes.update': 'modifier une demande',
  'demandes.orienter': 'orienter une demande',
  'referentiels.read': 'consulter les paramètres métier',
  'referentiels.write': 'modifier les paramètres métier',
  'gps.post': 'envoyer une position',
  'admin.users.list': 'consulter les utilisateurs',
  'admin.users.create': 'créer un utilisateur',
  'admin.users.update': 'modifier un utilisateur',
  'admin.users.delete': 'supprimer un utilisateur',
  'admin.invitations.manage': 'gérer les invitations',
  'admin.company.destroy': 'supprimer la société',
  'admin.smtp.manage': 'régler l\'envoi des emails',
  'admin.appearance.read': 'consulter l\'apparence de la société',
  'admin.appearance.update': 'modifier l\'apparence de la société',
  'admin.siege.update': 'modifier le siège de la société',
  'admin.pointages.read': 'consulter les pointages',
  'admin.pointages.clock': 'pointer',
};

/** Profils (par défaut) autorisés pour une action — même table de règles que l'application réelle. */
export function rolesAllowedFor(action: Action, labels: Record<string, string>): string[] {
  return Object.keys(labels).filter((role) =>
    can(accessFor({ id: 0, role, name: 'x', technicienNom: role === 'TECHNICIEN' ? 'x' : null } as any), action)
  );
}
