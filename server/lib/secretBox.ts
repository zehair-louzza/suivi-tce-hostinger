// Chiffrement symétrique des secrets stockés en base (mots de passe SMTP des entreprises).
// AES-256-GCM, format : v1:<iv>:<tag>:<texte chiffré> (base64url).
// La clé vient de MAIL_SECRET_KEY, à défaut dérivée de JWT_SECRET (déjà obligatoire en production).
import crypto from 'crypto';
import { config } from '../config.js';

function getKey(): Buffer {
  const material = process.env.MAIL_SECRET_KEY || config.jwtSecret;
  return crypto.createHash('sha256').update(`anelec-tce:mail-secret:${material}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(':');
}

/** Renvoie null si le secret est illisible (clé changée, donnée corrompue) : l'appelant demande une nouvelle saisie. */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [version, iv, tag, data] = payload.split(':');
    if (version !== 'v1' || !iv || !tag || !data) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
