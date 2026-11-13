// Interventions routes - Full 23 ANELEC columns + Planning horaire + Synchronisation Visite Devis + Historique + PostgreSQL compatibility
import { Request, Response } from 'express';
import { normalizeDI, resolveInterventionDossier, pushDIToDevis, findDevisByDI } from '../lib/dossierDI.js';
import { policy, secureRouter } from '../lib/guard.js';
import { prisma } from '../lib/prisma.js';
import { requireCompanyId } from '../lib/tenant.js';
import { loadAccess } from '../lib/loadAccess.js';
import { canReadIntervention, censorIntervention } from '../lib/access.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { socketEvents } from '../socket/index.js';
import { sendInterventionReportEmail } from '../services/emailService.js';
import { saveTechnicienGpsPosition } from './referentiels.js';
import {
  computeInterventionCalculations,
  traitementToStatusCode,
  statusCodeToTraitement,
  HistoriqueEvent,
  GpsPositionPayload,
  getEffectivePermissions,
} from '../../shared/types.js';

import { sanitizePhotosJson } from '../lib/terrainPhotos.js';

export const interventionRouter = secureRouter('interventions');

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

/** Taux de TVA : nombre entre 0 et 100, sinon null (présélection à l'affichage). */
function parseTauxTVA(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, n));
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
      (isVisiteDevis ? `VIS-${new Date().getFullYear()}-${String(i.id).padStart(3, '0')}` : `INT-${new Date().getFullYear()}-${String(i.id).padStart(3, '0')}`),
    referenceMetier:
      i.referenceMetier ||
      (isVisiteDevis ? `VIS-${new Date().getFullYear()}-${String(i.id).padStart(3, '0')}` : `INT-${new Date().getFullYear()}-${String(i.id).padStart(3, '0')}`),
    numeroDI: i.numeroDI || null,
    refDevisTexte: i.refDevisTexte || (i.devisId ? `DEV-${new Date().getFullYear()}-${String(i.devisId).padStart(3, '0')}` : null),
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
    tauxTVA: i.tauxTVA ?? null,
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
    gpsCloture: (() => {
      const hist = parseHistorique(i.historiqueJson);
      const evt = hist.find((h) => h.action === 'CLOTURE_GPS_TERRAIN' && h.details);
      if (evt?.details) {
        try {
          return JSON.parse(evt.details);
        } catch {
          return null;
        }
      }
      return null;
    })(),
    historique: parseHistorique(i.historiqueJson),
    version: i.version ?? 0,
    computed,
    createdAt: i.createdAt ? new Date(i.createdAt).getTime() : Date.now(),
    updatedAt: i.updatedAt ? new Date(i.updatedAt).getTime() : Date.now(),
  };
}

/**
 * Un devis ne peut être rattaché qu'à une intervention de la MÊME entreprise.
 * Renvoie l'id si le devis appartient à l'entreprise, sinon refuse (404) : on ne révèle pas l'existence
 * d'un devis d'une autre société.
 */
async function assertOwnDevisId(raw: unknown, companyId: number): Promise<number | null> {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(400, 'Identifiant de devis invalide', 'INVALID_DEVIS_ID');
  const devis = await prisma.devis.findFirst({ where: { id: n, companyId }, select: { id: true } });
  if (!devis) throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
  return devis.id;
}

interventionRouter.get(
  '/',
  policy('interventions.list'),
  asyncHandler(async (req: Request, res: Response) => {
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const technicienParam = (req.query.technicien as string) || '';
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 300;
    const companyId = requireCompanyId(req.user?.companyId);

    // Récupération du profil et des droits de l'appelant pour cloisonnement étanche
    const callerId = req.user?.userId;
    const callerUser = callerId
      ? await prisma.user.findUnique({
          where: { id: callerId },
          select: { id: true, email: true, name: true, role: true, technicienNom: true, permissionsJson: true, companyId: true },
        })
      : null;
    const callerRole = (callerUser?.role || req.user?.role || '').toUpperCase();
    const callerPerms = getEffectivePermissions(callerRole, callerUser?.permissionsJson);
    const isAdmin = callerUser?.id === 1 || callerRole === 'ADMIN' || Boolean(callerPerms.canManageUsers);
    const isMobileOnly = !isAdmin && (callerRole === 'TECHNICIEN' || Boolean(callerPerms.mobileOnly) || (Boolean(callerUser?.technicienNom) && !callerPerms.canEditDevis && !callerPerms.canManageBilling && !callerPerms.canEditPlanning));

    const where: any = {
      companyId,
      ...(search
        ? {
            OR: [
              { chantier: { contains: search, mode: 'insensitive' } },
              { siteAdresse: { contains: search, mode: 'insensitive' } },
              { client: { contains: search, mode: 'insensitive' } },
              { objet: { contains: search, mode: 'insensitive' } },
              { referenceMetier: { contains: search, mode: 'insensitive' } },
              { numeroDI: { contains: search, mode: 'insensitive' } },
              { entreprise: { contains: search, mode: 'insensitive' } },
              { technicien: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Cloisonnement strict des techniciens : ils ne peuvent voir QUE leurs propres interventions
    if (isMobileOnly || callerRole === 'TECHNICIEN') {
      const boundTech = (callerUser?.technicienNom || callerUser?.name || '').trim();
      if (boundTech) {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { entreprise: { contains: boundTech, mode: 'insensitive' } },
              { technicien: { contains: boundTech, mode: 'insensitive' } },
            ],
          },
        ];
      }
    } else if (technicienParam) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { entreprise: { contains: technicienParam, mode: 'insensitive' } },
            { technicien: { contains: technicienParam, mode: 'insensitive' } },
          ],
        },
      ];
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

    // Si l'utilisateur n'a pas le droit d'accès aux données financières, masquer les montants HT
    if (!isAdmin && !callerPerms.canViewFinancials) {
      transformed = transformed.map((i) => censorIntervention(i));
    }

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
  policy('interventions.stats'),
  asyncHandler(async (req: Request, res: Response) => {
    const acc = await loadAccess(req);
    if (acc.isFieldOnly) {
      throw new AppError(403, 'Statistiques non accessibles avec votre profil', 'FORBIDDEN');
    }
    const companyId = acc.companyId;
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
  policy('interventions.read'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const companyId = requireCompanyId(req.user?.companyId);
    const acc = await loadAccess(req);
    const intervention = await prisma.intervention.findFirst({
      where: { id, companyId },
      include: { devis: true },
    });

    // Même règle que la liste : un profil terrain ne lit que ses missions ; les autres n'ont pas de montants sans droit
    if (!intervention || !canReadIntervention(acc, intervention)) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }

    const dto = transformIntervention(intervention);
    res.json({ data: acc.canSeeAmounts ? dto : censorIntervention(dto) });
  })
);

interventionRouter.post(
  '/',
  policy('interventions.create'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';
    const b = req.body || {};

    // Contrôle d'accès : création réservée aux conducteurs de travaux, admin ou chiffrage
    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, technicienNom: true, permissionsJson: true },
    });
    const callerRole = (callerUser?.role || req.user?.role || '').toUpperCase();
    const callerPerms = getEffectivePermissions(callerRole, callerUser?.permissionsJson);
    const isAdmin = callerUser?.id === 1 || callerRole === 'ADMIN' || Boolean(callerPerms.canManageUsers);
    if (!isAdmin && !callerPerms.canEditInterventions && !callerPerms.canEditPlanning) {
      throw new AppError(403, 'Permission insuffisante pour créer une intervention', 'FORBIDDEN');
    }

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

    const requestedDevisId = await assertOwnDevisId(b.devisId ?? b.origineDevisId, companyId);
    // Le numéro de DI est la clé de suivi du dossier : il rattache l'intervention au devis qui le porte
    const dossier = await resolveInterventionDossier(companyId, {
      numeroDI: normalizeDI(b.numeroDI),
      devisId: requestedDevisId,
      client: b.client,
    });
    const safeDevisId = dossier.devisId;
    const safeOrigineDevisId = dossier.devisId;

    const created = await prisma.intervention.create({
      data: {
        referenceMetier: b.reference || b.referenceMetier ? String(b.reference || b.referenceMetier).trim() : null,
        refDevisTexte: b.refDevisTexte || dossier.devis?.referenceMetier || null,
        numeroDI: dossier.numeroDI,
        client: b.client ? String(b.client).trim() : (dossier.devis?.client ?? null),
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
        tauxTVA: parseTauxTVA(b.tauxTVA),
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
        origineDevisId: safeOrigineDevisId,
        origineDevisClient: b.origineDevisClient || b.client || null,
        origineDevisDate: parseDateOrNull(b.origineDevisDate),
        devisId: safeDevisId,
        historiqueJson,
        userId,
        companyId,
      },
    });

    await pushDIToDevis(dossier.devis, dossier.numeroDI);

    if (!created.referenceMetier) {
      const autoRef = isVisiteDevis
        ? `VIS-${new Date().getFullYear()}-${String(created.id).padStart(3, '0')}`
        : `INT-${new Date().getFullYear()}-${String(created.id).padStart(3, '0')}`;
      await prisma.intervention.update({
        where: { id: created.id },
        data: { referenceMetier: autoRef },
      });
      created.referenceMetier = autoRef;
    }

    const transformed = transformIntervention(created);
    try {
      socketEvents.interventionCreated(userId, companyId, transformed);
    } catch {
      console.error('Intervention saved; real-time creation notification failed.');
    }

    res.status(201).json({
      data: callerPerms.canViewFinancials || isAdmin ? transformed : censorIntervention(transformed),
      message: 'Intervention créée avec succès',
    });
  })
);

interventionRouter.patch(
  '/:id',
  policy('interventions.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';
    const b = req.body || {};

    const existing = await prisma.intervention.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }

    // Contrôle d'accès : modification réservée aux rôles bureau ou au technicien affecté
    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, technicienNom: true, permissionsJson: true },
    });
    const callerRole = (callerUser?.role || req.user?.role || '').toUpperCase();
    const callerPerms = getEffectivePermissions(callerRole, callerUser?.permissionsJson);
    const isAdmin = callerUser?.id === 1 || callerRole === 'ADMIN' || Boolean(callerPerms.canManageUsers);
    const isMobileOnly = !isAdmin && (callerRole === 'TECHNICIEN' || Boolean(callerPerms.mobileOnly) || (Boolean(callerUser?.technicienNom) && !callerPerms.canEditDevis && !callerPerms.canManageBilling && !callerPerms.canEditPlanning));

    if (isMobileOnly) {
      const boundTech = (callerUser?.technicienNom || callerUser?.name || '').trim().toLowerCase();
      const existingTech = (existing.entreprise || existing.technicien || '').trim().toLowerCase();
      if (!existingTech.includes(boundTech) && !boundTech.includes(existingTech)) {
        throw new AppError(403, 'Vous ne pouvez modifier que les interventions qui vous sont attribuées', 'FORBIDDEN');
      }
    } else if (!isAdmin && !callerPerms.canEditInterventions && !callerPerms.canWriteReports && !callerPerms.canEditPlanning && !callerPerms.canManageBilling) {
      throw new AppError(403, 'Permission insuffisante pour modifier cette intervention', 'FORBIDDEN');
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

    let historiqueJson =
      changes.length > 0
        ? addHistoriqueEvent(
            existing.historiqueJson,
            auteur,
            'Mise à jour intervention / planning',
            changes.join(' • ')
          )
        : existing.historiqueJson;

    if (b.gpsCloture && typeof b.gpsCloture === 'object') {
      const gpsPayload: GpsPositionPayload = {
        lat: Number(b.gpsCloture.lat),
        lng: Number(b.gpsCloture.lng),
        accuracy: b.gpsCloture.accuracy ? Number(b.gpsCloture.accuracy) : undefined,
        timestamp: b.gpsCloture.timestamp || new Date().toISOString(),
        technicien: String(b.gpsCloture.technicien || b.entreprise || existing.entreprise || auteur).trim(),
        missionId: id,
        missionRef: String(b.reference || existing.referenceMetier || `INT-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`),
        chantier: String(b.chantier || existing.chantier || ''),
        client: String(b.client || existing.client || ''),
        statut: 'CLOTUREE',
        source: b.gpsCloture.source || 'GPS_MOBILE',
      };
      if (!Number.isNaN(gpsPayload.lat) && !Number.isNaN(gpsPayload.lng)) {
        historiqueJson = addHistoriqueEvent(
          historiqueJson,
          gpsPayload.technicien,
          'CLOTURE_GPS_TERRAIN',
          JSON.stringify(gpsPayload)
        );
        try {
          await saveTechnicienGpsPosition(companyId, gpsPayload);
        } catch {
          // ignore
        }
      }
    }

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
    if (b.tauxTVA !== undefined) updateData.tauxTVA = parseTauxTVA(b.tauxTVA);
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
    if (b.devisId !== undefined) updateData.devisId = await assertOwnDevisId(b.devisId, companyId);

    // ── Saisies automatiques à la clôture ─────────────────────────────────────
    // Quand l'intervention passe à « Terminée - à valider » ou « Clôturée », ce qui
    // reste vide se remplit tout seul : la date réelle devient aujourd'hui, les heures
    // réelles reprennent les heures planifiées. Une valeur saisie n'est jamais écrasée.
    const DONE = ['Terminée - à valider', 'Clôturée'];
    const statutApres =
      b.statutOperationnel !== undefined ? b.statutOperationnel : existing.statutOperationnel;
    if (DONE.includes(String(statutApres || ''))) {
      const dateApres =
        updateData.dateReelle !== undefined ? updateData.dateReelle : existing.dateReelle;
      if (!dateApres) {
        updateData.dateReelle = new Date();
        updateData.dateFin = updateData.dateReelle;
      }
      const debutApres =
        updateData.heureDebutReelle !== undefined ? updateData.heureDebutReelle : existing.heureDebutReelle;
      const debutPlanifie =
        updateData.heureDebut !== undefined ? updateData.heureDebut : existing.heureDebut;
      if (!debutApres && debutPlanifie) updateData.heureDebutReelle = debutPlanifie;
      const finApres =
        updateData.heureFinReelle !== undefined ? updateData.heureFinReelle : existing.heureFinReelle;
      const finPlanifiee = updateData.heureFin !== undefined ? updateData.heureFin : existing.heureFin;
      if (!finApres && finPlanifiee) updateData.heureFinReelle = finPlanifiee;
    }
    let patchedDossierDevis: { id: number; numeroDI?: string | null } | null = null;
    if (b.numeroDI !== undefined || b.devisId !== undefined) {
      const nextDI = b.numeroDI !== undefined ? normalizeDI(b.numeroDI) : existing.numeroDI;
      const nextDevisId = b.devisId !== undefined ? updateData.devisId : existing.devisId;
      const nextClient = b.client !== undefined ? b.client : existing.client;
      const dossier = await resolveInterventionDossier(companyId, {
        numeroDI: nextDI,
        devisId: nextDevisId,
        client: nextClient,
      });
      updateData.numeroDI = dossier.numeroDI;
      // DI modifié sans choix explicite de devis : on suit le devis qui porte ce DI (ou on détache si aucun)
      if (b.numeroDI !== undefined && b.devisId === undefined && dossier.numeroDI !== existing.numeroDI) {
        const byDI = await findDevisByDI(dossier.numeroDI, companyId, nextClient);
        updateData.devisId = byDI ? byDI.id : existing.devisId;
        patchedDossierDevis = byDI || dossier.devis;
      } else if (dossier.devis) {
        updateData.devisId = dossier.devisId;
        patchedDossierDevis = dossier.devis;
      }
    }

    const updated = await prisma.intervention.update({
      where: { id },
      data: updateData,
    });

    await pushDIToDevis(patchedDossierDevis, updated.numeroDI || null);

    const linkedDevisId = updated.devisId || updated.origineDevisId;
    let parentDevis = linkedDevisId
      ? await prisma.devis.findFirst({ where: { id: linkedDevisId, companyId } })
      : null;

    if (!parentDevis && updated.refDevisTexte) {
      parentDevis = await prisma.devis.findFirst({
        where: { companyId, referenceMetier: updated.refDevisTexte.trim() },
      });
    }

    if (parentDevis) {
      const isVisitDone =
        ['Terminée - à valider', 'Clôturée', 'Terminée', 'Effectuée', 'Facturée'].includes(
          (updated.statutOperationnel || '').trim()
        ) || Boolean(b.gpsCloture);

      if (updated.isVisiteDevis || isVisitDone) {
        let nextDevisHist = addHistoriqueEvent(
          parentDevis.historiqueJson,
          auteur,
          isVisitDone
            ? 'Visite / intervention liée terminée par le technicien — Retirée de la carte'
            : 'Créneau de visite technique mis à jour au planning',
          `${updated.entreprise || 'Technicien à affecter'} • ${toISO(updated.datePlanifiee) || 'À planifier'} ${
            updated.heureDebut || ''
          }-${updated.heureFin || ''}`
        );

        if (b.gpsCloture && typeof b.gpsCloture === 'object') {
          const parsedDevisHist = parseHistorique(nextDevisHist);
          if (!parsedDevisHist.some((h) => h.action === 'CLOTURE_GPS_TERRAIN')) {
            nextDevisHist = addHistoriqueEvent(
              nextDevisHist,
              auteur,
              'CLOTURE_GPS_TERRAIN',
              JSON.stringify(b.gpsCloture)
            );
          }
        }

        const updatedParentDevis = await prisma.devis.update({
          where: { id: parentDevis.id },
          data: {
            ...(updated.isVisiteDevis
              ? {
                  visiteTechnicien: updated.entreprise || parentDevis.visiteTechnicien,
                  visiteDate: updated.datePlanifiee || parentDevis.visiteDate,
                  visiteHeureDebut: updated.heureDebut || parentDevis.visiteHeureDebut,
                  visiteHeureFin: updated.heureFin || parentDevis.visiteHeureFin,
                }
              : {}),
            visiteStatut: isVisitDone ? 'Terminée' : (updated.isVisiteDevis ? 'Planifiée' : parentDevis.visiteStatut),
            ...(isVisitDone && parentDevis.traitement === 'En attente technicien'
              ? {
                  traitement: 'En cours de traitement',
                  prochaineAction: 'Chiffrer',
                }
              : {}),
            historiqueJson: nextDevisHist,
          },
        });

        try {
          socketEvents.devisUpdated(userId, companyId, updatedParentDevis);
        } catch {
          // ignore
        }
      }
    }

    const transformed = transformIntervention(updated);
    try {
      socketEvents.interventionUpdated(userId, companyId, transformed);
    } catch {
      console.error('Intervention updated; real-time update notification failed.');
    }

    res.json({
      data: callerPerms.canViewFinancials || isAdmin ? transformed : censorIntervention(transformed),
      message: 'Intervention mise à jour',
    });
  })
);

interventionRouter.delete(
  '/:id',
  policy('interventions.delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);

    const existing = await prisma.intervention.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }

    // Contrôle d'accès : suppression réservée aux utilisateurs autorisés
    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, technicienNom: true, permissionsJson: true },
    });
    const callerRole = (callerUser?.role || req.user?.role || '').toUpperCase();
    const callerPerms = getEffectivePermissions(callerRole, callerUser?.permissionsJson);
    const isAdmin = callerUser?.id === 1 || callerRole === 'ADMIN' || Boolean(callerPerms.canManageUsers);

    if (!isAdmin && !callerPerms.canDeleteRecords) {
      throw new AppError(403, 'Suppression d’interventions non autorisée sur ce profil', 'FORBIDDEN');
    }

    await prisma.intervention.delete({ where: { id } });
    try {
      socketEvents.interventionDeleted(userId, companyId, { id });
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
  policy('interventions.sendReport'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);
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
    const rawTo = String(toEmail || '').trim();
    const validEmails = rawTo
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));

    if (validEmails.length === 0) {
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

    // Envoi sécurisé via emailService (Zoho Mail multi-hôtes ou prévisualisation secours)
    const delivery = await sendInterventionReportEmail({
      companyId,
      toEmail: validEmails.join(', '),
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

    if (!delivery.sent) {
      throw new AppError(500, `Échec de l'envoi de l'e-mail du rapport : ${delivery.error || 'Erreur SMTP'}`, 'EMAIL_ERROR');
    }

    // Traçabilité & Historique ANELEC
    const historyEntry = addHistoriqueEvent(
      intv.historiqueJson,
      senderName,
      "Rapport officiel envoyé par e-mail au donneur d'ordre / client",
      `Destinataire : ${toEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''} • Canal : ${delivery.channel}`
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
      socketEvents.interventionUpdated(userId, companyId, result);
    } catch {
      // ignore socket notification error
    }

    res.json({
      success: true,
      data: result,
      deliveryChannel: delivery.channel,
      previewUrl: delivery.previewUrl || null,
      message: `Rapport d'intervention envoyé avec succès par e-mail à ${toEmail}`,
    });
  })
);
