import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword, generateStrongPassword, PASSWORD_RULES_TEXT, ACCOUNT_RULES_TEXT } from '../shared/passwordPolicy.js';
import { assertStrongPassword } from '../server/lib/password.js';
import { buildInvitationEmail } from '../server/services/invitationEmail.js';
import crypto from 'node:crypto';

const ctx = { email: 'louzza.zehair@gmail.com', name: 'Zee Louzza', companyName: 'Dupont Elec' };

test('mots de passe faibles refusés', () => {
  const weak = ['court1A!', 'motdepasse123!A', 'Azerty123456!x', 'abcdEFGH1234!', 'Aaaa1111!!!!bbbb', 'Zehair-2024-Louzza!', 'sansChiffreNiSpecialXXXX', 'SANSMINUSCULE123!!', 'sansmajuscule123!!', 'Xk9!mQ2#vL7z ', 'Dupont-Elec-2026!x', 'Xyz9!4321dcbaQ'];
  for (const w of weak) assert.ok(validatePassword(w, ctx).length > 0, `devrait être refusé : ${w}`);
  assert.ok(validatePassword(undefined).length > 0);
  assert.ok(validatePassword('A1!' + 'x'.repeat(200)).length > 0);
});

test('mots de passe solides acceptés', () => {
  for (const ok of ['Tr0ub4dour&Cheval-Pile', 'k9#Vq2!xLm8@Rt4z', 'Mon-Chantier_Vert7!Pluie']) {
    assert.deepEqual(validatePassword(ok, ctx), [], ok);
  }
});

test('le générateur produit toujours un mot de passe conforme', () => {
  for (let i = 0; i < 200; i++) {
    const pw = generateStrongPassword((n) => Array.from(crypto.getRandomValues(new Uint32Array(n))), 32);
    assert.deepEqual(validatePassword(pw), []);
  }
});

test('le serveur refuse un mot de passe faible avec un code WEAK_PASSWORD', () => {
  assert.throws(() => assertStrongPassword('azerty123', ctx), (e: any) => e.statusCode === 400 && e.code === 'WEAK_PASSWORD' && /trop faible/.test(e.message));
  assert.equal(assertStrongPassword('k9#Vq2!xLm8@Rt4z', ctx), 'k9#Vq2!xLm8@Rt4z');
});

test("l'e-mail d'invitation contient les règles à accepter et les règles de mot de passe (HTML et texte)", () => {
  const mail = buildInvitationEmail({
    companyName: 'Dupont <b>Elec</b>',
    inviterName: 'Zee',
    roleLabel: 'Technicien',
    inviteLink: 'https://exemple.fr/invitation?token=abc',
    expiresAt: new Date('2026-11-20T00:00:00Z'),
  });
  assert.match(mail.html, /Règles que vous acceptez en créant votre accès/);
  assert.match(mail.html, /Règles pour choisir votre mot de passe/);
  assert.match(mail.text, /RÈGLES QUE VOUS ACCEPTEZ/);
  assert.match(mail.text, /RÈGLES POUR CHOISIR VOTRE MOT DE PASSE/);
  for (const rule of [...ACCOUNT_RULES_TEXT, ...PASSWORD_RULES_TEXT]) {
    assert.ok(mail.text.includes(rule), `texte : ${rule}`);
    assert.ok(mail.html.includes(rule.replace(/&/g, '&amp;').replace(/'/g, '&#39;')), `html : ${rule}`);
  }
  assert.ok(!mail.html.includes('<b>Elec</b>'), 'le nom de l’entreprise est échappé');
  assert.match(mail.html, /12 caractères/);
});
