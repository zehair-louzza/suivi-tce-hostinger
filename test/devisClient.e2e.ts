// Automatisation B (devis client) — vraies routes (internes + page publique) + vrai service, base simulée à DEUX sociétés.
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
let executer: (d?: Date) => Promise<{ relances: number; expires: number }>;
const mails: Array<{ to: string; lien: string; relance: string | null | undefined }> = [];

const paris = (jour: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, jour, h - 1, m));
const user = (id: number, role: string, o: Record<string, any> = {}) => ({
  id, companyId: 1, email: `u${id}@test.fr`, name: `${role}-${id}`, role, active: true, technicienNom: null, permissionsJson: null, ...o,
});
const dev = (id: number, o: Record<string, any> = {}) => ({
  id, companyId: 1, referenceMetier: `DEV-${id}`, client: 'Groupe Atlas', siteAdresse: '3 rue Y', objet: 'Rénovation tableau',
  statutCommercial: 'À valider en interne', amount: 5000, montantHt: 5000, tauxTVA: 20, userId: 102, historiqueJson: '[]',
  visiteTechnicien: '', version: 1, company: { active: true, autoDevisActif: true }, ...o,
});
const ADMIN = 101, CHIFFRAGE = 102, PLANIF = 103, RAPPORTS = 104, TECH = 105, ADMIN2 = 201;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF').toString('base64');

before(async () => {
  db.company.seed([
    { id: 1, name: 'Société 1', active: true, autoDevisActif: true },
    { id: 2, name: 'Société 2', active: true, autoDevisActif: true },
  ]);
  db.user.seed([
    user(ADMIN, 'ADMIN'), user(CHIFFRAGE, 'CHIFFRAGE_DEVIS'), user(PLANIF, 'CONDUCTEUR_TRAVAUX'),
    user(RAPPORTS, 'REDACTEUR_RAPPORTS'), user(TECH, 'TECHNICIEN', { technicienNom: 'Karim' }), user(ADMIN2, 'ADMIN', { companyId: 2 }),
  ]);
  db.devis.seed([
    dev(1), dev(2, { client: 'Solo SA' }), dev(3, { client: 'Sans Fiche' }), dev(4), dev(5), dev(6),
    dev(9, { companyId: 2, client: 'Groupe Atlas', company: { active: true, autoDevisActif: true } }),
  ]);
  db.intervention.seed([]);
  db.notification.seed([]);
  db.referentiel.seed([
    {
      id: 1, companyId: 1, categorie: 'clients_fiches',
      valeurs: JSON.stringify([
        { id: 'a', nom: 'Groupe Atlas', type: 'ENTREPRISE', email: 'contact@atlas.fr', active: true,
          services: [{ id: 's1', nomService: 'Travaux', email: 'travaux@atlas.fr', recevoirDevis: true }, { id: 's2', nomService: 'Compta', email: 'compta@atlas.fr' }] },
        { id: 'b', nom: 'Solo SA', type: 'ENTREPRISE', email: 'seul@solo.fr', active: true },
      ]),
    },
  ]);

  const { setSocketInstance } = await import('../server/socket/index.js');
  setSocketInstance({ to: () => ({ emit() {} }), emit() {} } as any);
  const { config } = await import('../server/config.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const { errorHandler } = await import('../server/middleware/errorHandler.js');
  const { devisRouter } = await import('../server/routes/devis.js');
  const { devisClientPublicRouter } = await import('../server/routes/devisClientPublic.js');
  const svc = await import('../server/services/devisClient.js');
  executer = svc.executerAutomatisationsDevis;
  svc.courrier.envoyerLien = (async (p: any) => {
    mails.push({ to: p.toEmail, lien: p.lien, relance: p.relance });
    return { sent: true, channel: 'test' };
  }) as any;

  for (const u of db.user.rows) {
    tokens[u.id] = jwt.sign({ userId: u.id, email: u.email, role: u.role, companyId: u.companyId }, config.jwtSecret, { expiresIn: '1h' });
  }
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(cookieParser(config.cookieSecret));
  app.use('/api/devis', authMiddleware, devisRouter);
  app.use('/api/public/devis', devisClientPublicRouter);
  app.use(errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server?.close());

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
const row = (table: string, id: number) => db[table].rows.find((r: any) => r.id === id);
const notifsDe = (userId: number, type?: string) => db.notification.rows.filter((n: any) => n.userId === userId && (!type || n.type === type));
const jetonDe = (lienUrl: string) => lienUrl.split('/devis-client/')[1];
const deposer = (as: number, id: number) => call(as, 'POST', `/api/devis/${id}/document`, { nomFichier: 'devis.pdf', contenuBase64: PDF });

test('DÉPÔT PDF : réservé au chiffrage et à la direction ; seul un vrai PDF passe ; cloisonné par société', async () => {
  for (const who of [PLANIF, RAPPORTS, TECH]) assert.equal((await deposer(who, 1)).status, 403, `rôle ${who}`);
  assert.equal((await call(CHIFFRAGE, 'POST', '/api/devis/1/document', { nomFichier: 'devis.exe', contenuBase64: PDF })).status, 400);
  assert.equal((await call(CHIFFRAGE, 'POST', '/api/devis/1/document', { nomFichier: 'devis.pdf', contenuBase64: Buffer.from('MZ-pas-un-pdf').toString('base64') })).status, 400);
  assert.equal((await deposer(ADMIN2, 1)).status, 404, 'autre société');
  const ok = await deposer(CHIFFRAGE, 1);
  assert.equal(ok.status, 201);
  assert.equal(ok.json.data.nomFichier, 'devis.pdf');
  assert.equal(ok.json.data.contenu, undefined, 'le contenu ne revient jamais dans la réponse');
  assert.match(row('devis', 1).historiqueJson, /PDF du devis déposé/);
  const dl = await fetch(`${base}/api/devis/1/document`, { headers: { authorization: `Bearer ${tokens[ADMIN]}` } });
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get('content-type'), 'application/pdf');
  assert.equal((await dl.arrayBuffer()).byteLength, Buffer.from(PDF, 'base64').length);
  assert.equal((await fetch(`${base}/api/devis/1/document`, { headers: { authorization: `Bearer ${tokens[TECH]}` } })).status, 403);
});

test('ENVOI : PDF requis, confirmation requise, adresses issues de la fiche client, choix demandé s\'il y en a plusieurs', async () => {
  assert.equal((await call(PLANIF, 'POST', '/api/devis/1/envoyer-client', { confirme: true })).status, 403);
  assert.equal((await call(ADMIN2, 'POST', '/api/devis/1/envoyer-client', { confirme: true })).status, 404);
  const sansPdfDepose = await call(CHIFFRAGE, 'POST', '/api/devis/4/envoyer-client', { confirme: true, source: 'DEPOSE', emails: ['travaux@atlas.fr'] });
  assert.equal(sansPdfDepose.status, 422);
  assert.equal(sansPdfDepose.json.code, 'DOCUMENT_REQUIS');
  assert.equal((await call(CHIFFRAGE, 'POST', '/api/devis/1/envoyer-client', { emails: ['travaux@atlas.fr'] })).status, 400, 'confirmation requise');

  const suivi = await call(CHIFFRAGE, 'GET', '/api/devis/1/envoi-client');
  assert.equal(suivi.status, 200);
  assert.deepEqual(suivi.json.data.adresses.map((a: any) => a.email), ['travaux@atlas.fr', 'compta@atlas.fr', 'contact@atlas.fr']);
  assert.equal((await call(TECH, 'GET', '/api/devis/1/envoi-client')).status, 403);

  const plusieurs = await call(CHIFFRAGE, 'POST', '/api/devis/1/envoyer-client', { confirme: true });
  assert.equal(plusieurs.status, 422);
  assert.equal(plusieurs.json.code, 'CONFIRMATION_REQUISE');
  const inconnue = await call(CHIFFRAGE, 'POST', '/api/devis/1/envoyer-client', { confirme: true, emails: ['pirate@evil.com'] });
  assert.equal(inconnue.json.code, 'ADRESSE_INCONNUE');
  assert.equal(mails.length, 0, 'rien n\'est parti');

  // Client sans fiche : on ne devine pas d'adresse
  await deposer(CHIFFRAGE, 3);
  assert.equal((await call(CHIFFRAGE, 'POST', '/api/devis/3/envoyer-client', { confirme: true, emails: ['x@y.fr'] })).json.code, 'AUCUNE_ADRESSE');

  // Une seule adresse sur la fiche : envoi direct, sans choix
  await deposer(CHIFFRAGE, 2);
  const unique = await call(CHIFFRAGE, 'POST', '/api/devis/2/envoyer-client', { confirme: true });
  assert.equal(unique.status, 200);
  assert.deepEqual(mails.map((m) => m.to), ['seul@solo.fr']);

  const ok = await call(CHIFFRAGE, 'POST', '/api/devis/1/envoyer-client', { confirme: true, emails: ['Travaux@atlas.fr'] });
  assert.equal(ok.status, 200);
  assert.equal(mails.length, 2);
  assert.equal(mails[1].to, 'travaux@atlas.fr');
  assert.equal(row('devis', 1).statutCommercial, 'Envoyé au client');
  assert.ok(row('devis', 1).envoiClientLe);
  assert.ok(row('devis', 1).dateEnvoi);
  assert.ok(row('devis', 1).dateRelance);
  assert.equal(row('devis', 1).traitement, 'En attente client');
  assert.equal(ok.json.data.statutCommercial, 'Envoyé au client');
  assert.ok(ok.json.data.dateEnvoi);
  assert.ok(ok.json.data.dateRelance);
  assert.match(row('devis', 1).historiqueJson, /envoyé au client par lien sécurisé/);
  // Le jeton n'est jamais stocké en clair
  assert.ok(!JSON.stringify(db.devisLienClient.rows).includes(jetonDe(mails[1].lien)));
});

test('PAGE PUBLIQUE : le lien ouvre le bon devis ; un jeton falsifié ou d\'un autre devis n\'ouvre rien', async () => {
  const jeton = jetonDe(mails[1].lien);
  const page = await call(null, 'GET', `/api/public/devis/${jeton}`);
  assert.equal(page.status, 200);
  assert.equal(page.json.data.reference, 'DEV-1');
  assert.equal(page.json.data.montantHt, 5000);
  assert.equal(page.json.data.montantTtc, 6000);
  assert.equal(page.json.data.societe, 'Société 1');
  assert.equal(JSON.stringify(page.json).includes('historique'), false, 'aucun champ interne');
  const pdf = await fetch(`${base}/api/public/devis/${jeton}/document`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');

  const [id, sig] = jeton.split('.');
  assert.equal((await call(null, 'GET', `/api/public/devis/${id}.${sig.slice(0, -2)}xx`)).status, 404, 'signature falsifiée');
  assert.equal((await call(null, 'GET', `/api/public/devis/${Number(id) + 1}.${sig}`)).status, 404, 'signature d\'un autre lien');
  assert.equal((await call(null, 'GET', '/api/public/devis/n-importe-quoi')).status, 404);
  assert.equal((await call(null, 'POST', `/api/public/devis/${id}.${sig.slice(0, -2)}xx/reponse`, { reponse: 'ACCEPTEE', nom: 'Pirate' })).status, 404);
});

test('RÉPONSE : acceptation à usage unique, statut du devis, planificateur prévenu, aucune intervention créée', async () => {
  const jeton = jetonDe(mails[1].lien);
  const sans = await call(null, 'POST', `/api/public/devis/${jeton}/reponse`, { reponse: 'ACCEPTEE', nom: '' });
  assert.equal(sans.status, 400);
  const [a, b] = await Promise.all([
    call(null, 'POST', `/api/public/devis/${jeton}/reponse`, { reponse: 'ACCEPTEE', nom: 'M. Durand' }),
    call(null, 'POST', `/api/public/devis/${jeton}/reponse`, { reponse: 'REFUSEE', nom: 'M. Durand', motif: 'Trop cher' }),
  ]);
  assert.equal(Math.min(a.status, b.status), 200);
  assert.ok([404, 409].includes(Math.max(a.status, b.status)), 'une seule réponse est retenue');
  const statut = row('devis', 1).statutCommercial;
  assert.ok(['Accepté', 'Refusé'].includes(statut));
  if (statut === 'Accepté') {
    assert.ok(notifsDe(PLANIF, 'DEVIS_ACCEPTE').length === 1, 'le planificateur est prévenu');
    assert.match(notifsDe(PLANIF, 'DEVIS_ACCEPTE')[0].message, /à transformer en intervention/i);
    assert.equal(row('devis', 1).prochaineAction, 'Planifier les travaux');
  } else {
    assert.equal(notifsDe(PLANIF, 'DEVIS_REFUSE').length, 0, 'un refus ne concerne pas le planificateur');
  }
  assert.ok(notifsDe(ADMIN).length >= 1);
  assert.equal(db.intervention.rows.length, 0, 'aucune intervention créée automatiquement');
  assert.equal(notifsDe(TECH).length, 0);
  assert.equal((await call(null, 'POST', `/api/public/devis/${jeton}/reponse`, { reponse: 'ACCEPTEE', nom: 'M. Durand' })).status, 404, 'déjà utilisé');
  const apres = await call(null, 'GET', `/api/public/devis/${jeton}`);
  assert.equal(apres.json.data.etat, 'repondu');
  assert.match(row('devis', 1).historiqueJson, /M\. Durand/);
});

test('REFUS et MODIFICATION : motif obligatoire, statuts « Refusé » et « En négociation »', async () => {
  // Envoi direct sans aucun PDF externe déposé : l'application génère automatiquement le PDF du devis (source=GENERE par défaut)
  const apercu = await fetch(`${base}/api/devis/4/apercu`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[CHIFFRAGE]}` },
    body: JSON.stringify({ inclureVisite: true }),
  });
  assert.equal(apercu.status, 200);
  assert.equal(Buffer.from(await apercu.arrayBuffer()).subarray(0, 5).toString('latin1'), '%PDF-');

  const autoEnvoye = await call(CHIFFRAGE, 'POST', '/api/devis/4/envoyer-client', { confirme: true, emails: ['compta@atlas.fr'] });
  assert.equal(autoEnvoye.status, 200);
  const dlAuto = await fetch(`${base}/api/devis/4/document?origine=GENERE`, { headers: { authorization: `Bearer ${tokens[CHIFFRAGE]}` } });
  assert.equal(dlAuto.status, 200);
  assert.equal(Buffer.from(await dlAuto.arrayBuffer()).subarray(0, 5).toString('latin1'), '%PDF-');
  const j4 = jetonDe(mails[mails.length - 1].lien);
  assert.equal((await call(null, 'POST', `/api/public/devis/${j4}/reponse`, { reponse: 'REFUSEE', nom: 'Durand' })).status, 400, 'motif requis');
  assert.equal((await call(null, 'POST', `/api/public/devis/${j4}/reponse`, { reponse: 'REFUSEE', nom: 'Durand', motif: 'Budget gelé' })).status, 200);
  assert.equal(row('devis', 4).statutCommercial, 'Refusé');
  assert.ok(notifsDe(CHIFFRAGE, 'DEVIS_REFUSE').length >= 1);

  await deposer(CHIFFRAGE, 5);
  await call(CHIFFRAGE, 'POST', '/api/devis/5/envoyer-client', { confirme: true, emails: ['compta@atlas.fr'] });
  const j5 = jetonDe(mails[mails.length - 1].lien);
  assert.equal((await call(null, 'POST', `/api/public/devis/${j5}/reponse`, { reponse: 'MODIFICATION', nom: 'Durand', motif: 'Ajouter le remplacement du disjoncteur' })).status, 200);
  assert.equal(row('devis', 5).statutCommercial, 'En négociation');
  assert.ok(notifsDe(CHIFFRAGE, 'DEVIS_MODIFICATION').length >= 1);
});

test('DEVIS MODIFIÉ APRÈS ENVOI : le lien est révoqué ; un nouveau PDF aussi ; renvoyer remplace l\'ancien lien', async () => {
  await deposer(CHIFFRAGE, 6);
  await call(CHIFFRAGE, 'POST', '/api/devis/6/envoyer-client', { confirme: true, emails: ['compta@atlas.fr'] });
  const ancien = jetonDe(mails[mails.length - 1].lien);
  assert.equal((await call(null, 'GET', `/api/public/devis/${ancien}`)).status, 200);

  assert.equal((await call(ADMIN, 'PATCH', '/api/devis/6', { notes: 'simple note interne' })).status, 200);
  assert.equal((await call(null, 'GET', `/api/public/devis/${ancien}`)).status, 200, 'une note interne ne révoque pas');

  assert.equal((await call(ADMIN, 'PATCH', '/api/devis/6', { montantHt: 9999, amount: 9999 })).status, 200);
  assert.equal((await call(null, 'GET', `/api/public/devis/${ancien}`)).status, 404, 'montant modifié : lien révoqué');
  assert.equal((await call(null, 'POST', `/api/public/devis/${ancien}/reponse`, { reponse: 'ACCEPTEE', nom: 'Durand' })).status, 404);
  assert.match(row('devis', 6).historiqueJson, /lien client révoqué/);

  await call(CHIFFRAGE, 'POST', '/api/devis/6/envoyer-client', { confirme: true, emails: ['compta@atlas.fr'] });
  const nouveau = jetonDe(mails[mails.length - 1].lien);
  assert.notEqual(nouveau, ancien);
  assert.equal((await call(null, 'GET', `/api/public/devis/${nouveau}`)).json.data.montantHt, 9999);

  // Nouveau PDF déposé : le lien envoyé porte sur l'ancienne version
  const r = await deposer(CHIFFRAGE, 6);
  assert.equal(r.json.lienRevoque, true);
  assert.equal((await call(null, 'GET', `/api/public/devis/${nouveau}`)).status, 404);
  // Renvoi : un seul lien actif à la fois
  await call(CHIFFRAGE, 'POST', '/api/devis/6/envoyer-client', { confirme: true, emails: ['compta@atlas.fr'] });
  const actifs = db.devisLienClient.rows.filter((l: any) => l.devisId === 6 && !l.reponse && !l.revoqueLe);
  assert.equal(actifs.length, 1);
});

test('RELANCES : J+3 puis J+7, jamais deux fois, pas la nuit ni le dimanche, expiration à 30 jours ; rien après réponse ; désactivable', async () => {
  // Les devis envoyés par les tests précédents (date réelle) sortent du scénario
  for (const id of [2, 6]) row('devis', id).statutCommercial = 'Accepté';
  // Devis 7 envoyé le lundi 9 nov. à 10 h
  db.devis.rows.push(dev(7, { statutCommercial: 'Envoyé au client', envoiClientLe: paris(9, 10), relanceClientJ3Le: null, relanceClientJ7Le: null }));
  db.devisLienClient.rows.push({ id: 700, companyId: 1, devisId: 7, documentId: 1, sel: 'abc', destinataires: JSON.stringify(['compta@atlas.fr', 'travaux@atlas.fr']), expireLe: paris(9 + 30, 10), reponse: null, revoqueLe: null, createdAt: paris(9, 10) });
  const avant = mails.length;

  assert.deepEqual(await executer(paris(11, 10)), { relances: 0, expires: 0 }, 'J+2');
  assert.deepEqual(await executer(paris(12, 22)), { relances: 0, expires: 0 }, 'J+3 mais de nuit');
  assert.deepEqual(await executer(paris(12, 10)), { relances: 1, expires: 0 }, 'J+3');
  assert.equal(mails.length - avant, 2, 'une relance par adresse confirmée');
  assert.ok(mails.slice(avant).every((m) => m.relance === 'J3'));
  assert.equal(new Set(mails.slice(avant).map((m) => m.lien)).size, 1, 'même lien que l\'envoi');
  assert.match(row('devis', 7).historiqueJson, /Automatique — relance J\+3/);
  assert.deepEqual(await executer(paris(13, 10)), { relances: 0, expires: 0 }, 'jamais deux fois');
  assert.deepEqual(await executer(paris(15, 10)), { relances: 0, expires: 0 }, 'dimanche');
  assert.deepEqual(await executer(paris(16, 10)), { relances: 1, expires: 0 }, 'J+7');
  assert.ok(mails.slice(avant).some((m) => m.relance === 'J7'));
  assert.deepEqual(await executer(paris(17, 10)), { relances: 0, expires: 0 });
  assert.equal(row('devis', 7).statutCommercial, 'Envoyé au client', 'une relance ne change jamais le statut');

  // Expiration à 30 jours : statut « Expiré », lien fermé, rien n'est supprimé
  assert.deepEqual(await executer(paris(9 + 30, 10)), { relances: 0, expires: 1 });
  assert.equal(row('devis', 7).statutCommercial, 'Expiré');
  assert.ok(row('devisLienClient', 700).revoqueLe);
  assert.match(row('devis', 7).historiqueJson, /Automatique — devis expiré/);
  assert.ok(notifsDe(CHIFFRAGE, 'DEVIS_EXPIRE').length >= 1);
  assert.ok(db.devis.rows.some((d: any) => d.id === 7), 'aucune suppression');
  assert.deepEqual(await executer(paris(9 + 31, 10)), { relances: 0, expires: 0 });

  // Société qui a désactivé l'automatisation : rien ne part
  db.devis.rows.push(dev(8, { statutCommercial: 'Envoyé au client', envoiClientLe: paris(2, 10), company: { active: true, autoDevisActif: false } }));
  db.devisLienClient.rows.push({ id: 800, companyId: 1, devisId: 8, sel: 'z', destinataires: JSON.stringify(['compta@atlas.fr']), expireLe: paris(32, 10), reponse: null, revoqueLe: null, createdAt: paris(2, 10) });
  const m0 = mails.length;
  assert.deepEqual(await executer(paris(12, 10)), { relances: 0, expires: 0 });
  assert.equal(mails.length, m0);
});

test('ISOLATION : le devis d\'une autre société ne se voit ni ne s\'envoie', async () => {
  assert.equal((await call(ADMIN2, 'GET', '/api/devis/1/envoi-client')).status, 404);
  assert.equal((await call(ADMIN, 'GET', '/api/devis/9/envoi-client')).status, 404);
  assert.equal((await call(ADMIN, 'POST', '/api/devis/9/envoyer-client', { confirme: true })).status, 404);
  assert.equal((await fetch(`${base}/api/devis/9/document`, { headers: { authorization: `Bearer ${tokens[ADMIN]}` } })).status, 404);
});
