// Page PUBLIQUE du rapport d'intervention (sans compte) : consultation, PDF, photos, réponse (valider ou réserves).
// Le jeton signé identifie le lien ; il est limité dans le temps, à usage unique pour la réponse,
// et lié à une société et à une intervention. Aucune information n'est donnée sur la raison d'un refus d'accès.
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  contenuDuLien,
  enregistrerReponseRapport,
  etatLien,
  lienRapportParJeton,
  photoPourClient,
} from '../services/rapportClient.js';

export const rapportClientPublicRouter = Router();
const db = prisma as any;

// Jamais mis en cache, jamais indexé, jamais de référent transmis
rapportClientPublicRouter.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

export const limiteurRapportClient = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: 'Trop de tentatives, réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const LIEN_INVALIDE = new AppError(404, 'Lien invalide, expiré ou déjà utilisé', 'LIEN_INVALIDE');

/** Un lien révoqué (rapport modifié, renvoi) ou périmé n'ouvre plus rien. */
async function lienOuvert(jeton: string) {
  const lien = await lienRapportParJeton(jeton);
  if (!lien) throw LIEN_INVALIDE;
  const etat = etatLien(lien);
  if (etat === 'revoque' || etat === 'expire') throw LIEN_INVALIDE;
  const company = await db.company.findUnique({ where: { id: lien.companyId }, select: { name: true, active: true } });
  if (!company || company.active === false) throw LIEN_INVALIDE;
  return { lien, etat, company };
}

rapportClientPublicRouter.get(
  '/:jeton',
  asyncHandler(async (req: Request, res: Response) => {
    const { lien, etat, company } = await lienOuvert(req.params.jeton);
    const contenu = contenuDuLien(lien);
    if (!contenu) throw LIEN_INVALIDE;
    await db.rapportLienClient.update({ where: { id: lien.id }, data: { dernierAccesLe: new Date() } }).catch(() => undefined);

    const doc = lien.documentId
      ? await db.rapportDocument.findFirst({
          where: { id: lien.documentId, companyId: lien.companyId, interventionId: lien.interventionId },
          select: { nomFichier: true, taille: true },
        })
      : null;
    res.json({
      data: {
        etat, // 'actif' | 'repondu'
        societe: company.name,
        contenu,
        expireLe: lien.expireLe,
        document: doc ? { nomFichier: doc.nomFichier, taille: doc.taille } : null,
        reponse: lien.reponse || null,
        reponduLe: lien.reponduLe || null,
      },
    });
  })
);

rapportClientPublicRouter.get(
  '/:jeton/document',
  asyncHandler(async (req: Request, res: Response) => {
    const { lien } = await lienOuvert(req.params.jeton);
    if (!lien.documentId) throw LIEN_INVALIDE;
    const doc = await db.rapportDocument.findFirst({
      where: { id: lien.documentId, companyId: lien.companyId, interventionId: lien.interventionId },
    });
    if (!doc) throw LIEN_INVALIDE;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nomFichier)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(doc.contenu));
  })
);

rapportClientPublicRouter.get(
  '/:jeton/photos/:photoId',
  asyncHandler(async (req: Request, res: Response) => {
    const { lien } = await lienOuvert(req.params.jeton);
    const photo = await photoPourClient(lien, String(req.params.photoId || ''));
    if (!photo) throw LIEN_INVALIDE;
    res.setHeader('Content-Type', `image/${photo.type}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(photo.octets);
  })
);

rapportClientPublicRouter.post(
  '/:jeton/reponse',
  asyncHandler(async (req: Request, res: Response) => {
    const r = await enregistrerReponseRapport(req.params.jeton, req.body);
    res.json({ ok: true, message: 'Merci, votre réponse a bien été transmise.', statut: r.statutRapport });
  })
);
