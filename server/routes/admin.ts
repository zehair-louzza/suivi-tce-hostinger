import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { policy, secureRouter } from '../lib/guard.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { formatPublicUser } from './auth.js';
import { requireCompanyId } from '../lib/tenant.js';
import { assertStrongPassword } from '../lib/password.js';
import { normaliserDelai } from '../domain/technicianResponse.js';
import { basePublicUserSelect, isMissingSchemaError } from '../lib/userSelect.js';
import { ROLE_DEFINITIONS, getEffectivePermissions, isKnownRole, sanitizePermissionsForRole } from '../../shared/types.js';
import {
  APP_URL,
  sendWelcomeUserEmail,
  sendInvitationEmail,
  getPublicMailConfig,
  saveCompanyMailSettings,
  deleteCompanyMailSettings,
  getEmailLogs,
  verifyAndTestSmtpConfig,
} from '../services/emailService.js';

export const adminRouter = secureRouter('admin');

// Sélection publique SANS colonnes d'apparence (robuste même si la migration
// de thème n'a pas encore été appliquée à la base). Les valeurs d'apparence
// sont gérées à part via les routes /appearance.
const publicUserSelect = basePublicUserSelect;

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
  let hasAdminPerm = false;
  try {
    const p = u.permissionsJson ? JSON.parse(u.permissionsJson) : null;
    if (p?.canManageUsers) hasAdminPerm = true;
  } catch {}
  const effectiveRole = u.id === 1 || u.email.toLowerCase() === 'louzza.zehair@gmail.com' || u.role === 'ADMIN' ? 'ADMIN' : u.role;
  const perms = getEffectivePermissions(effectiveRole as any, u.permissionsJson);
  const isAdmin = u.id === 1 || effectiveRole === 'ADMIN' || hasAdminPerm;
  return { ...u, effectiveRole, isAdmin, perms };
}

/**
 * Entreprise sur laquelle l'appelant agit : toujours la sienne, jamais une valeur fournie par le client,
 * jamais une entreprise de repli. Aucun rôle (pas même le fondateur) n'agit sur une autre entreprise.
 */
function tenantOf(caller: { companyId?: number | null }): number {
  return requireCompanyId(caller.companyId);
}

// ============================================================================
// 1. GESTION DES UTILISATEURS & DROITS GRANULAIRES (WORKSTATION ADMIN)
// ============================================================================

adminRouter.get(
  '/users',
  policy('admin.users.list'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Accès réservé à la direction de la société', 'FORBIDDEN');
    }

    const where = { companyId: tenantOf(caller) };
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
  policy('admin.users.create'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Action réservée à la direction de la société', 'FORBIDDEN');
    }

    const { email, password, name, role, technicienNom, permissions } = req.body || {};
    if (!email || !password || !name) {
      throw new AppError(400, 'Nom, email et mot de passe sont obligatoires', 'VALIDATION_ERROR');
    }
    if (role !== undefined && !isKnownRole(role)) {
      throw new AppError(400, 'Rôle inconnu', 'VALIDATION_ERROR');
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      throw new AppError(409, 'Cet email est déjà attribué à un utilisateur', 'EMAIL_EXISTS');
    }

    assertStrongPassword(String(password), { email: cleanEmail, name: String(name) });
    const hashedPassword = await bcrypt.hash(String(password), 12);
    const created = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: String(name).trim(),
        role: role || 'CONDUCTEUR_TRAVAUX',
        technicienNom: technicienNom ? String(technicienNom).trim() : null,
        permissionsJson: permissions
          ? JSON.stringify(sanitizePermissionsForRole(role || 'CONDUCTEUR_TRAVAUX', permissions))
          : null,
        companyId: tenantOf(caller),
        active: true,
        emailConfirmed: true,
      },
      select: publicUserSelect,
    });

    const pubUser = formatPublicUser(created);
    const roleLabel = (ROLE_DEFINITIONS as any)[pubUser.role]?.label || pubUser.role;
    const delivery = await sendWelcomeUserEmail({
      companyId: tenantOf(caller),
      toEmail: cleanEmail,
      recipientName: created.name,
      roleLabel,
      tempPassword: String(password),
      companyName: pubUser.companyName || 'ANELEC GROUPE',
    });

    res.status(201).json({
      data: pubUser,
      emailSent: delivery.sent,
      deliveryChannel: delivery.channel,
      previewUrl: delivery.previewUrl || null,
      message: `Utilisateur ${created.name} créé et activé avec succès (e-mail d'accès envoyé)`,
    });
  })
);

adminRouter.put(
  '/users/:id',
  policy('admin.users.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Modification des droits réservée à la direction de la société', 'FORBIDDEN');
    }

    const id = parseInt(req.params.id, 10);
    const { name, email, password, role, technicienNom, permissions, active } = req.body || {};

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Utilisateur introuvable', 'NOT_FOUND');
    }
    if (existing.companyId !== tenantOf(caller)) {
      throw new AppError(403, 'Accès non autorisé à cet utilisateur', 'FORBIDDEN');
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (email !== undefined) updateData.email = String(email).trim().toLowerCase();
    if (role !== undefined) {
      if (!isKnownRole(role)) throw new AppError(400, 'Rôle inconnu', 'VALIDATION_ERROR');
      updateData.role = String(role);
    }
    if (technicienNom !== undefined) {
      updateData.technicienNom = technicienNom ? String(technicienNom).trim() : null;
    }
    if (permissions !== undefined || role !== undefined) {
      // Plafond du rôle appliqué à l'enregistrement, y compris quand seul le rôle change
      let base: any = permissions;
      if (permissions === undefined) {
        try {
          base = existing.permissionsJson ? JSON.parse(existing.permissionsJson) : null;
        } catch {
          base = null;
        }
      }
      updateData.permissionsJson = base
        ? JSON.stringify(sanitizePermissionsForRole(role !== undefined ? role : existing.role, base))
        : null;
    }
    if (active !== undefined && id !== 1) {
      updateData.active = Boolean(active);
    }
    if (password) {
      assertStrongPassword(String(password), { email: updateData.email ?? existing.email, name: updateData.name ?? existing.name });
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
  policy('admin.users.delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Suppression réservée à la direction de la société', 'FORBIDDEN');
    }

    const id = parseInt(req.params.id, 10);
    if (id === 1 || id === req.user?.userId) {
      throw new AppError(400, 'Impossible de supprimer le compte fondateur de la société', 'FORBIDDEN');
    }
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Utilisateur introuvable', 'NOT_FOUND');
    }
    if (existing.companyId !== tenantOf(caller)) {
      throw new AppError(403, 'Accès non autorisé à cet utilisateur', 'FORBIDDEN');
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
  policy('admin.pointages.read'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    const dateJour = (req.query.dateJour as string) || '';
    let technicien = (req.query.technicien as string) || '';

    // Pointages de toute l'équipe : direction et planificateur uniquement. Tous les autres, y compris le
    // chargé d'études, ne voient que le leur.
    if (!caller.isAdmin && caller.effectiveRole !== 'CONDUCTEUR_TRAVAUX') {
      technicien = (caller.technicienNom || caller.name || '').trim();
    }

    const companyId = tenantOf(caller);
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
  policy('admin.pointages.clock'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    const { parisDateISO, parisHHMM, now } = getParisNow();
    const companyId = tenantOf(caller);

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

    let upserted;
    try {
      upserted = await prisma.pointageTechnicien.upsert({
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
    } catch (upsertErr) {
      const existingRow = await prisma.pointageTechnicien.findFirst({
        where: { technicien, dateJour, companyId },
      });
      if (existingRow) {
        upserted = await prisma.pointageTechnicien.update({
          where: { id: existingRow.id },
          data: {
            heureArriveeBureau,
            timestampArrivee: now,
            statutJournee: 'EN_SERVICE',
            ...(commentaireJournee !== undefined ? { commentaireJournee } : {}),
          },
        });
      } else {
        upserted = await prisma.pointageTechnicien.create({
          data: {
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
      }
    }

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
  policy('admin.pointages.clock'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    const { parisDateISO, parisHHMM, now } = getParisNow();
    const companyId = tenantOf(caller);

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

    let upserted;
    try {
      upserted = await prisma.pointageTechnicien.upsert({
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
    } catch (upsertErr) {
      const existingRow = await prisma.pointageTechnicien.findFirst({
        where: { technicien, dateJour, companyId },
      });
      if (existingRow) {
        upserted = await prisma.pointageTechnicien.update({
          where: { id: existingRow.id },
          data: {
            heureFinJournee,
            timestampFin: now,
            statutJournee: 'TERMINEE',
            ...(derniereInterventionRef !== undefined ? { derniereInterventionRef } : {}),
            ...(commentaireJournee !== undefined ? { commentaireJournee } : {}),
          },
        });
      } else {
        upserted = await prisma.pointageTechnicien.create({
          data: {
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
      }
    }

    res.json({
      data: {
        ...upserted,
        dureeMinutes: computeDurationMinutes(upserted.heureArriveeBureau, upserted.heureFinJournee),
      },
      message: `Fin de journée certifiée à ${heureFinJournee} pour ${technicien}`,
    });
  })
);

// ============================================================================
// 3. SUPPRESSION TOTALE ET DÉFINITIVE D'UN COMPTE & DE SA BASE DE DONNÉES (TENANT)
// ============================================================================
adminRouter.delete(
  '/company/destroy',
  policy('admin.company.destroy'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);

    if (!caller.isAdmin) {
      throw new AppError(403, "Seul l'administrateur de l'entreprise peut initier la suppression totale du compte et de ses données", 'FORBIDDEN');
    }

    const companyId = caller.companyId;
    if (!companyId) {
      throw new AppError(400, "Aucun espace entreprise associé à ce compte", 'INVALID_COMPANY');
    }

    // Protection stricte de l'espace racine ANELEC GROUPE (ID 1)
    if (companyId === 1 && caller.id === 1) {
      const confirmPhrase = String(req.body?.confirmPhrase || '').trim();
      if (confirmPhrase !== 'SUPPRIMER ANELEC GROUPE DEFINITIVEMENT') {
        throw new AppError(400, "Sécurité racine ANELEC : veuillez saisir la phrase de confirmation exacte pour détruire l'espace principal", 'ROOT_PROTECTED');
      }
    }

    const password = String(req.body?.password || '').trim();
    if (!password) {
      throw new AppError(400, 'Votre mot de passe administrateur est obligatoire pour confirmer cette suppression irréversible', 'PASSWORD_REQUIRED');
    }

    const adminUser = await prisma.user.findUnique({ where: { id: caller.id } });
    if (!adminUser || !(await bcrypt.compare(password, adminUser.password))) {
      throw new AppError(401, 'Mot de passe administrateur incorrect', 'INVALID_PASSWORD');
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new AppError(404, 'Espace entreprise introuvable', 'NOT_FOUND');
    }

    // Suppression en cascade irréversible de l'ensemble des données de l'entreprise
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer tous les pointages techniciens de l'entreprise
      await tx.pointageTechnicien.deleteMany({ where: { companyId } });

      // 2. Supprimer tous les référentiels métiers et compétences
      await tx.referentiel.deleteMany({ where: { companyId } });

      // 3. Supprimer toutes les interventions de l'entreprise
      await tx.intervention.deleteMany({ where: { companyId } });

      // 4. Supprimer tous les devis de l'entreprise
      await tx.devis.deleteMany({ where: { companyId } });

      // 5. Supprimer tous les comptes utilisateurs de l'entreprise
      await tx.user.deleteMany({ where: { companyId } });

      // 6. Supprimer l'entreprise elle-même
      await tx.company.delete({ where: { id: companyId } });
    });

    res.json({
      message: "L'espace entreprise " + company.name + " ainsi que l'ensemble de ses devis, interventions, plannings, pointages et comptes utilisateurs ont été DÉFINITIVEMENT et IRRÉVERSIBLEMENT supprimés de la base de données.",
      destroyedCompanyId: companyId,
    });
  })
);

// ============================================================================
// 4. CONFIGURATION SMTP, DIAGNOSTIC D'ENVOI & JOURNAL DES EMAILS
// ============================================================================
adminRouter.get(
  '/smtp-status',
  policy('admin.smtp.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Accès réservé aux administrateurs', 'FORBIDDEN');
    }
    const companyId = tenantOf(caller);
    const [config, logs] = await Promise.all([getPublicMailConfig(companyId), getEmailLogs(companyId)]);
    res.json({ config, logs });
  })
);

adminRouter.put(
  '/smtp-config',
  policy('admin.smtp.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Modification SMTP réservée aux administrateurs', 'FORBIDDEN');
    }
    const companyId = tenantOf(caller);
    try {
      await saveCompanyMailSettings(companyId, req.body || {});
    } catch (e: any) {
      throw new AppError(400, e?.message || 'Configuration SMTP invalide', 'INVALID_SMTP_CONFIG');
    }
    res.json({
      config: await getPublicMailConfig(companyId),
      message: 'Boîte d’envoi de votre entreprise enregistrée. Envoyez un e-mail de test pour la valider.',
    });
  })
);

// Retour à l'expéditeur plateforme
adminRouter.delete(
  '/smtp-config',
  policy('admin.smtp.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Modification SMTP réservée aux administrateurs', 'FORBIDDEN');
    }
    const companyId = tenantOf(caller);
    await deleteCompanyMailSettings(companyId);
    res.json({
      config: await getPublicMailConfig(companyId),
      message: 'Boîte d’envoi propre supprimée : les e-mails repartent via l’expéditeur plateforme.',
    });
  })
);

adminRouter.post(
  '/smtp-test',
  policy('admin.smtp.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Test SMTP réservé aux administrateurs', 'FORBIDDEN');
    }
    const toEmail = String(req.body?.toEmail || caller.email || '').trim();
    if (!toEmail || !toEmail.includes('@')) {
      throw new AppError(400, 'Adresse e-mail de test valide requise', 'VALIDATION_ERROR');
    }
    const companyId = tenantOf(caller);
    const result = await verifyAndTestSmtpConfig(companyId, toEmail);
    const logs = await getEmailLogs(companyId);
    res.json({
      ...result,
      logs,
      message: result.delivery.sent
        ? `E-mail de test envoyé depuis ${result.delivery.fromAddress || 'la boîte configurée'} à ${toEmail}`
        : `Échec de l'envoi : ${result.delivery.error || 'erreur inconnue'}`,
    });
  })
);

// ============================================================================
// 5. INVITATIONS PAR E-MAIL (profils habilités à gérer les utilisateurs uniquement)
// ============================================================================

const INVITATION_TTL_DAYS = 7;
const INVITATION_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PENDING_INVITATIONS = 50;

const InvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide').max(254),
  role: z.string().trim().min(1),
  technicienNom: z.string().trim().max(100).optional().nullable(),
  permissions: z.record(z.boolean()).optional().nullable(),
});

function hashInvitationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicInvitation(i: {
  id: number;
  email: string;
  role: string;
  technicienNom: string | null;
  invitedByName: string | null;
  expiresAt: Date;
  lastSentAt: Date | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  const status = i.acceptedAt ? 'ACCEPTEE' : i.revokedAt ? 'REVOQUEE' : i.expiresAt.getTime() < Date.now() ? 'EXPIREE' : 'EN_ATTENTE';
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    roleLabel: (ROLE_DEFINITIONS as any)[i.role]?.label || i.role,
    technicienNom: i.technicienNom,
    invitedByName: i.invitedByName,
    expiresAt: i.expiresAt.toISOString(),
    lastSentAt: i.lastSentAt ? i.lastSentAt.toISOString() : null,
    acceptedAt: i.acceptedAt ? i.acceptedAt.toISOString() : null,
    revokedAt: i.revokedAt ? i.revokedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
    status,
  };
}

/** Émet un nouveau jeton, met à jour l'invitation et envoie l'e-mail depuis la boîte de l'entreprise. */
async function issueAndSendInvitation(
  caller: Awaited<ReturnType<typeof getCallerUser>>,
  invitationId: number
) {
  const companyId = tenantOf(caller);
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const updated = await prisma.companyInvitation.update({
    where: { id: invitationId },
    data: { tokenHash: hashInvitationToken(token), expiresAt, lastSentAt: new Date() },
  });
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  const inviteLink = `${APP_URL}/invitation?token=${encodeURIComponent(token)}`;
  const delivery = await sendInvitationEmail({
    companyId,
    companyName: company?.name || 'votre entreprise',
    toEmail: updated.email,
    inviterName: caller.name,
    inviterEmail: caller.email,
    roleLabel: (ROLE_DEFINITIONS as any)[updated.role]?.label || updated.role,
    inviteLink,
    expiresAt,
  });
  return { invitation: updated, delivery, inviteLink };
}

adminRouter.get(
  '/invitations',
  policy('admin.invitations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Accès réservé aux profils habilités à gérer les utilisateurs', 'FORBIDDEN');
    }
    const rows = await prisma.companyInvitation.findMany({
      where: { companyId: tenantOf(caller) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ data: rows.map(publicInvitation) });
  })
);

adminRouter.post(
  '/invitations',
  policy('admin.invitations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Seuls les profils habilités à gérer les utilisateurs peuvent inviter', 'FORBIDDEN');
    }
    const parsed = InvitationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0]?.message || 'Invitation invalide', 'VALIDATION_ERROR');
    }
    const { email, technicienNom, permissions } = parsed.data;
    const role = parsed.data.role.toUpperCase();
    const roleDef = (ROLE_DEFINITIONS as any)[role];
    if (!roleDef) {
      throw new AppError(400, 'Profil inconnu', 'INVALID_ROLE');
    }
    // Pas d'escalade : seul un administrateur peut inviter un autre administrateur
    if (role === 'ADMIN' && caller.effectiveRole !== 'ADMIN') {
      throw new AppError(403, 'Seul un administrateur peut inviter un autre administrateur', 'FORBIDDEN');
    }

    // Droits personnalisés : uniquement des booléens sur des droits existants ; canManageUsers réservé aux administrateurs
    let permissionsJson: string | null = null;
    if (permissions) {
      const allowed = Object.keys(roleDef.defaultPermissions);
      const clean: Record<string, boolean> = {};
      for (const k of allowed) {
        if (typeof permissions[k] === 'boolean') clean[k] = permissions[k];
      }
      if (caller.effectiveRole !== 'ADMIN') delete clean.canManageUsers;
      permissionsJson = Object.keys(clean).length ? JSON.stringify(clean) : null;
    }

    const companyId = tenantOf(caller);
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      throw new AppError(409, 'Un compte existe déjà avec cette adresse e-mail', 'EMAIL_EXISTS');
    }

    const pending = await prisma.companyInvitation.findMany({
      where: { companyId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true },
    });
    let target = pending.find((p) => p.email.toLowerCase() === email);
    if (!target && pending.length >= MAX_PENDING_INVITATIONS) {
      throw new AppError(429, 'Trop d’invitations en attente : révoquez-en avant d’en créer de nouvelles', 'TOO_MANY_INVITATIONS');
    }

    // Une invitation expirée occupe l'index d'unicité : on la remplace
    await prisma.companyInvitation.updateMany({
      where: { companyId, email, acceptedAt: null, revokedAt: null, expiresAt: { lte: new Date() } },
      data: { revokedAt: new Date() },
    });

    let invitationId: number;
    if (target) {
      invitationId = target.id;
      await prisma.companyInvitation.update({
        where: { id: target.id },
        data: {
          role,
          technicienNom: technicienNom ? technicienNom.trim() : null,
          permissionsJson,
          invitedById: caller.id,
          invitedByName: caller.name,
        },
      });
    } else {
      const created = await prisma.companyInvitation.create({
        data: {
          companyId,
          email,
          role,
          technicienNom: technicienNom ? technicienNom.trim() : null,
          permissionsJson,
          tokenHash: hashInvitationToken(crypto.randomBytes(32).toString('base64url')),
          invitedById: caller.id,
          invitedByName: caller.name,
          expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });
      invitationId = created.id;
    }

    const { invitation, delivery, inviteLink } = await issueAndSendInvitation(caller, invitationId);
    res.status(201).json({
      data: publicInvitation(invitation),
      emailSent: delivery.sent,
      senderMode: delivery.senderMode || null,
      fromAddress: delivery.fromAddress || null,
      // Lien à transmettre à la main uniquement si l'e-mail n'a pas pu partir (réponse réservée à l'administrateur authentifié)
      inviteLink: delivery.sent ? null : inviteLink,
      deliveryError: delivery.sent ? null : delivery.error || null,
      message: delivery.sent
        ? `Invitation envoyée à ${email}`
        : `L'e-mail n'a pas pu partir. Copiez le lien d'invitation et transmettez-le vous-même à ${email}.`,
    });
  })
);

adminRouter.post(
  '/invitations/:id/resend',
  policy('admin.invitations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Action réservée aux profils habilités', 'FORBIDDEN');
    }
    const id = parseInt(req.params.id, 10);
    const inv = await prisma.companyInvitation.findFirst({ where: { id, companyId: tenantOf(caller) } });
    if (!inv) throw new AppError(404, 'Invitation introuvable', 'NOT_FOUND');
    if (inv.acceptedAt || inv.revokedAt) {
      throw new AppError(409, 'Cette invitation n’est plus active', 'INVITATION_CLOSED');
    }
    if (inv.lastSentAt && Date.now() - inv.lastSentAt.getTime() < INVITATION_RESEND_COOLDOWN_MS) {
      throw new AppError(429, 'Invitation envoyée à l’instant : patientez une minute avant de la renvoyer', 'RESEND_COOLDOWN');
    }
    const { invitation, delivery, inviteLink } = await issueAndSendInvitation(caller, inv.id);
    res.json({
      data: publicInvitation(invitation),
      emailSent: delivery.sent,
      senderMode: delivery.senderMode || null,
      fromAddress: delivery.fromAddress || null,
      inviteLink: delivery.sent ? null : inviteLink,
      deliveryError: delivery.sent ? null : delivery.error || null,
      message: delivery.sent ? `Invitation renvoyée à ${inv.email}` : 'L’e-mail n’a pas pu partir : transmettez le lien manuellement.',
    });
  })
);

adminRouter.delete(
  '/invitations/:id',
  policy('admin.invitations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, 'Action réservée aux profils habilités', 'FORBIDDEN');
    }
    const id = parseInt(req.params.id, 10);
    const result = await prisma.companyInvitation.updateMany({
      where: { id, companyId: tenantOf(caller), acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new AppError(404, 'Invitation introuvable ou déjà clôturée', 'NOT_FOUND');
    res.json({ message: 'Invitation révoquée : le lien ne fonctionne plus.' });
  })
);

// ============================================================================
// 7. APPARENCE & THÈMES — défaut entreprise + autorisation de personnalisation
// ============================================================================

const ALLOWED_THEMES = ['light', 'dark', 'atlas', 'craft', 'signal', 'swiss', 'bento'] as const;
const CompanyAppearanceSchema = z.object({
  defaultTheme: z.enum(ALLOWED_THEMES).optional(),
  allowThemeOverride: z.boolean().optional(),
  /** Ouvrir le tableau de bord sur « Ma file » plutôt que sur la synthèse */
  accueilMaFile: z.boolean().optional(),
});

/**
 * GET /api/admin/appearance
 * Renvoie le défaut et l'autorisation actuels de l'entreprise connectée (uniquement la sienne).
 */
adminRouter.get(
  '/appearance',
  policy('admin.appearance.read'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, "Accès réservé à l'administrateur", 'FORBIDDEN');
    }
    const companyId = tenantOf(caller);
    let company: {
      id: number;
      name: string;
      defaultTheme?: string | null;
      allowThemeOverride?: boolean | null;
      accueilMaFile?: boolean | null;
      siegeAdresse?: string | null;
      siegeLat?: number | null;
      siegeLng?: number | null;
    } | null;
    try {
      company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, defaultTheme: true, allowThemeOverride: true, accueilMaFile: true, siegeAdresse: true, siegeLat: true, siegeLng: true },
      });
    } catch (e) {
      if (!isMissingSchemaError(e)) throw e;
      // Colonnes absentes : on renvoie les valeurs par défaut.
      company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });
    }
    if (!company) throw new AppError(404, 'Entreprise introuvable', 'COMPANY_NOT_FOUND');
    res.json({
      companyId: company.id,
      companyName: company.name,
      defaultTheme: company.defaultTheme || 'light',
      allowThemeOverride: company.allowThemeOverride !== false,
      accueilMaFile: company.accueilMaFile === true,
      siegeAdresse: company.siegeAdresse || null,
      siegeLat: company.siegeLat || null,
      siegeLng: company.siegeLng || null,
      availableThemes: ALLOWED_THEMES,
    });
  })
);

/**
 * PATCH /api/admin/appearance
 * Modifie le défaut et/ou le flag d'autorisation pour l'entreprise connectée.
 */
adminRouter.patch(
  '/appearance',
  policy('admin.appearance.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, "Accès réservé à l'administrateur", 'FORBIDDEN');
    }
    const parsed = CompanyAppearanceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'Paramètres invalides', 'INVALID_PAYLOAD');
    }
    const { defaultTheme, allowThemeOverride, accueilMaFile } = parsed.data;
    if (defaultTheme === undefined && allowThemeOverride === undefined && accueilMaFile === undefined) {
      throw new AppError(400, 'Rien à mettre à jour', 'EMPTY_PAYLOAD');
    }

    const companyId = tenantOf(caller);
    let updated;
    try {
      updated = await prisma.company.update({
        where: { id: companyId },
        data: {
          ...(defaultTheme !== undefined ? { defaultTheme } : {}),
          ...(allowThemeOverride !== undefined ? { allowThemeOverride } : {}),
          ...(accueilMaFile !== undefined ? { accueilMaFile } : {}),
        },
        select: { id: true, name: true, defaultTheme: true, allowThemeOverride: true, accueilMaFile: true },
      });
    } catch (e) {
      if (isMissingSchemaError(e)) {
        throw new AppError(
          503,
          "La personnalisation de l'apparence n'est pas encore disponible (base de données en cours de mise à jour).",
          'THEME_PERSISTENCE_UNAVAILABLE'
        );
      }
      throw e;
    }

    res.json({
      companyId: updated.id,
      companyName: updated.name,
      defaultTheme: updated.defaultTheme || 'light',
      allowThemeOverride: updated.allowThemeOverride !== false,
      accueilMaFile: updated.accueilMaFile === true,
      message: "Apparence de l'entreprise mise à jour.",
    });
  })
);

// ============================================================================
// 8. ADRESSE DU SIÈGE — point de départ des tournées, propre à chaque entreprise
// ============================================================================

const CompanySiegeSchema = z.object({
  siegeAdresse: z.string().min(3, 'Adresse trop courte').max(500),
  siegeLat: z.number().min(-90).max(90),
  siegeLng: z.number().min(-180).max(180),
});

/**
 * PATCH /api/admin/siege
 * Met à jour l'adresse du siège de l'entreprise connectée (uniquement la sienne).
 */
adminRouter.patch(
  '/siege',
  policy('admin.siege.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) {
      throw new AppError(403, "Accès réservé à l'administrateur", 'FORBIDDEN');
    }
    const parsed = CompanySiegeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0]?.message || 'Paramètres invalides', 'INVALID_PAYLOAD');
    }
    const { siegeAdresse, siegeLat, siegeLng } = parsed.data;
    const companyId = tenantOf(caller);

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { siegeAdresse, siegeLat, siegeLng },
      select: { id: true, name: true, siegeAdresse: true, siegeLat: true, siegeLng: true },
    });

    res.json({
      companyId: updated.id,
      companyName: updated.name,
      siegeAdresse: updated.siegeAdresse,
      siegeLat: updated.siegeLat,
      siegeLng: updated.siegeLng,
      message: 'Adresse du siège mise à jour.',
    });
  })
);


/** Réglages des automatisations « technicien » de la société (direction uniquement). */
adminRouter.get(
  '/automatisations',
  policy('admin.automations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) throw new AppError(403, "Accès réservé à l'administrateur", 'FORBIDDEN');
    const c = await (prisma as any).company.findUnique({
      where: { id: tenantOf(caller) },
      select: { autoTechnicienActif: true, autoTechnicienDelaiMinutes: true },
    });
    res.json({
      data: {
        autoTechnicienActif: c ? c.autoTechnicienActif !== false : true,
        autoTechnicienDelaiMinutes: normaliserDelai(c?.autoTechnicienDelaiMinutes),
      },
    });
  })
);

adminRouter.patch(
  '/automatisations',
  policy('admin.automations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const caller = await getCallerUser(req);
    if (!caller.isAdmin) throw new AppError(403, "Accès réservé à l'administrateur", 'FORBIDDEN');
    const parsed = z
      .object({ autoTechnicienActif: z.boolean().optional(), autoTechnicienDelaiMinutes: z.number().int().optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success || (parsed.data.autoTechnicienActif === undefined && parsed.data.autoTechnicienDelaiMinutes === undefined)) {
      throw new AppError(400, 'Paramètres invalides', 'INVALID_PAYLOAD');
    }
    const data: any = {};
    if (parsed.data.autoTechnicienActif !== undefined) data.autoTechnicienActif = parsed.data.autoTechnicienActif;
    if (parsed.data.autoTechnicienDelaiMinutes !== undefined) {
      data.autoTechnicienDelaiMinutes = normaliserDelai(parsed.data.autoTechnicienDelaiMinutes);
    }
    const updated = await (prisma as any).company.update({
      where: { id: tenantOf(caller) },
      data,
      select: { autoTechnicienActif: true, autoTechnicienDelaiMinutes: true },
    });
    res.json({ data: updated, message: 'Automatisations mises à jour' });
  })
);
