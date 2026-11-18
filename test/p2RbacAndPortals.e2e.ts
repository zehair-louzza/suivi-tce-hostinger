// Tests de régression Lot P2 : IDOR techMatches, cloisonnement stats, TERRAIN_KEYS, demandes/orienter race & chiffrage,
// convert fallback, PATCH devis-sync, verrou client sur rapport, pointages fail-closed & clock-out GPS/arrivée,
// GPS spoof & allowlist référentiels, et sécurité des portails publics devis/rapport.
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

let httpServer: http.Server;
let base = '';
let jwtSecret = '';
let techMatchesFn: typeof import('../server/lib/access.js').techMatches;
let etatLienFn: typeof import('../server/services/devisClient.js').etatLien;
let fabriquerJetonDevis: typeof import('../server/domain/devisClient.js').fabriquerJeton;
let genererSelDevis: typeof import('../server/domain/devisClient.js').genererSel;
let fabriquerJetonRapport: typeof import('../server/domain/rapportClient.js').fabriquerJetonRapport;

const tok = (userId: number, companyId: number, role: string, email: string, tokenVersion = 1) =>
  jwt.sign({ userId, companyId, role, email, type: 'access', sv: tokenVersion }, jwtSecret, { expiresIn: '1h' });

const reqApi = async (method: string, urlPath: string, token: string | null, body?: unknown) => {
  const res = await fetch(base + urlPath, {
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
    // non-json (PDF, etc.)
  }
  return { status: res.status, json, text, headers: res.headers };
};

const PDF_B64 = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF').toString('base64');

let T_ADMIN = '';
let T_CHIFF = '';
let T_CHIFF_NO_FIN = '';
let T_PLANIF = '';
let T_PLANIF_NO_FIN = '';
let T_REDAC = '';
let T_REDAC_EMPTY = '';
let T_TECH_A = '';
let T_TECH_KARIM = '';
let T_TECH_MARC = '';

before(async () => {
  const cfg = (await import('../server/config.js')).config;
  jwtSecret = cfg.jwtSecret;
  techMatchesFn = (await import('../server/lib/access.js')).techMatches;
  const devisClientSvc = await import('../server/services/devisClient.js');
  const rapportClientSvc = await import('../server/services/rapportClient.js');
  etatLienFn = devisClientSvc.etatLien;
  devisClientSvc.courrier.envoyerLien = async () => ({ sent: true, channel: 'stub' }) as any;
  rapportClientSvc.courrier.envoyerLien = async () => ({ sent: true, channel: 'stub' }) as any;

  const dcDom = await import('../server/domain/devisClient.js');
  fabriquerJetonDevis = dcDom.fabriquerJeton;
  genererSelDevis = dcDom.genererSel;
  const rcDom = await import('../server/domain/rapportClient.js');
  fabriquerJetonRapport = rcDom.fabriquerJetonRapport;

  db.company.seed([
    { id: 1, name: 'Société P2', siret: '11111111100021', siren: '111111111', active: true, siegeLat: 48.8566, siegeLng: 2.3522 },
    { id: 2, name: 'Société Inactive P2', siret: '22222222200022', siren: '222222222', active: false },
  ]);

  db.user.seed([
    { id: 1, companyId: 1, email: 'admin@p2.fr', name: 'Admin P2', role: 'ADMIN', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    { id: 2, companyId: 1, email: 'chiffrage@p2.fr', name: 'Chiff P2', role: 'CHIFFRAGE_DEVIS', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    {
      id: 3,
      companyId: 1,
      email: 'chiff-nofin@p2.fr',
      name: 'Chiff Sans Montants',
      role: 'CHIFFRAGE_DEVIS',
      active: true,
      emailConfirmed: true,
      tokenVersion: 1,
      permissionsJson: JSON.stringify({ canViewFinancials: false }),
    },
    { id: 4, companyId: 1, email: 'planif@p2.fr', name: 'Planif P2', role: 'CONDUCTEUR_TRAVAUX', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    { id: 5, companyId: 1, email: 'redac@p2.fr', name: 'Rédac P2', role: 'REDACTEUR_RAPPORTS', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    { id: 6, companyId: 1, email: 'redac-empty@p2.fr', name: '   ', technicienNom: null, role: 'REDACTEUR_RAPPORTS', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    { id: 7, companyId: 1, email: 'techa@p2.fr', name: 'a', technicienNom: 'a', role: 'TECHNICIEN', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    { id: 8, companyId: 1, email: 'karim@p2.fr', name: 'Karim', technicienNom: 'Karim', role: 'TECHNICIEN', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    { id: 9, companyId: 1, email: 'marc@p2.fr', name: 'Marc', technicienNom: 'Marc', role: 'TECHNICIEN', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    { id: 10, companyId: 2, email: 'admin2@p2.fr', name: 'Admin 2', role: 'ADMIN', active: true, emailConfirmed: true, tokenVersion: 1, permissionsJson: null },
    {
      id: 11,
      companyId: 1,
      email: 'planif-nofin@p2.fr',
      name: 'Planif Sans Montants',
      role: 'CONDUCTEUR_TRAVAUX',
      active: true,
      emailConfirmed: true,
      tokenVersion: 1,
      permissionsJson: JSON.stringify({ canViewFinancials: false }),
    },
  ]);

  T_ADMIN = tok(1, 1, 'ADMIN', 'admin@p2.fr');
  T_CHIFF = tok(2, 1, 'CHIFFRAGE_DEVIS', 'chiffrage@p2.fr');
  T_CHIFF_NO_FIN = tok(3, 1, 'CHIFFRAGE_DEVIS', 'chiff-nofin@p2.fr');
  T_PLANIF = tok(4, 1, 'CONDUCTEUR_TRAVAUX', 'planif@p2.fr');
  T_PLANIF_NO_FIN = tok(11, 1, 'CONDUCTEUR_TRAVAUX', 'planif-nofin@p2.fr');
  T_REDAC = tok(5, 1, 'REDACTEUR_RAPPORTS', 'redac@p2.fr');
  T_REDAC_EMPTY = tok(6, 1, 'REDACTEUR_RAPPORTS', 'redac-empty@p2.fr');
  T_TECH_A = tok(7, 1, 'TECHNICIEN', 'techa@p2.fr');
  T_TECH_KARIM = tok(8, 1, 'TECHNICIEN', 'karim@p2.fr');
  T_TECH_MARC = tok(9, 1, 'TECHNICIEN', 'marc@p2.fr');

  const { demandesRouter } = await import('../server/routes/demandes.js');
  const { devisRouter } = await import('../server/routes/devis.js');
  const { interventionRouter } = await import('../server/routes/interventions.js');
  const { referentielsRouter } = await import('../server/routes/referentiels.js');
  const { adminRouter } = await import('../server/routes/admin.js');
  const { devisClientPublicRouter } = await import('../server/routes/devisClientPublic.js');
  const { rapportClientPublicRouter } = await import('../server/routes/rapportClientPublic.js');
  const { authMiddleware } = await import('../server/middleware/auth.js');
  const { errorHandler } = await import('../server/middleware/errorHandler.js');

  const app = express();
  app.use(express.json());
  app.use(cookieParser(cfg.cookieSecret));
  app.use('/api/demandes', authMiddleware, demandesRouter);
  app.use('/api/devis', authMiddleware, devisRouter);
  app.use('/api/interventions', authMiddleware, interventionRouter);
  app.use('/api/referentiels', authMiddleware, referentielsRouter);
  app.use('/api/admin', authMiddleware, adminRouter);
  app.use('/api/public/devis', devisClientPublicRouter);
  app.use('/api/public/rapport', rapportClientPublicRouter);
  app.use(errorHandler);

  httpServer = http.createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

after(() => {
  httpServer?.close();
});

test('P2-1: techMatches exact par jetons délimités bloque l\'IDOR par sous-chaîne ("a", "Kar") sur interventions, devis et fiches clients', async () => {
  assert.equal(techMatchesFn('a', 'Marc'), false);
  assert.equal(techMatchesFn('Kar', 'Karim'), false);
  assert.equal(techMatchesFn('Karim', 'Karine'), false);
  assert.equal(techMatchesFn('Karim', 'Marc, Karim'), true);
  assert.equal(techMatchesFn('Karim', 'Marc / karim'), true);

  db.intervention.seed([
    { id: 101, companyId: 1, client: 'Client Marc', chantier: 'Site M', entreprise: 'Marc', technicien: 'Marc', statutOperationnel: 'Planifiée', isVisiteDevis: false },
    { id: 102, companyId: 1, client: 'Client Karim', chantier: 'Site K', entreprise: 'Karim, Marc', technicien: 'Karim, Marc', statutOperationnel: 'Planifiée', isVisiteDevis: false },
    { id: 103, companyId: 1, client: 'Client Karine', chantier: 'Site Ka', entreprise: 'Karine', technicien: 'Karine', statutOperationnel: 'Planifiée', isVisiteDevis: false },
  ]);
  db.devis.seed([
    { id: 201, companyId: 1, client: 'Client Marc', referenceMetier: 'DEV-2026-201', statutCommercial: 'À préparer', traitement: 'À traiter', visiteTechnicien: 'Marc', amount: 1500 },
    { id: 202, companyId: 1, client: 'Client Karim', referenceMetier: 'DEV-2026-202', statutCommercial: 'À préparer', traitement: 'À traiter', visiteTechnicien: 'Karim / Paul', amount: 2500 },
    { id: 203, companyId: 1, client: 'Client Accepté', referenceMetier: 'DEV-2026-203', statutCommercial: 'Accepté', traitement: 'Traité', visiteTechnicien: 'Paul', amount: 3500 },
  ]);
  db.referentiel.seed([
    {
      id: 301,
      companyId: 1,
      categorie: 'clients_fiches',
      valeurs: JSON.stringify([
        { id: 'c1', nom: 'Client Marc', email: 'm@client.fr', active: true },
        { id: 'c2', nom: 'Client Karim', email: 'k@client.fr', active: true },
        { id: 'c3', nom: 'Client Karine', email: 'ka@client.fr', active: true },
      ]),
    },
  ]);

  const listTechA = await reqApi('GET', '/api/interventions', T_TECH_A);
  assert.equal(listTechA.status, 200);
  assert.equal(listTechA.json.data.length, 0, 'Un technicien nommé "a" ne doit plus voir Marc/Karim/Karine');

  const listKarim = await reqApi('GET', '/api/interventions', T_TECH_KARIM);
  assert.equal(listKarim.status, 200);
  assert.deepEqual(listKarim.json.data.map((i: any) => i.id), [102]);

  const devisTechA = await reqApi('GET', '/api/devis', T_TECH_A);
  assert.equal(devisTechA.status, 200);
  assert.equal(devisTechA.json.data.length, 0);

  const devisKarim = await reqApi('GET', '/api/devis', T_TECH_KARIM);
  assert.equal(devisKarim.status, 200);
  assert.deepEqual(devisKarim.json.data.map((d: any) => d.id), [202]);

  const refsTechA = await reqApi('GET', '/api/referentiels', T_TECH_A);
  assert.equal(refsTechA.status, 200);
  assert.equal(refsTechA.json.data.clients_fiches.length, 0);
});

test('P2-2: TERRAIN_KEYS interdit au technicien de modifier statutRapport + stats interventions & devis cloisonnées', async () => {
  const onlyStatutRapport = await reqApi('PATCH', '/api/interventions/102', T_TECH_KARIM, {
    statutRapport: 'Validé & Clôturé',
  });
  assert.equal(onlyStatutRapport.status, 403);

  const mixed = await reqApi('PATCH', '/api/interventions/102', T_TECH_KARIM, {
    compteRendu: 'Intervention OK',
    statutRapport: 'Validé & Clôturé',
  });
  assert.equal(mixed.status, 200);
  const row102 = db.intervention.rows.find((r) => r.id === 102);
  assert.notEqual(row102.statutRapport, 'Validé & Clôturé');

  // Stats interventions pour CHIFFRAGE_DEVIS : uniquement linkedOnly et sans nonFactureesCloturees
  db.intervention.rows.push({
    id: 104,
    companyId: 1,
    client: 'Clôt Unlinked',
    chantier: 'Unlinked',
    entreprise: 'Marc',
    statutOperationnel: 'Clôturée',
    statutFacture: 'Non facturée',
    isVisiteDevis: false,
    devisId: null,
    origineDevisId: null,
  });
  const statsChiff = await reqApi('GET', '/api/interventions/stats', T_CHIFF);
  assert.equal(statsChiff.status, 200);
  assert.equal(statsChiff.json.interventionsCloturees, 0, 'intervention non liée exclue pour CHIFFRAGE_DEVIS');
  assert.equal('nonFactureesCloturees' in statsChiff.json, false, 'compteur facturation masqué sans canSeeBilling');

  // Stats devis pour CONDUCTEUR_TRAVAUX : uniquement devis dans canReadDevis (ici uniquement #203 Accepté, pas les 2 brouillons)
  const statsPlanif = await reqApi('GET', '/api/devis/stats', T_PLANIF);
  assert.equal(statsPlanif.status, 200);
  assert.equal(statsPlanif.json.devisAcceptes, 1);
  assert.equal(statsPlanif.json.devisATraiter, 0);
});

test('P2-3: POST /api/demandes/:id/orienter bloque CHIFFRAGE_DEVIS->INTERVENTION, statut ANNULEE et course concurrente', async () => {
  db.demande.seed([
    { id: 401, companyId: 1, client: 'Client D1', statut: 'A_DECIDER', dateReception: new Date(), priorite: 'Normale' },
    { id: 402, companyId: 1, client: 'Client Annulée', statut: 'ANNULEE', dateReception: new Date(), priorite: 'Normale' },
  ]);

  const chiffBypass = await reqApi('POST', '/api/demandes/401/orienter', T_CHIFF, { decision: 'INTERVENTION' });
  assert.equal(chiffBypass.status, 403);

  const annuleeRes = await reqApi('POST', '/api/demandes/402/orienter', T_ADMIN, { decision: 'DEVIS' });
  assert.equal(annuleeRes.status, 409);

  // Course concurrente sur 401 : strictement un seul succès 201 et un 409
  const intvBefore = db.intervention.rows.length;
  const [r1, r2] = await Promise.all([
    reqApi('POST', '/api/demandes/401/orienter', T_PLANIF, { decision: 'INTERVENTION' }),
    reqApi('POST', '/api/demandes/401/orienter', T_PLANIF, { decision: 'INTERVENTION' }),
  ]);
  const statuses = [r1.status, r2.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [201, 409]);
  assert.equal(db.intervention.rows.length, intvBefore + 1);
});

test('P2-4: POST /api/devis/:id/convert fallback + send-devis-email + document/apercu/envoyer-client contrôlent périmètre & montants', async () => {
  // Devis #201 est « À préparer » -> convert sans mode visite refusé (409) pour ADMIN et 404 pour PLANIF
  const convPlanifPending = await reqApi('POST', '/api/devis/201/convert', T_PLANIF, { datePlanifiee: '2026-12-10' });
  assert.equal(convPlanifPending.status, 404);

  const convAdminPending = await reqApi('POST', '/api/devis/201/convert', T_ADMIN, { datePlanifiee: '2026-12-10' });
  assert.equal(convAdminPending.status, 409);
  assert.equal(convAdminPending.json.code, 'DEVIS_NON_ACCEPTE');

  // Devis #203 est « Accepté » (amount: 3500) :
  //  - convert par PLANIF (!canSeeBilling) masque la facturation
  //  - convert par PLANIF sans canViewFinancials masque les montants sur data ET devis
  const convPlanifOk = await reqApi('POST', '/api/devis/203/convert', T_PLANIF, { datePlanifiee: '2026-12-10' });
  assert.equal(convPlanifOk.status, 201);
  assert.equal(convPlanifOk.json.data.statutFacture, null);

  const convNoFin = await reqApi('POST', '/api/devis/203/convert', T_PLANIF_NO_FIN, { datePlanifiee: '2026-12-11' });
  assert.equal(convNoFin.status, 201);
  assert.equal(convNoFin.json.data.amount, 0);
  assert.equal(convNoFin.json.devis.amount, null);

  // Utilisateur chiffrage avec canViewFinancials: false bloqué sur send-devis-email, document, apercu, envoyer-client
  assert.equal(
    (await reqApi('POST', '/api/devis/201/send-devis-email', T_CHIFF_NO_FIN, { toEmail: 'client@test.fr' })).status,
    403
  );
  assert.equal(
    (await reqApi('POST', '/api/devis/201/document', T_CHIFF_NO_FIN, { nomFichier: 'a.pdf', contenuBase64: PDF_B64 })).status,
    403
  );
  assert.equal((await reqApi('POST', '/api/devis/201/apercu', T_CHIFF_NO_FIN, {})).status, 403);
  assert.equal(
    (await reqApi('POST', '/api/devis/201/envoyer-client', T_CHIFF_NO_FIN, { confirme: true, emails: ['c@x.fr'] })).status,
    403
  );
  // Même CONDUCTEUR_TRAVAUX sans canViewFinancials ne télécharge pas le PDF financier d'un devis accepté
  assert.equal((await reqApi('GET', '/api/devis/203/document', T_PLANIF_NO_FIN)).status, 403);
});

test('P2-5: POST/PATCH /api/interventions (injection de champs, devis-sync, verrou client) et POST /:id/reponse atomique', async () => {
  // POST avec champs facturation interdits seuls -> 403 FIELD_FORBIDDEN
  const onlyBad = await reqApi('POST', '/api/interventions', T_PLANIF, { numeroFacture: 'F-BYPASS', statutFacture: 'Facturée' });
  assert.equal(onlyBad.status, 403);

  const onlyBadNoFin = await reqApi('POST', '/api/interventions', T_PLANIF_NO_FIN, { amount: 9000, statutFacture: 'Facturée' });
  assert.equal(onlyBadNoFin.status, 403);

  // POST mixte (PLANIF sans financials) -> les champs montants & facturation sont supprimés et non persistés
  const mixedCreate = await reqApi('POST', '/api/interventions', T_PLANIF_NO_FIN, {
    client: 'Client Test',
    chantier: 'Chantier Safe',
    amount: 9999,
    numeroFacture: 'F-BYPASS',
    statutFacture: 'Facturée',
  });
  assert.equal(mixedCreate.status, 201);
  const createdRow = db.intervention.rows.find((r) => r.id === mixedCreate.json.data.id);
  assert.equal(createdRow.amount, 0);
  assert.equal(createdRow.numeroFacture, null);
  assert.equal(createdRow.statutFacture, 'Non facturée');

  // Montant négatif interdit même pour ADMIN
  assert.equal((await reqApi('POST', '/api/interventions', T_ADMIN, { client: 'X', chantier: 'Y', amount: -10 })).status, 400);

  // PATCH devis-sync : PLANIF ne peut pas rattacher refDevisTexte / devisId arbitraire
  const devisSyncHack = await reqApi('PATCH', `/api/interventions/${createdRow.id}`, T_PLANIF, {
    devisId: 201,
    refDevisTexte: 'DEV-2026-201',
  });
  assert.equal(devisSyncHack.status, 403);

  // Verrou après validation client sur intervention #105 (PATCH + rapport-document bloqués)
  db.intervention.rows.push({
    id: 105,
    companyId: 1,
    client: 'Client Lock',
    chantier: 'Site Lock',
    rapportFinal: 'Rapport validé initial',
    statutRapport: 'Validé par le client',
    statutOperationnel: 'Clôturée',
    isVisiteDevis: false,
  });
  assert.equal((await reqApi('PATCH', '/api/interventions/105', T_REDAC, { statutRapport: 'Brouillon' })).status, 409);
  assert.equal((await reqApi('PATCH', '/api/interventions/105', T_ADMIN, { rapportFinal: 'Altéré' })).status, 409);
  assert.equal(
    (await reqApi('POST', '/api/interventions/105/rapport-document', T_ADMIN, { nomFichier: 'override.pdf', contenuBase64: PDF_B64 })).status,
    409
  );
  // Facturation post-validation reste autorisée par ADMIN
  assert.equal((await reqApi('PATCH', '/api/interventions/105', T_ADMIN, { statutFacture: 'Facturée', numeroFacture: 'FAC-105' })).status, 200);

  // Concurrence POST /:id/reponse
  db.intervention.rows.push({
    id: 106,
    companyId: 1,
    client: 'Client Resp',
    chantier: 'Site Resp',
    entreprise: 'Marc',
    technicien: 'Marc',
    reponseTechnicien: 'EN_ATTENTE',
    statutOperationnel: 'Planifiée',
    isVisiteDevis: false,
  });
  const [rep1, rep2] = await Promise.all([
    reqApi('POST', '/api/interventions/106/reponse', T_TECH_MARC, { reponse: 'ACCEPTEE' }),
    reqApi('POST', '/api/interventions/106/reponse', T_TECH_MARC, { reponse: 'REFUSEE', motif: 'Indisponible' }),
  ]);
  assert.deepEqual([rep1.status, rep2.status].sort((a, b) => a - b), [200, 409]);
});

test('P2-6: GPS spoof, bornes WGS84, allowlist référentiels, pointages fail-closed et clock-out sans arrivée préalable', async () => {
  // Technicien Karim essaie d'usurper Marc sur gps-position -> forcé à Karim
  const gpsSpoof = await reqApi('POST', '/api/referentiels/gps-position', T_TECH_KARIM, {
    technicien: 'Marc',
    lat: 48.85,
    lng: 2.35,
  });
  assert.equal(gpsSpoof.status, 200);
  const gpsRow = db.referentiel.rows.find((r) => r.companyId === 1 && r.categorie === 'positions_gps_techniciens');
  const gpsMap = JSON.parse(gpsRow.valeurs);
  assert.ok(gpsMap['Karim']);
  assert.equal(gpsMap['Marc'], undefined);

  // Coordonnées hors bornes -> 400
  assert.equal(
    (await reqApi('POST', '/api/referentiels/gps-position', T_TECH_KARIM, { lat: 95, lng: 2.35 })).status,
    400
  );

  // Allowlist PUT /api/referentiels/:categorie bloque les clés protégées
  assert.equal(
    (await reqApi('PUT', '/api/referentiels/positions_gps_techniciens', T_ADMIN, { valeurs: {} })).status,
    400
  );
  assert.equal((await reqApi('PUT', '/api/referentiels/smtp_config', T_ADMIN, { valeurs: {} })).status, 400);

  // Pointages existants d'un collègue
  db.pointageTechnicien.seed([
    { id: 501, companyId: 1, technicien: 'Marc', userId: 9, dateJour: '2026-11-18', heureArriveeBureau: '08:05', statutJournee: 'EN_SERVICE' },
  ]);
  db.pointageDerogation.seed([
    { id: 601, companyId: 1, technicien: 'Marc', dateJour: '2026-11-18', active: true, accordeePar: 'Admin' },
  ]);

  // Utilisateur non-admin sans technicienNom/name -> fail-closed (liste vide, ne fuit pas Marc)
  const ptEmpty = await reqApi('GET', '/api/admin/pointages', T_REDAC_EMPTY);
  assert.equal(ptEmpty.status, 200);
  assert.equal(ptEmpty.json.data.length, 0);

  const derEmpty = await reqApi('GET', '/api/admin/pointages/derogations?dateJour=2026-11-18', T_REDAC_EMPTY);
  assert.equal(derEmpty.status, 200);
  assert.equal(derEmpty.json.data.length, 0);

  // Clock-out sans clock-in préalable -> 409 CLOCK_IN_REQUIRED
  const countPtBefore = db.pointageTechnicien.rows.length;
  const earlyOut = await reqApi('POST', '/api/admin/pointages/clock-out', T_TECH_KARIM, { technicien: 'Karim' });
  assert.equal(earlyOut.status, 409);
  assert.equal(earlyOut.json.code, 'CLOCK_IN_REQUIRED');
  assert.equal(db.pointageTechnicien.rows.length, countPtBefore);

  // Clock-in dans les 30m du siège puis clock-out -> 200 TERMINEE
  const okIn = await reqApi('POST', '/api/admin/pointages/clock-in', T_TECH_KARIM, {
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 5,
  });
  assert.equal(okIn.status, 200);
  const okOut = await reqApi('POST', '/api/admin/pointages/clock-out', T_TECH_KARIM, {});
  assert.equal(okOut.status, 200);
  assert.equal(okOut.json.data.statutJournee, 'TERMINEE');
});

test('P2-7: Portails publics devis/rapport (société inactive sur PDF & réponse, expiration prioritaire sur répondu, concurrence)', async () => {
  // 1) Société inactive sur PDF + réponse devis + réponse rapport
  const selD2 = genererSelDevis();
  const selR2 = genererSelDevis();
  db.devis.rows.push({ id: 701, companyId: 2, client: 'Inac Client', statutCommercial: 'Envoyé au client', amount: 500 });
  db.devisDocument.seed([{ id: 711, companyId: 2, devisId: 701, nomFichier: 'd2.pdf', taille: 10, sha256: 'x', contenu: Buffer.from(PDF_B64, 'base64') }]);
  db.devisLienClient.seed([
    {
      id: 721,
      companyId: 2,
      devisId: 701,
      documentId: 711,
      sel: selD2,
      destinataires: '["a@b.fr"]',
      expireLe: new Date(Date.now() + 86400000),
      reponse: null,
      revoqueLe: null,
      createdAt: new Date(),
    },
  ]);
  db.intervention.rows.push({ id: 702, companyId: 2, client: 'Inac Client', chantier: 'Ch2', statutRapport: 'Envoyé au client' });
  db.rapportLienClient.seed([
    {
      id: 722,
      companyId: 2,
      interventionId: 702,
      sel: selR2,
      destinataires: '["a@b.fr"]',
      contenuJson: JSON.stringify({ reference: 'INT-702', client: 'Inac', photos: [] }),
      expireLe: new Date(Date.now() + 86400000),
      reponse: null,
      revoqueLe: null,
      createdAt: new Date(),
    },
  ]);

  const jetonD2 = fabriquerJetonDevis(`${jwtSecret}:devis-lien`, { id: 721, companyId: 2, devisId: 701, sel: selD2 });
  const jetonR2 = fabriquerJetonRapport(`${jwtSecret}:rapport-lien`, { id: 722, companyId: 2, interventionId: 702, sel: selR2 });

  assert.equal((await reqApi('GET', `/api/public/devis/${jetonD2}/document`, null)).status, 404);
  assert.equal((await reqApi('POST', `/api/public/devis/${jetonD2}/reponse`, null, { reponse: 'ACCEPTEE', nom: 'Client' })).status, 404);
  assert.equal((await reqApi('POST', `/api/public/rapport/${jetonR2}/reponse`, null, { reponse: 'VALIDE', nom: 'Client' })).status, 404);

  // 2) Lien répondu mais expiré ou révoqué : etatLien doit retourner expire / revoque (plus repondu !)
  const expiredResponded = {
    reponse: 'ACCEPTEE',
    revoqueLe: null,
    expireLe: new Date(Date.now() - 60_000),
  };
  assert.equal(etatLienFn(expiredResponded), 'expire');
  assert.equal(etatLienFn({ reponse: 'ACCEPTEE', revoqueLe: new Date(), expireLe: new Date(Date.now() + 60_000) }), 'revoque');

  // 3) Réponse concurrente sur un lien devis actif : un seul 200 et un 409 DEJA_REPONDU
  const selD1 = genererSelDevis();
  db.devis.rows.push({ id: 703, companyId: 1, client: 'Client Atlas', statutCommercial: 'Envoyé au client', amount: 1200, userId: 2 });
  db.devisLienClient.rows.push({
    id: 723,
    companyId: 1,
    devisId: 703,
    documentId: null,
    sel: selD1,
    destinataires: '["c@atlas.fr"]',
    expireLe: new Date(Date.now() + 86400000),
    reponse: null,
    revoqueLe: null,
    createdAt: new Date(),
  });
  const jetonD1 = fabriquerJetonDevis(`${jwtSecret}:devis-lien`, { id: 723, companyId: 1, devisId: 703, sel: selD1 });
  const [c1, c2] = await Promise.all([
    reqApi('POST', `/api/public/devis/${jetonD1}/reponse`, null, { reponse: 'ACCEPTEE', nom: 'Mme Durand' }),
    reqApi('POST', `/api/public/devis/${jetonD1}/reponse`, null, { reponse: 'REFUSEE', nom: 'M. Durand', motif: 'Trop cher' }),
  ]);
  const portalStatuses = [c1.status, c2.status].sort((a, b) => a - b);
  assert.equal(portalStatuses[0], 200);
  assert.ok(portalStatuses[1] === 404 || portalStatuses[1] === 409, `Expected 404 or 409, got ${portalStatuses[1]}`);
  const finalLien = db.devisLienClient.rows.find((l) => l.id === 723);
  assert.ok(finalLien.reponse === 'ACCEPTEE' || finalLien.reponse === 'REFUSEE');
});
