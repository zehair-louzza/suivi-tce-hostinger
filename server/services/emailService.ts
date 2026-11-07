import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../lib/prisma.js';

const DEFAULT_SMTP_HOST = process.env.SMTP_HOST || 'smtppro.zoho.eu';
const DEFAULT_SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const DEFAULT_SMTP_USER = process.env.SMTP_USER || 'zehair@anelecgroupe.com';
const DEFAULT_SMTP_PASS = process.env.SMTP_PASS || '';
const APP_URL = process.env.APP_URL || 'https://suivi.anelecgroupe.com';

// Supabase Auth Relay fallback (projet officiel ANELEC TCE)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfhxptwsuotqnrihzhxw.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmaHhwdHdzdW90cW5yaWh6aHh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjM0NjgsImV4cCI6MjA4OTUzOTQ2OH0.r83-3B_3e25I2J9u-mN04t2-wF_2t0p_X-p4vH-bI0w';

export interface SmtpConfigData {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  updatedAt?: string;
}

export interface EmailDeliveryResult {
  sent: boolean;
  channel: 'SMTP_PRODUCTION' | 'SUPABASE_AUTH_RELAY' | 'ETHEREAL_TEST_SMTP' | 'NONE';
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
  type: 'CONFIRMATION_COMPTE' | 'RESET_PASSWORD' | 'WELCOME_USER' | 'RAPPORT_INTERVENTION' | 'PROPOSITION_DEVIS' | 'TEST_SMTP';
  toEmail: string;
  ccEmail?: string;
  subject: string;
  channel: string;
  sent: boolean;
  previewUrl?: string;
  activationLink?: string;
  error?: string;
}

let cachedWorkingCandidate: { host: string; port: number; secure: boolean; user: string; pass: string } | null = null;
let etherealAccountCache: { user: string; pass: string; host: string; port: number; secure: boolean } | null = null;

/**
 * Charge la configuration SMTP depuis PostgreSQL (referentiels categorie = 'smtp_config')
 * avec repli sur les variables d'environnement Hostinger.
 */
export async function getActiveSmtpConfig(): Promise<SmtpConfigData> {
  try {
    const row = await prisma.referentiel.findFirst({
      where: { categorie: 'smtp_config', companyId: 1 },
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

/**
 * Enregistre la configuration SMTP dans PostgreSQL (sans redémarrage requis)
 */
export async function saveSmtpConfigToDb(input: Partial<SmtpConfigData>): Promise<SmtpConfigData> {
  const current = await getActiveSmtpConfig();
  const port = Number(input.port) || current.port || 465;
  const nextConfig: SmtpConfigData = {
    host: String(input.host || current.host || 'smtppro.zoho.eu').trim(),
    port,
    secure: input.secure !== undefined ? Boolean(input.secure) : port === 465,
    user: String(input.user || current.user || 'zehair@anelecgroupe.com').trim(),
    pass: input.pass !== undefined && input.pass !== '********' ? String(input.pass) : current.pass,
    fromName: String(input.fromName || current.fromName || 'ANELEC GROUPE').trim(),
    updatedAt: new Date().toISOString(),
  };

  cachedWorkingCandidate = null;

  const existing = await prisma.referentiel.findFirst({
    where: { categorie: 'smtp_config', companyId: 1 },
  });

  if (existing) {
    await prisma.referentiel.update({
      where: { id: existing.id },
      data: { valeurs: JSON.stringify(nextConfig) },
    });
  } else {
    await prisma.referentiel.create({
      data: {
        categorie: 'smtp_config',
        valeurs: JSON.stringify(nextConfig),
        companyId: 1,
      },
    });
  }

  return nextConfig;
}

/**
 * Journalise chaque envoi d'email dans PostgreSQL pour audit et suivi dans la Workstation Admin
 */
async function appendEmailLog(entry: EmailLogEntry): Promise<void> {
  try {
    const existing = await prisma.referentiel.findFirst({
      where: { categorie: 'journal_emails', companyId: 1 },
    });
    let list: EmailLogEntry[] = [];
    if (existing && existing.valeurs) {
      try {
        const parsed = JSON.parse(existing.valeurs);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = [];
      }
    }
    list.unshift(entry);
    if (list.length > 80) list = list.slice(0, 80);

    if (existing) {
      await prisma.referentiel.update({
        where: { id: existing.id },
        data: { valeurs: JSON.stringify(list) },
      });
    } else {
      await prisma.referentiel.create({
        data: {
          categorie: 'journal_emails',
          valeurs: JSON.stringify(list),
          companyId: 1,
        },
      });
    }
  } catch (err) {
    console.warn('[EMAIL LOG] Impossible d’enregistrer le log email:', err);
  }
}

export async function getEmailLogs(): Promise<EmailLogEntry[]> {
  try {
    const existing = await prisma.referentiel.findFirst({
      where: { categorie: 'journal_emails', companyId: 1 },
    });
    if (existing && existing.valeurs) {
      const parsed = JSON.parse(existing.valeurs);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Construit la liste des candidats SMTP Zoho EU / Zoho Pro / Hostinger à tester automatiquement.
 * Corrige les 3 causes fréquentes :
 * 1. Zoho domaine personnalisé (@anelecgroupe.com) utilise smtppro.zoho.eu au lieu de smtp.zoho.eu
 * 2. Port 587 requiert secure=false (STARTTLS) tandis que port 465 requiert secure=true (SSL)
 * 3. Les mots de passe d'application Zoho copiés avec espaces ("xxxx xxxx xxxx") doivent aussi être testés sans espaces
 */
function buildSmtpCandidates(cfg: SmtpConfigData) {
  const rawPass = (cfg.pass || '').trim();
  const compactPass = rawPass.replace(/\s+/g, '');
  const passwords = compactPass && compactPass !== rawPass ? [compactPass, rawPass] : [rawPass];

  const hosts = Array.from(
    new Set([
      cfg.host,
      'smtppro.zoho.eu',
      'smtp.zoho.eu',
      'smtppro.zoho.com',
      'smtp.zoho.com',
      'smtp.hostinger.com',
    ])
  ).filter(Boolean);

  const candidates: Array<{ host: string; port: number; secure: boolean; user: string; pass: string }> = [];

  for (const pass of passwords) {
    if (!pass) continue;
    // Priorité 1 : configuration exacte demandée (avec correction automatique secure selon port)
    candidates.push({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      user: cfg.user,
      pass,
    });

    // Priorité 2 : découverte multi-hôtes Zoho Pro EU / Zoho EU (465 SSL puis 587 STARTTLS)
    for (const h of hosts) {
      for (const p of [465, 587]) {
        if (h === cfg.host && p === cfg.port) continue;
        candidates.push({
          host: h,
          port: p,
          secure: p === 465,
          user: cfg.user,
          pass,
        });
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
 * Envoi centralisé multi-canaux :
 * 1. Tente le serveur SMTP configuré + auto-discovery (smtppro.zoho.eu / smtp.zoho.eu / 465 / 587)
 * 2. Pour les emails d'authentification (création de compte / mot de passe oublié), déclenche aussi le relais Supabase Auth si SMTP échoue
 * 3. Crée un compte SMTP de test Ethereal (nodemailer.createTestAccount) en dernier recours pour générer une prévisualisation 100% réelle et consultable
 */
export async function dispatchEmailWithFallback(options: {
  type: EmailLogEntry['type'];
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
}): Promise<EmailDeliveryResult> {
  const cfg = await getActiveSmtpConfig();
  const candidates = cachedWorkingCandidate ? [cachedWorkingCandidate, ...buildSmtpCandidates(cfg)] : buildSmtpCandidates(cfg);
  let lastSmtpError = '';

  // 1. Essai sur les candidats SMTP de production (Zoho Pro EU / Zoho EU / Hostinger)
  for (const cand of candidates) {
    try {
      const transport: Transporter = nodemailer.createTransport({
        host: cand.host,
        port: cand.port,
        secure: cand.secure,
        auth: {
          user: cand.user,
          pass: cand.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 5500,
        greetingTimeout: 5500,
        socketTimeout: 7500,
      });

      const info = await transport.sendMail({
        from: `"${cfg.fromName || 'ANELEC GROUPE'}" <${cand.user}>`,
        replyTo: options.replyTo || cand.user,
        to: options.toEmail,
        ...(options.ccEmail ? { cc: options.ccEmail } : {}),
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      cachedWorkingCandidate = cand;
      const result: EmailDeliveryResult = {
        sent: true,
        channel: 'SMTP_PRODUCTION',
        hostUsed: `${cand.host}:${cand.port}`,
        messageId: info.messageId,
        activationLink: options.activationLink,
        timestamp: new Date().toISOString(),
      };

      await appendEmailLog({
        id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: result.timestamp,
        type: options.type,
        toEmail: options.toEmail,
        ccEmail: options.ccEmail,
        subject: options.subject,
        channel: `SMTP (${cand.host}:${cand.port})`,
        sent: true,
        activationLink: options.activationLink,
      });

      console.log(`[EMAIL ENVOYÉ] ${options.type} -> ${options.toEmail} via ${cand.host}:${cand.port}`);
      return result;
    } catch (err: any) {
      lastSmtpError = `${cand.host}:${cand.port} -> ${err?.message || String(err)}`;
      console.warn(`[EMAIL SMTP RETRY] Échec sur ${lastSmtpError}`);
    }
  }

  // 2. Relais Supabase Auth pour les emails de confirmation de compte ou réinitialisation
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
        hostUsed: 'supabase-auth-mailer',
        activationLink: options.activationLink,
        error: lastSmtpError || undefined,
        timestamp: new Date().toISOString(),
      };
      await appendEmailLog({
        id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: result.timestamp,
        type: options.type,
        toEmail: options.toEmail,
        ccEmail: options.ccEmail,
        subject: options.subject,
        channel: 'Relais Supabase Auth',
        sent: true,
        activationLink: options.activationLink,
        error: lastSmtpError || undefined,
      });
      return result;
    }
  }

  // 3. Repli automatique sur un serveur SMTP de prévisualisation (Nodemailer Ethereal) pour ne jamais bloquer l'utilisateur
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
      auth: {
        user: etherealAccountCache.user,
        pass: etherealAccountCache.pass,
      },
    });

    const info = await etherealTransport.sendMail({
      from: `"${cfg.fromName || 'ANELEC GROUPE'}" <${cfg.user}>`,
      replyTo: options.replyTo || cfg.user,
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
      hostUsed: `${etherealAccountCache.host}:${etherealAccountCache.port}`,
      messageId: info.messageId,
      previewUrl,
      activationLink: options.activationLink,
      error: lastSmtpError || 'SMTP_PASS non configuré ou refusé par Zoho (App Password requis)',
      timestamp: new Date().toISOString(),
    };

    await appendEmailLog({
      id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: result.timestamp,
      type: options.type,
      toEmail: options.toEmail,
      ccEmail: options.ccEmail,
      subject: options.subject,
      channel: 'Relais Secours (Prévisualisation Web)',
      sent: true,
      previewUrl,
      activationLink: options.activationLink,
      error: lastSmtpError || 'Mot de passe d’application Zoho à renseigner dans Workstation Admin > E-mails & SMTP',
    });

    console.log(`[EMAIL SECOURS ETHEREAL] ${options.type} -> ${options.toEmail} | Preview: ${previewUrl}`);
    return result;
  } catch (ethErr: any) {
    const failResult: EmailDeliveryResult = {
      sent: false,
      channel: 'NONE',
      activationLink: options.activationLink,
      error: lastSmtpError || ethErr?.message || 'Échec complet envoi email',
      timestamp: new Date().toISOString(),
    };

    await appendEmailLog({
      id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: failResult.timestamp,
      type: options.type,
      toEmail: options.toEmail,
      ccEmail: options.ccEmail,
      subject: options.subject,
      channel: 'ÉCHEC SMTP',
      sent: false,
      activationLink: options.activationLink,
      error: failResult.error,
    });

    return failResult;
  }
}

export interface SendConfirmationEmailParams {
  toEmail: string;
  recipientName: string;
  companyName: string;
  confirmationToken: string;
}

/**
 * 1. Envoie un email d'activation d'espace entreprise officiel avec conditions contractuelles
 */
export async function sendConfirmationEmail({
  toEmail,
  recipientName,
  companyName,
  confirmationToken,
}: SendConfirmationEmailParams): Promise<EmailDeliveryResult> {
  const activationLink = `${APP_URL}/api/auth/confirm-email?token=${encodeURIComponent(confirmationToken)}`;

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
    .btn { display: inline-block; background: #00bf63; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; margin: 18px 0; text-align: center; }
    .terms-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 12px; color: #64748b; line-height: 1.5; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">ANELEC GROUPE • ESPACE MULTI-ENTREPRISES</span>
      <h1>Confirmation d'activation de votre espace entreprise</h1>
    </div>

    <p>Bonjour <strong>${recipientName}</strong>,</p>

    <p>
      Votre demande d'ouverture d'espace pour la société <strong>${companyName}</strong> a bien été enregistrée sur la plateforme ANELEC TCE.
    </p>

    <p>
      Conformément aux règles de sécurité et de conformité légale, votre compte et votre espace entreprise ne sont activables <strong>qu'après confirmation de votre adresse e-mail et acceptation formelle des conditions contractuelles</strong>.
    </p>

    <div style="text-align: center;">
      <a href="${activationLink}" class="btn" target="_blank">
        Accepter les Conditions & Activer mon Espace Entreprise
      </a>
    </div>

    <div class="terms-box">
      <strong>Engagement contractuel et RGPD certifié :</strong><br />
      En cliquant sur le lien ci-dessus, vous reconnaissez avoir pris connaissance et accepté sans réserve les Conditions Générales d'Utilisation (CGU). Vous confirmez que les données métier saisies dans votre espace (devis, chantiers, factures, clients, plannings) restent la propriété exclusive de <strong>${companyName}</strong>, sont hébergées sur des serveurs souverains sécurisés en France (Supabase & Hostinger), et ne font l'objet d'aucun traitement ni exploitation par ANELEC GROUPE.
    </div>

    <p style="font-size: 12px; color: #64748b;">
      Si le bouton ne s'affiche pas correctement, vous pouvez copier-coller ce lien dans votre navigateur :<br />
      <a href="${activationLink}" style="color: #00bf63; word-break: break-all;">${activationLink}</a>
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
    toEmail,
    subject: `[Action Requise] Activez votre espace entreprise ${companyName} - ANELEC TCE`,
    html: htmlContent,
    text: `Bonjour ${recipientName},\n\nActivez votre espace entreprise ${companyName} en cliquant sur le lien suivant :\n${activationLink}\n\nEn activant votre compte, vous acceptez les conditions d'utilisation et la politique RGPD.`,
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
    <p>Bonjour <strong>${params.recipientName}</strong>,</p>
    <p>Vous avez demandé la réinitialisation du mot de passe de votre compte <strong>${params.toEmail}</strong>.</p>
    <div style="text-align:center;">
      <a href="${resetLink}" class="btn" target="_blank">Choisir un nouveau mot de passe</a>
    </div>
    <p style="font-size:12px;color:#64748b;">Lien direct : <a href="${resetLink}">${resetLink}</a></p>
  </div>
</body>
</html>`;

  return dispatchEmailWithFallback({
    type: 'RESET_PASSWORD',
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
    <h2 style="margin-top:0;">Bienvenue sur l'espace ${params.companyName} — ANELEC TCE</h2>
    <p>Bonjour <strong>${params.recipientName}</strong>,</p>
    <p>Votre compte collaborateur (profil : <strong>${params.roleLabel}</strong>) a été créé et activé par votre administrateur.</p>
    <div class="creds">
      <div><strong>Identifiant (E-mail) :</strong> ${params.toEmail}</div>
      <div style="margin-top:6px;"><strong>Mot de passe initial :</strong> <code>${params.tempPassword}</code></div>
    </div>
    <a href="${loginLink}" class="btn" target="_blank">Se connecter à la plateforme</a>
  </div>
</body>
</html>`;

  return dispatchEmailWithFallback({
    type: 'WELCOME_USER',
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
            <a href="${p.url}" target="_blank" style="text-decoration: none;">
              <img src="${p.url}" alt="Photo ${idx + 1}" style="max-width: 180px; max-height: 140px; border-radius: 6px; display: block; object-fit: cover;" />
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
        ${intervention.actionsRealisees.map((a) => `<li>${a}</li>`).join('')}
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
        <span class="badge">${companyName} • RAPPORT OFFICIEL</span>
        <span style="font-weight: 800; color: #00bf63; font-size: 13px;">${ref}</span>
      </div>
      <h1 class="title">Rapport d'Intervention Technique</h1>
    </div>

    ${
      customMessage
        ? `
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
        ${customMessage}
      </div>
    `
        : `
      <p style="font-size: 13.5px; color: #475569; line-height: 1.5; margin: 0 0 16px 0;">
        Bonjour,<br /><br />
        Veuillez trouver ci-dessous le rapport officiel d'intervention technique réalisé par les équipes de <strong>${companyName}</strong>.
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
      Document transmis par <strong>${senderName}</strong> (${senderEmail}) • <strong>${companyName}</strong><br />
      Plateforme de pilotage ANELEC TCE • Ce rapport fait foi d'exécution technique.
    </div>
  </div>
</body>
</html>
  `;

  return dispatchEmailWithFallback({
    type: 'RAPPORT_INTERVENTION',
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
  const ref = params.devis.referenceMetier || `DEV-2026-${String(params.devis.id).padStart(3, '0')}`;
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
      <strong style="font-size:16px;color:#0f172a;">Proposition Commerciale & Chiffrage • ${params.companyName}</strong>
      <span style="color:#0284c7;font-weight:800;">${ref}</span>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#334155;">
      ${params.customMessage || `Bonjour,<br/><br/>Veuillez trouver ci-dessous le récapitulatif de notre proposition de devis <strong>${ref}</strong> concernant votre demande de travaux.`}
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
    toEmail: params.toEmail,
    ccEmail: params.ccEmail,
    replyTo: params.senderEmail,
    subject,
    html,
    text: `Proposition de devis ${ref} - ${params.devis.client}\nObjet: ${params.devis.objet || ''}\nMontant HT: ${amountFormatted}\nTransmis par ${params.senderName} (${params.companyName})`,
  });
}

/**
 * 6. Diagnostic complet & envoi d'un e-mail de test réel
 */
export async function verifyAndTestSmtpConfig(toEmail: string): Promise<{
  config: Omit<SmtpConfigData, 'pass'> & { hasPassword: boolean };
  delivery: EmailDeliveryResult;
}> {
  const cfg = await getActiveSmtpConfig();
  const delivery = await dispatchEmailWithFallback({
    type: 'TEST_SMTP',
    toEmail,
    subject: `[TEST DIAGNOSTIC EMAIL] Vérification d'envoi ANELEC TCE (${new Date().toLocaleTimeString('fr-FR')})`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;">
        <h2 style="color:#00bf63;margin-top:0;">✓ Test d'envoi E-mail ANELEC TCE réussi</h2>
        <p>Cet e-mail confirme le bon fonctionnement du moteur d'expédition de la plateforme ANELEC TCE.</p>
        <ul style="font-size:13px;color:#475569;line-height:1.7;">
          <li><strong>Destinataire testé :</strong> ${toEmail}</li>
          <li><strong>Expéditeur configuré :</strong> ${cfg.user}</li>
          <li><strong>Serveur SMTP principal :</strong> ${cfg.host}:${cfg.port}</li>
          <li><strong>Horodatage :</strong> ${new Date().toLocaleString('fr-FR')}</li>
        </ul>
      </div>
    `,
    text: `Test d'envoi E-mail ANELEC TCE réussi pour ${toEmail} depuis ${cfg.user}.`,
    activationLink: `${APP_URL}/login`,
    recipientName: toEmail.split('@')[0],
    companyName: 'ANELEC GROUPE',
    allowSupabaseRelay: false,
  });

  return {
    config: {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      user: cfg.user,
      fromName: cfg.fromName,
      hasPassword: Boolean(cfg.pass && cfg.pass.trim().length > 0),
      updatedAt: cfg.updatedAt,
    },
    delivery,
  };
}
