// Authentication middleware
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { isMissingSchemaError, missingSchemaMentionsColumn } from '../lib/userSelect.js';
import { AppError } from './errorHandler.js';

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  companyId?: number;
  type?: string;
  sv?: number;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

let authTokenVersionAvailable = true;

export async function loadActiveSessionUser(userId: number) {
  const baseSelect = {
    id: true,
    email: true,
    role: true,
    active: true,
    emailConfirmed: true,
    companyId: true,
  };
  if (authTokenVersionAvailable) {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        select: { ...baseSelect, tokenVersion: true },
      });
    } catch (e) {
      if (isMissingSchemaError(e) && missingSchemaMentionsColumn(e, ['tokenversion'])) {
        authTokenVersionAvailable = false;
        console.warn('[auth] Colonne tokenVersion absente — révocation de session dégradée tant que prisma migrate deploy n’est pas exécuté.');
      } else {
        throw e;
      }
    }
  }
  return prisma.user.findUnique({ where: { id: userId }, select: baseSelect }) as Promise<
    (typeof baseSelect extends any ? { id: number; email: string; role: string; active: boolean; emailConfirmed: boolean; companyId: number | null; tokenVersion?: number } : never) | null
  >;
}

export async function verifySessionInDb(decoded: TokenPayload): Promise<void> {
  if (decoded.type === 'refresh' || (decoded.type && decoded.type !== 'access')) {
    throw new AppError(401, 'Type de jeton invalide pour cet accès', 'INVALID_TOKEN_TYPE');
  }
  const user = await loadActiveSessionUser(decoded.userId);
  if (!user || user.active === false || user.emailConfirmed === false) {
    throw new AppError(403, 'Compte inactif, non confirmé ou inexistant', 'ACCOUNT_DISABLED');
  }
  if (decoded.companyId != null && user.companyId !== decoded.companyId) {
    throw new AppError(401, 'Session entreprise incohérente', 'SESSION_REVOKED');
  }
  const currentSv = typeof (user as { tokenVersion?: number }).tokenVersion === 'number'
    ? (user as { tokenVersion: number }).tokenVersion
    : 1;
  if (typeof decoded.sv === 'number' ? decoded.sv !== currentSv : currentSv > 1) {
    throw new AppError(401, 'Session révoquée : veuillez vous reconnecter', 'SESSION_REVOKED');
  }
  if (user.companyId != null) {
    const comp = await prisma.company.findUnique({ where: { id: user.companyId }, select: { active: true } });
    if (!comp || comp.active === false) {
      throw new AppError(403, 'Espace entreprise désactivé ou introuvable', 'COMPANY_DISABLED');
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new AppError(401, 'Authentification requise', 'UNAUTHORIZED'));
  }

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Token expiré', 'TOKEN_EXPIRED'));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, 'Token invalide', 'INVALID_TOKEN'));
    }
    return next(new AppError(401, 'Authentification échouée', 'UNAUTHORIZED'));
  }

  verifySessionInDb(decoded)
    .then(() => {
      req.user = decoded;
      next();
    })
    .catch(next);
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return next();
  }

  verifySessionInDb(decoded)
    .then(() => {
      req.user = decoded;
      next();
    })
    .catch(() => {
      next();
    });
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, 'Authentification requise', 'UNAUTHORIZED');
    }
    const upperRole = (req.user.role || '').toUpperCase();
    if (!roles.map((r) => r.toUpperCase()).includes(upperRole)) {
      throw new AppError(403, 'Accès refusé : permissions insuffisantes', 'FORBIDDEN');
    }
    next();
  };
}
