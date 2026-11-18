import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { assertStrongPassword } from '../lib/password.js';
import { authMiddleware } from '../middleware/auth.js';
import { PLATFORM_CREATOR, getEffectivePermissions, isPlatformCreatorIdentity, ROLE_DEFINITIONS, sanitizePermissionsForRole } from '../../shared/types.js';
import { resolveCreatorAwarePhone, syncPlatformCreatorInDb } from '../lib/platformCreator.js';
import { z } from 'zod';
import crypto from 'crypto';
import { esc, sendConfirmationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { initCompanyReferentiels } from '../lib/companyInit.js';
import { disconnectUserSockets } from '../socket/index.js';
import {
  basePublicUserSelect,
  findPublicUserUnique,
  findPublicUserFirst,
  findPublicUsersByEmail,
  findUserInCompany,
  normaliserEmail,
  descriptionEntreprise,
  type AuthUserRow,
  areThemeColumnsAvailable,
  areSidebarColumnsAvailable,
  isMissingSchemaError,
} from '../lib/userSelect.js';

export const authRouter = Router();

const RESEND_COOLDOWN_MS = 45_000;
const UNCONFIRMED_COMPANY_GRACE_MS = 15 * 60_000;

async function assertOrCleanPendingCompany(
  tx: any,
  whereOr: Record<string, unknown>[]
): Promise<void> {
  const existingCompany = await tx.company.findFirst({ where: { OR: whereOr } });
  if (!existingCompany) return;

  const existingUsers = await tx.user.findMany({
    where: { companyId: existingCompany.id },
    select: {
      id: true,
      emailConfirmed: true,
      active: true,
      confirmationCodeExpires: true,
      createdAt: true,
    },
  });
  const now = Date.now();
  const isExpiredUnconfirmedOnly =
    existingUsers.length > 0 &&
    existingUsers.every((u: any) => {
      if (u.emailConfirmed || u.active) return false;
      const expiresAt = u.confirmationCodeExpires
        ? new Date(u.confirmationCodeExpires).getTime()
        : new Date(u.createdAt).getTime() + UNCONFIRMED_COMPANY_GRACE_MS;
      return expiresAt < now;
    });

  if (!isExpiredUnconfirmedOnly) {
    throw new AppError(
      409,
      'Une entreprise portant ce nom ou ce SIREN/SIRET existe déjà sur la plateforme. Pour la rejoindre, demandez une invitation à son administrateur.',
      'COMPANY_EXISTS'
    );
  }

  await tx.referentiel.deleteMany({ where: { companyId: existingCompany.id } });
  await tx.user.deleteMany({ where: { companyId: existingCompany.id } });
  await tx.company.delete({ where: { id: existingCompany.id } });
}

async function isCompanyActiveForUser(user: { companyId?: number | null; company?: { active?: boolean } | null }): Promise<boolean> {
  if (user.company && typeof user.company.active === 'boolean') return user.company.active;
  if (user.companyId == null) return true;
  const comp = await prisma.company.findUnique({ where: { id: user.companyId }, select: { active: true } });
  return !comp ? false : comp.active !== false;
}

// Confirmation d'e-mail et acceptation contractuelle des conditions
authRouter.get(
  '/confirm-email',
  asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(400).send('<h1>Lien de confirmation invalide</h1><p>Le jeton de validation est manquant.</p>');
    }

    const user = await prisma.user.findFirst({
      where: { confirmationToken: token },
      include: { company: true },
    });

    if (!user || user.emailConfirmed === true || !(await isCompanyActiveForUser(user))) {
      return res.status(404).send("<h1>Jeton d'activation introuvable ou déjà utilisé</h1><p>Veuillez contacter le support ANELEC GROUPE.</p>");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        active: true,
        emailConfirmed: true,
        confirmationToken: null,
        confirmationCode: null,
        confirmationCodeExpires: null,
        confirmationCodeAttempts: 0,
        confirmationSentAt: null,
        termsAcceptedAt: new Date(),
        termsAcceptedIp: String(req.ip || req.headers['x-forwarded-for'] || ''),
      },
    });

    const companyName = esc(user.company?.name || 'votre entreprise');
    const safeName = esc(user.name);
    const rawBaseUrl = (process.env.APP_URL || 'https://suivi.anelecgroupe.com').trim();
    const safeBaseUrl = /^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl.replace(/\/+$/, '') : 'https://suivi.anelecgroupe.com';
    const loginUrl = esc(`${safeBaseUrl}/login?activated=1`);

    return res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Espace Activé avec Succès — ANELEC TCE</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0f1d; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { max-width: 540px; background: #0f1422; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 40px; text-align: center; box-shadow: 0 25px 60px rgba(0,0,0,0.5); }
    .icon { font-size: 52px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #00bf63; }
    p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0; }
    .btn { display: inline-block; background: #00bf63; color: #fff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 10px; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .legal-note { font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Espace Entreprise Activé !</h1>
    <p>
      Félicitations <strong>${safeName}</strong> ! Votre compte administrateur et l'espace de <strong>${companyName}</strong> ont été certifiés et activés avec succès.<br /><br />
      Les conditions contractuelles et la politique RGPD ont été formellement validées et enregistrées.
    </p>
    <a href="${loginUrl}" class="btn">Accéder à la plateforme ANELEC TCE</a>
    <div class="legal-note">
      Hébergement sécurisé souverain en France (Supabase & Hostinger) • ANELEC GROUPE
    </div>
  </div>
</body>
</html>`);
  })
);


function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve().then(() => handler(req, res, next)).catch(next);
  };
}

const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
  /** Entreprise choisie quand le même e-mail a un compte dans plusieurs entreprises. */
  companyId: z.number().int().positive().optional(),
});

/** Hachage factice : on dépense le même temps de calcul quand l'e-mail est inconnu (pas d'énumération par la durée). */
const HASH_FACTICE = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

/** Erreur « plusieurs comptes pour cet e-mail » : l'appelant doit préciser l'entreprise. */
function choixEntrepriseRequis(comptes: AuthUserRow[]) {
  return new AppError(
    409,
    'Cette adresse e-mail a un compte dans plusieurs entreprises. Choisissez l’entreprise à ouvrir.',
    'COMPANY_CHOICE_REQUIRED',
    { entreprises: comptes.map(descriptionEntreprise) }
  );
}

const RegisterSchema = z.object({
  name: z.string().min(1, 'Nom du responsable requis').max(100),
  email: z.string().email('Email professionnel invalide'),
  password: z.string().min(1, 'Mot de passe requis').max(128, 'Mot de passe trop long'),
  phone: z.string().max(30).optional(),
  companyName: z.string().min(2, "Nom de l'entreprise requis").max(120),
  siretOrSiren: z.string().optional(),
});

function generateTokens(user: {
  id: number;
  email: string;
  role: string;
  companyId?: number | null;
  tokenVersion?: number | null;
}) {
  // Pas d'entreprise de repli : un compte sans entreprise reçoit un jeton sans companyId (donc aucun accès aux données).
  const sv = typeof user.tokenVersion === 'number' && Number.isInteger(user.tokenVersion) ? user.tokenVersion : 1;
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId ?? undefined,
    sv,
  };
  const accessToken = jwt.sign({ ...payload, type: 'access' }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
    // En production, ne pas spécifier de domaine pour que le cookie
    // soit associé au domaine exact de la requête (fonctionne sur www et non-www)
  };
  res.cookie('accessToken', accessToken, options);
  res.cookie('refreshToken', refreshToken, { ...options, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

export function formatPublicUser(u: {
  id: number;
  email: string;
  phone?: string | null;
  name: string;
  role: string;
  technicienNom?: string | null;
  permissionsJson?: string | null;
  active?: boolean;
  companyId?: number | null;
  themePref?: string | null;
  sidebarModelPref?: string | null;
  company?: {
    id: number;
    name: string;
    siret?: string | null;
    siren?: string | null;
    defaultTheme?: string | null;
    allowThemeOverride?: boolean | null;
    defaultSidebarModel?: string | null;
    accueilMaFile?: boolean | null;
    siegeAdresse?: string | null;
    siegeLat?: number | null;
    siegeLng?: number | null;
  } | null;
  createdAt?: Date | string;
}) {
  const isCreator = isPlatformCreatorIdentity(u);
  const effectiveRole = isCreator && (!u.role || u.role === 'ADMIN') ? 'ADMIN' : u.role;
  const companyId = u.companyId ?? u.company?.id ?? null;
  const companyName = u.company?.name || (companyId === null ? null : `Entreprise #${companyId}`);
  const companyDefaultTheme = u.company?.defaultTheme || 'light';
  const allowThemeOverride = u.company?.allowThemeOverride !== false;
  const userThemePref = u.themePref || null;
  const resolvedTheme = allowThemeOverride && userThemePref ? userThemePref : companyDefaultTheme;
  const sidebarCompanyDefault = u.company?.defaultSidebarModel || 'classic';
  const sidebarUserPref = u.sidebarModelPref || null;
  const sidebarResolved = sidebarUserPref || sidebarCompanyDefault;
  return {
    id: u.id,
    email: u.email,
    phone: u.phone ?? (isCreator ? PLATFORM_CREATOR.phone : null),
    isCreator,
    name: u.name,
    role: effectiveRole,
    technicienNom: u.technicienNom || null,
    permissions: getEffectivePermissions(effectiveRole, u.permissionsJson),
    active: u.active !== false,
    companyId,
    companyName,
    companySiret: u.company?.siret ?? null,
    company: u.company
      ? {
          id: u.company.id,
          name: u.company.name,
          siret: u.company.siret,
          siren: u.company.siren,
          accueilMaFile: u.company.accueilMaFile === true,
          siegeAdresse: u.company.siegeAdresse ?? null,
          siegeLat: u.company.siegeLat ?? null,
          siegeLng: u.company.siegeLng ?? null,
        }
      : null,
    theme: {
      companyDefault: companyDefaultTheme,
      allowOverride: allowThemeOverride,
      userPref: userThemePref,
      resolved: resolvedTheme,
      sidebarCompanyDefault,
      sidebarUserPref,
      sidebarResolved,
    },
    createdAt: u.createdAt,
  };
}

const publicUserSelect = basePublicUserSelect;

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = RegisterSchema.parse(req.body);
    data.email = normaliserEmail(data.email);
    const cleanCompanyName = (data.companyName || '').trim();
    const cleanName = data.name.trim();
    if (cleanCompanyName.length < 2 || !cleanName) {
      throw new AppError(400, "Le nom du responsable et le nom de l'entreprise sont obligatoires", 'INVALID_COMPANY');
    }

    // Validation stricte SIRET/SIREN et politique de mot de passe AVANT toute écriture en base (pas de squat d'entreprise)
    const rawDigits = (data.siretOrSiren || '').replace(/\s+/g, '').replace(/[^0-9]/g, '');
    let cleanSiret: string | null = null;
    let cleanSiren: string | null = null;
    if (rawDigits.length === 14) {
      cleanSiret = rawDigits;
      cleanSiren = rawDigits.slice(0, 9);
    } else if (rawDigits.length === 9) {
      cleanSiren = rawDigits;
      cleanSiret = `${rawDigits}00010`;
    } else if (rawDigits.length > 0) {
      throw new AppError(400, 'Le SIREN doit comporter 9 chiffres et le SIRET 14 chiffres.', 'INVALID_SIRET');
    }

    assertStrongPassword(data.password, { email: data.email, name: cleanName, companyName: cleanCompanyName });
    const password = await bcrypt.hash(data.password, 12);
    // Tout créateur d'espace entreprise est ADMINISTRATEUR de son espace
    const role = 'ADMIN';

    // Génération d'un code unique à 6 chiffres pour la confirmation par e-mail
    const confirmationCode = String(crypto.randomInt(100000, 999999));
    const confirmationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // expire dans 15 min
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const confirmationSentAt = new Date();

    const resolvedPhone = resolveCreatorAwarePhone(data.email, data.phone);
    const isCreator = isPlatformCreatorIdentity({ email: data.email });
    if (isCreator) {
      await syncPlatformCreatorInDb();
    }

    let companyId: number;
    try {
      const createdResult = await prisma.$transaction(async (tx) => {
        await assertOrCleanPendingCompany(tx, [
          ...(cleanSiret ? [{ siret: cleanSiret }] : []),
          ...(cleanSiren ? [{ siren: cleanSiren }] : []),
          { name: { equals: cleanCompanyName, mode: 'insensitive' } },
        ]);

        const company = await tx.company.create({
          data: {
            name: cleanCompanyName,
            siret: cleanSiret,
            siren: cleanSiren,
          },
        });
        await initCompanyReferentiels(company.id, cleanName, tx);

        const userData: Record<string, unknown> = {
          email: data.email,
          password,
          name: isCreator && !cleanName ? PLATFORM_CREATOR.name : cleanName,
          role,
          companyId: company.id,
          active: false,
          emailConfirmed: false,
          confirmationToken,
          confirmationCode,
          confirmationCodeExpires,
          confirmationCodeAttempts: 0,
          confirmationSentAt,
          ...(resolvedPhone ? { phone: resolvedPhone } : {}),
        };
        const createdUser = await tx.user.create({
          data: userData as any,
          select: publicUserSelect,
        });
        return { companyId: company.id, user: createdUser };
      });
      companyId = createdResult.companyId;
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      if (e?.code === 'P2002') {
        throw new AppError(
          409,
          'Une entreprise portant ce nom ou ce SIREN/SIRET existe déjà sur la plateforme. Pour la rejoindre, demandez une invitation à son administrateur.',
          'COMPANY_EXISTS'
        );
      }
      throw e;
    }

    // Envoi de l'e-mail officiel d'activation avec code 6 chiffres
    const delivery = await sendConfirmationEmail({
      companyId,
      toEmail: data.email,
      recipientName: cleanName,
      companyName: cleanCompanyName,
      confirmationToken,
      confirmationCode,
    });

    res.status(201).json({
      companyId,
      companyName: cleanCompanyName,
      message:
        delivery.channel === 'SMTP_PRODUCTION' || delivery.channel === 'SUPABASE_AUTH_RELAY'
          ? `Un code de confirmation à 6 chiffres a été envoyé à ${data.email} depuis zehair@anelecgroupe.com. Saisissez-le pour activer votre espace entreprise.`
          : `Un code de confirmation a été généré pour ${data.email}. Saisissez-le ci-dessous pour activer votre espace.`,
      emailSent: delivery.sent,
      email: data.email,
      requiresConfirmation: true,
      deliveryChannel: delivery.channel,
      previewUrl: config.nodeEnv !== 'production' ? delivery.previewUrl || null : null,
      activationLink: null,
    });
  })
);

// Renvoi de l'e-mail de confirmation pour un compte en attente d'activation
authRouter.post(
  '/resend-confirmation',
  asyncHandler(async (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      throw new AppError(400, 'Adresse e-mail requise', 'EMAIL_REQUIRED');
    }

    const companyIdDemande = Number.isInteger(req.body?.companyId) ? Number(req.body.companyId) : null;
    const comptes = await prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' }, ...(companyIdDemande ? { companyId: companyIdDemande } : {}) },
      include: { company: true },
      orderBy: { id: 'asc' },
    });

    if (comptes.length === 0) {
      throw new AppError(404, 'Aucun compte trouvé avec cette adresse e-mail', 'USER_NOT_FOUND');
    }

    const enAttente: any[] = [];
    for (const c of comptes as any[]) {
      if (!c.emailConfirmed && (await isCompanyActiveForUser(c))) {
        enAttente.push(c);
      }
    }
    if (enAttente.length === 0) {
      if (comptes.some((c: any) => c.emailConfirmed && c.active)) {
        return res.json({
          alreadyConfirmed: true,
          message: 'Ce compte est déjà confirmé et actif. Vous pouvez vous connecter directement.',
        });
      }
      throw new AppError(403, 'Aucun espace actif en attente de confirmation pour cette adresse', 'FORBIDDEN');
    }

    let delivery: Awaited<ReturnType<typeof sendConfirmationEmail>> | null = null;
    for (const user of enAttente as any[]) {
      const hasActiveCode = Boolean(user.confirmationCode) && (user.confirmationCodeAttempts ?? 0) < 5;
      const lastSentMs = user.confirmationSentAt ? new Date(user.confirmationSentAt).getTime() : 0;
      if (hasActiveCode && lastSentMs > 0 && Date.now() - lastSentMs < RESEND_COOLDOWN_MS) {
        throw new AppError(
          429,
          'Un code de confirmation vient déjà d’être envoyé. Patientez quelques instants avant de redemander un envoi.',
          'RESEND_COOLDOWN'
        );
      }

      const confirmationToken = user.confirmationToken || crypto.randomBytes(32).toString('hex');
      const confirmationCode = String(crypto.randomInt(100000, 999999));
      const confirmationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          confirmationToken,
          confirmationCode,
          confirmationCodeExpires,
          confirmationCodeAttempts: 0,
          confirmationSentAt: new Date(),
        },
      });

      const compName = user.company?.name || 'votre entreprise';
      delivery = await sendConfirmationEmail({
        companyId: user.companyId,
        toEmail: user.email,
        recipientName: user.name,
        companyName: compName,
        confirmationToken,
        confirmationCode,
      });
    }
    const user = enAttente[0] as any;
    if (!delivery) throw new AppError(500, 'Envoi impossible', 'SEND_FAILED');

    return res.json({
      message:
        delivery.channel === 'SMTP_PRODUCTION' || delivery.channel === 'SUPABASE_AUTH_RELAY'
          ? `Un nouvel e-mail de confirmation a été envoyé à ${user.email}.`
          : `Nouvel e-mail de confirmation généré pour ${user.email}.`,
      emailSent: delivery.sent,
      email: user.email,
      deliveryChannel: delivery.channel,
      previewUrl: config.nodeEnv !== 'production' ? delivery.previewUrl || null : null,
      activationLink: null,
    });
  })
);

// Vérification du code de confirmation à 6 chiffres (limitée à 5 essais avant invalidation du code)
authRouter.post(
  '/verify-code',
  asyncHandler(async (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();

    if (!email || !code) {
      throw new AppError(400, 'Email et code de confirmation requis', 'MISSING_FIELDS');
    }
    if (!/^\d{6}$/.test(code)) {
      throw new AppError(400, 'Le code doit contenir exactement 6 chiffres', 'INVALID_CODE_FORMAT');
    }

    const companyIdDemande = Number.isInteger(req.body?.companyId) ? Number(req.body.companyId) : null;
    const comptes: any[] = await prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' }, ...(companyIdDemande ? { companyId: companyIdDemande } : {}) },
      include: { company: true },
      orderBy: { id: 'asc' },
    });

    if (comptes.length === 0) {
      throw new AppError(404, 'Aucun compte trouvé avec cette adresse e-mail', 'USER_NOT_FOUND');
    }

    const pending: any[] = [];
    for (const c of comptes) {
      if (!c.emailConfirmed && (await isCompanyActiveForUser(c))) {
        pending.push(c);
      }
    }
    if (pending.length === 0) {
      if (comptes.every((c) => c.emailConfirmed && c.active)) {
        return res.json({
          alreadyConfirmed: true,
          message: 'Ce compte est déjà confirmé et actif. Vous pouvez vous connecter.',
        });
      }
      throw new AppError(403, 'Ce compte ne peut pas être activé', 'ACCOUNT_DISABLED');
    }

    const codeBuf = Buffer.from(code, 'utf8');
    const user = pending.find((c) => {
      if (!c.confirmationCode || (c.confirmationCodeAttempts ?? 0) >= 5) return false;
      const storedBuf = Buffer.from(String(c.confirmationCode), 'utf8');
      return storedBuf.length === codeBuf.length && crypto.timingSafeEqual(storedBuf, codeBuf);
    });

    if (!user) {
      let locked = false;
      for (const c of pending) {
        if ((c.confirmationCodeAttempts ?? 0) >= 5 || !c.confirmationCode) {
          locked = true;
          continue;
        }
        const inc = await prisma.user.updateMany({
          where: {
            id: c.id,
            confirmationCode: c.confirmationCode,
            ...(typeof c.confirmationCodeAttempts === 'number'
              ? { confirmationCodeAttempts: { lt: 5 } }
              : {}),
          },
          data: {
            confirmationCodeAttempts: { increment: 1 },
          },
        });
        if (inc.count === 0) {
          locked = true;
          continue;
        }
        const nextAttempts = (c.confirmationCodeAttempts ?? 0) + 1;
        if (nextAttempts >= 5) {
          locked = true;
          await prisma.user.updateMany({
            where: { id: c.id, confirmationCodeAttempts: { gte: 5 } },
            data: { confirmationCode: null, confirmationCodeExpires: null },
          });
        }
      }
      if (locked) {
        throw new AppError(429, 'Trop de tentatives incorrectes : demandez un nouveau code de confirmation.', 'TOO_MANY_ATTEMPTS');
      }
      throw new AppError(403, 'Code de confirmation incorrect. Vérifiez le code reçu par e-mail.', 'INVALID_CODE');
    }

    // Vérifier l'expiration (15 min)
    if (!user.confirmationCodeExpires || user.confirmationCodeExpires.getTime() < Date.now()) {
      throw new AppError(410, 'Ce code a expiré. Cliquez sur « Renvoyer le code » pour en recevoir un nouveau.', 'CODE_EXPIRED');
    }

    // Activer le compte
    const activated = await prisma.user.update({
      where: { id: user.id },
      data: {
        active: true,
        emailConfirmed: true,
        confirmationToken: null,
        confirmationCode: null,
        confirmationCodeExpires: null,
        confirmationCodeAttempts: 0,
        confirmationSentAt: null,
        termsAcceptedAt: new Date(),
        termsAcceptedIp: String(req.ip || req.headers['x-forwarded-for'] || ''),
      },
      select: publicUserSelect,
    });

    const companyName = user.company?.name || 'votre entreprise';

    // Générer les tokens et connecter directement l'utilisateur
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      tokenVersion: (activated as any).tokenVersion,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const pub = formatPublicUser(activated as any);

    res.json({
      success: true,
      message: `Votre espace entreprise ${companyName} a été activé avec succès !`,
      user: pub,
      accessToken: tokens.accessToken,
    });
  })
);

// Demande de réinitialisation de mot de passe par e-mail (réservée aux comptes actifs et déjà confirmés)
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      throw new AppError(400, 'Adresse e-mail requise', 'EMAIL_REQUIRED');
    }

    const comptes: any[] = await prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { company: { select: { name: true, active: true } } },
      orderBy: { id: 'asc' },
    });

    // Réponse identique que le compte existe ou non (pas d'énumération de comptes).
    const genericMessage = `Si un compte existe pour ${email}, un e-mail de réinitialisation vient d'être envoyé.`;
    for (const user of comptes) {
      if (user.active === false || user.emailConfirmed === false || !(await isCompanyActiveForUser(user))) {
        continue;
      }
      const resetToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          confirmationToken: resetToken,
          confirmationSentAt: new Date(),
        },
      });

      await sendPasswordResetEmail({
        companyId: user.companyId,
        toEmail: user.email,
        recipientName: user.name,
        resetToken,
        companyName: user.company?.name ?? null,
      });
    }

    return res.json({ message: genericMessage, emailSent: true });
  })
);

// Validation du nouveau mot de passe avec jeton de réinitialisation
authRouter.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.password || '');

    if (!token || !newPassword) {
      throw new AppError(400, 'Jeton valide et nouveau mot de passe requis', 'INVALID_RESET');
    }

    const user = await findPublicUserFirst({ confirmationToken: token });

    if (!user) {
      throw new AppError(404, 'Lien de réinitialisation invalide ou expiré', 'INVALID_TOKEN');
    }
    if (user.active === false || user.emailConfirmed === false || !(await isCompanyActiveForUser(user))) {
      throw new AppError(403, 'Ce compte est désactivé ou en attente de confirmation e-mail', 'ACCOUNT_DISABLED');
    }

    const tokenRow = await prisma.user.findUnique({ where: { id: user.id }, select: { confirmationSentAt: true } });
    const sentAt = tokenRow?.confirmationSentAt;
    if (!sentAt || Date.now() - sentAt.getTime() > 2 * 60 * 60 * 1000) {
      throw new AppError(410, 'Ce lien de réinitialisation a expiré. Refaites une demande.', 'TOKEN_EXPIRED');
    }

    assertStrongPassword(newPassword, { email: user.email, name: user.name, companyName: user.company?.name });
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        confirmationToken: null,
        confirmationCode: null,
        confirmationCodeExpires: null,
        confirmationCodeAttempts: 0,
        confirmationSentAt: null,
        tokenVersion: { increment: 1 },
      },
      select: publicUserSelect,
    });
    disconnectUserSockets(user.id);

    const refreshedRow = await findPublicUserUnique({ id: user.id });
    const pub = formatPublicUser((refreshedRow || updated) as any);
    const tokens = generateTokens({
      id: pub.id,
      email: pub.email,
      role: pub.role,
      companyId: pub.companyId,
      tokenVersion: (refreshedRow || updated as any)?.tokenVersion,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return res.json({
      user: pub,
      accessToken: tokens.accessToken,
      message: 'Votre mot de passe a été mis à jour avec succès et votre compte est connecté.',
    });
  })
);

// Confirmation automatique via jeton Supabase Auth (#access_token=...&type=signup)
authRouter.post(
  '/confirm-supabase-token',
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = String(req.body?.accessToken || '').trim();
    if (!accessToken) {
      throw new AppError(400, 'Jeton Supabase manquant', 'TOKEN_REQUIRED');
    }

    const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new AppError(
        503,
        'Confirmation Supabase indisponible : configuration SUPABASE_URL / SUPABASE_ANON_KEY manquante',
        'SUPABASE_NOT_CONFIGURED'
      );
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userRes.ok) {
      throw new AppError(401, 'Lien de confirmation Supabase invalide ou expiré', 'INVALID_SUPABASE_TOKEN');
    }

    const supaUser: any = await userRes.json();
    if (!supaUser?.email_confirmed_at) {
      throw new AppError(403, 'Adresse e-mail non encore confirmée auprès du fournisseur d’identité', 'SUPABASE_EMAIL_UNCONFIRMED');
    }
    const email = String(supaUser?.email || '').toLowerCase().trim();
    if (!email) {
      throw new AppError(400, 'Adresse e-mail introuvable dans le jeton Supabase', 'EMAIL_MISSING');
    }

    const companyIdDemande = Number.isInteger(req.body?.companyId) ? Number(req.body.companyId) : null;
    const comptes = await findPublicUsersByEmail(email, { companyId: companyIdDemande });
    if (comptes.length === 0) {
      throw new AppError(404, `Aucun compte trouvé pour ${email}`, 'USER_NOT_FOUND');
    }
    // Seuls les comptes encore en attente de confirmation (et dont l'entreprise est active) peuvent être activés ici.
    const enAttente: typeof comptes = [];
    for (const c of comptes) {
      if (!c.emailConfirmed && (await isCompanyActiveForUser(c))) {
        enAttente.push(c);
      }
    }
    if (enAttente.length === 0) {
      if (comptes.some((c) => c.emailConfirmed && c.active === false)) {
        throw new AppError(403, 'Ce compte utilisateur a été désactivé par l’administrateur', 'ACCOUNT_DISABLED');
      }
      if (comptes.some((c) => c.emailConfirmed)) {
        throw new AppError(409, 'Compte déjà confirmé : connectez-vous directement avec vos identifiants.', 'ALREADY_CONFIRMED');
      }
      throw new AppError(403, 'Aucun espace actif en attente de confirmation pour ce compte', 'FORBIDDEN');
    }
    if (enAttente.length > 1) throw choixEntrepriseRequis(enAttente);
    const user = enAttente[0];

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        active: true,
        emailConfirmed: true,
        confirmationToken: null,
        confirmationCode: null,
        confirmationCodeExpires: null,
        confirmationCodeAttempts: 0,
        confirmationSentAt: null,
        termsAcceptedAt: new Date(),
      },
      select: publicUserSelect,
    });

    const pub = formatPublicUser(updated);
    const tokens = generateTokens({
      id: pub.id,
      email: pub.email,
      role: pub.role,
      companyId: pub.companyId,
      tokenVersion: (updated as any).tokenVersion,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return res.json({
      user: pub,
      accessToken: tokens.accessToken,
      message: `Espace entreprise activé avec succès pour ${pub.email} !`,
    });
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = LoginSchema.parse(req.body);
    // Un compte = (e-mail, entreprise). Le mot de passe désigne le(s) compte(s) de cet e-mail ; si plusieurs
    // entreprises correspondent, on demande laquelle ouvrir — mais SEULEMENT après un mot de passe valide, pour ne
    // jamais révéler à un tiers dans quelles entreprises une adresse est inscrite.
    const comptes = await findPublicUsersByEmail(data.email, { withPassword: true, companyId: data.companyId ?? null });
    const valides: AuthUserRow[] = [];
    for (const c of comptes) {
      if (c.password && (await bcrypt.compare(data.password, c.password))) valides.push(c);
    }
    if (comptes.length === 0) await bcrypt.compare(data.password, HASH_FACTICE);
    if (valides.length === 0) {
      throw new AppError(401, 'Email ou mot de passe incorrect', 'INVALID_CREDENTIALS');
    }
    if (valides.length > 1) throw choixEntrepriseRequis(valides);
    const user = valides[0];
    if ((user as any).emailConfirmed === false) {
      throw new AppError(
        403,
        "Votre espace entreprise" + (user.company?.name ? ` « ${user.company.name} »` : '') + " est en attente d'activation. Veuillez consulter votre boîte mail (" + user.email + ") et cliquer sur le lien de confirmation envoyé par zehair@anelecgroupe.com pour accepter les conditions et activer votre compte.",
        'EMAIL_NOT_CONFIRMED'
      );
    }
    if (user.active === false) {
      throw new AppError(403, 'Ce compte utilisateur a été désactivé par l’administrateur', 'ACCOUNT_DISABLED');
    }
    if (!(await isCompanyActiveForUser(user))) {
      throw new AppError(403, 'Cet espace entreprise a été désactivé', 'COMPANY_DISABLED');
    }

    const pub = formatPublicUser(user);
    const tokens = generateTokens({
      id: pub.id,
      email: pub.email,
      role: pub.role,
      companyId: pub.companyId,
      tokenVersion: user.tokenVersion,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({
      user: pub,
      accessToken: tokens.accessToken,
      message: 'Connexion réussie',
    });
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const token =
      req.cookies?.accessToken ||
      req.cookies?.refreshToken ||
      req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret, { ignoreExpiration: true }) as { userId?: number };
        if (decoded && Number.isInteger(decoded.userId)) {
          await prisma.user.update({
            where: { id: decoded.userId },
            data: { tokenVersion: { increment: 1 } },
          });
          disconnectUserSockets(decoded.userId!);
        }
      } catch (err: any) {
        const isJwtErr = err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError;
        if (!isJwtErr) {
          console.error('[auth/logout] Échec lors de l’invalidation de session:', err?.message || err);
        }
      }
    }
    clearAuthCookies(res);
    res.json({ message: 'Déconnexion réussie' });
  })
);

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, 'Non authentifié', 'UNAUTHORIZED');
    const user = await findPublicUserUnique({ id: req.user.userId });
    if (!user || user.active === false || user.emailConfirmed === false || !(await isCompanyActiveForUser(user))) {
      throw new AppError(403, 'Compte inactif, non confirmé ou introuvable', 'ACCOUNT_DISABLED');
    }
    res.json({ user: formatPublicUser(user) });
  })
);

// Liste blanche des thèmes accessibles aux utilisateurs
const ALLOWED_THEMES = ['light', 'dark', 'atlas', 'craft', 'signal', 'swiss', 'bento'] as const;
const ThemeIdSchema = z.enum(ALLOWED_THEMES);
const ALLOWED_SIDEBAR_MODELS = ['classic', 'line', 'rail', 'cards', 'accordion', 'floating'] as const;
const SidebarModelIdSchema = z.enum(ALLOWED_SIDEBAR_MODELS);

/**
 * PATCH /api/auth/me/theme
 * ------------------------------------------------------------------
 * Enregistre la préférence d'apparence personnelle de l'utilisateur :
 * - `theme` (7 Directions Artistiques, soumise à `allowThemeOverride`)
 * - `sidebarModel` (6 modèles de menu latéral, toujours personnalisable par l'utilisateur)
 * - Envoyer `null` ou `"reset"` supprime la préférence personnelle (retour au défaut entreprise).
 */
authRouter.patch(
  '/me/theme',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, 'Non authentifié', 'UNAUTHORIZED');

    const raw = (req.body ?? {}) as { theme?: string | null; sidebarModel?: string | null };
    const hasTheme = Object.prototype.hasOwnProperty.call(raw, 'theme');
    const hasSidebar = Object.prototype.hasOwnProperty.call(raw, 'sidebarModel');
    if (!hasTheme && !hasSidebar) {
      throw new AppError(400, 'Paramètre de thème ou de menu manquant', 'INVALID_PAYLOAD');
    }

    let nextTheme: string | null | undefined;
    if (hasTheme) {
      const value = raw.theme;
      if (value === null || value === undefined || value === '' || value === 'reset') {
        nextTheme = null;
      } else {
        const parsed = ThemeIdSchema.safeParse(value);
        if (!parsed.success) throw new AppError(400, 'Thème inconnu', 'INVALID_THEME');
        nextTheme = parsed.data;
      }
    }

    let nextSidebar: string | null | undefined;
    if (hasSidebar) {
      const sVal = raw.sidebarModel;
      if (sVal === null || sVal === undefined || sVal === '' || sVal === 'reset') {
        nextSidebar = null;
      } else {
        const parsed = SidebarModelIdSchema.safeParse(sVal);
        if (!parsed.success) throw new AppError(400, 'Modèle de menu inconnu', 'INVALID_SIDEBAR_MODEL');
        nextSidebar = parsed.data;
      }
    }

    // La persistance du thème nécessite les colonnes de thème en base.
    if (hasTheme && !areThemeColumnsAvailable()) {
      throw new AppError(
        503,
        "La personnalisation de l'apparence n'est pas encore disponible (base de données en cours de mise à jour).",
        'THEME_PERSISTENCE_UNAVAILABLE'
      );
    }

    const updateData: Record<string, string | null> = {};

    try {
      // Vérifier que l'entreprise autorise la personnalisation de direction artistique (sauf reset).
      if (hasTheme && nextTheme !== null && nextTheme !== undefined) {
        const u = await prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { companyId: true, company: { select: { allowThemeOverride: true } } },
        });
        if (u?.company && u.company.allowThemeOverride === false) {
          throw new AppError(
            403,
            "La personnalisation individuelle de l'apparence a été désactivée par votre administrateur.",
            'THEME_OVERRIDE_DISABLED'
          );
        }
      }

      if (hasTheme) updateData.themePref = nextTheme ?? null;
      if (hasSidebar && areSidebarColumnsAvailable()) updateData.sidebarModelPref = nextSidebar ?? null;

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: req.user.userId },
          data: updateData,
        });
      }
    } catch (e) {
      if (isMissingSchemaError(e)) {
        // Repli sûr si seule la colonne sidebarModelPref manque encore
        if (hasSidebar && !hasTheme) {
          const updated = await findPublicUserUnique({ id: req.user.userId });
          return res.json({
            user: updated ? formatPublicUser(updated) : null,
            persistedLocally: true,
            message: 'Modèle de menu appliqué localement.',
          });
        }
        throw new AppError(
          503,
          "La personnalisation de l'apparence n'est pas encore disponible (base de données en cours de mise à jour).",
          'THEME_PERSISTENCE_UNAVAILABLE'
        );
      }
      throw e;
    }

    const updated = await findPublicUserUnique({ id: req.user.userId });
    res.json({
      user: updated ? formatPublicUser(updated) : null,
      message: 'Préférences d’apparence mises à jour.',
    });
  })
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) throw new AppError(401, 'Refresh token manquant', 'NO_REFRESH_TOKEN');
    try {
      const decoded = jwt.verify(refreshToken, config.jwtSecret) as {
        userId: number;
        email: string;
        role: string;
        companyId?: number;
        type: string;
        sv?: number;
      };
      if (decoded.type !== 'refresh') {
        throw new AppError(401, 'Token de refresh invalide', 'INVALID_REFRESH_TOKEN');
      }
      const user = await findPublicUserUnique({ id: decoded.userId });
      if (!user || user.active === false || user.emailConfirmed === false) {
        throw new AppError(403, 'Compte inactif, non confirmé ou introuvable', 'ACCOUNT_DISABLED');
      }
      if (!(await isCompanyActiveForUser(user))) {
        throw new AppError(403, 'Espace entreprise désactivé', 'COMPANY_DISABLED');
      }
      if (decoded.companyId != null && user.companyId !== decoded.companyId) {
        throw new AppError(401, 'Session entreprise incohérente', 'SESSION_REVOKED');
      }
      const currentSv = typeof user.tokenVersion === 'number' ? user.tokenVersion : 1;
      if (typeof decoded.sv === 'number' ? decoded.sv !== currentSv : currentSv > 1) {
        throw new AppError(401, 'Refresh token révoqué : veuillez vous reconnecter', 'SESSION_REVOKED');
      }
      const pub = formatPublicUser(user);
      const tokens = generateTokens({
        id: pub.id,
        email: pub.email,
        role: pub.role,
        companyId: pub.companyId,
        tokenVersion: currentSv,
      });
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ accessToken: tokens.accessToken, message: 'Token rafraîchi' });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'Refresh token expiré', 'REFRESH_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, 'Refresh token invalide', 'INVALID_REFRESH_TOKEN');
      }
      throw error;
    }
  })
);


// ============================================================================
// INVITATIONS PAR E-MAIL (acceptation publique, jeton à usage unique)
// ============================================================================

function hashInvitationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setInvitationSecurityHeaders(res: Response) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

const INVALID_INVITATION = new AppError(404, 'Invitation invalide, expirée ou déjà utilisée', 'INVALID_INVITATION');

async function findPendingInvitation(rawToken: unknown) {
  const token = String(rawToken || '').trim();
  if (token.length < 20 || token.length > 200) return null;
  const inv = await prisma.companyInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { company: { select: { id: true, name: true, active: true } } },
  });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt.getTime() < Date.now()) return null;
  if (inv.company.active === false) return null;
  return inv;
}

function formatInvitationSummary(inv: NonNullable<Awaited<ReturnType<typeof findPendingInvitation>>>) {
  return {
    email: inv.email,
    companyName: inv.company.name,
    role: inv.role,
    roleLabel: (ROLE_DEFINITIONS as any)[inv.role]?.label || inv.role,
    invitedByName: inv.invitedByName,
    expiresAt: inv.expiresAt.toISOString(),
  };
}

authRouter.post(
  '/invitations/lookup',
  asyncHandler(async (req: Request, res: Response) => {
    setInvitationSecurityHeaders(res);
    const inv = await findPendingInvitation(req.body?.token);
    if (!inv) throw INVALID_INVITATION;
    res.json(formatInvitationSummary(inv));
  })
);

authRouter.get(
  '/invitations/:token',
  asyncHandler(async (req: Request, res: Response) => {
    setInvitationSecurityHeaders(res);
    const inv = await findPendingInvitation(req.params.token);
    if (!inv) throw INVALID_INVITATION;
    res.json(formatInvitationSummary(inv));
  })
);

const AcceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(1, 'Votre nom est requis').max(100),
  password: z.string().min(1, 'Mot de passe requis').max(128, 'Mot de passe trop long'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Vous devez accepter les conditions d’utilisation' }) }),
});

authRouter.post(
  '/invitations/accept',
  asyncHandler(async (req: Request, res: Response) => {
    setInvitationSecurityHeaders(res);
    const parsed = AcceptInvitationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0]?.message || 'Données invalides', 'VALIDATION_ERROR');
    }
    const { token, name, password } = parsed.data;

    const inv = await findPendingInvitation(token);
    if (!inv) throw INVALID_INVITATION;

    const upperRole = String(inv.role || '').trim().toUpperCase();
    const roleDef = (ROLE_DEFINITIONS as Record<string, (typeof ROLE_DEFINITIONS)[keyof typeof ROLE_DEFINITIONS]>)[upperRole];
    if (!roleDef) {
      throw INVALID_INVITATION;
    }

    const email = inv.email.trim().toLowerCase();
    // Doublon PAR entreprise : un compte dans une autre entreprise n'empêche pas d'accepter cette invitation.
    const taken = await findUserInCompany(email, inv.companyId);
    if (taken) {
      throw new AppError(409, `Vous avez déjà un compte dans l'entreprise ${inv.company.name}. Connectez-vous.`, 'EMAIL_EXISTS');
    }

    let resolvedTechNom: string | null = inv.technicienNom ? inv.technicienNom.trim() || null : null;
    if (upperRole === 'TECHNICIEN' && !resolvedTechNom) {
      const candidateTech = name.trim();
      if (candidateTech.length < 2) {
        throw new AppError(400, 'Le nom du technicien doit comporter au moins 2 caractères', 'VALIDATION_ERROR');
      }
      resolvedTechNom = candidateTech;
    }

    let sanitizedInvPermsJson: string | null = null;
    if (inv.permissionsJson) {
      try {
        const parsedPerms = JSON.parse(inv.permissionsJson);
        if (parsedPerms && typeof parsedPerms === 'object' && !Array.isArray(parsedPerms)) {
          const allowedKeys = Object.keys(roleDef.defaultPermissions);
          const cleanPerms: Record<string, boolean> = {};
          for (const k of allowedKeys) {
            if (typeof parsedPerms[k] === 'boolean') cleanPerms[k] = parsedPerms[k];
          }
          const capped = sanitizePermissionsForRole(upperRole, cleanPerms);
          if (Object.keys(capped).length > 0) sanitizedInvPermsJson = JSON.stringify(capped);
        }
      } catch {
        sanitizedInvPermsJson = null;
      }
    }

    assertStrongPassword(password, { email, name, companyName: inv.company.name });
    const hashed = await bcrypt.hash(password, 12);
    const expectedTokenHash = hashInvitationToken(token);

    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const comp = await tx.company.findUnique({ where: { id: inv.companyId }, select: { active: true } });
        if (!comp || comp.active === false) throw INVALID_INVITATION;

        if (upperRole === 'TECHNICIEN' && !inv.technicienNom && resolvedTechNom) {
          const normCandidate = resolvedTechNom.toLowerCase();
          const [companyTechs, refTechs] = await Promise.all([
            tx.user.findMany({
              where: { companyId: inv.companyId },
              select: { technicienNom: true, name: true, role: true },
            }),
            tx.referentiel.findMany({
              where: { companyId: inv.companyId, categorie: 'techniciens' },
              select: { valeurs: true },
            }),
          ]);
          const userCollides = companyTechs.some((u) => {
            const existingTech = (u.technicienNom || '').trim().toLowerCase();
            const existingTechUserName = u.role === 'TECHNICIEN' ? (u.name || '').trim().toLowerCase() : '';
            return existingTech === normCandidate || existingTechUserName === normCandidate;
          });
          const refCollides = refTechs.some((r) => {
            try {
              const parsed = JSON.parse(r.valeurs || '[]');
              if (!Array.isArray(parsed)) return false;
              return parsed.some((item: any) => {
                const label = typeof item === 'string' ? item : item?.nom || item?.name || '';
                return String(label).trim().toLowerCase() === normCandidate;
              });
            } catch {
              return false;
            }
          });
          if (userCollides || refCollides) {
            throw new AppError(
              409,
              'Ce nom de technicien est déjà utilisé dans cette entreprise : ajoutez une initiale ou demandez à l’administrateur de préciser votre nom terrain.',
              'TECHNICIEN_NAME_CONFLICT'
            );
          }
        }

        // Le jeton ne peut servir qu'une fois : re-vérifier tokenHash, expiration et non-consommation dans la transaction
        const claimed = await tx.companyInvitation.updateMany({
          where: {
            id: inv.id,
            tokenHash: expectedTokenHash,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { acceptedAt: new Date() },
        });
        if (claimed.count !== 1) throw INVALID_INVITATION;
        return tx.user.create({
          data: {
            email,
            password: hashed,
            name,
            role: upperRole,
            technicienNom: resolvedTechNom,
            permissionsJson: sanitizedInvPermsJson,
            // Rattachement = celui de l'invitation, jamais une valeur fournie par le client
            companyId: inv.companyId,
            active: true,
            // L'invitation est arrivée sur cette boîte mail : l'adresse est prouvée
            emailConfirmed: true,
            termsAcceptedAt: new Date(),
            termsAcceptedIp: String(req.ip || req.headers['x-forwarded-for'] || ''),
          },
          select: publicUserSelect,
        });
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new AppError(409, `Vous avez déjà un compte dans l'entreprise ${inv.company.name}. Connectez-vous.`, 'EMAIL_EXISTS');
      }
      throw e;
    }

    const pub = formatPublicUser(created);
    const tokens = generateTokens({
      id: pub.id,
      email: pub.email,
      role: pub.role,
      companyId: pub.companyId,
      tokenVersion: (created as any).tokenVersion,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.status(201).json({
      user: pub,
      accessToken: tokens.accessToken,
      message: `Bienvenue dans l'espace ${inv.company.name} !`,
    });
  })
);

// ============================================================================
// CONFIGURATION D'AUTHENTIFICATION PUBLIQUE (GOOGLE CLIENT ID)
// ============================================================================
authRouter.get('/config', (_req: Request, res: Response) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '116679717813-chmnnnkeghjf6qs78qrts9m2o7dl4p20.apps.googleusercontent.com',
    appName: 'ANELEC TCE',
  });
});

const GoogleAuthSchema = z.object({
  credential: z.string().min(1, 'Token Google requis'),
  name: z.string().optional(),
  companyName: z.string().optional(),
  siretOrSiren: z.string().optional(),
  acceptTerms: z.boolean().optional(),
  /** Entreprise choisie quand l'e-mail Google a un compte dans plusieurs entreprises. */
  companyId: z.number().int().positive().optional(),
});

// ============================================================================
// CONNEXION & INSCRIPTION GOOGLE DIRECTE (MULTI-ENTREPRISES RGPD)
// ============================================================================
authRouter.post(
  '/google',
  asyncHandler(async (req: Request, res: Response) => {
    const data = GoogleAuthSchema.parse(req.body);
    let email = '';
    let name = '';
    let picture = '';

    // SÉCURITÉ : l'ancien « mode simulation » (jeton simulated_google_...) permettait de se connecter
    // en tant que n'importe quel utilisateur sans aucune vérification. Il est supprimé.
    if (data.credential.startsWith('simulated_google_')) {
      throw new AppError(401, 'Jeton Google invalide', 'INVALID_GOOGLE_TOKEN');
    } else {
      // Validation officielle du jeton Google (ID Token et Access Token OAuth2 liés au client_id)
      const expectedAud =
        (process.env.GOOGLE_CLIENT_ID || '').trim() ||
        '116679717813-chmnnnkeghjf6qs78qrts9m2o7dl4p20.apps.googleusercontent.com';
      try {
        let profile: any;
        if (data.credential.startsWith('ya29.')) {
          // Jeton d'accès OAuth2 : vérifier d'abord l'audience (client_id) auprès de tokeninfo
          const tokenInfoRes = await fetch(
            `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(data.credential)}`
          );
          if (!tokenInfoRes.ok) {
            throw new AppError(401, 'Jeton d\x27accès Google invalide ou expiré', 'INVALID_GOOGLE_TOKEN');
          }
          const tokenInfo: any = await tokenInfoRes.json();
          if (tokenInfo.aud !== expectedAud && tokenInfo.azp !== expectedAud) {
            throw new AppError(401, 'Jeton Google non émis pour cette application', 'INVALID_GOOGLE_TOKEN');
          }
          if (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true) {
            throw new AppError(400, "L'adresse email Google n'a pas été certifiée par Google", 'EMAIL_NOT_VERIFIED');
          }
          const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${data.credential}` },
          });
          if (!userinfoRes.ok) {
            throw new AppError(401, 'Jeton d\x27accès Google invalide ou expiré', 'INVALID_GOOGLE_TOKEN');
          }
          profile = await userinfoRes.json();
        } else {
          // Jeton d'identité ID Token (GIS)
          const googleRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(data.credential)}`
          );
          if (!googleRes.ok) {
            throw new AppError(401, 'Jeton Google invalide ou expiré', 'INVALID_GOOGLE_TOKEN');
          }
          profile = await googleRes.json();
          if (profile.aud !== expectedAud) {
            throw new AppError(401, 'Jeton Google non émis pour cette application', 'INVALID_GOOGLE_TOKEN');
          }
        }

        if (profile.email_verified !== 'true' && profile.email_verified !== true) {
          throw new AppError(400, "L'adresse email Google n'a pas été certifiée par Google", 'EMAIL_NOT_VERIFIED');
        }
        email = String(profile.email || '').toLowerCase().trim();
        name = String(profile.name || email.split('@')[0]);
        picture = String(profile.picture || '');
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError(401, 'Échec de validation de la session Google auprès des serveurs Google', 'GOOGLE_VERIFY_ERROR');
      }
    }

    if (!email) {
      throw new AppError(400, 'Email Google introuvable', 'INVALID_EMAIL');
    }

    if (data.name && data.name.trim()) {
      name = data.name.trim();
    }

    // Création d'un espace : demandée explicitement par la présence du nom d'entreprise.
    const creationDemandee = !!(data.companyName && data.companyName.trim());

    // 1. L'utilisateur existe déjà : Connexion directe (un compte par entreprise)
    const comptes = creationDemandee ? [] : await findPublicUsersByEmail(email, { withPassword: true });

    if (comptes.length > 0) {
      let user: AuthUserRow | undefined;
      if (data.companyId != null) {
        user = comptes.find((c) => c.companyId === data.companyId);
        if (!user) throw new AppError(404, 'Aucun compte Google dans cette entreprise', 'USER_NOT_FOUND');
      } else if (comptes.length === 1) {
        user = comptes[0];
      } else {
        throw choixEntrepriseRequis(comptes);
      }

      if (!(await isCompanyActiveForUser(user))) {
        throw new AppError(403, 'Cet espace entreprise a été désactivé', 'COMPANY_DISABLED');
      }
      if (user.active === false) {
        if (!user.emailConfirmed) {
          const pendingRow = await prisma.user.findUnique({
            where: { id: user.id },
            select: { confirmationToken: true },
          });
          if (!pendingRow?.confirmationToken) {
            throw new AppError(403, 'Ce compte utilisateur a été désactivé par l’administrateur', 'ACCOUNT_DISABLED');
          }
          await prisma.user.update({
            where: { id: user.id },
            data: {
              emailConfirmed: true,
              active: true,
              confirmationToken: null,
              confirmationCode: null,
              confirmationCodeExpires: null,
              confirmationCodeAttempts: 0,
              confirmationSentAt: null,
            },
          });
        } else {
          throw new AppError(403, 'Ce compte utilisateur a été désactivé par l’administrateur', 'ACCOUNT_DISABLED');
        }
      } else if (!user.emailConfirmed) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailConfirmed: true,
            confirmationToken: null,
            confirmationCode: null,
            confirmationCodeExpires: null,
            confirmationCodeAttempts: 0,
            confirmationSentAt: null,
          },
        });
      }

      const freshUser = (await findPublicUserUnique({ id: user.id })) || user;
      const pub = formatPublicUser(freshUser);
      const tokens = generateTokens({
        id: pub.id,
        email: pub.email,
        role: pub.role,
        companyId: pub.companyId,
        tokenVersion: freshUser.tokenVersion,
      });
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.json({
        user: pub,
        accessToken: tokens.accessToken,
        message: 'Connexion réussie avec votre compte Google',
      });
    }

    // 2. L'utilisateur n'existe pas encore : Inscription nouvelle entreprise
    if (!data.companyName || !data.companyName.trim() || !data.siretOrSiren || !data.siretOrSiren.trim()) {
      return res.json({
        requiresCompanyInfo: true,
        googleProfile: {
          email,
          name,
          picture,
        },
        message: "Compte Google vérifié. Veuillez renseigner le nom et SIRET/SIREN de votre entreprise pour initialiser votre espace.",
      });
    }

    // Vérification de l'acceptation contractuelle CGU / RGPD
    if (data.acceptTerms !== true) {
      throw new AppError(
        400,
        'Vous devez accepter les Conditions Générales (CGU) et la Politique RGPD pour créer votre espace entreprise.',
        'TERMS_REQUIRED'
      );
    }

    // Validation stricte du SIRET (14 chiffres) ou SIREN (9 chiffres)
    const rawDigits = data.siretOrSiren.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    let cleanSiret: string | null = null;
    let cleanSiren: string | null = null;

    if (rawDigits.length === 14) {
      cleanSiret = rawDigits;
      cleanSiren = rawDigits.slice(0, 9);
    } else if (rawDigits.length === 9) {
      cleanSiren = rawDigits;
      cleanSiret = `${rawDigits}00010`;
    } else {
      throw new AppError(400, 'Format invalide : le SIREN doit comporter 9 chiffres et le SIRET 14 chiffres.', 'INVALID_SIRET');
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const resolvedGooglePhone = resolveCreatorAwarePhone(email, null);
    const isGoogleCreator = isPlatformCreatorIdentity({ email });
    if (isGoogleCreator) {
      await syncPlatformCreatorInDb();
    }

    let companyNameCreated = data.companyName.trim();
    let newUser;
    try {
      const txRes = await prisma.$transaction(async (tx) => {
        await assertOrCleanPendingCompany(tx, [
          ...(cleanSiret ? [{ siret: cleanSiret }] : []),
          ...(cleanSiren ? [{ siren: cleanSiren }] : []),
          { name: { equals: companyNameCreated, mode: 'insensitive' } },
        ]);
        const company = await tx.company.create({
          data: {
            name: companyNameCreated,
            siret: cleanSiret,
            siren: cleanSiren,
          },
        });
        await initCompanyReferentiels(company.id, name, tx);
        const created = await tx.user.create({
          data: {
            email,
            password: passwordHash,
            name: isGoogleCreator && !name.trim() ? PLATFORM_CREATOR.name : name,
            role: 'ADMIN',
            companyId: company.id,
            active: true,
            emailConfirmed: true,
            termsAcceptedAt: new Date(),
            termsAcceptedIp: String(req.ip || req.headers['x-forwarded-for'] || ''),
            ...(resolvedGooglePhone ? { phone: resolvedGooglePhone } : {}),
          } as any,
          select: publicUserSelect,
        });
        return { company, created };
      });
      companyNameCreated = txRes.company.name;
      newUser = txRes.created;
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      if (e?.code === 'P2002') {
        throw new AppError(
          409,
          'Une entreprise portant ce nom ou ce SIREN/SIRET existe déjà sur la plateforme. Pour la rejoindre, demandez une invitation à son administrateur.',
          'COMPANY_EXISTS'
        );
      }
      throw e;
    }

    const pub = formatPublicUser(newUser);
    const tokens = generateTokens({
      id: pub.id,
      email: pub.email,
      role: pub.role,
      companyId: pub.companyId,
      tokenVersion: (newUser as any).tokenVersion,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.status(201).json({
      user: pub,
      accessToken: tokens.accessToken,
      message: `Espace Entreprise ${companyNameCreated} initialisé avec succès via Google !`,
    });
  })
);
