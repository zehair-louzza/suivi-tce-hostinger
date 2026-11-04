// Auth routes
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

export const authRouter = Router();

// Validation schemas
const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court (min 8 caractères)'),
});

// La confirmation du mot de passe est vérifiée côté client (le client n'envoie que name, email, password).
const RegisterSchema = LoginSchema.extend({
  name: z.string().min(1, 'Nom requis').max(100),
});

// Generate tokens
function generateTokens(user: { id: number; email: string; role: string }) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  // iat/exp sont ajoutés par jsonwebtoken : les mettre aussi dans le payload provoque l'erreur
  // « Bad "options.expiresIn" option the payload already has an "exp" property ».
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'] }
  );

  return { accessToken, refreshToken };
}

// Set auth cookies
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };

  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for refresh
  });
}

// Clear auth cookies
function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const data = RegisterSchema.parse(req.body);

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new AppError(409, 'Cet email est déjà utilisé', 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: passwordHash,
      name: data.name,
      role: 'USER',
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user);
  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json({
    user,
    message: 'Inscription réussie',
  });
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const data = LoginSchema.parse(req.body);

  // Find user
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new AppError(401, 'Email ou mot de passe incorrect', 'INVALID_CREDENTIALS');
  }

  // Verify password
  const valid = await bcrypt.compare(data.password, user.password);
  if (!valid) {
    throw new AppError(401, 'Email ou mot de passe incorrect', 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
    message: 'Connexion réussie',
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ message: 'Déconnexion réussie' });
});

// GET /api/auth/me
authRouter.get('/me', async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, 'Non authentifié', 'UNAUTHORIZED');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (!user) {
    throw new AppError(404, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
  }

  res.json({ user });
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  
  if (!refreshToken) {
    throw new AppError(401, 'Refresh token manquant', 'NO_REFRESH_TOKEN');
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwtSecret) as { userId: number; email: string; role: string; type: string };
    
    if (decoded.type !== 'refresh') {
      throw new AppError(401, 'Token de refresh invalide', 'INVALID_REFRESH_TOKEN');
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new AppError(401, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    setAuthCookies(res, accessToken, newRefreshToken);

    res.json({ message: 'Token rafraîchi' });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'Refresh token expiré', 'REFRESH_EXPIRED');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, 'Refresh token invalide', 'INVALID_REFRESH_TOKEN');
    }
    throw err;
  }
});