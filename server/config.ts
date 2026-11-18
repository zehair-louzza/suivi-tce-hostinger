// Server configuration
import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';
const PLACEHOLDER_SECRET_RE = /^(?:dev-secret|dev-cookie-secret|remplacer-par-|ci-only-|changeme|your-secret)/i;

function isWeakSecret(value: string | undefined, minLength = 32): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed.length < minLength) return true;
  if (PLACEHOLDER_SECRET_RE.test(trimmed)) return true;
  if (trimmed.toLowerCase().includes('remplacer-par')) return true;
  return false;
}

if (isProduction) {
  if (!(process.env.DATABASE_URL || '').trim()) {
    throw new Error('DATABASE_URL doit être défini en production.');
  }
  if (isWeakSecret(process.env.JWT_SECRET, 32)) {
    throw new Error('JWT_SECRET doit être défini (valeur aléatoire non générique de 32+ caractères) en production.');
  }
  if (process.env.COOKIE_SECRET !== undefined && isWeakSecret(process.env.COOKIE_SECRET, 32)) {
    throw new Error('COOKIE_SECRET défini mais invalide (valeur non générique de 32+ caractères requise) en production.');
  }
  if (process.env.MAIL_SECRET_KEY !== undefined && isWeakSecret(process.env.MAIL_SECRET_KEY, 32)) {
    throw new Error('MAIL_SECRET_KEY défini mais invalide (valeur non générique de 32+ caractères requise) en production.');
  }
  if (!(process.env.MAIL_SECRET_KEY || '').trim()) {
    console.warn('⚠ MAIL_SECRET_KEY absent : le chiffrement de nouveaux identifiants SMTP sera refusé en production.');
  }
}

const resolvedCookieSecret = (() => {
  const envSecret = (process.env.COOKIE_SECRET || '').trim();
  if (envSecret) return envSecret;
  if (isProduction) {
    console.warn('⚠ COOKIE_SECRET absent en production : utilisation d’un secret éphémère en mémoire.');
    return crypto.randomBytes(32).toString('hex');
  }
  return 'dev-cookie-secret-change-in-production';
})();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database - PostgreSQL Supabase
  databaseUrl: process.env.DATABASE_URL || '',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // CORS — accepte les origines configurées sans jamais élargir une origine HTTPS vers HTTP en clair
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  corsOriginList: (() => {
    const raw = (process.env.CORS_ORIGIN || '').trim();
    if (!raw) return ['http://localhost:5173'];
    const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const origins: string[] = [];
    for (const entry of entries) {
      origins.push(entry);
      try {
        const u = new URL(entry);
        const host = u.hostname;
        const portPart = u.port ? `:${u.port}` : '';
        if (u.protocol === 'https:') {
          if (host.startsWith('www.')) origins.push(`https://${host.slice(4)}${portPart}`);
          else if (!host.includes('localhost')) origins.push(`https://www.${host}${portPart}`);
        } else if (u.protocol === 'http:') {
          origins.push(entry.replace(/^http:/, 'https:'));
        }
      } catch {
        // URL invalide, conserver telle quelle
      }
    }
    return [...new Set(origins)];
  })(),

  // Rate limiting (configurable via RATE_LIMIT_MAX, sans plancher artificiel)
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '3000', 10),

  // Cookie
  cookieSecret: resolvedCookieSecret,
  cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Socket.io : hérite de CORS_ORIGIN si SOCKET_CORS_ORIGIN n'est pas défini
  socketCorsOrigin: (() => {
    const raw = (process.env.SOCKET_CORS_ORIGIN || '').trim();
    if (raw) {
      const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
      return list.length === 1 ? list[0] : list;
    }
    const corsRaw = (process.env.CORS_ORIGIN || '').trim();
    if (!corsRaw) return 'http://localhost:5173';
    const derived: string[] = [];
    for (const entry of corsRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
      derived.push(entry);
      try {
        const u = new URL(entry);
        const portPart = u.port ? `:${u.port}` : '';
        if (u.protocol === 'https:' && u.hostname.startsWith('www.')) {
          derived.push(`https://${u.hostname.slice(4)}${portPart}`);
        } else if (u.protocol === 'https:' && !u.hostname.includes('localhost')) {
          derived.push(`https://www.${u.hostname}${portPart}`);
        }
      } catch {
        // ignore
      }
    }
    const unique = [...new Set(derived)];
    return unique.length === 1 ? unique[0] : unique;
  })(),
};
