// Interventions routes - Full 23 ANELEC columns + Planning horaire + Synchronisation Visite Devis + Historique + PostgreSQL compatibility
import { Request, Response } from 'express';
import { normalizeDI, resolveInterventionDossier, pushDIToDevis, findDevisByDI } from '../lib/dossierDI.js';
import { policy, secureRouter } from '../lib/guard.js';
import { prisma } from '../lib/prisma.js';
import { requireCompanyId } from '../lib/tenant.js';
import { nextCompanyRef } from '../lib/companySeq.js';
import { loadAccess } from '../lib/loadAccess.js';
import { canReadIntervention, describeRefusal, limitInterventionBody, shapeIntervention } from '../lib/access.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { socketEvents } from '../socket/index.js';
import { sendInterventionReportEmail } from '../services/emailService.js';
import { saveTechnicienGpsPosition } from './referentiels.js';
import {
  ajouterHistorique,
  comptesTechnicien,
  notifier,
  notifierAffectation,
  notifierRefus,
  reglagesSociete,
  comptesPlanification,
} from '../services/technicianAutomation.js';
import { estNouvelleAffectation, validerReponse } from '../domain/technicianResponse.js';
import {
  computeInterventionCalculations,
  traitementToStatusCode,
  statusCodeToTraitement,
  HistoriqueEvent,
  GpsPositionPayload,
  getEffectivePermissions,
  applyInterventionAutomations,
} from '../../shared/types.js';

import { sanitizeAndOptimizePhotosJson } from '../lib/terrainPhotos.js';
import { validerPdf } from '../domain/devisClient.js';
import { preparerPdfDeposeCompresse } from '../services/pdfCompression.js';
import {
  STATUT_RESERVES,
  STATUT_VALIDE_CLIENT,
  choisirPhotos,
  contenuRapportModifie,
  envoiRapportAutorise,
} from '../domain/rapportClient.js';
import {
  adressesPourRapport,
  dernierDocumentRapport,
  envoyerRapportAuClient,
  etatLien as etatLienRapport,
  fabriquerPdf,
  liensDuRapport,
  photosDisponibles,
  revoquerLiensRapportActifs,
} from '../services/rapportClient.js';

/** Statuts posés UNIQUEMENT par la réponse du client sur son lien : jamais saisis à la main (pas de validation à sa place). */
const STATUTS_REPONSE_CLIENT = [STATUT_VALIDE_CLIENT, STATUT_RESERVES];
function refuserStatutClient(nouveau: unknown, actuel: unknown): void {
  const s = String(nouveau || '');
  if (STATUTS_REPONSE_CLIENT.includes(s) && s !== String(actuel || '')) {
    throw new AppError(
      403,
      `Le statut « ${s} » est posé uniquement par la réponse du client sur le lien envoyé : il ne peut pas être saisi à la main.`,
      'FORBIDDEN'
    );
  }
}

export const interventionRouter = secureRouter('interventions');

/**
 * Une NOUVELLE affectation ouvre l'attente de réponse du technicien, si l'automatisation est active pour la
 * société et que le technicien a un compte (sinon personne ne pourrait répondre : on ne bloque rien).
 */
async function attenteReponseSiAffectation(
  companyId: number,
  ancien: string | null | undefined,
  nouveau: string | null | undefined
): Promise<boolean> {
  if (!estNouvelleAffectation(ancien, nouveau)) return false;
  const reglages = await reglagesSociete(companyId);
  if (!reglages.actif) return false;
  return (await comptesTechnicien(companyId, String(nouveau))).length > 0;
}

const REPONSE_VIDE = {
  reponseTechnicien: null,
  reponseLe: null,
  motifRefus: null,
  affecteLe: null,
  relanceTechnicienLe: null,
  alertePlanificateurLe: null,
};

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
    reponseTechnicien: i.reponseTechnicien || null,
    reponseLe: i.reponseLe ? new Date(i.reponseLe).toISOString() : null,
    motifRefus: i.motifRefus || null,
    affecteLe: i.affecteLe ? new Date(i.affecteLe).toISOString() : null,
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

    const acc = await loadAccess(req);

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

    // Cloisonnement par rôle (décisions validées) : le terrain ne voit QUE ses missions, le chargé d'études
    // ne voit que les interventions rattachées à un devis ; sans nom de technicien, un profil terrain ne voit rien.
    if (acc.isFieldOnly) {
      where.AND = [
        ...(where.AND || []),
        acc.boundTech
          ? {
              OR: [
                { entreprise: { contains: acc.boundTech, mode: 'insensitive' } },
                { technicien: { contains: acc.boundTech, mode: 'insensitive' } },
              ],
            }
          : { id: -1 },
      ];
    } else {
      if (acc.linkedOnly) {
        where.AND = [
          ...(where.AND || []),
          { OR: [{ devisId: { not: null } }, { origineDevisId: { not: null } }, { isVisiteDevis: true }] },
        ];
      }
      if (technicienParam) {
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

    // Chaque rôle ne reçoit que ses champs (montants, facturation, historique interne retirés selon le rôle)
    let transformed = items.map((row: any) => shapeIntervention(acc, transformIntervention(row)) as any);

    if (status) {
      transformed = transformed.filter(
        (i: any) => i.status === status || i.traitement === status || i.statutOperationnel === status
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

    res.json({ data: shapeIntervention(acc, transformIntervention(intervention)) });
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

    // Contrôle d'accès : direction, planificateur, chargé d'études (visites de chiffrage uniquement)
    const acc = await loadAccess(req);
    const wantsVisite = Boolean(
      b.isVisiteDevis === true || b.isVisiteDevis === 'true' || b.typeIntervention === 'Visite technique devis'
    );
    if (acc.role === 'CHIFFRAGE_DEVIS' && !acc.isAdmin && !wantsVisite) {
      throw new AppError(403, 'Votre profil ne crée que des visites de chiffrage', 'FORBIDDEN');
    }

    const chantier = String(b.chantier || b.siteAdresse || b.site || b.client || 'Site à préciser').trim();
    const isVisiteDevis = Boolean(
      b.isVisiteDevis === true ||
        b.isVisiteDevis === 'true' ||
        b.typeIntervention === 'Visite technique devis'
    );
    const explicitDatePlan = parseDateOrNull(b.datePlanifiee);
    const tech = b.entreprise || b.technicien || null;
    const autoIntv = applyInterventionAutomations({
      dateDemande: b.dateDemande,
      datePlanifiee: explicitDatePlan ? toISO(explicitDatePlan) : null,
      echeance: b.echeance || b.dateEcheance,
      priorite: b.priorite || 'Normale',
      entreprise: tech,
      statutOperationnel: b.statutOperationnel || 'À planifier',
      traitement: b.traitement || (b.status ? statusCodeToTraitement(b.status) : 'À traiter'),
      heureDebut: b.heureDebut,
      heureFin: b.heureFin,
      motifBlocage: b.motifBlocage,
      numeroFacture: b.numeroFacture,
      statutFacture: b.statutFacture,
      statutRapport: b.statutRapport,
      dateReelle: b.dateReelle || b.dateFin,
    });
    const traitement = b.traitement || autoIntv.traitement || (b.status ? statusCodeToTraitement(b.status) : 'À traiter');
    const statusLegacy = traitementToStatusCode(traitement).toUpperCase().replace('-', '_');
    const statutOperationnel = b.statutOperationnel || autoIntv.statutOperationnel || 'À planifier';
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

    const ouvreAttente = await attenteReponseSiAffectation(companyId, null, tech);
    const created = await prisma.intervention.create({
      data: {
        ...(ouvreAttente ? { reponseTechnicien: 'EN_ATTENTE', affecteLe: new Date() } : {}),
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
        dateDemande: parseDateOrNull(autoIntv.dateDemande) || new Date(),
        datePlanifiee: explicitDatePlan || new Date(),
        statutOperationnel,
        traitement,
        status: statusLegacy,
        entreprise: tech,
        technicien: tech,
        dateDebut: parseDateOrNull(b.dateDebut),
        dateReelle: parseDateOrNull(autoIntv.dateReelle || b.dateReelle || b.dateFin),
        dateFin: parseDateOrNull(autoIntv.dateReelle || b.dateReelle || b.dateFin),
        dateEcheance: parseDateOrNull(autoIntv.echeance),
        resultatTechnique: b.resultatTechnique || null,
        motifBlocage: b.motifBlocage || null,
        numeroFacture: b.numeroFacture || null,
        statutFacture: autoIntv.statutFacture || b.statutFacture || 'Non facturée',
        compteRendu: b.compteRendu || null,
        notes: b.notes || null,
        amount: parseOptionalFloat(b.amount) ?? 0,
        tauxTVA: parseTauxTVA(b.tauxTVA),
        heureDebut: b.heureDebut || null,
        heureFin: b.heureFin || null,
        heureDebutReelle: b.heureDebutReelle || null,
        heureFinReelle: b.heureFinReelle || null,
        actionsRealiseesJson: Array.isArray(b.actionsRealisees) ? JSON.stringify(b.actionsRealisees) : null,
        photosJson: await sanitizeAndOptimizePhotosJson(b.photos),
        elementsChiffrage: b.elementsChiffrage || null,
        rapportFinal: b.rapportFinal || null,
        statutRapport: (refuserStatutClient(b.statutRapport, null), b.statutRapport || null),
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
      const autoRef = await nextCompanyRef(companyId, isVisiteDevis ? 'VIS' : 'INT');


      await prisma.intervention.update({
        where: { id: created.id },
        data: { referenceMetier: autoRef },
      });
      created.referenceMetier = autoRef;
    }

    if (ouvreAttente) {
      await notifierAffectation(companyId, created).catch((e) => console.error('Notification affectation :', e?.message));
    }

    const transformed = transformIntervention(created);
    try {
      socketEvents.interventionCreated(userId, companyId, transformed);
    } catch {
      console.error('Intervention saved; real-time creation notification failed.');
    }

    res.status(201).json({
      data: shapeIntervention(acc, transformed),
      message: 'Intervention créée avec succès',
    });
  })
);

interventionRouter.post(
  '/:id/reponse',
  policy('interventions.respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const companyId = requireCompanyId(req.user?.companyId);

    const existing: any = await prisma.intervention.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }
    const acc = await loadAccess(req);
    // Le technicien ne répond que pour SES missions
    if (!canReadIntervention(acc, existing)) {
      throw new AppError(403, 'Vous ne pouvez répondre que pour les missions qui vous sont attribuées', 'FORBIDDEN');
    }
    if (existing.reponseTechnicien !== 'EN_ATTENTE') {
      throw new AppError(409, 'Cette mission n\'attend plus de réponse de votre part.', 'NO_PENDING_RESPONSE');
    }
    const parsed = validerReponse(req.body);
    if (!parsed.ok) {
      throw new AppError(400, parsed.message, 'VALIDATION_ERROR');
    }
    const { reponse, motif } = parsed.value;
    const nom = acc.boundTech || String(existing.entreprise || '');
    const maintenant = new Date();

    let data: any;
    if (reponse === 'ACCEPTEE') {
      data = {
        reponseTechnicien: 'ACCEPTEE',
        reponseLe: maintenant,
        motifRefus: null,
        statutOperationnel: ['À planifier', 'Planifiée', 'Nouvelle demande'].includes(String(existing.statutOperationnel || 'Planifiée'))
          ? 'Affectée'
          : existing.statutOperationnel,
        historiqueJson: ajouterHistorique(existing.historiqueJson, nom, 'Mission acceptée par le technicien', `${nom} a accepté la mission`),
        version: { increment: 1 },
      };
    } else {
      data = {
        reponseTechnicien: 'REFUSEE',
        reponseLe: maintenant,
        motifRefus: motif,
        entreprise: null,
        technicien: null,
        statutOperationnel: 'À planifier',
        relanceTechnicienLe: null,
        alertePlanificateurLe: null,
        historiqueJson: ajouterHistorique(existing.historiqueJson, nom, 'Mission refusée par le technicien', `Motif : ${motif} • Retour au bac « À planifier »`),
        version: { increment: 1 },
      };
    }
    const updated: any = await prisma.intervention.update({ where: { id }, data });

    let remplacants: string[] = [];
    if (reponse === 'REFUSEE') {
      remplacants = await notifierRefus(companyId, existing, nom, motif).catch(() => []);
    } else {
      const planif = await comptesPlanification(companyId);
      await notifier(companyId, planif, {
        type: 'MISSION_ACCEPTEE',
        titre: 'Mission acceptée',
        message: `${nom} a accepté ${existing.referenceMetier || `INT-${id}`}.`,
        interventionId: id,
      }).catch(() => undefined);
    }

    const result = transformIntervention(updated);
    try {
      socketEvents.interventionUpdated(userId, companyId, result);
    } catch {
      // ignore socket notification error
    }
    res.json({
      data: shapeIntervention(acc, result),
      remplacantsSuggeres: acc.isFieldOnly ? undefined : remplacants,
      message: reponse === 'ACCEPTEE' ? 'Mission acceptée' : 'Mission refusée : le planificateur est prévenu',
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

    const existing = await prisma.intervention.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
    }

    // Contrôle d'accès par objet ET par champ : chaque rôle ne modifie que ses propres champs.
    const acc = await loadAccess(req);
    if (!canReadIntervention(acc, existing)) {
      throw new AppError(403, 'Vous ne pouvez modifier que les interventions qui vous sont attribuées', 'FORBIDDEN');
    }
    const limited = limitInterventionBody(acc, req.body || {}, existing);
    if (limited.dropped.length > 0 && Object.keys(limited.clean).length === 0) {
      const refusal = describeRefusal('intervention', limited.dropped);
      throw new AppError(403, refusal.message, 'FIELD_FORBIDDEN', refusal.parts);
    }
    const b = limited.clean;
    const refusalNotice = limited.dropped.length > 0 ? describeRefusal('intervention', limited.dropped).message : undefined;

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
    // Démarrer la mission vaut acceptation : l'attente de réponse se referme d'elle-même
    if (
      acc.isFieldOnly &&
      (existing as any).reponseTechnicien === 'EN_ATTENTE' &&
      ['En route', 'Sur site', 'En cours', 'Terminée - à valider'].includes(String(b.statutOperationnel || ''))
    ) {
      updateData.reponseTechnicien = 'ACCEPTEE';
      updateData.reponseLe = new Date();
      updateData.historiqueJson = ajouterHistorique(
        updateData.historiqueJson,
        'Automatique',
        'Automatique — mission acceptée',
        `${existing.entreprise || 'Le technicien'} a démarré la mission sans répondre : considérée comme acceptée`
      );
    }

    let nouvelleAffectation = false;
    if (b.entreprise !== undefined || b.technicien !== undefined) {
      const t = b.entreprise ?? b.technicien ?? null;
      updateData.entreprise = t;
      updateData.technicien = t;
      // Changement de technicien : l'ancienne réponse ne vaut plus ; une nouvelle attente s'ouvre si besoin
      if (estNouvelleAffectation(existing.entreprise, t) || (!t && existing.entreprise)) {
        Object.assign(updateData, REPONSE_VIDE);
        if (await attenteReponseSiAffectation(companyId, existing.entreprise, t)) {
          updateData.reponseTechnicien = 'EN_ATTENTE';
          updateData.affecteLe = new Date();
          nouvelleAffectation = true;
        }
      }
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
      updateData.photosJson = await sanitizeAndOptimizePhotosJson(b.photos);
    }
    if (b.elementsChiffrage !== undefined) updateData.elementsChiffrage = b.elementsChiffrage || null;
    if (b.rapportFinal !== undefined) updateData.rapportFinal = b.rapportFinal || null;
    if (b.statutRapport !== undefined) {
      refuserStatutClient(b.statutRapport, existing.statutRapport);
      updateData.statutRapport = b.statutRapport || null;
    }
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

    // Automations transverses (SLA échéance, Affectée/Planifiée, Blocage, Facturée)
    const clearedPlan = b.datePlanifiee === null;
    const autoPatched = applyInterventionAutomations(
      {
        dateDemande: updateData.dateDemande !== undefined ? updateData.dateDemande : existing.dateDemande,
        datePlanifiee: clearedPlan ? null : (updateData.datePlanifiee !== undefined ? updateData.datePlanifiee : existing.datePlanifiee),
        echeance: updateData.dateEcheance !== undefined ? updateData.dateEcheance : existing.dateEcheance,
        priorite: updateData.priorite !== undefined ? updateData.priorite : existing.priorite,
        entreprise: updateData.entreprise !== undefined ? updateData.entreprise : existing.entreprise,
        statutOperationnel: updateData.statutOperationnel !== undefined ? updateData.statutOperationnel : existing.statutOperationnel,
        traitement: updateData.traitement !== undefined ? updateData.traitement : existing.traitement,
        heureDebut: updateData.heureDebut !== undefined ? updateData.heureDebut : existing.heureDebut,
        heureFin: updateData.heureFin !== undefined ? updateData.heureFin : existing.heureFin,
        motifBlocage: updateData.motifBlocage !== undefined ? updateData.motifBlocage : existing.motifBlocage,
        numeroFacture: updateData.numeroFacture !== undefined ? updateData.numeroFacture : existing.numeroFacture,
        statutFacture: updateData.statutFacture !== undefined ? updateData.statutFacture : existing.statutFacture,
        statutRapport: updateData.statutRapport !== undefined ? updateData.statutRapport : existing.statutRapport,
        dateReelle: updateData.dateReelle !== undefined ? updateData.dateReelle : existing.dateReelle,
      },
      existing as any
    );
    if (b.statutOperationnel === undefined && autoPatched.statutOperationnel && autoPatched.statutOperationnel !== existing.statutOperationnel) {
      updateData.statutOperationnel = autoPatched.statutOperationnel;
    }
    if (b.echeance === undefined && b.dateEcheance === undefined && autoPatched.echeance && autoPatched.echeance !== toISO(existing.dateEcheance)) {
      updateData.dateEcheance = parseDateOrNull(autoPatched.echeance);
    }
    if (b.statutFacture === undefined && autoPatched.statutFacture && autoPatched.statutFacture !== existing.statutFacture) {
      updateData.statutFacture = autoPatched.statutFacture;
    }
    if (newTraitement === undefined && autoPatched.traitement && autoPatched.traitement !== existing.traitement) {
      updateData.traitement = autoPatched.traitement;
      updateData.status = traitementToStatusCode(autoPatched.traitement).toUpperCase().replace('-', '_');
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

    // Rapport modifié après envoi : le lien du client porte sur l'ancienne version, il est révoqué
    if (contenuRapportModifie(existing as any, updated as any)) {
      const revoques = await revoquerLiensRapportActifs(companyId, id, 'Rapport modifié après envoi');
      const dejaValide = String(existing.statutRapport || '') === STATUT_VALIDE_CLIENT;
      if (revoques > 0 || dejaValide) {
        await prisma.intervention.update({
          where: { id },
          data: {
            historiqueJson: ajouterHistorique(
              updated.historiqueJson,
              'Automatique',
              revoques > 0 ? 'Automatique — lien du rapport révoqué' : 'Automatique — rapport modifié après validation du client',
              revoques > 0
                ? "Le rapport a été modifié après son envoi : renvoyez-le au client pour qu'il réponde sur la bonne version"
                : 'La version validée par le client n’est plus identique au rapport actuel'
            ),
          },
        });
      }
    }

    if (nouvelleAffectation) {
      await notifierAffectation(companyId, updated).catch((e) => console.error('Notification affectation :', e?.message));
    }

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
      data: shapeIntervention(acc, transformed),
      notice: refusalNotice,
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

// POST /api/interventions/:id/send-report-email — ANCIEN envoi direct, retiré.
// Il passait le rapport à « Envoyé au client » sans lien sécurisé ni réponse du client. Remplacé par
// POST /api/interventions/:id/rapport-envoyer-client (lien personnel, validation ou réserves, relances).
interventionRouter.post(
  '/:id/send-report-email',
  policy('interventions.sendReport'),
  asyncHandler(async () => {
    throw new AppError(
      410,
      'Cet envoi direct n’existe plus : utilisez « Envoyer le rapport au client » (lien sécurisé avec validation ou réserves du client).',
      'ENVOI_DIRECT_RETIRE'
    );
  })
);


// ============================================================================
// RAPPORT CLIENT — PDF généré ou déposé, envoi par lien sécurisé, suivi des réponses
// ============================================================================

async function interventionPourRapport(req: Request) {
  const companyId = requireCompanyId(req.user?.companyId);
  const id = parseInt(req.params.id, 10);
  const acc = await loadAccess(req);
  const intervention = await prisma.intervention.findFirst({ where: { id, companyId } });
  if (!intervention || !canReadIntervention(acc, intervention)) {
    throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
  }
  return { companyId, intervention: intervention as any, acc };
}

const auteurDe = (req: Request) => req.user!.email.split('@')[0] || 'Utilisateur';

// Dépôt manuel du PDF du rapport (JSON base64 : pas de dépendance d'envoi de fichiers)
interventionRouter.post(
  '/:id/rapport-document',
  policy('rapports.document'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, intervention } = await interventionPourRapport(req);
    const v = validerPdf(req.body?.nomFichier, req.body?.contenuBase64, 'rapport');
    if (!v.ok) throw new AppError(400, v.message, 'INVALID_PDF');
    const auteur = auteurDe(req);
    const pret = await preparerPdfDeposeCompresse(v.octets);
    const doc = await (prisma as any).rapportDocument.create({
      data: {
        companyId, interventionId: intervention.id, nomFichier: v.nom, taille: pret.octets.length, sha256: pret.sha256,
        contenu: pret.octets, origine: 'DEPOSE', deposePar: auteur,
      },
      select: { id: true, nomFichier: true, taille: true, origine: true, createdAt: true, deposePar: true },
    });
    // Nouveau PDF = nouvelle version : un lien déjà envoyé porte sur l'ancienne
    const revoques = await revoquerLiensRapportActifs(companyId, intervention.id, 'Nouveau PDF déposé après envoi');
    await prisma.intervention.update({
      where: { id: intervention.id },
      data: {
        historiqueJson: ajouterHistorique(
          intervention.historiqueJson,
          auteur,
          'PDF du rapport déposé',
          `${v.nom} (${Math.round(pret.octets.length / 1024)} Ko)` + (revoques ? ' • lien client précédent révoqué, renvoyez le rapport' : '')
        ),
      },
    });
    res.status(201).json({ data: doc, lienRevoque: revoques > 0, message: 'PDF du rapport enregistré' });
  })
);

// Téléchargement du dernier PDF (déposé ou généré) par l'équipe
interventionRouter.get(
  '/:id/rapport-document',
  policy('rapports.suiviClient'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, intervention } = await interventionPourRapport(req);
    const origine = req.query.origine === 'GENERE' || req.query.origine === 'DEPOSE' ? (req.query.origine as 'GENERE' | 'DEPOSE') : undefined;
    const meta = await dernierDocumentRapport(companyId, intervention.id, origine);
    if (!meta) throw new AppError(404, 'Aucun PDF pour ce rapport', 'NOT_FOUND');
    const doc = await (prisma as any).rapportDocument.findFirst({ where: { id: meta.id, companyId, interventionId: intervention.id } });
    if (!doc) throw new AppError(404, 'Aucun PDF pour ce rapport', 'NOT_FOUND');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nomFichier)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(Buffer.from(doc.contenu));
  })
);

// Aperçu du PDF qui serait généré avec les photos cochées (rien n'est enregistré ni envoyé)
interventionRouter.post(
  '/:id/rapport-apercu',
  policy('rapports.document'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, intervention } = await interventionPourRapport(req);
    const dispo = photosDisponibles(intervention);
    const choix = choisirPhotos(dispo, { toutes: req.body?.toutesPhotos, ids: req.body?.photoIds });
    if (!choix.ok) throw new AppError(422, choix.message, 'PHOTO_INCONNUE');
    const pdf = await fabriquerPdf(companyId, intervention, dispo.filter((p) => choix.ids.includes(p.id)));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="apercu-rapport.pdf"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  })
);

// Suivi : photos, PDF déposé, adresses de la fiche client, état du lien, relances, réponse du client
interventionRouter.get(
  '/:id/rapport-client',
  policy('rapports.suiviClient'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, intervention } = await interventionPourRapport(req);
    const [deposee, adr, liens] = await Promise.all([
      dernierDocumentRapport(companyId, intervention.id, 'DEPOSE'),
      adressesPourRapport(companyId, intervention.client),
      liensDuRapport(companyId, intervention.id),
    ]);
    const dernier = liens[0] || null;
    const autorise = envoiRapportAutorise(intervention.statutRapport);
    res.json({
      data: {
        statutRapport: intervention.statutRapport || null,
        envoiPossible: autorise.ok,
        envoiRefus: autorise.ok ? null : autorise.message,
        photos: photosDisponibles(intervention).map((p) => ({ id: p.id, caption: p.caption, category: p.category, url: undefined })),
        nbPhotosTotal: (() => { try { const a = JSON.parse(intervention.photosJson || '[]'); return Array.isArray(a) ? a.length : 0; } catch { return 0; } })(),
        documentDepose: deposee
          ? { id: deposee.id, nomFichier: deposee.nomFichier, taille: deposee.taille, deposeLe: deposee.createdAt, deposePar: deposee.deposePar }
          : null,
        ficheTrouvee: adr.ficheTrouvee,
        adresses: adr.adresses,
        lien: dernier
          ? {
              etat: etatLienRapport(dernier),
              creeLe: dernier.createdAt,
              expireLe: dernier.expireLe,
              destinataires: (() => { try { return JSON.parse(dernier.destinataires || '[]'); } catch { return []; } })(),
              nbPhotos: (() => { try { return (JSON.parse(dernier.contenuJson || '{}').photos || []).length; } catch { return 0; } })(),
              reponse: dernier.reponse,
              motif: dernier.motif,
              repondantNom: dernier.repondantNom,
              reponduLe: dernier.reponduLe,
              revoqueRaison: dernier.revoqueRaison,
              relanceJ3Le: intervention.relanceClientJ3Le,
              relanceJ7Le: intervention.relanceClientJ7Le,
            }
          : null,
      },
    });
  })
);

// Photo (miniature) pour l'équipe : sert la sélection « Tout cocher / photos choisies »
interventionRouter.get(
  '/:id/rapport-photos/:photoId',
  policy('rapports.suiviClient'),
  asyncHandler(async (req: Request, res: Response) => {
    const { intervention } = await interventionPourRapport(req);
    const { octetsPhoto } = await import('../services/rapportClient.js');
    const photo = octetsPhoto(intervention, String(req.params.photoId || ''));
    if (!photo) throw new AppError(404, 'Photo introuvable', 'NOT_FOUND');
    res.setHeader('Content-Type', `image/${photo.type}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(photo.octets);
  })
);

// Envoi au client : toujours un geste humain, avec confirmation de l'utilisateur
interventionRouter.post(
  '/:id/rapport-envoyer-client',
  policy('rapports.sendClient'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, intervention } = await interventionPourRapport(req);
    if (req.body?.confirme !== true) {
      throw new AppError(400, "Confirmez avoir vérifié le rapport avant de l'envoyer au client.", 'CONFIRMATION_REQUISE');
    }
    const source = req.body?.source === 'DEPOSE' ? 'DEPOSE' : 'GENERE';
    const r = await envoyerRapportAuClient({
      companyId,
      intervention,
      source,
      photos: { toutes: req.body?.toutesPhotos, ids: req.body?.photoIds },
      adresseChoisies: req.body?.emails,
      auteur: auteurDe(req),
      replyTo: req.user?.email,
    });
    const refreshed = await prisma.intervention.findUnique({ where: { id: intervention.id } });
    const transformed = transformIntervention(refreshed);
    try {
      socketEvents.interventionUpdated(req.user!.userId, companyId, transformed);
    } catch {
      /* temps réel facultatif */
    }
    res.json({
      data: transformed,
      envoyes: r.envoyes,
      echecs: r.echecs,
      message: `Rapport envoyé à ${r.envoyes.join(', ')}` + (r.echecs.length ? ` (échec pour ${r.echecs.join(', ')})` : ''),
    });
  })
);
