import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { z } from 'zod';
import { socketEvents } from '../socket/index.js';

export const interventionRouter = Router();
const statuses = ['A_TRAITER', 'EN_COURS', 'EN_ATTENTE', 'BLOQUE', 'TRAITE'] as const;

const AmountSchema = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (text === '') return 0;
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return value;
  return Number(text.replace(',', '.'));
}, z.number().finite().nonnegative('Le montant doit être positif ou nul'));

const StatusSchema = z.preprocess(value =>
  typeof value === 'string' ? value.trim().toUpperCase().replace(/-/g, '_') : value,
  z.enum(statuses)
);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ').refine(value => {
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Date invalide');
const OptionalDateSchema = z.preprocess(value => value === '' ? null : value, DateSchema.nullable());
const Fields = z.object({
  chantier: z.string().trim().min(1, 'Chantier/Lot est requis').max(200),
  entreprise: z.string().max(200).nullable(),
  amount: AmountSchema,
  datePlanifiee: DateSchema,
  dateReelle: OptionalDateSchema,
  status: StatusSchema,
  notes: z.string().max(2000).nullable(),
  origineDevisId: z.number().int().positive().nullable(),
  origineDevisClient: z.string().max(200).nullable(),
  origineDevisDate: OptionalDateSchema,
  devisId: z.number().int().positive().nullable(),
});
const CreateSchema = Fields.partial().extend({
  chantier: Fields.shape.chantier,
  datePlanifiee: DateSchema,
  amount: AmountSchema.default(0),
  status: StatusSchema.default('A_TRAITER'),
});
const UpdateSchema = Fields.partial();
const IdSchema = z.coerce.number().int().positive();
const PageSchema = z.coerce.number().int().min(1);
const LimitSchema = z.coerce.number().int().min(1).max(100);

function mapStatus(status: string) {
  return status.toLowerCase().replace(/_/g, '-');
}
function transformIntervention(i: any) {
  return {
    id: i.id, chantier: i.chantier, entreprise: i.entreprise, amount: i.amount,
    datePlanifiee: i.datePlanifiee.toISOString().slice(0, 10),
    dateReelle: i.dateReelle?.toISOString().slice(0, 10) || null,
    status: mapStatus(i.status), notes: i.notes,
    origineDevisId: i.origineDevisId, origineDevisClient: i.origineDevisClient,
    origineDevisDate: i.origineDevisDate?.toISOString().slice(0, 10) || null,
    createdAt: i.createdAt.getTime(), updatedAt: i.updatedAt.getTime(),
  };
}
function dateValue(value: string | null | undefined) {
  return value ? new Date(value + 'T00:00:00.000Z') : null;
}
async function checkDevis(devisId: number | null | undefined, userId: number, isAdmin: boolean) {
  if (devisId == null) return;
  const devis = await prisma.devis.findFirst({ where: { id: devisId, ...(isAdmin ? {} : { userId }) }, select: { id: true } });
  if (!devis) throw new AppError(404, 'Devis lié introuvable ou inaccessible', 'NOT_FOUND');
}

interventionRouter.get('/', asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const status = req.query.status ? StatusSchema.parse(req.query.status) : undefined;
  const page = PageSchema.parse(req.query.page ?? 1);
  const limit = LimitSchema.parse(req.query.limit ?? 50);
  const where: any = {
    ...(isAdmin ? {} : { userId }),
    ...(search ? { OR: [
      { chantier: { contains: search, mode: 'insensitive' } },
      { entreprise: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ] } : {}),
    ...(status ? { status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.intervention.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.intervention.count({ where }),
  ]);
  res.json({ data: items.map(transformIntervention), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

interventionRouter.get('/stats', asyncHandler(async (req, res) => {
  const where = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.userId };
  const stats = await prisma.intervention.groupBy({ by: ['status'], where, _count: true });
  const result: Record<string, number> = { 'a-traiter': 0, 'en-cours': 0, 'en-attente': 0, bloque: 0, traite: 0 };
  stats.forEach(s => { result[mapStatus(s.status)] = s._count; });
  res.json(result);
}));

interventionRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = IdSchema.parse(req.params.id);
  const where = { id, ...(req.user!.role === 'ADMIN' ? {} : { userId: req.user!.userId }) };
  const item = await prisma.intervention.findFirst({ where });
  if (!item) throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
  res.json({ data: transformIntervention(item) });
}));

interventionRouter.post('/', asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const data = CreateSchema.parse(req.body);
  await checkDevis(data.devisId, userId, req.user!.role === 'ADMIN');
  const item = await prisma.intervention.create({ data: {
    ...data, userId,
    datePlanifiee: new Date(data.datePlanifiee + 'T00:00:00.000Z'),
    dateReelle: dateValue(data.dateReelle),
    origineDevisDate: dateValue(data.origineDevisDate),
    devisId: data.devisId ?? null,
  } });
  const transformed = transformIntervention(item);
  try { socketEvents.interventionCreated(userId, transformed); }
  catch { console.error('Intervention saved; real-time creation notification failed.'); }
  res.status(201).json({ data: transformed, message: 'Intervention créée avec succès' });
}));

interventionRouter.patch('/:id', asyncHandler(async (req, res) => {
  const id = IdSchema.parse(req.params.id);
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const data = UpdateSchema.parse(req.body);
  const existing = await prisma.intervention.findFirst({ where: { id, ...(isAdmin ? {} : { userId }) } });
  if (!existing) throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
  await checkDevis(data.devisId, userId, isAdmin);
  const updateData: any = { ...data };
  if (data.datePlanifiee !== undefined) updateData.datePlanifiee = new Date(data.datePlanifiee + 'T00:00:00.000Z');
  if (data.dateReelle !== undefined) updateData.dateReelle = dateValue(data.dateReelle);
  if (data.origineDevisDate !== undefined) updateData.origineDevisDate = dateValue(data.origineDevisDate);
  const item = await prisma.intervention.update({ where: { id }, data: updateData });
  const transformed = transformIntervention(item);
  try { socketEvents.interventionUpdated(userId, transformed); }
  catch { console.error('Intervention updated; real-time update notification failed.'); }
  res.json({ data: transformed, message: 'Intervention mise à jour' });
}));

interventionRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = IdSchema.parse(req.params.id);
  const userId = req.user!.userId;
  const existing = await prisma.intervention.findFirst({ where: { id, ...(req.user!.role === 'ADMIN' ? {} : { userId }) } });
  if (!existing) throw new AppError(404, 'Intervention non trouvée', 'NOT_FOUND');
  await prisma.intervention.delete({ where: { id } });
  try { socketEvents.interventionDeleted(userId, { id }); }
  catch { console.error('Intervention deleted; real-time deletion notification failed.'); }
  res.json({ message: 'Intervention supprimée' });
}));
