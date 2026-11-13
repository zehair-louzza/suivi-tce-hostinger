// Refus par défaut : politique d'accès unique, testée pour les 5 rôles, de bout en bout (vraies requêtes HTTP)
// et par analyse du code des routes (aucune route sans règle).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { accessFor, type Access } from '../server/lib/access.js';
import { POLICY, can, type Action } from '../server/lib/policy.js';
import { makePolicy, secureRouter, type AccessLoader } from '../server/lib/guardCore.js';
import { AppError } from '../server/middleware/errorHandler.js';

const ROLES = ['ADMIN', 'CHIFFRAGE_DEVIS', 'CONDUCTEUR_TRAVAUX', 'REDACTEUR_RAPPORTS', 'TECHNICIEN'] as const;
type RoleCode = (typeof ROLES)[number];
const acc = (role: RoleCode): Access =>
  accessFor({ id: 50, role, name: 'Test', technicienNom: role === 'TECHNICIEN' ? 'Test' : null });

// [ADMIN, CHIFFRAGE, CONDUCTEUR, RAPPORTS, TECHNICIEN] — la matrice validée, action par action
const ATTENDU: Record<Action, [boolean, boolean, boolean, boolean, boolean]> = {
  'devis.list': [true, true, true, true, true],
  'devis.read': [true, true, true, true, true],
  'devis.stats': [true, true, true, true, false],
  'devis.create': [true, true, false, false, false],
  'devis.update': [true, true, true, false, true],
  'devis.delete': [true, false, false, false, false],
  'devis.convert': [true, true, true, false, false],
  'devis.sendEmail': [true, true, false, false, false],
  'interventions.list': [true, true, true, true, true],
  'interventions.read': [true, true, true, true, true],
  'interventions.stats': [true, true, true, true, false],
  'interventions.create': [true, true, true, true, true],
  'interventions.update': [true, true, true, true, true],
  'interventions.delete': [true, false, false, false, false],
  'interventions.sendReport': [true, false, true, true, false],
  'demandes.list': [true, true, true, false, false],
  'demandes.create': [true, true, true, false, false],
  'demandes.update': [true, true, true, false, false],
  'demandes.orienter': [true, true, true, false, false],
  'referentiels.read': [true, true, true, true, true],
  'referentiels.write': [true, false, true, false, false],
  'gps.post': [true, true, true, true, true],
  'admin.users.list': [true, false, false, false, false],
  'admin.users.create': [true, false, false, false, false],
  'admin.users.update': [true, false, false, false, false],
  'admin.users.delete': [true, false, false, false, false],
  'admin.invitations.manage': [true, false, false, false, false],
  'admin.company.destroy': [true, false, false, false, false],
  'admin.smtp.manage': [true, false, false, false, false],
  'admin.appearance.read': [true, false, false, false, false],
  'admin.appearance.update': [true, false, false, false, false],
  'admin.siege.update': [true, false, false, false, false],
  'admin.pointages.read': [true, true, true, true, true],
  'admin.pointages.clock': [true, true, true, true, true],
};
// interventions.create : le technicien a canEditInterventions par défaut (rôle terrain) — la création reste
// bornée à ce qui lui est affecté par la route ; elle est listée ici telle qu'elle est aujourd'hui.

test('la table de règles correspond exactement à la matrice attendue, pour les 5 rôles', () => {
  assert.deepEqual(Object.keys(POLICY).sort(), Object.keys(ATTENDU).sort(), 'aucune action oubliée ni en trop');
  for (const [action, expected] of Object.entries(ATTENDU)) {
    const got = ROLES.map((r) => can(acc(r), action));
    assert.deepEqual(got, expected, `action ${action}`);
  }
});

test('refus par défaut : une action inconnue est refusée à tous, même à la direction', () => {
  for (const r of ROLES) {
    assert.equal(can(acc(r), 'inconnue.action'), false);
    assert.equal(can(acc(r), ''), false);
    assert.equal(can(acc(r), '__proto__'), false);
    assert.equal(can(acc(r), 'toString'), false);
  }
});

test('un compte sans rôle valable n\'obtient rien d\'administratif', () => {
  const inconnu = accessFor({ id: 99, role: 'PIRATE' });
  assert.equal(can(inconnu, 'admin.users.create'), false);
  assert.equal(can(inconnu, 'demandes.list'), false);
});

test('un secureRouter refuse de démarrer si une route n\'a pas de règle', () => {
  const r = secureRouter('test');
  assert.throws(() => r.get('/ouverte', (_q, s) => void s.end()), /Route sans règle d'accès/);
  const policy = makePolicy(async () => ({ ...acc('ADMIN'), companyId: 1 }));
  assert.doesNotThrow(() => r.get('/fermee', policy('devis.list'), (_q, s) => void s.end()));
});

test('de bout en bout : la garde renvoie 403 aux rôles refusés et laisse passer les autres', async () => {
  const loader: AccessLoader = async (req) => {
    const role = req.header('x-test-role') as RoleCode | undefined;
    if (!role) throw new AppError(401, 'Authentification requise');
    return { ...acc(role), companyId: 1 };
  };
  const policy = makePolicy(loader);
  const router = secureRouter('e2e');
  const probes: Array<[Action, string]> = [
    ['demandes.list', '/demandes'],
    ['devis.create', '/devis'],
    ['admin.users.create', '/users'],
    ['interventions.sendReport', '/rapport'],
  ];
  for (const [action, path] of probes) router.get(path, policy(action), (_q, s) => void s.json({ ok: true }));

  const app = express();
  app.use(router);
  app.use((err: any, _q: express.Request, s: express.Response, _n: express.NextFunction) => {
    s.status(err.statusCode || 500).json({ error: err.message });
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    for (const [action, path] of probes) {
      for (const role of ROLES) {
        const res = await fetch(`http://localhost:${port}${path}`, { headers: { 'x-test-role': role } });
        const attendu = ATTENDU[action][ROLES.indexOf(role)];
        assert.equal(res.status, attendu ? 200 : 403, `${role} → ${action}`);
      }
    }
    const sansSession = await fetch(`http://localhost:${port}/demandes`);
    assert.equal(sansSession.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('analyse du code : chaque route des routeurs protégés déclare une règle qui existe', () => {
  const FICHIERS: Record<string, string> = {
    devisRouter: 'devis', interventionRouter: 'interventions', demandesRouter: 'demandes',
    referentielsRouter: 'referentiels', adminRouter: 'admin',
  };
  const utilisees = new Set<string>();
  for (const [routeur, fichier] of Object.entries(FICHIERS)) {
    const src = fs.readFileSync(new URL(`../server/routes/${fichier}.ts`, import.meta.url), 'utf8');
    assert.match(src, new RegExp(`export const ${routeur} = secureRouter\\(`), `${fichier} utilise secureRouter`);
    const routes = [...src.matchAll(new RegExp(`^${routeur}\\.(get|post|put|patch|delete)\\(`, 'gm'))];
    const gardees = [...src.matchAll(new RegExp(`^${routeur}\\.(get|post|put|patch|delete)\\(\\s*\\n\\s*'[^']+',\\s*\\n\\s*policy\\('([^']+)'\\),`, 'gm'))];
    assert.ok(routes.length > 0);
    assert.equal(gardees.length, routes.length, `${fichier} : toutes les routes ont une garde policy()`);
    for (const g of gardees) {
      assert.ok(g[2] in POLICY, `${fichier} : l'action ${g[2]} existe dans la politique`);
      utilisees.add(g[2]);
    }
  }
  const mortes = Object.keys(POLICY).filter((a) => !utilisees.has(a));
  assert.deepEqual(mortes, [], 'toute règle de la politique est utilisée par au moins une route');
});
