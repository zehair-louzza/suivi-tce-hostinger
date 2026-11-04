import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { z } from 'zod';

export const authRouter = Router();

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve().then(() => handler(req, res, next)).catch(next);
  };
}

const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court (min 8 caractères)'),
});
const RegisterSchema = LoginSchema.extend({
  name: z.string().min(1, 'Nom requis').max(100),
});

function generateTokens(user: { id: number; email: string; role: string }) {
  const payload = { userId: user.id, email: user.email, role: user.role };
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

const publicUser = { id: true, email: true, name: true, role: true, createdAt: true } as const;

authRouter.post('/register', asyncHandler(async (req, res) => {
  const data = RegisterSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, 'Cet email est déjà utilisé', 'EMAIL_EXISTS');
  const password = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { email: data.email, password, name: data.name, role: 'USER' },
    select: publicUser,
  });
  const tokens = generateTokens(user);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.status(201).json({ user, message: 'Inscription réussie' });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const data = LoginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.password))) {
    throw new AppError(401, 'Email ou mot de passe incorrect', 'INVALID_CREDENTIALS');
  }
  const tokens = generateTokens(user);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
    message: 'Connexion réussie',
  });
}));

authRouter.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ message: 'Déconnexion réussie' });
});

authRouter.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError(401, 'Non authentifié', 'UNAUTHORIZED');
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: publicUser });
  if (!user) throw new AppError(404, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
  res.json({ user });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) throw new AppError(401, 'Refresh token manquant', 'NO_REFRESH_TOKEN');
  try {
    const decoded = jwt.verify(refreshToken, config.jwtSecret) as {
      userId: number; email: string; role: string; type: string;
    };
    if (decoded.type !== 'refresh') {
      throw new AppError(401, 'Token de refresh invalide', 'INVALID_REFRESH_TOKEN');
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }, select: { id: true, email: true, role: true },
    });
    if (!user) throw new AppError(401, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
    const tokens = generateTokens(user);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({ message: 'Token rafraîchi' });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'Refresh token expiré', 'REFRESH_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, 'Refresh token invalide', 'INVALID_REFRESH_TOKEN');
    }
    throw error;
  }
}));
