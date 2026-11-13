// Contenu de l'e-mail d'invitation : fonction pure (testable sans base de données ni SMTP).
import { ACCOUNT_RULES_TEXT, PASSWORD_RULES_TEXT } from '../../shared/passwordPolicy.js';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface InvitationEmailParams {
  companyName: string;
  inviterName: string;
  roleLabel: string;
  inviteLink: string;
  expiresAt: Date;
}

export function buildInvitationEmail(params: InvitationEmailParams): { subject: string; html: string; text: string } {
  const expires = params.expiresAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const company = esc(params.companyName);
  const rulesHtml = ACCOUNT_RULES_TEXT.map((r) => `<li style="margin-bottom:4px;">${esc(r)}</li>`).join('');
  const passwordRulesHtml = PASSWORD_RULES_TEXT.map((r) => `<li style="margin-bottom:4px;">${esc(r)}</li>`).join('');
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
    <p style="font-size:13px;">Cet accès est propre à l'entreprise <strong>${company}</strong>. Si vous utilisez déjà cette adresse e-mail dans une autre entreprise, ce compte-là reste distinct : mot de passe séparé et données séparées. À la connexion, vous choisirez l'entreprise.</p>
    <div style="text-align:center;">
      <a href="${esc(params.inviteLink)}" class="btn" target="_blank">Accepter l'invitation et créer mon accès</a>
    </div>
    <div style="margin:18px 0 6px 0;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
      <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#0f172a;">Règles que vous acceptez en créant votre accès</p>
      <ul style="margin:0 0 12px 0;padding-left:18px;font-size:12.5px;line-height:1.55;color:#475569;">${rulesHtml}</ul>
      <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#0f172a;">Règles pour choisir votre mot de passe</p>
      <ul style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.55;color:#475569;">${passwordRulesHtml}</ul>
      <p style="margin:12px 0 0 0;font-size:11.5px;color:#64748b;">En cliquant sur « Accepter l'invitation » puis en cochant la case d'acceptation, vous confirmez avoir pris connaissance de ces règles, des Conditions Générales d'Utilisation et de la politique de protection des données.</p>
    </div>
    <p style="font-size:12px;color:#64748b;">Ce lien est personnel, à usage unique, et valable jusqu'au ${esc(expires)}.<br />
    Si le bouton ne fonctionne pas : <a href="${esc(params.inviteLink)}" style="color:#00bf63;word-break:break-all;">${esc(params.inviteLink)}</a></p>
    <p style="font-size:11px;color:#94a3b8;">Vous n'attendiez pas cette invitation ? Ignorez simplement ce message, aucun compte ne sera créé.</p>
  </div>
</body>
</html>`;

  const text = [
      `${params.inviterName} vous invite à rejoindre l'espace ${params.companyName} (profil : ${params.roleLabel}).`,
      `Cet accès est propre à l'entreprise ${params.companyName}. Si vous utilisez déjà cette adresse e-mail dans une autre entreprise, ce compte-là reste distinct (mot de passe et données séparés) ; à la connexion, vous choisirez l'entreprise.`,
      `Accepter l'invitation : ${params.inviteLink}`,
      `Lien personnel valable jusqu'au ${expires}.`,
      '',
      'RÈGLES QUE VOUS ACCEPTEZ EN CRÉANT VOTRE ACCÈS',
      ...ACCOUNT_RULES_TEXT.map((r) => `- ${r}`),
      '',
      'RÈGLES POUR CHOISIR VOTRE MOT DE PASSE',
      ...PASSWORD_RULES_TEXT.map((r) => `- ${r}`),
      '',
      "En créant votre accès, vous confirmez avoir pris connaissance de ces règles, des Conditions Générales d'Utilisation et de la politique de protection des données.",
    ].join('\n');
  return { subject: `Invitation à rejoindre ${params.companyName} sur ANELEC TCE`, html, text };
}
