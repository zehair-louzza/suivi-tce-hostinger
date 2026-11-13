// Automatisation C — rapport d'intervention client par lien sécurisé.
// Fonctions PURES (sans base de données) : testées dans test/rapportClient.test.ts.
//
// Cycle : rapport VALIDÉ EN INTERNE → ENVOYÉ À LA MAIN (adresses de la fiche client, confirmation) →
//   le client VALIDE le rapport ou ÉMET DES RÉSERVES ; sans réponse : relances J+3 / J+7, puis expiration du lien à 30 jours.
// Un silence n'est JAMAIS une validation : sans réponse, le rapport reste « Envoyé au client ».
import crypto from 'node:crypto';
import { emailValide, genererSel, idDuJeton, prochaineActionDevis, type ActionDevis, type EtatDevisEnvoye } from './devisClient.js';

export { DUREE_LIEN_JOURS, RELANCE_J3_JOURS, RELANCE_J7_JOURS, MAX_DESTINATAIRES, TAILLE_MAX_PDF, emailValide, genererSel, idDuJeton } from './devisClient.js';

export type ReponseRapport = 'VALIDE' | 'RESERVES';

/** Statuts du rapport (champ statutRapport de l'intervention) liés à l'envoi au client. */
export const STATUT_ENVOYE = 'Envoyé au client';
export const STATUT_VALIDE_CLIENT = 'Validé par le client';
export const STATUT_RESERVES = 'Réserves client';
/** Le rapport est « validé en interne » : seul état à partir duquel un premier envoi est possible. */
export const STATUT_VALIDE_INTERNE = 'Validé & Clôturé';

const STATUTS_ENVOI_AUTORISES = [STATUT_VALIDE_INTERNE, STATUT_ENVOYE, STATUT_RESERVES];

export function envoiRapportAutorise(statutRapport: string | null | undefined): { ok: true } | { ok: false; code: string; message: string } {
  const s = String(statutRapport || '');
  if (s === STATUT_VALIDE_CLIENT) {
    return { ok: false, code: 'DEJA_VALIDE', message: 'Ce rapport a déjà été validé par le client : il ne peut plus être renvoyé.' };
  }
  if (!STATUTS_ENVOI_AUTORISES.includes(s)) {
    return {
      ok: false,
      code: 'VALIDATION_INTERNE_REQUISE',
      message: `Validez d'abord le rapport en interne (statut « ${STATUT_VALIDE_INTERNE} ») : rien ne part au client avant cette validation.`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Jeton du lien : dérivé (HMAC) de l'identifiant, de la société, de l'intervention et d'un sel aléatoire.
// ---------------------------------------------------------------------------

export type LienRapportIdentite = { id: number; companyId: number; interventionId: number; sel: string };

function signature(secret: string, l: LienRapportIdentite): string {
  return crypto.createHmac('sha256', secret).update(`rapport-lien:${l.id}:${l.companyId}:${l.interventionId}:${l.sel}`).digest('base64url');
}

export function fabriquerJetonRapport(secret: string, l: LienRapportIdentite): string {
  return `${l.id}.${signature(secret, l)}`;
}

export function verifierJetonRapport(secret: string, jeton: unknown, l: LienRapportIdentite): boolean {
  const attendu = Buffer.from(fabriquerJetonRapport(secret, l));
  const recu = Buffer.from(String(jeton || ''));
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
}

// ---------------------------------------------------------------------------
// Réponse du client
// ---------------------------------------------------------------------------

export type ReponseRapportValide = { reponse: ReponseRapport; motif: string; nom: string };

export function validerReponseRapport(body: any): { ok: true; value: ReponseRapportValide } | { ok: false; message: string } {
  const reponse = String(body?.reponse || '').toUpperCase();
  if (reponse !== 'VALIDE' && reponse !== 'RESERVES') {
    return { ok: false, message: 'Réponse attendue : valider le rapport ou émettre des réserves.' };
  }
  const nom = String(body?.nom ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (nom.length < 2) return { ok: false, message: 'Indiquez votre nom pour valider votre réponse.' };
  const motif = String(body?.motif ?? '').trim().slice(0, 1000);
  if (reponse === 'RESERVES' && motif.length < 3) {
    return { ok: false, message: 'Décrivez vos réserves (3 caractères minimum).' };
  }
  return { ok: true, value: { reponse, motif, nom } };
}

/** Statut du rapport après la réponse du client. */
export function statutApresReponseRapport(reponse: ReponseRapport): string {
  return reponse === 'VALIDE' ? STATUT_VALIDE_CLIENT : STATUT_RESERVES;
}

// ---------------------------------------------------------------------------
// Relances et expiration : mêmes règles que le devis (J+3, J+7, créneau lundi–samedi 8 h–19 h, 30 jours)
// ---------------------------------------------------------------------------

export type EtatRapportEnvoye = Omit<EtatDevisEnvoye, 'statut'> & { statutRapport: string | null | undefined };
export type ActionRapport = ActionDevis;

export function prochaineActionRapport(e: EtatRapportEnvoye): ActionRapport {
  const { statutRapport, ...reste } = e;
  return prochaineActionDevis({ ...reste, statut: statutRapport });
}

// ---------------------------------------------------------------------------
// Photos : le bureau coche « tout » ou des photos choisies
// ---------------------------------------------------------------------------

export const TAILLE_MAX_PHOTO_OCTETS = 6 * 1024 * 1024;
const DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i;

export type PhotoTerrain = { id?: unknown; url?: unknown; caption?: unknown; category?: unknown; takenAt?: unknown };
export type PhotoTransmissible = { id: string; caption: string; category: string; takenAt: string | null; type: string };

/**
 * Photos qui peuvent être montrées au client : images intégrées (data:image/…) de taille raisonnable.
 * Les autres (adresse externe, format inconnu) sont ignorées : le client n'a jamais d'adresse interne.
 */
export function photosTransmissibles(photos: PhotoTerrain[] | null | undefined): PhotoTransmissible[] {
  const out: PhotoTransmissible[] = [];
  const vus = new Set<string>();
  for (const p of photos || []) {
    const id = typeof p?.id === 'string' ? p.id.trim() : '';
    const url = typeof p?.url === 'string' ? p.url : '';
    const m = DATA_IMAGE_RE.exec(url);
    if (!id || !m || vus.has(id)) continue;
    if (Math.floor((m[2].length * 3) / 4) > TAILLE_MAX_PHOTO_OCTETS) continue;
    vus.add(id);
    out.push({
      id,
      caption: typeof p.caption === 'string' ? p.caption.slice(0, 200) : '',
      category: typeof p.category === 'string' ? p.category.slice(0, 60) : '',
      takenAt: typeof p.takenAt === 'string' ? p.takenAt : null,
      type: m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase(),
    });
  }
  return out;
}

export type ChoixPhotos = { ok: true; ids: string[] } | { ok: false; message: string };

/** « Tout cocher » (toutes) ou une sélection d'identifiants ; un identifiant inconnu est refusé. Aucune photo est un choix valide. */
export function choisirPhotos(dispo: PhotoTransmissible[], demande: { toutes?: unknown; ids?: unknown }): ChoixPhotos {
  if (demande?.toutes === true) return { ok: true, ids: dispo.map((p) => p.id) };
  const liste = Array.isArray(demande?.ids) ? demande.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const uniques = Array.from(new Set(liste));
  const autorisees = new Set(dispo.map((p) => p.id));
  const inconnue = uniques.find((id) => !autorisees.has(id));
  if (inconnue) return { ok: false, message: 'Une des photos choisies n’existe plus sur ce rapport. Rechargez la liste.' };
  // On garde l'ordre du rapport, pas l'ordre des clics
  return { ok: true, ids: dispo.filter((p) => uniques.includes(p.id)).map((p) => p.id) };
}

// ---------------------------------------------------------------------------
// Contenu vu par le client (figé à l'envoi)
// ---------------------------------------------------------------------------

export type ContenuRapport = {
  reference: string;
  client: string | null;
  chantier: string | null;
  site: string | null;
  objet: string | null;
  corpsEtat: string | null;
  typeIntervention: string | null;
  datePlanifiee: string | null;
  dateReelle: string | null;
  actionsRealisees: string[];
  rapport: string;
  photos: Array<{ id: string; caption: string; category: string }>;
};

function jour(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}

const texte = (v: unknown): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t ? t : null;
};

export function fabriquerContenu(
  i: Record<string, any>,
  reference: string,
  actions: string[],
  photosChoisies: PhotoTransmissible[]
): ContenuRapport {
  return {
    reference,
    client: texte(i.client),
    chantier: texte(i.chantier),
    site: texte(i.siteAdresse),
    objet: texte(i.objet),
    corpsEtat: texte(i.corpsEtat),
    typeIntervention: texte(i.typeIntervention),
    datePlanifiee: jour(i.datePlanifiee),
    dateReelle: jour(i.dateReelle),
    actionsRealisees: actions.map((a) => String(a).trim()).filter(Boolean).slice(0, 60),
    rapport: String(i.rapportFinal || i.compteRendu || '').trim().slice(0, 20000),
    photos: photosChoisies.map((p) => ({ id: p.id, caption: p.caption, category: p.category })),
  };
}

/** Champs que le client voit : leur modification, après envoi, rend son lien périmé. */
export const CHAMPS_CONTENU_RAPPORT = [
  'rapportFinal', 'compteRendu', 'actionsRealiseesJson', 'photosJson', 'client', 'chantier', 'siteAdresse', 'objet',
  'corpsEtat', 'typeIntervention', 'dateReelle',
] as const;

function comparable(champ: string, v: unknown): string {
  if (v === null || v === undefined) return '';
  if (champ === 'dateReelle') return jour(v) || '';
  if (champ === 'photosJson') {
    try {
      const arr = JSON.parse(String(v));
      return Array.isArray(arr) ? JSON.stringify(arr.map((p: any) => [p?.id, p?.url, p?.caption])) : '';
    } catch {
      return String(v);
    }
  }
  if (champ === 'actionsRealiseesJson') {
    try {
      const arr = JSON.parse(String(v));
      return Array.isArray(arr) ? JSON.stringify(arr.map((a: any) => String(a).trim())) : '';
    } catch {
      return String(v);
    }
  }
  return String(v).trim().replace(/\s+/g, ' ');
}

/** Le rapport a-t-il changé pour le client ? Notes, statuts, factures, relances… ne révoquent rien. */
export function contenuRapportModifie(avant: Record<string, any>, apres: Record<string, any>): boolean {
  return CHAMPS_CONTENU_RAPPORT.some((k) => comparable(k, avant[k]) !== comparable(k, apres[k]));
}

export function referenceRapport(i: { id: number; referenceMetier?: string | null }): string {
  return i.referenceMetier || `INT-${String(i.id).padStart(3, '0')}`;
}
