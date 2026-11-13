// ÉTAPE 5 — Les VRAIES routes du serveur (devis, interventions, référentiels), appelées en HTTP avec un jeton
// pour chacun des 5 rôles, sur une base simulée en mémoire contenant DEUX sociétés.
// Lancer :  npx tsx --import ./test/support/registerStub.mjs --test test/roleRoutes.e2e.ts
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { createFakeDb } from './support/fakePrisma.js';

const db = createFakeDb();
(globalThis as any).__FAKE_PRISMA__ = db;

let server: http.Server;
let base = '';
const tokens: Record<string, string> = {};

const intv = (id: number, o: Record<string, any> = {}) => ({
  id, companyId: 1, reference: `INT-${id}`, client: 'ACME', chantier: '12 rue X', objet: 'Dépannage',
  statutOperationnel: 'Planifiée', datePlanifiee: '2026-11-20', entreprise: 'Karim', amount: 1500, tauxTVA: 20,
  numeroFacture: 'F-1', statutFacture: 'Non facturée', notes: 'Gardien 06 11 22 33 44', origine: 'Tel',
  historique: JSON.stringify([{ auteur: 'bureau', action: 'créée' }]), photos: '[]', version: 1, ...o,
});
const dev = (id: number, o: Record<string, any> = {}) => ({
  id, companyId: 1, reference: `DEV-${id}`, client: 'Durand SA', site: 'Lyon', siteAdresse: '3 rue Y', objet: 'Rénovation',
  statutCommercial: 'En préparation', amount: 5000, montantHt: 5000, visiteTechnicien: '', historique: '[]', version: 1, ...o,
});
const user = (id: number, role: string, o: Record<string, any> = {}) => ({
  id, companyId: 1, email: `${role.toLowerCase()}@test.fr`, name: role, role, active: true, technicienNom: null,
  permissionsJson: null, ...o,
});

before(async () => {
  db.user.seed([
    user(101, 'ADMIN'), user(102, 'CHIFFRAGE_DEVIS'), user(103, 'CONDUCTEUR_TRAVAUX'),
    user(104, 'REDACTEUR_RAPPORTS'), user(105, 'TECHNICIEN', { technicienNom: 'Karim' }),
    user(201, 'ADMIN', { companyId: 2, email: 'admin2@autre.fr' }),
  ]);
  db.intervention.seed([
    intv(1), intv(2, { entreprise: 'Autre', client: 'BETA', amount: 800 }), intv(3, { devisId: 10 }),
    intv(4, { statutOperationnel: 'Terminée - à valider', statutRapport: 'Déclaré par technicien' }),
    intv(5, { companyId: 2, client: 'SECRET', entreprise: 'Karim', amount: 99999 }),
  ]);
  db.devis.seed([
    dev(10, { statutCommercial: 'Accepté', amount: 9000, montantHt: 9000, visiteTechnicien: 'Karim' }),
    dev(11), dev(12, { companyId: 2, client: 'SECRET', amount: 77777 }),
  ]);
  db.referentiel.seed([]);

  const { setSocketInstance } = await import('../server/socket/index.js');
  setSocketInstance({ to: () => ({ emit() {} }), emit() {} } as any);
  const { config } = await import('../server/config.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const { errorHandler } = await import('../server/middleware/errorHandler.js');
  const { devisRouter } = await import('../server/routes/devis.js');
  const { interventionRouter } = await import('../server/routes/interventions.js');
  const { referentielsRouter } = await import('../server/routes/referentiels.js');

  for (const u of db.user.rows) {
    tokens[u.id] = jwt.sign({ userId: u.id, email: u.email, role: u.role, companyId: u.companyId }, config.jwtSecret, { expiresIn: '1h' });
  }
  const app = express();
  app.use(express.json());
  app.use(cookieParser(config.cookieSecret));
  app.use('/api/devis', authMiddleware, devisRouter);
  app.use('/api/interventions', authMiddleware, interventionRouter);
  app.use('/api/referentiels', authMiddleware, referentielsRouter);
  app.use(errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server?.close());

const ADMIN = 101, CHIFFRAGE = 102, CONDUCTEUR = 103, RAPPORTS = 104, TECH = 105, ADMIN2 = 201;

async function call(as: number | null, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(as ? { authorization: `Bearer ${tokens[as]}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* vide */ }
  return { status: res.status, json };
}
const ids = (r: { json: any }) => (r.json?.data || []).map((x: any) => x.id).sort((a: number, b: number) => a - b);
const row = (table: string, id: number) => db[table].rows.find((r: any) => r.id === id);

test('sans jeton : 401 partout', async () => {
  for (const p of ['/api/devis', '/api/interventions', '/api/referentiels']) assert.equal((await call(null, 'GET', p)).status, 401, p);
});

test('ISOLATION : chaque société ne voit que ses propres données, même la direction', async () => {
  const a = await call(ADMIN, 'GET', '/api/interventions');
  assert.deepEqual(ids(a), [1, 2, 3, 4]);
  assert.deepEqual(ids(await call(ADMIN2, 'GET', '/api/interventions')), [5]);
  assert.deepEqual(ids(await call(ADMIN, 'GET', '/api/devis')), [10, 11]);
  assert.deepEqual(ids(await call(ADMIN2, 'GET', '/api/devis')), [12]);
  assert.ok([403, 404].includes((await call(ADMIN, 'GET', '/api/interventions/5')).status));
  assert.ok([403, 404].includes((await call(ADMIN, 'GET', '/api/devis/12')).status));
  assert.ok([403, 404].includes((await call(ADMIN2, 'PATCH', '/api/interventions/1', { notes: 'piratage' })).status));
  assert.notEqual(row('intervention', 1).notes, 'piratage');
});

test('DIRECTION : voit tout, montants et facturation compris', async () => {
  const l = await call(ADMIN, 'GET', '/api/interventions');
  const i1 = l.json.data.find((x: any) => x.id === 1);
  assert.equal(i1.amount, 1500);
  assert.equal(i1.numeroFacture, 'F-1');
  assert.equal((await call(ADMIN, 'PATCH', '/api/interventions/1', { datePlanifiee: '2026-12-01', numeroFacture: 'F-2' })).status, 200);
});

test('TECHNICIEN : uniquement SES missions, jamais de montant ni de facture, avancement seulement', async () => {
  const l = await call(TECH, 'GET', '/api/interventions');
  assert.deepEqual(ids(l), [1, 3, 4]);
  for (const x of l.json.data) {
    for (const k of ['amount', 'montantHt', 'tauxTVA', 'numeroFacture', 'statutFacture', 'historique', 'origine']) {
      assert.ok(!(k in x), `le technicien ne doit pas recevoir ${k}`);
    }
  }
  assert.ok(l.json.data[0].notes.includes('06 11 22 33 44'), 'contact sur place conservé');
  assert.ok([403, 404].includes((await call(TECH, 'GET', '/api/interventions/2')).status), 'mission d\'un autre technicien');
  assert.equal((await call(TECH, 'PATCH', '/api/interventions/2', { statutOperationnel: 'En cours' })).status, 403);
  // montant : refusé avec un message clair et la liste des rôles
  const bad = await call(TECH, 'PATCH', '/api/interventions/1', { amount: 1 });
  assert.equal(bad.status, 403);
  assert.match(bad.json.error, /Vous n'avez pas le droit de modifier les montants/);
  assert.match(bad.json.error, /Peuvent la modifier : Direction/);
  assert.equal(row('intervention', 1).amount, 1500);
  // avancement : accepté, et le montant glissé dans la même requête est écarté avec un avis
  const ok = await call(TECH, 'PATCH', '/api/interventions/1', { statutOperationnel: 'En cours', amount: 1 });
  assert.equal(ok.status, 200);
  assert.match(ok.json.notice, /montants/);
  assert.equal(row('intervention', 1).statutOperationnel, 'En cours');
  assert.equal(row('intervention', 1).amount, 1500);
  assert.equal((await call(TECH, 'POST', '/api/interventions', { chantier: 'x', client: 'y' })).status, 403);
  // devis : ses visites seulement, sans montant
  const d = await call(TECH, 'GET', '/api/devis');
  assert.deepEqual(ids(d), [10]);
  assert.ok(!('amount' in d.json.data[0]) && !('montantHt' in d.json.data[0]));
  assert.ok([403, 404].includes((await call(TECH, 'GET', '/api/devis/11')).status));
  assert.equal((await call(TECH, 'POST', '/api/devis', { client: 'x' })).status, 403);
  assert.equal((await call(TECH, 'GET', '/api/interventions/stats')).status, 403);
});

test('TECHNICIEN : fiches clients limitées à ses missions, sans équipe ni tarifs', async () => {
  db.referentiel.seed([
    { id: 1, companyId: 1, categorie: 'clients', valeur: 'ACME' }, { id: 2, companyId: 1, categorie: 'clients', valeur: 'BETA' },
  ]);
  const r = await call(TECH, 'GET', '/api/referentiels');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.data.clients, []);
  assert.deepEqual(r.json.data.responsables, []);
  assert.deepEqual(r.json.data.techniciens, ['Karim']);
});

test('CHARGÉ D\'ÉTUDES : tout le pipeline devis, interventions liées en lecture seule, jamais la facturation', async () => {
  assert.deepEqual(ids(await call(CHIFFRAGE, 'GET', '/api/devis')), [10, 11]);
  const l = await call(CHIFFRAGE, 'GET', '/api/interventions');
  assert.deepEqual(ids(l), [3], 'seulement les interventions rattachées à un devis');
  assert.equal(l.json.data[0].numeroFacture, null);
  assert.equal(l.json.data[0].amount, 1500, 'il voit les montants (droit par défaut)');
  assert.ok([403, 404].includes((await call(CHIFFRAGE, 'GET', '/api/interventions/1')).status));
  const refus = await call(CHIFFRAGE, 'PATCH', '/api/interventions/3', { datePlanifiee: '2026-12-24' });
  assert.equal(refus.status, 403);
  assert.match(refus.json.error, /le planning/);
  assert.equal((await call(CHIFFRAGE, 'PATCH', '/api/devis/11', { montantHt: 6100, objet: 'Rénovation lourde' })).status, 200);
  assert.equal(row('devis', 11).objet, 'Rénovation lourde');
  assert.equal((await call(CHIFFRAGE, 'POST', '/api/interventions', { client: 'x', chantier: 'y', objet: 'travaux' })).status, 403, 'création hors visite refusée');
});

test('CONDUCTEUR : planifie et clôture, ne touche ni aux devis ni à la facturation', async () => {
  assert.deepEqual(ids(await call(CONDUCTEUR, 'GET', '/api/interventions')), [1, 2, 3, 4]);
  assert.deepEqual(ids(await call(CONDUCTEUR, 'GET', '/api/devis')), [10], 'devis accepté à transformer, pas le reste');
  assert.ok([403, 404].includes((await call(CONDUCTEUR, 'GET', '/api/devis/11')).status));
  assert.equal((await call(CONDUCTEUR, 'POST', '/api/devis', { client: 'x' })).status, 403);
  assert.equal((await call(CONDUCTEUR, 'PATCH', '/api/interventions/2', { datePlanifiee: '2026-12-02', entreprise: 'Karim' })).status, 200);
  const fact = await call(CONDUCTEUR, 'PATCH', '/api/interventions/2', { numeroFacture: 'F-77' });
  assert.equal(fact.status, 403);
  assert.match(fact.json.error, /la facturation/);
  assert.match(fact.json.error, /Rapports et facturation/);
  assert.equal(row('intervention', 2).numeroFacture, 'F-1');
});

test('RAPPORTS ET FACTURATION : rapport, clôture et facture seulement ; ni planning, ni création, ni devis', async () => {
  const p = await call(RAPPORTS, 'PATCH', '/api/interventions/4', { compteRendu: 'Travaux conformes', datePlanifiee: '2031-01-01' });
  assert.equal(p.status, 200);
  assert.match(p.json.notice, /le planning/);
  assert.equal(row('intervention', 4).compteRendu, 'Travaux conformes');
  assert.equal(row('intervention', 4).datePlanifiee, '2026-11-20', 'la date n\'a pas bougé');
  assert.equal((await call(RAPPORTS, 'PATCH', '/api/interventions/4', { statutOperationnel: 'Clôturée' })).status, 200, 'clôture autorisée');
  assert.equal((await call(RAPPORTS, 'PATCH', '/api/interventions/4', { statutOperationnel: 'Planifiée' })).status, 403, 'autre statut refusé');
  assert.equal((await call(RAPPORTS, 'PATCH', '/api/interventions/4', { numeroFacture: 'F-9', statutFacture: 'Facturée' })).status, 200);
  assert.equal(row('intervention', 4).numeroFacture, 'F-9');
  assert.equal((await call(RAPPORTS, 'POST', '/api/interventions', { client: 'x', chantier: 'y' })).status, 403);
  assert.deepEqual(ids(await call(RAPPORTS, 'GET', '/api/devis')), []);
  assert.equal((await call(RAPPORTS, 'POST', '/api/devis', { client: 'x' })).status, 403);
});

test('BADGES INDIVIDUELS : bornés par le plafond du rôle (un technicien promu « facturation » reste sans facturation)', async () => {
  row('user', 105).permissionsJson = JSON.stringify({ canManageBilling: true, canViewFinancials: true, canManageUsers: true });
  const l = await call(TECH, 'GET', '/api/interventions');
  assert.ok(!('numeroFacture' in l.json.data[0]) && !('amount' in l.json.data[0]));
  assert.equal((await call(TECH, 'PATCH', '/api/interventions/1', { numeroFacture: 'F-X' })).status, 403);
  row('user', 105).permissionsJson = null;
});

test('REFUS D\'ACTION : message en français avec les profils autorisés', async () => {
  const r = await call(TECH, 'POST', '/api/devis', { client: 'x' });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /Votre profil ne permet pas de créer un devis/);
  assert.match(r.json.error, /Profils autorisés : Direction ; Chargé d'études/);
  assert.ok(!r.json.error.includes('Technicien'));
});

test('COMPTE DÉSACTIVÉ : accès coupé immédiatement, même avec un jeton encore valide', async () => {
  row('user', 104).active = false;
  assert.equal((await call(RAPPORTS, 'GET', '/api/interventions')).status, 403);
  row('user', 104).active = true;
});
