// Server entry point
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { prisma } from './lib/prisma.js';
import { authRouter } from './routes/auth.js';
import { devisRouter } from './routes/devis.js';
import { demandesRouter } from './routes/demandes.js';
import { interventionRouter } from './routes/interventions.js';
import { referentielsRouter } from './routes/referentiels.js';
import { adminRouter } from './routes/admin.js';
import { notificationsRouter } from './routes/notifications.js';
import { demarrerPlanificateurTechnicien } from './services/technicianAutomation.js';
import { demarrerPlanificateurDevis } from './services/devisClient.js';
import { devisClientPublicRouter, limiteurDevisClient } from './routes/devisClientPublic.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { setupSocketHandlers, setSocketInstance } from './socket/index.js';

const app = express();
// Faire confiance au reverse proxy (Cloudflare / Nginx Hostinger) pour extraire la véritable IP du client
app.set('trust proxy', true);
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: config.socketCorsOrigin, credentials: true },
});
setSocketInstance(io);
setupSocketHandlers(io);

// referrerPolicy : helmet envoie « no-referrer » par défaut, ce qui fait bloquer (403) les tuiles
// OpenStreetMap, dont la politique d'usage exige un en-tête Referer. On n'envoie que l'origine.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({ origin: config.corsOriginList, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser(config.cookieSecret));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

// Limiteur de tentatives de connexion (protection anti brute-force sur /api/auth/login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Trop de tentatives de connexion, réessayez dans quelques minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiteur d'API général (appliqué UNIQUEMENT à /api, JAMAIS aux fichiers statiques / HTML / PWA / assets)
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: Math.max(config.rateLimitMax, 15000),
  message: { error: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ne jamais bloquer les health checks ni les utilisateurs connectés
    if (req.path === '/health') return true;
    if (req.cookies?.token || req.headers.authorization) return true;
    return false;
  },
});

app.set('io', io);

// Application des limiteurs ciblés
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/invitations', authLimiter);
app.use('/api', apiLimiter);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/devis', authMiddleware, devisRouter);
app.use('/api/demandes', authMiddleware, demandesRouter);
app.use('/api/interventions', authMiddleware, interventionRouter);
app.use('/api/referentiels', authMiddleware, referentielsRouter);
app.use('/api/admin', authMiddleware, adminRouter);
app.use('/api/notifications', authMiddleware, notificationsRouter);
// Page publique du devis client : sans compte, jeton signé, limitée par adresse IP
app.use('/api/public/devis', limiteurDevisClient, devisClientPublicRouter);

if (config.nodeEnv === 'production') {
  const clientDist = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDist)) {
    // PWA : le service worker et le manifest ne doivent jamais être servis depuis un cache périmé
    app.get('/sw.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
      res.sendFile(path.join(clientDist, 'sw.js'));
    });
    app.get('/manifest.webmanifest', (_req, res) => {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'manifest.webmanifest'));
    });
    app.use(
      express.static(clientDist, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );
    app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn(`Build client introuvable : ${clientDist} (lancer npm run build)`);
  }
}

app.use((_req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});
app.use(errorHandler);

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});
process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});

/**
 * Applique automatiquement les migrations Prisma en attente au démarrage (prod).
 * Garantit que le schéma de la base (ex. colonnes d'apparence) est à jour, ce
 * qui évite les erreurs 500 « column does not exist » après un déploiement.
 * En cas d'échec (CLI Prisma absente, etc.) le serveur démarre quand même : la
 * couche d'authentification est résiliente aux colonnes manquantes.
 */
function applyPendingMigrations() {
  if (config.nodeEnv !== 'production') return;
  try {
    console.log('→ Application des migrations Prisma (prisma migrate deploy)...');
    const localBin = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
    const bin = fs.existsSync(localBin) ? localBin : 'prisma';
    execFileSync(bin, ['migrate', 'deploy'], { stdio: 'inherit' });
    console.log('✓ Migrations Prisma à jour.');
  } catch (err) {
    console.error(
      '⚠ Échec de `prisma migrate deploy` au démarrage (le serveur continue) :',
      (err as Error)?.message
    );
  }
}

applyPendingMigrations();
demarrerPlanificateurTechnicien();
demarrerPlanificateurDevis();

httpServer.listen(config.port, () => {
  console.log(`→ Server running on port ${config.port} (${config.nodeEnv})`);
  console.log('⌖ Socket.io ready');
  console.log(`↗ CORS: ${config.corsOrigin}`);
});

export { app, httpServer };
