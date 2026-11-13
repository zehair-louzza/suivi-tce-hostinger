// Charge l'appelant depuis la base (droits toujours à jour) et calcule ses accès.
import type { Request } from 'express';
import { prisma } from './prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { accessFor, type Access } from './access.js';
import { requireCompanyId } from './tenant.js';

export async function loadAccess(req: Request): Promise<Access & { companyId: number }> {
  const companyId = requireCompanyId(req.user?.companyId);
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, 'Authentification requise');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, technicienNom: true, permissionsJson: true, active: true, companyId: true },
  });
  if (!user || user.active === false || user.companyId !== companyId) {
    throw new AppError(403, 'Compte inactif ou introuvable', 'FORBIDDEN');
  }
  return { ...accessFor(user, req.user?.role), companyId };
}
