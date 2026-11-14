// Les donneurs d'ordre de « Profils & donneurs d'ordre » alimentent les sélecteurs (devis, interventions).
// Régression : pour une entreprise sans liste « clients », les listes déroulantes restaient vides.
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
const tok: Record<number, string> = {};

before(async () => {
  db.company.seed([{ id: 7, name: 'Société 7', active: true }, { id: 8, name: 'Société 8', active: true }]);
  db.user.seed([
    { id: 71, companyId: 7, email: 'a@t.fr', name: 'A', role: 'ADMIN', active: true, technicienNom: null, permissionsJson: null },
    { id: 81, companyId: 8, email: 'b@t.fr', name: 'B', role: 'ADMIN', active: true, technicienNom: null, permissionsJson: null },
  ]);
  db.referentiel.seed([
    { id: 1, companyId: 7, categorie: 'clients_fiches', valeurs: JSON.stringify([
      { id: 'c', nom: 'celec', type: 'DONNEUR_ORDRE', email: 'c@celec.fr', active: true },
      { id: 'x', nom: 'Ancien client', type: 'DONNEUR_ORDRE', email: 'x@x.fr', active: false },
    ]) },
    { id: 2, companyId: 8, categorie: 'clients_fiches', valeurs: JSON.stringify([{ id: 'z', nom: 'Zéta', type: 'DONNEUR_ORDRE', email: 'z@z.fr', active: true }]) },
  ]);
  const { config } = await import('../server/config.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const { errorHandler } = await import('../server/middleware/errorHandler.js');
  const { referentielsRouter } = await import('../server/routes/referentiels.js');
  for (const u of db.user.rows) tok[u.id] = jwt.sign({ userId: u.id, email: u.email, role: u.role, companyId: u.companyId }, config.jwtSecret, { expiresIn: '1h' });
  const app = express();
  app.use(express.json());
  app.use(cookieParser(config.cookieSecret));
  app.use('/api/referentiels', authMiddleware, referentielsRouter);
  app.use(errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server?.close());

const lire = async (as: number) =>
  (await (await fetch(`${base}/api/referentiels`, { headers: { authorization: `Bearer ${tok[as]}` } })).json()).data;

test('les fiches actives apparaissent dans la liste des sélecteurs, sans mélange entre entreprises', async () => {
  const a = await lire(71);
  assert.deepEqual(a.clients, ['celec'], 'fiche active présente, fiche inactive absente');
  const b = await lire(81);
  assert.deepEqual(b.clients, ['Zéta'], 'aucune fuite entre entreprises');
});

test('enregistrer des fiches crée la liste des clients si elle n\'existait pas', async () => {
  const fiches = [
    { id: 'n', nom: 'Nouveau DO', type: 'DONNEUR_ORDRE', email: 'n@do.fr', active: true },
    { id: 'c', nom: 'celec', type: 'DONNEUR_ORDRE', email: 'c@celec.fr', active: true },
  ];
  const r = await fetch(`${base}/api/referentiels/clients_fiches`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok[71]}` }, body: JSON.stringify({ fiches }),
  });
  assert.equal(r.status, 200);
  assert.ok(db.referentiel.rows.some((x: any) => x.companyId === 7 && x.categorie === 'clients'), 'liste « clients » créée');
  assert.deepEqual((await lire(71)).clients.sort(), ['Nouveau DO', 'celec']);
  assert.deepEqual((await lire(81)).clients, ['Zéta']);
});
