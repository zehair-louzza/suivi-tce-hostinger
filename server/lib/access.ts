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
  /** Demandes reçues : direction, chiffrage, planificateur (ceux qui trient la file d'entrée) */
  canTriageDemandes: boolean;
  /** Pointages et positions GPS de toute l'équipe : direction et planificateur uniquement */
  canSeeTeam: boolean;
  /** Facturation (n° et statut de facture) : direction et droit Facturation uniquement */
  canSeeBilling: boolean;
  /** Chargé d'études : ne lit que les interventions rattachées à un devis (lecture seule) */
  linkedOnly: boolean;
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
  const isOwner = user?.id === 1;
  const role = isOwner ? 'ADMIN' : baseRole;
  // Rôle inconnu = aucun droit (refus par défaut). Avant, un rôle inconnu héritait des droits du planificateur.
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
    canSeeBilling: isAdmin || Boolean(perms.canManageBilling),
    linkedOnly: !isAdmin && !isFieldOnly && role === 'CHIFFRAGE_DEVIS',
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
 * Lecture d'UN devis. Même règle que la liste, plus : le planificateur lit les devis acceptés pour les convertir.
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

/** Lecture d'UNE intervention : terrain = les siennes ; chargé d'études = celles rattachées à un devis. */
export function canReadIntervention(
  a: Access,
  i: {
    entreprise?: string | null;
    technicien?: string | null;
    devisId?: number | null;
    origineDevisId?: number | null;
    isVisiteDevis?: boolean | null;
  }
): boolean {
  if (a.isAdmin) return true;
  if (a.isFieldOnly) return techMatches(a.boundTech, i.entreprise) || techMatches(a.boundTech, i.technicien);
  if (a.linkedOnly) return Boolean(i.devisId || i.origineDevisId || i.isVisiteDevis);
  return true;
}

/** Retire les montants d'un devis (identique au masquage historique de la liste). */
export function censorDevis<T extends { computed?: any }>(d: T): T {
  return { ...d, amount: null, montantHt: null, computed: { ...(d.computed || {}), totalFactureHt: 0 } };
}

/** Retire les montants d'une intervention (identique au masquage historique de la liste). */
export function censorIntervention<T extends object>(i: T): T {
  return { ...i, amount: 0, montantHt: null };
}

/** Retire la facturation (n° et statut de facture) pour qui n'a pas le droit Facturation. */
export function censorBilling<T extends object>(i: T): T {
  return { ...i, numeroFacture: null, statutFacture: null };
}

/**
 * Vue « terrain » d'une intervention : client, adresse du chantier, contact sur place (dans les notes),
 * créneau, avancement, compte rendu et photos. Aucun montant, aucune facturation, aucun historique interne.
 */
const FIELD_VIEW_KEYS = [
  'id', 'reference', 'referenceMetier', 'refDevisTexte', 'client', 'chantier', 'siteAdresse', 'objet',
  'typeIntervention', 'corpsEtat', 'priorite', 'modePlanification', 'datePlanifiee', 'statutOperationnel',
  'traitement', 'status', 'entreprise', 'technicien', 'dateDebut', 'dateReelle', 'dateFin',
  'resultatTechnique', 'motifBlocage', 'compteRendu', 'notes', 'heureDebut', 'heureFin',
  'heureDebutReelle', 'heureFinReelle', 'actionsRealisees', 'photos', 'elementsChiffrage', 'statutRapport',
  'isVisiteDevis', 'origineDevisId', 'devisId', 'gpsCloture', 'version', 'createdAt', 'updatedAt',
  'reponseTechnicien', 'reponseLe', 'motifRefus', 'affecteLe',
] as const;

export function fieldViewIntervention<T extends Record<string, any>>(i: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const k of FIELD_VIEW_KEYS) if (k in i) out[k] = i[k];
  return out as Partial<T>;
}

/** Applique à une intervention tout ce que le rôle n'a pas le droit de voir. */
export function shapeIntervention<T extends Record<string, any>>(a: Access, i: T): T | Partial<T> {
  if (a.isAdmin) return i;
  if (a.isFieldOnly) return fieldViewIntervention(i);
  let out: any = i;
  if (!a.canSeeAmounts) out = censorIntervention(out);
  if (!a.canSeeBilling) out = censorBilling(out);
  return out;
}

// --- Écriture d'une intervention : chaque rôle ne peut modifier QUE ses propres champs ---------------------

const REPORT_KEYS = [
  'compteRendu', 'actionsRealisees', 'photos', 'elementsChiffrage', 'resultatTechnique', 'motifBlocage',
  'statutRapport', 'rapportFinal',
];
const TERRAIN_KEYS = [
  'statutOperationnel', 'traitement', 'status', 'heureDebutReelle', 'heureFinReelle', 'dateReelle', 'dateFin',
  'dateDebut', 'gpsCloture', 'compteRendu', 'actionsRealisees', 'photos', 'elementsChiffrage',
  'resultatTechnique', 'motifBlocage', 'statutRapport',
];
const PLANNING_KEYS = [
  'datePlanifiee', 'heureDebut', 'heureFin', 'entreprise', 'technicien', 'statutOperationnel',
  'modePlanification', 'priorite', 'dateEcheance', 'echeance', 'dateDemande',
];
const OFFICE_KEYS = [
  ...PLANNING_KEYS, ...REPORT_KEYS, 'reference', 'referenceMetier', 'refDevisTexte', 'client', 'chantier',
  'siteAdresse', 'objet', 'origine', 'typeIntervention', 'corpsEtat', 'isVisiteDevis', 'devisId', 'numeroDI',
  'traitement', 'status', 'notes', 'dateDebut', 'dateReelle', 'dateFin', 'heureDebutReelle', 'heureFinReelle',
  'gpsCloture',
];
const BILLING_KEYS = ['numeroFacture', 'statutFacture'];
const AMOUNT_KEYS = ['amount', 'tauxTVA'];

/**
 * Champs qu'un rôle a le droit d'écrire sur une intervention. `null` = tous (direction).
 *  - Terrain : l'avancement de SES missions, le compte rendu, les photos — rien d'autre.
 *  - Rapports : le rapport seulement (ni date, ni technicien, ni statut).
 *  - Facturation : la facturation seulement.
 *  - Planificateur : tout sauf la facturation.
 *  - Chargé d'études : le créneau des visites de chiffrage seulement.
 */
export function writableInterventionFields(
  a: Access,
  existing?: { isVisiteDevis?: boolean | null }
): Set<string> | null {
  if (a.isAdmin) return null;
  if (a.isFieldOnly) return new Set(TERRAIN_KEYS);
  const keys = new Set<string>();
  const planning =
    Boolean(a.perms.canEditPlanning) && (a.role !== 'CHIFFRAGE_DEVIS' || Boolean(existing?.isVisiteDevis));
  if (a.perms.canEditInterventions && a.perms.canEditPlanning && a.role !== 'CHIFFRAGE_DEVIS') {
    // Planificateur : la fiche complète, sauf la facturation
    OFFICE_KEYS.forEach((k) => keys.add(k));
    if (a.canSeeAmounts) AMOUNT_KEYS.forEach((k) => keys.add(k));
  } else {
    if (a.perms.canEditInterventions || a.perms.canWriteReports) REPORT_KEYS.forEach((k) => keys.add(k));
    if (planning) PLANNING_KEYS.forEach((k) => keys.add(k));
  }
  if (a.perms.canManageBilling) {
    BILLING_KEYS.forEach((k) => keys.add(k));
    AMOUNT_KEYS.forEach((k) => keys.add(k));
  }
  return keys;
}

/** Garde uniquement les champs autorisés ; renvoie aussi la liste des champs refusés. */
export function limitToWritable(
  body: Record<string, any>,
  allowed: Set<string> | null
): { clean: Record<string, any>; dropped: string[] } {
  if (allowed === null) return { clean: body, dropped: [] };
  const clean: Record<string, any> = {};
  const dropped: string[] = [];
  for (const k of Object.keys(body)) {
    if (allowed.has(k)) clean[k] = body[k];
    else dropped.push(k);
  }
  return { clean, dropped };
}

// --- Devis : même principe que pour les interventions ----------------------------------------------------

const DEVIS_FIELD_VIEW_KEYS = [
  'id', 'reference', 'referenceMetier', 'client', 'site', 'siteAdresse', 'objet', 'corpsEtat', 'numeroDI',
  'dateCreated', 'dateDemande', 'statutCommercial', 'traitement', 'status', 'responsable', 'notes',
  'commentaires', 'visiteNecessaire', 'visiteTechnicien', 'visiteDate', 'visiteHeureDebut', 'visiteHeureFin',
  'visiteStatut', 'visiteRapport', 'gpsCloture', 'photos', 'version', 'createdAt', 'updatedAt',
] as const;

/** Vue « terrain » d'un devis (visite assignée) : lieu, client, créneau, relevés — ni montants, ni historique. */
export function fieldViewDevis<T extends Record<string, any>>(d: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const k of DEVIS_FIELD_VIEW_KEYS) if (k in d) out[k] = d[k];
  return out as Partial<T>;
}

/** Applique à un devis tout ce que le rôle n'a pas le droit de voir. */
export function shapeDevis<T extends Record<string, any>>(a: Access, d: T): T | Partial<T> {
  if (a.isAdmin) return d;
  if (a.isFieldOnly) return fieldViewDevis(d);
  return a.canSeeAmounts ? d : censorDevis(d as any);
}

const DEVIS_TERRAIN_KEYS = ['visiteStatut', 'visiteRapport', 'gpsCloture', 'compteRendu', 'photos'];
const DEVIS_CONVERT_KEYS = ['traitement', 'status', 'prochaineAction', 'refInterventionTexte', 'numeroDI'];
const DEVIS_AMOUNT_KEYS = ['amount', 'montantHt', 'tauxTVA'];

/**
 * Filtre le corps d'une modification de devis :
 *  - terrain : relevé de visite seulement ;
 *  - chiffrage : tout, mais les montants seulement avec le droit « Montants » ;
 *  - conversion seule : suivi du dossier seulement.
 */
export function limitDevisBody(
  a: Access,
  body: Record<string, any>
): { clean: Record<string, any>; dropped: string[] } {
  if (a.isAdmin) return { clean: body, dropped: [] };
  if (a.isFieldOnly) return limitToWritable(body, new Set(DEVIS_TERRAIN_KEYS));
  if (a.perms.canEditDevis) {
    const clean: Record<string, any> = {};
    const dropped: string[] = [];
    for (const k of Object.keys(body)) {
      if (!a.canSeeAmounts && DEVIS_AMOUNT_KEYS.includes(k)) dropped.push(k);
      else clean[k] = body[k];
    }
    return { clean, dropped };
  }
  return limitToWritable(body, new Set(a.perms.canConvertDevis ? DEVIS_CONVERT_KEYS : []));
}

// --- Fiches clients et équipe (paramètres) ------------------------------------------------------------------

/** Fiche client vue par le terrain : nom, adresse et contact sur place — ni tarifs, ni facturation, ni SIRET. */
export function fieldClientFiche(f: Record<string, any>): Record<string, any> {
  const keys = ['id', 'nom', 'type', 'adresse', 'codePostal', 'ville', 'contactNom', 'contactRole', 'telephone', 'active'];
  const out: Record<string, any> = {};
  for (const k of keys) if (k in f) out[k] = f[k];
  return out;
}

/** Fiche client vue par les autres rôles : le taux horaire négocié n'est visible qu'avec les montants. */
export function shapeClientFiche(a: Access, f: Record<string, any>): Record<string, any> {
  if (a.isAdmin) return f;
  if (a.isFieldOnly) return fieldClientFiche(f);
  if (a.canSeeAmounts) return f;
  const { tauxHoraireNegocie: _t, ...rest } = f;
  return rest;
}

const isClosureValue = (v: unknown) => /cl[oô]tur/i.test(String(v ?? ''));

/**
 * Écriture d'une intervention : filtre par champ + une seule exception à la règle « le rapports ne touche pas au
 * statut » — il peut CLÔTURER (valider son rapport). Le reste du statut reste réservé au bureau et au terrain.
 */
export function limitInterventionBody(
  a: Access,
  body: Record<string, any>,
  existing?: { isVisiteDevis?: boolean | null }
): { clean: Record<string, any>; dropped: string[] } {
  const allowed = writableInterventionFields(a, existing);
  const res = limitToWritable(body, allowed);
  if (
    allowed &&
    !a.isFieldOnly &&
    (a.perms.canWriteReports || a.perms.canEditInterventions) &&
    res.dropped.includes('statutOperationnel') &&
    isClosureValue(body.statutOperationnel)
  ) {
    res.clean.statutOperationnel = body.statutOperationnel;
    res.dropped = res.dropped.filter((k) => k !== 'statutOperationnel');
  }
  return res;
}

// --- Messages clairs quand une partie n'est pas modifiable par le rôle -------------------------------------

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Direction',
  CONDUCTEUR_TRAVAUX: 'Planificateur',
  CHIFFRAGE_DEVIS: "Chargé d'études (chiffrage)",
  REDACTEUR_RAPPORTS: 'Rapports et facturation',
  TECHNICIEN: 'Technicien (sur ses propres missions)',
};

type Part = { label: string; keys: string[] };

const INTERVENTION_PARTS: Part[] = [
  { label: 'le planning (date, heures, technicien)', keys: PLANNING_KEYS.filter((k) => k !== 'statutOperationnel') },
  { label: "le statut de l'intervention", keys: ['statutOperationnel', 'traitement', 'status'] },
  { label: 'le rapport et le compte rendu', keys: [...REPORT_KEYS, 'heureDebutReelle', 'heureFinReelle', 'gpsCloture'] },
  { label: 'la facturation', keys: BILLING_KEYS },
  { label: 'les montants', keys: [...AMOUNT_KEYS, 'montantHt'] },
];
const DEVIS_PARTS: Part[] = [
  { label: 'les montants du devis', keys: DEVIS_AMOUNT_KEYS },
  { label: 'le relevé de visite (statut, photos, compte rendu)', keys: DEVIS_TERRAIN_KEYS },
];

function partFor(parts: Part[], key: string, fallback: string): Part {
  return parts.find((p) => p.keys.includes(key)) || { label: fallback, keys: [key] };
}

function defaultAccess(role: string): Access {
  return accessFor({ id: 0, role, name: 'x', technicienNom: role === 'TECHNICIEN' ? 'x' : null } as any);
}

/** Rôles (par défaut) qui ont le droit de modifier ce champ — calculé avec les mêmes règles que l'enregistrement. */
export function rolesAllowedToWrite(kind: 'intervention' | 'devis', key: string): string[] {
  const out: string[] = [];
  for (const role of Object.keys(ROLE_LABELS)) {
    const a = defaultAccess(role);
    const test = (existing?: { isVisiteDevis?: boolean }) =>
      (kind === 'intervention' ? limitInterventionBody(a, { [key]: 'x' }, existing) : limitDevisBody(a, { [key]: 'x' }))
        .dropped.length === 0;
    if (kind === 'intervention' && role === 'CHIFFRAGE_DEVIS') {
      if (test({ isVisiteDevis: true })) out.push(`${ROLE_LABELS[role]}, pour les visites de chiffrage uniquement`);
      continue;
    }
    if (test({ isVisiteDevis: false })) out.push(ROLE_LABELS[role]);
  }
  return out;
}

/** « Vous n'avez pas le droit de modifier … Peuvent la modifier : … » — une phrase par partie concernée. */
export function describeRefusal(
  kind: 'intervention' | 'devis',
  dropped: string[]
): { message: string; parts: { part: string; roles: string[] }[] } {
  const parts = kind === 'intervention' ? INTERVENTION_PARTS : DEVIS_PARTS;
  const fallback = kind === 'intervention' ? 'la fiche (client, chantier, références)' : 'la fiche du devis';
  const byLabel = new Map<string, { part: string; roles: string[] }>();
  for (const key of dropped) {
    const p = partFor(parts, key, fallback);
    if (!byLabel.has(p.label)) byLabel.set(p.label, { part: p.label, roles: rolesAllowedToWrite(kind, key) });
  }
  const list = [...byLabel.values()];
  const message = list
    .map(
      (x) =>
        `Vous n'avez pas le droit de modifier ${x.part}. Peuvent la modifier : ${x.roles.join(' ; ') || 'la direction'}.`
    )
    .join('\n');
  return { message, parts: list };
}
