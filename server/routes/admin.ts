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
  companyId: true,
  company: {
    select: {
      id: true,
      name: true,
      siret: true,
      siren: true,
    },
  },
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

function getParisNow(): { now: Date; parisDateISO: string; parisHHMM: string } {
  const now = new Date();
  const parisHHMM = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  // Date officielle au fuseau Paris (AAAA-MM-JJ)
  const parisDateISO = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return { now, parisDateISO, parisHHMM };
}

async function getCallerUser(req: Request) {
  if (!req.user?.userId) {
    throw new AppError(401, 'Authentification requise', 'UNAUTHORIZED');
  }
  const u = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, email: true, name: true, role: true, technicienNom: true, permissionsJson: true, active: true, companyId: true },
  });
  if (!u || u.active === false) {
    throw new AppError(403, 'Compte désactivé ou inexistant', 'FORBIDDEN');
  }
  const effectiveRole = u.id === 1 || u.email.toLowerCase() === 'louzza.zehair@gmail.com' ? 'ADMIN' : u.role;
  const isAdmin = u.id === 1 || effectiveRole === 'ADMIN';
  return { ...u, effectiveRole, isAdmin };
}

// ============================================================================
// 1. GESTION DES UTILISATEURS & DROITS GRANULAIRES (WORKSTATION ADMIN)
// ============================================================================

adminRouter.get(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Accès réservé exclusivement au Super-Administrateur', 'FORBIDDEN');
    }

    const where: any = caller.companyId ? { companyId: caller.companyId } : {};
    const users = await prisma.user.findMany({
      where,
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
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Action réservée exclusivement au Super-Administrateur', 'FORBIDDEN');
    }

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
        companyId: caller.companyId || 1,
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
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Modification des droits réservée au Super-Administrateur', 'FORBIDDEN');
    }

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
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Suppression réservée au Super-Administrateur', 'FORBIDDEN');
    }

    const id = parseInt(req.params.id, 10);
    if (id === 1 || id === req.user?.userId) {
      throw new AppError(400, 'Impossible de supprimer le compte Super-Administrateur principal', 'FORBIDDEN');
    }
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Compte utilisateur supprimé' });
  })
);

// ============================================================================
// 2. POINTAGES JOURNALIERS TECHNICIENS (HORODATAGE INVIOLABLE MATIN / SOIR)
// ============================================================================

adminRouter.get(
  '/pointages',
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    const dateJour = (req.query.dateJour as string) || '';
    let technicien = (req.query.technicien as string) || '';

    // Un technicien ne peut voir QUE ses propres pointages
    if (!caller.isAdmin) {
      technicien = (caller.technicienNom || caller.name || '').trim();
    }

    const companyId = caller.companyId || 1;
    const where: any = {
      companyId,
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
    const caller = await getCallerUser(req);
    const { parisDateISO, parisHHMM, now } = getParisNow();
    const companyId = caller.companyId || 1;

    let technicien = String(req.body?.technicien || '').trim();
    let dateJour = String(req.body?.dateJour || '').trim();
    let heureArriveeBureau = String(req.body?.heureArriveeBureau || '').trim();
    const commentaireJournee = req.body?.commentaireJournee;

    // Pour les techniciens : horodatage automatique inviolable au moment exact du clic
    if (!caller.isAdmin) {
      technicien = (caller.technicienNom || caller.name || '').trim();
      dateJour = parisDateISO; // Forcé sur la date du jour réelle
      heureArriveeBureau = parisHHMM; // Forcé sur l'heure exacte du clic
    } else {
      technicien = technicien || (caller.technicienNom || caller.name || '').trim();
      dateJour = dateJour || parisDateISO;
      heureArriveeBureau = heureArriveeBureau || parisHHMM;
    }

    if (!technicien) {
      throw new AppError(400, 'Nom du technicien requis pour le pointage matin', 'VALIDATION_ERROR');
    }

    // Si technicien et déjà pointé le matin : interdiction de modifier l'heure
    if (!caller.isAdmin) {
      const existing = await prisma.pointageTechnicien.findUnique({
        where: {
          technicien_dateJour_companyId: {
            technicien,
            dateJour,
            companyId,
          },
        },
      });
      if (existing?.heureArriveeBureau) {
        return res.json({
          data: {
            ...existing,
            dureeMinutes: computeDurationMinutes(existing.heureArriveeBureau, existing.heureFinJournee),
          },
          message: `Arrivée déjà enregistrée et certifiée à ${existing.heureArriveeBureau} (non modifiable)`,
        });
      }
    }

    const upserted = await prisma.pointageTechnicien.upsert({
      where: {
        technicien_dateJour_companyId: {
          technicien,
          dateJour,
          companyId,
        },
      },
      update: {
        heureArriveeBureau,
        timestampArrivee: now,
        statutJournee: 'EN_SERVICE',
        ...(commentaireJournee !== undefined ? { commentaireJournee } : {}),
      },
      create: {
        technicien,
        userId: caller.id,
        companyId,
        dateJour,
        heureArriveeBureau,
        timestampArrivee: now,
        statutJournee: 'EN_SERVICE',
        commentaireJournee: commentaireJournee || 'Arrivée au bureau certifiée par bouton mobile',
      },
    });

    res.json({
      data: {
        ...upserted,
        dureeMinutes: computeDurationMinutes(upserted.heureArriveeBureau, upserted.heureFinJournee),
      },
      message: `Prise de service certifiée à ${heureArriveeBureau} pour ${technicien}`,
    });
  })
);

adminRouter.post(
  '/pointages/clock-out',
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    const { parisDateISO, parisHHMM, now } = getParisNow();
    const companyId = caller.companyId || 1;

    let technicien = String(req.body?.technicien || '').trim();
    let dateJour = String(req.body?.dateJour || '').trim();
    let heureFinJournee = String(req.body?.heureFinJournee || '').trim();
    const derniereInterventionRef = req.body?.derniereInterventionRef;
    const commentaireJournee = req.body?.commentaireJournee;

    // Pour les techniciens : horodatage automatique inviolable au moment exact du clic
    if (!caller.isAdmin) {
      technicien = (caller.technicienNom || caller.name || '').trim();
      dateJour = parisDateISO;
      heureFinJournee = parisHHMM; // Heure exacte certifiée du clic
    } else {
      technicien = technicien || (caller.technicienNom || caller.name || '').trim();
      dateJour = dateJour || parisDateISO;
      heureFinJournee = heureFinJournee || parisHHMM;
    }

    if (!technicien) {
      throw new AppError(400, 'Nom du technicien requis pour la fin de journée', 'VALIDATION_ERROR');
    }

    // Si technicien et déjà clôturé : interdiction de modifier l'heure
    if (!caller.isAdmin) {
      const existing = await prisma.pointageTechnicien.findUnique({
        where: {
          technicien_dateJour_companyId: {
            technicien,
            dateJour,
            companyId,
          },
        },
      });
      if (existing?.heureFinJournee) {
        return res.json({
          data: {
            ...existing,
            dureeMinutes: computeDurationMinutes(existing.heureArriveeBureau, existing.heureFinJournee),
          },
          message: `Fin de journée déjà enregistrée et certifiée à ${existing.heureFinJournee} (non modifiable)`,
        });
      }
    }

    const upserted = await prisma.pointageTechnicien.upsert({
      where: {
        technicien_dateJour_companyId: {
          technicien,
          dateJour,
          companyId,
        },
      },
      update: {
        heureFinJournee,
        timestampFin: now,
        statutJournee: 'TERMINEE',
        ...(derniereInterventionRef !== undefined ? { derniereInterventionRef } : {}),
        ...(commentaireJournee !== undefined ? { commentaireJournee } : {}),
      },
      create: {
        technicien,
        userId: caller.id,
        companyId,
        dateJour,
        heureArriveeBureau: '08:00',
        heureFinJournee,
        timestampFin: now,
        statutJournee: 'TERMINEE',
        derniereInterventionRef: derniereInterventionRef || null,
        commentaireJournee: commentaireJournee || 'Fin de journée certifiée par bouton mobile',
      },
    });

    res.json({
      data: {
        ...upserted,
        dureeMinutes: computeDurationMinutes(upserted.heureArriveeBureau, upserted.heureFinJournee),
      },
      message: `Fin de journée certifiée à ${heureFinJournee} pour ${technicien}`,
    });
  })
);
