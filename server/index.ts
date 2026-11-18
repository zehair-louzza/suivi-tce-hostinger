// Server entry point
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
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
import { demarrerPlanificateurRapport } from './services/rapportClient.js';
import { rapportClientPublicRouter, limiteurRapportClient } from './routes/rapportClientPublic.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { setupSocketHandlers, setSocketInstance } from './socket/index.js';

const app = express();
// Faire confiance uniquement au reverse proxy immédiat (1 saut par défaut, configurable via TRUST_PROXY)
const trustProxyRaw = (process.env.TRUST_PROXY || '').trim();
app.set(
  'trust proxy',
  trustProxyRaw === 'false' || trustProxyRaw === '0'
    ? false
    : Math.max(1, parseInt(trustProxyRaw || '1', 10) || 1)
);
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: config.socketCorsOrigin, credentials: true },
});
setSocketInstance(io);
setupSocketHandlers(io);

// referrerPolicy : helmet envoie « no-referrer » par défaut, ce qui fait bloquer (403) les tuiles
// OpenStreetMap, dont la politique d'usage exige un en-tête Referer. On n'envoie que l'origine.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https://*.tile.openstreetmap.org',
        'https://*.tile.openstreetmap.fr',
        'https://server.arcgisonline.com',
      ],
      connectSrc: [
        "'self'",
        'ws:',
        'wss:',
        'https://api-adresse.data.gouv.fr',
        'https://nominatim.openstreetmap.org',
        'https://router.project-osrm.org',
        'https://accounts.google.com',
        'https://*.supabase.co',
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://accounts.google.com'],
      frameAncestors: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({ origin: config.corsOriginList, credentials: true }));
function redactUrlTokens(url: string | undefined): string {
  if (!url) return '';
  return url
    .replace(/([?&](?:token|resetToken|access_token|id_token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(\/api\/auth\/invitations\/)[^/?\s]+/gi, '$1[REDACTED]')
    .replace(/(\/(?:api\/public\/(?:devis|rapport)|(?:devis|rapport)-client)\/)[^/?\s]+/gi, '$1[REDACTED]');
}

morgan.token('safe-url', (req) => redactUrlTokens((req as express.Request).originalUrl || req.url));
morgan.token('safe-referrer', (req) => redactUrlTokens(req.headers.referer || req.headers.referrer as string | undefined) || '-');

app.use(
  morgan(
    config.nodeEnv === 'development'
      ? ':method :safe-url :status :response-time ms'
      : ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":safe-referrer" ":user-agent"'
  )
);

// Limiteur de tentatives d'authentification (connexion, OTP, reset, OAuth, rafraîchissement, inscriptions)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Trop de tentatives de connexion, réessayez dans quelques minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiteur strict dédié au code OTP à 6 chiffres (anti brute-force)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de vérification du code, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiteur d'API général (jamais contournable via un en-tête Authorization ou un cookie non vérifié)
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/health/ready',
});

app.set('io', io);

// Limitation de débit appliquée AVANT le parsing de corps JSON volumineux (15 Mo max pour PDF/photos)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/resend-confirmation', authLimiter);
app.use('/api/auth/verify-code', otpLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/confirm-supabase-token', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/invitations', authLimiter);
app.use('/api', apiLimiter);

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser(config.cookieSecret));

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
// Page publique du rapport client : même principe (sans compte, jeton signé, limitée par adresse IP)
app.use('/api/public/rapport', limiteurRapportClient, rapportClientPublicRouter);

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
    // Politique X-Robots-Tag pour moteurs web & IA : API / liens privés exclus de l'indexation, pages publiques autorisées
  app.use((req, res, next) => {
    const p = req.path;
    if (
      p.startsWith('/api/') ||
      p.startsWith('/devis-client/') ||
      p.startsWith('/rapport-client/') ||
      p.startsWith('/invitation')
    ) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    } else if (!p.includes('.') || p.endsWith('.html')) {
      res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
      res.setHeader('Link', '<https://suivi.anelecgroupe.com/llms.txt>; rel="alternate"; type="text/markdown"');
    }
    next();
  });

  app.get('/llms.txt', (_req, res) => {
    res.type('text/markdown; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'all');
    res.sendFile(path.join(clientDist, 'llms.txt'));
  });

  app.get('/llms-full.txt', (_req, res) => {
    res.type('text/markdown; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'all');
    res.sendFile(path.join(clientDist, 'llms-full.txt'));
  });

  app.get('/.well-known/ai-plugin.json', (_req, res) => {
    res.type('application/json; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'all');
    res.sendFile(path.join(clientDist, '.well-known', 'ai-plugin.json'));
  });

  app.get('/manifest.webmanifest', (_req, res) => {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'manifest.webmanifest'));
    });
    app.use((req, res, next) => {
      if (req.path.endsWith('.map')) return res.status(404).end();
      next();
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

demarrerPlanificateurTechnicien();
demarrerPlanificateurDevis();
demarrerPlanificateurRapport();

httpServer.listen(config.port, () => {
  console.log(`→ Server running on port ${config.port} (${config.nodeEnv})`);
  console.log('⌖ Socket.io ready');
  console.log(`↗ CORS: ${config.corsOrigin}`);
});

export { app, httpServer };
