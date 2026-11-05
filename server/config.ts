// Server configuration
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('dev-secret'))) {
  throw new Error('JWT_SECRET doit être défini (valeur aléatoire de 64+ caractères) en production.');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database - PostgreSQL Supabase
  databaseUrl: process.env.DATABASE_URL || 'file:./data.db',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Rate limiting (3000 requêtes / 15 min par défaut pour éviter tout blocage d'utilisateurs légitimes)
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '3000', 10),
  
  // Cookie
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production',
  cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Socket.io
  socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
};
