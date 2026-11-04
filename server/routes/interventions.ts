// Interventions routes
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { socketEvents } from '../socket/index.js';

export const interventionRouter = Router();

// Validation schemas
const StatutIntervention = ['A_TRAITER', 'EN_COURS', 'EN_ATTENTE', 'BLOQUE', 'TRAITE'] as const;

const CreateInterventionSchema = z.object({
  chantier: z.string().min(1, 'Chantier/Lot est requis').max(200),
  entreprise: z.string().max(200).optional().nullable(),
  amount: z.number().nonnegative().default(0),
  datePlanifiee: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  dateReelle: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)').optional().nullable(),
  status: z.enum(['A_TRAITER', 'EN_COURS', 'EN_ATTENTE', 'BLOQUE', 'TRAITE']).default('A_TRAITER'),
  notes: z.string().max(2000).optional().nullable(),
  origineDevisId: z.number().int().positive().optional().nullable(),
  origineDevisClient: z.string().max(200).optional().nullable(),
  origineDevisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  devisId: z.number().int().positive().optional().nullable(),
});

const UpdateInterventionSchema = CreateInterventionSchema.partial();

// Helper
function mapStatutIntervention(statut: string): string {
  return statut.toLowerCase().replace('_', '-');
}

function transformIntervention(i: any) {
  return {
    id: i.id,
    chantier: i.chantier,
    entreprise: i.entreprise,
    amount: i.amount,
    datePlanifiee: i.datePlanifiee.toISOString().split('T')[0],
    dateReelle: i.dateReelle?.toISOString().split('T')[0] || null,
    status: i.status.toLowerCase().replace('_', '-'),
    notes: i.notes,
    origineDevisId: i.origineDevisId,
    origineDevisClient: i.origineDevisClient,
    origineDevisDate: i.origineDevisDate?.toISOString().split('T')[0] || null,
    createdAt: i.createdAt.getTime(),
    updatedAt: i.updatedAt.getTime(),
  };
}

// GET /api/interventions - List with pagination, search, filter
interventionRouter.get('/', async (req: Request, res: Response) => {
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
        { chantier: { contains: search, mode: 'insensitive' } },
        { entreprise: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
    ...(status ? { status: status.toUpperCase().replace('-', '_') } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.intervention.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.intervention.count({ where }),
  ]);

  res.json({
    data: items.map(transformIntervention),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/interventions/stats - Get counters by status
interventionRouter.get('/stats', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  const where = isAdmin ? {} : { userId };

  const stats = await prisma.intervention.groupBy({
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
    const key = mapStatutIntervention(s.status);
    result[key] = s._count;
  });

  res.json(result);
});

// GET /api/interventions/:id - Get single intervention
interventionRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  const intervention = await prisma.intervention.findFirst({
    where: { id, ...(isAdmin ? {} : { userId }) },
    include: { devis: true },
  });

  if (!intervention) {
    throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
  }

  res.json({ data: transformIntervention(intervention) });
});

// POST /api/interventions - Create intervention
interventionRouter.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const data = CreateInterventionSchema.parse(req.body);

  const intervention = await prisma.intervention.create({
    data: {
      ...data,
      datePlanifiee: new Date(data.datePlanifiee),
      dateReelle: data.dateReelle ? new Date(data.dateReelle) : null,
      status: data.status,
      userId,
      devisId: data.devisId || null,
    },
  });

  const transformed = transformIntervention(intervention);
  
  // Emit real-time event
  socketEvents.interventionCreated(userId, transformed);

  res.status(201).json({ data: transformed, message: 'Intervention créée avec succès' });
});

// PATCH /api/interventions/:id - Update intervention
interventionRouter.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const data = UpdateInterventionSchema.parse(req.body);

  // Check ownership
  const existing = await prisma.intervention.findFirst({
    where: { id, ...(isAdmin ? {} : { userId }) },
  });

  if (!existing) {
    throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
  }

  const updateData: any = { ...data };
  if (data.datePlanifiee) updateData.datePlanifiee = new Date(data.datePlanifiee);
  if (data.dateReelle) updateData.dateReelle = new Date(data.dateReelle);
  if (data.status) updateData.status = data.status;

  const intervention = await prisma.intervention.update({
    where: { id },
    data: updateData,
  });

  const transformed = transformIntervention(intervention);
  
  // Emit real-time event
  socketEvents.interventionUpdated(userId, transformed);

  res.json({ data: transformed, message: 'Intervention mise à jour' });
});

// DELETE /api/interventions/:id - Delete intervention
interventionRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  const existing = await prisma.intervention.findFirst({
    where: { id, ...(isAdmin ? {} : { userId }) },
  });

  if (!existing) {
    throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
  }

  await prisma.intervention.delete({ where: { id } });

  // Emit real-time event
  socketEvents.interventionDeleted(userId, { id });

  res.json({ message: 'Intervention supprimée' });
});