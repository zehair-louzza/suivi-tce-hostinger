// Politique de mot de passe UNIQUE, partagée par le serveur (contrôle réel) et les formulaires (aide à la saisie).
// Le serveur reste seul juge : ne jamais se fier au seul contrôle du navigateur.

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Règles affichées aux utilisateurs (formulaires, e-mails d'invitation). */
export const PASSWORD_RULES_TEXT: string[] = [
  `Au moins ${PASSWORD_MIN_LENGTH} caractères`,
  'Au moins une lettre majuscule et une lettre minuscule',
  'Au moins un chiffre',
  'Au moins un caractère spécial (par exemple ! ? @ # $ % & * - _ + =)',
  'Pas de suite de 3 caractères identiques (aaa, 111…) ni de suite évidente (abcd, 1234, azerty…)',
  'Ne doit contenir ni votre nom, ni votre adresse e-mail, ni un mot de passe courant (motdepasse, azerty, 123456…)',
  'Ne pas avoir d’espace au début ou à la fin',
];

const COMMON_FRAGMENTS = [
  'password', 'passw0rd', 'motdepasse', 'mdp', 'azerty', 'qwerty', 'qwertz', 'abcdef', 'admin', 'administrateur',
  'bienvenue', 'welcome', 'letmein', 'iloveyou', 'soleil', 'doudou', 'chocolat', 'football', 'marseille', 'anelec',
  'changeme', 'changez', 'temporaire', 'secret', '123456', '654321', '111111', '000000', '121212', '123123',
];

const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'azertyuiop', 'qsdfghjklm', 'wxcvbn',
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
];

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function hasSequence(pw: string, length = 4): boolean {
  const p = normalize(pw);
  for (const seq of SEQUENCES) {
    const reversed = [...seq].reverse().join('');
    for (let i = 0; i + length <= seq.length; i++) {
      const chunk = seq.slice(i, i + length);
      if (p.includes(chunk) || p.includes(reversed.slice(reversed.length - i - length, reversed.length - i))) return true;
    }
  }
  return false;
}

export interface PasswordContext {
  email?: string | null;
  name?: string | null;
  companyName?: string | null;
}

/** Retourne la liste des règles NON respectées (vide = mot de passe accepté). */
export function validatePassword(password: unknown, ctx: PasswordContext = {}): string[] {
  const pw = typeof password === 'string' ? password : '';
  const problems: string[] = [];

  if (pw.length < PASSWORD_MIN_LENGTH) problems.push(`Au moins ${PASSWORD_MIN_LENGTH} caractères`);
  if (pw.length > PASSWORD_MAX_LENGTH) problems.push(`Au plus ${PASSWORD_MAX_LENGTH} caractères`);
  if (!/[a-zà-ÿ]/.test(pw)) problems.push('Au moins une lettre minuscule');
  if (!/[A-ZÀ-Þ]/.test(pw)) problems.push('Au moins une lettre majuscule');
  if (!/[0-9]/.test(pw)) problems.push('Au moins un chiffre');
  if (!/[^A-Za-z0-9À-ÿ\s]/.test(pw)) problems.push('Au moins un caractère spécial (! ? @ # $ % & * - _ + =)');
  if (pw !== pw.trim()) problems.push('Pas d’espace au début ou à la fin');
  if (/(.)\1\1/.test(pw)) problems.push('Pas de suite de 3 caractères identiques');
  if (hasSequence(pw)) problems.push('Pas de suite évidente (abcd, 1234, azerty…)');
  if (new Set(pw).size < 8) problems.push('Utilisez davantage de caractères différents (8 distincts minimum)');

  const n = normalize(pw);
  if (COMMON_FRAGMENTS.some((f) => n.includes(f))) problems.push('Ne doit pas contenir un mot de passe ou un mot courant');

  const personal: string[] = [];
  const local = (ctx.email || '').split('@')[0];
  if (local) personal.push(local, ...local.split(/[._\-+]/));
  if (ctx.name) personal.push(...ctx.name.split(/\s+/));
  if (ctx.companyName) personal.push(...ctx.companyName.split(/\s+/));
  const personalHit = personal.map(normalize).some((t) => t.length >= 4 && n.includes(t));
  if (personalHit) problems.push('Ne doit pas contenir votre nom, votre e-mail ou le nom de l’entreprise');

  return problems;
}

/** Message unique pour une erreur de validation. */
export function passwordErrorMessage(problems: string[]): string {
  return `Mot de passe trop faible : ${problems.join(' ; ')}.`;
}

/** Génère un mot de passe aléatoire robuste qui respecte la politique (usage : comptes sans saisie, ex. Google). */
export function generateStrongPassword(randomInts: (n: number) => number[], length = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
  for (let attempt = 0; attempt < 50; attempt++) {
    const pw = randomInts(length).map((v) => alphabet[v % alphabet.length]).join('');
    if (validatePassword(pw).length === 0) return pw;
  }
  throw new Error('Impossible de générer un mot de passe conforme');
}

/**
 * Règles d'utilisation et de sécurité du compte, présentées dans l'e-mail d'invitation ET sur la page
 * d'acceptation : la personne invitée les accepte en créant son accès.
 */
export const ACCOUNT_RULES_TEXT: string[] = [
  'Votre accès est strictement personnel : ne communiquez jamais votre mot de passe et ne partagez pas votre compte.',
  'Vous n’accédez qu’aux données de votre entreprise, selon les droits liés à votre profil ; chaque entreprise est isolée des autres.',
  'Les données saisies appartiennent à votre entreprise, responsable de traitement ; la plateforme n’agit que comme sous-traitant technique (RGPD, art. 28).',
  'Vous vous engagez à n’utiliser ces données que dans le cadre de votre activité professionnelle et à ne pas les extraire ou les diffuser sans autorisation.',
  'En cas de perte, de vol ou de suspicion d’usage frauduleux de votre accès, changez votre mot de passe et prévenez votre administrateur sans délai.',
  'Vous disposez d’un droit d’accès, de rectification, de portabilité et d’effacement de vos données de connexion (RGPD, art. 15 à 22).',
];
