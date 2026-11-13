// Page PUBLIQUE du devis client (sans compte) : consultation, PDF, réponse.
// Le jeton signé identifie le lien ; il est limité dans le temps, à usage unique pour la réponse,
// et lié à une société et à un devis. Aucune information n'est donnée sur la raison d'un refus d'accès.
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { enregistrerReponseClient, etatLien, lienParJeton, referenceDevis } from '../services/devisClient.js';

export const devisClientPublicRouter = Router();
const db = prisma as any;

// Jamais mis en cache, jamais indexé, jamais de référent transmis
devisClientPublicRouter.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

export const limiteurDevisClient = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Trop de tentatives, réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const LIEN_INVALIDE = new AppError(404, 'Lien invalide, expiré ou déjà utilisé', 'LIEN_INVALIDE');

devisClientPublicRouter.get(
  '/:jeton',
  asyncHandler(async (req: Request, res: Response) => {
    const lien = await lienParJeton(req.params.jeton);
    if (!lien) throw LIEN_INVALIDE;
    const etat = etatLien(lien);
    // Un lien révoqué (devis modifié, renvoi) ou périmé n'ouvre plus rien
    if (etat === 'revoque' || etat === 'expire') throw LIEN_INVALIDE;
    const devis = await db.devis.findFirst({ where: { id: lien.devisId, companyId: lien.companyId } });
    const company = await db.company.findUnique({ where: { id: lien.companyId }, select: { name: true, active: true } });
    if (!devis || !company || company.active === false) throw LIEN_INVALIDE;
    await db.devisLienClient.update({ where: { id: lien.id }, data: { dernierAccesLe: new Date() } }).catch(() => undefined);

    const doc = lien.documentId
      ? await db.devisDocument.findFirst({
          where: { id: lien.documentId, companyId: lien.companyId, devisId: lien.devisId },
          select: { nomFichier: true, taille: true },
        })
      : null;
    const montantHt = devis.montantHt != null ? Number(devis.montantHt) : devis.amount != null ? Number(devis.amount) : null;
    const taux = devis.tauxTVA != null ? Number(devis.tauxTVA) : null;
    res.json({
      data: {
        etat, // 'actif' | 'repondu'
        societe: company.name,
        reference: referenceDevis(devis),
        client: devis.client,
        objet: devis.objet || null,
        site: devis.siteAdresse || null,
        corpsEtat: devis.corpsEtat || null,
        montantHt,
        tauxTVA: taux,
        montantTtc: montantHt != null && taux != null ? Math.round(montantHt * (1 + taux / 100) * 100) / 100 : null,
        expireLe: lien.expireLe,
        document: doc ? { nomFichier: doc.nomFichier, taille: doc.taille } : null,
        reponse: lien.reponse || null,
        reponduLe: lien.reponduLe || null,
      },
    });
  })
);

devisClientPublicRouter.get(
  '/:jeton/document',
  asyncHandler(async (req: Request, res: Response) => {
    const lien = await lienParJeton(req.params.jeton);
    if (!lien || !lien.documentId) throw LIEN_INVALIDE;
    const etat = etatLien(lien);
    if (etat === 'revoque' || etat === 'expire') throw LIEN_INVALIDE;
    const doc = await db.devisDocument.findFirst({ where: { id: lien.documentId, companyId: lien.companyId, devisId: lien.devisId } });
    if (!doc) throw LIEN_INVALIDE;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nomFichier)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(doc.contenu));
  })
);

devisClientPublicRouter.post(
  '/:jeton/reponse',
  asyncHandler(async (req: Request, res: Response) => {
    const r = await enregistrerReponseClient(req.params.jeton, req.body);
    res.json({ ok: true, message: 'Merci, votre réponse a bien été transmise.', statut: r.statutCommercial });
  })
);
