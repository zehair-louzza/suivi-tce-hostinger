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
import { interventionRouter } from './routes/interventions.js';
import { referentielsRouter } from './routes/referentiels.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { setupSocketHandlers, setSocketInstance } from './socket/index.js';

const app = express();
// Trust only the local reverse proxy observed in Hostinger runtime logs.
app.set('trust proxy', 'loopback');
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: config.socketCorsOrigin, credentials: true },
});
setSocketInstance(io);
setupSocketHandlers(io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.cookieSecret));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.set('io', io);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/devis', authMiddleware, devisRouter);
app.use('/api/interventions', authMiddleware, interventionRouter);
app.use('/api/referentiels', authMiddleware, referentielsRouter);

if (config.nodeEnv === 'production') {
  const clientDist = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
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

httpServer.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port} (${config.nodeEnv})`);
  console.log('📡 Socket.io ready');
  console.log(`🔗 CORS: ${config.corsOrigin}`);
});

export { app, httpServer };
