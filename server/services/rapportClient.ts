// Automatisation C — rapport d'intervention client : envoi par lien sécurisé, validation ou réserves du client,
// relances J+3 / J+7, expiration à 30 jours.
//
// Garde-fous (validés avec Zee) :
//  - le rapport doit d'abord être VALIDÉ EN INTERNE ; l'ENVOI au client est toujours un geste humain ;
//  - l'adresse vient de la fiche client ; plusieurs adresses → l'utilisateur confirme laquelle ;
//  - lien limité dans le temps (30 jours), à usage unique pour la réponse, lié à la société et à l'intervention ;
//  - AUCUNE validation tacite : sans réponse, le rapport reste « Envoyé au client » (relances, puis alerte à l'expiration) ;
//  - rapport modifié après envoi, nouveau PDF ou nouvel envoi : l'ancien lien est révoqué ;
//  - chaque action automatique est écrite dans l'historique : « Automatique — raison » ; aucune suppression automatique.
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { APP_URL, sendRapportClientLinkEmail } from './emailService.js';
import { notifier, ajouterHistorique } from './technicianAutomation.js';
import { comptesParRoles, etatLien } from './devisClient.js';
import { parsePhotosJson } from '../lib/terrainPhotos.js';
import { chargerIdentiteDocument } from './pdfContext.js';
import { genererPdfRapport, type PhotoPdf } from './rapportPdf.js';
import { adressesDepuisFiche, choisirDestinataires, trouverFiche, type AdresseClient } from '../domain/devisClient.js';
import {
  DUREE_LIEN_JOURS,
  STATUT_ENVOYE,
  choisirPhotos,
  envoiRapportAutorise,
  fabriquerContenu,
  fabriquerJetonRapport,
  genererSel,
  idDuJeton,
  photosTransmissibles,
  prochaineActionRapport,
  referenceRapport,
  statutApresReponseRapport,
  validerReponseRapport,
  verifierJetonRapport,
  type ContenuRapport,
  type LienRapportIdentite,
  type PhotoTransmissible,
  type ReponseRapport,
} from '../domain/rapportClient.js';

const db = prisma as any;
/** Point d'injection de l'envoi d'e-mail (remplacé dans les tests). */
export const courrier = { envoyerLien: sendRapportClientLinkEmail };
const JOUR_MS = 24 * 60 * 60 * 1000;

const secretLiens = () => `${config.jwtSecret}:rapport-lien`;
const identite = (l: any): LienRapportIdentite => ({ id: l.id, companyId: l.companyId, interventionId: l.interventionId, sel: l.sel });

export function urlLienRapport(lien: any): string {
  return `${APP_URL}/rapport-client/${fabriquerJetonRapport(secretLiens(), identite(lien))}`;
}

export { etatLien };

// ---------------------------------------------------------------------------
// Fiche client et adresses
// ---------------------------------------------------------------------------

export async function adressesPourRapport(companyId: number, nomClient: string | null | undefined): Promise<{ ficheTrouvee: boolean; adresses: AdresseClient[] }> {
  let fiches: any[] = [];
  try {
    const ref = await db.referentiel.findFirst({ where: { companyId, categorie: 'clients_fiches' } });
    const parsed = ref?.valeurs ? JSON.parse(ref.valeurs) : [];
    if (Array.isArray(parsed)) fiches = parsed;
  } catch {
    fiches = [];
  }
  const fiche = trouverFiche(fiches, nomClient);
  return { ficheTrouvee: Boolean(fiche), adresses: adressesDepuisFiche(fiche, 'recevoirRapports') };
}

// ---------------------------------------------------------------------------
// Photos, documents, liens
// ---------------------------------------------------------------------------

export function photosDisponibles(intervention: any): PhotoTransmissible[] {
  return photosTransmissibles(parsePhotosJson(intervention.photosJson));
}

/** Octets d'une photo de l'intervention (data:image/…;base64,…), ou null. */
export function octetsPhoto(intervention: any, photoId: string): { octets: Buffer; type: string } | null {
  const p = parsePhotosJson(intervention.photosJson).find((x: any) => x?.id === photoId);
  const m = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(p?.url || ''));
  if (!m) return null;
  const t = m[1].toLowerCase();
  return { octets: Buffer.from(m[2].replace(/\s/g, ''), 'base64'), type: t === 'jpg' ? 'jpeg' : t };
}

function actionsDe(intervention: any): string[] {
  try {
    const a = JSON.parse(intervention.actionsRealiseesJson || '[]');
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}

export function contenuPourClient(intervention: any, photosChoisies: PhotoTransmissible[]): ContenuRapport {
  return fabriquerContenu(intervention, referenceRapport(intervention), actionsDe(intervention), photosChoisies);
}

export async function liensDuRapport(companyId: number, interventionId: number): Promise<any[]> {
  const liens: any[] = await db.rapportLienClient.findMany({ where: { companyId, interventionId } });
  return liens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id);
}

export async function dernierDocumentRapport(companyId: number, interventionId: number, origine?: 'GENERE' | 'DEPOSE') {
  const docs: any[] = await db.rapportDocument.findMany({
    where: { companyId, interventionId, ...(origine ? { origine } : {}) },
    select: { id: true, nomFichier: true, taille: true, origine: true, createdAt: true, deposePar: true },
  });
  docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id);
  return docs[0] || null;
}

export async function revoquerLiensRapportActifs(companyId: number, interventionId: number, raison: string): Promise<number> {
  const res = await db.rapportLienClient.updateMany({
    where: { companyId, interventionId, reponse: null, revoqueLe: null },
    data: { revoqueLe: new Date(), revoqueRaison: raison },
  });
  return res.count || 0;
}

/** Retrouve le lien d'un jeton (signature vérifiée) ; null si invalide. Jamais d'indice sur la raison. */
export async function lienRapportParJeton(jeton: unknown): Promise<any | null> {
  const id = idDuJeton(jeton);
  if (!id) return null;
  const lien = await db.rapportLienClient.findUnique({ where: { id } });
  if (!lien) return null;
  return verifierJetonRapport(secretLiens(), jeton, identite(lien)) ? lien : null;
}

export function contenuDuLien(lien: any): ContenuRapport | null {
  try {
    return JSON.parse(lien.contenuJson) as ContenuRapport;
  } catch {
    return null;
  }
}

/** Photo à montrer au client : uniquement celles figées à l'envoi, lues sur l'intervention de CETTE société. */
export async function photoPourClient(lien: any, photoId: string): Promise<{ octets: Buffer; type: string } | null> {
  const contenu = contenuDuLien(lien);
  if (!contenu || !contenu.photos.some((p) => p.id === photoId)) return null;
  const i = await db.intervention.findFirst({ where: { id: lien.interventionId, companyId: lien.companyId } });
  return i ? octetsPhoto(i, photoId) : null;
}

// ---------------------------------------------------------------------------
// PDF généré
// ---------------------------------------------------------------------------

export async function fabriquerPdf(companyId: number, intervention: any, photosChoisies: PhotoTransmissible[]): Promise<Buffer> {
  const identiteDoc = await chargerIdentiteDocument(companyId, intervention?.client);
  const photos: PhotoPdf[] = [];
  for (const p of photosChoisies) {
    const o = octetsPhoto(intervention, p.id);
    if (o) photos.push({ id: p.id, caption: p.caption, category: p.category, octets: o.octets, type: o.type });
  }
  return genererPdfRapport({
    societe: identiteDoc.societe.nom,
    societeInfo: identiteDoc.societe,
    clientInfo: identiteDoc.client,
    contenu: contenuPourClient(intervention, photosChoisies),
    photos,
  });
}

// ---------------------------------------------------------------------------
// Envoi au client (geste humain)
// ---------------------------------------------------------------------------

export async function envoyerRapportAuClient(p: {
  companyId: number;
  intervention: any;
  source: 'GENERE' | 'DEPOSE';
  photos: { toutes?: unknown; ids?: unknown };
  adresseChoisies: unknown;
  auteur: string;
  replyTo?: string;
}): Promise<{ lien: any; envoyes: string[]; echecs: string[] }> {
  const { companyId, intervention } = p;
  const autorise = envoiRapportAutorise(intervention.statutRapport);
  if (!autorise.ok) throw new AppError(409, autorise.message, autorise.code);

  const dispo = photosDisponibles(intervention);
  const choixPhotos = choisirPhotos(dispo, p.photos);
  if (!choixPhotos.ok) throw new AppError(422, choixPhotos.message, 'PHOTO_INCONNUE');
  const photosChoisies = dispo.filter((x) => choixPhotos.ids.includes(x.id));

  const { adresses } = await adressesPourRapport(companyId, intervention.client);
  const choix = choisirDestinataires(adresses, p.adresseChoisies, 'le rapport');
  if (!choix.ok) throw new AppError(422, choix.message, choix.code);

  const ref = referenceRapport(intervention);
  let doc: { id: number } | null;
  if (p.source === 'DEPOSE') {
    doc = await dernierDocumentRapport(companyId, intervention.id, 'DEPOSE');
    if (!doc) throw new AppError(422, "Déposez d'abord le PDF du rapport, ou choisissez de le générer.", 'DOCUMENT_REQUIS');
  } else {
    const pdf = await fabriquerPdf(companyId, intervention, photosChoisies);
    const crypto = await import('node:crypto');
    doc = await db.rapportDocument.create({
      data: {
        companyId,
        interventionId: intervention.id,
        nomFichier: `rapport-${ref}.pdf`,
        taille: pdf.length,
        sha256: crypto.createHash('sha256').update(pdf).digest('hex'),
        contenu: pdf,
        origine: 'GENERE',
        deposePar: p.auteur,
      },
      select: { id: true },
    });
  }

  const maintenant = new Date();
  await revoquerLiensRapportActifs(companyId, intervention.id, 'Nouvel envoi');
  const lien = await db.rapportLienClient.create({
    data: {
      companyId,
      interventionId: intervention.id,
      documentId: doc!.id,
      sel: genererSel(),
      destinataires: JSON.stringify(choix.emails),
      contenuJson: JSON.stringify(contenuPourClient(intervention, photosChoisies)),
      expireLe: new Date(maintenant.getTime() + DUREE_LIEN_JOURS * JOUR_MS),
      creePar: p.auteur,
    },
  });

  const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true } });
  const lienUrl = urlLienRapport(lien);
  const envoyes: string[] = [];
  const echecs: string[] = [];
  for (const to of choix.emails) {
    try {
      const r = await courrier.envoyerLien({
        companyId,
        companyName: company?.name || 'Votre prestataire',
        toEmail: to,
        replyTo: p.replyTo,
        rapport: { reference: ref, client: intervention.client, chantier: intervention.chantier, siteAdresse: intervention.siteAdresse },
        lien: lienUrl,
        expireLe: lien.expireLe,
      });
      (r.sent ? envoyes : echecs).push(to);
    } catch {
      echecs.push(to);
    }
  }
  if (envoyes.length === 0) {
    await db.rapportLienClient.update({ where: { id: lien.id }, data: { revoqueLe: new Date(), revoqueRaison: 'Envoi impossible' } });
    throw new AppError(502, "L'e-mail n'a pas pu être envoyé. Vérifiez la boîte d'envoi de la société puis réessayez.", 'EMAIL_ERROR');
  }

  await db.intervention.update({
    where: { id: intervention.id },
    data: {
      statutRapport: STATUT_ENVOYE,
      envoiClientLe: maintenant,
      relanceClientJ3Le: null,
      relanceClientJ7Le: null,
      historiqueJson: ajouterHistorique(
        intervention.historiqueJson,
        p.auteur,
        'Rapport envoyé au client par lien sécurisé',
        `Destinataire(s) : ${envoyes.join(', ')} • valable ${DUREE_LIEN_JOURS} jours • ${photosChoisies.length} photo(s)` +
          (echecs.length ? ` • échec : ${echecs.join(', ')}` : '')
      ),
    },
  });
  return { lien, envoyes, echecs };
}

// ---------------------------------------------------------------------------
// Réponse du client (page publique)
// ---------------------------------------------------------------------------

const REPONSE_LIBELLE: Record<ReponseRapport, string> = {
  VALIDE: 'Rapport validé par le client',
  RESERVES: 'Le client émet des réserves sur le rapport',
};

export async function enregistrerReponseRapport(jeton: string, body: unknown): Promise<{ statutRapport: string }> {
  const lien = await lienRapportParJeton(jeton);
  if (!lien || etatLien(lien) !== 'actif') {
    throw new AppError(404, 'Lien invalide, expiré ou déjà utilisé', 'LIEN_INVALIDE');
  }
  const v = validerReponseRapport(body);
  if (!v.ok) throw new AppError(400, v.message, 'INVALID_PAYLOAD');
  const { reponse, motif, nom } = v.value;

  // Usage unique : la mise à jour ne réussit que si le lien est encore actif à cet instant précis
  const maintenant = new Date();
  const pris = await db.rapportLienClient.updateMany({
    where: { id: lien.id, reponse: null, revoqueLe: null, expireLe: { gt: maintenant } },
    data: { reponse, motif: motif || null, repondantNom: nom, reponduLe: maintenant },
  });
  if (!pris.count) throw new AppError(409, 'Une réponse a déjà été enregistrée pour ce rapport.', 'DEJA_REPONDU');

  const intervention = await db.intervention.findFirst({ where: { id: lien.interventionId, companyId: lien.companyId } });
  if (!intervention) throw new AppError(404, 'Lien invalide, expiré ou déjà utilisé', 'LIEN_INVALIDE');
  const statutRapport = statutApresReponseRapport(reponse);
  const ref = referenceRapport(intervention);
  const details = `${nom}${motif ? ` — « ${motif} »` : ''}`;

  await db.intervention.update({
    where: { id: intervention.id },
    data: {
      statutRapport,
      historiqueJson: ajouterHistorique(intervention.historiqueJson, `Client (${nom})`, REPONSE_LIBELLE[reponse], details),
    },
  });

  const companyId = lien.companyId as number;
  const dest = await comptesParRoles(companyId, ['ADMIN', 'CONDUCTEUR_TRAVAUX', 'REDACTEUR_RAPPORTS'], [intervention.userId]);
  if (reponse === 'VALIDE') {
    await notifier(companyId, dest, {
      type: 'RAPPORT_VALIDE',
      titre: 'Rapport validé par le client',
      message: `${intervention.client || 'Le client'} a validé le rapport ${ref} (${nom}). Il peut être facturé.`,
      interventionId: intervention.id,
    });
  } else {
    await notifier(companyId, dest, {
      type: 'RAPPORT_RESERVES',
      titre: 'Réserves du client sur un rapport',
      message: `${intervention.client || 'Le client'} émet des réserves sur le rapport ${ref} (${nom}) — « ${motif} ».`,
      interventionId: intervention.id,
    });
  }
  return { statutRapport };
}

// ---------------------------------------------------------------------------
// Passe périodique : relances J+3 / J+7 et expiration (sans jamais valider à la place du client)
// ---------------------------------------------------------------------------

let enCours = false;

export async function executerAutomatisationsRapport(maintenant: Date = new Date()): Promise<{ relances: number; expires: number }> {
  if (enCours) return { relances: 0, expires: 0 };
  enCours = true;
  const bilan = { relances: 0, expires: 0 };
  try {
    const envoyes: any[] = await db.intervention.findMany({
      where: {
        statutRapport: STATUT_ENVOYE,
        companyId: { not: null },
        envoiClientLe: { not: null },
        company: { is: { active: true, autoRapportActif: true } },
      },
      take: 500,
    });

    for (const it of envoyes) {
      const companyId = it.companyId as number;
      const lien = (await liensDuRapport(companyId, it.id))[0];
      if (!lien) continue;
      const action = prochaineActionRapport({
        statutRapport: it.statutRapport,
        envoiLe: it.envoiClientLe,
        expireLe: lien.expireLe,
        reponduOuRevoque: Boolean(lien.reponse || lien.revoqueLe),
        relanceJ3Le: it.relanceClientJ3Le,
        relanceJ7Le: it.relanceClientJ7Le,
        maintenant,
      });
      if (action === 'aucune') continue;
      const ref = referenceRapport(it);

      if (action === 'expirer') {
        const ok = await db.rapportLienClient.updateMany({
          where: { id: lien.id, reponse: null, revoqueLe: null },
          data: { revoqueLe: maintenant, revoqueRaison: 'Expiré' },
        });
        if (!ok.count) continue;
        // Le statut ne change PAS : sans réponse du client, le rapport n'est jamais considéré comme validé
        await db.intervention.update({
          where: { id: it.id },
          data: {
            historiqueJson: ajouterHistorique(
              it.historiqueJson,
              'Automatique',
              'Automatique — lien du rapport expiré',
              `Sans réponse du client ${DUREE_LIEN_JOURS} jours après l'envoi : le rapport n'est PAS validé`
            ),
          },
        });
        const dest = await comptesParRoles(companyId, ['ADMIN', 'CONDUCTEUR_TRAVAUX', 'REDACTEUR_RAPPORTS'], [it.userId]);
        await notifier(companyId, dest, {
          type: 'RAPPORT_EXPIRE',
          titre: 'Rapport sans réponse du client',
          message: `Le rapport ${ref} (${it.client || 'client'}) est resté ${DUREE_LIEN_JOURS} jours sans réponse : il n'est pas validé. Relancez le client ou renvoyez-le.`,
          interventionId: it.id,
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
      let nbEnvoyes = 0;
      for (const to of emails) {
        try {
          const r = await courrier.envoyerLien({
            companyId,
            companyName: company?.name || 'Votre prestataire',
            toEmail: to,
            rapport: { reference: ref, client: it.client, chantier: it.chantier, siteAdresse: it.siteAdresse },
            lien: urlLienRapport(lien),
            expireLe: new Date(lien.expireLe),
            relance,
          });
          if (r.sent) nbEnvoyes++;
        } catch {
          /* on réessaie à la prochaine passe si aucune adresse n'a reçu le message */
        }
      }
      if (nbEnvoyes === 0) continue;
      const verrou =
        action === 'relancer_j3'
          ? { relanceClientJ3Le: maintenant }
          : { relanceClientJ7Le: maintenant, relanceClientJ3Le: it.relanceClientJ3Le || maintenant };
      await db.intervention.update({
        where: { id: it.id },
        data: {
          ...verrou,
          historiqueJson: ajouterHistorique(
            it.historiqueJson,
            'Automatique',
            `Automatique — relance ${action === 'relancer_j3' ? 'J+3' : 'J+7'} du rapport envoyée au client`,
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
export function demarrerPlanificateurRapport(): void {
  const timer = setInterval(() => {
    executerAutomatisationsRapport().catch((e) => console.error('⚠ Automatisation rapport client :', e?.message || e));
  }, 10 * 60 * 1000);
  timer.unref?.();
  console.log('⏱ Automatisation rapport client : passe toutes les 10 minutes');
}
