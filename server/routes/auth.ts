import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { getEffectivePermissions } from '../../shared/types.js';
import { z } from 'zod';

export const authRouter = Router();

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
  company?: { id: number; name: string; siret?: string | null; siren?: string | null } | null;
  createdAt?: Date | string;
}) {
  const effectiveRole = u.id === 1 || u.email.toLowerCase() === 'louzza.zehair@gmail.com' ? 'ADMIN' : u.role;
  const companyId = u.companyId || u.company?.id || 1;
  const companyName = u.company?.name || (companyId === 1 ? 'ANELEC GROUPE' : `Entreprise #${companyId}`);
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

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password,
        name: data.name,
        role,
        companyId,
      },
      select: publicUserSelect,
    });

    const pub = formatPublicUser(user);
    const tokens = generateTokens({ id: pub.id, email: pub.email, role: pub.role, companyId: pub.companyId });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.status(201).json({ user: pub, accessToken: tokens.accessToken, message: 'Espace Entreprise créé avec succès' });
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
    if (user.active === false) {
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
