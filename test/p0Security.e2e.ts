// Tests de régression Lot P0 : isolation multi-tenant de convertKeepingQuote, oracle Créateur,
// suppression avec ConversionRequest (FK RESTRICT), garde-fous secrets/MAIL_SECRET_KEY, Supabase fail-closed et P2003.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { createFakeDb } from './support/fakePrisma.js';

const db = createFakeDb();
(globalThis as any).__FAKE_PRISMA__ = db;

let server: http.Server;
let base = '';
const tokens: Record<number, string> = {};
const emittedEvents: Array<{ room: string; event: string; payload: any }> = [];

let convertKeepingQuoteFn: typeof import('../server/services/linkedConversion.js').convertKeepingQuote;
let encryptSecretFn: typeof import('../server/lib/secretBox.js').encryptSecret;
let decryptSecretFn: typeof import('../server/lib/secretBox.js').decryptSecret;
let errorHandlerFn: typeof import('../server/middleware/errorHandler.js').errorHandler;
let configObj: typeof import('../server/config.js').config;

before(async () => {
  db.company.seed([
    { id: 1, name: 'Entreprise Alpha', active: true, siret: '111' },
    { id: 2, name: 'Entreprise Beta', active: true, siret: '222' },
  ]);
  db.user.seed([
    { id: 99, companyId: 1, email: 'louzza.zehair@gmail.com', phone: '+33628618628', name: 'Créateur', role: 'ADMIN', active: true, permissionsJson: null },
    { id: 101, companyId: 1, email: 'admin1@alpha.fr', name: 'Admin 1', role: 'ADMIN', active: true, permissionsJson: null },
    { id: 102, companyId: 1, email: 'user1@alpha.fr', name: 'User 1', role: 'USER', active: true, permissionsJson: null },
    { id: 104, companyId: 1, email: 'planif@alpha.fr', name: 'Planif 1', role: 'CONDUCTEUR_TRAVAUX', active: true, permissionsJson: JSON.stringify({ canViewFinancials: false }) },
    { id: 103, companyId: 1, email: 'inactive@alpha.fr', name: 'Inactif', role: 'ADMIN', active: false, permissionsJson: null },
    { id: 201, companyId: 2, email: 'admin2@beta.fr', name: 'Admin 2', role: 'ADMIN', active: true, permissionsJson: null, password: bcrypt.hashSync('DestroyPass!2026', 4) },
  ]);
  db.devis.seed([
    {
      id: 10,
      companyId: 1,
      userId: 102,
      referenceMetier: 'DEV-10',
      client: 'Client Alpha',
      objet: 'Tableau électrique Alpha',
      siteAdresse: '1 rue Alpha',
      corpsEtat: 'CFA',
      origine: 'DIRECT',
      priorite: 'Normale',
      statutCommercial: 'ACCEPTE',
      amount: 4200,
      notes: 'Note Alpha',
      numeroDI: 'DI-10',
      dateCreated: new Date('2026-11-01T00:00:00.000Z'),
    },
    {
      id: 20,
      companyId: 2,
      userId: 201,
      referenceMetier: 'DEV-20',
      client: 'Client Beta',
      objet: 'Tableau électrique Beta',
      siteAdresse: '2 rue Beta',
      corpsEtat: 'CFO',
      origine: 'DIRECT',
      priorite: 'Haute',
      statutCommercial: 'ACCEPTE',
      amount: 8800,
      notes: 'Note Beta',
      numeroDI: 'DI-20',
      dateCreated: new Date('2026-11-02T00:00:00.000Z'),
    },
  ]);

  const { setSocketInstance } = await import('../server/socket/index.js');
  const makeEmitter = (rooms: string[]) => ({
    to: (room: string) => makeEmitter([...rooms, room]),
    emit: (event: string, payload: any) => {
      for (const room of rooms) emittedEvents.push({ room, event, payload });
    },
  });
  setSocketInstance({
    to: (room: string) => makeEmitter([room]),
    emit() {},
  } as any);

  const cfgMod = await import('../server/config.js');
  configObj = cfgMod.config;
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const errMod = await import('../server/middleware/errorHandler.js');
  errorHandlerFn = errMod.errorHandler;
  const { devisRouter } = await import('../server/routes/devis.js');
  const { adminRouter } = await import('../server/routes/admin.js');
  const { authRouter } = await import('../server/routes/auth.js');
  const convMod = await import('../server/services/linkedConversion.js');
  convertKeepingQuoteFn = convMod.convertKeepingQuote;
  const boxMod = await import('../server/lib/secretBox.js');
  encryptSecretFn = boxMod.encryptSecret;
  decryptSecretFn = boxMod.decryptSecret;

  for (const u of db.user.rows) {
    tokens[u.id] = jwt.sign({ userId: u.id, email: u.email, role: u.role, companyId: u.companyId }, configObj.jwtSecret, { expiresIn: '1h' });
  }

  const app = express();
  app.use(express.json());
  app.use(cookieParser(configObj.cookieSecret));
  app.use('/api/auth', authRouter);
  app.use('/api/devis', authMiddleware, devisRouter);
  app.use('/api/admin', authMiddleware, adminRouter);
  app.use(errorHandlerFn);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server?.close());

async function api(as: number | null, method: string, urlPath: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + urlPath, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(as ? { authorization: `Bearer ${tokens[as]}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

test('P0-1: POST /api/devis/:id/convert avec Idempotency-Key bloque IDOR inter-entreprise et oracle 409', async () => {
  emittedEvents.length = 0;

  // Admin Alpha tente de convertir le devis de Beta -> 404 sans fuite ni création
  const crossProbe = await api(
    101,
    'POST',
    '/api/devis/20/convert',
    { datePlanifiee: '2026-12-01' },
    { 'Idempotency-Key': 'key-cross-probe-0001' }
  );
  assert.equal(crossProbe.status, 404);
  assert.equal(db.intervention.rows.length, 0);

  // Admin Alpha convertit légitimement le devis Alpha -> 201 et socket limité à company:1
  const ownConvert = await api(
    101,
    'POST',
    '/api/devis/10/convert',
    { datePlanifiee: '2026-12-01' },
    { 'Idempotency-Key': 'key-alpha-reuse-0002' }
  );
  assert.equal(ownConvert.status, 201);
  assert.equal(db.intervention.rows.length, 1);
  assert.ok(emittedEvents.some((e) => e.room === 'company:1' && e.event === 'intervention:created'));
  assert.equal(emittedEvents.some((e) => e.room === 'company:2'), false);

  // Réutilisation de la même clé sur devis de Beta -> 404 (pas d'oracle 409 IDEMPOTENCY_CONFLICT)
  const keyOracleProbe = await api(
    101,
    'POST',
    '/api/devis/20/convert',
    { datePlanifiee: '2026-12-02' },
    { 'Idempotency-Key': 'key-alpha-reuse-0002' }
  );
  assert.equal(keyOracleProbe.status, 404);

  // Appel direct du service par compte inactif -> 403
  await assert.rejects(
    () => convertKeepingQuoteFn(103, 10, { datePlanifiee: '2026-12-01' }, 'key-inactive-0003', 1),
    (err: any) => err?.statusCode === 403
  );

  // Appel direct du service sans expectedCompanyId sur devis d'une autre entreprise -> 404
  await assert.rejects(
    () => convertKeepingQuoteFn(101, 20, { datePlanifiee: '2026-12-01' }, 'key-direct-idor-0004'),
    (err: any) => err?.statusCode === 404
  );

  // Conducteur de travaux (canConvertDevis=true, canViewFinancials=false) -> montant masqué dans la réponse
  const noFin = await api(
    104,
    'POST',
    '/api/devis/10/convert',
    { datePlanifiee: '2026-12-03' },
    { 'Idempotency-Key': 'key-user-nofin-0005' }
  );
  assert.equal(noFin.status, 201);
  assert.equal(noFin.json?.data?.amount, null);
});

test('P0-2: DELETE /api/admin/users/:id supprime sans blocage FK et ferme l’oracle Créateur inter-entreprise', async () => {
  // Admin Beta (entreprise 2) ne doit pas recevoir le message spécial Créateur (400), mais 403 générique
  const foreignCreatorProbe = await api(201, 'DELETE', '/api/admin/users/99');
  assert.equal(foreignCreatorProbe.status, 403);

  // Admin Alpha (même entreprise) conserve le blocage métier Créateur (400)
  const sameCompanyCreator = await api(101, 'DELETE', '/api/admin/users/99');
  assert.equal(sameCompanyCreator.status, 400);

  // Suppression d'un utilisateur avec ConversionRequest pointant sur ses interventions (userId=102) et d'un acteur (actorId=104)
  assert.ok(db.conversionRequest.rows.some((r: any) => r.actorId === 104));
  const delActor = await api(101, 'DELETE', '/api/admin/users/104');
  assert.equal(delActor.status, 200);
  assert.equal(db.user.rows.some((u: any) => u.id === 104), false);
  assert.equal(db.conversionRequest.rows.some((r: any) => r.actorId === 104), false);

  const delOwner = await api(101, 'DELETE', '/api/admin/users/102');
  assert.equal(delOwner.status, 200);
  assert.equal(db.user.rows.some((u: any) => u.id === 102), false);
  assert.equal(db.conversionRequest.rows.some((r: any) => r.actorId === 101), false);
});

test('P0-3: DELETE /api/admin/company/destroy nettoie les ConversionRequest avant de supprimer interventions/utilisateurs', async () => {
  // Créer une conversion côté Entreprise Beta
  const convBeta = await api(
    201,
    'POST',
    '/api/devis/20/convert',
    { datePlanifiee: '2026-12-10' },
    { 'Idempotency-Key': 'key-beta-destroy-0006' }
  );
  assert.equal(convBeta.status, 201);
  assert.ok(db.conversionRequest.rows.some((r: any) => r.actorId === 201));

  const destroy = await api(201, 'DELETE', '/api/admin/company/destroy', { password: 'DestroyPass!2026' });
  assert.equal(destroy.status, 200);
  assert.equal(db.company.rows.some((c: any) => c.id === 2), false);
  assert.equal(db.conversionRequest.rows.some((r: any) => r.actorId === 201), false);
});

test('P0-4: secretBox impose MAIL_SECRET_KEY en production et préserve le déchiffrement hérité', () => {
  const prevNodeEnv = configObj.nodeEnv;
  const prevMailKey = process.env.MAIL_SECRET_KEY;

  try {
    // 1. Chiffrement hérité sans MAIL_SECRET_KEY (hors prod)
    delete process.env.MAIL_SECRET_KEY;
    (configObj as any).nodeEnv = 'test';
    const legacyCipher = encryptSecretFn('smtp-legacy-pass');

    // 2. En production sans MAIL_SECRET_KEY -> chiffrement refusé
    (configObj as any).nodeEnv = 'production';
    assert.throws(() => encryptSecretFn('new-pass'), /MAIL_SECRET_KEY/);

    // 3. Avec MAIL_SECRET_KEY configurée : nouveau chiffrement + compatibilité déchiffrement hérité
    process.env.MAIL_SECRET_KEY = 'super-strong-dedicated-mail-secret-key-32chars';
    const modernCipher = encryptSecretFn('smtp-modern-pass');
    assert.equal(decryptSecretFn(modernCipher), 'smtp-modern-pass');
    assert.equal(decryptSecretFn(legacyCipher), 'smtp-legacy-pass');
  } finally {
    (configObj as any).nodeEnv = prevNodeEnv;
    if (prevMailKey === undefined) delete process.env.MAIL_SECRET_KEY;
    else process.env.MAIL_SECRET_KEY = prevMailKey;
  }
});

test('P0-5: /api/auth/confirm-supabase-token échoue fermé (503) sans SUPABASE_URL/ANON_KEY', async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    const res = await api(null, 'POST', '/api/auth/confirm-supabase-token', { accessToken: 'fake-token' });
    assert.equal(res.status, 503);
    assert.equal(res.json?.code, 'SUPABASE_NOT_CONFIGURED');
  } finally {
    if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
    if (prevAnon !== undefined) process.env.SUPABASE_ANON_KEY = prevAnon;
  }
});

test('P0-6: config.ts rejette les secrets placeholders/courts en production et supprime file:./data.db', () => {
  assert.equal(configObj.databaseUrl === 'file:./data.db', false);

  const checkFailure = (extraEnv: Record<string, string>) => {
    assert.throws(() => {
      execFileSync(
        process.execPath,
        ['--import', 'tsx', '-e', "import('./server/config.js').then(()=>process.exit(0)).catch((e)=>{console.error(e.message);process.exit(2);})"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            JWT_SECRET: 'a'.repeat(40),
            ...extraEnv,
          },
          stdio: 'pipe',
        }
      );
    });
  };

  checkFailure({ JWT_SECRET: 'remplacer-par-une-cle-secrete-aleatoire-de-64-caracteres-minimum' });
  checkFailure({ JWT_SECRET: 'short-secret' });
  checkFailure({ MAIL_SECRET_KEY: 'remplacer-par-une-cle-aes' });
  checkFailure({ COOKIE_SECRET: 'dev-cookie-secret-change-in-production' });
});

test('P0-7: errorHandler mappe Prisma P2003 en 409 FOREIGN_KEY_CONSTRAINT', () => {
  const err = new Prisma.PrismaClientKnownRequestError('FK fail', {
    code: 'P2003',
    clientVersion: '5.22.0',
  });
  let statusCode = 0;
  let body: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      body = payload;
      return this;
    },
  };
  errorHandlerFn(err, { path: '/test', method: 'DELETE' } as any, res, (() => {}) as any);
  assert.equal(statusCode, 409);
  assert.equal(body?.code, 'FOREIGN_KEY_CONSTRAINT');
});

test('P0-8: aucun mot de passe en dur ni repli Supabase codé en dur dans les scripts/services P0', () => {
  const root = process.cwd();
  const inspectScript = fs.readFileSync(path.join(root, 'scripts', 'inspect_live_prod.cjs'), 'utf8');
  const captureScript = fs.readFileSync(path.join(root, 'scripts', 'capture-all-sections.mjs'), 'utf8');
  const emailSvc = fs.readFileSync(path.join(root, 'server', 'services', 'emailService.ts'), 'utf8');
  const authRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'auth.ts'), 'utf8');

  assert.equal(inspectScript.includes('Anelec2026!'), false);
  assert.equal(captureScript.includes('AuditSecure2026!Anelec'), false);
  assert.equal(emailSvc.includes('qfhxptwsuotqnrihzhxw.supabase.co'), false);
  assert.equal(authRoute.includes('qfhxptwsuotqnrihzhxw.supabase.co'), false);
});
