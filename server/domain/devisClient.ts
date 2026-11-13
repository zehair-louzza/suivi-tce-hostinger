// Automatisation B — devis client par lien sécurisé.
// Fonctions PURES (sans base de données) : testées dans test/devisClient.test.ts.
//
// Cycle : devis déposé (PDF) → validé en interne puis ENVOYÉ À LA MAIN → client : accepte / refuse / demande une modification
//   sans réponse : relance J+3, relance J+7, expiration à 30 jours (statut « Expiré », rien n'est supprimé).
import crypto from 'node:crypto';

export const DUREE_LIEN_JOURS = 30;
export const RELANCE_J3_JOURS = 3;
export const RELANCE_J7_JOURS = 7;
export const TAILLE_MAX_PDF = 8 * 1024 * 1024;
export const MAX_DESTINATAIRES = 5;
/** Les relances au client ne partent que du lundi au samedi, de 8 h à 19 h (heure de Paris). */
export const HEURES_RELANCE_CLIENT = { debut: 8, fin: 19 } as const;

export type ReponseClient = 'ACCEPTEE' | 'REFUSEE' | 'MODIFICATION';

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export function emailValide(v: unknown): boolean {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
}

// ---------------------------------------------------------------------------
// Adresses du client : elles viennent de la FICHE CLIENT (adresse principale + adresses des services)
// ---------------------------------------------------------------------------

export type FicheClientLike = {
  nom?: string;
  email?: string;
  active?: boolean;
  services?: Array<{ nomService?: string; email?: string; contactNom?: string; recevoirDevis?: boolean; recevoirRapports?: boolean }>;
};

export type AdresseClient = { email: string; libelle: string; suggeree: boolean };

export function normaliserNomClient(v?: string | null): string {
  return (v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Retrouve la fiche d'un client à partir du nom saisi sur le devis. */
export function trouverFiche<T extends FicheClientLike>(fiches: T[], nomClient?: string | null): T | null {
  const n = normaliserNomClient(nomClient);
  if (!n) return null;
  return fiches.find((f) => f.active !== false && normaliserNomClient(f.nom) === n) || null;
}

/**
 * Adresses connues pour ce client, sans doublon. « suggeree » = service marqué « reçoit les devis ».
 * Règle : une seule adresse communiquée → envoi direct ; plusieurs → l'utilisateur doit confirmer laquelle (ou lesquelles).
 */
export function adressesDepuisFiche(
  fiche: FicheClientLike | null,
  /** Service « reçoit les devis » (défaut) ou « reçoit les rapports » */
  drapeau: 'recevoirDevis' | 'recevoirRapports' = 'recevoirDevis'
): AdresseClient[] {
  if (!fiche) return [];
  const vues = new Set<string>();
  const out: AdresseClient[] = [];
  const ajouter = (email: unknown, libelle: string, suggeree: boolean) => {
    if (!emailValide(email)) return;
    const e = String(email).trim().toLowerCase();
    if (vues.has(e)) {
      if (suggeree) {
        const existant = out.find((a) => a.email === e);
        if (existant) existant.suggeree = true;
      }
      return;
    }
    vues.add(e);
    out.push({ email: e, libelle, suggeree });
  };
  for (const s of fiche.services || []) {
    const nom = [s.nomService, s.contactNom].filter(Boolean).join(' — ') || 'Service';
    ajouter(s.email, nom, s[drapeau] === true);
  }
  ajouter(fiche.email, 'Adresse principale', false);
  return out.sort((a, b) => Number(b.suggeree) - Number(a.suggeree));
}

export type ChoixDestinataires =
  | { ok: true; emails: string[] }
  | { ok: false; code: 'AUCUNE_ADRESSE' | 'CONFIRMATION_REQUISE' | 'ADRESSE_INCONNUE' | 'TROP_D_ADRESSES'; message: string };

/**
 * Valide les adresses choisies par l'utilisateur. Seules les adresses de la fiche client sont acceptées.
 * Une seule adresse connue : elle est utilisée sans confirmation. Plusieurs : au moins une doit être confirmée.
 */
export function choisirDestinataires(connues: AdresseClient[], demandees: unknown, objet = 'le devis'): ChoixDestinataires {
  if (connues.length === 0) {
    return { ok: false, code: 'AUCUNE_ADRESSE', message: "Aucune adresse e-mail sur la fiche de ce client. Complétez la fiche client avant l'envoi." };
  }
  if (connues.length === 1) return { ok: true, emails: [connues[0].email] };
  const liste = Array.isArray(demandees) ? demandees.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean) : [];
  if (liste.length === 0) {
    return { ok: false, code: 'CONFIRMATION_REQUISE', message: `Ce client a plusieurs adresses : confirmez celle (ou celles) à qui envoyer ${objet}.` };
  }
  const uniques = Array.from(new Set(liste));
  if (uniques.length > MAX_DESTINATAIRES) {
    return { ok: false, code: 'TROP_D_ADRESSES', message: `Cinq adresses au maximum par envoi.` };
  }
  const autorisees = new Set(connues.map((a) => a.email));
  const inconnue = uniques.find((e) => !autorisees.has(e));
  if (inconnue) {
    return { ok: false, code: 'ADRESSE_INCONNUE', message: `L'adresse ${inconnue} ne figure pas sur la fiche du client.` };
  }
  return { ok: true, emails: uniques };
}

// ---------------------------------------------------------------------------
// Jeton du lien : dérivé (HMAC) de l'identifiant, de la société, du devis et d'un sel aléatoire.
// Rien de secret n'est stocké en clair ; le même lien peut être renvoyé dans une relance.
// ---------------------------------------------------------------------------

export type LienIdentite = { id: number; companyId: number; devisId: number; sel: string };

function signature(secret: string, l: LienIdentite): string {
  return crypto.createHmac('sha256', secret).update(`devis-lien:${l.id}:${l.companyId}:${l.devisId}:${l.sel}`).digest('base64url');
}

export function genererSel(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function fabriquerJeton(secret: string, l: LienIdentite): string {
  return `${l.id}.${signature(secret, l)}`;
}

/** Extrait l'identifiant d'un jeton (sans rien prouver) ; null si le format est invalide. */
export function idDuJeton(jeton: unknown): number | null {
  const t = String(jeton || '');
  if (t.length < 20 || t.length > 120) return null;
  const m = /^(\d{1,9})\.([A-Za-z0-9_-]{30,80})$/.exec(t);
  return m ? Number(m[1]) : null;
}

export function verifierJeton(secret: string, jeton: unknown, l: LienIdentite): boolean {
  const attendu = Buffer.from(fabriquerJeton(secret, l));
  const recu = Buffer.from(String(jeton || ''));
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
}

// ---------------------------------------------------------------------------
// Réponse du client
// ---------------------------------------------------------------------------

export type ReponseValide = { reponse: ReponseClient; motif: string; nom: string };

export function validerReponseClient(body: any): { ok: true; value: ReponseValide } | { ok: false; message: string } {
  const reponse = String(body?.reponse || '').toUpperCase();
  if (reponse !== 'ACCEPTEE' && reponse !== 'REFUSEE' && reponse !== 'MODIFICATION') {
    return { ok: false, message: 'Réponse attendue : accepter, refuser ou demander une modification.' };
  }
  const nom = String(body?.nom ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (nom.length < 2) return { ok: false, message: 'Indiquez votre nom pour valider votre réponse.' };
  const motif = String(body?.motif ?? '').trim().slice(0, 1000);
  if ((reponse === 'REFUSEE' || reponse === 'MODIFICATION') && motif.length < 3) {
    return {
      ok: false,
      message: reponse === 'REFUSEE' ? 'Indiquez le motif de votre refus.' : 'Indiquez la modification souhaitée.',
    };
  }
  return { ok: true, value: { reponse, motif, nom } };
}

/** Statut commercial du devis après la réponse du client. */
export function statutApresReponse(reponse: ReponseClient): 'Accepté' | 'Refusé' | 'En négociation' {
  if (reponse === 'ACCEPTEE') return 'Accepté';
  if (reponse === 'REFUSEE') return 'Refusé';
  return 'En négociation';
}

// ---------------------------------------------------------------------------
// Relances et expiration
// ---------------------------------------------------------------------------

function partiesParis(date: Date): { jour: number; heure: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', hour12: false });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  const h = Number(parts.find((p) => p.type === 'hour')?.value || '0') % 24;
  const jours: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { jour: jours[wd] ?? 1, heure: h };
}

/** Un client n'est relancé que du lundi au samedi, de 8 h à 19 h (heure de Paris). */
export function creneauRelanceClient(date: Date): boolean {
  const { jour, heure } = partiesParis(date);
  return jour !== 0 && heure >= HEURES_RELANCE_CLIENT.debut && heure < HEURES_RELANCE_CLIENT.fin;
}

export type EtatDevisEnvoye = {
  /** Statut commercial courant du devis */
  statut: string | null | undefined;
  envoiLe: Date | null | undefined;
  expireLe: Date | null | undefined;
  /** Le lien a déjà reçu une réponse, ou a été révoqué */
  reponduOuRevoque: boolean;
  relanceJ3Le: Date | null | undefined;
  relanceJ7Le: Date | null | undefined;
  maintenant: Date;
};

export type ActionDevis = 'aucune' | 'relancer_j3' | 'relancer_j7' | 'expirer';

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Prochaine action automatique pour un devis envoyé au client.
 *  - rien si le client a répondu, si le lien est révoqué, ou si le devis n'est plus « Envoyé au client » ;
 *  - expiration à la date d'expiration du lien ;
 *  - relance J+3 puis J+7 (si J+7 est atteint sans J+3, on n'envoie que J+7), dans le créneau autorisé.
 */
export function prochaineActionDevis(e: EtatDevisEnvoye): ActionDevis {
  if (e.statut !== 'Envoyé au client') return 'aucune';
  if (e.reponduOuRevoque || !e.envoiLe) return 'aucune';
  const now = e.maintenant.getTime();
  if (e.expireLe && now >= e.expireLe.getTime()) return 'expirer';
  const ecoule = now - e.envoiLe.getTime();
  if (!creneauRelanceClient(e.maintenant)) return 'aucune';
  if (!e.relanceJ7Le && ecoule >= RELANCE_J7_JOURS * JOUR_MS) return 'relancer_j7';
  if (!e.relanceJ3Le && !e.relanceJ7Le && ecoule >= RELANCE_J3_JOURS * JOUR_MS) return 'relancer_j3';
  return 'aucune';
}

// ---------------------------------------------------------------------------
// Dépôt du PDF
// ---------------------------------------------------------------------------

export function validerPdf(nomFichier: unknown, contenuBase64: unknown, libelle = 'devis'):
  | { ok: true; nom: string; octets: Buffer; sha256: string }
  | { ok: false; message: string } {
  const brut = String(nomFichier || '').trim();
  const nom = brut.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 150) || `${libelle}.pdf`;
  if (!/\.pdf$/i.test(nom)) return { ok: false, message: `Le ${libelle} doit être un fichier PDF (.pdf).` };
  const b64 = String(contenuBase64 || '').replace(/^data:[^;]*;base64,/, '').replace(/\s/g, '');
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, message: 'Fichier illisible, réessayez.' };
  const octets = Buffer.from(b64, 'base64');
  if (octets.length === 0) return { ok: false, message: 'Le fichier est vide.' };
  if (octets.length > TAILLE_MAX_PDF) return { ok: false, message: 'Le PDF dépasse 8 Mo : compressez-le avant de le déposer.' };
  if (octets.subarray(0, 5).toString('latin1') !== '%PDF-') return { ok: false, message: "Ce fichier n'est pas un vrai PDF." };
  return { ok: true, nom, octets, sha256: crypto.createHash('sha256').update(octets).digest('hex') };
}

/** Champs que le client voit sur la page du devis : leur modification, après envoi, rend son lien périmé. */
export const CHAMPS_CONTENU_DEVIS = ['amount', 'montantHt', 'tauxTVA', 'objet', 'client', 'siteAdresse', 'corpsEtat'] as const;

function valeurComparable(v: unknown): string {
  if (v === null || v === undefined) return '';
  const texte = String((v as any)?.toString?.() ?? v).trim();
  if (/^-?\d+(\.\d+)?$/.test(texte)) return String(Math.round(Number(texte) * 100) / 100); // 5000, "5000", "5000.00" → même valeur
  return texte.replace(/\s+/g, ' ');
}

/**
 * Le devis a-t-il changé pour le client ? Les enregistrements qui ne touchent pas ce que le client voit
 * (notes internes, statuts, relances…) ne révoquent rien. Un taux de TVA simplement renseigné pour la première fois non plus.
 */
export function contenuDevisModifie(avant: Record<string, any>, apres: Record<string, any>): boolean {
  return CHAMPS_CONTENU_DEVIS.some((k) => {
    if (k === 'tauxTVA' && (avant[k] === null || avant[k] === undefined)) return false;
    const a = valeurComparable(avant[k]);
    const z = valeurComparable(apres[k]);
    return a !== z;
  });
}
