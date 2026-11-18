import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { createFakeDb } from './support/fakePrisma.js';

const db = createFakeDb();
(globalThis as any).__FAKE_PRISMA__ = db;

let httpServer: http.Server;
let base = '';
let jwtSecret = '';
let origFetch: typeof globalThis.fetch;

const hashInv = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const tok = (userId: number, companyId: number, role: string, email: string, tokenVersion = 1) =>
  jwt.sign({ userId, companyId, role, email, type: 'access', sv: tokenVersion }, jwtSecret, { expiresIn: '1h' });

const reqApi = async (method: string, urlPath: string, token: string | null, body?: unknown) => {
  const res = await origFetch(base + urlPath, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore non-json
  }
  return { status: res.status, json, text };
};

let T_ADMIN = '';
let T_CHIFF = '';
let T_PLANIF = '';
let T_REDAC = '';
let T_TECH = '';

before(async () => {
  origFetch = globalThis.fetch;
  const cfg = (await import('../server/config.js')).config;
  jwtSecret = cfg.jwtSecret;

  const { authRouter } = await import('../server/routes/auth.js');
  const { demandesRouter } = await import('../server/routes/demandes.js');
  const { devisRouter } = await import('../server/routes/devis.js');
  const { interventionRouter } = await import('../server/routes/interventions.js');
  const { referentielsRouter } = await import('../server/routes/referentiels.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const { errorHandler } = await import('../server/middleware/errorHandler.js');

  db.company.seed([
    { id: 1, name: 'Entreprise Active', siret: '11111111100011', siren: '111111111', active: true },
    { id: 2, name: 'Entreprise Squattée Expirée', siret: '22222222200022', siren: '222222222', active: true },
  ]);

  db.user.seed([
    { id: 1, companyId: 1, email: 'admin@r2.fr', name: 'Admin', role: 'ADMIN', active: true, emailConfirmed: true, tokenVersion: 1 },
    { id: 2, companyId: 1, email: 'chiff@r2.fr', name: 'Chiffreur', role: 'CHIFFRAGE_DEVIS', active: true, emailConfirmed: true, tokenVersion: 1 },
    { id: 3, companyId: 1, email: 'planif@r2.fr', name: 'Planif', role: 'CONDUCTEUR_TRAVAUX', active: true, emailConfirmed: true, tokenVersion: 1 },
    { id: 4, companyId: 1, email: 'redac@r2.fr', name: 'Redac', role: 'REDACTEUR_RAPPORTS', active: true, emailConfirmed: true, tokenVersion: 1 },
    { id: 5, companyId: 1, email: 'marc@r2.fr', name: 'Marc', technicienNom: 'Marc', role: 'TECHNICIEN', active: true, emailConfirmed: true, tokenVersion: 1 },
    {
      id: 6,
      companyId: 2,
      email: 'squat@old.fr',
      name: 'Squatter',
      role: 'ADMIN',
      active: false,
      emailConfirmed: false,
      confirmationCodeExpires: new Date(Date.now() - 60_000),
      createdAt: new Date(Date.now() - 3600_000),
      tokenVersion: 1,
    },
    {
      id: 7,
      companyId: 1,
      email: 'pending@r2.fr',
      name: 'Pending User',
      role: 'ADMIN',
      active: false,
      emailConfirmed: false,
      confirmationCode: '654321',
      confirmationToken: 'tok-pending-r2',
      confirmationCodeExpires: new Date(Date.now() + 600_000),
      confirmationCodeAttempts: 0,
      confirmationSentAt: new Date(),
      tokenVersion: 1,
    },
  ]);

  db.referentiel.seed([
    { id: 1, companyId: 1, categorie: 'techniciens', valeurs: JSON.stringify(['Karim Terrain']) },
    {
      id: 2,
      companyId: 1,
      categorie: 'clients_fiches',
      valeurs: JSON.stringify([{ nom: 'Client Fiche', email: 'officiel@client-fiche.fr' }]),
    },
  ]);

  db.companyInvitation.seed([
    {
      id: 1,
      companyId: 1,
      company: { id: 1, name: 'Entreprise Active', active: true },
      email: 'newtech@r2.fr',
      role: 'TECHNICIEN',
      technicienNom: null,
      tokenHash: hashInv('inv-tok-tech-1234567890abcdef'),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  ]);

  db.demande.seed([
    { id: 1, companyId: 1, client: 'Client Fiche', objet: 'Test', statut: 'ORIENTEE', typeDemandeur: 'DONNEUR_ORDRE', numeroDI: 'DI-100' },
  ]);

  db.devis.seed([
    {
      id: 10,
      companyId: 1,
      userId: 1,
      client: 'Client Fiche',
      objet: 'Devis Mail Check',
      statutCommercial: 'À préparer',
      visiteTechnicien: 'Marc',
      version: 1,
    },
  ]);

  db.intervention.seed([
    {
      id: 20,
      companyId: 1,
      userId: 1,
      client: 'Client Fiche',
      chantier: 'Chantier Verrouillé',
      entreprise: 'Marc',
      technicien: 'Marc',
      statutOperationnel: 'Terminée - à valider',
      statutRapport: 'Validé par le client',
      numeroDI: 'DI-LOCKED',
      isVisiteDevis: false,
      version: 1,
    },
  ]);

  T_ADMIN = tok(1, 1, 'ADMIN', 'admin@r2.fr');
  T_CHIFF = tok(2, 1, 'CHIFFRAGE_DEVIS', 'chiff@r2.fr');
  T_PLANIF = tok(3, 1, 'CONDUCTEUR_TRAVAUX', 'planif@r2.fr');
  T_REDAC = tok(4, 1, 'REDACTEUR_RAPPORTS', 'redac@r2.fr');
  T_TECH = tok(5, 1, 'TECHNICIEN', 'marc@r2.fr');

  const app = express();
  app.use(express.json());
  app.use(cookieParser(cfg.cookieSecret));
  app.use('/api/auth', authRouter);
  app.use('/api/demandes', authMiddleware, demandesRouter);
  app.use('/api/devis', authMiddleware, devisRouter);
  app.use('/api/interventions', authMiddleware, interventionRouter);
  app.use('/api/referentiels', authMiddleware, referentielsRouter);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    httpServer = app.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address() as AddressInfo;
      base = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test('R2-1: resend-confirmation enforces 45s cooldown while active code exists', async () => {
  const r = await reqApi('POST', '/api/auth/resend-confirmation', null, { email: 'pending@r2.fr' });
  assert.equal(r.status, 429);
  assert.equal(r.json?.code, 'RESEND_COOLDOWN');
});

test('R2-2: register reclaims expired unconfirmed company name instead of permanent squatting', async () => {
  const r = await reqApi('POST', '/api/auth/register', null, {
    email: 'real-owner@company2.fr',
    password: 'Kx9!vQ4#mZ8@rT2w',
    name: 'Real Owner',
    companyName: 'Entreprise Squattée Expirée',
    siret: '22222222200022',
    termsAccepted: true,
  });
  assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);
});

test('R2-3: invitation accept rejects technician name colliding with Referentiel(techniciens)', async () => {
  const r = await reqApi('POST', '/api/auth/invitations/accept', null, {
    token: 'inv-tok-tech-1234567890abcdef',
    name: 'Karim Terrain',
    password: 'Kx9!vQ4#mZ8@rT2w',
    acceptTerms: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json?.code, 'TECHNICIEN_NAME_CONFLICT');
});

test('R2-4: confirm-supabase-token requires email_confirmed_at (not confirmed_at alone)', async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://supa.example.test';
  process.env.SUPABASE_ANON_KEY = 'anon-key-test';
  globalThis.fetch = (async (input: any) => {
    if (String(input).includes('/auth/v1/user')) {
      return new Response(
        JSON.stringify({ email: 'pending@r2.fr', confirmed_at: new Date().toISOString(), email_confirmed_at: null }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return origFetch(input);
  }) as typeof fetch;

  try {
    const r = await reqApi('POST', '/api/auth/confirm-supabase-token', null, { accessToken: 'fake-supa-jwt' });
    assert.equal(r.status, 403);
    assert.equal(r.json?.code, 'SUPABASE_EMAIL_UNCONFIRMED');
  } finally {
    globalThis.fetch = origFetch;
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
  }
});

test('R2-5: CHIFFRAGE_DEVIS cannot spoof another technician GPS position', async () => {
  const r = await reqApi('POST', '/api/referentiels/gps-position', T_CHIFF, {
    technicien: 'Marc',
    lat: 48.85,
    lng: 2.35,
  });
  assert.equal(r.status, 403);
});

test('R2-6: demandes PATCH enforces forward-only state machine', async () => {
  const r = await reqApi('PATCH', '/api/demandes/1', T_PLANIF, { statut: 'A_DECIDER' });
  assert.equal(r.status, 409);
  assert.equal(r.json?.code, 'INVALID_STATE_TRANSITION');
});

test('R2-7: send-devis-email enforces client-card allowlist and recipient cap', async () => {
  const r1 = await reqApi('POST', '/api/devis/10/send-devis-email', T_ADMIN, {
    toEmail: 'exfil@evil.example',
  });
  assert.equal(r1.status, 422);
  assert.equal(r1.json?.code, 'ADRESSE_HORS_FICHE');

  const r2 = await reqApi('POST', '/api/devis/10/send-devis-email', T_ADMIN, {
    toEmail: 'a1@x.fr,a2@x.fr,a3@x.fr,a4@x.fr,a5@x.fr,a6@x.fr',
  });
  assert.equal(r2.status, 400);
  assert.equal(r2.json?.code, 'TOO_MANY_RECIPIENTS');
});

test('R2-8: CHIFFRAGE_DEVIS intervention create stays forced to visit + PATCH RBAC/lock guards hold', async () => {
  const created = await reqApi('POST', '/api/interventions', T_CHIFF, {
    datePlanifiee: '2026-12-01',
    heureDebut: '09:00',
    isVisiteDevis: true,
    typeIntervention: 'Visite technique devis',
  });
  assert.equal(created.status, 201, `Expected 201, got ${created.status}: ${JSON.stringify(created.json)}`);
  assert.equal(created.json?.data?.isVisiteDevis, true);
  assert.equal(created.json?.data?.typeIntervention, 'Visite technique devis');

  // REDACTEUR_RAPPORTS cannot alter numeroDI or isVisiteDevis
  const badDi = await reqApi('PATCH', '/api/interventions/20', T_REDAC, { numeroDI: 'DI-HIJACK' });
  assert.equal(badDi.status, 403);

  // Field tech cannot jump statutOperationnel to Annulée
  const badStatus = await reqApi('PATCH', '/api/interventions/20', T_TECH, { statutOperationnel: 'Annulée' });
  assert.equal(badStatus.status, 403);

  // Locked report rejects modification of any CHAMPS_CONTENU_RAPPORT field (e.g. client / siteAdresse)
  const lockedClient = await reqApi('PATCH', '/api/interventions/20', T_PLANIF, { client: 'Client Modifié' });
  assert.equal(lockedClient.status, 409);
  assert.equal(lockedClient.json?.code, 'RAPPORT_VERROUILLE');
});

test('R2-9: GET /api/devis and /api/interventions clamp pagination page/limit', async () => {
  const d = await reqApi('GET', '/api/devis?page=-3&limit=999999', T_ADMIN);
  assert.equal(d.status, 200);
  assert.equal(d.json?.pagination?.page, 1);
  assert.equal(d.json?.pagination?.limit, 200);

  const i = await reqApi('GET', '/api/interventions?page=0&limit=50000', T_ADMIN);
  assert.equal(i.status, 200);
  assert.equal(i.json?.pagination?.page, 1);
  assert.equal(i.json?.pagination?.limit, 300);
});

test('R2-10: PATCH /api/devis/:id enforces optimistic CAS on version', async () => {
  const r1 = await reqApi('PATCH', '/api/devis/10', T_ADMIN, { objet: 'Mise a jour 1' });
  assert.equal(r1.status, 200);
  // Concurrent PATCH simulated via mismatched stale version in store
  const originalFindFirst = db.devis.findFirst.bind(db.devis);
  db.devis.findFirst = async (args: any) => {
    const row = await originalFindFirst(args);
    return row ? { ...row, version: 0 } : row;
  };
  try {
    const conflict = await reqApi('PATCH', '/api/devis/10', T_ADMIN, { objet: 'Conflit' });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.json?.code, 'VERSION_CONFLICT');
  } finally {
    db.devis.findFirst = originalFindFirst;
  }
});
