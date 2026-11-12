import net from 'net';
import { promises as dns } from 'dns';
import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import { isMissingSchemaError } from '../lib/userSelect.js';
import { encryptSecret, decryptSecret } from '../lib/secretBox.js';

// Entreprise « plateforme » (ANELEC) : son expéditeur sert de repli aux entreprises
// qui n'ont pas encore branché leur propre boîte mail.
export const PLATFORM_COMPANY_ID = 1;

const DEFAULT_SMTP_HOST = process.env.SMTP_HOST || 'smtppro.zoho.eu';
const DEFAULT_SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const DEFAULT_SMTP_USER = process.env.SMTP_USER || 'zehair@anelecgroupe.com';
const DEFAULT_SMTP_PASS = process.env.SMTP_PASS || '';
export const APP_URL = process.env.APP_URL || 'https://suivi.anelecgroupe.com';

// Supabase Auth Relay fallback (projet officiel ANELEC TCE)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfhxptwsuotqnrihzhxw.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmaHhwdHdzdW90cW5yaWh6aHh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjM0NjgsImV4cCI6MjA4OTUzOTQ2OH0.r83-3B_3e25I2J9u-mN04t2-wF_2t0p_X-p4vH-bI0w';

/** Échappe le HTML des valeurs saisies par les utilisateurs avant de les mettre dans un e-mail. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SmtpConfigData {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  replyTo?: string;
  updatedAt?: string;
}

export interface ResolvedMail {
  cfg: SmtpConfigData;
  /** true = les e-mails partent de la boîte de l'entreprise ; false = expéditeur plateforme */
  ownMailbox: boolean;
}

export interface EmailDeliveryResult {
  sent: boolean;
  channel: 'SMTP_PRODUCTION' | 'SUPABASE_AUTH_RELAY' | 'ETHEREAL_TEST_SMTP' | 'NONE';
  senderMode?: 'COMPANY_MAILBOX' | 'PLATFORM';
  fromAddress?: string;
  hostUsed?: string;
  messageId?: string;
  previewUrl?: string;
  activationLink?: string;
  error?: string;
  timestamp: string;
}

export interface EmailLogEntry {
  id: string;
  timestamp: string;
  type:
    | 'CONFIRMATION_COMPTE'
    | 'RESET_PASSWORD'
    | 'WELCOME_USER'
    | 'INVITATION_COLLABORATEUR'
    | 'RAPPORT_INTERVENTION'
    | 'PROPOSITION_DEVIS'
    | 'TEST_SMTP';
  toEmail: string;
  ccEmail?: string;
  subject: string;
  channel: string;
  sent: boolean;
  previewUrl?: string;
  activationLink?: string;
  error?: string;
}

const workingCandidates = new Map<string, { host: string; port: number; secure: boolean; user: string; pass: string }>();
let etherealAccountCache: { user: string; pass: string; host: string; port: number; secure: boolean } | null = null;

// ----------------------------------------------------------------------------
// Configuration d'envoi par entreprise
// ----------------------------------------------------------------------------

const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525];

function isPrivateAddress(addr: string): boolean {
  const a = addr.trim().toLowerCase();
  if (net.isIPv4(a)) {
    const [o1, o2] = a.split('.').map(Number);
    return (
      o1 === 0 || o1 === 10 || o1 === 127 || o1 >= 224 ||
      (o1 === 169 && o2 === 254) ||
      (o1 === 172 && o2 >= 16 && o2 <= 31) ||
      (o1 === 192 && o2 === 168) ||
      (o1 === 100 && o2 >= 64 && o2 <= 127)
    );
  }
  if (net.isIPv6(a)) {
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return a === '::' || a === '::1' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80');
  }
  return true;
}

/** Refuse les hôtes internes (SSRF) : un administrateur d'entreprise ne doit pas pouvoir sonder le réseau du serveur. */
export function assertPublicSmtpHost(host: string): void {
  const h = host.trim().toLowerCase();
  if (
    !h ||
    h.length > 253 ||
    net.isIP(h) !== 0 || // uniquement des noms d'hôtes, jamais d'adresses IP
    !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(h) ||
    !h.includes('.') ||
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost')
  ) {
    throw new Error("Serveur SMTP invalide : indiquez le nom d'hôte public de votre messagerie (ex. smtp.votre-domaine.fr).");
  }
}

/** Le nom doit se résoudre vers des adresses publiques uniquement. */
async function assertResolvesPublic(host: string): Promise<void> {
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`Le serveur SMTP « ${host} » est introuvable (vérifiez l'orthographe).`);
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Serveur SMTP invalide : l'adresse du serveur n'est pas publique.");
  }
}

async function loadCompanyRow(companyId: number) {
  try {
    return await prisma.companyMailSettings.findUnique({ where: { companyId } });
  } catch (err) {
    if (isMissingSchemaError(err)) return null;
    throw err;
  }
}

function rowToConfig(row: NonNullable<Awaited<ReturnType<typeof loadCompanyRow>>>): SmtpConfigData {
  return {
    host: row.smtpHost,
    port: row.smtpPort,
    secure: row.smtpSecure,
    user: row.smtpUser,
    pass: decryptSecret(row.smtpPassEnc) || '',
    fromName: row.fromName || '',
    replyTo: row.replyTo || undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Ancienne configuration globale (referentiels.smtp_config de l'entreprise 1) puis variables d'environnement. */
async function loadLegacyPlatformConfig(): Promise<SmtpConfigData> {
  try {
    const row = await prisma.referentiel.findFirst({
      where: { categorie: 'smtp_config', companyId: PLATFORM_COMPANY_ID },
    });
    if (row && row.valeurs) {
      const parsed = JSON.parse(row.valeurs);
      if (parsed && typeof parsed === 'object') {
        const port = Number(parsed.port) || DEFAULT_SMTP_PORT;
        return {
          host: String(parsed.host || DEFAULT_SMTP_HOST).trim(),
          port,
          secure: parsed.secure !== undefined ? Boolean(parsed.secure) : port === 465,
          user: String(parsed.user || DEFAULT_SMTP_USER).trim(),
          pass: String(parsed.pass || DEFAULT_SMTP_PASS),
          fromName: String(parsed.fromName || 'ANELEC GROUPE'),
          updatedAt: parsed.updatedAt,
        };
      }
    }
  } catch (err) {
    console.warn('[EMAIL SERVICE] Lecture smtp_config DB ignorée:', err);
  }
  return {
    host: DEFAULT_SMTP_HOST,
    port: DEFAULT_SMTP_PORT,
    secure: DEFAULT_SMTP_PORT === 465,
    user: DEFAULT_SMTP_USER,
    pass: DEFAULT_SMTP_PASS,
    fromName: 'ANELEC GROUPE',
  };
}

async function loadPlatformConfig(): Promise<SmtpConfigData> {
  const row = await loadCompanyRow(PLATFORM_COMPANY_ID);
  if (row && row.enabled && row.smtpPassEnc) {
    const cfg = rowToConfig(row);
    if (cfg.pass) return { ...cfg, fromName: cfg.fromName || 'ANELEC GROUPE' };
  }
  return loadLegacyPlatformConfig();
}

/**
 * Détermine l'expéditeur à utiliser pour une entreprise :
 * sa propre boîte si elle est configurée et active, sinon l'expéditeur plateforme.
 */
export async function resolveMail(companyId: number): Promise<ResolvedMail> {
  if (companyId !== PLATFORM_COMPANY_ID) {
    const row = await loadCompanyRow(companyId);
    if (row && row.enabled) {
      const cfg = rowToConfig(row);
      if (cfg.pass) return { cfg, ownMailbox: true };
    }
    return { cfg: await loadPlatformConfig(), ownMailbox: false };
  }
  return { cfg: await loadPlatformConfig(), ownMailbox: true };
}

export interface PublicMailConfig {
  configured: boolean;
  enabled: boolean;
  ownMailbox: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  replyTo: string;
  hasPassword: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  updatedAt?: string;
  /** Adresse principale de l'entreprise (premier administrateur), utilisée en « Répondre à » par défaut */
  mainEmail: string | null;
  companyName: string;
}

/** Vue sans secret de la configuration d'envoi d'une entreprise (pour l'écran d'administration). */
export async function getPublicMailConfig(companyId: number): Promise<PublicMailConfig> {
  const [row, mainEmail, company] = await Promise.all([
    loadCompanyRow(companyId),
    getCompanyMainEmail(companyId),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ]);
  const resolved = await resolveMail(companyId);
  const own = row ? rowToConfig(row) : null;
  const shown = own || (companyId === PLATFORM_COMPANY_ID ? resolved.cfg : null);
  return {
    configured: Boolean(own && own.pass) || companyId === PLATFORM_COMPANY_ID,
    enabled: row ? row.enabled : companyId === PLATFORM_COMPANY_ID,
    ownMailbox: resolved.ownMailbox,
    host: shown?.host || '',
    port: shown?.port || 465,
    secure: shown?.secure ?? true,
    user: shown?.user || '',
    fromName: shown?.fromName || company?.name || '',
    replyTo: shown?.replyTo || '',
    hasPassword: Boolean(shown?.pass),
    lastTestAt: row?.lastTestAt ? row.lastTestAt.toISOString() : null,
    lastTestOk: row?.lastTestOk ?? null,
    lastError: row?.lastError ?? null,
    updatedAt: shown?.updatedAt,
    mainEmail,
    companyName: company?.name || '',
  };
}

export async function saveCompanyMailSettings(
  companyId: number,
  input: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    fromName?: string;
    replyTo?: string;
    enabled?: boolean;
  }
): Promise<void> {
  const existing = await loadCompanyRow(companyId);
  const host = String(input.host ?? existing?.smtpHost ?? '').trim();
  const user = String(input.user ?? existing?.smtpUser ?? '').trim();
  const port = Number(input.port ?? existing?.smtpPort ?? 465);
  if (!host || !user) throw new Error('Serveur SMTP et adresse expéditeur obligatoires.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) throw new Error("L'adresse expéditeur doit être une adresse e-mail valide.");
  if (!ALLOWED_SMTP_PORTS.includes(port)) throw new Error('Port SMTP non autorisé (465, 587, 2525 ou 25).');
  assertPublicSmtpHost(host);
  await assertResolvesPublic(host);
  const replyTo = String(input.replyTo ?? existing?.replyTo ?? '').trim();
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) throw new Error('Adresse « Répondre à » invalide.');

  const newPass = typeof input.pass === 'string' && input.pass.trim() && input.pass.trim() !== '********' ? input.pass.trim() : null;
  let passEnc = newPass ? encryptSecret(newPass) : existing?.smtpPassEnc || null;
  // Entreprise plateforme : première sauvegarde sans nouveau mot de passe => on conserve l'ancien secret (env / ancienne config)
  if (!passEnc && companyId === PLATFORM_COMPANY_ID) {
    const legacy = await loadLegacyPlatformConfig();
    if (legacy.pass) passEnc = encryptSecret(legacy.pass);
  }
  if (!passEnc) throw new Error('Le mot de passe de la boîte mail est obligatoire à la première configuration.');

  const data = {
    smtpHost: host,
    smtpPort: port,
    smtpSecure: input.secure !== undefined ? Boolean(input.secure) : port === 465,
    smtpUser: user,
    smtpPassEnc: passEnc,
    fromName: String(input.fromName ?? existing?.fromName ?? '').trim() || null,
    replyTo: replyTo || null,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : existing?.enabled ?? true,
    lastTestOk: null as boolean | null,
    lastError: null as string | null,
  };
  await prisma.companyMailSettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
  for (const k of Array.from(workingCandidates.keys())) {
    if (k.startsWith(`${companyId}|`)) workingCandidates.delete(k);
  }
}

/** Supprime la boîte propre de l'entreprise : elle repasse sur l'expéditeur plateforme. */
export async function deleteCompanyMailSettings(companyId: number): Promise<void> {
  try {
    await prisma.companyMailSettings.delete({ where: { companyId } });
  } catch (err: any) {
    if (err?.code !== 'P2025' && !isMissingSchemaError(err)) throw err;
  }
  for (const k of Array.from(workingCandidates.keys())) {
    if (k.startsWith(`${companyId}|`)) workingCandidates.delete(k);
  }
}

/** Adresse principale de l'entreprise = e-mail de son premier administrateur actif. */
export async function getCompanyMainEmail(companyId: number): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { companyId, role: 'ADMIN', active: true },
    orderBy: { id: 'asc' },
    select: { email: true },
  });
  return admin?.email || null;
}

// ----------------------------------------------------------------------------
// Journal d'envoi (cloisonné par entreprise)
// ----------------------------------------------------------------------------

async function appendEmailLog(companyId: number | null, entry: EmailLogEntry): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        companyId,
        type: entry.type,
        toEmail: entry.toEmail,
        ccEmail: entry.ccEmail || null,
        subject: entry.subject.slice(0, 300),
        channel: entry.channel,
        sent: entry.sent,
        error: entry.error ? entry.error.slice(0, 500) : null,
      },
    });
  } catch (err) {
    console.warn('[EMAIL LOG] Impossible d’enregistrer le log email:', err);
  }
}

export async function getEmailLogs(companyId: number): Promise<EmailLogEntry[]> {
  try {
    const rows = await prisma.emailLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    return rows.map((r) => ({
      id: `mail_${r.id}`,
      timestamp: r.createdAt.toISOString(),
      type: r.type as EmailLogEntry['type'],
      toEmail: r.toEmail,
      ccEmail: r.ccEmail || undefined,
      subject: r.subject,
      channel: r.channel,
      sent: r.sent,
      error: r.error || undefined,
    }));
  } catch (err) {
    if (!isMissingSchemaError(err)) console.warn('[EMAIL LOG] Lecture impossible:', err);
    return [];
  }
}

// ----------------------------------------------------------------------------
// Transport
// ----------------------------------------------------------------------------

type Candidate = { host: string; port: number; secure: boolean; user: string; pass: string };

/**
 * Candidats de connexion.
 * - Boîte propre d'une entreprise : uniquement SON serveur (port configuré, puis l'autre port 465/587).
 *   Ses identifiants ne sont jamais présentés à un autre serveur.
 * - Expéditeur plateforme : découverte multi-hôtes Zoho / Hostinger comme auparavant.
 */
function buildSmtpCandidates(cfg: SmtpConfigData, discovery: boolean): Candidate[] {
  const rawPass = (cfg.pass || '').trim();
  const compactPass = rawPass.replace(/\s+/g, '');
  const passwords = compactPass && compactPass !== rawPass ? [compactPass, rawPass] : [rawPass];

  const hosts = discovery
    ? Array.from(
        new Set([cfg.host, 'smtppro.zoho.eu', 'smtp.zoho.eu', 'smtppro.zoho.com', 'smtp.zoho.com', 'smtp.hostinger.com'])
      ).filter(Boolean)
    : [cfg.host];

  const candidates: Candidate[] = [];
  for (const pass of passwords) {
    if (!pass) continue;
    candidates.push({ host: cfg.host, port: cfg.port, secure: cfg.port === 465, user: cfg.user, pass });
    for (const h of hosts) {
      for (const p of [465, 587]) {
        if (h === cfg.host && p === cfg.port) continue;
        candidates.push({ host: h, port: p, secure: p === 465, user: cfg.user, pass });
      }
    }
  }
  return candidates;
}

/**
 * Relais via Supabase Auth (envoie un vrai e-mail transactionnel aux adresses Gmail/externes)
 */
async function triggerSupabaseAuthEmailRelay(
  toEmail: string,
  recipientName: string,
  companyName: string,
  activationLink: string,
  mode: 'signup' | 'recovery' = 'signup'
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (mode === 'recovery') {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(activationLink)}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: toEmail }),
      });
      if (res.ok) return { ok: true };
    }

    // Signup ou OTP magic link sur Supabase Auth avec redirect_to pointant directement vers l'activation du compte
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: toEmail,
        password: `Anelec!${Date.now()}Aa1`,
        data: {
          full_name: recipientName,
          company_name: companyName,
          activation_link: activationLink,
        },
        gotrue_meta_security: {},
      }),
    });

    if (signupRes.ok) {
      return { ok: true };
    }

    // Si l'utilisateur est déjà inscrit dans auth.users, on déclenche /auth/v1/resend ou /auth/v1/otp
    const resendRes = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'signup',
        email: toEmail,
        options: {
          emailRedirectTo: activationLink,
        },
      }),
    });

    if (resendRes.ok) {
      return { ok: true };
    }

    const errText = await resendRes.text();
    return { ok: false, error: errText };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erreur relais Supabase' };
  }
}

/**
 * Envoi centralisé.
 *
 * - `companyId` : entreprise propriétaire du message (journal + choix de l'expéditeur).
 * - `useCompanyMailbox` (défaut true) : l'e-mail part de la boîte de l'entreprise si elle est configurée ;
 *   sinon de l'expéditeur plateforme, avec le nom de l'entreprise et son adresse principale en « Répondre à ».
 *   À false pour les e-mails de la plateforme elle-même (activation de compte, mot de passe oublié).
 * - `allowSupabaseRelay` / `allowPreviewFallback` : replis réservés aux e-mails d'authentification.
 *   Les contenus d'une entreprise (rapports, devis, invitations) ne sont JAMAIS envoyés vers un service tiers de prévisualisation.
 */
export async function dispatchEmailWithFallback(options: {
  type: EmailLogEntry['type'];
  companyId?: number | null;
  useCompanyMailbox?: boolean;
  toEmail: string;
  ccEmail?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  activationLink?: string;
  recipientName?: string;
  companyName?: string;
  allowSupabaseRelay?: boolean;
  allowPreviewFallback?: boolean;
}): Promise<EmailDeliveryResult> {
  const companyId = options.companyId ?? PLATFORM_COMPANY_ID;
  const useCompanyMailbox = options.useCompanyMailbox !== false;
  const resolved = useCompanyMailbox
    ? await resolveMail(companyId)
    : { cfg: await loadPlatformConfig(), ownMailbox: true };
  const cfg = resolved.cfg;
  const ownMailbox = resolved.ownMailbox;
  const isPlatformSender = !ownMailbox || companyId === PLATFORM_COMPANY_ID || !useCompanyMailbox;

  let displayCompany = options.companyName || '';
  if (!displayCompany && useCompanyMailbox) {
    const c = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }).catch(() => null);
    displayCompany = c?.name || '';
  }
  const mainEmail = useCompanyMailbox && !ownMailbox ? await getCompanyMainEmail(companyId) : null;

  const fromName = ownMailbox
    ? cfg.fromName || displayCompany || 'ANELEC TCE'
    : `${displayCompany || 'Entreprise'} via ANELEC TCE`;
  const replyTo = options.replyTo || cfg.replyTo || mainEmail || cfg.user;
  const senderMode: EmailDeliveryResult['senderMode'] = ownMailbox && useCompanyMailbox && companyId !== PLATFORM_COMPANY_ID ? 'COMPANY_MAILBOX' : 'PLATFORM';

  const cacheKey = `${companyId}|${cfg.host}|${cfg.user}`;
  const built = buildSmtpCandidates(cfg, isPlatformSender);
  const cached = workingCandidates.get(cacheKey);
  const candidates = cached ? [cached, ...built] : built;
  let lastSmtpError = '';

  const logCompanyId = options.companyId ?? null;
  const newId = () => `mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Serveur SMTP (boîte de l'entreprise, ou expéditeur plateforme avec découverte)
  for (const cand of candidates) {
    try {
      const transport: Transporter = nodemailer.createTransport({
        host: cand.host,
        port: cand.port,
        secure: cand.secure,
        auth: { user: cand.user, pass: cand.pass },
        // Certificat strictement vérifié pour les boîtes d'entreprise ; l'expéditeur plateforme garde son comportement historique.
        tls: { rejectUnauthorized: !isPlatformSender },
        connectionTimeout: 5500,
        greetingTimeout: 5500,
        socketTimeout: 7500,
      });

      const info = await transport.sendMail({
        from: `"${fromName.replace(/"/g, '')}" <${cand.user}>`,
        replyTo,
        to: options.toEmail,
        ...(options.ccEmail ? { cc: options.ccEmail } : {}),
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      workingCandidates.set(cacheKey, cand);
      const result: EmailDeliveryResult = {
        sent: true,
        channel: 'SMTP_PRODUCTION',
        senderMode,
        fromAddress: cand.user,
        hostUsed: `${cand.host}:${cand.port}`,
        messageId: info.messageId,
        activationLink: options.activationLink,
        timestamp: new Date().toISOString(),
      };

      await appendEmailLog(logCompanyId, {
        id: newId(),
        timestamp: result.timestamp,
        type: options.type,
        toEmail: options.toEmail,
        ccEmail: options.ccEmail,
        subject: options.subject,
        channel: `SMTP ${senderMode === 'COMPANY_MAILBOX' ? 'boîte entreprise' : 'plateforme'} (${cand.host}:${cand.port}) depuis ${cand.user}`,
        sent: true,
      });

      console.log(`[EMAIL ENVOYÉ] ${options.type} -> ${options.toEmail} via ${cand.host}:${cand.port} (${senderMode})`);
      return result;
    } catch (err: any) {
      lastSmtpError = `${cand.host}:${cand.port} -> ${err?.message || String(err)}`;
      console.warn(`[EMAIL SMTP RETRY] Échec sur ${lastSmtpError}`);
    }
  }

  // 2. Relais Supabase Auth (e-mails d'authentification uniquement)
  if (options.allowSupabaseRelay && options.activationLink) {
    const relay = await triggerSupabaseAuthEmailRelay(
      options.toEmail,
      options.recipientName || options.toEmail,
      options.companyName || 'ANELEC TCE',
      options.activationLink,
      options.type === 'RESET_PASSWORD' ? 'recovery' : 'signup'
    );
    if (relay.ok) {
      const result: EmailDeliveryResult = {
        sent: true,
        channel: 'SUPABASE_AUTH_RELAY',
        senderMode: 'PLATFORM',
        hostUsed: 'supabase-auth-mailer',
        activationLink: options.activationLink,
        error: lastSmtpError || undefined,
        timestamp: new Date().toISOString(),
      };
      await appendEmailLog(logCompanyId, {
        id: newId(),
        timestamp: result.timestamp,
        type: options.type,
        toEmail: options.toEmail,
        ccEmail: options.ccEmail,
        subject: options.subject,
        channel: 'Relais Supabase Auth',
        sent: true,
        error: lastSmtpError || undefined,
      });
      return result;
    }
  }

  // 3. Prévisualisation Ethereal : uniquement pour les e-mails d'authentification / de test plateforme
  if (options.allowPreviewFallback) {
    try {
      if (!etherealAccountCache) {
        const testAccount = await nodemailer.createTestAccount();
        etherealAccountCache = {
          user: testAccount.user,
          pass: testAccount.pass,
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
        };
      }

      const etherealTransport = nodemailer.createTransport({
        host: etherealAccountCache.host,
        port: etherealAccountCache.port,
        secure: etherealAccountCache.secure,
        auth: { user: etherealAccountCache.user, pass: etherealAccountCache.pass },
      });

      const info = await etherealTransport.sendMail({
        from: `"${fromName.replace(/"/g, '')}" <${cfg.user}>`,
        replyTo,
        to: options.toEmail,
        ...(options.ccEmail ? { cc: options.ccEmail } : {}),
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      const result: EmailDeliveryResult = {
        sent: true,
        channel: 'ETHEREAL_TEST_SMTP',
        senderMode: 'PLATFORM',
        hostUsed: `${etherealAccountCache.host}:${etherealAccountCache.port}`,
        messageId: info.messageId,
        previewUrl,
        activationLink: options.activationLink,
        error: lastSmtpError || 'SMTP_PASS non configuré ou refusé par le serveur (mot de passe d’application requis)',
        timestamp: new Date().toISOString(),
      };

      await appendEmailLog(logCompanyId, {
        id: newId(),
        timestamp: result.timestamp,
        type: options.type,
        toEmail: options.toEmail,
        ccEmail: options.ccEmail,
        subject: options.subject,
        channel: 'Relais Secours (Prévisualisation Web)',
        sent: true,
        error: lastSmtpError || 'Mot de passe d’application à renseigner dans Workstation Admin > E-mails & SMTP',
      });

      console.log(`[EMAIL SECOURS ETHEREAL] ${options.type} -> ${options.toEmail} | Preview: ${previewUrl}`);
      return result;
    } catch (ethErr: any) {
      lastSmtpError = lastSmtpError || ethErr?.message || '';
    }
  }

  const failResult: EmailDeliveryResult = {
    sent: false,
    channel: 'NONE',
    senderMode,
    activationLink: options.activationLink,
    error:
      lastSmtpError ||
      (candidates.length === 0
        ? "Aucune boîte d'envoi n'est configurée (mot de passe SMTP manquant)."
        : 'Échec complet envoi email'),
    timestamp: new Date().toISOString(),
  };

  await appendEmailLog(logCompanyId, {
    id: newId(),
    timestamp: failResult.timestamp,
    type: options.type,
    toEmail: options.toEmail,
    ccEmail: options.ccEmail,
    subject: options.subject,
    channel: 'ÉCHEC SMTP',
    sent: false,
    error: failResult.error,
  });

  return failResult;
}

export interface SendConfirmationEmailParams {
  companyId?: number | null;
  toEmail: string;
  recipientName: string;
  companyName: string;
  confirmationToken: string;
  confirmationCode?: string;
}

/**
 * 1. Envoie un email d'activation d'espace entreprise officiel avec conditions contractuelles
 */
export async function sendConfirmationEmail({
  companyId,
  toEmail,
  recipientName,
  companyName,
  confirmationToken,
  confirmationCode,
}: SendConfirmationEmailParams): Promise<EmailDeliveryResult> {
  const activationLink = `${APP_URL}/api/auth/confirm-email?token=${encodeURIComponent(confirmationToken)}`;
  const codeDisplay = confirmationCode || '------';
  const codeDigits = codeDisplay.split('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .header { text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
    .badge { display: inline-block; background: #e6f9f0; color: #00bf63; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }
    h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .code-box { text-align: center; margin: 24px 0; }
    .code-digits { display: inline-flex; gap: 8px; }
    .code-digit { display: inline-block; width: 44px; height: 56px; line-height: 56px; font-size: 28px; font-weight: 800; color: #0f172a; background: #f0fdf4; border: 2px solid #00bf63; border-radius: 10px; text-align: center; letter-spacing: 0; }
    .code-expiry { font-size: 12px; color: #94a3b8; margin-top: 10px; }
    .terms-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 12px; color: #64748b; line-height: 1.5; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">ANELEC GROUPE • ESPACE MULTI-ENTREPRISES</span>
      <h1>Code de confirmation de votre espace entreprise</h1>
    </div>

    <p>Bonjour <strong>${esc(recipientName)}</strong>,</p>

    <p>
      Votre demande d'ouverture d'espace pour la société <strong>${esc(companyName)}</strong> a bien été enregistrée sur la plateforme ANELEC TCE.
    </p>

    <p>
      Pour confirmer votre adresse e-mail et activer votre espace, saisissez le code ci-dessous sur la page d'inscription :
    </p>

    <div class="code-box">
      <div class="code-digits">
        ${codeDigits.map((d: string) => `<span class="code-digit">${d}</span>`).join('')}
      </div>
      <div class="code-expiry">Ce code expire dans 15 minutes</div>
    </div>

    <div class="terms-box">
      <strong>Engagement contractuel et RGPD certifié :</strong><br />
      En confirmant ce code, vous reconnaissez avoir pris connaissance et accepté sans réserve les Conditions Générales d'Utilisation (CGU). Vous confirmez que les données métier saisies dans votre espace (devis, chantiers, factures, clients, plannings) restent la propriété exclusive de <strong>${esc(companyName)}</strong>, sont hébergées sur des serveurs souverains sécurisés en France (Supabase & Hostinger), et ne font l'objet d'aucun traitement ni exploitation par ANELEC GROUPE.
    </div>

    <p style="font-size: 12px; color: #64748b;">
      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
    </p>

    <div class="footer">
      ANELEC GROUPE SAS • 9 Rue des Colonnes, 75002 Paris • SIREN 933 108 607<br />
      Email expéditeur officiel : zehair@anelecgroupe.com • Tous droits réservés © 2026
    </div>
  </div>
</body>
</html>
  `;

  return dispatchEmailWithFallback({
    type: 'CONFIRMATION_COMPTE',
    companyId,
    useCompanyMailbox: false,
    allowPreviewFallback: true,
    toEmail,
    subject: `${codeDisplay} — Code de confirmation espace entreprise ${companyName} - ANELEC TCE`,
    html: htmlContent,
    text: `Bonjour ${recipientName},\n\nVotre code de confirmation pour activer l'espace entreprise ${companyName} :\n\n${codeDisplay}\n\nCe code expire dans 15 minutes.\n\nSaisissez-le sur la page d'inscription pour activer votre espace.\n\nEn confirmant ce code, vous acceptez les conditions d'utilisation et la politique RGPD.`,
    activationLink,
    recipientName,
    companyName,
    allowSupabaseRelay: true,
  });
}

/**
 * 2. Envoie un e-mail de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmail(params: {
  companyId?: number | null;
  toEmail: string;
  recipientName: string;
  resetToken: string;
}): Promise<EmailDeliveryResult> {
  const resetLink = `${APP_URL}/login?resetToken=${encodeURIComponent(params.resetToken)}&email=${encodeURIComponent(
    params.toEmail
  )}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 20px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; }
    .btn { display: inline-block; background: #0284c7; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 13px 26px; border-radius: 10px; margin: 18px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin-top:0;color:#0f172a;">Réinitialisation de votre mot de passe ANELEC TCE</h2>
    <p>Bonjour <strong>${esc(params.recipientName)}</strong>,</p>
    <p>Vous avez demandé la réinitialisation du mot de passe de votre compte <strong>${esc(params.toEmail)}</strong>.</p>
    <div style="text-align:center;">
      <a href="${resetLink}" class="btn" target="_blank">Choisir un nouveau mot de passe</a>
    </div>
    <p style="font-size:12px;color:#64748b;">Lien direct : <a href="${resetLink}">${resetLink}</a></p>
  </div>
</body>
</html>`;

  return dispatchEmailWithFallback({
    type: 'RESET_PASSWORD',
    companyId: params.companyId,
    useCompanyMailbox: false,
    allowPreviewFallback: true,
    toEmail: params.toEmail,
    subject: `[Sécurité ANELEC TCE] Réinitialisation de votre mot de passe`,
    html: htmlContent,
    text: `Bonjour ${params.recipientName},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe :\n${resetLink}`,
    activationLink: resetLink,
    recipientName: params.recipientName,
    allowSupabaseRelay: true,
  });
}

/**
 * 3. Envoie un e-mail de bienvenue avec identifiants lorsqu'un administrateur crée un collaborateur / technicien
 */
export async function sendWelcomeUserEmail(params: {
  companyId: number;
  toEmail: string;
  recipientName: string;
  roleLabel: string;
  tempPassword: string;
  companyName: string;
}): Promise<EmailDeliveryResult> {
  const loginLink = `${APP_URL}/login`;
  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 20px; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; }
    .creds { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin: 16px 0; font-size: 13px; }
    .btn { display: inline-block; background: #00bf63; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 10px; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin-top:0;">Bienvenue sur l'espace ${esc(params.companyName)} — ANELEC TCE</h2>
    <p>Bonjour <strong>${esc(params.recipientName)}</strong>,</p>
    <p>Votre compte collaborateur (profil : <strong>${esc(params.roleLabel)}</strong>) a été créé et activé par votre administrateur.</p>
    <div class="creds">
      <div><strong>Identifiant (E-mail) :</strong> ${esc(params.toEmail)}</div>
      <div style="margin-top:6px;"><strong>Mot de passe initial :</strong> <code>${esc(params.tempPassword)}</code></div>
    </div>
    <a href="${loginLink}" class="btn" target="_blank">Se connecter à la plateforme</a>
  </div>
</body>
</html>`;

  return dispatchEmailWithFallback({
    type: 'WELCOME_USER',
    companyId: params.companyId,
    toEmail: params.toEmail,
    subject: `[Accès Collaborateur] Vos identifiants ANELEC TCE (${params.companyName})`,
    html: htmlContent,
    text: `Bonjour ${params.recipientName},\nVotre compte (${params.roleLabel}) est actif sur ${loginLink}\nIdentifiant : ${params.toEmail}\nMot de passe : ${params.tempPassword}`,
    activationLink: loginLink,
    recipientName: params.recipientName,
    companyName: params.companyName,
  });
}

export interface SendInterventionReportEmailParams {
  companyId: number;
  toEmail: string;
  ccEmail?: string;
  subject?: string;
  customMessage?: string;
  intervention: {
    id: number;
    referenceMetier?: string | null;
    client?: string | null;
    chantier: string;
    entreprise?: string | null;
    corpsEtat?: string | null;
    typeIntervention?: string | null;
    datePlanifiee: Date | string;
    dateReelle?: Date | string | null;
    actionsRealisees?: string[];
    photos?: any[];
    elementsChiffrage?: string | null;
    rapportFinal?: string | null;
    statutRapport?: string | null;
  };
  senderName: string;
  senderEmail: string;
  companyName: string;
}

/**
 * 4. Envoie le rapport officiel d'intervention par e-mail au donneur d'ordre ou client
 */
export async function sendInterventionReportEmail({
  companyId,
  toEmail,
  ccEmail,
  subject,
  customMessage,
  intervention,
  senderName,
  senderEmail,
  companyName,
}: SendInterventionReportEmailParams): Promise<EmailDeliveryResult> {
  const ref = intervention.referenceMetier || `INT-${intervention.id}`;
  const clientName = intervention.client || 'Client';
  const site = intervention.chantier || 'Site';
  const mailSubject =
    subject || `[RAPPORT INTERVENTION] ${ref} • ${clientName} • ${site} (${companyName})`;

  const dateExecution = intervention.dateReelle
    ? new Date(intervention.dateReelle).toLocaleDateString('fr-FR')
    : new Date(intervention.datePlanifiee).toLocaleDateString('fr-FR');

  const photosHtml =
    intervention.photos && intervention.photos.length > 0
      ? `
    <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 18px;">
      <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">
        ⊞ Photos prises sur site (${intervention.photos.length})
      </h3>
      <div style="display: flex; flex-wrap: wrap; gap: 12px;">
        ${intervention.photos
          .map(
            (p, idx) => `
          <div style="display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: center; margin: 4px;">
            <a href="${esc(p.url)}" target="_blank" style="text-decoration: none;">
              <img src="${esc(p.url)}" alt="Photo ${idx + 1}" style="max-width: 180px; max-height: 140px; border-radius: 6px; display: block; object-fit: cover;" />
            </a>
            <span style="font-size: 10px; color: #64748b; font-weight: 600; display: block; margin-top: 4px;">
              ${p.category || 'CONSTAT'} • ${p.takenAt ? new Date(p.takenAt).toLocaleDateString('fr-FR') : ''}
            </span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `
      : '';

  const actionsHtml =
    intervention.actionsRealisees && intervention.actionsRealisees.length > 0
      ? `
    <div style="margin-top: 18px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px;">
      <strong style="color: #166534; font-size: 13px;">✓ Travaux & Opérations réalisés sur site :</strong>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12.5px; color: #15803d; line-height: 1.6;">
        ${intervention.actionsRealisees.map((a) => `<li>${esc(a)}</li>`).join('')}
      </ul>
    </div>
  `
      : '';

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
    .card { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { border-bottom: 2px solid #00bf63; padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 6px 0 0 0; }
    .badge { display: inline-block; background: #0f172a; color: #ffffff; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 18px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
    .grid-cell { font-size: 12.5px; color: #475569; }
    .grid-cell strong { color: #0f172a; display: block; font-size: 11.5px; text-transform: uppercase; margin-bottom: 2px; }
    .report-box { background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #00bf63; border-radius: 8px; padding: 18px; margin: 20px 0; }
    .report-text { font-size: 13.5px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; margin: 0; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="badge">${esc(companyName)} • RAPPORT OFFICIEL</span>
        <span style="font-weight: 800; color: #00bf63; font-size: 13px;">${esc(ref)}</span>
      </div>
      <h1 class="title">Rapport d'Intervention Technique</h1>
    </div>

    ${
      customMessage
        ? `
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
        ${esc(customMessage)}
      </div>
    `
        : `
      <p style="font-size: 13.5px; color: #475569; line-height: 1.5; margin: 0 0 16px 0;">
        Bonjour,<br /><br />
        Veuillez trouver ci-dessous le rapport officiel d'intervention technique réalisé par les équipes de <strong>${esc(companyName)}</strong>.
      </p>
    `
    }

    <div class="grid">
      <div class="grid-cell">
        <strong>Donneur d'ordre / Client</strong>
        ${clientName}
      </div>
      <div class="grid-cell">
        <strong>Site / Chantier</strong>
        ${site}
      </div>
      <div class="grid-cell">
        <strong>Date de réalisation</strong>
        ${dateExecution}
      </div>
      <div class="grid-cell">
        <strong>Corps d'état</strong>
        ${intervention.corpsEtat || 'Tous corps d’état'}
      </div>
      <div class="grid-cell">
        <strong>Technicien intervenant</strong>
        ${intervention.entreprise || 'Équipe terrain ANELEC'}
      </div>
      <div class="grid-cell">
        <strong>Type d'intervention</strong>
        ${intervention.typeIntervention || 'Corrective / Dépannage'}
      </div>
    </div>

    <div class="report-box">
      <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
        Synthèse technique & Compte rendu validé :
      </div>
      <p class="report-text">${
        intervention.rapportFinal ||
        'Intervention exécutée et contrôlée selon les règles de l’art. Aucun incident résiduel signalé.'
      }</p>
    </div>

    ${actionsHtml}

    ${
      intervention.elementsChiffrage
        ? `
      <div style="margin-top: 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; font-size: 12.5px; color: #92400e;">
        <strong>≡ Éléments relevés pour suite à donner / devis :</strong><br />
        <span style="white-space: pre-wrap;">${intervention.elementsChiffrage}</span>
      </div>
    `
        : ''
    }

    ${photosHtml}

    <div class="footer">
      Document transmis par <strong>${senderName}</strong> (${senderEmail}) • <strong>${esc(companyName)}</strong><br />
      Plateforme de pilotage ANELEC TCE • Ce rapport fait foi d'exécution technique.
    </div>
  </div>
</body>
</html>
  `;

  return dispatchEmailWithFallback({
    type: 'RAPPORT_INTERVENTION',
    companyId,
    companyName,
    toEmail,
    ccEmail,
    replyTo: senderEmail,
    subject: mailSubject,
    html: htmlContent,
    text: `Rapport d'Intervention ${ref}\nClient: ${clientName}\nSite: ${site}\nDate: ${dateExecution}\n\nCompte rendu:\n${
      intervention.rapportFinal || 'Intervention réalisée.'
    }\n\nTransmis par ${senderName} (${companyName})`,
  });
}

/**
 * 5. Envoie une proposition de devis ou relance commerciale par e-mail au client / donneur d'ordre
 */
export async function sendDevisProposalEmail(params: {
  companyId: number;
  toEmail: string;
  ccEmail?: string;
  subject?: string;
  customMessage?: string;
  devis: {
    id: number;
    referenceMetier?: string | null;
    client: string;
    siteAdresse?: string | null;
    objet?: string | null;
    corpsEtat?: string | null;
    amount?: number | null;
    statutCommercial?: string | null;
  };
  senderName: string;
  senderEmail: string;
  companyName: string;
}): Promise<EmailDeliveryResult> {
  const ref = params.devis.referenceMetier || `DEV-${new Date().getFullYear()}-${String(params.devis.id).padStart(3, "0")}`;
  const subject =
    params.subject || `[PROPOSITION COMMERCIALE / DEVIS] ${ref} • ${params.devis.client} (${params.companyName})`;
  const amountFormatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    Number(params.devis.amount || 0)
  );

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 20px; }
    .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 32px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 18px 0; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;">
      <strong style="font-size:16px;color:#0f172a;">Proposition Commerciale & Chiffrage • ${esc(params.companyName)}</strong>
      <span style="color:#0284c7;font-weight:800;">${esc(ref)}</span>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#334155;">
      ${params.customMessage || `Bonjour,<br/><br/>Veuillez trouver ci-dessous le récapitulatif de notre proposition de devis <strong>${esc(ref)}</strong> concernant votre demande de travaux.`}
    </p>
    <div class="grid">
      <div><strong>Client / Donneur d'ordre :</strong><br/>${params.devis.client}</div>
      <div><strong>Site / Chantier :</strong><br/>${params.devis.siteAdresse || '—'}</div>
      <div><strong>Corps d'état :</strong><br/>${params.devis.corpsEtat || 'Tous corps d’état'}</div>
      <div><strong>Montant Total HT :</strong><br/><span style="font-size:15px;font-weight:800;color:#0284c7;">${amountFormatted} HT</span></div>
    </div>
    <div style="background:#f8fafc;border-left:4px solid #0284c7;padding:14px;border-radius:8px;font-size:13px;color:#1e293b;">
      <strong>Objet des travaux :</strong><br/>
      ${params.devis.objet || 'Travaux de maintenance et remise en état'}
    </div>
    <p style="font-size:11px;color:#94a3b8;margin-top:24px;text-align:center;">
      Transmis par ${params.senderName} (${params.senderEmail}) • ${params.companyName}
    </p>
  </div>
</body>
</html>`;

  return dispatchEmailWithFallback({
    type: 'PROPOSITION_DEVIS',
    companyId: params.companyId,
    companyName: params.companyName,
    toEmail: params.toEmail,
    ccEmail: params.ccEmail,
    replyTo: params.senderEmail,
    subject,
    html,
    text: `Proposition de devis ${ref} - ${params.devis.client}\nObjet: ${params.devis.objet || ''}\nMontant HT: ${amountFormatted}\nTransmis par ${params.senderName} (${params.companyName})`,
  });
}

/**
 * 6. Invitation à rejoindre une entreprise (lien à usage unique)
 *    Part de la boîte mail de l'entreprise si elle est configurée ; jamais vers un service de prévisualisation tiers.
 */
export async function sendInvitationEmail(params: {
  companyId: number;
  companyName: string;
  toEmail: string;
  inviterName: string;
  inviterEmail: string;
  roleLabel: string;
  inviteLink: string;
  expiresAt: Date;
}): Promise<EmailDeliveryResult> {
  const expires = params.expiresAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const company = esc(params.companyName);
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 20px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; }
    .btn { display: inline-block; background: #00bf63; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 13px 26px; border-radius: 10px; margin: 18px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin-top:0;color:#0f172a;">Vous êtes invité(e) à rejoindre ${company}</h2>
    <p><strong>${esc(params.inviterName)}</strong> vous invite à rejoindre l'espace <strong>${company}</strong> sur la plateforme ANELEC TCE avec le profil <strong>${esc(params.roleLabel)}</strong>.</p>
    <div style="text-align:center;">
      <a href="${esc(params.inviteLink)}" class="btn" target="_blank">Accepter l'invitation et créer mon accès</a>
    </div>
    <p style="font-size:12px;color:#64748b;">Ce lien est personnel, à usage unique, et valable jusqu'au ${esc(expires)}.<br />
    Si le bouton ne fonctionne pas : <a href="${esc(params.inviteLink)}" style="color:#00bf63;word-break:break-all;">${esc(params.inviteLink)}</a></p>
    <p style="font-size:11px;color:#94a3b8;">Vous n'attendiez pas cette invitation ? Ignorez simplement ce message, aucun compte ne sera créé.</p>
  </div>
</body>
</html>`;

  return dispatchEmailWithFallback({
    type: 'INVITATION_COLLABORATEUR',
    companyId: params.companyId,
    companyName: params.companyName,
    replyTo: params.inviterEmail,
    toEmail: params.toEmail,
    subject: `Invitation à rejoindre ${params.companyName} sur ANELEC TCE`,
    html,
    text: `${params.inviterName} vous invite à rejoindre l'espace ${params.companyName} (profil : ${params.roleLabel}).\nAccepter l'invitation : ${params.inviteLink}\nLien personnel valable jusqu'au ${expires}.`,
  });
}

/**
 * 7. Diagnostic complet & envoi d'un e-mail de test réel depuis la boîte de l'entreprise
 */
export async function verifyAndTestSmtpConfig(
  companyId: number,
  toEmail: string
): Promise<{ config: PublicMailConfig; delivery: EmailDeliveryResult }> {
  const resolved = await resolveMail(companyId);
  const pub = await getPublicMailConfig(companyId);
  const delivery = await dispatchEmailWithFallback({
    type: 'TEST_SMTP',
    companyId,
    companyName: pub.companyName,
    toEmail,
    subject: `[TEST] Vérification d'envoi ${pub.companyName || 'ANELEC TCE'} (${new Date().toLocaleTimeString('fr-FR')})`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;">
        <h2 style="color:#00bf63;margin-top:0;">✓ Test d'envoi réussi</h2>
        <p>Cet e-mail confirme que ${esc(pub.companyName || 'votre entreprise')} peut envoyer ses e-mails depuis la plateforme ANELEC TCE.</p>
        <ul style="font-size:13px;color:#475569;line-height:1.7;">
          <li><strong>Destinataire testé :</strong> ${esc(toEmail)}</li>
          <li><strong>Expéditeur :</strong> ${esc(resolved.cfg.user)}${resolved.ownMailbox ? '' : ' (expéditeur plateforme)'}</li>
          <li><strong>Horodatage :</strong> ${esc(new Date().toLocaleString('fr-FR'))}</li>
        </ul>
      </div>
    `,
    text: `Test d'envoi réussi pour ${toEmail} depuis ${resolved.cfg.user}.`,
  });

  try {
    await prisma.companyMailSettings.updateMany({
      where: { companyId },
      data: {
        lastTestAt: new Date(),
        lastTestOk: delivery.sent,
        lastError: delivery.sent ? null : (delivery.error || 'Échec').slice(0, 500),
      },
    });
  } catch (err) {
    if (!isMissingSchemaError(err)) console.warn('[EMAIL TEST] Mise à jour du statut impossible:', err);
  }

  return { config: await getPublicMailConfig(companyId), delivery };
}
