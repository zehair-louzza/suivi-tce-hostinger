// Demandes reçues : la demande du donneur d'ordre avant qu'elle devienne devis ou intervention.
//
// Le numéro de DI est émis par le client : la clé de suivi est le couple (client + numeroDI).
// Un particulier n'a pas de DI, il reçoit une référence interne.
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { normalizeDI, syncDevisDossier } from '../lib/dossierDI.js';

export const demandesRouter = Router();

const STATUTS = ['A_DECIDER', 'ORIENTEE', 'ANNULEE'] as const;
const TYPES = ['DONNEUR_ORDRE', 'ENTREPRISE', 'PARTICULIER', 'SOUS_TRAITANT'] as const;
const DECISIONS = ['VISITE', 'DEVIS', 'INTERVENTION'] as const;

type Statut = (typeof STATUTS)[number];
type Decision = (typeof DECISIONS)[number];

const txt = (v: unknown, max = 300): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s.slice(0, max);
};

function parseDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseHistorique(json?: string | null): any[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function addEvent(existingJson: string | null | undefined, auteur: string, action: string, details?: string): string {
  const list = parseHistorique(existingJson);
  list.unshift({ date: new Date().toISOString(), auteur, action, details: details || '' });
  return JSON.stringify(list.slice(0, 60));
}

/** Référence interne des demandes de particuliers : REF-<année>-<id sur 4> */
function referenceInterneFor(id: number, annee: number): string {
  return `REF-${annee}-${String(id).padStart(4, '0')}`;
}

function transform(d: any) {
  return {
    ...d,
    dateReception: d.dateReception ? new Date(d.dateReception).toISOString().slice(0, 10) : null,
    echeanceSouhaitee: d.echeanceSouhaitee ? new Date(d.echeanceSouhaitee).toISOString().slice(0, 10) : null,
    decidedAt: d.decidedAt ? new Date(d.decidedAt).toISOString() : null,
    historique: parseHistorique(d.historiqueJson),
    /** Clé de suivi affichable : jamais le DI seul */
    cleDossier: [d.client, d.numeroDI || d.referenceInterne].filter(Boolean).join(' · '),
    isB2C: d.typeDemandeur === 'PARTICULIER',
    historiqueJson: undefined,
  };
}

const auteurOf = (req: Request) => req.user?.email || 'Utilisateur';

demandesRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user?.companyId || 1;
    const search = (req.query.search as string) || '';
    const statut = (req.query.statut as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 200, 500);

    const where: any = { companyId };
    if (STATUTS.includes(statut as Statut)) where.statut = statut;
    if (search) {
      where.OR = [
        { client: { contains: search, mode: 'insensitive' } },
        { numeroDI: { contains: search, mode: 'insensitive' } },
        { referenceInterne: { contains: search, mode: 'insensitive' } },
        { site: { contains: search, mode: 'insensitive' } },
        { objet: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.demande.findMany({
      where,
      orderBy: [{ statut: 'asc' }, { dateReception: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    res.json({ data: items.map(transform), total: items.length });
  })
);

demandesRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user?.companyId || 1;
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Authentification requise');

    const b = req.body || {};
    const typeDemandeur = TYPES.includes(b.typeDemandeur) ? b.typeDemandeur : 'DONNEUR_ORDRE';
    const client = txt(b.client, 200);
    if (!client) throw new AppError(400, typeDemandeur === 'PARTICULIER' ? 'Le nom du client est requis' : "Le donneur d'ordre est requis");

    const numeroDI = typeDemandeur === 'PARTICULIER' ? null : normalizeDI(b.numeroDI);
    if (typeDemandeur !== 'PARTICULIER' && !numeroDI) {
      throw new AppError(400, "Le numéro de DI du donneur d'ordre est requis");
    }

    const dateReception = parseDateOrNull(b.dateReception) || new Date();

    const created = await prisma.demande.create({
      data: {
        typeDemandeur,
        client,
        numeroDI,
        site: txt(b.site, 250),
        objet: txt(b.objet, 300),
        corpsEtat: txt(b.corpsEtat, 100),
        priorite: txt(b.priorite, 50) || 'Normale',
        canalReception: txt(b.canalReception, 80),
        dateReception,
        echeanceSouhaitee: parseDateOrNull(b.echeanceSouhaitee),
        notes: txt(b.notes, 4000),
        statut: 'A_DECIDER',
        historiqueJson: addEvent(null, auteurOf(req), 'Demande enregistrée', [client, numeroDI].filter(Boolean).join(' · ')),
        userId,
        companyId,
      },
    });

    // Les particuliers n'ont pas de DI : une référence interne tient lieu de clé de suivi
    let finalRow = created;
    if (typeDemandeur === 'PARTICULIER') {
      finalRow = await prisma.demande.update({
        where: { id: created.id },
        data: { referenceInterne: referenceInterneFor(created.id, dateReception.getFullYear()) },
      });
    }

    res.status(201).json({ data: transform(finalRow), message: 'Demande enregistrée' });
  })
);

demandesRouter.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user?.companyId || 1;
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.demande.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError(404, 'Demande introuvable');

    const b = req.body || {};
    const data: any = {};
    if (b.client !== undefined) data.client = txt(b.client, 200) || existing.client;
    if (b.site !== undefined) data.site = txt(b.site, 250);
    if (b.objet !== undefined) data.objet = txt(b.objet, 300);
    if (b.corpsEtat !== undefined) data.corpsEtat = txt(b.corpsEtat, 100);
    if (b.priorite !== undefined) data.priorite = txt(b.priorite, 50) || 'Normale';
    if (b.canalReception !== undefined) data.canalReception = txt(b.canalReception, 80);
    if (b.echeanceSouhaitee !== undefined) data.echeanceSouhaitee = parseDateOrNull(b.echeanceSouhaitee);
    if (b.notes !== undefined) data.notes = txt(b.notes, 4000);
    if (b.numeroDI !== undefined && existing.typeDemandeur !== 'PARTICULIER') {
      const di = normalizeDI(b.numeroDI);
      if (!di) throw new AppError(400, "Le numéro de DI du donneur d'ordre est requis");
      data.numeroDI = di;
    }
    if (b.statut !== undefined) {
      if (!STATUTS.includes(b.statut)) throw new AppError(400, 'Statut inconnu');
      data.statut = b.statut;
      if (b.statut === 'ANNULEE') {
        data.historiqueJson = addEvent(existing.historiqueJson, auteurOf(req), 'Demande annulée', txt(b.motif, 200) || '');
      }
    }

    const updated = await prisma.demande.update({ where: { id }, data });
    res.json({ data: transform(updated) });
  })
);

/**
 * Oriente la demande : elle devient une visite, un devis ou une intervention.
 * Le numéro de DI, le client, le site, le corps d'état et l'objet sont repris tels quels,
 * ce qui garantit que la pièce créée rejoint le bon dossier.
 */
demandesRouter.post(
  '/:id/orienter',
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user?.companyId || 1;
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Authentification requise');

    const id = parseInt(req.params.id, 10);
    const demande = await prisma.demande.findFirst({ where: { id, companyId } });
    if (!demande) throw new AppError(404, 'Demande introuvable');
    if (demande.statut === 'ORIENTEE') throw new AppError(409, 'Cette demande a déjà été orientée');

    const decision = String(req.body?.decision || '').toUpperCase() as Decision;
    if (!DECISIONS.includes(decision)) throw new AppError(400, 'Décision inconnue : VISITE, DEVIS ou INTERVENTION');

    const auteur = auteurOf(req);
    const annee = new Date(demande.dateReception).getFullYear();
    const chantier = demande.site || demande.client;
    let devisId: number | null = null;
    let interventionId: number | null = null;
    let libelle = '';

    if (decision === 'DEVIS') {
      const devis = await prisma.devis.create({
        data: {
          client: demande.client,
          siteAdresse: demande.site,
          objet: demande.objet,
          corpsEtat: demande.corpsEtat,
          numeroDI: demande.numeroDI,
          origine: demande.canalReception || 'Client',
          priorite: demande.priorite,
          statutCommercial: 'À préparer',
          traitement: 'À traiter',
          prochaineAction: 'Chiffrer',
          amount: 0,
          validiteJours: 30,
          dateCreated: new Date(),
          dateDemande: demande.dateReception,
          notes: demande.notes,
          historiqueJson: addEvent(null, auteur, 'Devis créé depuis la demande', demande.numeroDI || demande.referenceInterne || ''),
          userId,
          companyId,
        },
      });
      const ref = `DEV-${annee}-${String(devis.id).padStart(3, '0')}`;
      await prisma.devis.update({ where: { id: devis.id }, data: { referenceMetier: ref } });
      await syncDevisDossier({ ...devis, referenceMetier: ref }, companyId);
      devisId = devis.id;
      libelle = `Devis ${ref}`;
    } else {
      const isVisite = decision === 'VISITE';
      const intervention = await prisma.intervention.create({
        data: {
          client: demande.client,
          chantier,
          objet: demande.objet,
          corpsEtat: demande.corpsEtat,
          numeroDI: demande.numeroDI,
          origine: demande.canalReception,
          priorite: demande.priorite,
          typeIntervention: isVisite ? 'Visite technique devis' : 'Corrective',
          isVisiteDevis: isVisite,
          modePlanification: 'Planifiée',
          statutOperationnel: 'À planifier',
          traitement: 'À traiter',
          statutFacture: isVisite ? 'Non facturable' : 'Non facturée',
          amount: 0,
          datePlanifiee: new Date(),
          dateDemande: demande.dateReception,
          notes: demande.notes,
          historiqueJson: addEvent(
            null,
            auteur,
            isVisite ? 'Visite créée depuis la demande' : 'Intervention créée depuis la demande',
            demande.numeroDI || demande.referenceInterne || ''
          ),
          userId,
          companyId,
        },
      });
      const prefix = isVisite ? 'VIS' : 'INT';
      const ref = `${prefix}-${annee}-${String(intervention.id).padStart(3, '0')}`;
      await prisma.intervention.update({ where: { id: intervention.id }, data: { referenceMetier: ref } });
      interventionId = intervention.id;
      libelle = `${isVisite ? 'Visite' : 'Intervention'} ${ref}`;
    }

    const updated = await prisma.demande.update({
      where: { id },
      data: {
        statut: 'ORIENTEE',
        decision,
        decidedAt: new Date(),
        devisId,
        interventionId,
        historiqueJson: addEvent(demande.historiqueJson, auteur, 'Demande orientée', libelle),
      },
    });

    res.status(201).json({ data: transform(updated), created: { decision, devisId, interventionId, libelle } });
  })
);
