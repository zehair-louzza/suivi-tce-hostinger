// Interventions routes - Full 23 ANELEC columns + Planning horaire + Synchronisation Visite Devis + Historique + PostgreSQL compatibility
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { socketEvents } from '../socket/index.js';
import { sendInterventionReportEmail } from '../services/emailService.js';
import {
  computeInterventionCalculations,
  traitementToStatusCode,
  statusCodeToTraitement,
  HistoriqueEvent,
} from '../../shared/types.js';

export const interventionRouter = Router();

function parseJsonArray<T = any>(json?: string | null): T[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function parseHistorique(json?: string | null): HistoriqueEvent[] {
  return parseJsonArray<HistoriqueEvent>(json);
}

function addHistoriqueEvent(
  existingJson: string | null | undefined,
  auteur: string,
  action: string,
  details?: string
): string {
  const list = parseHistorique(existingJson);
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: new Date().toISOString(),
    auteur,
    action,
    details,
  });
  return JSON.stringify(list.slice(0, 100));
}

function toISO(dt?: Date | string | null): string | null {
  if (!dt) return null;
  if (typeof dt === 'string') return dt.split('T')[0];
  return dt.toISOString().split('T')[0];
}

function parseDateOrNull(val: any): Date | null {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  const d = new Date(val.includes('T') ? val : `${val}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalFloat(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

export function transformIntervention(i: any) {
  const dateDemande = toISO(i.dateDemande) || toISO(i.createdAt);
  const rawDatePlan = toISO(i.datePlanifiee);
  // Si modePlanification === 'Non planifiée' ou statutOperationnel === 'À planifier' sans heure, on expose datePlanifiee = null côté UI pour le bac "À placer"
  const isUnplanned =
    i.modePlanification === 'Non planifiée' &&
    (i.statutOperationnel === 'À planifier' || i.statutOperationnel === 'A_PLANIFIER');
  const datePlanifiee = isUnplanned ? null : rawDatePlan;

  const dateDebut = toISO(i.dateDebut);
  const dateReelle = toISO(i.dateFin) || toISO(i.dateReelle);
  const echeance = toISO(i.dateEcheance);

  const rawTraitement = i.traitement || i.status || 'A_TRAITER';
  const isLegacyCode = ['A_TRAITER', 'EN_COURS', 'EN_ATTENTE', 'BLOQUE', 'TRAITE', 'a-traiter', 'en-cours', 'en-attente', 'bloque', 'traite'].includes(rawTraitement);
  const traitement = isLegacyCode ? statusCodeToTraitement(rawTraitement) : rawTraitement;
  const statusCode = traitementToStatusCode(traitement);
  const statutOperationnel =
    i.statutOperationnel ||
    (statusCode === 'traite'
      ? 'Clôturée'
      : statusCode === 'bloque'
      ? 'Suspendue'
      : datePlanifiee
      ? 'Planifiée'
      : 'À planifier');

  const isVisiteDevis = Boolean(i.isVisiteDevis || i.typeIntervention === 'Visite technique devis');
  const tech = i.technicien || i.entreprise || null;
  const site = i.siteAdresse || i.chantier;

  const computed = computeInterventionCalculations({
    dateDemande,
    datePlanifiee,
    echeance,
    statutOperationnel,
    traitement,
    entreprise: tech,
    motifBlocage: i.motifBlocage,
    resultatTechnique: i.resultatTechnique,
    compteRendu: i.compteRendu,
    statutFacture: i.statutFacture,
    heureDebut: i.heureDebut,
    heureFin: i.heureFin,
  });

  return {
    id: i.id,
    reference:
      i.referenceMetier ||
      (isVisiteDevis ? `VIS-2026-${String(i.id).padStart(3, '0')}` : `INT-2026-${String(i.id).padStart(3, '0')}`),
    referenceMetier:
      i.referenceMetier ||
      (isVisiteDevis ? `VIS-2026-${String(i.id).padStart(3, '0')}` : `INT-2026-${String(i.id).padStart(3, '0')}`),
    refDevisTexte: i.refDevisTexte || (i.devisId ? `DEV-2026-${String(i.devisId).padStart(3, '0')}` : null),
    client: i.client || i.origineDevisClient || null,
    chantier: site,
    siteAdresse: site,
    objet: i.objet || null,
    origine: i.origine || null,
    typeIntervention: i.typeIntervention || (isVisiteDevis ? 'Visite technique devis' : 'Corrective'),
    modePlanification: i.modePlanification || (datePlanifiee ? 'Planifiée' : 'Non planifiée'),
    corpsEtat: i.corpsEtat || 'Tous corps d’état',
    priorite: i.priorite || 'Normale',
    dateDemande,
    datePlanifiee,
    statutOperationnel,
    traitement,
    status: statusCode,
    entreprise: tech,
    technicien: tech,
    dateDebut,
    dateReelle,
    dateFin: dateReelle,
    echeance,
    dateEcheance: echeance,
    resultatTechnique: i.resultatTechnique || null,
    motifBlocage: i.motifBlocage || null,
    numeroFacture: i.numeroFacture || null,
    statutFacture: i.statutFacture || 'Non facturée',
    compteRendu: i.compteRendu || null,
    notes: i.notes || null,
    amount: i.amount ?? null,
    heureDebut: i.heureDebut || null,
    heureFin: i.heureFin || null,
    heureDebutReelle: i.heureDebutReelle || null,
    heureFinReelle: i.heureFinReelle || null,
    actionsRealisees: parseJsonArray<string>(i.actionsRealiseesJson),
    photos: parseJsonArray<any>(i.photosJson),
    elementsChiffrage: i.elementsChiffrage || null,
    rapportFinal: i.rapportFinal || null,
    statutRapport: i.statutRapport || (i.rapportFinal ? 'Validé & Clôturé' : i.compteRendu ? 'Déclaré par technicien' : 'Brouillon'),
    isVisiteDevis,
    origineDevisId: i.origineDevisId || i.devisId || null,
    origineDevisClient: i.origineDevisClient || i.client || null,
    origineDevisDate: toISO(i.origineDevisDate),
    devisId: i.devisId || i.origineDevisId || null,
    historique: parseHistorique(i.historiqueJson),
    version: i.version ?? 0,
    computed,
    createdAt: i.createdAt ? new Date(i.createdAt).getTime() : Date.now(),
    updatedAt: i.updatedAt ? new Date(i.updatedAt).getTime() : Date.now(),
  };
}

function sanitizePhotosJson(rawPhotos: any): string | null {
  if (!Array.isArray(rawPhotos) || rawPhotos.length === 0) return null;
  // Limite stricte : 10 photos max par mission pour éviter toute saturation de stockage
  const capped = rawPhotos.slice(0, 10);
  const sanitized = capped
    .map((p, idx) => ({
      id: p.id ? String(p.id).slice(0, 50) : `ph-${Date.now()}-${idx}`,
      url: typeof p.url === 'string' ? p.url : '',
      category: typeof p.category === 'string' ? p.category.slice(0, 60) : 'Terrain',
      caption: typeof p.caption === 'string' ? p.caption.slice(0, 200) : '',
      takenAt: typeof p.takenAt === 'string' ? p.takenAt : new Date().toISOString(),
      auteur: typeof p.auteur === 'string' ? p.auteur.slice(0, 60) : '',
    }))
    .filter((p) => Boolean(p.url));
  return sanitized.length > 0 ? JSON.stringify(sanitized) : null;
}

interventionRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const technicien = (req.query.technicien as string) || '';
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 300;

    const where: any = {
      ...(search
        ? {
            OR: [
              { chantier: { contains: search, mode: 'insensitive' } },
              { siteAdresse: { contains: search, mode: 'insensitive' } },
              { client: { contains: search, mode: 'insensitive' } },
              { objet: { contains: search, mode: 'insensitive' } },
              { referenceMetier: { contains: search, mode: 'insensitive' } },
              { entreprise: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(technicien ? { entreprise: technicien } : {}),
    };

    // Cloisonnement strict des techniciens : ils ne peuvent voir QUE leurs propres interventions
    const userRole = (req.user?.role || '').toUpperCase();
    const isAdmin = req.user?.userId === 1 || userRole === 'ADMIN';
    if (!isAdmin && userRole === 'TECHNICIEN') {
      const callerUser = await prisma.user.findUnique({
        where: { id: req.user?.userId },
        select: { technicienNom: true, name: true },
      });
      const boundTech = (callerUser?.technicienNom || callerUser?.name || '').trim();
      if (boundTech) {
        where.entreprise = { contains: boundTech, mode: 'insensitive' };
      }
    }

    const [items, total] = await Promise.all([
      prisma.intervention.findMany({
        where,
        orderBy: [{ datePlanifiee: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.intervention.count({ where }),
    ]);

    let transformed = items.map(transformIntervention);
    if (status) {
      transformed = transformed.filter(
        (i) => i.status === status || i.traitement === status || i.statutOperationnel === status
      );
    }

    res.json({
      data: transformed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);

interventionRouter.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user?.companyId || 1;
    const items = await prisma.intervention.findMany({ where: { companyId } });
    const transformed = items.map(transformIntervention);

    const result: Record<string, number> = {
      'a-traiter': 0,
      'en-cours': 0,
      'en-attente': 0,
      bloque: 0,
      traite: 0,
      interventionsATraiter: 0,
      interventionsBloquees: 0,
      interventionsCloturees: 0,
      aPlanifier: 0,
      nonFactureesCloturees: 0,
    };

    for (const i of transformed) {
      result[i.status] = (result[i.status] || 0) + 1;
      if (
        i.traitement === 'À traiter' ||
        ['Nouvelle demande', 'À planifier'].includes(i.statutOperationnel)
      ) {
        result.interventionsATraiter += 1;
      }
      if (i.traitement === 'Bloqué' || i.statutOperationnel === 'Suspendue' || Boolean(i.motifBlocage)) {
        result.interventionsBloquees += 1;
      }
      if (i.statutOperationnel === 'Clôturée') {
        result.interventionsCloturees += 1;
        if (!i.isVisiteDevis && i.statutFacture !== 'Facturée') {
          result.nonFactureesCloturees += 1;
        }
      }
      if (!i.datePlanifiee || !i.entreprise) {
        result.aPlanifier += 1;
      }
    }

    res.json(result);
  })
);

interventionRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user?.companyId || 1;
    const intervention = await prisma.intervention.findFirst({
      where: { id, companyId },
      include: { devis: true },
    });

    if (!intervention) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }

    res.json({ data: transformIntervention(intervention) });
  })
);

interventionRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const companyId = req.user?.companyId || 1;
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';
    const b = req.body || {};

    const chantier = String(b.chantier || b.siteAdresse || b.site || b.client || 'Site à préciser').trim();
    const isVisiteDevis = Boolean(
      b.isVisiteDevis === true ||
        b.isVisiteDevis === 'true' ||
        b.typeIntervention === 'Visite technique devis'
    );
    const explicitDatePlan = parseDateOrNull(b.datePlanifiee);
    const traitement = b.traitement || (b.status ? statusCodeToTraitement(b.status) : 'À traiter');
    const statusLegacy = traitementToStatusCode(traitement).toUpperCase().replace('-', '_');
    const tech = b.entreprise || b.technicien || null;
    const statutOperationnel =
      b.statutOperationnel ||
      (explicitDatePlan ? (tech ? 'Planifiée' : 'À planifier') : 'À planifier');
    const modePlanification =
      b.modePlanification || (explicitDatePlan ? 'Planifiée' : 'Non planifiée');

    const historiqueJson = addHistoriqueEvent(
      null,
      auteur,
      isVisiteDevis ? 'Visite technique créée' : 'Intervention enregistrée',
      `${chantier}${tech ? ` — Technicien : ${tech}` : ''}${
        explicitDatePlan ? ` — Le ${toISO(explicitDatePlan)} ${b.heureDebut || ''}-${b.heureFin || ''}` : ' (À planifier)'
      }`
    );

    const created = await prisma.intervention.create({
      data: {
        referenceMetier: b.reference || b.referenceMetier ? String(b.reference || b.referenceMetier).trim() : null,
        refDevisTexte: b.refDevisTexte || null,
        client: b.client ? String(b.client).trim() : null,
        chantier,
        siteAdresse: chantier,
        objet: b.objet ? String(b.objet).trim() : null,
        origine: b.origine || "Donneur d'ordre",
        typeIntervention: b.typeIntervention || (isVisiteDevis ? 'Visite technique devis' : 'Corrective'),
        modePlanification,
        corpsEtat: b.corpsEtat || 'Tous corps d’état',
        priorite: b.priorite || 'Normale',
        dateDemande: parseDateOrNull(b.dateDemande) || new Date(),
        datePlanifiee: explicitDatePlan || new Date(),
        statutOperationnel,
        traitement,
        status: statusLegacy,
        entreprise: tech,
        technicien: tech,
        dateDebut: parseDateOrNull(b.dateDebut),
        dateReelle: parseDateOrNull(b.dateReelle || b.dateFin),
        dateFin: parseDateOrNull(b.dateReelle || b.dateFin),
        dateEcheance: parseDateOrNull(b.echeance || b.dateEcheance),
        resultatTechnique: b.resultatTechnique || null,
        motifBlocage: b.motifBlocage || null,
        numeroFacture: b.numeroFacture || null,
        statutFacture: b.statutFacture || 'Non facturée',
        compteRendu: b.compteRendu || null,
        notes: b.notes || null,
        amount: parseOptionalFloat(b.amount) ?? 0,
        heureDebut: b.heureDebut || null,
        heureFin: b.heureFin || null,
        heureDebutReelle: b.heureDebutReelle || null,
        heureFinReelle: b.heureFinReelle || null,
        actionsRealiseesJson: Array.isArray(b.actionsRealisees) ? JSON.stringify(b.actionsRealisees) : null,
        photosJson: sanitizePhotosJson(b.photos),
        elementsChiffrage: b.elementsChiffrage || null,
        rapportFinal: b.rapportFinal || null,
        statutRapport: b.statutRapport || null,
        isVisiteDevis,
        origineDevisId: b.origineDevisId ? Number(b.origineDevisId) : b.devisId ? Number(b.devisId) : null,
        origineDevisClient: b.origineDevisClient || b.client || null,
        origineDevisDate: parseDateOrNull(b.origineDevisDate),
        devisId: b.devisId ? Number(b.devisId) : b.origineDevisId ? Number(b.origineDevisId) : null,
        historiqueJson,
        userId,
        companyId,
      },
    });

    if (!created.referenceMetier) {
      const autoRef = isVisiteDevis
        ? `VIS-2026-${String(created.id).padStart(3, '0')}`
        : `INT-2026-${String(created.id).padStart(3, '0')}`;
      await prisma.intervention.update({
        where: { id: created.id },
        data: { referenceMetier: autoRef },
      });
      created.referenceMetier = autoRef;
    }

    const transformed = transformIntervention(created);
    try {
      socketEvents.interventionCreated(userId, transformed);
      socketEvents.broadcast('intervention:created', transformed);
    } catch {
      console.error('Intervention saved; real-time creation notification failed.');
    }

    res.status(201).json({ data: transformed, message: 'Intervention créée avec succès' });
  })
);

interventionRouter.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = req.user?.companyId || 1;
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';
    const b = req.body || {};

    const existing = await prisma.intervention.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }

    const changes: string[] = [];
    if (b.entreprise !== undefined && b.entreprise !== existing.entreprise) {
      changes.push(`Technicien : ${existing.entreprise || 'Non affecté'} → ${b.entreprise || 'Non affecté'}`);
    }
    if (
      (b.heureDebut !== undefined && b.heureDebut !== existing.heureDebut) ||
      (b.heureFin !== undefined && b.heureFin !== existing.heureFin)
    ) {
      const hd = b.heureDebut !== undefined ? b.heureDebut : existing.heureDebut;
      const hf = b.heureFin !== undefined ? b.heureFin : existing.heureFin;
      changes.push(`Créneau horaire : ${hd || '—'} - ${hf || '—'}`);
    }
    if (b.statutOperationnel && b.statutOperationnel !== existing.statutOperationnel) {
      changes.push(`Statut opérationnel : ${existing.statutOperationnel} → ${b.statutOperationnel}`);
    }

    const historiqueJson =
      changes.length > 0
        ? addHistoriqueEvent(
            existing.historiqueJson,
            auteur,
            'Mise à jour intervention / planning',
            changes.join(' • ')
          )
        : existing.historiqueJson;

    const newTraitement =
      b.traitement !== undefined ? b.traitement : b.status ? statusCodeToTraitement(b.status) : undefined;

    const updateData: any = {
      historiqueJson,
      version: { increment: 1 },
    };

    if (b.reference !== undefined || b.referenceMetier !== undefined) {
      updateData.referenceMetier = b.reference || b.referenceMetier || null;
    }
    if (b.refDevisTexte !== undefined) updateData.refDevisTexte = b.refDevisTexte || null;
    if (b.client !== undefined) updateData.client = b.client || null;
    if (b.chantier !== undefined || b.siteAdresse !== undefined) {
      const ch = String(b.chantier ?? b.siteAdresse).trim();
      updateData.chantier = ch;
      updateData.siteAdresse = ch;
    }
    if (b.objet !== undefined) updateData.objet = b.objet || null;
    if (b.origine !== undefined) updateData.origine = b.origine || null;
    if (b.typeIntervention !== undefined) updateData.typeIntervention = b.typeIntervention || null;
    if (b.modePlanification !== undefined) updateData.modePlanification = b.modePlanification || null;
    if (b.corpsEtat !== undefined) updateData.corpsEtat = b.corpsEtat || null;
    if (b.priorite !== undefined) updateData.priorite = b.priorite || 'Normale';
    if (b.dateDemande !== undefined) updateData.dateDemande = parseDateOrNull(b.dateDemande);
    if (b.datePlanifiee !== undefined) {
      const parsedDate = parseDateOrNull(b.datePlanifiee);
      if (parsedDate) {
        updateData.datePlanifiee = parsedDate;
        updateData.modePlanification = 'Planifiée';
        if (existing.statutOperationnel === 'À planifier' && !b.statutOperationnel) {
          updateData.statutOperationnel = 'Planifiée';
        }
      } else {
        // Remise dans le bac "À planifier"
        updateData.modePlanification = 'Non planifiée';
        updateData.statutOperationnel = 'À planifier';
      }
    }
    if (b.statutOperationnel !== undefined) updateData.statutOperationnel = b.statutOperationnel;
    if (newTraitement !== undefined) {
      updateData.traitement = newTraitement;
      updateData.status = traitementToStatusCode(newTraitement).toUpperCase().replace('-', '_');
    }
    if (b.entreprise !== undefined || b.technicien !== undefined) {
      const t = b.entreprise ?? b.technicien ?? null;
      updateData.entreprise = t;
      updateData.technicien = t;
    }
    if (b.dateDebut !== undefined) updateData.dateDebut = parseDateOrNull(b.dateDebut);
    if (b.dateReelle !== undefined || b.dateFin !== undefined) {
      const df = parseDateOrNull(b.dateReelle ?? b.dateFin);
      updateData.dateReelle = df;
      updateData.dateFin = df;
    }
    if (b.echeance !== undefined || b.dateEcheance !== undefined) {
      updateData.dateEcheance = parseDateOrNull(b.echeance ?? b.dateEcheance);
    }
    if (b.resultatTechnique !== undefined) updateData.resultatTechnique = b.resultatTechnique || null;
    if (b.motifBlocage !== undefined) updateData.motifBlocage = b.motifBlocage || null;
    if (b.numeroFacture !== undefined) updateData.numeroFacture = b.numeroFacture || null;
    if (b.statutFacture !== undefined) updateData.statutFacture = b.statutFacture || 'Non facturée';
    if (b.compteRendu !== undefined) updateData.compteRendu = b.compteRendu || null;
    if (b.notes !== undefined) updateData.notes = b.notes || null;
    if (b.amount !== undefined) updateData.amount = parseOptionalFloat(b.amount) ?? 0;
    if (b.heureDebut !== undefined) updateData.heureDebut = b.heureDebut || null;
    if (b.heureFin !== undefined) updateData.heureFin = b.heureFin || null;
    if (b.heureDebutReelle !== undefined) updateData.heureDebutReelle = b.heureDebutReelle || null;
    if (b.heureFinReelle !== undefined) updateData.heureFinReelle = b.heureFinReelle || null;
    if (b.actionsRealisees !== undefined) {
      updateData.actionsRealiseesJson = Array.isArray(b.actionsRealisees)
        ? JSON.stringify(b.actionsRealisees)
        : null;
    }
    if (b.photos !== undefined) {
      updateData.photosJson = sanitizePhotosJson(b.photos);
    }
    if (b.elementsChiffrage !== undefined) updateData.elementsChiffrage = b.elementsChiffrage || null;
    if (b.rapportFinal !== undefined) updateData.rapportFinal = b.rapportFinal || null;
    if (b.statutRapport !== undefined) updateData.statutRapport = b.statutRapport || null;
    if (b.isVisiteDevis !== undefined) {
      updateData.isVisiteDevis = Boolean(b.isVisiteDevis === true || b.isVisiteDevis === 'true');
    }
    if (b.devisId !== undefined) updateData.devisId = b.devisId ? Number(b.devisId) : null;

    const updated = await prisma.intervention.update({
      where: { id },
      data: updateData,
    });

    const linkedDevisId = updated.devisId || updated.origineDevisId;
    if (linkedDevisId && updated.isVisiteDevis) {
      const parentDevis = await prisma.devis.findUnique({ where: { id: linkedDevisId } });
      if (parentDevis) {
        const isVisitDone = ['Terminée - à valider', 'Clôturée'].includes(updated.statutOperationnel || '');
        await prisma.devis.update({
          where: { id: linkedDevisId },
          data: {
            visiteTechnicien: updated.entreprise,
            visiteDate: updated.datePlanifiee,
            visiteHeureDebut: updated.heureDebut,
            visiteHeureFin: updated.heureFin,
            visiteStatut: isVisitDone ? 'Effectuée' : 'Planifiée',
            ...(isVisitDone && parentDevis.traitement === 'En attente technicien'
              ? {
                  traitement: 'En cours de traitement',
                  prochaineAction: 'Chiffrer',
                }
              : {}),
            historiqueJson: addHistoriqueEvent(
              parentDevis.historiqueJson,
              auteur,
              isVisitDone
                ? 'Visite technique terminée par le technicien — Prêt à chiffrer'
                : 'Créneau de visite technique mis à jour au planning',
              `${updated.entreprise || 'Technicien à affecter'} • ${toISO(updated.datePlanifiee) || 'À planifier'} ${
                updated.heureDebut || ''
              }-${updated.heureFin || ''}`
            ),
          },
        });
      }
    }

    const transformed = transformIntervention(updated);
    try {
      socketEvents.interventionUpdated(userId, transformed);
      socketEvents.broadcast('intervention:updated', transformed);
    } catch {
      console.error('Intervention updated; real-time update notification failed.');
    }

    res.json({ data: transformed, message: 'Intervention mise à jour' });
  })
);

interventionRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = req.user?.companyId || 1;

    const existing = await prisma.intervention.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }

    await prisma.intervention.delete({ where: { id } });
    try {
      socketEvents.interventionDeleted(userId, { id });
    } catch {
      console.error('Intervention deleted; real-time deletion notification failed.');
    }

    res.json({ message: 'Intervention supprimée' });
  })
);

// POST /api/interventions/:id/send-report-email - Envoi direct du rapport officiel par e-mail
// Règle stricte : réservé à l'équipe bureau / administration (les techniciens ne peuvent pas envoyer par email).
interventionRouter.post(
  '/:id/send-report-email',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = req.user?.companyId || 1;
    const userRole = (req.user?.role || 'USER').toUpperCase();
    const isTech = userRole === 'TECHNICIEN';

    // Règle de conformité demandée :
    // "Les techniciens ne peuvent pas envoyer ces rapports par email, ils peuvent envoyer les rapports que pour l'équipe bureau sur l'application direct."
    if (isTech) {
      throw new AppError(
        403,
        "Les techniciens terrain ne sont pas autorisés à envoyer des rapports par e-mail aux donneurs d'ordre. Veuillez transmettre votre compte rendu à l'équipe bureau directement sur l'application.",
        'FORBIDDEN'
      );
    }

    const intv = await prisma.intervention.findFirst({
      where: { id, companyId },
      include: { company: true },
    });
    if (!intv) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }

    const { toEmail, ccEmail, subject, customMessage, rapportFinal, includePhotos } = req.body || {};
    if (!toEmail || typeof toEmail !== 'string' || !toEmail.includes('@')) {
      throw new AppError(
        400,
        "Une adresse e-mail de destinataire valide est obligatoire pour l'envoi du rapport",
        'VALIDATION_ERROR'
      );
    }

    const transformed = transformIntervention(intv);
    const finalReportText =
      rapportFinal ||
      transformed.rapportFinal ||
      transformed.compteRendu ||
      'Travaux terminés et vérifiés conformément aux exigences techniques.';

    const senderEmail = req.user?.email || 'zehair@anelecgroupe.com';
    const senderName = req.user?.email ? req.user.email.split('@')[0] : 'Direction Technique';
    const companyName = intv.company?.name || 'ANELEC GROUPE';

    // Envoi sécurisé via emailService (Zoho Mail ou simulation sécurisée)
    const emailSent = await sendInterventionReportEmail({
      toEmail: String(toEmail).trim().toLowerCase(),
      ccEmail: ccEmail ? String(ccEmail).trim() : undefined,
      subject: subject || `[RAPPORT INTERVENTION] ${transformed.reference} • ${transformed.client} • ${transformed.chantier}`,
      customMessage: customMessage || undefined,
      intervention: {
        id: transformed.id,
        referenceMetier: transformed.reference,
        client: transformed.client,
        chantier: transformed.chantier,
        entreprise: transformed.entreprise,
        corpsEtat: transformed.corpsEtat,
        typeIntervention: transformed.typeIntervention,
        datePlanifiee: transformed.datePlanifiee || new Date().toISOString(),
        dateReelle: transformed.dateReelle,
        actionsRealisees: transformed.actionsRealisees,
        photos: includePhotos !== false ? transformed.photos : [],
        elementsChiffrage: transformed.elementsChiffrage,
        rapportFinal: finalReportText,
        statutRapport: 'Envoyé au client',
      },
      senderName,
      senderEmail,
      companyName,
    });

    if (!emailSent) {
      throw new AppError(500, "Échec de l'envoi de l'e-mail du rapport", 'EMAIL_ERROR');
    }

    // Traçabilité & Historique ANELEC
    const historyEntry = addHistoriqueEvent(
      intv.historiqueJson,
      senderName,
      "Rapport officiel envoyé par e-mail au donneur d'ordre / client",
      `Destinataire : ${toEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''}`
    );

    const updated = await prisma.intervention.update({
      where: { id },
      data: {
        statutRapport: 'Envoyé au client',
        rapportFinal: finalReportText,
        historiqueJson: historyEntry,
      },
    });

    const result = transformIntervention(updated);
    try {
      socketEvents.interventionUpdated(userId, result);
      socketEvents.broadcast('intervention:updated', result);
    } catch {
      // ignore socket notification error
    }

    res.json({
      success: true,
      data: result,
      message: `Rapport d'intervention envoyé avec succès par e-mail à ${toEmail}`,
    });
  })
);
