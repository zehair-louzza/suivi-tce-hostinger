// ----------------------------------------------------------------------------
// Super-administrateur de la plateforme
// ----------------------------------------------------------------------------
// Le super admin est le fondateur (utilisateur n° 1, ou le compte e-mail ci-dessous).
// Contrairement à un administrateur d'entreprise, qui ne gère QUE sa propre entreprise,
// le super admin peut consulter et modifier les réglages de TOUTES les entreprises.
//
// Une seule définition, utilisée partout côté serveur : ne pas dupliquer cette règle.

const SUPER_ADMIN_EMAILS = new Set(
  (process.env.SUPER_ADMIN_EMAILS || 'louzza.zehair@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isSuperAdminUser(u: { id: number; email: string }): boolean {
  return u.id === 1 || SUPER_ADMIN_EMAILS.has(u.email.toLowerCase());
}
