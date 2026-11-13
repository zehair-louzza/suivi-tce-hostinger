// Notifications dans l'application : chacun lit et marque UNIQUEMENT les siennes.
// Le filtre porte toujours sur l'utilisateur connecté ET sa société (jamais sur un identifiant fourni par le client).
import { Request, Response } from 'express';
import { policy, secureRouter } from '../lib/guard.js';
import { prisma } from '../lib/prisma.js';
import { requireCompanyId } from '../lib/tenant.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

export const notificationsRouter = secureRouter('notifications');
const db = prisma as any;

notificationsRouter.get(
  '/',
  policy('notifications.list'),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = requireCompanyId(req.user?.companyId);
    const userId = req.user!.userId;
    const [items, nonLues] = await Promise.all([
      db.notification.findMany({
        where: { userId, companyId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, type: true, titre: true, message: true, interventionId: true, lu: true, createdAt: true },
      }),
      db.notification.count({ where: { userId, companyId, lu: false } }),
    ]);
    res.json({ data: items, nonLues });
  })
);

notificationsRouter.post(
  '/lire-tout',
  policy('notifications.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = requireCompanyId(req.user?.companyId);
    await db.notification.updateMany({ where: { userId: req.user!.userId, companyId, lu: false }, data: { lu: true } });
    res.json({ ok: true });
  })
);

notificationsRouter.post(
  '/:id/lire',
  policy('notifications.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = requireCompanyId(req.user?.companyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw new AppError(400, 'Identifiant invalide', 'VALIDATION_ERROR');
    const r = await db.notification.updateMany({ where: { id, userId: req.user!.userId, companyId }, data: { lu: true } });
    if (r.count === 0) throw new AppError(404, 'Notification introuvable', 'NOT_FOUND');
    res.json({ ok: true });
  })
);
