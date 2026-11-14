// Automatisation B — fonctions pures du devis client (adresses, jeton, réponse, relances, PDF).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adressesDepuisFiche,
  contenuDevisModifie,
  choisirDestinataires,
  creneauRelanceClient,
  fabriquerJeton,
  genererSel,
  idDuJeton,
  prochaineActionDevis,
  statutApresReponse,
  trouverFiche,
  validerPdf,
  validerReponseClient,
  verifierJeton,
  comptesRendusVisiteDevis,
  normaliserVisiteRapport,
  parseVisiteRapportInterne,
} from '../server/domain/devisClient.js';
import { genererPdfDevis } from '../server/services/devisPdf.js';
import { genererPdfVisiteTechnique } from '../server/services/visiteTechniquePdf.js';
import { optimiserPhotoPourPdf, preparerPdfDeposeCompresse } from '../server/services/pdfCompression.js';
import { sanitizeAndOptimizePhotosJson } from '../server/lib/terrainPhotos.js';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

// Novembre 2026 : heure d'hiver (Paris = UTC+1). Lundi 16 nov. 2026.
const paris = (jour: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, jour, h - 1, m));

const FICHE = {
  nom: 'Groupe Atlas',
  email: 'contact@atlas.fr',
  active: true,
  services: [
    { nomService: 'Travaux', email: 'travaux@atlas.fr', recevoirDevis: true },
    { nomService: 'Compta', email: 'compta@atlas.fr', recevoirDevis: false },
    { nomService: 'Doublon', email: 'TRAVAUX@atlas.fr' },
    { nomService: 'Mal saisie', email: 'pas-une-adresse' },
  ],
};

test('fiche client : retrouvée par le nom (casse et espaces ignorés), jamais une fiche inactive', () => {
  assert.equal(trouverFiche([FICHE], '  groupe   ATLAS ')?.nom, 'Groupe Atlas');
  assert.equal(trouverFiche([{ ...FICHE, active: false }], 'Groupe Atlas'), null);
  assert.equal(trouverFiche([FICHE], 'Autre'), null);
  assert.equal(trouverFiche([FICHE], ''), null);
});

test('adresses : sans doublon ni adresse invalide, services « reçoit les devis » en premier', () => {
  const a = adressesDepuisFiche(FICHE);
  assert.deepEqual(a.map((x) => x.email), ['travaux@atlas.fr', 'compta@atlas.fr', 'contact@atlas.fr']);
  assert.equal(a[0].suggeree, true);
  assert.equal(a[1].suggeree, false);
  assert.deepEqual(adressesDepuisFiche(null), []);
});

test('destinataires : une seule adresse → envoi direct ; plusieurs → confirmation obligatoire ; seules les adresses de la fiche', () => {
  const une = adressesDepuisFiche({ nom: 'X', email: 'seul@x.fr' });
  assert.deepEqual(choisirDestinataires(une, undefined), { ok: true, emails: ['seul@x.fr'] });
  assert.deepEqual(choisirDestinataires(une, ['autre@pirate.fr']), { ok: true, emails: ['seul@x.fr'] }, "une seule adresse : on n'en accepte pas d'autre");

  const plusieurs = adressesDepuisFiche(FICHE);
  const rien = choisirDestinataires(plusieurs, []);
  assert.equal(rien.ok, false);
  assert.equal((rien as any).code, 'CONFIRMATION_REQUISE');
  assert.deepEqual(choisirDestinataires(plusieurs, ['Travaux@atlas.fr', 'travaux@atlas.fr']), { ok: true, emails: ['travaux@atlas.fr'] });
  const inconnue = choisirDestinataires(plusieurs, ['pirate@evil.com']);
  assert.equal((inconnue as any).code, 'ADRESSE_INCONNUE');
  const aucune = choisirDestinataires([], ['a@b.fr']);
  assert.equal((aucune as any).code, 'AUCUNE_ADRESSE');
});

test('jeton : valable pour son lien seulement (société, devis, sel), jamais deviné ni falsifié', () => {
  const lien = { id: 42, companyId: 1, devisId: 7, sel: genererSel() };
  const jeton = fabriquerJeton('secret-test', lien);
  assert.equal(idDuJeton(jeton), 42);
  assert.equal(verifierJeton('secret-test', jeton, lien), true);
  assert.equal(verifierJeton('autre-secret', jeton, lien), false);
  assert.equal(verifierJeton('secret-test', jeton, { ...lien, companyId: 2 }), false, 'lié à la société');
  assert.equal(verifierJeton('secret-test', jeton, { ...lien, devisId: 8 }), false, 'lié au devis');
  assert.equal(verifierJeton('secret-test', jeton, { ...lien, sel: genererSel() }), false, 'lié au sel');
  assert.equal(verifierJeton('secret-test', `43.${jeton.split('.')[1]}`, { ...lien, id: 43 }), false, 'signature d\'un autre lien');
  assert.equal(idDuJeton('abc'), null);
  assert.equal(idDuJeton("42.<script>"), null);
});

test('réponse du client : nom obligatoire, motif obligatoire pour un refus ou une modification', () => {
  assert.equal(validerReponseClient({ reponse: 'ACCEPTEE', nom: 'M. Durand' }).ok, true);
  assert.equal(validerReponseClient({ reponse: 'ACCEPTEE', nom: '' }).ok, false);
  assert.equal(validerReponseClient({ reponse: 'REFUSEE', nom: 'Durand', motif: '' }).ok, false);
  assert.equal(validerReponseClient({ reponse: 'MODIFICATION', nom: 'Durand', motif: 'ok' }).ok, false);
  const m = validerReponseClient({ reponse: 'MODIFICATION', nom: 'Durand', motif: 'Ajouter le remplacement du tableau' });
  assert.equal(m.ok, true);
  assert.equal(validerReponseClient({ reponse: 'PEUT-ETRE', nom: 'Durand' }).ok, false);
  assert.equal(statutApresReponse('ACCEPTEE'), 'Accepté');
  assert.equal(statutApresReponse('REFUSEE'), 'Refusé');
  assert.equal(statutApresReponse('MODIFICATION'), 'En négociation');
});

test('créneau des relances client : lundi–samedi, 8 h–19 h (Paris), jamais le dimanche ni la nuit', () => {
  assert.equal(creneauRelanceClient(paris(16, 10)), true);
  assert.equal(creneauRelanceClient(paris(16, 7, 59)), false);
  assert.equal(creneauRelanceClient(paris(16, 19)), false);
  assert.equal(creneauRelanceClient(paris(14, 10)), true, 'samedi matin');
  assert.equal(creneauRelanceClient(paris(15, 10)), false, 'dimanche');
});

test('relances : J+3 puis J+7 ; jamais deux fois ; rien après réponse ou révocation ; expiration à 30 jours', () => {
  const envoiLe = paris(9, 10); // lundi 9 nov.
  const expireLe = paris(9 + 30, 10);
  const base = { statut: 'Envoyé au client', envoiLe, expireLe, reponduOuRevoque: false, relanceJ3Le: null, relanceJ7Le: null };
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(11, 10) }), 'aucune', 'J+2');
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(12, 10) }), 'relancer_j3');
  assert.equal(prochaineActionDevis({ ...base, relanceJ3Le: paris(12, 10), maintenant: paris(13, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, relanceJ3Le: paris(12, 10), maintenant: paris(16, 10) }), 'relancer_j7');
  assert.equal(prochaineActionDevis({ ...base, relanceJ3Le: paris(12, 10), relanceJ7Le: paris(16, 10), maintenant: paris(20, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(16, 10) }), 'relancer_j7', 'J+7 atteint sans J+3 : on n\'envoie que J+7');
  assert.equal(prochaineActionDevis({ ...base, reponduOuRevoque: true, maintenant: paris(20, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, statut: 'Accepté', maintenant: paris(20, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, statut: 'À préparer', maintenant: paris(20, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, relanceJ3Le: paris(12, 10), relanceJ7Le: paris(16, 10), maintenant: paris(9 + 30, 10) }), 'expirer');
});

test('relances : pas la nuit ni le dimanche, mais l\'expiration passe toujours', () => {
  const envoiLe = paris(9, 10);
  const base = { statut: 'Envoyé au client', envoiLe, expireLe: paris(39, 10), reponduOuRevoque: false, relanceJ3Le: null, relanceJ7Le: null };
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(12, 22) }), 'aucune', 'nuit');
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(15, 10) }), 'aucune', 'dimanche');
  assert.equal(prochaineActionDevis({ ...base, expireLe: paris(15, 3), maintenant: paris(15, 4) }), 'expirer', 'expiration un dimanche à 4 h');
});

test('PDF : doit être un vrai PDF de 8 Mo maximum', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const ok = validerPdf('Devis 2026/12.pdf', pdf.toString('base64'));
  assert.equal(ok.ok, true);
  assert.equal((ok as any).nom, 'Devis 2026_12.pdf');
  assert.equal(validerPdf('devis.exe', pdf.toString('base64')).ok, false);
  assert.equal(validerPdf('devis.pdf', Buffer.from('MZ pas un pdf').toString('base64')).ok, false);
  assert.equal(validerPdf('devis.pdf', '').ok, false);
  assert.equal(validerPdf('devis.pdf', Buffer.alloc(8 * 1024 * 1024 + 10, 65).toString('base64')).ok, false);
  assert.equal(validerPdf('devis.pdf', `data:application/pdf;base64,${pdf.toString('base64')}`).ok, true);
});

test('contenu du devis : seul ce que le client voit révoque le lien (pas les notes, ni un taux de TVA renseigné pour la première fois)', () => {
  const avant = { amount: 5000, montantHt: '5000', tauxTVA: null, objet: 'Rénovation', client: 'Atlas', siteAdresse: '3 rue Y', corpsEtat: 'Électricité', notes: 'a' };
  assert.equal(contenuDevisModifie(avant, { ...avant, notes: 'autre note', statutCommercial: 'X' }), false);
  assert.equal(contenuDevisModifie(avant, { ...avant, montantHt: '5000.00', amount: 5000.0 }), false, 'même montant, autre écriture');
  assert.equal(contenuDevisModifie(avant, { ...avant, tauxTVA: 20 }), false, 'taux renseigné pour la première fois');
  assert.equal(contenuDevisModifie({ ...avant, tauxTVA: 10 }, { ...avant, tauxTVA: 20 }), true, 'taux modifié');
  assert.equal(contenuDevisModifie(avant, { ...avant, montantHt: 6100 }), true);
  assert.equal(contenuDevisModifie(avant, { ...avant, objet: ' Rénovation  lourde ' }), true);
  assert.equal(contenuDevisModifie(avant, { ...avant, objet: ' Rénovation ' }), false, 'espaces ignorés');
});

test('PDF du devis : génération automatique avec chiffrage, rapport de visite technique et photo', async () => {
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const pdf = await genererPdfDevis({
    societe: 'ANELEC GROUPE',
    contenu: {
      reference: 'DEV-2026-009',
      numeroDI: 'DI-900',
      client: 'Groupe Atlas',
      site: '3 rue de la Paix',
      objet: 'Remplacement tableau général basse tension.',
      corpsEtat: 'Électricité',
      responsable: 'Admin',
      dateEmission: '2026-11-14',
      validiteJours: 30,
      echeance: '2026-12-14',
      montantHt: 2500,
      tauxTVA: 20,
      montantTtc: 3000,
      notes: 'Délai 5 jours ouvrés.',
      visite: {
        technicien: 'Karim',
        dateVisite: '2026-11-12',
        statut: 'Terminée',
        comptesRendus: ['Relève des cotes et repérage des départs validé.'],
      },
    },
    photos: [{ id: 'v1', caption: 'Tableau existant', category: 'AVANT', octets: Buffer.from(PNG, 'base64'), type: 'png' }],
  });
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.equal(validerPdf('devis-DEV-2026-009.pdf', pdf.toString('base64')).ok, true);
});

test('Visite technique préalable interne : parsing historique (details/detail) et génération PDF', async () => {
  assert.equal(normaliserVisiteRapport({ constatTechnique: '   ', travauxAPrevoir: '' }), null);

  const devisAvecRapport = {
    visiteTechnicien: 'Karim Benali',
    visiteDate: '2026-11-12',
    historiqueJson: JSON.stringify([
      {
        action: 'VISITE_RAPPORT_INTERNE',
        details: JSON.stringify({
          constatTechnique: 'TGBT vétuste, disjoncteur principal 250A à remplacer.',
          travauxAPrevoir: 'Dépose ancien coffret et pose TGBT neuf 4 rangées.',
          materielNecessaire: 'Coffret Prisma, disjoncteur 250A, repérage filerie',
          contraintesAcces: 'Coupure générale samedi matin 08h-12h avec gardien.',
          estimationDuree: '1,5 jour à 2 techniciens',
          redigePar: 'Karim Benali',
          redigeLe: '2026-11-12',
        }),
      },
      { action: 'COMPTE_RENDU_VISITE', details: 'Accès local technique vérifié.' },
      { action: 'COMPTE_RENDU_VISITE', detail: 'Ancien format detail pris en compte.' },
    ]),
  };

  assert.deepEqual(comptesRendusVisiteDevis(devisAvecRapport), [
    'Accès local technique vérifié.',
    'Ancien format detail pris en compte.',
  ]);

  const parsed = parseVisiteRapportInterne(devisAvecRapport);
  assert.ok(parsed);
  assert.equal(parsed.estimationDuree, '1,5 jour à 2 techniciens');
  assert.equal(parsed.redigePar, 'Karim Benali');

  // Fallback sur COMPTE_RENDU_VISITE si pas encore de VISITE_RAPPORT_INTERNE structuré
  const fallback = parseVisiteRapportInterne({
    visiteTechnicien: 'Nadia',
    visiteDate: '2026-11-13',
    historiqueJson: JSON.stringify([{ action: 'COMPTE_RENDU_VISITE', details: 'Relevé cotes OK' }]),
  });
  assert.equal(fallback?.constatTechnique, 'Relevé cotes OK');
  assert.equal(fallback?.redigePar, 'Nadia');

  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const pdf = await genererPdfVisiteTechnique({
    societe: 'ANELEC GROUPE',
    contenu: {
      reference: 'DEV-2026-009',
      numeroDI: 'DI-900',
      client: 'Groupe Atlas',
      site: '3 rue de la Paix',
      objet: 'Remplacement tableau général basse tension.',
      corpsEtat: 'Électricité',
      responsable: 'Admin',
      technicien: 'Karim Benali',
      dateVisite: '2026-11-12',
      heureDebut: '09:00',
      heureFin: '10:30',
      statutVisite: 'REALISEE',
      rapport: parsed,
      comptesRendusTerrain: ['Accès local technique vérifié.'],
    },
    photos: [{ id: 'v1', caption: 'Tableau existant', category: 'AVANT', octets: Buffer.from(PNG, 'base64'), type: 'png' }],
  });
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.equal(validerPdf('visite-technique-DEV-2026-009.pdf', pdf.toString('base64')).ok, true);
});

test('Compression PDF & photos : réduction MozJPEG haute qualité (PNG/WebP/JPG) et allégement des PDF déposés', async () => {
  const w = 1400;
  const h = 1050;
  const rgb = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      const noise = ((x * 29 + y * 13) ^ (x * y)) & 0x1f;
      rgb[idx] = Math.min(255, ((x * 255) / w) | 0 + noise);
      rgb[idx + 1] = Math.min(255, ((y * 255) / h) | 0 + noise);
      rgb[idx + 2] = 110 + (noise >> 1);
    }
  }

  const bigPng = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const bigWebp = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 90 }).toBuffer();
  const bigJpg = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();

  const resPng = await optimiserPhotoPourPdf(bigPng, 'png');
  const resWebp = await optimiserPhotoPourPdf(bigWebp, 'webp');
  assert.equal(resPng.type, 'jpeg');
  assert.equal(resWebp.type, 'jpeg');
  assert.ok(resPng.octets.length < bigPng.length * 0.25);
  assert.ok(resWebp.octets.length < bigWebp.length * 0.3);

  // Ne jamais grossir une image minuscule déjà optimale
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const resTiny = await optimiserPhotoPourPdf(tinyPng, 'png');
  assert.equal(resTiny.octets.length, tinyPng.length);
  assert.equal(resTiny.type, 'png');

  // PDF externe déposé contenant une image JPEG haute résolution et sans object streams
  const extPdfDoc = await PDFDocument.create();
  const pg = extPdfDoc.addPage([595, 842]);
  const jpgImg = await extPdfDoc.embedJpg(bigJpg);
  pg.drawImage(jpgImg, { x: 40, y: 200, width: 480, height: 360 });
  const unoptimized = Buffer.from(await extPdfDoc.save({ useObjectStreams: false }));

  const compacted = await preparerPdfDeposeCompresse(unoptimized);
  assert.equal(compacted.compressed, true);
  assert.ok(compacted.octets.length < unoptimized.length * 0.5);
  assert.equal(compacted.octets.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.equal(validerPdf('devis-externe.pdf', compacted.octets.toString('base64')).ok, true);

  // Stockage base : photos technicien PNG/WebP/gros JPEG compressées en MozJPEG <= ~50 Ko, petits JPEG conservés intacts
  const storedJson = await sanitizeAndOptimizePhotosJson([
    { id: 't1', url: `data:image/png;base64,${bigPng.toString('base64')}`, category: 'Terrain', caption: 'Photo 1 technicien' },
    { id: 't2', url: `data:image/jpeg;base64,${resPng.octets.toString('base64')}`, category: 'Terrain', caption: 'Déjà optimisée' },
  ]);
  assert.ok(storedJson);
  const storedArr = JSON.parse(storedJson);
  assert.equal(storedArr.length, 2);
  assert.ok(storedArr[0].url.startsWith('data:image/jpeg;base64,'));
  assert.ok(storedArr[0].url.length < bigPng.toString('base64').length * 0.3);
  assert.equal(storedArr[1].url, `data:image/jpeg;base64,${resPng.octets.toString('base64')}`);
});
