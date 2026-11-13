// Un même e-mail, un compte PAR entreprise — vraies routes d'authentification et d'administration, base simulée.
// Lancer :  npm run test:roles
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createFakeDb } from './support/fakePrisma.js';

const db = createFakeDb();
(globalThis as any).__FAKE_PRISMA__ = db;

let server: http.Server;
let base = '';
let secret = '';
let tokenAdminA = '';

const PWD_A = 'Bleu-Horizon-4821!';
const PWD_B = 'Vert-Falaise-7305!';
const MAIL = 'marc@exemple.fr';
const A = { id: 1, name: 'Sirène Bâtiment', siren: '111222333', siret: '11122233300010' };
const B = { id: 2, name: 'Sirette Services', siren: '444555666', siret: null };

const compte = (id: number, company: typeof A, o: Record<string, any> = {}) => ({
  id, email: MAIL, password: '', name: `Marc ${company.name}`, role: 'ADMIN', technicienNom: null, permissionsJson: null,
  active: true, emailConfirmed: true, companyId: company.id, company, createdAt: new Date('2026-01-01'),
  confirmationToken: null, confirmationCode: null, confirmationCodeExpires: null, ...o,
});

before(async () => {
  const hashA = await bcrypt.hash(PWD_A, 4);
  const hashB = await bcrypt.hash(PWD_B, 4);
  db.company.seed([{ ...A, active: true }, { ...B, active: true }, { id: 3, name: 'Autre SAS', siren: '777888999', active: true }]);
  db.user.seed([
    compte(10, A, { password: hashA }),
    compte(20, B, { password: hashB }),
    // adresse présente dans UNE seule entreprise
    { ...compte(30, { id: 3, name: 'Autre SAS', siren: '777888999', siret: null }, { password: hashA }), email: 'seule@exemple.fr' },
  ]);

  const { config } = await import('../server/config.js');
  secret = config.jwtSecret;
  const { errorHandler } = await import('../server/middleware/errorHandler.js');
  const { authRouter } = await import('../server/routes/auth.js');
  const { adminRouter } = await import('../server/routes/admin.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  tokenAdminA = jwt.sign({ userId: 10, email: MAIL, role: 'ADMIN', companyId: A.id }, config.jwtSecret, { expiresIn: '1h' });
  const app = express();
  app.use(express.json());
  app.use(cookieParser(config.cookieSecret));
  app.use('/api/auth', authRouter);
  app.use('/api/admin', authMiddleware, adminRouter);
  app.use(errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server?.close());

async function post(path: string, body: unknown) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let json: any = null;
  try { json = await res.json(); } catch { /* vide */ }
  return { status: res.status, json };
}

test('même e-mail, deux mots de passe différents : le mot de passe ouvre le bon compte', async () => {
  const a = await post('/api/auth/login', { email: MAIL, password: PWD_A });
  assert.equal(a.status, 200);
  assert.equal(a.json.user.companyId, A.id);
  assert.equal(a.json.user.companyName, A.name);
  const b = await post('/api/auth/login', { email: MAIL.toUpperCase(), password: PWD_B });
  assert.equal(b.status, 200, 'la casse de l’e-mail est indifférente');
  assert.equal(b.json.user.companyId, B.id);
  // le jeton porte l'entreprise du compte ouvert : jamais l'autre
  const payload: any = jwt.verify(a.json.accessToken, secret);
  assert.equal(payload.companyId, A.id);
  assert.equal(payload.userId, 10);
});

test('mauvais mot de passe : 401 générique, sans rien révéler des entreprises', async () => {
  const r = await post('/api/auth/login', { email: MAIL, password: 'Mauvais-Mot-2Passe!' });
  assert.equal(r.status, 401);
  assert.equal(r.json.code, 'INVALID_CREDENTIALS');
  assert.ok(!JSON.stringify(r.json).includes(A.name) && !JSON.stringify(r.json).includes(B.name));
  const inconnu = await post('/api/auth/login', { email: 'inconnu@exemple.fr', password: PWD_A });
  assert.equal(inconnu.status, 401);
  assert.equal(inconnu.json.error, r.json.error, 'même message que l’e-mail soit connu ou non');
});

test('même mot de passe dans deux entreprises : on demande laquelle (nom + SIREN), puis on ouvre la bonne', async () => {
  const hash = await bcrypt.hash(PWD_A, 4);
  db.user.rows.find((u: any) => u.id === 20).password = hash; // B adopte le mot de passe de A
  try {
    const choix = await post('/api/auth/login', { email: MAIL, password: PWD_A });
    assert.equal(choix.status, 409);
    assert.equal(choix.json.code, 'COMPANY_CHOICE_REQUIRED');
    const liste = choix.json.details.entreprises;
    assert.deepEqual(liste.map((e: any) => [e.companyId, e.nom, e.siren]), [[1, A.name, A.siren], [2, B.name, B.siren]]);
    assert.ok(!('accessToken' in choix.json), 'aucune session avant le choix');

    const b = await post('/api/auth/login', { email: MAIL, password: PWD_A, companyId: B.id });
    assert.equal(b.status, 200);
    assert.equal(b.json.user.companyId, B.id);
    assert.equal(b.json.user.id, 20);

    // l'entreprise choisie ne peut pas servir à entrer dans une entreprise où le compte n'existe pas
    const intrus = await post('/api/auth/login', { email: MAIL, password: PWD_A, companyId: 3 });
    assert.equal(intrus.status, 401);
  } finally {
    db.user.rows.find((u: any) => u.id === 20).password = await bcrypt.hash(PWD_B, 4);
  }
});

test('le choix d’entreprise n’est jamais proposé sans mot de passe valide', async () => {
  const r = await post('/api/auth/login', { email: MAIL, password: 'Mauvais-Mot-2Passe!', companyId: A.id });
  assert.equal(r.status, 401);
  assert.equal(r.json.details, undefined);
});

test('compte désactivé ou en attente dans UNE entreprise : l’autre reste utilisable', async () => {
  const ligneB = db.user.rows.find((u: any) => u.id === 20);
  ligneB.active = false;
  try {
    assert.equal((await post('/api/auth/login', { email: MAIL, password: PWD_B })).json.code, 'ACCOUNT_DISABLED');
    assert.equal((await post('/api/auth/login', { email: MAIL, password: PWD_A })).status, 200);
  } finally {
    ligneB.active = true;
  }
});

test('code de confirmation : le code désigne le compte (entreprise) à activer', async () => {
  const lA = db.user.rows.find((u: any) => u.id === 10);
  const lB = db.user.rows.find((u: any) => u.id === 20);
  Object.assign(lA, { emailConfirmed: false, active: false, confirmationCode: '111111', confirmationCodeExpires: new Date(Date.now() + 60000) });
  Object.assign(lB, { emailConfirmed: false, active: false, confirmationCode: '222222', confirmationCodeExpires: new Date(Date.now() + 60000) });
  const mauvais = await post('/api/auth/verify-code', { email: MAIL, code: '999999' });
  assert.equal(mauvais.status, 403);
  const ok = await post('/api/auth/verify-code', { email: MAIL, code: '222222' });
  assert.equal(ok.status, 200);
  assert.equal(lB.emailConfirmed, true);
  assert.equal(lA.emailConfirmed, false, 'l’autre entreprise reste en attente de SON code');
  assert.equal(lA.active, false);
  const jeton: any = jwt.verify(ok.json.accessToken, secret);
  assert.equal(jeton.companyId, B.id);
  Object.assign(lA, { emailConfirmed: true, active: true, confirmationCode: null });
});

test('mot de passe oublié : un lien PAR entreprise, le mot de passe d’une entreprise ne touche pas l’autre', async () => {
  const r = await post('/api/auth/forgot-password', { email: MAIL });
  assert.equal(r.status, 200);
  const lA = db.user.rows.find((u: any) => u.id === 10);
  const lB = db.user.rows.find((u: any) => u.id === 20);
  assert.ok(lA.confirmationToken && lB.confirmationToken);
  assert.notEqual(lA.confirmationToken, lB.confirmationToken);

  const NOUVEAU = 'Rouge-Colline-9917!';
  const reset = await post('/api/auth/reset-password', { token: lB.confirmationToken, password: NOUVEAU });
  assert.equal(reset.status, 200);
  assert.equal(reset.json.user.companyId, B.id);
  assert.equal((await post('/api/auth/login', { email: MAIL, password: NOUVEAU })).json.user.companyId, B.id);
  assert.equal((await post('/api/auth/login', { email: MAIL, password: PWD_A })).json.user.companyId, A.id, 'mot de passe de A inchangé');
});

test('e-mail inconnu au mot de passe oublié : même réponse (pas d’énumération)', async () => {
  const connu = await post('/api/auth/forgot-password', { email: 'seule@exemple.fr' });
  const inconnu = await post('/api/auth/forgot-password', { email: 'personne@exemple.fr' });
  assert.equal(connu.status, 200);
  assert.equal(inconnu.status, 200);
  assert.equal(connu.json.message.replace('seule', 'x'), inconnu.json.message.replace('personne', 'x'));
});

const hashJeton = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
function inviter(id: number, email: string, jeton: string) {
  db.companyInvitation.rows.push({
    id, companyId: A.id, email, role: 'CONDUCTEUR_TRAVAUX', technicienNom: null, permissionsJson: null,
    tokenHash: hashJeton(jeton), acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 86400000),
    invitedByName: 'Direction', company: { id: A.id, name: A.name, active: true },
  });
}

test('invitation : un compte dans une AUTRE entreprise n’empêche pas de rejoindre celle-ci (compte distinct)', async () => {
  const jeton = 'jeton-invitation-sirene-0123456789';
  inviter(1, 'seule@exemple.fr', jeton);
  const r = await post('/api/auth/invitations/accept', { token: jeton, name: 'Seule Sirène', password: 'Orange-Rivage-6642!', acceptTerms: true });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.user.companyId, A.id);
  assert.notEqual(r.json.user.id, 30, 'nouveau compte, pas celui de l’autre entreprise');
  const comptes = db.user.rows.filter((u: any) => u.email === 'seule@exemple.fr');
  assert.deepEqual(comptes.map((u: any) => u.companyId).sort(), [A.id, 3]);
  // chaque compte garde son propre mot de passe
  const autre = await post('/api/auth/login', { email: 'seule@exemple.fr', password: 'Orange-Rivage-6642!', companyId: 3 });
  assert.equal(autre.status, 401);
  assert.equal((await post('/api/auth/login', { email: 'seule@exemple.fr', password: PWD_A })).json.user.companyId, 3);
  assert.equal((await post('/api/auth/login', { email: 'seule@exemple.fr', password: 'Orange-Rivage-6642!' })).json.user.companyId, A.id);
  // le lien est à usage unique
  assert.equal((await post('/api/auth/invitations/accept', { token: jeton, name: 'X', password: 'Orange-Rivage-6642!', acceptTerms: true })).status, 404);
});

test('invitation : doublon dans la MÊME entreprise refusé, avec le nom de l’entreprise', async () => {
  const jeton = 'jeton-invitation-doublon-9876543210';
  inviter(2, MAIL, jeton);
  const r = await post('/api/auth/invitations/accept', { token: jeton, name: 'Marc', password: 'Orange-Rivage-6642!', acceptTerms: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'EMAIL_EXISTS');
  assert.ok(r.json.error.includes(A.name));
});

test('administration : création d’utilisateur — doublon refusé seulement dans SA entreprise', async () => {
  const call = (body: unknown) => fetch(base + '/api/admin/users', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenAdminA}` }, body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, json: await res.json().catch(() => null) }));
  const memeEntreprise = await call({ email: MAIL, name: 'Doublon', password: 'Jaune-Sommet-3358!', role: 'TECHNICIEN' });
  assert.equal(memeEntreprise.status, 409);
  assert.equal(memeEntreprise.json.code, 'EMAIL_EXISTS');
  const autreEntreprise = await call({ email: 'tech@exemple.fr', name: 'Tech', password: 'Jaune-Sommet-3358!', role: 'TECHNICIEN' });
  assert.equal(autreEntreprise.status, 201, JSON.stringify(autreEntreprise.json));
  // « seule@exemple.fr » existe déjà dans l'entreprise 3 ET (via l'invitation ci-dessus) dans A : doublon dans A
  const dejaDansA = await call({ email: 'seule@exemple.fr', name: 'Seule', password: 'Jaune-Sommet-3358!', role: 'TECHNICIEN' });
  assert.equal(dejaDansA.status, 409);
});

test('administration : la liste des utilisateurs ne montre jamais les comptes d’une autre entreprise', async () => {
  const res = await fetch(base + '/api/admin/users', { headers: { authorization: `Bearer ${tokenAdminA}` } });
  assert.equal(res.status, 200);
  const j: any = await res.json();
  assert.ok(j.data.length > 0);
  for (const u of j.data) assert.equal(u.companyId, A.id, `utilisateur ${u.id} d'une autre entreprise`);
  assert.ok(!j.data.some((u: any) => u.id === 20), 'le compte du même e-mail dans l’entreprise B est invisible');
});
