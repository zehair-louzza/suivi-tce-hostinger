// Chiffrement symétrique des secrets stockés en base (mots de passe SMTP des entreprises).
// AES-256-GCM, format : v1:<iv>:<tag>:<texte chiffré> (base64url).
// La clé provient de MAIL_SECRET_KEY (>= 32 caractères requis pour enregistrer de nouveaux secrets SMTP en production).
import crypto from 'crypto';
import { config } from '../config.js';

function deriveKey(material: string): Buffer {
  return crypto.createHash('sha256').update(`anelec-tce:mail-secret:${material}`).digest();
}

function getEncryptKey(): Buffer {
  const configured = (process.env.MAIL_SECRET_KEY || '').trim();
  if (configured) return deriveKey(configured);
  if (config.nodeEnv === 'production') {
    throw new Error(
      'MAIL_SECRET_KEY doit être défini (32+ caractères) pour chiffrer les identifiants SMTP en production.'
    );
  }
  return deriveKey(config.jwtSecret);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(':');
}

function decryptWithKey(iv: string, tag: string, data: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Renvoie null si le secret est illisible (clé changée, donnée corrompue) : l'appelant demande une nouvelle saisie. */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [version, iv, tag, data] = payload.split(':');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  const configured = (process.env.MAIL_SECRET_KEY || '').trim();
  if (configured) {
    try {
      return decryptWithKey(iv, tag, data, deriveKey(configured));
    } catch {
      // Compatibilité descendante : tenter le déchiffrement avec la clé héritée JWT_SECRET.
    }
  }
  try {
    const plain = decryptWithKey(iv, tag, data, deriveKey(config.jwtSecret));
    if (configured) {
      console.warn(
        '⚠ Secret SMTP déchiffré avec la clé héritée JWT_SECRET ; ré-enregistrez la configuration SMTP pour migrer vers MAIL_SECRET_KEY.'
      );
    }
    return plain;
  } catch {
    return null;
  }
}
