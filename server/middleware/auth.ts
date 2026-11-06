// Authentication middleware
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from './errorHandler.js';

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  companyId?: number;
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

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new AppError(401, 'Authentification requise', 'UNAUTHORIZED');
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'Token expiré', 'TOKEN_EXPIRED');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, 'Token invalide', 'INVALID_TOKEN');
    }
    throw new AppError(401, 'Authentification échouée', 'UNAUTHORIZED');
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.user = decoded;
  } catch {
    // Ignore invalid token for optional auth
  }
  next();
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
