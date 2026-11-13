// Automatisation C — vraies routes (internes + page publique) + vrai service, base simulée à DEUX sociétés.
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
const ADMIN = 101, CHIFFRAGE = 102, PLANIF = 103, RAPPORTS = 104, TECH = 105, ADMIN2 = 201;
const user = (id: number, role: string, o: Record<string, any> = {}) => ({
  id, companyId: 1, email: `u${id}@test.fr`, name: `${role}-${id}`, role, active: true, technicienNom: null, permissionsJson: null, ...o,
});
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photos = () => JSON.stringify([
  { id: 'p1', url: PNG, caption: 'Avant', category: 'AVANT' },
  { id: 'p2', url: PNG, caption: 'Pendant', category: 'Terrain' },
  { id: 'p3', url: PNG, caption: 'Après', category: 'APRES' },
  { id: 'p4', url: 'https://interne.exemple/photo.jpg', caption: 'Externe' },
]);
const intv = (id: number, o: Record<string, any> = {}) => ({
  id, companyId: 1, referenceMetier: `INT-${id}`, client: 'Groupe Atlas', chantier: 'Fuite chaufferie', siteAdresse: '3 rue Y',
  objet: 'Fuite', corpsEtat: 'Plomberie', typeIntervention: 'Dépannage', statutOperationnel: 'Clôturée', datePlanifiee: new Date('2026-11-03'),
  dateReelle: new Date('2026-11-03'), entreprise: 'Karim', userId: 103, amount: 1500, notes: 'note interne', historiqueJson: '[]',
  rapportFinal: 'Joint remplacé, pression contrôlée.', actionsRealiseesJson: JSON.stringify(['Remplacement du joint', 'Contrôle étanchéité']),
  photosJson: photos(), statutRapport: 'Validé & Clôturé', version: 1, company: { active: true, autoRapportActif: true }, ...o,
});
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF').toString('base64');

before(async () => {
  db.company.seed([
    { id: 1, name: 'Société 1', active: true, autoRapportActif: true },
    { id: 2, name: 'Société 2', active: true, autoRapportActif: true },
  ]);
  db.user.seed([
    user(ADMIN, 'ADMIN'), user(CHIFFRAGE, 'CHIFFRAGE_DEVIS'), user(PLANIF, 'CONDUCTEUR_TRAVAUX'),
    user(RAPPORTS, 'REDACTEUR_RAPPORTS'), user(TECH, 'TECHNICIEN', { technicienNom: 'Karim' }), user(ADMIN2, 'ADMIN', { companyId: 2 }),
  ]);
  db.intervention.seed([
    intv(1), intv(2, { statutRapport: 'Brouillon' }), intv(3, { client: 'Solo SA' }), intv(4, { client: 'Sans Fiche' }),
    intv(5), intv(6), intv(7), intv(8),
    intv(9, { companyId: 2, company: { active: true, autoRapportActif: true } }),
  ]);
  db.devis.seed([]);
  db.notification.seed([]);
  db.referentiel.seed([
    {
      id: 1, companyId: 1, categorie: 'clients_fiches',
      valeurs: JSON.stringify([
        { id: 'a', nom: 'Groupe Atlas', type: 'ENTREPRISE', email: 'contact@atlas.fr', active: true,
          services: [{ id: 's1', nomService: 'Travaux', email: 'travaux@atlas.fr', recevoirRapports: true }, { id: 's2', nomService: 'Compta', email: 'compta@atlas.fr', recevoirRapports: false }] },
        { id: 'b', nom: 'Solo SA', type: 'ENTREPRISE', email: 'seul@solo.fr', active: true },
      ]),
    },
  ]);

  const { setSocketInstance } = await import('../server/socket/index.js');
  setSocketInstance({ to: () => ({ emit() {} }), emit() {} } as any);
  const { config } = await import('../server/config.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const { errorHandler } = await import('../server/middleware/errorHandler.js');
  const { interventionRouter } = await import('../server/routes/interventions.js');
  const { rapportClientPublicRouter } = await import('../server/routes/rapportClientPublic.js');
  const svc = await import('../server/services/rapportClient.js');
  executer = svc.executerAutomatisationsRapport;
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
  app.use('/api/interventions', authMiddleware, interventionRouter);
  app.use('/api/public/rapport', rapportClientPublicRouter);
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
const jetonDe = (lienUrl: string) => lienUrl.split('/rapport-client/')[1];
const envoyer = (as: number, id: number, body: Record<string, any> = {}) =>
  call(as, 'POST', `/api/interventions/${id}/rapport-envoyer-client`, { confirme: true, ...body });
const dernierMail = () => mails[mails.length - 1];

test('DÉPÔT PDF : direction / rédacteur / planificateur ; jamais le technicien ni une autre société ; seul un vrai PDF passe', async () => {
  const depose = (as: number, id = 1) => call(as, 'POST', `/api/interventions/${id}/rapport-document`, { nomFichier: 'rapport.pdf', contenuBase64: PDF });
  assert.equal((await depose(TECH)).status, 403);
  assert.equal((await depose(CHIFFRAGE)).status, 403);
  assert.equal((await depose(ADMIN2)).status, 404, 'autre société');
  assert.equal((await call(RAPPORTS, 'POST', '/api/interventions/1/rapport-document', { nomFichier: 'x.exe', contenuBase64: PDF })).status, 400);
  assert.equal((await call(RAPPORTS, 'POST', '/api/interventions/1/rapport-document', { nomFichier: 'x.pdf', contenuBase64: Buffer.from('MZ-pas-un-pdf').toString('base64') })).status, 400);
  const ok = await depose(RAPPORTS);
  assert.equal(ok.status, 201);
  assert.equal(ok.json.data.contenu, undefined, 'le contenu ne revient jamais');
  assert.equal(ok.json.data.origine, 'DEPOSE');
  assert.match(row('intervention', 1).historiqueJson, /PDF du rapport déposé/);
  const dl = await fetch(`${base}/api/interventions/1/rapport-document`, { headers: { authorization: `Bearer ${tokens[ADMIN]}` } });
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get('content-type'), 'application/pdf');
  assert.equal((await fetch(`${base}/api/interventions/1/rapport-document`, { headers: { authorization: `Bearer ${tokens[TECH]}` } })).status, 403);
});

test('STATUTS RÉSERVÉS AU CLIENT : personne ne peut saisir « Validé par le client » ou « Réserves client » à la main', async () => {
  for (const s of ['Validé par le client', 'Réserves client']) {
    for (const who of [ADMIN, RAPPORTS, PLANIF]) {
      const r = await call(who, 'PATCH', '/api/interventions/6', { statutRapport: s });
      assert.equal(r.status, 403, `${s} par ${who}`);
    }
    assert.equal((await call(ADMIN, 'POST', '/api/interventions', { chantier: 'x', client: 'y', datePlanifiee: '2026-12-01', statutRapport: s })).status, 403);
  }
  assert.equal(row('intervention', 6).statutRapport, 'Validé & Clôturé');
  assert.equal((await call(ADMIN, 'PATCH', '/api/interventions/6', { statutRapport: 'Validé & Clôturé' })).status, 200, 'les autres statuts restent libres');
});

test('ENVOI : validation interne, confirmation, adresses de la fiche client, choix demandé s\'il y en a plusieurs', async () => {
  assert.equal((await envoyer(TECH, 1)).status, 403);
  assert.equal((await envoyer(CHIFFRAGE, 1)).status, 403);
  assert.equal((await envoyer(ADMIN2, 1)).status, 404);
  const brouillon = await envoyer(ADMIN, 2, { emails: ['travaux@atlas.fr'] });
  assert.equal(brouillon.status, 409);
  assert.equal(brouillon.json.code, 'VALIDATION_INTERNE_REQUISE');
  assert.equal((await call(ADMIN, 'POST', '/api/interventions/1/rapport-envoyer-client', { emails: ['travaux@atlas.fr'] })).status, 400, 'confirmation requise');

  const suivi = await call(RAPPORTS, 'GET', '/api/interventions/1/rapport-client');
  assert.equal(suivi.status, 200);
  assert.deepEqual(suivi.json.data.adresses.map((a: any) => a.email), ['travaux@atlas.fr', 'compta@atlas.fr', 'contact@atlas.fr']);
  assert.deepEqual(suivi.json.data.adresses.filter((a: any) => a.suggeree).map((a: any) => a.email), ['travaux@atlas.fr'], 'service « reçoit les rapports »');
  assert.deepEqual(suivi.json.data.photos.map((p: any) => p.id), ['p1', 'p2', 'p3'], 'seules les photos transmissibles sont proposées');
  assert.equal(suivi.json.data.nbPhotosTotal, 4);
  assert.ok(JSON.stringify(suivi.json).indexOf('base64') === -1, 'aucune image dans le suivi');
  assert.equal(suivi.json.data.envoiPossible, true);
  assert.equal((await call(TECH, 'GET', '/api/interventions/1/rapport-client')).status, 403);

  assert.equal((await envoyer(ADMIN, 1)).json.code, 'CONFIRMATION_REQUISE');
  assert.equal((await envoyer(ADMIN, 1, { emails: ['pirate@evil.com'] })).json.code, 'ADRESSE_INCONNUE');
  assert.equal((await envoyer(ADMIN, 1, { emails: ['travaux@atlas.fr'], photoIds: ['p1', 'zzz'] })).json.code, 'PHOTO_INCONNUE');
  assert.equal((await envoyer(ADMIN, 1, { emails: ['travaux@atlas.fr'], photoIds: ['p4'] })).json.code, 'PHOTO_INCONNUE', 'photo non transmissible');
  assert.equal((await envoyer(ADMIN, 4, { emails: ['x@y.fr'] })).json.code, 'AUCUNE_ADRESSE');
  assert.equal(mails.length, 0, 'rien n\'est parti');
  assert.equal(row('intervention', 1).statutRapport, 'Validé & Clôturé', 'statut inchangé tant que rien n\'est envoyé');

  // Une seule adresse sur la fiche : envoi direct
  const unique = await envoyer(PLANIF, 3, { toutesPhotos: true });
  assert.equal(unique.status, 200);
  assert.deepEqual(mails.map((m) => m.to), ['seul@solo.fr']);
});

test('PHOTOS : seules les photos cochées sont transmises ; « Tout cocher » les transmet toutes', async () => {
  const ok = await envoyer(ADMIN, 1, { emails: ['Travaux@atlas.fr'], photoIds: ['p3', 'p1'], source: 'GENERE' });
  assert.equal(ok.status, 200);
  assert.equal(dernierMail().to, 'travaux@atlas.fr');
  assert.equal(row('intervention', 1).statutRapport, 'Envoyé au client');
  assert.ok(row('intervention', 1).envoiClientLe);
  assert.match(row('intervention', 1).historiqueJson, /Rapport envoyé au client par lien sécurisé/);
  assert.equal(db.rapportDocument.rows.filter((d: any) => d.interventionId === 1 && d.origine === 'GENERE').length, 1, 'PDF généré et conservé');
  assert.ok(!JSON.stringify(db.rapportLienClient.rows).includes(jetonDe(dernierMail().lien)), 'jeton jamais stocké en clair');

  const jeton = jetonDe(dernierMail().lien);
  const page = await call(null, 'GET', `/api/public/rapport/${jeton}`);
  assert.equal(page.status, 200);
  assert.deepEqual(page.json.data.contenu.photos.map((p: any) => p.id), ['p1', 'p3']);
  assert.equal(page.json.data.contenu.reference, 'INT-1');
  assert.equal(page.json.data.contenu.rapport, 'Joint remplacé, pression contrôlée.');
  assert.deepEqual(page.json.data.contenu.actionsRealisees, ['Remplacement du joint', 'Contrôle étanchéité']);
  assert.equal(page.json.data.societe, 'Société 1');
  const brut = JSON.stringify(page.json);
  for (const interdit of ['note interne', 'historique', 'amount', 'base64', 'Karim', 'userId']) assert.ok(!brut.includes(interdit), `ne doit pas exposer ${interdit}`);

  const p1 = await fetch(`${base}/api/public/rapport/${jeton}/photos/p1`);
  assert.equal(p1.status, 200);
  assert.equal(p1.headers.get('content-type'), 'image/png');
  assert.equal((await fetch(`${base}/api/public/rapport/${jeton}/photos/p2`)).status, 404, 'photo non cochée');
  assert.equal((await fetch(`${base}/api/public/rapport/${jeton}/photos/p4`)).status, 404, 'photo non transmissible');
  const pdf = await fetch(`${base}/api/public/rapport/${jeton}/document`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString('latin1'), '%PDF-');

  const toutes = await envoyer(ADMIN, 5, { emails: ['travaux@atlas.fr'], toutesPhotos: true });
  assert.equal(toutes.status, 200);
  const pageToutes = await call(null, 'GET', `/api/public/rapport/${jetonDe(dernierMail().lien)}`);
  assert.deepEqual(pageToutes.json.data.contenu.photos.map((p: any) => p.id), ['p1', 'p2', 'p3']);
  const aucune = await envoyer(ADMIN, 6, { emails: ['travaux@atlas.fr'] });
  assert.equal(aucune.status, 200);
  assert.deepEqual((await call(null, 'GET', `/api/public/rapport/${jetonDe(dernierMail().lien)}`)).json.data.contenu.photos, []);
});

test('PAGE PUBLIQUE : un jeton falsifié ou d\'un autre rapport n\'ouvre rien', async () => {
  const [id, sig] = jetonDe(mails.find((m) => m.to === 'travaux@atlas.fr')!.lien).split('.');
  assert.equal((await call(null, 'GET', `/api/public/rapport/${id}.${sig.slice(0, -2)}xx`)).status, 404);
  assert.equal((await call(null, 'GET', `/api/public/rapport/${Number(id) + 1}.${sig}`)).status, 404);
  assert.equal((await call(null, 'GET', '/api/public/rapport/n-importe-quoi')).status, 404);
  assert.equal((await call(null, 'POST', `/api/public/rapport/${id}.${sig.slice(0, -2)}xx/reponse`, { reponse: 'VALIDE', nom: 'Pirate' })).status, 404);
  // un jeton de DEVIS ne vaut rien ici (signature et préfixe différents)
  const { fabriquerJeton } = await import('../server/domain/devisClient.js');
  const { config } = await import('../server/config.js');
  assert.equal((await call(null, 'GET', `/api/public/rapport/${fabriquerJeton(`${config.jwtSecret}:devis-lien`, { id: Number(id), companyId: 1, devisId: 1, sel: 'x' })}`)).status, 404);
});

test('VALIDATION par le client : usage unique, statut « Validé par le client », bureau prévenu (jamais le technicien)', async () => {
  const jeton = jetonDe(mails.find((m) => m.to === 'travaux@atlas.fr')!.lien);
  assert.equal((await call(null, 'POST', `/api/public/rapport/${jeton}/reponse`, { reponse: 'VALIDE', nom: '' })).status, 400, 'nom obligatoire');
  const [a, b] = await Promise.all([
    call(null, 'POST', `/api/public/rapport/${jeton}/reponse`, { reponse: 'VALIDE', nom: 'M. Durand' }),
    call(null, 'POST', `/api/public/rapport/${jeton}/reponse`, { reponse: 'RESERVES', nom: 'M. Durand', motif: 'Fuite persistante' }),
  ]);
  assert.equal(Math.min(a.status, b.status), 200);
  assert.ok([404, 409].includes(Math.max(a.status, b.status)), 'une seule réponse est retenue');
  const statut = row('intervention', 1).statutRapport;
  assert.ok(['Validé par le client', 'Réserves client'].includes(statut));
  assert.match(row('intervention', 1).historiqueJson, /M\. Durand/);
  for (const who of [ADMIN, PLANIF, RAPPORTS]) assert.ok(notifsDe(who).some((n: any) => n.interventionId === 1), `notifié ${who}`);
  assert.equal(notifsDe(TECH).length, 0);
  assert.equal(notifsDe(CHIFFRAGE).length, 0);
  assert.equal((await call(null, 'POST', `/api/public/rapport/${jeton}/reponse`, { reponse: 'VALIDE', nom: 'M. Durand' })).status, 404, 'déjà utilisé');
  assert.equal((await call(null, 'GET', `/api/public/rapport/${jeton}`)).json.data.etat, 'repondu');
});

test('VALIDATION nette : « Validé par le client », facturable, et plus aucun renvoi possible', async () => {
  const jeton = jetonDe(dernierMail().lien); // intervention 6 (aucune photo)
  assert.equal((await call(null, 'POST', `/api/public/rapport/${jeton}/reponse`, { reponse: 'VALIDE', nom: 'Mme Martin' })).status, 200);
  assert.equal(row('intervention', 6).statutRapport, 'Validé par le client');
  assert.ok(notifsDe(ADMIN, 'RAPPORT_VALIDE').some((n: any) => n.interventionId === 6));
  const renvoi = await envoyer(ADMIN, 6, { emails: ['travaux@atlas.fr'] });
  assert.equal(renvoi.status, 409);
  assert.equal(renvoi.json.code, 'DEJA_VALIDE');
});

test('RÉSERVES : texte obligatoire, statut « Réserves client », puis renvoi possible après correction', async () => {
  await envoyer(ADMIN, 7, { emails: ['compta@atlas.fr'], toutesPhotos: true });
  const j = jetonDe(dernierMail().lien);
  assert.equal((await call(null, 'POST', `/api/public/rapport/${j}/reponse`, { reponse: 'RESERVES', nom: 'Durand' })).status, 400, 'réserves : texte requis');
  assert.equal((await call(null, 'POST', `/api/public/rapport/${j}/reponse`, { reponse: 'RESERVES', nom: 'Durand', motif: 'Peinture non refaite' })).status, 200);
  assert.equal(row('intervention', 7).statutRapport, 'Réserves client');
  const n = notifsDe(PLANIF, 'RAPPORT_RESERVES').find((x: any) => x.interventionId === 7);
  assert.ok(n);
  assert.match(n.message, /Peinture non refaite/);
  // Le bureau corrige puis renvoie : nouveau lien, l'ancien est mort
  assert.equal((await call(RAPPORTS, 'PATCH', '/api/interventions/7', { rapportFinal: 'Joint remplacé, peinture refaite.' })).status, 200);
  const renvoi = await envoyer(RAPPORTS, 7, { emails: ['compta@atlas.fr'] });
  assert.equal(renvoi.status, 200);
  assert.equal(row('intervention', 7).statutRapport, 'Envoyé au client');
  const j2 = jetonDe(dernierMail().lien);
  assert.notEqual(j2, j);
  assert.equal((await call(null, 'GET', `/api/public/rapport/${j2}`)).json.data.contenu.rapport, 'Joint remplacé, peinture refaite.');
});

test('SOURCE « PDF déposé » : exige un PDF déposé, et c\'est ce PDF-là que le client ouvre', async () => {
  const sans = await envoyer(ADMIN, 8, { emails: ['travaux@atlas.fr'], source: 'DEPOSE' });
  assert.equal(sans.status, 422);
  assert.equal(sans.json.code, 'DOCUMENT_REQUIS');
  assert.equal(row('intervention', 8).statutRapport, 'Validé & Clôturé');
  assert.equal((await call(RAPPORTS, 'POST', '/api/interventions/8/rapport-document', { nomFichier: 'mon-rapport.pdf', contenuBase64: PDF })).status, 201);
  assert.equal((await envoyer(RAPPORTS, 8, { emails: ['travaux@atlas.fr'], source: 'DEPOSE', photoIds: ['p2'] })).status, 200);
  const j = jetonDe(dernierMail().lien);
  const pdf = await fetch(`${base}/api/public/rapport/${j}/document`);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).toString('base64'), PDF);
  assert.equal((await call(null, 'GET', `/api/public/rapport/${j}`)).json.data.document.nomFichier, 'mon-rapport.pdf');
});

test('RAPPORT MODIFIÉ APRÈS ENVOI : le lien est révoqué ; une simple note interne ne révoque rien ; un nouveau PDF révoque', async () => {
  const j = jetonDe(dernierMail().lien); // intervention 8
  assert.equal((await call(ADMIN, 'PATCH', '/api/interventions/8', { notes: 'rappeler le client' })).status, 200);
  assert.equal((await call(null, 'GET', `/api/public/rapport/${j}`)).status, 200, 'note interne : lien intact');
  assert.equal((await call(ADMIN, 'PATCH', '/api/interventions/8', { rapportFinal: 'Texte corrigé après envoi' })).status, 200);
  assert.equal((await call(null, 'GET', `/api/public/rapport/${j}`)).status, 404, 'rapport modifié : lien révoqué');
  assert.equal((await call(null, 'POST', `/api/public/rapport/${j}/reponse`, { reponse: 'VALIDE', nom: 'Durand' })).status, 404);
  assert.match(row('intervention', 8).historiqueJson, /lien du rapport révoqué/);
  assert.equal(row('intervention', 8).statutRapport, 'Envoyé au client', 'pas de validation tacite');

  await envoyer(ADMIN, 8, { emails: ['travaux@atlas.fr'], source: 'DEPOSE' });
  const j2 = jetonDe(dernierMail().lien);
  const r = await call(RAPPORTS, 'POST', '/api/interventions/8/rapport-document', { nomFichier: 'v2.pdf', contenuBase64: PDF });
  assert.equal(r.json.lienRevoque, true);
  assert.equal((await call(null, 'GET', `/api/public/rapport/${j2}`)).status, 404);
  await envoyer(ADMIN, 8, { emails: ['travaux@atlas.fr'], source: 'DEPOSE' });
  assert.equal(db.rapportLienClient.rows.filter((l: any) => l.interventionId === 8 && !l.reponse && !l.revoqueLe).length, 1, 'un seul lien actif');
});

test('RELANCES : J+3 puis J+7, pas la nuit ni le dimanche ; à 30 jours alerte SANS valider ; rien après réponse ; désactivable', async () => {
  // Les rapports envoyés par les tests précédents (date réelle) sortent du scénario
  for (const i of db.intervention.rows) if (i.statutRapport === 'Envoyé au client') i.statutRapport = 'Validé par le client';
  db.intervention.rows.push(intv(20, { statutRapport: 'Envoyé au client', envoiClientLe: paris(9, 10), relanceClientJ3Le: null, relanceClientJ7Le: null }));
  db.rapportLienClient.rows.push({
    id: 2000, companyId: 1, interventionId: 20, documentId: null, sel: 'abc', destinataires: JSON.stringify(['compta@atlas.fr', 'travaux@atlas.fr']),
    contenuJson: '{}', expireLe: paris(9 + 30, 10), reponse: null, revoqueLe: null, createdAt: paris(9, 10),
  });
  const avant = mails.length;
  assert.deepEqual(await executer(paris(11, 10)), { relances: 0, expires: 0 }, 'J+2');
  assert.deepEqual(await executer(paris(12, 22)), { relances: 0, expires: 0 }, 'J+3 mais de nuit');
  assert.deepEqual(await executer(paris(12, 10)), { relances: 1, expires: 0 }, 'J+3');
  assert.equal(mails.length - avant, 2);
  assert.ok(mails.slice(avant).every((m) => m.relance === 'J3'));
  assert.match(row('intervention', 20).historiqueJson, /Automatique — relance J\+3/);
  assert.deepEqual(await executer(paris(13, 10)), { relances: 0, expires: 0 }, 'jamais deux fois');
  assert.deepEqual(await executer(paris(15, 10)), { relances: 0, expires: 0 }, 'dimanche');
  assert.deepEqual(await executer(paris(16, 10)), { relances: 1, expires: 0 }, 'J+7');
  assert.equal(row('intervention', 20).statutRapport, 'Envoyé au client', 'une relance ne change jamais le statut');

  // 30 jours sans réponse : lien fermé, alerte, mais le rapport n'est PAS validé
  assert.deepEqual(await executer(paris(9 + 30, 10)), { relances: 0, expires: 1 });
  assert.equal(row('intervention', 20).statutRapport, 'Envoyé au client', 'silence ≠ validation');
  assert.ok(row('rapportLienClient', 2000).revoqueLe);
  assert.match(row('intervention', 20).historiqueJson, /Automatique — lien du rapport expiré/);
  for (const who of [ADMIN, PLANIF, RAPPORTS]) assert.ok(notifsDe(who, 'RAPPORT_EXPIRE').some((n: any) => n.interventionId === 20), `alerte ${who}`);
  assert.ok(db.intervention.rows.some((i: any) => i.id === 20), 'aucune suppression');
  assert.deepEqual(await executer(paris(9 + 31, 10)), { relances: 0, expires: 0 });

  // Société qui a désactivé l'automatisation : rien ne part
  db.intervention.rows.push(intv(21, { statutRapport: 'Envoyé au client', envoiClientLe: paris(2, 10), company: { active: true, autoRapportActif: false } }));
  db.rapportLienClient.rows.push({ id: 2100, companyId: 1, interventionId: 21, sel: 'z', destinataires: JSON.stringify(['compta@atlas.fr']), contenuJson: '{}', expireLe: paris(32, 10), reponse: null, revoqueLe: null, createdAt: paris(2, 10) });
  const m0 = mails.length;
  assert.deepEqual(await executer(paris(12, 10)), { relances: 0, expires: 0 });
  assert.equal(mails.length, m0);
});

test('ISOLATION : le rapport d\'une autre société ne se voit ni ne s\'envoie', async () => {
  assert.equal((await call(ADMIN2, 'GET', '/api/interventions/1/rapport-client')).status, 404);
  assert.equal((await call(ADMIN, 'GET', '/api/interventions/9/rapport-client')).status, 404);
  assert.equal((await envoyer(ADMIN, 9, { emails: ['travaux@atlas.fr'] })).status, 404);
  assert.equal((await fetch(`${base}/api/interventions/9/rapport-document`, { headers: { authorization: `Bearer ${tokens[ADMIN]}` } })).status, 404);
  assert.equal((await fetch(`${base}/api/interventions/9/rapport-photos/p1`, { headers: { authorization: `Bearer ${tokens[ADMIN]}` } })).status, 404);
  assert.equal((await call(ADMIN, 'POST', '/api/interventions/9/rapport-apercu', {})).status, 404);
});

test('APERÇU : un vrai PDF avec les photos cochées ; rien n\'est enregistré ni envoyé', async () => {
  const avant = db.rapportDocument.rows.length;
  const mailsAvant = mails.length;
  const res = await fetch(`${base}/api/interventions/2/rapport-apercu`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[RAPPORTS]}` }, body: JSON.stringify({ photoIds: ['p1', 'p2'] }),
  });
  assert.equal(res.status, 200);
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString('latin1'), '%PDF-');
  assert.equal(db.rapportDocument.rows.length, avant);
  assert.equal(mails.length, mailsAvant);
  assert.equal((await call(TECH, 'POST', '/api/interventions/2/rapport-apercu', {})).status, 403);
  assert.equal((await call(RAPPORTS, 'POST', '/api/interventions/2/rapport-apercu', { photoIds: ['zzz'] })).status, 422);
  const mini = await fetch(`${base}/api/interventions/1/rapport-photos/p1`, { headers: { authorization: `Bearer ${tokens[ADMIN]}` } });
  assert.equal(mini.status, 200);
  assert.equal(mini.headers.get('content-type'), 'image/png');
  assert.equal((await fetch(`${base}/api/interventions/1/rapport-photos/p4`, { headers: { authorization: `Bearer ${tokens[ADMIN]}` } })).status, 404);
});
