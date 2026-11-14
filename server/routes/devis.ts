// Devis routes - Full 22 ANELEC columns + Auto-planning Visite Devis + Non-destructive linked interventions + History + PostgreSQL compatibility
import { Request, Response } from 'express';
import { normalizeDI, syncDevisDossier } from '../lib/dossierDI.js';
import { nextCompanyRef } from '../lib/companySeq.js';
import { comptesTechnicien, notifierAffectation, reglagesSociete } from '../services/technicianAutomation.js';
import { policy, secureRouter } from '../lib/guard.js';
import { prisma } from '../lib/prisma.js';
import { requireCompanyId } from '../lib/tenant.js';
import { loadAccess } from '../lib/loadAccess.js';
import { canReadDevis, describeRefusal, limitDevisBody, shapeDevis } from '../lib/access.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { socketEvents } from '../socket/index.js';
import { convertKeepingQuote } from '../services/linkedConversion.js';
import { saveTechnicienGpsPosition } from './referentiels.js';
import { parsePhotosJson, sanitizePhotosJson } from '../lib/terrainPhotos.js';
import { sendDevisProposalEmail } from '../services/emailService.js';
import {
  adressesPourDevis,
  dernierDocument,
  envoyerAuClient,
  etatLien,
  liensDuDevis,
  referenceDevis,
  revoquerLiensActifs,
} from '../services/devisClient.js';
import { contenuDevisModifie, validerPdf } from '../domain/devisClient.js';
import {
  computeDevisCalculations,
  traitementToStatusCode,
  statusCodeToTraitement,
  HistoriqueEvent,
  GpsPositionPayload,
  getEffectivePermissions,
  applyDevisAutomations,
} from '../../shared/types.js';

export const devisRouter = secureRouter('devis');

function parseHistorique(json?: string | null): HistoriqueEvent[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
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

function parseOptionalInt(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(String(val), 10);
  return Number.isNaN(n) ? null : n;
}

function notify(fn: () => void) {
  try {
    fn();
  } catch {
    console.error('Donnée conservée ; notification devis non transmise');
  }
}

export function transformDevis(d: any) {
  const dateCreated = toISO(d.dateDemande) || toISO(d.dateCreated) || new Date().toISOString().split('T')[0];
  const echeance = toISO(d.dateLimite) || toISO(d.echeance);
  const dateEnvoi = toISO(d.dateEnvoi);
  const dateRelance = toISO(d.dateRelance);
  const visiteDate = toISO(d.visiteDate);

  const rawTraitement = d.traitement || d.status || 'A_TRAITER';
  const isLegacyCode = ['A_TRAITER', 'EN_COURS', 'EN_ATTENTE', 'BLOQUE', 'TRAITE', 'a-traiter', 'en-cours', 'en-attente', 'bloque', 'traite'].includes(rawTraitement);
  const traitement = isLegacyCode ? statusCodeToTraitement(rawTraitement) : rawTraitement;
  const statusCode = traitementToStatusCode(traitement);
  const statutCommercial = d.statutCommercial || (statusCode === 'traite' ? 'Accepté' : 'À préparer');

  const rawAmount = d.montantHt != null ? Number(d.montantHt) : d.amount != null && d.amount > 0 ? Number(d.amount) : null;
  const site = d.siteAdresse || null;
  const notes = d.commentaires ?? d.notes ?? null;

  const computed = computeDevisCalculations({
    dateCreated,
    echeance,
    dateEnvoi,
    validiteJours: d.validiteJours,
    dateRelance,
    statutCommercial,
    traitement,
    prochaineAction: d.prochaineAction,
    responsable: d.responsable,
    client: d.client,
    site,
    amount: rawAmount,
  });

  const linkedInterventions = Array.isArray(d.interventions)
    ? d.interventions.map((i: any) => ({
        id: i.id,
        reference: i.referenceMetier || `INT-${String(i.id).padStart(3, '0')}`,
        chantier: i.siteAdresse || i.chantier,
        entreprise: i.technicien || i.entreprise,
        statutOperationnel: i.statutOperationnel || 'Planifiée',
        datePlanifiee: toISO(i.datePlanifiee),
        heureDebut: i.heureDebut,
        heureFin: i.heureFin,
        isVisiteDevis: Boolean(i.isVisiteDevis),
      }))
    : [];

  const countLinked = d._count?.interventions ?? linkedInterventions.length;

  return {
    id: d.id,
    reference: d.referenceMetier || `DEV-${new Date().getFullYear()}-${String(d.id).padStart(3, '0')}`,
    referenceMetier: d.referenceMetier || `DEV-${new Date().getFullYear()}-${String(d.id).padStart(3, '0')}`,
    client: d.client,
    site,
    siteAdresse: site,
    objet: d.objet || null,
    corpsEtat: d.corpsEtat || null,
    numeroDI: d.numeroDI || null,
    origine: d.origine || null,
    dateCreated,
    dateDemande: dateCreated,
    echeance,
    dateLimite: echeance,
    dateEnvoi,
    statutCommercial,
    traitement,
    status: statusCode,
    amount: rawAmount,
    montantHt: rawAmount != null ? rawAmount.toFixed(2) : null,
    tauxTVA: d.tauxTVA ?? null,
    validiteJours: d.validiteJours ?? null,
    prochaineAction: d.prochaineAction || null,
    dateRelance,
    responsable: d.responsable || null,
    priorite: d.priorite || 'Normale',
    refInterventionTexte:
      d.refInterventionTexte ||
      (linkedInterventions.length > 0 ? linkedInterventions.map((li: any) => li.reference).join(', ') : null),
    notes,
    commentaires: notes,
    visiteNecessaire: Boolean(d.visiteNecessaire),
    visiteTechnicien: d.visiteTechnicien || null,
    visiteDate,
    visiteHeureDebut: d.visiteHeureDebut || null,
    visiteHeureFin: d.visiteHeureFin || null,
    visiteStatut: (() => {
      const anyVisitDone = linkedInterventions.some(
        (li: any) =>
          ['Clôturée', 'Terminée - à valider', 'Terminée', 'Effectuée', 'Facturée'].includes(
            (li.statutOperationnel || '').trim()
          )
      );
      if (anyVisitDone && (!d.visiteStatut || ['Planifiée', 'À planifier', 'En cours', 'À réaliser'].includes(d.visiteStatut))) {
        return 'Terminée';
      }
      return d.visiteStatut || null;
    })(),
    gpsCloture: (() => {
      const hist = parseHistorique(d.historiqueJson);
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
    photos: parsePhotosJson(d.visitePhotosJson),
    historique: parseHistorique(d.historiqueJson),
    interventions: linkedInterventions,
    interventionsCount: countLinked,
    nombreInterventionsLiees: countLinked,
    premiereInterventionLieeId: linkedInterventions[0]?.id ?? null,
    version: d.version ?? 0,
    computed,
    createdAt: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
    updatedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
  };
}

// Synchronise automatiquement un créneau de visite technique dans les interventions/planning
async function syncVisiteDevisIntervention(devis: any, userId: number, auteur: string) {
  const needsVisite =
    Boolean(devis.visiteNecessaire) ||
    devis.traitement === 'En attente technicien' ||
    Boolean(devis.visiteTechnicien) ||
    Boolean(devis.visiteDate);

  if (!needsVisite) return null;

  const refDevis = devis.referenceMetier || `DEV-${new Date().getFullYear()}-${String(devis.id).padStart(3, '0')}`;
  const devisHist = parseHistorique(devis.historiqueJson);
  const gpsEvt = devisHist.find((h) => h.action === 'CLOTURE_GPS_TERRAIN' && h.details);
  const isDevisVisitDone =
    ['Terminée', 'Effectuée', 'Clôturée', 'Réalisée', 'Validée', 'Fait', 'Traitée'].includes(
      (devis.visiteStatut || '').trim()
    ) ||
    Boolean(gpsEvt) ||
    ['Traité', 'Clôturé'].includes((devis.traitement || '').trim()) ||
    ['Accepté', 'Signé', 'Facturé', 'Gagné', 'Terminé', 'Clôturé'].includes(
      (devis.statutCommercial || '').trim()
    );

  // La recherche par référence texte doit rester dans la société : les références sont
  // des séquences par société, donc deux sociétés peuvent porter la même (DEV-2026-001).
  // Sans ce filtre, l'enregistrement d'un devis pouvait écraser la visite d'une autre société.
  const existingVisite = await prisma.intervention.findFirst({
    where: {
      companyId: devis.companyId ?? undefined,
      OR: [
        { devisId: devis.id },
        { origineDevisId: devis.id },
        { refDevisTexte: refDevis },
      ],
      isVisiteDevis: true,
    },
  });

  const datePlan = devis.visiteDate || devis.dateCreated || new Date();
  const baseStatutOp = isDevisVisitDone
    ? 'Clôturée'
    : devis.visiteStatut === 'En cours'
    ? 'En cours'
    : devis.visiteStatut === 'À replanifier'
    ? 'Intervention non terminée'
    : devis.visiteDate
    ? devis.visiteTechnicien
      ? 'Planifiée'
      : 'À planifier'
    : 'À planifier';

  if (existingVisite) {
    const existingAlreadyDone = ['Clôturée', 'Terminée - à valider', 'Terminée', 'Effectuée', 'Facturée'].includes(
      (existingVisite.statutOperationnel || '').trim()
    );
    const finalStatutOp = existingAlreadyDone || isDevisVisitDone ? 'Clôturée' : baseStatutOp;

    let intvHist = existingVisite.historiqueJson;
    if (gpsEvt?.details) {
      const parsedIntvHist = parseHistorique(intvHist);
      if (!parsedIntvHist.some((h) => h.action === 'CLOTURE_GPS_TERRAIN')) {
        intvHist = addHistoriqueEvent(intvHist, auteur, 'CLOTURE_GPS_TERRAIN', gpsEvt.details);
      }
    }

    return prisma.intervention.update({
      where: { id: existingVisite.id },
      data: {
        devisId: devis.id,
        origineDevisId: devis.id,
        refDevisTexte: refDevis,
        client: devis.client,
        chantier: devis.siteAdresse || devis.client,
        siteAdresse: devis.siteAdresse || devis.client,
        objet: devis.objet ? `[Visite Devis] ${devis.objet}` : `[Visite Devis] ${devis.client}`,
        corpsEtat: devis.corpsEtat,
        numeroDI: devis.numeroDI || existingVisite.numeroDI || null,
        origine: devis.origine || 'Interne',
        priorite: devis.priorite || 'Normale',
        entreprise: devis.visiteTechnicien || existingVisite.entreprise,
        technicien: devis.visiteTechnicien || existingVisite.technicien,
        datePlanifiee: datePlan,
        heureDebut: devis.visiteHeureDebut || existingVisite.heureDebut || '09:00',
        heureFin: devis.visiteHeureFin || existingVisite.heureFin || '10:30',
        statutOperationnel: finalStatutOp,
        ...(finalStatutOp === 'Clôturée'
          ? {
              traitement: 'Clôturé par technicien - Prêt pour facturation',
              status: 'TRAITE',
              statutRapport: 'Validé par technicien',
            }
          : {}),
        historiqueJson: intvHist,
        modePlanification: devis.visiteDate ? 'Planifiée' : 'Non planifiée',
      },
    });
  } else {
    // Si la visite devis est déjà déclarée terminée/clôturée, on ne recrée surtout pas une mission "Planifiée"
    if (isDevisVisitDone) {
      return null;
    }
    return prisma.intervention.create({
      data: {
        referenceMetier: `VIS-${String(devis.id).padStart(3, '0')}`,
        refDevisTexte: refDevis,
        numeroDI: devis.numeroDI || null,
        client: devis.client,
        chantier: devis.siteAdresse || devis.client,
        siteAdresse: devis.siteAdresse || devis.client,
        objet: devis.objet ? `[Visite Devis] ${devis.objet}` : `[Visite Devis] Relevé & chiffrage`,
        origine: devis.origine || 'Interne',
        typeIntervention: 'Visite technique devis',
        modePlanification: devis.visiteDate ? 'Planifiée' : 'Non planifiée',
        corpsEtat: devis.corpsEtat || 'Tous corps d’état',
        priorite: devis.priorite || 'Normale',
        dateDemande: devis.dateCreated || new Date(),
        datePlanifiee: datePlan,
        statutOperationnel: baseStatutOp,
        traitement: 'En cours de traitement',
        status: 'EN_COURS',
        entreprise: devis.visiteTechnicien || null,
        technicien: devis.visiteTechnicien || null,
        heureDebut: devis.visiteHeureDebut || '09:00',
        heureFin: devis.visiteHeureFin || '10:30',
        isVisiteDevis: true,
        amount: 0, // une visite de chiffrage n'est pas du chiffre d'affaires

        notes: `Visite technique générée automatiquement pour chiffrer le devis ${refDevis}.`,
        origineDevisId: devis.id,
        origineDevisClient: devis.client,
        origineDevisDate: devis.dateCreated,
        devisId: devis.id,
        userId,
        companyId: requireCompanyId(devis.companyId),
        historiqueJson: addHistoriqueEvent(
          null,
          auteur,
          'Visite technique de devis créée automatiquement',
          `Liée au devis ${refDevis}`
        ),
      },
    });
  }
}

devisRouter.get(
  '/',
  policy('devis.list'),
  asyncHandler(async (req: Request, res: Response) => {
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 200;
    const companyId = requireCompanyId(req.user?.companyId);

    const where: any = {
      companyId,
      ...(search
        ? {
            OR: [
              { client: { contains: search, mode: 'insensitive' } },
              { siteAdresse: { contains: search, mode: 'insensitive' } },
              { objet: { contains: search, mode: 'insensitive' } },
              { referenceMetier: { contains: search, mode: 'insensitive' } },
              { numeroDI: { contains: search, mode: 'insensitive' } },
              { responsable: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const acc = await loadAccess(req);

    // Cloisonnement par rôle : le terrain ne voit que ses visites ; sans droit Devis, on ne voit que les visites
    // qui nous sont affectées (et, avec le droit de conversion, les devis acceptés à convertir).
    if (!acc.isAdmin && (acc.isFieldOnly || !acc.perms.canEditDevis)) {
      const mine = acc.boundTech
        ? [{ visiteTechnicien: { contains: acc.boundTech, mode: 'insensitive' } }]
        : [];
      const toConvert =
        !acc.isFieldOnly && acc.perms.canConvertDevis
          ? [{ statutCommercial: { in: ['Accepté', 'Signé', 'Facturé', 'Gagné'] } }]
          : [];
      const scope = [...mine, ...toConvert];
      if (scope.length === 0) {
        return res.json({
          data: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        });
      }
      where.AND = [...(where.AND || []), { OR: scope }];
    }

    const [items, total] = await Promise.all([
      prisma.devis.findMany({
        where,
        include: { interventions: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.devis.count({ where }),
    ]);

    // Chaque rôle ne reçoit que ses champs (montants et détails internes retirés selon le rôle)
    let transformed = items.map((row: any) => shapeDevis(acc, transformDevis(row)) as any);
    if (status) {
      transformed = transformed.filter(
        (d: any) => d.status === status || d.traitement === status || d.statutCommercial === status
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

devisRouter.get(
  '/stats',
  policy('devis.stats'),
  asyncHandler(async (req: Request, res: Response) => {
    const acc = await loadAccess(req);
    if (acc.isFieldOnly) {
      throw new AppError(403, 'Statistiques non accessibles avec votre profil', 'FORBIDDEN');
    }
    const companyId = acc.companyId;
    const items = await prisma.devis.findMany({ where: { companyId } });
    const transformed = items.map(transformDevis);

    const result: Record<string, number> = {
      'a-traiter': 0,
      'en-cours': 0,
      'en-attente': 0,
      bloque: 0,
      traite: 0,
      devisATraiter: 0,
      devisBloques: 0,
      devisAcceptes: 0,
      relancesEnRetard: 0,
    };

    for (const d of transformed) {
      result[d.status] = (result[d.status] || 0) + 1;
      if (d.traitement === 'À traiter' || d.statutCommercial === 'À préparer') {
        result.devisATraiter += 1;
      }
      if (d.traitement === 'Bloqué') {
        result.devisBloques += 1;
      }
      if (d.statutCommercial === 'Accepté') {
        result.devisAcceptes += 1;
      }
      if (d.computed.alerte === 'Relance en retard' || d.computed.alerte === 'Réponse en retard') {
        result.relancesEnRetard += 1;
      }
    }

    res.json(result);
  })
);

devisRouter.get(
  '/:id',
  policy('devis.read'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const companyId = requireCompanyId(req.user?.companyId);
    const acc = await loadAccess(req);
    const devis = await prisma.devis.findFirst({
      where: { id, companyId },
      include: { interventions: true },
    });

    // Même règle que la liste : un devis qui n'est pas dans mon périmètre « n'existe pas » pour moi
    if (!devis || !canReadDevis(acc, devis)) {
      throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
    }

    res.json({ data: shapeDevis(acc, transformDevis(devis)) });
  })
);

devisRouter.post(
  '/',
  policy('devis.create'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';
    const b = req.body || {};

    // Contrôle d'accès : création de devis réservée au chiffrage ou à la direction
    const acc = await loadAccess(req);
    if (!acc.isAdmin && !acc.perms.canEditDevis) {
      throw new AppError(403, 'Permission insuffisante pour créer un devis', 'FORBIDDEN');
    }

    const client = String(b.client || 'Client à qualifier (Boîte de réception)').trim();
    const rawTraitement = b.traitement || (b.status ? statusCodeToTraitement(b.status) : 'À traiter');
    const rawStatutCommercial = b.statutCommercial || 'À préparer';
    const amountVal = acc.canSeeAmounts ? parseOptionalFloat(b.amount ?? b.montantHt) : null;
    const site = b.site || b.siteAdresse || null;
    const notes = b.notes || b.commentaires || null;
    const dateCreated = parseDateOrNull(b.dateCreated || b.dateDemande) || new Date();
    const visiteReq = Boolean(b.visiteNecessaire === true || b.visiteNecessaire === 'true' || rawTraitement === 'En attente technicien');
    const autoDevis = applyDevisAutomations({
      dateCreated,
      echeance: b.echeance || b.dateLimite,
      dateEnvoi: b.dateEnvoi,
      dateRelance: b.dateRelance,
      validiteJours: parseOptionalInt(b.validiteJours) ?? 30,
      statutCommercial: rawStatutCommercial,
      traitement: rawTraitement,
      prochaineAction: b.prochaineAction,
      amount: amountVal ?? 0,
      visiteNecessaire: visiteReq,
      visiteDate: b.visiteDate,
    });
    const statutCommercial = autoDevis.statutCommercial || rawStatutCommercial;
    const traitement = b.traitement || autoDevis.traitement || rawTraitement;
    const statusLegacy = traitementToStatusCode(traitement).toUpperCase().replace('-', '_');
    const echeance = parseDateOrNull(autoDevis.echeance);

    const historiqueJson = addHistoriqueEvent(
      null,
      auteur,
      'Demande de devis enregistrée',
      `${client}${site ? ` — Site : ${site}` : ''}${b.objet ? ` (${b.objet})` : ''}`
    );

    const created = await prisma.devis.create({
      data: {
        referenceMetier: b.reference || b.referenceMetier ? String(b.reference || b.referenceMetier).trim() : null,
        numeroDI: normalizeDI(b.numeroDI),
        client,
        siteAdresse: site ? String(site).trim() : null,
        objet: b.objet ? String(b.objet).trim() : null,
        corpsEtat: b.corpsEtat || 'Tous corps d’état',
        origine: b.origine || "Donneur d'ordre",
        dateCreated,
        dateDemande: dateCreated,
        echeance,
        dateLimite: echeance,
        dateEnvoi: parseDateOrNull(autoDevis.dateEnvoi),
        statutCommercial,
        traitement,
        status: statusLegacy,
        amount: amountVal ?? 0,
        montantHt: amountVal,
        tauxTVA: parseTauxTVA(b.tauxTVA),
        validiteJours: autoDevis.validiteJours ?? parseOptionalInt(b.validiteJours) ?? 30,
        prochaineAction: b.prochaineAction || autoDevis.prochaineAction || 'Chiffrer',
        dateRelance: parseDateOrNull(autoDevis.dateRelance),
        responsable: b.responsable || null,
        priorite: b.priorite || 'Normale',
        refInterventionTexte: b.refInterventionTexte || null,
        notes,
        commentaires: notes,
        visiteNecessaire: Boolean(
          b.visiteNecessaire === true || b.visiteNecessaire === 'true' || traitement === 'En attente technicien'
        ),
        visiteTechnicien: b.visiteTechnicien || null,
        visiteDate: parseDateOrNull(b.visiteDate),
        visiteHeureDebut: b.visiteHeureDebut || null,
        visiteHeureFin: b.visiteHeureFin || null,
        visiteStatut: b.visiteDate ? 'Planifiée' : 'À planifier',
        historiqueJson,
        userId,
        companyId,
      },
      include: { interventions: true },
    });

    if (!created.referenceMetier) {
      await prisma.devis.update({
        where: { id: created.id },
        data: { referenceMetier: await nextCompanyRef(companyId, 'DEV') },
      });
    }

    await syncVisiteDevisIntervention(created, userId, auteur);
    await syncDevisDossier(created, companyId);

    const refreshed = await prisma.devis.findUnique({
      where: { id: created.id },
      include: { interventions: true },
    });

    const transformed = transformDevis(refreshed);
    notify(() => socketEvents.devisCreated(userId, companyId, transformed));

    res.status(201).json({
      data: shapeDevis(acc, transformed),
      message: 'Devis créé avec succès',
    });
  })
);

devisRouter.patch(
  '/:id',
  policy('devis.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';

    const existing = await prisma.devis.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
    }

    // Contrôle d'accès par objet ET par champ
    const acc = await loadAccess(req);
    if (!canReadDevis(acc, existing)) {
      throw new AppError(403, 'Vous ne pouvez mettre à jour que les visites devis qui vous sont affectées', 'FORBIDDEN');
    }
    const limited = limitDevisBody(acc, req.body || {});
    if (limited.dropped.length > 0 && Object.keys(limited.clean).length === 0) {
      const refusal = describeRefusal('devis', limited.dropped);
      throw new AppError(403, refusal.message, 'FIELD_FORBIDDEN', refusal.parts);
    }
    const b = limited.clean;
    const refusalNotice = limited.dropped.length > 0 ? describeRefusal('devis', limited.dropped).message : undefined;

    const changes: string[] = [];
    if (b.statutCommercial && b.statutCommercial !== existing.statutCommercial) {
      changes.push(`Statut commercial : ${existing.statutCommercial} → ${b.statutCommercial}`);
    }
    const newTraitement =
      b.traitement !== undefined ? b.traitement : b.status ? statusCodeToTraitement(b.status) : undefined;
    if (newTraitement && newTraitement !== existing.traitement) {
      changes.push(`Traitement : ${existing.traitement || existing.status} → ${newTraitement}`);
    }

    let historiqueJson =
      changes.length > 0
        ? addHistoriqueEvent(existing.historiqueJson, auteur, 'Mise à jour du devis', changes.join(' • '))
        : existing.historiqueJson;

    if (b.gpsCloture && typeof b.gpsCloture === 'object') {
      const gpsPayload: GpsPositionPayload = {
        lat: Number(b.gpsCloture.lat),
        lng: Number(b.gpsCloture.lng),
        accuracy: b.gpsCloture.accuracy ? Number(b.gpsCloture.accuracy) : undefined,
        timestamp: b.gpsCloture.timestamp || new Date().toISOString(),
        technicien: String(b.gpsCloture.technicien || b.visiteTechnicien || existing.visiteTechnicien || auteur).trim(),
        missionId: -id,
        missionRef: String(b.reference || existing.referenceMetier || `DEV-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`),
        chantier: String(b.site || existing.siteAdresse || existing.client || ''),
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

    // Compte-rendu d'une visite technique saisi sur le terrain : conservé dans l'historique du devis
    if (typeof b.compteRendu === 'string' && b.compteRendu.trim()) {
      historiqueJson = addHistoriqueEvent(
        historiqueJson,
        auteur,
        'COMPTE_RENDU_VISITE',
        b.compteRendu.trim().slice(0, 4000)
      );
    }

    const updateData: any = {
      historiqueJson,
      version: { increment: 1 },
    };

    if (b.reference !== undefined || b.referenceMetier !== undefined) {
      updateData.referenceMetier = b.reference || b.referenceMetier || null;
    }
    if (b.numeroDI !== undefined) updateData.numeroDI = normalizeDI(b.numeroDI);
    if (b.client !== undefined) updateData.client = String(b.client).trim();
    if (b.site !== undefined || b.siteAdresse !== undefined) {
      updateData.siteAdresse = b.site ?? b.siteAdresse ?? null;
    }
    if (b.objet !== undefined) updateData.objet = b.objet || null;
    if (b.corpsEtat !== undefined) updateData.corpsEtat = b.corpsEtat || null;
    if (b.origine !== undefined) updateData.origine = b.origine || null;
    if (b.dateCreated !== undefined || b.dateDemande !== undefined) {
      const dt = parseDateOrNull(b.dateCreated ?? b.dateDemande) || existing.dateCreated;
      updateData.dateCreated = dt;
      updateData.dateDemande = dt;
    }
    if (b.echeance !== undefined || b.dateLimite !== undefined) {
      const dl = parseDateOrNull(b.echeance ?? b.dateLimite);
      updateData.echeance = dl;
      updateData.dateLimite = dl;
    }
    if (b.dateEnvoi !== undefined) updateData.dateEnvoi = parseDateOrNull(b.dateEnvoi);
    if (b.statutCommercial !== undefined) updateData.statutCommercial = b.statutCommercial;
    if (newTraitement !== undefined) {
      updateData.traitement = newTraitement;
      updateData.status = traitementToStatusCode(newTraitement).toUpperCase().replace('-', '_');
    }
    if (b.tauxTVA !== undefined) updateData.tauxTVA = parseTauxTVA(b.tauxTVA);
    if (b.amount !== undefined || b.montantHt !== undefined) {
      const m = parseOptionalFloat(b.amount ?? b.montantHt);
      updateData.montantHt = m;
      updateData.amount = m ?? 0;
    }
    if (b.validiteJours !== undefined) updateData.validiteJours = parseOptionalInt(b.validiteJours);
    if (b.prochaineAction !== undefined) updateData.prochaineAction = b.prochaineAction || null;
    if (b.dateRelance !== undefined) updateData.dateRelance = parseDateOrNull(b.dateRelance);
    if (b.responsable !== undefined) updateData.responsable = b.responsable || null;
    if (b.priorite !== undefined) updateData.priorite = b.priorite || 'Normale';
    if (b.refInterventionTexte !== undefined) updateData.refInterventionTexte = b.refInterventionTexte || null;
    if (b.notes !== undefined || b.commentaires !== undefined) {
      const n = b.notes ?? b.commentaires ?? null;
      updateData.notes = n;
      updateData.commentaires = n;
    }
    if (b.visiteNecessaire !== undefined) {
      updateData.visiteNecessaire = Boolean(b.visiteNecessaire === true || b.visiteNecessaire === 'true');
    }
    if (b.visiteTechnicien !== undefined) updateData.visiteTechnicien = b.visiteTechnicien || null;
    if (b.visiteDate !== undefined) updateData.visiteDate = parseDateOrNull(b.visiteDate);
    if (b.visiteHeureDebut !== undefined) updateData.visiteHeureDebut = b.visiteHeureDebut || null;
    if (b.visiteHeureFin !== undefined) updateData.visiteHeureFin = b.visiteHeureFin || null;
    if (b.visiteStatut !== undefined) updateData.visiteStatut = b.visiteStatut || null;
    if (b.photos !== undefined) updateData.visitePhotosJson = sanitizePhotosJson(b.photos);

    // ── Saisies automatiques ──────────────────────────────────────────────────
    // La prochaine action suit l'avancement quand la personne ne l'a pas changée
    // elle-même : un montant posé sur un devis à préparer => « Envoyer au client » ;
    // un devis qui passe à Accepté => « Planifier les travaux ».
    const candidateDevis = applyDevisAutomations(
      {
        dateCreated: updateData.dateCreated !== undefined ? updateData.dateCreated : existing.dateCreated,
        echeance: updateData.echeance !== undefined ? updateData.echeance : (existing.echeance ?? existing.dateLimite),
        dateEnvoi: updateData.dateEnvoi !== undefined ? updateData.dateEnvoi : existing.dateEnvoi,
        dateRelance: updateData.dateRelance !== undefined ? updateData.dateRelance : existing.dateRelance,
        validiteJours: updateData.validiteJours !== undefined ? updateData.validiteJours : existing.validiteJours,
        statutCommercial: updateData.statutCommercial !== undefined ? updateData.statutCommercial : existing.statutCommercial,
        traitement: updateData.traitement !== undefined ? updateData.traitement : existing.traitement,
        prochaineAction: updateData.prochaineAction !== undefined ? updateData.prochaineAction : existing.prochaineAction,
        amount: updateData.amount !== undefined ? updateData.amount : existing.amount,
        visiteNecessaire: updateData.visiteNecessaire !== undefined ? updateData.visiteNecessaire : existing.visiteNecessaire,
        visiteDate: updateData.visiteDate !== undefined ? updateData.visiteDate : existing.visiteDate,
      },
      existing as any
    );
    if (candidateDevis.statutCommercial && candidateDevis.statutCommercial !== existing.statutCommercial && b.statutCommercial === undefined) {
      updateData.statutCommercial = candidateDevis.statutCommercial;
    }
    if (b.dateEnvoi === undefined && candidateDevis.dateEnvoi && !existing.dateEnvoi) {
      updateData.dateEnvoi = parseDateOrNull(candidateDevis.dateEnvoi);
    }
    if (b.dateRelance === undefined && candidateDevis.dateRelance !== toISO(existing.dateRelance)) {
      updateData.dateRelance = parseDateOrNull(candidateDevis.dateRelance);
    }
    if (b.echeance === undefined && b.dateLimite === undefined && candidateDevis.echeance && candidateDevis.echeance !== toISO(existing.echeance ?? existing.dateLimite)) {
      const dlAuto = parseDateOrNull(candidateDevis.echeance);
      updateData.echeance = dlAuto;
      updateData.dateLimite = dlAuto;
    }
    if (newTraitement === undefined && candidateDevis.traitement && candidateDevis.traitement !== existing.traitement) {
      updateData.traitement = candidateDevis.traitement;
      updateData.status = traitementToStatusCode(candidateDevis.traitement).toUpperCase().replace('-', '_');
    }
    const paSoumise = b.prochaineAction !== undefined ? b.prochaineAction || null : undefined;
    const paInchangee = paSoumise === undefined || paSoumise === (existing.prochaineAction || null);
    if (paInchangee && candidateDevis.prochaineAction) {
      updateData.prochaineAction = candidateDevis.prochaineAction;
    }

    const updated = await prisma.devis.update({
      where: { id },
      data: updateData,
      include: { interventions: true },
    });

    await syncVisiteDevisIntervention(updated, userId, auteur);
    await syncDevisDossier(updated, companyId);

    // Devis modifié après envoi : le lien du client porte sur l'ancienne version, il est révoqué
    if (contenuDevisModifie(existing as any, updated as any) && (await revoquerLiensActifs(companyId, id, 'Devis modifié après envoi')) > 0) {
      await prisma.devis.update({
        where: { id },
        data: {
          historiqueJson: addHistoriqueEvent(
            updated.historiqueJson,
            'Automatique',
            'Automatique — lien client révoqué',
            'Le devis a été modifié après son envoi : renvoyez-le au client pour qu\'il réponde sur la bonne version'
          ),
        },
      });
    }

    const refreshed = await prisma.devis.findUnique({
      where: { id },
      include: { interventions: true },
    });

    const transformed = transformDevis(refreshed);
    notify(() => socketEvents.devisUpdated(userId, companyId, transformed));

    res.json({
      data: shapeDevis(acc, transformed),
      notice: refusalNotice,
      message: 'Devis mis à jour',
    });
  })
);

devisRouter.delete(
  '/:id',
  policy('devis.delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);

    const existing = await prisma.devis.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
    }

    // Contrôle d'accès : suppression de devis réservée aux profils autorisés
    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, technicienNom: true, permissionsJson: true },
    });
    const callerRole = (callerUser?.role || req.user?.role || '').toUpperCase();
    const callerPerms = getEffectivePermissions(callerRole, callerUser?.permissionsJson);
    const isAdmin = callerUser?.id === 1 || callerRole === 'ADMIN' || Boolean(callerPerms.canManageUsers);

    if (!isAdmin && !callerPerms.canDeleteRecords) {
      throw new AppError(403, 'Suppression de devis non autorisée sur ce profil', 'FORBIDDEN');
    }

    await prisma.devis.delete({ where: { id } });
    notify(() => socketEvents.devisDeleted(userId, companyId, { id }));

    res.json({ message: 'Devis supprimé' });
  })
);

devisRouter.post(
  '/:id/convert',
  policy('devis.convert'),
  asyncHandler(async (req: Request, res: Response) => {
    const devisId = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';
    const b = req.body || {};

    // Contrôle d'accès : conversion de devis réservée aux profils habilités
    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, permissionsJson: true },
    });
    const callerRole = (callerUser?.role || req.user?.role || '').toUpperCase();
    const callerPerms = getEffectivePermissions(callerRole, callerUser?.permissionsJson);
    const isAdmin = callerUser?.id === 1 || callerRole === 'ADMIN' || Boolean(callerPerms.canManageUsers);
    if (!isAdmin && !callerPerms.canConvertDevis && !callerPerms.canEditDevis) {
      throw new AppError(403, 'Permission insuffisante pour convertir un devis', 'FORBIDDEN');
    }

    // Si une clé d'idempotence stricte est fournie sans mode planning spécifique, on supporte aussi convertKeepingQuote
    const idempotencyKey = req.get('Idempotency-Key');
    if (idempotencyKey && !b.mode && b.isVisiteDevis === undefined) {
      const result = await convertKeepingQuote(userId, devisId, req.body, idempotencyKey);
      if (!result.replayed) notify(() => socketEvents.interventionCreated(result.ownerId, companyId, result.data));
      return res.status(result.replayed ? 200 : 201).json({
        data: result.data,
        replayed: result.replayed,
        message: result.replayed
          ? 'Demande déjà réalisée : aucune nouvelle intervention'
          : 'Intervention créée ; devis conservé',
      });
    }

    const devis = await prisma.devis.findFirst({
      where: { id: devisId, companyId },
      include: { interventions: true },
    });

    if (!devis) {
      throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
    }

    const isVisite = Boolean(b.isVisiteDevis || b.mode === 'visite');
    const refDevis = devis.referenceMetier || `DEV-${new Date().getFullYear()}-${String(devis.id).padStart(3, '0')}`;
    const datePlan = parseDateOrNull(b.datePlanifiee) || devis.visiteDate || new Date();
    const technicien = b.entreprise || devis.visiteTechnicien || null;
    const heureDebut = b.heureDebut || devis.visiteHeureDebut || '08:30';
    const heureFin = b.heureFin || devis.visiteHeureFin || '11:30';

    const ouvreAttente = technicien && (await reglagesSociete(companyId)).actif && (await comptesTechnicien(companyId, String(technicien))).length > 0;
    const intervention = await prisma.intervention.create({
      data: {
        ...(ouvreAttente ? { reponseTechnicien: 'EN_ATTENTE', affecteLe: new Date() } : {}),
        referenceMetier: isVisite ? await nextCompanyRef(companyId, 'VIS') : null,
        refDevisTexte: refDevis,
        numeroDI: devis.numeroDI || null,
        client: devis.client,
        chantier: devis.siteAdresse || devis.client,
        siteAdresse: devis.siteAdresse || devis.client,
        objet: isVisite
          ? `[Visite Devis] ${devis.objet || devis.client}`
          : devis.objet || `Travaux suite au devis ${refDevis}`,
        origine: devis.origine || 'Devis client',
        typeIntervention: isVisite ? 'Visite technique devis' : b.typeIntervention || 'Travaux complémentaires',
        modePlanification: b.datePlanifiee ? 'Planifiée' : 'Non planifiée',
        corpsEtat: devis.corpsEtat || 'Tous corps d’état',
        priorite: b.priorite || devis.priorite || 'Normale',
        dateDemande: new Date(),
        datePlanifiee: datePlan,
        statutOperationnel: b.datePlanifiee ? (technicien ? 'Planifiée' : 'À planifier') : 'À planifier',
        traitement: 'À traiter',
        status: 'A_TRAITER',
        entreprise: technicien,
        technicien,
        heureDebut,
        heureFin,
        isVisiteDevis: isVisite,
        amount: isVisite ? 0 : devis.amount || 0,
        notes: b.notes || devis.notes || null,
        origineDevisId: devis.id,
        origineDevisClient: devis.client,
        origineDevisDate: devis.dateCreated,
        devisId: devis.id,
        userId,
        companyId: devis.companyId || companyId,
        historiqueJson: addHistoriqueEvent(
          null,
          auteur,
          isVisite ? 'Visite technique créée depuis le devis' : 'Intervention créée depuis le devis',
          `Contexte copié depuis ${refDevis} (${devis.client})`
        ),
      },
    });

    if (!intervention.referenceMetier) {
      await prisma.intervention.update({
        where: { id: intervention.id },
        data: { referenceMetier: await nextCompanyRef(companyId, 'INT') },
      });
    }

    const refInterv = intervention.referenceMetier || `INT-${new Date().getFullYear()}-${String(intervention.id).padStart(3, '0')}`;

    const updatedDevis = await prisma.devis.update({
      where: { id: devisId },
      data: {
        refInterventionTexte: devis.refInterventionTexte
          ? `${devis.refInterventionTexte}, ${refInterv}`
          : refInterv,
        ...(isVisite
          ? {
              visiteNecessaire: true,
              visiteTechnicien: technicien,
              visiteDate: datePlan,
              visiteHeureDebut: heureDebut,
              visiteHeureFin: heureFin,
              visiteStatut: b.datePlanifiee ? 'Planifiée' : 'À planifier',
            }
          : {}),
        historiqueJson: addHistoriqueEvent(
          devis.historiqueJson,
          auteur,
          isVisite ? `Visite technique ${refInterv} liée` : `Intervention ${refInterv} créée et liée`,
          technicien ? `Technicien : ${technicien}` : 'À affecter dans le planning'
        ),
      },
      include: { interventions: true },
    });

    await prisma.demande.updateMany({ where: { devisId, companyId, interventionId: null }, data: { interventionId: intervention.id } });
    if (ouvreAttente) {
      await notifierAffectation(companyId, intervention).catch((e) => console.error('Notification affectation :', e?.message));
    }
    notify(() => socketEvents.devisUpdated(userId, companyId, transformDevis(updatedDevis)));
    notify(() => socketEvents.interventionCreated(userId, companyId, intervention));

    return res.status(201).json({
      data: intervention,
      devis: transformDevis(updatedDevis),
      message: isVisite
        ? 'Visite technique créée et ajoutée au planning (devis conservé)'
        : 'Intervention liée créée avec succès (devis conservé)',
    });
  })
);

// Envoi de proposition commerciale / devis par e-mail au client
devisRouter.post(
  '/:id/send-devis-email',
  policy('devis.sendEmail'),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = requireCompanyId(req.user?.companyId);
    const devisId = parseInt(req.params.id, 10);

    const devis = await prisma.devis.findFirst({
      where: { id: devisId, companyId },
      include: { interventions: true, company: true },
    });

    if (!devis) {
      throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
    }

    const { toEmail, ccEmail, subject, customMessage } = req.body || {};
    const rawTo = String(toEmail || '').trim();
    const validEmails = rawTo
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));

    if (validEmails.length === 0) {
      throw new AppError(400, 'Adresse e-mail de destinataire valide requise', 'VALIDATION_ERROR');
    }

    const senderEmail = req.user?.email || 'zehair@anelecgroupe.com';
    const senderName = req.user?.email ? req.user.email.split('@')[0] : 'Service Chiffrage & Devis';
    const companyName = devis.company?.name || 'ANELEC GROUPE';

    const delivery = await sendDevisProposalEmail({
      companyId,
      toEmail: validEmails.join(', '),
      ccEmail: ccEmail ? String(ccEmail).trim() : undefined,
      subject,
      customMessage,
      devis: {
        id: devis.id,
        referenceMetier: devis.referenceMetier,
        client: devis.client,
        siteAdresse: devis.siteAdresse,
        objet: devis.objet,
        corpsEtat: devis.corpsEtat,
        amount: devis.amount,
        statutCommercial: devis.statutCommercial,
      },
      senderName,
      senderEmail,
      companyName,
    });

    if (!delivery.sent) {
      throw new AppError(500, `Échec d'envoi de l'e-mail du devis : ${delivery.error || 'Erreur SMTP'}`, 'EMAIL_ERROR');
    }

    const updated = await prisma.devis.update({
      where: { id: devisId },
      data: {
        dateEnvoi: devis.dateEnvoi || new Date(),
        statutCommercial:
          devis.statutCommercial === 'Nouveau' || !devis.statutCommercial ? 'Devis envoyé' : devis.statutCommercial,
        historiqueJson: addHistoriqueEvent(
          devis.historiqueJson,
          senderName,
          'Proposition de devis envoyée par e-mail au client',
          `Destinataire : ${validEmails.join(', ')} • Canal : ${delivery.channel}`
        ),
      },
      include: { interventions: true },
    });

    const transformed = transformDevis(updated);
    res.json({
      success: true,
      data: transformed,
      deliveryChannel: delivery.channel,
      previewUrl: delivery.previewUrl || null,
      message: `Proposition de devis envoyée avec succès par e-mail à ${validEmails.join(', ')}`,
    });
  })
);


// ============================================================================
// DEVIS CLIENT — PDF importé, envoi par lien sécurisé, suivi des réponses
// ============================================================================

async function devisPourDocument(req: Request, exigerEcriture: boolean) {
  const companyId = requireCompanyId(req.user?.companyId);
  const id = parseInt(req.params.id, 10);
  const acc = await loadAccess(req);
  const devis = await prisma.devis.findFirst({ where: { id, companyId } });
  if (!devis || !canReadDevis(acc, devis)) throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
  return { companyId, acc, devis, id, exigerEcriture };
}

// Dépôt manuel du PDF du devis importé (JSON base64 : pas de dépendance d'envoi de fichiers)
devisRouter.post(
  '/:id/document',
  policy('devis.document'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, devis } = await devisPourDocument(req, true);
    const v = validerPdf(req.body?.nomFichier, req.body?.contenuBase64);
    if (!v.ok) throw new AppError(400, v.message, 'INVALID_PDF');
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';
    const doc = await (prisma as any).devisDocument.create({
      data: { companyId, devisId: devis.id, nomFichier: v.nom, taille: v.octets.length, sha256: v.sha256, contenu: v.octets, deposePar: auteur },
      select: { id: true, nomFichier: true, taille: true, createdAt: true, deposePar: true },
    });
    // Nouveau PDF = nouvelle version : un lien déjà envoyé porte sur l'ancienne
    const revoques = await revoquerLiensActifs(companyId, devis.id, 'Nouveau PDF déposé après envoi');
    await prisma.devis.update({
      where: { id: devis.id },
      data: {
        historiqueJson: addHistoriqueEvent(
          devis.historiqueJson,
          auteur,
          'PDF du devis déposé',
          `${v.nom} (${Math.round(v.octets.length / 1024)} Ko)` + (revoques ? ' • lien client précédent révoqué, renvoyez le devis' : '')
        ),
      },
    });
    res.status(201).json({
      data: { id: doc.id, nomFichier: doc.nomFichier, taille: doc.taille, createdAt: doc.createdAt, deposePar: doc.deposePar },
      lienRevoque: revoques > 0,
      message: 'PDF du devis enregistré',
    });
  })
);

devisRouter.get(
  '/:id/document',
  policy('devis.suiviClient'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, devis } = await devisPourDocument(req, false);
    const meta = await dernierDocument(companyId, devis.id);
    if (!meta) throw new AppError(404, 'Aucun PDF déposé pour ce devis', 'NOT_FOUND');
    const doc = await (prisma as any).devisDocument.findFirst({ where: { id: meta.id, companyId, devisId: devis.id } });
    if (!doc) throw new AppError(404, 'Aucun PDF déposé pour ce devis', 'NOT_FOUND');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nomFichier)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(Buffer.from(doc.contenu));
  })
);

// Suivi : PDF déposé, adresses de la fiche client, état du lien, relances faites, réponse du client
devisRouter.get(
  '/:id/envoi-client',
  policy('devis.suiviClient'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, devis } = await devisPourDocument(req, false);
    const [document, adr, liens] = await Promise.all([
      dernierDocument(companyId, devis.id),
      adressesPourDevis(companyId, devis.client),
      liensDuDevis(companyId, devis.id),
    ]);
    const dernier = liens[0] || null;
    res.json({
      data: {
        reference: referenceDevis(devis),
        document: document
          ? { id: document.id, nomFichier: document.nomFichier, taille: document.taille, deposeLe: document.createdAt, deposePar: document.deposePar }
          : null,
        ficheTrouvee: adr.ficheTrouvee,
        adresses: adr.adresses,
        lien: dernier
          ? {
              etat: etatLien(dernier),
              creeLe: dernier.createdAt,
              expireLe: dernier.expireLe,
              destinataires: (() => { try { return JSON.parse(dernier.destinataires || '[]'); } catch { return []; } })(),
              reponse: dernier.reponse,
              motif: dernier.motif,
              repondantNom: dernier.repondantNom,
              reponduLe: dernier.reponduLe,
              revoqueRaison: dernier.revoqueRaison,
              relanceJ3Le: devis.relanceClientJ3Le,
              relanceJ7Le: devis.relanceClientJ7Le,
            }
          : null,
      },
    });
  })
);

// Envoi au client : toujours un geste humain, avec confirmation de l'utilisateur
devisRouter.post(
  '/:id/envoyer-client',
  policy('devis.sendClient'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, devis } = await devisPourDocument(req, true);
    if (req.body?.confirme !== true) {
      throw new AppError(400, 'Confirmez avoir vérifié le devis avant de l\'envoyer au client.', 'CONFIRMATION_REQUISE');
    }
    if (['Accepté', 'Annulé'].includes(String(devis.statutCommercial || ''))) {
      throw new AppError(409, `Un devis « ${devis.statutCommercial} » ne peut plus être envoyé.`, 'STATUT_INVALIDE');
    }
    const auteur = req.user!.email.split('@')[0] || 'Utilisateur';
    const r = await envoyerAuClient({
      companyId,
      devis,
      adresseChoisies: req.body?.emails,
      auteur,
      replyTo: req.user?.email,
    });
    const refreshed = await prisma.devis.findUnique({ where: { id: devis.id }, include: { interventions: true } });
    const transformed = transformDevis(refreshed);
    notify(() => socketEvents.devisUpdated(req.user!.userId, companyId, transformed));
    res.json({
      data: transformed,
      envoyes: r.envoyes,
      echecs: r.echecs,
      message: `Devis envoyé à ${r.envoyes.join(', ')}` + (r.echecs.length ? ` (échec pour ${r.echecs.join(', ')})` : ''),
    });
  })
);
