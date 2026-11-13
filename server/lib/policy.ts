// POLITIQUE D'ACCÈS UNIQUE : « ce rôle peut-il faire cette action ? »
//
// Refus par défaut : une action absente de cette table est refusée à tout le monde. Chaque route du serveur
// déclare l'action qu'elle exerce (voir guardCore.ts) et le serveur refuse de démarrer si une route n'en
// déclare aucune. Fonctions pures : testées pour les 5 rôles (test/policy.test.ts).
//
// Les règles « sur l'objet précis » (ex. : un technicien ne lit que SES missions) restent appliquées
// dans les routes avec access.ts ; cette table décide si l'action est permise au rôle, tout court.
import type { Access } from './access.js';

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
  'interventions.create': (a) => a.isAdmin || a.perms.canEditInterventions || a.perms.canEditPlanning,
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
