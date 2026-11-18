// Tests de régression Lot P1 : séparation access/refresh, révocation tokenVersion + Socket.IO,
// protection OTP, confusion de jetons, auto-réactivation désactivée, Google ya29 aud, Supabase email_confirmed_at,
// squat /register, permissionsJson/rôles legacy fail-closed, anti-usurpation créateur et TOCTOU invitations.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { createFakeDb } from './support/fakePrisma.js';

const db = createFakeDb();
(globalThis as any).__FAKE_PRISMA__ = db;

let httpServer: http.Server;
let ioServer: Server;
let base = '';
let configObj: typeof import('../server/config.js').config;
let accessForFn: typeof import('../server/lib/access.js').accessFor;
let getEffectivePermsFn: typeof import('../shared/types.js').getEffectivePermissions;
let isCreatorFn: typeof import('../shared/types.js').isPlatformCreatorIdentity;
let canFn: typeof import('../server/lib/policy.js').can;

const PW = 'Verger-Cobalt-7913!';
const PW_HASH = bcrypt.hashSync(PW, 4);

before(async () => {
  db.company.seed([
    { id: 1, name: 'Société Active', siret: '11111111100011', siren: '111111111', active: true },
    { id: 2, name: 'Société Inactive', siret: '22222222200012', siren: '222222222', active: false },
  ]);
  db.user.seed([
    {
      id: 1,
      companyId: 1,
      email: 'louzza.zehair@gmail.com',
      phone: '+33628618628',
      name: 'Zehair Louzza',
      role: 'ADMIN',
      active: true,
      emailConfirmed: true,
      tokenVersion: 1,
      password: PW_HASH,
      permissionsJson: null,
    },
    {
      id: 2,
      companyId: 1,
      email: 'actif@alpha.fr',
      name: 'Actif Alpha',
      role: 'ADMIN',
      active: true,
      emailConfirmed: true,
      tokenVersion: 1,
      password: PW_HASH,
      permissionsJson: null,
    },
    {
      id: 3,
      companyId: 1,
      email: 'disabled@alpha.fr',
      name: 'Désactivé Alpha',
      role: 'CONDUCTEUR_TRAVAUX',
      active: false,
      emailConfirmed: true,
      tokenVersion: 1,
      password: PW_HASH,
      permissionsJson: null,
    },
    {
      id: 4,
      companyId: 2,
      email: 'user@inactive-co.fr',
      name: 'Inactif Co',
      role: 'ADMIN',
      active: true,
      emailConfirmed: true,
      tokenVersion: 1,
      password: PW_HASH,
      permissionsJson: null,
    },
    {
      id: 5,
      companyId: 1,
      email: 'tech1@alpha.fr',
      name: 'Karim Benz',
      technicienNom: 'Karim',
      role: 'TECHNICIEN',
      active: true,
      emailConfirmed: true,
      tokenVersion: 1,
      password: PW_HASH,
      permissionsJson: null,
    },
    {
      id: 6,
      companyId: 1,
      email: 'legacy@alpha.fr',
      name: 'Legacy User',
      role: 'USER',
      active: true,
      emailConfirmed: true,
      tokenVersion: 1,
      password: PW_HASH,
      permissionsJson: JSON.stringify({ canManageUsers: true }),
    },
  ]);

  const cfgMod = await import('../server/config.js');
  configObj = cfgMod.config;
  const accessMod = await import('../server/lib/access.js');
  accessForFn = accessMod.accessFor;
  const typesMod = await import('../shared/types.js');
  getEffectivePermsFn = typesMod.getEffectivePermissions;
  isCreatorFn = typesMod.isPlatformCreatorIdentity;
  const policyMod = await import('../server/lib/policy.js');
  canFn = policyMod.can;

  const { authRouter } = await import('../server/routes/auth.js');
  const { adminRouter } = await import('../server/routes/admin.js');
  const { devisRouter } = await import('../server/routes/devis.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const { errorHandler } = await import('../server/middleware/errorHandler.js');
  const { setupSocketHandlers } = await import('../server/socket/index.js');

  const app = express();
  app.use(express.json());
  app.use(cookieParser(configObj.cookieSecret));
  app.use('/api/auth', authRouter);
  app.use('/api/admin', authMiddleware, adminRouter);
  app.use('/api/devis', authMiddleware, devisRouter);
  app.use(errorHandler);

  httpServer = http.createServer(app);
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  setupSocketHandlers(ioServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

after(async () => {
  await ioServer?.close();
  httpServer?.close();
});

async function reqApi(method: string, urlPath: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + urlPath, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return {
    status: res.status,
    json,
    text,
    headers: res.headers,
    setCookies: res.headers.getSetCookie ? res.headers.getSetCookie() : [],
  };
}

function extractCookies(setCookies: string[]): string {
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

test('P1-1: refresh token rejeté sur les routes API et access token rejeté sur /refresh', async () => {
  const login = await reqApi('POST', '/api/auth/login', { email: 'actif@alpha.fr', password: PW });
  assert.equal(login.status, 200);
  const accessToken = login.json.accessToken;
  const cookieHeader = extractCookies(login.setCookies);
  const refreshMatch = cookieHeader.match(/refreshToken=([^;]+)/);
  assert.ok(refreshMatch);
  const refreshToken = refreshMatch![1];

  // Refresh token en Bearer sur /api/devis et /api/auth/me -> 401 INVALID_TOKEN_TYPE
  const apiWithRefresh = await reqApi('GET', '/api/devis', undefined, { authorization: `Bearer ${refreshToken}` });
  assert.equal(apiWithRefresh.status, 401);
  assert.equal(apiWithRefresh.json?.code, 'INVALID_TOKEN_TYPE');

  const meWithRefresh = await reqApi('GET', '/api/auth/me', undefined, { authorization: `Bearer ${refreshToken}` });
  assert.equal(meWithRefresh.status, 401);

  // Access token envoyé comme cookie refreshToken sur /api/auth/refresh -> 401 INVALID_REFRESH_TOKEN
  const refreshWithAccess = await reqApi('POST', '/api/auth/refresh', {}, { cookie: `refreshToken=${accessToken}` });
  assert.equal(refreshWithAccess.status, 401);
  assert.equal(refreshWithAccess.json?.code, 'INVALID_REFRESH_TOKEN');
});

test('P1-2: logout et reset-password révoquent accessToken, refreshToken et sockets actifs', async () => {
  const login = await reqApi('POST', '/api/auth/login', { email: 'actif@alpha.fr', password: PW });
  assert.equal(login.status, 200);
  const accessToken1 = login.json.accessToken;
  const cookies1 = extractCookies(login.setCookies);

  // Connexion Socket.IO avec le jeton actif
  const sock: ClientSocket = await new Promise((resolve, reject) => {
    const c = connectClient(base, { auth: { token: accessToken1 }, transports: ['websocket'], reconnection: false });
    c.on('connect', () => resolve(c));
    c.on('connect_error', reject);
  });
  const disconnected = new Promise<void>((resolve) => sock.on('disconnect', () => resolve()));

  // Logout révoque tokenVersion et déconnecte la socket
  const out = await reqApi('POST', '/api/auth/logout', {}, { authorization: `Bearer ${accessToken1}`, cookie: cookies1 });
  assert.equal(out.status, 200);
  await disconnected;

  // Replay post-logout bloqué sur /me, /devis et /refresh
  assert.equal((await reqApi('GET', '/api/auth/me', undefined, { authorization: `Bearer ${accessToken1}` })).status, 401);
  assert.equal((await reqApi('GET', '/api/devis', undefined, { authorization: `Bearer ${accessToken1}` })).status, 401);
  assert.equal((await reqApi('POST', '/api/auth/refresh', {}, { cookie: cookies1 })).status, 401);

  // Vérification Socket.IO handshake rejeté avec un refreshToken ou token révoqué
  await assert.rejects(
    new Promise((resolve, reject) => {
      const c = connectClient(base, { auth: { token: accessToken1 }, transports: ['websocket'], reconnection: false });
      c.on('connect', () => resolve(c));
      c.on('connect_error', reject);
    })
  );

  // Re-login puis reset-password doit également invalider les anciens jetons
  const login2 = await reqApi('POST', '/api/auth/login', { email: 'actif@alpha.fr', password: PW });
  const tokenBeforeReset = login2.json.accessToken;
  const cookiesBeforeReset = extractCookies(login2.setCookies);

  await reqApi('POST', '/api/auth/forgot-password', { email: 'actif@alpha.fr' });
  const userRow = db.user.rows.find((u: any) => u.id === 2);
  const newPw = 'Riviere-Cuivre-4826!';
  const reset = await reqApi('POST', '/api/auth/reset-password', { token: userRow.confirmationToken, password: newPw });
  assert.equal(reset.status, 200);

  // L'ancien token (y compris avant le reset) et l'ancien refresh sont rejetés (401 SESSION_REVOKED)
  assert.equal((await reqApi('GET', '/api/auth/me', undefined, { authorization: `Bearer ${tokenBeforeReset}` })).status, 401);
  assert.equal((await reqApi('POST', '/api/auth/refresh', {}, { cookie: cookiesBeforeReset })).status, 401);

  // Remettre le mot de passe initial pour la suite des tests si besoin
  userRow.password = PW_HASH;
});

test('P1-3: compte ou entreprise désactivé bloqué partout (login, refresh, reset-password, confirm-email, socket)', async () => {
  // Entreprise désactivée (user 4, company 2)
  assert.equal((await reqApi('POST', '/api/auth/login', { email: 'user@inactive-co.fr', password: PW })).status, 403);
  const forgedTokenCo2 = jwt.sign({ userId: 4, email: 'user@inactive-co.fr', role: 'ADMIN', companyId: 2, type: 'access', sv: 1 }, configObj.jwtSecret, { expiresIn: '1h' });
  assert.equal((await reqApi('GET', '/api/auth/me', undefined, { authorization: `Bearer ${forgedTokenCo2}` })).status, 403);

  // Compte désactivé (user 3) ne reçoit pas de reset token et ne peut pas réactiver via reset/confirm/refresh
  const forgotDisabled = await reqApi('POST', '/api/auth/forgot-password', { email: 'disabled@alpha.fr' });
  assert.equal(forgotDisabled.status, 200);
  const u3 = db.user.rows.find((u: any) => u.id === 3);
  assert.equal(u3.confirmationToken ?? null, null);

  u3.confirmationToken = 'b'.repeat(64);
  u3.confirmationSentAt = new Date();
  assert.equal((await reqApi('POST', '/api/auth/reset-password', { token: u3.confirmationToken, password: 'Other!StrongPass2026#' })).status, 403);
  assert.equal(u3.active, false);

  // confirm-email refuse un compte déjà emailConfirmed même avec token présent
  assert.equal((await reqApi('GET', `/api/auth/confirm-email?token=${u3.confirmationToken}`)).status, 404);
  assert.equal(u3.active, false);
  u3.confirmationToken = null;

  // refresh refusé pour compte désactivé
  const disabledRefresh = jwt.sign({ userId: 3, email: u3.email, role: u3.role, companyId: 1, type: 'refresh', sv: u3.tokenVersion || 1 }, configObj.jwtSecret, { expiresIn: '1h' });
  assert.equal((await reqApi('POST', '/api/auth/refresh', {}, { cookie: `refreshToken=${disabledRefresh}` })).status, 403);
});

test('P1-4: register valide avant écriture (anti-squat), masque activationLink, échappe confirm-email HTML et verrouille OTP après 5 essais', async () => {
  // Squat bloqué : mot de passe faible ne doit créer ni Company ni User
  const weak = await reqApi('POST', '/api/auth/register', {
    name: '<script>alert(1)</script>',
    email: 'squat@nouvelle-sec.fr',
    password: '123',
    companyName: 'NOUVELLE SEC <img src=x onerror=alert(1)>',
    siretOrSiren: '555666777',
  });
  assert.equal(weak.status, 400);
  assert.equal(db.company.rows.some((c: any) => c.siren === '555666777'), false);

  // Inscription valide immédiatement après sur le même nom/SIREN
  const reg = await reqApi('POST', '/api/auth/register', {
    name: '<script>alert(1)</script>',
    email: 'pending@nouvelle-sec.fr',
    password: PW,
    companyName: 'NOUVELLE SEC <script>xss</script>',
    siretOrSiren: '555666777',
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.activationLink, null);

  const pendingRow = db.user.rows.find((u: any) => u.email === 'pending@nouvelle-sec.fr');
  assert.ok(pendingRow?.confirmationToken);
  const activationToken = pendingRow.confirmationToken;

  // Un jeton d'activation ne peut JAMAIS servir à réinitialiser le mot de passe
  const resetWithAct = await reqApi('POST', '/api/auth/reset-password', { token: activationToken, password: 'Another!StrongPass2026#' });
  assert.equal(resetWithAct.status, 403);

  // 5 mauvais codes OTP -> 429 + invalidation du code en base
  for (let i = 1; i <= 4; i++) {
    const r = await reqApi('POST', '/api/auth/verify-code', { email: 'pending@nouvelle-sec.fr', code: '00000' + i });
    assert.equal(r.status, 403);
  }
  const fifth = await reqApi('POST', '/api/auth/verify-code', { email: 'pending@nouvelle-sec.fr', code: '000009' });
  assert.equal(fifth.status, 429);
  assert.equal(pendingRow.confirmationCode, null);

  // resend-confirmation régénère un code sans divulguer activationLink
  const resend = await reqApi('POST', '/api/auth/resend-confirmation', { email: 'pending@nouvelle-sec.fr' });
  assert.equal(resend.status, 200);
  assert.equal(resend.json.activationLink, null);

  // confirm-email échappe le HTML stocké dans name/companyName et applique no-store / no-referrer
  const confirmHtml = await reqApi('GET', `/api/auth/confirm-email?token=${encodeURIComponent(activationToken)}`);
  assert.equal(confirmHtml.status, 200);
  assert.equal(confirmHtml.text.includes('<script>'), false);
  assert.ok(confirmHtml.text.includes('&lt;script&gt;'));
  assert.equal(confirmHtml.headers.get('referrer-policy'), 'no-referrer');
});

test('P1-5: Google ya29.* aud check et /confirm-supabase-token (email_confirmed_at + anti-auto-login)', async () => {
  const realFetch = globalThis.fetch;
  try {
    // Intercepter uniquement les appels externes Google / Supabase (laisser http://127.0.0.1 passer)
    (globalThis as any).fetch = async (url: any, init?: any) => {
      const s = String(url);
      if (s.startsWith('https://www.googleapis.com/oauth2/v3/tokeninfo')) {
        if (s.includes('ya29.foreign-app')) {
          return new Response(JSON.stringify({ aud: 'other-attacker-client-id', email: 'actif@alpha.fr', email_verified: 'true' }), { status: 200 });
        }
        return new Response(JSON.stringify({ aud: process.env.GOOGLE_CLIENT_ID || '116679717813-chmnnnkeghjf6qs78qrts9m2o7dl4p20.apps.googleusercontent.com', email: 'louzza.zehair@gmail.com', email_verified: 'true' }), { status: 200 });
      }
      if (s.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
        return new Response(JSON.stringify({ email: 'louzza.zehair@gmail.com', email_verified: true, name: 'Zehair Louzza' }), { status: 200 });
      }
      if (s.endsWith('/auth/v1/user')) {
        const auth = String(init?.headers?.Authorization || '');
        if (auth.includes('unverified-supa')) {
          return new Response(JSON.stringify({ email: 'actif@alpha.fr', email_confirmed_at: null }), { status: 200 });
        }
        return new Response(JSON.stringify({ email: 'actif@alpha.fr', email_confirmed_at: '2026-11-18T10:00:00Z' }), { status: 200 });
      }
      return realFetch(url, init);
    };

    // ya29 d'une autre app -> 401
    const badGoogle = await reqApi('POST', '/api/auth/google', { credential: 'ya29.foreign-app-token' });
    assert.equal(badGoogle.status, 401);

    // Créateur désactivé en base ne doit PAS pouvoir se connecter via Google ou Login
    const creator = db.user.rows.find((u: any) => u.id === 1);
    creator.active = false;
    try {
      const disabledCreatorLogin = await reqApi('POST', '/api/auth/login', { email: 'louzza.zehair@gmail.com', password: PW });
      assert.equal(disabledCreatorLogin.status, 403);
      const disabledCreatorGoogle = await reqApi('POST', '/api/auth/google', { credential: 'ya29.valid-creator-token' });
      assert.equal(disabledCreatorGoogle.status, 403);
    } finally {
      creator.active = true;
    }

    // Supabase token non confirmé -> 403 SUPABASE_EMAIL_UNCONFIRMED
    process.env.SUPABASE_URL = 'https://mock.supabase.local';
    process.env.SUPABASE_ANON_KEY = 'mock-anon';
    const supaUnconfirmed = await reqApi('POST', '/api/auth/confirm-supabase-token', { accessToken: 'unverified-supa' });
    assert.equal(supaUnconfirmed.status, 403);
    assert.equal(supaUnconfirmed.json?.code, 'SUPABASE_EMAIL_UNCONFIRMED');

    // Supabase token sur compte déjà confirmé ne délivre plus de session -> 409 ALREADY_CONFIRMED
    const supaAlready = await reqApi('POST', '/api/auth/confirm-supabase-token', { accessToken: 'verified-supa' });
    assert.equal(supaAlready.status, 409);
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    globalThis.fetch = realFetch;
  }
});

test('P1-6: anti-usurpation téléphone Créateur, rôles legacy USER/VIEWER/PIRATE refusés par défaut et contrôle invitations', async () => {
  // Inscription d'un tiers utilisant le numéro du créateur -> ni isCreator ni élévation
  const regAttacker = await reqApi('POST', '/api/auth/register', {
    name: 'Usurpateur',
    email: 'attacker@evil.fr',
    phone: '+33628618628',
    password: PW,
    companyName: 'EVIL TELECOM',
    siretOrSiren: '777888999',
  });
  assert.equal(regAttacker.status, 201);
  const attackerRow = db.user.rows.find((u: any) => u.email === 'attacker@evil.fr');
  assert.equal(attackerRow.phone ?? null, null);
  assert.equal(isCreatorFn(attackerRow), false);
  assert.equal(isCreatorFn({ email: 'autre@entreprise.fr', phone: '+33628618628' }), false);

  // Rôles legacy USER, VIEWER, PIRATE refusés par défaut partout
  for (const r of ['USER', 'VIEWER', 'PIRATE', '']) {
    const perms = getEffectivePermsFn(r, JSON.stringify({ canManageUsers: true, canEditDevis: true }));
    assert.equal(Object.values(perms).some(Boolean), false);
    const acc = accessForFn({ id: 999, role: r, permissionsJson: JSON.stringify({ canManageUsers: true }) });
    assert.equal(acc.isKnownRole, false);
    assert.equal(acc.isAdmin, false);
    assert.equal(acc.isFieldOnly, true);
    assert.equal(canFn(acc, 'devis.list'), false);
    assert.equal(canFn(acc, 'devis.stats'), false);
    assert.equal(canFn(acc, 'interventions.list'), false);
    assert.equal(canFn(acc, 'referentiels.read'), false);
  }

  // Utilisateur USER en base bloqué sur /api/devis (403)
  const legacyLogin = await reqApi('POST', '/api/auth/login', { email: 'legacy@alpha.fr', password: PW });
  assert.equal(legacyLogin.status, 200);
  const legacyDevis = await reqApi('GET', '/api/devis', undefined, { authorization: `Bearer ${legacyLogin.json.accessToken}` });
  assert.equal(legacyDevis.status, 403);

  // Invitations : POST lookup avec en-têtes no-store/no-referrer, blocage rôle inconnu, plafonnement permissionsJson, anti-collision technicienNom
  const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

  const rawBadRole = 'inv-bad-role-token-0123456789';
  db.companyInvitation.rows.push({
    id: 501,
    companyId: 1,
    email: 'badrole@alpha.fr',
    role: 'INCONNU',
    technicienNom: null,
    permissionsJson: JSON.stringify({ canManageUsers: true }),
    tokenHash: hash(rawBadRole),
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86400_000),
    invitedByName: 'Admin',
    company: { id: 1, name: 'Société Active', active: true },
  });
  const badRoleAccept = await reqApi('POST', '/api/auth/invitations/accept', {
    token: rawBadRole,
    name: 'Test BadRole',
    password: PW,
    acceptTerms: true,
  });
  assert.equal(badRoleAccept.status, 404);

  const rawTechToken = 'inv-tech-collide-token-0123456789';
  db.companyInvitation.rows.push({
    id: 502,
    companyId: 1,
    email: 'newtech@alpha.fr',
    role: 'TECHNICIEN',
    technicienNom: null,
    permissionsJson: JSON.stringify({ canManageUsers: true, canManageBilling: true, canEditDevis: true }),
    tokenHash: hash(rawTechToken),
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86400_000),
    invitedByName: 'Admin',
    company: { id: 1, name: 'Société Active', active: true },
  });

  const lookupRes = await reqApi('POST', '/api/auth/invitations/lookup', { token: rawTechToken });
  assert.equal(lookupRes.status, 200);
  assert.match(lookupRes.headers.get('cache-control') || '', /no-store/);
  assert.equal(lookupRes.headers.get('referrer-policy'), 'no-referrer');
  assert.match(lookupRes.headers.get('x-robots-tag') || '', /noindex/);

  // Nom d'un seul caractère refusé pour TECHNICIEN sans technicienNom fixé
  const oneCharTech = await reqApi('POST', '/api/auth/invitations/accept', {
    token: rawTechToken,
    name: 'K',
    password: PW,
    acceptTerms: true,
  });
  assert.equal(oneCharTech.status, 400);

  // Collision exacte avec technicien existant ('Karim') refusée (409)
  const collideTech = await reqApi('POST', '/api/auth/invitations/accept', {
    token: rawTechToken,
    name: 'karim',
    password: PW,
    acceptTerms: true,
  });
  assert.equal(collideTech.status, 409);

  // Acceptation valide avec nom distinct -> permissions plafonnées au rôle TECHNICIEN
  const okTech = await reqApi('POST', '/api/auth/invitations/accept', {
    token: rawTechToken,
    name: 'Mehdi Tech',
    password: PW,
    acceptTerms: true,
  });
  assert.equal(okTech.status, 201);
  assert.equal(okTech.json.user.permissions.canManageUsers, false);
  assert.equal(okTech.json.user.permissions.canManageBilling, false);
  assert.equal(okTech.json.user.permissions.canEditDevis, false);
  assert.equal(okTech.json.user.technicienNom, 'Mehdi Tech');
});
