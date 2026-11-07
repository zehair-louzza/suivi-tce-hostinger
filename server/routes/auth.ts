import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { getEffectivePermissions } from '../../shared/types.js';
import { z } from 'zod';
import crypto from 'crypto';
import { sendConfirmationEmail, sendPasswordResetEmail } from '../services/emailService.js';

export const authRouter = Router();

// Confirmation d'e-mail et acceptation contractuelle des conditions
authRouter.get(
  '/confirm-email',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(400).send('<h1>Lien de confirmation invalide</h1><p>Le jeton de validation est manquant.</p>');
    }

    const user = await prisma.user.findFirst({
      where: { confirmationToken: token },
      include: { company: true },
    });

    if (!user) {
      return res.status(404).send('<h1>Jeton d\'activation introuvable ou déjà utilisé</h1><p>Veuillez contacter le support ANELEC GROUPE.</p>');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        active: true,
        emailConfirmed: true,
        confirmationToken: null,
        termsAcceptedAt: new Date(),
        termsAcceptedIp: String(req.ip || req.headers['x-forwarded-for'] || ''),
      },
    });

    const companyName = user.company?.name || 'votre entreprise';
    const loginUrl = (process.env.APP_URL || 'https://suivi.anelecgroupe.com') + '/login?activated=1';

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
      Félicitations <strong>${user.name}</strong> ! Votre compte administrateur et l'espace de <strong>${companyName}</strong> ont été certifiés et activés avec succès.<br /><br />
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
});

const RegisterSchema = z.object({
  name: z.string().min(1, 'Nom du responsable requis').max(100),
  email: z.string().email('Email professionnel invalide'),
  password: z.string().min(8, 'Mot de passe trop court (min 8 caractères)'),
  companyName: z.string().min(2, "Nom de l'entreprise requis").max(120).optional(),
  siretOrSiren: z.string().optional(),
});

function generateTokens(user: { id: number; email: string; role: string; companyId?: number | null }) {
  const payload = { userId: user.id, email: user.email, role: user.role, companyId: user.companyId || 1 };
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
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
  name: string;
  role: string;
  technicienNom?: string | null;
  permissionsJson?: string | null;
  active?: boolean;
  companyId?: number | null;
  themePref?: string | null;
  company?: { id: number; name: string; siret?: string | null; siren?: string | null; defaultTheme?: string | null; allowThemeOverride?: boolean | null } | null;
  createdAt?: Date | string;
}) {
  const effectiveRole = u.id === 1 || u.email.toLowerCase() === 'louzza.zehair@gmail.com' ? 'ADMIN' : u.role;
  const companyId = u.companyId || u.company?.id || 1;
  const companyName = u.company?.name || (companyId === 1 ? 'ANELEC GROUPE' : `Entreprise #${companyId}`);
  const companyDefaultTheme = u.company?.defaultTheme || 'light';
  const allowThemeOverride = u.company?.allowThemeOverride !== false;
  const userThemePref = u.themePref || null;
  const resolvedTheme = allowThemeOverride && userThemePref ? userThemePref : companyDefaultTheme;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: effectiveRole,
    technicienNom: u.technicienNom || null,
    permissions: getEffectivePermissions(effectiveRole, u.permissionsJson),
    active: u.active !== false,
    companyId,
    companyName,
    companySiret: u.company?.siret || (companyId === 1 ? '933 108 607 00021' : null),
    company: u.company ? { id: u.company.id, name: u.company.name, siret: u.company.siret, siren: u.company.siren } : { id: companyId, name: companyName },
    theme: {
      companyDefault: companyDefaultTheme,
      allowOverride: allowThemeOverride,
      userPref: userThemePref,
      resolved: resolvedTheme,
    },
    createdAt: u.createdAt,
  };
}

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  technicienNom: true,
  permissionsJson: true,
  active: true,
  emailConfirmed: true,
  companyId: true,
  themePref: true,
  company: {
    select: {
      id: true,
      name: true,
      siret: true,
      siren: true,
      defaultTheme: true,
      allowThemeOverride: true,
    },
  },
  createdAt: true,
} as const;

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = RegisterSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'Cet email est déjà utilisé', 'EMAIL_EXISTS');

    let companyId = 1;

    if (data.companyName && data.companyName.trim()) {
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

      let company = await prisma.company.findFirst({
        where: {
          OR: [
            ...(cleanSiret ? [{ siret: cleanSiret }] : []),
            ...(cleanSiren ? [{ siren: cleanSiren }] : []),
            { name: { equals: data.companyName.trim(), mode: 'insensitive' } },
          ],
        },
      });

      if (!company) {
        company = await prisma.company.create({
          data: {
            name: data.companyName.trim(),
            siret: cleanSiret,
            siren: cleanSiren,
          },
        });

        // Initialisation des référentiels de base pour le nouveau tenant
        await prisma.referentiel.createMany({
          data: [
            {
              categorie: 'corpsEtat',
              valeurs: JSON.stringify([
                'Tous corps d’état',
                'Plomberie',
                'Électricité',
                'CVC / Climatisation',
                'Chauffage',
                'Serrurerie',
                'Menuiserie',
                'Peinture',
              ]),
              companyId: company.id,
            },
            {
              categorie: 'origines',
              valeurs: JSON.stringify([
                "Donneur d'ordre",
                'Client',
                'Contrat de maintenance',
                'Technicien',
                'Syndic / gestionnaire',
                'Interne',
              ]),
              companyId: company.id,
            },
            {
              categorie: 'responsables',
              valeurs: JSON.stringify([data.name]),
              companyId: company.id,
            },
          ],
          skipDuplicates: true,
        });
      }

      companyId = company.id;
    }

    const password = await bcrypt.hash(data.password, 12);
    // Tout créateur d'espace entreprise est ADMINISTRATEUR de son espace
    const role = 'ADMIN';

    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const confirmationSentAt = new Date();

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password,
        name: data.name,
        role,
        companyId,
        active: false,
        emailConfirmed: false,
        confirmationToken,
        confirmationSentAt,
      },
      select: publicUserSelect,
    });

    // Envoi de l'e-mail officiel d'activation depuis zehair@anelecgroupe.com (avec multi-découverte SMTP + relais Supabase + prévisualisation secours)
    const compName = data.companyName ? data.companyName.trim() : 'ANELEC GROUPE';
    const delivery = await sendConfirmationEmail({
      toEmail: data.email,
      recipientName: data.name,
      companyName: compName,
      confirmationToken,
    });

    res.status(201).json({
      message:
        delivery.channel === 'SMTP_PRODUCTION' || delivery.channel === 'SUPABASE_AUTH_RELAY'
          ? "Demande enregistrée avec succès. Un e-mail de confirmation avec les conditions d'activation a été envoyé à " +
            data.email +
            ' depuis zehair@anelecgroupe.com. Veuillez cliquer sur le lien reçu pour activer votre espace entreprise.'
          : "Demande enregistrée avec succès pour " +
            data.email +
            ". L'e-mail de confirmation a été généré via le relais de secours (vous pouvez consulter la prévisualisation de l'e-mail ou activer votre espace directement ci-dessous).",
      emailSent: delivery.sent,
      email: data.email,
      requiresConfirmation: true,
      deliveryChannel: delivery.channel,
      previewUrl: delivery.previewUrl || null,
      activationLink: delivery.activationLink || null,
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

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user) {
      throw new AppError(404, 'Aucun compte trouvé avec cette adresse e-mail', 'USER_NOT_FOUND');
    }

    if (user.emailConfirmed) {
      return res.json({
        alreadyConfirmed: true,
        message: 'Ce compte est déjà confirmé et actif. Vous pouvez vous connecter directement.',
      });
    }

    const confirmationToken = user.confirmationToken || crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        confirmationToken,
        confirmationSentAt: new Date(),
      },
    });

    const compName = user.company?.name || 'ANELEC GROUPE';
    const delivery = await sendConfirmationEmail({
      toEmail: user.email,
      recipientName: user.name,
      companyName: compName,
      confirmationToken,
    });

    return res.json({
      message:
        delivery.channel === 'SMTP_PRODUCTION' || delivery.channel === 'SUPABASE_AUTH_RELAY'
          ? `Un nouvel e-mail de confirmation a été envoyé à ${user.email}.`
          : `Nouvel e-mail de confirmation généré pour ${user.email}.`,
      emailSent: delivery.sent,
      email: user.email,
      deliveryChannel: delivery.channel,
      previewUrl: delivery.previewUrl || null,
      activationLink: delivery.activationLink || null,
    });
  })
);

// Demande de réinitialisation de mot de passe par e-mail
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      throw new AppError(400, 'Adresse e-mail requise', 'EMAIL_REQUIRED');
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError(404, 'Aucun compte associé à cette adresse e-mail', 'USER_NOT_FOUND');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        confirmationToken: resetToken,
        confirmationSentAt: new Date(),
      },
    });

    const delivery = await sendPasswordResetEmail({
      toEmail: user.email,
      recipientName: user.name,
      resetToken,
    });

    return res.json({
      message: `Un e-mail de réinitialisation de mot de passe a été envoyé à ${user.email}.`,
      emailSent: delivery.sent,
      deliveryChannel: delivery.channel,
      previewUrl: delivery.previewUrl || null,
      resetLink: delivery.activationLink || null,
    });
  })
);

// Validation du nouveau mot de passe avec jeton de réinitialisation
authRouter.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.password || '');

    if (!token || newPassword.length < 8) {
      throw new AppError(400, 'Jeton valide et nouveau mot de passe (min 8 caractères) requis', 'INVALID_RESET');
    }

    const user = await prisma.user.findFirst({
      where: { confirmationToken: token },
      select: publicUserSelect,
    });

    if (!user) {
      throw new AppError(404, 'Lien de réinitialisation invalide ou expiré', 'INVALID_TOKEN');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        active: true,
        emailConfirmed: true,
        confirmationToken: null,
      },
      select: publicUserSelect,
    });

    const pub = formatPublicUser(updated);
    const tokens = generateTokens({ id: pub.id, email: pub.email, role: pub.role, companyId: pub.companyId });
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

    const supabaseUrl = process.env.SUPABASE_URL || 'https://qfhxptwsuotqnrihzhxw.supabase.co';
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmaHhwdHdzdW90cW5yaWh6aHh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjM0NjgsImV4cCI6MjA4OTUzOTQ2OH0.r83-3B_3e25I2J9u-mN04t2-wF_2t0p_X-p4vH-bI0w';

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
    const email = String(supaUser?.email || '').toLowerCase().trim();
    if (!email) {
      throw new AppError(400, 'Adresse e-mail introuvable dans le jeton Supabase', 'EMAIL_MISSING');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: publicUserSelect,
    });

    if (!user) {
      throw new AppError(404, `Aucun compte trouvé pour ${email}`, 'USER_NOT_FOUND');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        active: true,
        emailConfirmed: true,
        confirmationToken: null,
        termsAcceptedAt: new Date(),
      },
      select: publicUserSelect,
    });

    const pub = formatPublicUser(updated);
    const tokens = generateTokens({ id: pub.id, email: pub.email, role: pub.role, companyId: pub.companyId });
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
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        ...publicUserSelect,
        password: true,
      },
    });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      throw new AppError(401, 'Email ou mot de passe incorrect', 'INVALID_CREDENTIALS');
    }
    if ((user as any).emailConfirmed === false && user.id !== 1) {
      throw new AppError(
        403,
        "Votre espace entreprise est en attente d'activation. Veuillez consulter votre boîte mail (" + user.email + ") et cliquer sur le lien de confirmation envoyé par zehair@anelecgroupe.com pour accepter les conditions et activer votre compte.",
        'EMAIL_NOT_CONFIRMED'
      );
    }
    if (user.active === false && user.id !== 1) {
      throw new AppError(403, 'Ce compte utilisateur a été désactivé par l’administrateur', 'ACCOUNT_DISABLED');
    }

    const pub = formatPublicUser(user);
    const tokens = generateTokens({ id: pub.id, email: pub.email, role: pub.role, companyId: pub.companyId });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({
      user: pub,
      accessToken: tokens.accessToken,
      message: 'Connexion réussie',
    });
  })
);

authRouter.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ message: 'Déconnexion réussie' });
});

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, 'Non authentifié', 'UNAUTHORIZED');
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: publicUserSelect,
    });
    if (!user) throw new AppError(404, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
    res.json({ user: formatPublicUser(user) });
  })
);

// Liste blanche des thèmes accessibles aux utilisateurs
const ALLOWED_THEMES = ['light', 'dark', 'atlas', 'craft', 'signal', 'swiss', 'bento'] as const;
const ThemeIdSchema = z.enum(ALLOWED_THEMES);

/**
 * PATCH /api/auth/me/theme
 * ------------------------------------------------------------------
 * Enregistre la préférence de thème personnelle de l'utilisateur.
 * - Si l'entreprise n'autorise pas la personnalisation, la requête est
 *   rejetée pour informer l'utilisateur (403 THEME_OVERRIDE_DISABLED).
 * - Envoyer `{ theme: null }` ou `{ theme: "reset" }` supprime la
 *   préférence personnelle (retour au défaut entreprise).
 */
authRouter.patch(
  '/me/theme',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, 'Non authentifié', 'UNAUTHORIZED');

    const raw = (req.body ?? {}) as { theme?: string | null };
    const value = raw.theme;
    let nextTheme: string | null;
    if (value === null || value === undefined || value === '' || value === 'reset') {
      nextTheme = null;
    } else {
      const parsed = ThemeIdSchema.safeParse(value);
      if (!parsed.success) throw new AppError(400, 'Thème inconnu', 'INVALID_THEME');
      nextTheme = parsed.data;
    }

    // Vérifier que l'entreprise autorise la personnalisation (sauf pour reset).
    if (nextTheme !== null) {
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

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: { themePref: nextTheme },
      select: publicUserSelect,
    });
    res.json({ user: formatPublicUser(updated), message: nextTheme ? "Apparence personnelle mise à jour." : "Apparence personnelle réinitialisée." });
  })
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) throw new AppError(401, 'Refresh token manquant', 'NO_REFRESH_TOKEN');
    try {
      const decoded = jwt.verify(refreshToken, config.jwtSecret) as {
        userId: number;
        email: string;
        role: string;
        companyId?: number;
        type: string;
      };
      if (decoded.type !== 'refresh') {
        throw new AppError(401, 'Token de refresh invalide', 'INVALID_REFRESH_TOKEN');
      }
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: publicUserSelect,
      });
      if (!user) throw new AppError(401, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
      const pub = formatPublicUser(user);
      const tokens = generateTokens({ id: pub.id, email: pub.email, role: pub.role, companyId: pub.companyId });
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

    // Mode simulation / démo locale si jeton préfixé par simulated_google_
    if (data.credential.startsWith('simulated_google_')) {
      const parts = data.credential.split(':');
      email = (parts[1] || 'artisan.google@example.com').toLowerCase().trim();
      name = parts[2] || 'Utilisateur Google Direct';
      picture = 'https://lh3.googleusercontent.com/a/default-user';
    } else {
      // Validation officielle du jeton Google (prend en charge ID Token et Access Token OAuth2)
      try {
        let profile: any;
        if (data.credential.startsWith('ya29.')) {
          // Jeton d'accès OAuth2
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

    // 1. L'utilisateur existe déjà : Connexion directe
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...publicUserSelect,
        password: true,
      },
    });

    if (user) {
      if (user.active === false && user.id !== 1) {
        throw new AppError(403, 'Ce compte utilisateur a été désactivé par l’administrateur', 'ACCOUNT_DISABLED');
      }

      // Google certifie l'email : activation automatique
      if (!user.emailConfirmed) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailConfirmed: true, active: true },
        });
      }

      const pub = formatPublicUser(user);
      const tokens = generateTokens({ id: pub.id, email: pub.email, role: pub.role, companyId: pub.companyId });
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.json({
        user: pub,
        accessToken: tokens.accessToken,
        message: 'Connexion réussie avec votre compte Google',
      });
    }

    // 2. L'utilisateur n'existe pas encore : Inscription nouvelle entreprise
    // Si l'utilisateur n'a pas encore renseigné les informations de son entreprise
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

    // Recherche ou création de l'entreprise cloisonnée
    let company = await prisma.company.findFirst({
      where: {
        OR: [
          ...(cleanSiret ? [{ siret: cleanSiret }] : []),
          ...(cleanSiren ? [{ siren: cleanSiren }] : []),
          { name: { equals: data.companyName.trim(), mode: 'insensitive' } },
        ],
      },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: data.companyName.trim(),
          siret: cleanSiret,
          siren: cleanSiren,
        },
      });

      // Référentiels par défaut pour ce nouveau tenant
      await prisma.referentiel.createMany({
        data: [
          {
            categorie: 'corpsEtat',
            valeurs: JSON.stringify([
              'Tous corps d’état',
              'Plomberie',
              'Électricité',
              'CVC / Climatisation',
              'Chauffage',
              'Serrurerie',
              'Menuiserie',
              'Peinture',
            ]),
            companyId: company.id,
          },
          {
            categorie: 'origines',
            valeurs: JSON.stringify([
              "Donneur d'ordre",
              'Client',
              'Contrat de maintenance',
              'Technicien',
              'Syndic / gestionnaire',
              'Interne',
            ]),
            companyId: company.id,
          },
          {
            categorie: 'responsables',
            valeurs: JSON.stringify([name]),
            companyId: company.id,
          },
        ],
        skipDuplicates: true,
      });
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        name,
        role: 'ADMIN',
        companyId: company.id,
        active: true,
        emailConfirmed: true,
        termsAcceptedAt: new Date(),
        termsAcceptedIp: String(req.ip || req.headers['x-forwarded-for'] || ''),
      },
      select: publicUserSelect,
    });

    const pub = formatPublicUser(newUser);
    const tokens = generateTokens({ id: pub.id, email: pub.email, role: pub.role, companyId: pub.companyId });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.status(201).json({
      user: pub,
      accessToken: tokens.accessToken,
      message: `Espace Entreprise ${company.name} initialisé avec succès via Google !`,
    });
  })
);
