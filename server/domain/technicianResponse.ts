// Automatisation A — réponse du technicien à son affectation.
// Fonctions PURES (sans base de données) : testées dans test/technicianResponse.test.ts.
//
// Cycle d'une affectation :
//   affectation → EN_ATTENTE → (ACCEPTEE | REFUSEE)
//   EN_ATTENTE sans réponse : relance après `delaiMinutes` (15 min par défaut), puis alerte au planificateur
//   et à la direction `delaiAlerteMinutes` après la relance (5 min par défaut). Par défaut, les relances
//   partent jour et nuit, sauf pendant la pause de fin de semaine (samedi 17 h → lundi 6 h ; réglable par société).

export type ReponseTechnicien = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';

export const DELAI_RELANCE_DEFAUT_MIN = 15;
export const DELAI_RELANCE_MIN = 5;
export const DELAI_ALERTE_DEFAUT_MIN = 5;
export const DELAI_RELANCE_MAX = 24 * 60;

/** Délai valide en minutes (entier borné), sinon valeur par défaut. */
export function normaliserDelai(valeur: unknown): number {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return DELAI_RELANCE_DEFAUT_MIN;
  return Math.min(DELAI_RELANCE_MAX, Math.max(DELAI_RELANCE_MIN, Math.round(n)));
}

/** Délai avant alerte (après la relance) : entier borné, sinon valeur par défaut. */
export function normaliserDelaiAlerte(valeur: unknown): number {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return DELAI_ALERTE_DEFAUT_MIN;
  return Math.min(DELAI_RELANCE_MAX, Math.max(DELAI_RELANCE_MIN, Math.round(n)));
}

function normaliserNom(v?: string | null): string {
  return (v || '').trim().toLowerCase();
}

/** Une affectation est « nouvelle » quand un technicien est désigné et diffère de l'ancien. */
export function estNouvelleAffectation(ancien?: string | null, suivant?: string | null): boolean {
  const s = normaliserNom(suivant);
  if (!s) return false;
  return s !== normaliserNom(ancien);
}

/** Jour de la semaine (0 = dimanche) et heure à Paris pour une date donnée. */
function partiesParis(date: Date): { jour: number; heure: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  const h = Number(parts.find((p) => p.type === 'hour')?.value || '0') % 24;
  const jours: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { jour: jours[wd] ?? 1, heure: h };
}

/** Début de la pause de fin de semaine : samedi 17 h (heure de Paris). */
export const PAUSE_SAMEDI_HEURE = 17;
/** Reprise des envois : lundi 6 h (heure de Paris). */
export const REPRISE_LUNDI_HEURE = 6;

/**
 * Relances et alertes : jour et nuit en semaine, et le samedi jusqu'à 17 h. Pause de fin de semaine
 * (heure de Paris) : rien ne part du samedi 17 h au lundi 6 h ; ce qui était dû part le lundi à 6 h.
 */
export function envoiAutorise(date: Date): boolean {
  const { jour, heure } = partiesParis(date);
  if (jour === 0) return false;
  if (jour === 6 && heure >= PAUSE_SAMEDI_HEURE) return false;
  if (jour === 1 && heure < REPRISE_LUNDI_HEURE) return false;
  return true;
}

export type EtatRelance = {
  reponse: string | null | undefined;
  affecteLe: Date | null | undefined;
  relanceLe: Date | null | undefined;
  alerteLe: Date | null | undefined;
  maintenant: Date;
  delaiMinutes: number;
  /** Délai entre la relance et l'alerte (défaut : 5 min). */
  delaiAlerteMinutes?: number;
  /** Pause de fin de semaine : aucune relance ni alerte du samedi 17 h au lundi 6 h (défaut : oui). */
  pasLeDimanche?: boolean;
};

export type ActionRelance = 'aucune' | 'relancer_technicien' | 'alerter_planificateur';

/**
 * Décide la prochaine action automatique pour une affectation en attente.
 *  - rien si la réponse est donnée, ou pendant la pause de fin de semaine (samedi 17 h → lundi 6 h, sauf réglage contraire) ;
 *  - relance du technicien après `delaiMinutes` sans réponse ;
 *  - alerte au planificateur et à la direction `delaiAlerteMinutes` après la relance, si toujours sans réponse.
 * Chaque étape n'est déclenchée qu'une fois (relanceLe / alerteLe servent de verrou).
 */
export function prochaineAction(e: EtatRelance): ActionRelance {
  if (e.reponse !== 'EN_ATTENTE') return 'aucune';
  if (!e.affecteLe) return 'aucune';
  if (e.pasLeDimanche !== false && !envoiAutorise(e.maintenant)) return 'aucune';
  const delaiMs = normaliserDelai(e.delaiMinutes) * 60_000;
  const delaiAlerteMs = normaliserDelaiAlerte(e.delaiAlerteMinutes) * 60_000;
  const now = e.maintenant.getTime();
  if (!e.relanceLe) {
    return now - e.affecteLe.getTime() >= delaiMs ? 'relancer_technicien' : 'aucune';
  }
  if (!e.alerteLe) {
    return now - e.relanceLe.getTime() >= delaiAlerteMs ? 'alerter_planificateur' : 'aucune';
  }
  return 'aucune';
}

export type CandidatTechnicien = { nom: string; chargeDuJour: number; competences?: string[] };

/**
 * Techniciens suggérés pour remplacer celui qui refuse : on écarte le refusant, puis on classe
 * ceux qui ont la compétence demandée en premier, puis par charge du jour croissante.
 */
export function suggererRemplacants(
  candidats: CandidatTechnicien[],
  refusant: string,
  corpsEtat?: string | null,
  max = 3
): CandidatTechnicien[] {
  const ref = normaliserNom(refusant);
  const corps = normaliserNom(corpsEtat);
  const aLaCompetence = (c: CandidatTechnicien) =>
    Boolean(corps) && (c.competences || []).some((x) => normaliserNom(x) === corps);
  return candidats
    .filter((c) => normaliserNom(c.nom) && normaliserNom(c.nom) !== ref)
    .sort((a, b) => {
      const ca = aLaCompetence(a) ? 0 : 1;
      const cb = aLaCompetence(b) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      if (a.chargeDuJour !== b.chargeDuJour) return a.chargeDuJour - b.chargeDuJour;
      return a.nom.localeCompare(b.nom, 'fr');
    })
    .slice(0, max);
}

export type ReponseDemandee = { reponse: 'ACCEPTEE' | 'REFUSEE'; motif: string };

/** Valide le corps d'une réponse : refus = motif obligatoire (3 à 300 caractères). */
export function validerReponse(body: any): { ok: true; value: ReponseDemandee } | { ok: false; message: string } {
  const reponse = String(body?.reponse || '').toUpperCase();
  if (reponse !== 'ACCEPTEE' && reponse !== 'REFUSEE') {
    return { ok: false, message: 'Réponse attendue : « acceptée » ou « refusée ».' };
  }
  const motif = String(body?.motif ?? '').trim().slice(0, 300);
  if (reponse === 'REFUSEE' && motif.length < 3) {
    return { ok: false, message: 'Indiquez le motif de votre refus (3 caractères au minimum).' };
  }
  return { ok: true, value: { reponse, motif } };
}
