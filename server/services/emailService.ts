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
 * Envoie le rapport officiel d'intervention par e-mail au donneur d'ordre ou client
 * Règle stricte : réservé à l'équipe bureau / administration (les techniciens ne peuvent pas envoyer par email).
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
}: SendInterventionReportEmailParams): Promise<boolean> {
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
        📸 Photos prises sur site (${intervention.photos.length})
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
      <p class="report-text">${intervention.rapportFinal || 'Travaux réalisés et vérifiés conformément aux normes de sécurité en vigueur.'}</p>
    </div>

    ${actionsHtml}
    ${photosHtml}

    <div class="footer">
      <strong>${companyName}</strong> • Service Conduite d'Activité & Rapports Techniques<br />
      Email expéditeur officiel : ${senderEmail} • Document officiel certifié conforme<br />
      Tous droits réservés © ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>
  `;

  try {
    if (!SMTP_PASS) {
      console.warn(
        `[EMAIL SIMULATION] SMTP_PASS non configuré. Rapport d'intervention ${ref} envoyé à : ${toEmail} (CC: ${ccEmail || 'aucun'}). Sujet: ${mailSubject}`
      );
      return true;
    }

    const t = getTransporter();
    await t.sendMail({
      from: `"${companyName}" <${SMTP_USER}>`,
      to: toEmail,
      cc: ccEmail ? ccEmail.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
      subject: mailSubject,
      html: htmlContent,
      text: `Rapport officiel d'intervention ${ref}\nClient : ${clientName}\nSite : ${site}\nDate : ${dateExecution}\n\nCompte rendu :\n${intervention.rapportFinal || 'Travaux réalisés avec succès.'}\n\nEnvoyé par ${senderName} (${companyName})`,
    });

    console.log(`[EMAIL ENVOYÉ] Rapport ${ref} envoyé avec succès à ${toEmail} depuis ${SMTP_USER}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERREUR] Échec d'envoi du rapport ${ref} à ${toEmail}:`, error);
    return false;
  }
}
