// Automatisation A (technicien) — vraies routes + vrai service de relance, base simulée à DEUX sociétés.
// Lancer :  npm run test:roles
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
const tokens: Record<number, string> = {};
let executer: (d?: Date) => Promise<{ relances: number; alertes: number }>;

const user = (id: number, role: string, o: Record<string, any> = {}) => ({
  id, companyId: 1, email: `u${id}@test.fr`, name: `${role}-${id}`, role, active: true, technicienNom: null, permissionsJson: null, ...o,
});
const intv = (id: number, o: Record<string, any> = {}) => ({
  id, companyId: 1, referenceMetier: `INT-${id}`, client: 'ACME', chantier: '12 rue X', objet: 'Dépannage',
  statutOperationnel: 'À planifier', datePlanifiee: new Date('2026-11-20T00:00:00Z'), entreprise: null,
  historiqueJson: '[]', corpsEtat: 'Électricité', amount: 0, ...o,
});

const ADMIN = 101, PLANIF = 103, RAPPORTS = 104, KARIM = 105, SOFIA = 106, ADMIN2 = 201, TECH2 = 205;

before(async () => {
  db.company.seed([
    { id: 1, name: 'Société 1', active: true, autoTechnicienActif: true, autoTechnicienDelaiMinutes: 120 },
    { id: 2, name: 'Société 2', active: true, autoTechnicienActif: true, autoTechnicienDelaiMinutes: 15 },
  ]);
  db.user.seed([
    user(ADMIN, 'ADMIN'), user(PLANIF, 'CONDUCTEUR_TRAVAUX'), user(RAPPORTS, 'REDACTEUR_RAPPORTS'),
    user(KARIM, 'TECHNICIEN', { technicienNom: 'Karim' }), user(SOFIA, 'TECHNICIEN', { technicienNom: 'Sofia' }),
    user(ADMIN2, 'ADMIN', { companyId: 2 }), user(TECH2, 'TECHNICIEN', { companyId: 2, technicienNom: 'Karim' }),
  ]);
  db.intervention.seed([
    intv(1), intv(2), intv(3), intv(4), intv(5),
    intv(9, { companyId: 2, entreprise: 'Karim', statutOperationnel: 'Planifiée', reponseTechnicien: 'EN_ATTENTE', affecteLe: new Date() }),
  ]);
  db.referentiel.seed([{ id: 1, companyId: 1, categorie: 'technicien_competences', valeurs: JSON.stringify({ Karim: ['Électricité'], Sofia: ['Électricité'] }) }]);
  db.notification.seed([]);

  const { setSocketInstance } = await import('../server/socket/index.js');
  setSocketInstance({ to: () => ({ emit() {} }), emit() {} } as any);
  const { config } = await import('../server/config.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const { errorHandler } = await import('../server/middleware/errorHandler.js');
  const { interventionRouter } = await import('../server/routes/interventions.js');
  const { notificationsRouter } = await import('../server/routes/notifications.js');
  ({ executerAutomatisationsTechnicien: executer } = await import('../server/services/technicianAutomation.js'));

  for (const u of db.user.rows) {
    tokens[u.id] = jwt.sign({ userId: u.id, email: u.email, role: u.role, companyId: u.companyId }, config.jwtSecret, { expiresIn: '1h' });
  }
  const app = express();
  app.use(express.json());
  app.use(cookieParser(config.cookieSecret));
  app.use('/api/interventions', authMiddleware, interventionRouter);
  app.use('/api/notifications', authMiddleware, notificationsRouter);
  app.use(errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server?.close());

async function call(as: number, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[as]}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* vide */ }
  return { status: res.status, json };
}
const row = (table: string, id: number) => db[table].rows.find((r: any) => r.id === id);
const notifsDe = (userId: number) => db.notification.rows.filter((n: any) => n.userId === userId);
// Lundi 16 novembre 2026, heure de Paris (UTC+1)
const lundi = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 16, h - 1, m));
const dimanche = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 15, h - 1, m));

test('affectation : le planificateur désigne Karim → attente de réponse + notification à Karim seulement', async () => {
  const r = await call(PLANIF, 'PATCH', '/api/interventions/1', { entreprise: 'Karim' });
  assert.equal(r.status, 200);
  assert.equal(row('intervention', 1).reponseTechnicien, 'EN_ATTENTE');
  assert.ok(row('intervention', 1).affecteLe instanceof Date);
  assert.equal(notifsDe(KARIM).length, 1);
  assert.equal(notifsDe(KARIM)[0].type, 'MISSION_AFFECTEE');
  assert.equal(notifsDe(SOFIA).length, 0);
  assert.equal(notifsDe(TECH2).length, 0, 'jamais un technicien d\'une autre société');
});

test('affectation à un nom sans compte : aucune attente (personne ne pourrait répondre)', async () => {
  await call(PLANIF, 'PATCH', '/api/interventions/2', { entreprise: 'Sous-traitant X' });
  assert.equal(row('intervention', 2).reponseTechnicien ?? null, null);
});

test('refus : motif obligatoire, mission libérée, planificateur et direction prévenus avec des remplaçants', async () => {
  const sans = await call(KARIM, 'POST', '/api/interventions/1/reponse', { reponse: 'REFUSEE' });
  assert.equal(sans.status, 400);
  assert.equal(row('intervention', 1).reponseTechnicien, 'EN_ATTENTE');

  const ok = await call(KARIM, 'POST', '/api/interventions/1/reponse', { reponse: 'REFUSEE', motif: 'En congés ce jour-là' });
  assert.equal(ok.status, 200);
  const i = row('intervention', 1);
  assert.equal(i.reponseTechnicien, 'REFUSEE');
  assert.equal(i.entreprise, null);
  assert.equal(i.statutOperationnel, 'À planifier');
  assert.equal(i.motifRefus, 'En congés ce jour-là');
  assert.match(i.historiqueJson, /Mission refusée par le technicien/);
  const nPlanif = notifsDe(PLANIF).find((n: any) => n.type === 'MISSION_REFUSEE');
  assert.ok(nPlanif, 'le planificateur est prévenu');
  assert.match(nPlanif.message, /En congés ce jour-là/);
  assert.match(nPlanif.message, /Sofia/, 'Sofia est suggérée, Karim (le refusant) jamais');
  assert.doesNotMatch(nPlanif.message, /Remplaçants suggérés : [^.]*Karim/);
  assert.ok(notifsDe(ADMIN).some((n: any) => n.type === 'MISSION_REFUSEE'), 'la direction aussi');
  assert.equal(notifsDe(RAPPORTS).length, 0, 'pas le profil rapports');
  // La réponse ne peut pas être donnée deux fois
  assert.ok([403, 409].includes((await call(KARIM, 'POST', '/api/interventions/1/reponse', { reponse: 'ACCEPTEE' })).status));
});

test('acceptation : statut « Affectée », historique, planificateur prévenu', async () => {
  await call(PLANIF, 'PATCH', '/api/interventions/3', { entreprise: 'Karim' });
  const r = await call(KARIM, 'POST', '/api/interventions/3/reponse', { reponse: 'ACCEPTEE' });
  assert.equal(r.status, 200);
  assert.equal(row('intervention', 3).reponseTechnicien, 'ACCEPTEE');
  assert.equal(row('intervention', 3).statutOperationnel, 'Planifiée' === row('intervention', 3).statutOperationnel ? 'Planifiée' : 'Affectée');
  assert.match(row('intervention', 3).historiqueJson, /Mission acceptée par le technicien/);
  assert.ok(notifsDe(PLANIF).some((n: any) => n.type === 'MISSION_ACCEPTEE'));
});

test('DROITS : seul le technicien assigné répond ; ni un autre technicien, ni le bureau, ni une autre société', async () => {
  await call(PLANIF, 'PATCH', '/api/interventions/4', { entreprise: 'Karim' });
  assert.equal(row('intervention', 4).reponseTechnicien, 'EN_ATTENTE');
  const corps = { reponse: 'ACCEPTEE' };
  assert.equal((await call(SOFIA, 'POST', '/api/interventions/4/reponse', corps)).status, 403, 'autre technicien');
  assert.equal((await call(PLANIF, 'POST', '/api/interventions/4/reponse', corps)).status, 403, 'planificateur');
  assert.equal((await call(ADMIN, 'POST', '/api/interventions/4/reponse', corps)).status, 403, 'direction');
  assert.equal((await call(RAPPORTS, 'POST', '/api/interventions/4/reponse', corps)).status, 403, 'rapports');
  assert.equal((await call(TECH2, 'POST', '/api/interventions/4/reponse', corps)).status, 404, 'autre société');
  assert.equal((await call(KARIM, 'POST', '/api/interventions/9/reponse', corps)).status, 404, 'mission d\'une autre société');
  assert.equal(row('intervention', 4).reponseTechnicien, 'EN_ATTENTE', 'rien n\'a bougé');
});

test('démarrer la mission vaut acceptation', async () => {
  const r = await call(KARIM, 'PATCH', '/api/interventions/4', { statutOperationnel: 'En cours' });
  assert.equal(r.status, 200);
  assert.equal(row('intervention', 4).reponseTechnicien, 'ACCEPTEE');
  assert.match(row('intervention', 4).historiqueJson, /Automatique — mission acceptée/);
});

test('RELANCE : à 15 min une relance, 5 min plus tard une alerte au planificateur ET à la direction, jamais deux fois', async () => {
  const comp = { active: true, autoTechnicienActif: true, autoTechnicienDelaiMinutes: 15, autoTechnicienAlerteMinutes: 5, autoTechnicienHeuresBureau: true };
  db.intervention.rows.push(intv(20, {
    entreprise: 'Karim', statutOperationnel: 'Planifiée', reponseTechnicien: 'EN_ATTENTE', affecteLe: lundi(9), company: comp,
  }));
  const avant = notifsDe(KARIM).length;
  assert.deepEqual(await executer(lundi(9, 10)), { relances: 0, alertes: 0 });
  assert.deepEqual(await executer(lundi(9, 16)), { relances: 1, alertes: 0 });
  assert.equal(notifsDe(KARIM).length, avant + 1);
  assert.match(row('intervention', 20).historiqueJson, /Automatique — relance du technicien/);
  assert.match(row('intervention', 20).historiqueJson, /15 min/);
  assert.deepEqual(await executer(lundi(9, 18)), { relances: 0, alertes: 0 }, 'pas de seconde relance, alerte pas encore due');
  const nAlertesAvant = notifsDe(ADMIN).filter((n: any) => n.type === 'ALERTE_SANS_REPONSE').length;
  assert.deepEqual(await executer(lundi(9, 22)), { relances: 0, alertes: 1 });
  assert.ok(notifsDe(PLANIF).some((n: any) => n.type === 'ALERTE_SANS_REPONSE'));
  assert.equal(notifsDe(ADMIN).filter((n: any) => n.type === 'ALERTE_SANS_REPONSE').length, nAlertesAvant + 1, 'la direction aussi');
  assert.match(row('intervention', 20).historiqueJson, /Automatique — alerte au planificateur/);
  assert.deepEqual(await executer(lundi(17, 0)), { relances: 0, alertes: 0 }, 'une seule alerte');
});

test('la nuit : la relance part aussi (seul le dimanche est exclu)', async () => {
  db.intervention.rows.push(intv(22, {
    entreprise: 'Sofia', statutOperationnel: 'Planifiée', reponseTechnicien: 'EN_ATTENTE', affecteLe: lundi(21, 0),
    company: { active: true, autoTechnicienActif: true, autoTechnicienDelaiMinutes: 15, autoTechnicienAlerteMinutes: 5, autoTechnicienHeuresBureau: true },
  }));
  assert.deepEqual(await executer(lundi(21, 20)), { relances: 1, alertes: 0 });
  assert.ok(notifsDe(SOFIA).some((n: any) => n.type === 'RELANCE_TECHNICIEN'));
});

test('pause de fin de semaine : rien du samedi 17 h au lundi 6 h, la relance part le lundi à 6 h ; réglage désactivable', async () => {
  const comp = (pause: boolean) => ({ active: true, autoTechnicienActif: true, autoTechnicienDelaiMinutes: 15, autoTechnicienAlerteMinutes: 5, autoTechnicienHeuresBureau: pause });
  db.intervention.rows.push(intv(23, {
    entreprise: 'Sofia', statutOperationnel: 'Planifiée', reponseTechnicien: 'EN_ATTENTE', affecteLe: dimanche(0, 30), company: comp(true),
  }));
  assert.deepEqual(await executer(dimanche(10)), { relances: 0, alertes: 0 });
  assert.deepEqual(await executer(lundi(5, 59)), { relances: 0, alertes: 0 });
  assert.deepEqual(await executer(lundi(6, 0)), { relances: 1, alertes: 0 }, 'relance à 6 h');
  assert.deepEqual(await executer(lundi(6, 6)), { relances: 0, alertes: 1 }, 'alerte 5 min après');
  row('intervention', 23).reponseTechnicien = 'ACCEPTEE'; // referme l'attente pour les tests suivants

  db.intervention.rows.push(intv(24, {
    entreprise: 'Sofia', statutOperationnel: 'Planifiée', reponseTechnicien: 'EN_ATTENTE', affecteLe: dimanche(9), company: comp(false),
  }));
  assert.deepEqual(await executer(dimanche(10)), { relances: 1, alertes: 0 }, 'sans pause, ça part aussi le dimanche');
  row('intervention', 24).reponseTechnicien = 'ACCEPTEE';
});

test('réglage société : automatisation désactivée → aucune attente ouverte, aucune relance', async () => {
  row('company', 1).autoTechnicienActif = false;
  await call(PLANIF, 'PATCH', '/api/interventions/5', { entreprise: 'Sofia' });
  assert.equal(row('intervention', 5).reponseTechnicien ?? null, null);
  db.intervention.rows.push(intv(21, {
    entreprise: 'Karim', statutOperationnel: 'Planifiée', reponseTechnicien: 'EN_ATTENTE', affecteLe: lundi(8, 30),
    company: { active: true, autoTechnicienActif: false, autoTechnicienDelaiMinutes: 15 },
  }));
  assert.deepEqual(await executer(lundi(15, 0)), { relances: 0, alertes: 0 });
  row('company', 1).autoTechnicienActif = true;
});

test('NOTIFICATIONS : chacun ne voit et ne marque que les siennes', async () => {
  const mine = await call(KARIM, 'GET', '/api/notifications');
  assert.equal(mine.status, 200);
  assert.ok(mine.json.data.length > 0);
  assert.ok(mine.json.data.every((n: any) => notifsDe(KARIM).some((x: any) => x.id === n.id)));
  assert.ok(mine.json.nonLues > 0);
  // Le technicien d'une autre société ne voit rien de la société 1
  assert.equal((await call(TECH2, 'GET', '/api/notifications')).json.data.length, 0);
  // Marquer la notification de quelqu'un d'autre : refusé
  const autre = notifsDe(PLANIF)[0];
  assert.equal((await call(KARIM, 'POST', `/api/notifications/${autre.id}/lire`)).status, 404);
  assert.equal(autre.lu, false);
  // Les siennes : lu
  const sienne = mine.json.data[0];
  assert.equal((await call(KARIM, 'POST', `/api/notifications/${sienne.id}/lire`)).status, 200);
  assert.equal((await call(KARIM, 'POST', '/api/notifications/lire-tout')).status, 200);
  assert.equal((await call(KARIM, 'GET', '/api/notifications')).json.nonLues, 0);
  assert.ok(notifsDe(PLANIF).some((n: any) => !n.lu), 'les notifications du planificateur restent non lues');
});
