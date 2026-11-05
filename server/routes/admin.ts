import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { formatPublicUser } from './auth.js';
import { ROLE_DEFINITIONS } from '../../shared/types.js';

export const adminRouter = Router();

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  technicienNom: true,
  permissionsJson: true,
  active: true,
  createdAt: true,
} as const;

function computeDurationMinutes(startHHMM?: string | null, endHHMM?: string | null): number | null {
  if (!startHHMM || !endHHMM) return null;
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

// ============================================================================
// 1. GESTION DES UTILISATEURS & DROITS GRANULAIRES (WORKSTATION ADMIN)
// ============================================================================

adminRouter.get(
  '/users',
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: publicUserSelect,
      orderBy: [{ id: 'asc' }],
    });
    res.json({
      data: users.map(formatPublicUser),
      roles: ROLE_DEFINITIONS,
    });
  })
);

adminRouter.post(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, role, technicienNom, permissions } = req.body || {};
    if (!email || !password || !name) {
      throw new AppError(400, 'Nom, email et mot de passe sont obligatoires', 'VALIDATION_ERROR');
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      throw new AppError(409, 'Cet email est déjà attribué à un utilisateur', 'EMAIL_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(String(password), 12);
    const created = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: String(name).trim(),
        role: role || 'CONDUCTEUR_TRAVAUX',
        technicienNom: technicienNom ? String(technicienNom).trim() : null,
        permissionsJson: permissions ? JSON.stringify(permissions) : null,
        active: true,
      },
      select: publicUserSelect,
    });

    res.status(201).json({
      data: formatPublicUser(created),
      message: `Utilisateur ${created.name} créé avec succès`,
    });
  })
);

adminRouter.put(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { name, email, password, role, technicienNom, permissions, active } = req.body || {};

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Utilisateur introuvable', 'NOT_FOUND');
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (email !== undefined) updateData.email = String(email).trim().toLowerCase();
    if (role !== undefined) updateData.role = String(role);
    if (technicienNom !== undefined) {
      updateData.technicienNom = technicienNom ? String(technicienNom).trim() : null;
    }
    if (permissions !== undefined) {
      updateData.permissionsJson = permissions ? JSON.stringify(permissions) : null;
    }
    if (active !== undefined && id !== 1) {
      updateData.active = Boolean(active);
    }
    if (password && String(password).trim().length >= 6) {
      updateData.password = await bcrypt.hash(String(password).trim(), 12);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: publicUserSelect,
    });

    res.json({
      data: formatPublicUser(updated),
      message: `Droits et profil de ${updated.name} mis à jour`,
    });
  })
);

adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (id === 1 || id === req.user?.userId) {
      throw new AppError(400, 'Impossible de supprimer le compte Super-Administrateur principal', 'FORBIDDEN');
    }
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Compte utilisateur supprimé' });
  })
);

// ============================================================================
// 2. POINTAGES JOURNALIERS TECHNICIENS (ARRIVÉE MATIN / FIN SOIR)
// ============================================================================

adminRouter.get(
  '/pointages',
  asyncHandler(async (req: Request, res: Response) => {
    const dateJour = (req.query.dateJour as string) || '';
    const technicien = (req.query.technicien as string) || '';

    const where: any = {
      ...(dateJour ? { dateJour } : {}),
      ...(technicien ? { technicien } : {}),
    };

    const rows = await prisma.pointageTechnicien.findMany({
      where,
      orderBy: [{ dateJour: 'desc' }, { technicien: 'asc' }],
      take: 150,
    });

    const formatted = rows.map((r) => ({
      id: r.id,
      technicien: r.technicien,
      userId: r.userId,
      dateJour: r.dateJour,
      heureArriveeBureau: r.heureArriveeBureau,
      timestampArrivee: r.timestampArrivee ? r.timestampArrivee.toISOString() : null,
      heureFinJournee: r.heureFinJournee,
      timestampFin: r.timestampFin ? r.timestampFin.toISOString() : null,
      statutJournee: r.statutJournee as 'EN_SERVICE' | 'TERMINEE',
      derniereInterventionRef: r.derniereInterventionRef,
      commentaireJournee: r.commentaireJournee,
      dureeMinutes: computeDurationMinutes(r.heureArriveeBureau, r.heureFinJournee),
    }));

    res.json({ data: formatted });
  })
);

adminRouter.post(
  '/pointages/clock-in',
  asyncHandler(async (req: Request, res: Response) => {
    const { technicien, dateJour, heureArriveeBureau, commentaireJournee } = req.body || {};
    if (!technicien) {
      throw new AppError(400, 'Nom du technicien requis pour le pointage matin', 'VALIDATION_ERROR');
    }

    const now = new Date();
    const todayISO = dateJour || now.toISOString().slice(0, 10);
    const defaultHHMM =
      heureArriveeBureau ||
      new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

    const upserted = await prisma.pointageTechnicien.upsert({
      where: {
        technicien_dateJour: {
          technicien: String(technicien).trim(),
          dateJour: todayISO,
        },
      },
      update: {
        heureArriveeBureau: defaultHHMM,
        timestampArrivee: now,
        statutJournee: 'EN_SERVICE',
        ...(commentaireJournee !== undefined ? { commentaireJournee } : {}),
      },
      create: {
        technicien: String(technicien).trim(),
        userId: req.user?.userId || null,
        dateJour: todayISO,
        heureArriveeBureau: defaultHHMM,
        timestampArrivee: now,
        statutJournee: 'EN_SERVICE',
        commentaireJournee: commentaireJournee || 'Arrivée au bureau — Prise de service validée',
      },
    });

    res.json({
      data: {
        ...upserted,
        dureeMinutes: computeDurationMinutes(upserted.heureArriveeBureau, upserted.heureFinJournee),
      },
      message: `Prise de service activée à ${defaultHHMM} pour ${technicien}`,
    });
  })
);

adminRouter.post(
  '/pointages/clock-out',
  asyncHandler(async (req: Request, res: Response) => {
    const { technicien, dateJour, heureFinJournee, derniereInterventionRef, commentaireJournee } =
      req.body || {};
    if (!technicien) {
      throw new AppError(400, 'Nom du technicien requis pour la fin de journée', 'VALIDATION_ERROR');
    }

    const now = new Date();
    const todayISO = dateJour || now.toISOString().slice(0, 10);
    const defaultHHMM =
      heureFinJournee ||
      new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

    const upserted = await prisma.pointageTechnicien.upsert({
      where: {
        technicien_dateJour: {
          technicien: String(technicien).trim(),
          dateJour: todayISO,
        },
      },
      update: {
        heureFinJournee: defaultHHMM,
        timestampFin: now,
        statutJournee: 'TERMINEE',
        ...(derniereInterventionRef !== undefined ? { derniereInterventionRef } : {}),
        ...(commentaireJournee !== undefined ? { commentaireJournee } : {}),
      },
      create: {
        technicien: String(technicien).trim(),
        userId: req.user?.userId || null,
        dateJour: todayISO,
        heureArriveeBureau: '08:00',
        heureFinJournee: defaultHHMM,
        timestampFin: now,
        statutJournee: 'TERMINEE',
        derniereInterventionRef: derniereInterventionRef || null,
        commentaireJournee: commentaireJournee || 'Fin de dernière intervention — Journée clôturée',
      },
    });

    res.json({
      data: {
        ...upserted,
        dureeMinutes: computeDurationMinutes(upserted.heureArriveeBureau, upserted.heureFinJournee),
      },
      message: `Fin de journée enregistrée à ${defaultHHMM} pour ${technicien}`,
    });
  })
);
