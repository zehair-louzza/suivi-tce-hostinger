// Automatisation B — devis client : envoi par lien sécurisé, réponse du client, relances J+3 / J+7, expiration à 30 jours.
//
// Garde-fous (validés avec Zee) :
//  - l'ENVOI au client est toujours un geste humain (jamais automatique) ;
//  - l'adresse vient de la fiche client ; plusieurs adresses → l'utilisateur confirme laquelle ;
//  - lien limité dans le temps (30 jours), à usage unique pour la réponse, lié à la société et au devis ;
//  - un devis modifié après envoi révoque le lien ; un nouvel envoi révoque l'ancien ;
//  - chaque action automatique est écrite dans l'historique : « Automatique — raison » ; aucune suppression automatique ;
//  - réglable par société (relances et expiration), sans réponse tacite : un silence n'est jamais une acceptation.
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { APP_URL, sendDevisClientLinkEmail } from './emailService.js';
import { notifier, ajouterHistorique } from './technicianAutomation.js';
import { parsePhotosJson } from '../lib/terrainPhotos.js';
import { chargerIdentiteDocument } from './pdfContext.js';
import { genererPdfVisiteTechnique } from './visiteTechniquePdf.js';
import { genererPdfDevis, type ContenuDevisPdf } from './devisPdf.js';
import type { PhotoPdf } from './pdfLayout.js';
import { choisirPhotos, photosTransmissibles, type PhotoTransmissible } from '../domain/rapportClient.js';
import {
  DUREE_LIEN_JOURS,
  comptesRendusVisiteDevis,
  jourDevisIso,
  normaliserVisiteRapport,
  parseVisiteRapportInterne,
  adressesDepuisFiche,
  choisirDestinataires,
  fabriquerJeton,
  genererSel,
  idDuJeton,
  prochaineActionDevis,
  statutApresReponse,
  trouverFiche,
  validerReponseClient,
  verifierJeton,
  type AdresseClient,
  type LienIdentite,
  type ReponseClient,
} from '../domain/devisClient.js';

const db = prisma as any;
/** Point d'injection de l'envoi d'e-mail (remplacé dans les tests). */
export const courrier = { envoyerLien: sendDevisClientLinkEmail };
const JOUR_MS = 24 * 60 * 60 * 1000;

type Destinataire = { id: number; name: string | null; email: string; role: string; technicienNom: string | null };

const secretLiens = () => `${config.jwtSecret}:devis-lien`;
const identite = (l: any): LienIdentite => ({ id: l.id, companyId: l.companyId, devisId: l.devisId, sel: l.sel });

export function referenceDevis(d: { id: number; referenceMetier?: string | null }): string {
  return d.referenceMetier || `DEV-${String(d.id).padStart(3, '0')}`;
}

export function urlLien(lien: any): string {
  return `${APP_URL}/devis-client/${fabriquerJeton(secretLiens(), identite(lien))}`;
}

// ---------------------------------------------------------------------------
// Fiche client et adresses
// ---------------------------------------------------------------------------

export async function adressesPourDevis(companyId: number, nomClient: string | null | undefined): Promise<{ ficheTrouvee: boolean; adresses: AdresseClient[] }> {
  let fiches: any[] = [];
  try {
    const ref = await db.referentiel.findFirst({ where: { companyId, categorie: 'clients_fiches' } });
    const parsed = ref?.valeurs ? JSON.parse(ref.valeurs) : [];
    if (Array.isArray(parsed)) fiches = parsed;
  } catch {
    fiches = [];
  }
  const fiche = trouverFiche(fiches, nomClient);
  return { ficheTrouvee: Boolean(fiche), adresses: adressesDepuisFiche(fiche) };
}

// ---------------------------------------------------------------------------
// Liens
// ---------------------------------------------------------------------------

export type EtatLien = 'actif' | 'repondu' | 'revoque' | 'expire';

export function etatLien(l: any, maintenant: Date = new Date()): EtatLien {
  if (l.reponse) return 'repondu';
  if (l.revoqueLe) return 'revoque';
  if (new Date(l.expireLe).getTime() <= maintenant.getTime()) return 'expire';
  return 'actif';
}

export async function liensDuDevis(companyId: number, devisId: number): Promise<any[]> {
  const liens: any[] = await db.devisLienClient.findMany({ where: { companyId, devisId } });
  return liens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

const estAutoGenere = (deposePar: unknown): boolean => String(deposePar || '').startsWith('AUTO:');

export async function dernierDocument(
  companyId: number,
  devisId: number,
  origine?: 'GENERE' | 'DEPOSE'
): Promise<{ id: number; nomFichier: string; taille: number; createdAt: Date; deposePar: string | null } | null> {
  const docs: any[] = await db.devisDocument.findMany({
    where: { companyId, devisId },
    select: { id: true, nomFichier: true, taille: true, createdAt: true, deposePar: true },
  });
  const filtres =
    origine === 'GENERE'
      ? docs.filter((d) => estAutoGenere(d.deposePar))
      : origine === 'DEPOSE'
      ? docs.filter((d) => !estAutoGenere(d.deposePar))
      : docs;
  filtres.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id);
  const doc = filtres[0] || null;
  if (!doc) return null;
  return {
    ...doc,
    deposePar: estAutoGenere(doc.deposePar) ? String(doc.deposePar).slice(5) || null : doc.deposePar,
  };
}

export function visitePhotosDisponibles(devis: any): PhotoTransmissible[] {
  return photosTransmissibles(parsePhotosJson(devis.visitePhotosJson));
}

export function octetsPhotoDevis(devis: any, photoId: string): { octets: Buffer; type: string } | null {
  const p = parsePhotosJson(devis.visitePhotosJson).find((x: any) => x?.id === photoId);
  const m = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(p?.url || ''));
  if (!m) return null;
  const t = m[1].toLowerCase();
  return { octets: Buffer.from(m[2].replace(/\s/g, ''), 'base64'), type: t === 'jpg' ? 'jpeg' : t };
}

export { comptesRendusVisiteDevis, normaliserVisiteRapport, parseVisiteRapportInterne };

export async function fabriquerPdfDevisDoc(
  companyId: number,
  devis: any,
  opts?: { inclureVisite?: boolean; photos?: { toutes?: unknown; ids?: unknown } }
): Promise<Buffer> {
  const identiteDoc = await chargerIdentiteDocument(companyId, devis?.client);
  const inclureVisite = opts?.inclureVisite !== false;
  const dispo = visitePhotosDisponibles(devis);
  let photosChoisies: PhotoTransmissible[] = [];
  if (inclureVisite && dispo.length > 0) {
    const demande =
      opts?.photos && (opts.photos.toutes !== undefined || opts.photos.ids !== undefined)
        ? opts.photos
        : { toutes: true };
    const choix = choisirPhotos(dispo, demande);
    if (!choix.ok) throw new AppError(422, choix.message, 'PHOTO_INCONNUE');
    photosChoisies = dispo.filter((x) => choix.ids.includes(x.id));
  }
  const photosPdf: PhotoPdf[] = [];
  for (const ph of photosChoisies) {
    const o = octetsPhotoDevis(devis, ph.id);
    if (o) photosPdf.push({ id: ph.id, caption: ph.caption, category: ph.category, octets: o.octets, type: o.type });
  }
  const montantHt = devis.montantHt != null ? Number(devis.montantHt) : devis.amount != null ? Number(devis.amount) : null;
  const taux = devis.tauxTVA != null ? Number(devis.tauxTVA) : null;
  const comptesRendus = comptesRendusVisiteDevis(devis);
  const contenu: ContenuDevisPdf = {
    reference: referenceDevis(devis),
    numeroDI: devis.numeroDI || null,
    client: devis.client || null,
    site: devis.siteAdresse || null,
    objet: devis.objet || null,
    corpsEtat: devis.corpsEtat || null,
    responsable: devis.responsable || null,
    statutCommercial: devis.statutCommercial || null,
    dateEmission: jourDevisIso(devis.dateEnvoi || devis.dateCreated),
    echeance: jourDevisIso(devis.echeance || devis.dateLimite),
    validiteJours: devis.validiteJours ?? 30,
    montantHt,
    tauxTVA: taux,
    montantTtc: montantHt != null && taux != null ? Math.round(montantHt * (1 + taux / 100) * 100) / 100 : null,
    notes: devis.notes || devis.commentaires || null,
    visite: inclureVisite
      ? {
          technicien: devis.visiteTechnicien || null,
          dateVisite: jourDevisIso(devis.visiteDate),
          statut: devis.visiteStatut || null,
          comptesRendus,
        }
      : null,
  };
  return genererPdfDevis({
    societe: identiteDoc.societe.nom,
    societeInfo: identiteDoc.societe,
    clientInfo: identiteDoc.client,
    contenu,
    photos: photosPdf,
  });
}

/** PDF interne de Visite Technique Préalable (constat, travaux à chiffrer, matériel, contraintes, photos). */
export async function fabriquerPdfVisiteTechnique(
  companyId: number,
  devis: any,
  opts?: { photos?: { toutes?: unknown; ids?: unknown } }
): Promise<Buffer> {
  const identiteDoc = await chargerIdentiteDocument(companyId, devis?.client);
  const dispo = visitePhotosDisponibles(devis);
  let photosChoisies: PhotoTransmissible[] = [];
  if (dispo.length > 0) {
    const demande =
      opts?.photos && (opts.photos.toutes !== undefined || opts.photos.ids !== undefined)
        ? opts.photos
        : { toutes: true };
    const choix = choisirPhotos(dispo, demande);
    if (!choix.ok) throw new AppError(422, choix.message, 'PHOTO_INCONNUE');
    photosChoisies = dispo.filter((x) => choix.ids.includes(x.id));
  }
  const photosPdf: PhotoPdf[] = [];
  for (const ph of photosChoisies) {
    const o = octetsPhotoDevis(devis, ph.id);
    if (o) photosPdf.push({ id: ph.id, caption: ph.caption, category: ph.category, octets: o.octets, type: o.type });
  }
  const rapport = parseVisiteRapportInterne(devis) || {};
  return genererPdfVisiteTechnique({
    societe: identiteDoc.societe.nom,
    societeInfo: identiteDoc.societe,
    clientInfo: identiteDoc.client,
    contenu: {
      reference: referenceDevis(devis),
      numeroDI: devis.numeroDI || null,
      client: devis.client || null,
      site: devis.siteAdresse || null,
      objet: devis.objet || null,
      corpsEtat: devis.corpsEtat || null,
      responsable: devis.responsable || null,
      technicien: devis.visiteTechnicien || null,
      dateVisite: jourDevisIso(devis.visiteDate),
      heureDebut: devis.visiteHeureDebut || null,
      heureFin: devis.visiteHeureFin || null,
      statutVisite: devis.visiteStatut || null,
      rapport,
      comptesRendusTerrain: comptesRendusVisiteDevis(devis),
    },
    photos: photosPdf,
  });
}

export async function revoquerLiensActifs(companyId: number, devisId: number, raison: string): Promise<number> {
  const res = await db.devisLienClient.updateMany({
    where: { companyId, devisId, reponse: null, revoqueLe: null },
    data: { revoqueLe: new Date(), revoqueRaison: raison },
  });
  return res.count || 0;
}

/** Retrouve le lien d'un jeton (signature vérifiée) ; null si invalide. Jamais d'indice sur la raison. */
export async function lienParJeton(jeton: unknown): Promise<any | null> {
  const id = idDuJeton(jeton);
  if (!id) return null;
  const lien = await db.devisLienClient.findUnique({ where: { id } });
  if (!lien) return null;
  return verifierJeton(secretLiens(), jeton, identite(lien)) ? lien : null;
}

// ---------------------------------------------------------------------------
// Destinataires internes
// ---------------------------------------------------------------------------

export async function comptesParRoles(companyId: number, roles: string[], inclure?: number[]): Promise<Destinataire[]> {
  const users: Destinataire[] = await db.user.findMany({
    where: { companyId, active: true, role: { in: roles } },
    select: { id: true, name: true, email: true, role: true, technicienNom: true },
  });
  if (inclure?.length) {
    for (const id of inclure) {
      if (users.some((u) => u.id === id)) continue;
      const u = await db.user.findFirst({
        where: { id, companyId, active: true },
        select: { id: true, name: true, email: true, role: true, technicienNom: true },
      });
      if (u && u.role !== 'TECHNICIEN') users.push(u);
    }
  }
  return users;
}

// ---------------------------------------------------------------------------
// Envoi au client (geste humain)
// ---------------------------------------------------------------------------

export async function envoyerAuClient(p: {
  companyId: number;
  devis: any;
  source?: 'GENERE' | 'DEPOSE';
  inclureVisite?: boolean;
  photos?: { toutes?: unknown; ids?: unknown };
  adresseChoisies: unknown;
  auteur: string;
  replyTo?: string;
}): Promise<{ lien: any; envoyes: string[]; echecs: string[] }> {
  const { companyId, devis } = p;
  const source: 'GENERE' | 'DEPOSE' = p.source === 'DEPOSE' ? 'DEPOSE' : 'GENERE';
  const { adresses } = await adressesPourDevis(companyId, devis.client);
  const choix = choisirDestinataires(adresses, p.adresseChoisies);
  if (!choix.ok) throw new AppError(422, choix.message, choix.code);

  const ref = referenceDevis(devis);
  let doc: { id: number } | null;
  if (source === 'DEPOSE') {
    doc = await dernierDocument(companyId, devis.id, 'DEPOSE');
    if (!doc) {
      throw new AppError(422, "Déposez d'abord le devis (PDF), ou laissez l'application générer le PDF automatiquement.", 'DOCUMENT_REQUIS');
    }
  } else {
    const pdf = await fabriquerPdfDevisDoc(companyId, devis, {
      inclureVisite: p.inclureVisite,
      photos: p.photos,
    });
    const crypto = await import('node:crypto');
    doc = await db.devisDocument.create({
      data: {
        companyId,
        devisId: devis.id,
        nomFichier: `devis-${ref}.pdf`,
        taille: pdf.length,
        sha256: crypto.createHash('sha256').update(pdf).digest('hex'),
        contenu: pdf,
        deposePar: `AUTO:${p.auteur}`,
      },
      select: { id: true },
    });
  }

  const maintenant = new Date();
  await revoquerLiensActifs(companyId, devis.id, 'Nouvel envoi');
  const lien = await db.devisLienClient.create({
    data: {
      companyId,
      devisId: devis.id,
      documentId: doc!.id,
      sel: genererSel(),
      destinataires: JSON.stringify(choix.emails),
      expireLe: new Date(maintenant.getTime() + DUREE_LIEN_JOURS * JOUR_MS),
      creePar: p.auteur,
    },
  });

  const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true } });
  const lienUrl = urlLien(lien);
  const envoyes: string[] = [];
  const echecs: string[] = [];
  for (const to of choix.emails) {
    try {
      const r = await courrier.envoyerLien({
        companyId,
        companyName: company?.name || 'Votre prestataire',
        toEmail: to,
        replyTo: p.replyTo,
        devis: { reference: referenceDevis(devis), client: devis.client, objet: devis.objet, siteAdresse: devis.siteAdresse },
        lien: lienUrl,
        expireLe: lien.expireLe,
      });
      (r.sent ? envoyes : echecs).push(to);
    } catch {
      echecs.push(to);
    }
  }
  if (envoyes.length === 0) {
    await db.devisLienClient.update({ where: { id: lien.id }, data: { revoqueLe: new Date(), revoqueRaison: "Envoi impossible" } });
    throw new AppError(502, "L'e-mail n'a pas pu être envoyé. Vérifiez la boîte d'envoi de la société puis réessayez.", 'EMAIL_ERROR');
  }

  const dateRelanceAuto = new Date(maintenant.getTime() + 3 * JOUR_MS);
  const validiteMs = (devis.validiteJours || 30) * JOUR_MS;
  const echeanceAuto = new Date(maintenant.getTime() + validiteMs);
  const echeanceCreationDefaut = devis.dateCreated ? new Date(new Date(devis.dateCreated).getTime() + 7 * JOUR_MS) : null;
  const etaitEcheanceDefaut =
    !!devis.echeance &&
    !!echeanceCreationDefaut &&
    Math.abs(new Date(devis.echeance).getTime() - echeanceCreationDefaut.getTime()) < 3 * 3600_000;
  const prochaineEcheance = !devis.echeance || etaitEcheanceDefaut ? echeanceAuto : devis.echeance;
  await db.devis.update({
    where: { id: devis.id },
    data: {
      statutCommercial: 'Envoyé au client',
      traitement: 'En attente client',
      dateEnvoi: maintenant,
      envoiClientLe: maintenant,
      dateRelance: dateRelanceAuto,
      echeance: prochaineEcheance,
      dateLimite: devis.dateLimite && !etaitEcheanceDefaut ? devis.dateLimite : prochaineEcheance,
      relanceClientJ3Le: null,
      relanceClientJ7Le: null,
      prochaineAction: 'Attendre la réponse du client',
      historiqueJson: ajouterHistorique(
        devis.historiqueJson,
        p.auteur,
        'Devis envoyé au client par lien sécurisé',
        `Destinataire(s) : ${envoyes.join(', ')} • valable ${DUREE_LIEN_JOURS} jours` + (echecs.length ? ` • échec : ${echecs.join(', ')}` : '')
      ),
    },
  });
  return { lien, envoyes, echecs };
}

// ---------------------------------------------------------------------------
// Réponse du client (page publique)
// ---------------------------------------------------------------------------

const REPONSE_LIBELLE: Record<ReponseClient, string> = {
  ACCEPTEE: 'Devis accepté par le client',
  REFUSEE: 'Devis refusé par le client',
  MODIFICATION: 'Le client demande une modification du devis',
};

export async function enregistrerReponseClient(jeton: string, body: unknown): Promise<{ statutCommercial: string }> {
  const lien = await lienParJeton(jeton);
  if (!lien || etatLien(lien) !== 'actif') {
    throw new AppError(404, 'Lien invalide, expiré ou déjà utilisé', 'LIEN_INVALIDE');
  }
  const v = validerReponseClient(body);
  if (!v.ok) throw new AppError(400, v.message, 'INVALID_PAYLOAD');
  const { reponse, motif, nom } = v.value;

  // Usage unique : la mise à jour ne réussit que si le lien est encore actif à cet instant précis
  const maintenant = new Date();
  const pris = await db.devisLienClient.updateMany({
    where: { id: lien.id, reponse: null, revoqueLe: null, expireLe: { gt: maintenant } },
    data: { reponse, motif: motif || null, repondantNom: nom, reponduLe: maintenant },
  });
  if (!pris.count) throw new AppError(409, 'Une réponse a déjà été enregistrée pour ce devis.', 'DEJA_REPONDU');

  const devis = await db.devis.findFirst({ where: { id: lien.devisId, companyId: lien.companyId } });
  if (!devis) throw new AppError(404, 'Lien invalide, expiré ou déjà utilisé', 'LIEN_INVALIDE');
  const statutCommercial = statutApresReponse(reponse);
  const ref = referenceDevis(devis);
  const details = `${nom}${motif ? ` — « ${motif} »` : ''}`;

  await db.devis.update({
    where: { id: devis.id },
    data: {
      statutCommercial,
      dateRelance: null,
      prochaineAction: reponse === 'ACCEPTEE' ? 'Planifier les travaux' : reponse === 'MODIFICATION' ? 'Modifier le devis et le renvoyer' : null,
      historiqueJson: ajouterHistorique(devis.historiqueJson, `Client (${nom})`, REPONSE_LIBELLE[reponse], details),
    },
  });

  const companyId = lien.companyId as number;
  if (reponse === 'ACCEPTEE') {
    // Le planificateur est prévenu : « à transformer en intervention ». Rien n'est créé automatiquement.
    const dest = await comptesParRoles(companyId, ['ADMIN', 'CONDUCTEUR_TRAVAUX', 'CHIFFRAGE_DEVIS'], [devis.userId]);
    await notifier(companyId, dest, {
      type: 'DEVIS_ACCEPTE',
      titre: 'Devis accepté par le client',
      message: `${devis.client} a accepté le devis ${ref} (${nom}). À transformer en intervention.`,
      devisId: devis.id,
    });
  } else {
    const dest = await comptesParRoles(companyId, ['ADMIN', 'CHIFFRAGE_DEVIS'], [devis.userId]);
    await notifier(companyId, dest, {
      type: reponse === 'REFUSEE' ? 'DEVIS_REFUSE' : 'DEVIS_MODIFICATION',
      titre: reponse === 'REFUSEE' ? 'Devis refusé par le client' : 'Modification de devis demandée',
      message: `${devis.client} — devis ${ref} : ${reponse === 'REFUSEE' ? 'refus' : 'modification demandée'} (${nom}) — « ${motif} ».`,
      devisId: devis.id,
    });
  }
  return { statutCommercial };
}

// ---------------------------------------------------------------------------
// Passe périodique : relances J+3 / J+7 et expiration
// ---------------------------------------------------------------------------

let enCours = false;

export async function executerAutomatisationsDevis(maintenant: Date = new Date()): Promise<{ relances: number; expires: number }> {
  if (enCours) return { relances: 0, expires: 0 };
  enCours = true;
  const bilan = { relances: 0, expires: 0 };
  try {
    const devisEnvoyes: any[] = await db.devis.findMany({
      where: {
        statutCommercial: 'Envoyé au client',
        companyId: { not: null },
        envoiClientLe: { not: null },
        company: { is: { active: true, autoDevisActif: true } },
      },
      take: 500,
    });

    for (const d of devisEnvoyes) {
      const companyId = d.companyId as number;
      const liens = await liensDuDevis(companyId, d.id);
      const lien = liens[0];
      if (!lien) continue;
      const action = prochaineActionDevis({
        statut: d.statutCommercial,
        envoiLe: d.envoiClientLe,
        expireLe: lien.expireLe,
        reponduOuRevoque: Boolean(lien.reponse || lien.revoqueLe),
        relanceJ3Le: d.relanceClientJ3Le,
        relanceJ7Le: d.relanceClientJ7Le,
        maintenant,
      });
      if (action === 'aucune') continue;
      const ref = referenceDevis(d);

      if (action === 'expirer') {
        const ok = await db.devisLienClient.updateMany({
          where: { id: lien.id, reponse: null, revoqueLe: null },
          data: { revoqueLe: maintenant, revoqueRaison: 'Expiré' },
        });
        if (!ok.count) continue;
        await db.devis.update({
          where: { id: d.id },
          data: {
            statutCommercial: 'Expiré',
            prochaineAction: 'Relancer le client par téléphone ou renvoyer le devis',
            historiqueJson: ajouterHistorique(d.historiqueJson, 'Automatique', 'Automatique — devis expiré', `Sans réponse du client ${DUREE_LIEN_JOURS} jours après l'envoi`),
          },
        });
        const dest = await comptesParRoles(companyId, ['ADMIN', 'CHIFFRAGE_DEVIS'], [d.userId]);
        await notifier(companyId, dest, {
          type: 'DEVIS_EXPIRE',
          titre: 'Devis expiré sans réponse',
          message: `Le devis ${ref} (${d.client}) est resté ${DUREE_LIEN_JOURS} jours sans réponse : il est passé à « Expiré ».`,
          devisId: d.id,
        });
        bilan.expires++;
        continue;
      }

      // Relance J+3 / J+7 : mêmes destinataires, même lien
      let emails: string[] = [];
      try {
        const parsed = JSON.parse(lien.destinataires || '[]');
        if (Array.isArray(parsed)) emails = parsed.map(String);
      } catch {
        emails = [];
      }
      if (emails.length === 0) continue;
      const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true } });
      const relance = action === 'relancer_j3' ? 'J3' : 'J7';
      let envoyes = 0;
      for (const to of emails) {
        try {
          const r = await courrier.envoyerLien({
            companyId,
            companyName: company?.name || 'Votre prestataire',
            toEmail: to,
            devis: { reference: ref, client: d.client, objet: d.objet, siteAdresse: d.siteAdresse },
            lien: urlLien(lien),
            expireLe: new Date(lien.expireLe),
            relance,
          });
          if (r.sent) envoyes++;
        } catch {
          /* on réessaie à la prochaine passe si aucune adresse n'a reçu le message */
        }
      }
      if (envoyes === 0) continue;
      const verrou = action === 'relancer_j3' ? { relanceClientJ3Le: maintenant } : { relanceClientJ7Le: maintenant, relanceClientJ3Le: d.relanceClientJ3Le || maintenant };
      await db.devis.update({
        where: { id: d.id },
        data: {
          ...verrou,
          historiqueJson: ajouterHistorique(
            d.historiqueJson,
            'Automatique',
            `Automatique — relance ${action === 'relancer_j3' ? 'J+3' : 'J+7'} envoyée au client`,
            `Sans réponse depuis l'envoi • ${emails.join(', ')}`
          ),
        },
      });
      bilan.relances++;
    }
  } finally {
    enCours = false;
  }
  return bilan;
}

/** Démarre la passe périodique (toutes les 10 minutes : les échéances se comptent en jours). Jamais lancée pendant les tests. */
export function demarrerPlanificateurDevis(): void {
  const timer = setInterval(() => {
    executerAutomatisationsDevis().catch((e) => console.error('⚠ Automatisation devis client :', e?.message || e));
  }, 10 * 60 * 1000);
  timer.unref?.();
  console.log('⏱ Automatisation devis client : passe toutes les 10 minutes');
}
