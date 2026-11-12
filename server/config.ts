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
  
  // CORS — accepte l'origine configurée, et en production aussi les variantes www / sans www du domaine
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  corsOriginList: (() => {
    const env = process.env.CORS_ORIGIN || '';
    if (!env) return ['http://localhost:5173'];
    // Construire les variantes : http/https × www/non-www pour le domaine configuré
    const origins = [env];
    try {
      const u = new URL(env);
      const host = u.hostname;
      // Ajouter la variante https si http, et vice versa
      if (u.protocol === 'http:') origins.push(env.replace('http:', 'https:'));
      else origins.push(env.replace('https:', 'http:'));
      // Ajouter la variante www / sans www
      if (host.startsWith('www.')) {
        const naked = host.slice(4);
        origins.push(`https://${naked}`, `http://${naked}`);
      } else {
        origins.push(`https://www.${host}`, `http://www.${host}`);
      }
    } catch { /* URL invalide, garder juste l'env */ }
    return [...new Set(origins)];
  })(),
  
  // Rate limiting (3000 requêtes / 15 min par défaut pour éviter tout blocage d'utilisateurs légitimes)
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '3000', 10),
  
  // Cookie
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production',
  cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Socket.io
  socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
};
