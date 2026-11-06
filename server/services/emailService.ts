import nodemailer, { Transporter } from 'nodemailer';

// Configuration SMTP Zoho Mail officielle pour zehair@anelecgroupe.com
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.zoho.eu';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'; // true pour SSL port 465
const SMTP_USER = process.env.SMTP_USER || 'zehair@anelecgroupe.com';
const SMTP_PASS = process.env.SMTP_PASS || '';
const APP_URL = process.env.APP_URL || 'https://suivi.anelecgroupe.com';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }
  return transporter;
}

export interface SendConfirmationEmailParams {
  toEmail: string;
  recipientName: string;
  companyName: string;
  confirmationToken: string;
}

/**
 * Envoie un email d'activation d'espace entreprise officiel avec conditions contractuelles
 */
export async function sendConfirmationEmail({
  toEmail,
  recipientName,
  companyName,
  confirmationToken,
}: SendConfirmationEmailParams): Promise<boolean> {
  const activationLink = `${APP_URL}/api/auth/confirm-email?token=${encodeURIComponent(
    confirmationToken
  )}`;

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

  try {
    if (!SMTP_PASS) {
      console.warn(
        `[EMAIL SIMULATION] SMTP_PASS non défini. Lien d'activation pour ${toEmail} : ${activationLink}`
      );
      return true;
    }

    const t = getTransporter();
    await t.sendMail({
      from: `"ANELEC GROUPE" <${SMTP_USER}>`,
      to: toEmail,
      subject: `[Action Requise] Activez votre espace entreprise ${companyName} - ANELEC TCE`,
      html: htmlContent,
      text: `Bonjour ${recipientName},\n\nActivez votre espace entreprise ${companyName} en cliquant sur le lien suivant :\n${activationLink}\n\nEn activant votre compte, vous acceptez les conditions d'utilisation et la politique RGPD. Vos données restent strictement privées et hébergées en France.`,
    });

    console.log(`[EMAIL ENVOYÉ] Email d'activation envoyé avec succès à ${toEmail} depuis ${SMTP_USER}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERREUR] Échec d'envoi d'e-mail à ${toEmail}:`, error);
    return false;
  }
}
