// Devis routes
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { socketEvents } from '../socket/index.js';

export const devisRouter = Router();

// Validation schemas
const StatutDevis = ['A_TRAITER', 'EN_COURS', 'EN_ATTENTE', 'BLOQUE', 'TRAITE'] as const;
const StatutIntervention = ['A_TRAITER', 'EN_COURS', 'EN_ATTENTE', 'BLOQUE', 'TRAITE'] as const;

const CreateDevisSchema = z.object({
  client: z.string().min(1, 'Client/Projet est requis').max(200),
  amount: z.number().nonnegative().default(0),
  dateCreated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)').optional().nullable(),
  status: z.enum(StatutDevis).default('A_TRAITER'),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateDevisSchema = CreateDevisSchema.partial();

const ConvertDevisSchema = z.object({
  entreprise: z.string().max(200).optional().nullable(),
  datePlanifiee: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Helper: map Prisma enum to shared format
function mapStatutDevis(statut: string): string {
  return statut.toLowerCase().replace('_', '-');
}

function mapStatutIntervention(statut: string): string {
  return statut.toLowerCase().replace('_', '-');
}

function transformDevis(d: any) {
  return {
    id: d.id,
    client: d.client,
    amount: d.amount,
    dateCreated: d.dateCreated.toISOString().split('T')[0],
    echeance: d.echeance?.toISOString().split('T')[0] || null,
    status: mapStatutDevis(d.status),
    notes: d.notes,
    createdAt: d.createdAt.getTime(),
    updatedAt: d.updatedAt.getTime(),
  };
}

// GET /api/devis - List with pagination, search, filter
devisRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const search = req.query.search as string || '';
  const status = req.query.status as string || '';
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const where: any = {
    ...(isAdmin ? {} : { userId }),
    ...(search ? {
      OR: [
        { client: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
    ...(status ? { status: status.toUpperCase().replace('-', '_') } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.devis.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.devis.count({ where }),
  ]);

  res.json({
    data: items.map(transformDevis),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/devis/stats - Get counters by status
devisRouter.get('/stats', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  const where = isAdmin ? {} : { userId };

  const stats = await prisma.devis.groupBy({
    by: ['status'],
    where,
    _count: true,
  });

  const result: Record<string, number> = {
    'a-traiter': 0,
    'en-cours': 0,
    'en-attente': 0,
    'bloque': 0,
    'traite': 0,
  };

  stats.forEach((s: { status: string; _count: number }) => {
    const key = mapStatutDevis(s.status);
    result[key] = s._count;
  });

  res.json(result);
});

// GET /api/devis/:id - Get single devis
devisRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  const devis = await prisma.devis.findFirst({
    where: { id, ...(isAdmin ? {} : { userId }) },
    include: { interventions: true },
  });

  if (!devis) {
    throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
  }

  res.json({ data: transformDevis(devis) });
});

// POST /api/devis - Create devis
devisRouter.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const data = CreateDevisSchema.parse(req.body);

  const devis = await prisma.devis.create({
    data: {
      ...data,
      dateCreated: new Date(data.dateCreated),
      echeance: data.echeance ? new Date(data.echeance) : null,
      status: data.status,
      userId,
    },
  });

  const transformed = transformDevis(devis);
  
  // Emit real-time event
  socketEvents.devisCreated(userId, transformed);

  res.status(201).json({ data: transformed, message: 'Devis créé avec succès' });
});

// PATCH /api/devis/:id - Update devis
devisRouter.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const data = UpdateDevisSchema.parse(req.body);

  // Check ownership
  const existing = await prisma.devis.findFirst({
    where: { id, ...(isAdmin ? {} : { userId }) },
  });

  if (!existing) {
    throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
  }

  const updateData: any = { ...data };
  if (data.dateCreated) updateData.dateCreated = new Date(data.dateCreated);
  if (data.echeance) updateData.echeance = new Date(data.echeance);
  if (data.status) updateData.status = data.status;

  const devis = await prisma.devis.update({
    where: { id },
    data: updateData,
  });

  const transformed = transformDevis(devis);
  
  // Emit real-time event
  socketEvents.devisUpdated(userId, transformed);

  res.json({ data: transformed, message: 'Devis mis à jour' });
});

// DELETE /api/devis/:id - Delete devis
devisRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  const existing = await prisma.devis.findFirst({
    where: { id, ...(isAdmin ? {} : { userId }) },
  });

  if (!existing) {
    throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
  }

  await prisma.devis.delete({ where: { id } });

  // Emit real-time event
  socketEvents.devisDeleted(userId, { id });

  res.json({ message: 'Devis supprimé' });
});

// POST /api/devis/:id/convert - Convert devis to intervention
devisRouter.post('/:id/convert', async (req: Request, res: Response) => {
  const devisId = parseInt(req.params.id, 10);
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const data = ConvertDevisSchema.parse(req.body);

  // Get devis with ownership check
  const devis = await prisma.devis.findFirst({
    where: { id: devisId, ...(isAdmin ? {} : { userId }) },
  });

  if (!devis) {
    throw new AppError(404, 'Devis non trouvé', 'NOT_FOUND');
  }

  // Create intervention from devis
  const intervention = await prisma.intervention.create({
    data: {
      chantier: devis.client,
      entreprise: data.entreprise || null,
      amount: devis.amount,
      datePlanifiee: data.datePlanifiee ? new Date(data.datePlanifiee) : (devis.echeance || new Date()),
      dateReelle: null,
      status: 'A_TRAITER',
      notes: [
        devis.notes,
        data.notes,
        `--- Converti depuis le devis #${devis.id} du ${devis.dateCreated.toISOString().split('T')[0]} ---`,
        `Client d'origine: ${devis.client}`,
        `Montant devis: ${devis.amount} €`,
        `Statut devis: ${devis.status}`,
      ].filter(Boolean).join('\n\n'),
      origineDevisId: devis.id,
      origineDevisClient: devis.client,
      origineDevisDate: devis.dateCreated,
      userId,
      devisId: devis.id,
    },
  });

  // Delete the devis (moved to intervention)
  await prisma.devis.delete({ where: { id: devisId } });

  const transformedIntervention = {
    id: intervention.id,
    chantier: intervention.chantier,
    entreprise: intervention.entreprise,
    amount: intervention.amount,
    datePlanifiee: intervention.datePlanifiee.toISOString().split('T')[0],
    dateReelle: intervention.dateReelle?.toISOString().split('T')[0] || null,
    status: mapStatutIntervention(intervention.status),
    notes: intervention.notes,
    origineDevisId: intervention.origineDevisId,
    origineDevisClient: intervention.origineDevisClient,
    origineDevisDate: intervention.origineDevisDate?.toISOString().split('T')[0],
    createdAt: intervention.createdAt.getTime(),
    updatedAt: intervention.updatedAt.getTime(),
  };

  // Emit real-time events
  socketEvents.devisDeleted(userId, { id: devisId });
  socketEvents.interventionCreated(userId, transformedIntervention);

  res.status(201).json({ 
    data: transformedIntervention, 
    message: 'Devis converti en intervention avec succès' 
  });
});