// Automatisation C — fonctions pures du rapport client (statuts, jeton, réponse, photos, relances, révocation, PDF).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUT_RESERVES,
  STATUT_VALIDE_CLIENT,
  choisirPhotos,
  contenuRapportModifie,
  envoiRapportAutorise,
  fabriquerContenu,
  fabriquerJetonRapport,
  genererSel,
  idDuJeton,
  photosTransmissibles,
  prochaineActionRapport,
  statutApresReponseRapport,
  validerReponseRapport,
  verifierJetonRapport,
} from '../server/domain/rapportClient.js';
import { adressesDepuisFiche, choisirDestinataires, validerPdf } from '../server/domain/devisClient.js';
import { genererPdfRapport } from '../server/services/rapportPdf.js';

const paris = (jour: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, jour, h - 1, m));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('envoi : uniquement après validation interne ; jamais si déjà validé par le client', () => {
  assert.equal(envoiRapportAutorise('Validé & Clôturé').ok, true);
  assert.equal(envoiRapportAutorise('Envoyé au client').ok, true, 'renvoi possible');
  assert.equal(envoiRapportAutorise(STATUT_RESERVES).ok, true, 'renvoi après réserves');
  for (const s of ['Brouillon', 'Déclaré par technicien', 'Validé par technicien', '', null, undefined]) {
    const r: any = envoiRapportAutorise(s as any);
    assert.equal(r.ok, false, String(s));
    assert.equal(r.code, 'VALIDATION_INTERNE_REQUISE');
  }
  assert.equal((envoiRapportAutorise(STATUT_VALIDE_CLIENT) as any).code, 'DEJA_VALIDE');
});

test('adresses : le drapeau « reçoit les rapports » de la fiche client sert de suggestion', () => {
  const fiche = {
    nom: 'Atlas', email: 'contact@atlas.fr',
    services: [
      { nomService: 'Travaux', email: 'travaux@atlas.fr', recevoirRapports: true, recevoirDevis: false },
      { nomService: 'Compta', email: 'compta@atlas.fr', recevoirRapports: false, recevoirDevis: true },
    ],
  };
  const pourRapport = adressesDepuisFiche(fiche, 'recevoirRapports');
  assert.deepEqual(pourRapport.filter((a) => a.suggeree).map((a) => a.email), ['travaux@atlas.fr']);
  assert.deepEqual(adressesDepuisFiche(fiche).filter((a) => a.suggeree).map((a) => a.email), ['compta@atlas.fr']);
  const r: any = choisirDestinataires(pourRapport, [], 'le rapport');
  assert.equal(r.code, 'CONFIRMATION_REQUISE');
  assert.match(r.message, /le rapport/);
});

test('jeton : lié à la société ET à l’intervention, signé ; un jeton de devis ne vaut rien ici', () => {
  const l = { id: 7, companyId: 1, interventionId: 42, sel: genererSel() };
  const j = fabriquerJetonRapport('secret', l);
  assert.equal(idDuJeton(j), 7);
  assert.equal(verifierJetonRapport('secret', j, l), true);
  assert.equal(verifierJetonRapport('autre-secret', j, l), false);
  assert.equal(verifierJetonRapport('secret', j, { ...l, companyId: 2 }), false);
  assert.equal(verifierJetonRapport('secret', j, { ...l, interventionId: 43 }), false);
  assert.equal(verifierJetonRapport('secret', j, { ...l, sel: 'x' }), false);
  assert.equal(verifierJetonRapport('secret', 'n-importe-quoi', l), false);
});

test('réponse : nom obligatoire ; réserves = texte obligatoire ; validation sans texte', () => {
  assert.equal((validerReponseRapport({ reponse: 'VALIDE', nom: 'M. Durand' }) as any).ok, true);
  assert.equal(validerReponseRapport({ reponse: 'VALIDE', nom: '' }).ok, false);
  assert.equal(validerReponseRapport({ reponse: 'VALIDE' }).ok, false);
  assert.equal(validerReponseRapport({ reponse: 'RESERVES', nom: 'Durand', motif: 'ok' }).ok, false);
  const ok: any = validerReponseRapport({ reponse: 'reserves', nom: ' Durand ', motif: ' Fuite non traitée ' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { reponse: 'RESERVES', nom: 'Durand', motif: 'Fuite non traitée' });
  assert.equal(validerReponseRapport({ reponse: 'ACCEPTEE', nom: 'Durand' }).ok, false, 'vocabulaire du devis refusé');
  assert.equal(statutApresReponseRapport('VALIDE'), STATUT_VALIDE_CLIENT);
  assert.equal(statutApresReponseRapport('RESERVES'), STATUT_RESERVES);
});

test('photos : seules les images intégrées sont transmissibles', () => {
  const dispo = photosTransmissibles([
    { id: 'a', url: PNG, caption: 'Avant' },
    { id: 'b', url: 'https://exemple.fr/interne.jpg' },
    { id: 'c', url: 'data:text/html;base64,PHNjcmlwdD4=' },
    { id: '', url: PNG },
    { id: 'a', url: PNG },
    { id: 'd', url: PNG.replace('png', 'jpeg'), caption: 'Après', category: 'APRES' },
  ]);
  assert.deepEqual(dispo.map((p) => p.id), ['a', 'd']);
  assert.equal(dispo[1].type, 'jpeg');
});

test('photos : « Tout cocher », sélection choisie, aucune ; une photo inconnue est refusée', () => {
  const dispo = photosTransmissibles([{ id: 'a', url: PNG }, { id: 'b', url: PNG }, { id: 'c', url: PNG }]);
  assert.deepEqual((choisirPhotos(dispo, { toutes: true }) as any).ids, ['a', 'b', 'c']);
  assert.deepEqual((choisirPhotos(dispo, { ids: ['c', 'a'] }) as any).ids, ['a', 'c'], 'ordre du rapport');
  assert.deepEqual((choisirPhotos(dispo, { ids: [] }) as any).ids, []);
  assert.deepEqual((choisirPhotos(dispo, {}) as any).ids, []);
  assert.equal(choisirPhotos(dispo, { ids: ['a', 'zzz'] }).ok, false);
  assert.deepEqual((choisirPhotos(dispo, { toutes: true, ids: ['zzz'] }) as any).ids, ['a', 'b', 'c'], '« tout » l’emporte');
});

test('contenu vu par le client : figé, avec seulement les photos choisies', () => {
  const dispo = photosTransmissibles([{ id: 'a', url: PNG, caption: 'Avant' }, { id: 'b', url: PNG }]);
  const c = fabriquerContenu(
    { client: 'Atlas', chantier: 'Fuite', siteAdresse: '3 rue Y', rapportFinal: ' Travaux terminés ', compteRendu: 'brouillon', dateReelle: new Date('2026-11-10T09:00:00Z') },
    'INT-001', ['Remplacement joint', ' '], [dispo[0]]
  );
  assert.equal(c.rapport, 'Travaux terminés');
  assert.equal(c.dateReelle, '2026-11-10');
  assert.deepEqual(c.actionsRealisees, ['Remplacement joint']);
  assert.deepEqual(c.photos.map((p) => p.id), ['a']);
  assert.ok(!JSON.stringify(c).includes('base64'), 'aucune image dans le contenu figé');
});

const etat = (o: Record<string, any> = {}) => ({
  statutRapport: 'Envoyé au client', envoiLe: paris(9, 10), expireLe: new Date(paris(9, 10).getTime() + 30 * 86400000),
  reponduOuRevoque: false, relanceJ3Le: null, relanceJ7Le: null, maintenant: paris(16, 10), ...o,
});

test('relances : J+3 puis J+7 dans le créneau, expiration à 30 jours, JAMAIS de validation tacite', () => {
  assert.equal(prochaineActionRapport(etat({ maintenant: paris(11, 10) })), 'aucune');
  assert.equal(prochaineActionRapport(etat({ maintenant: paris(12, 10) })), 'relancer_j3');
  assert.equal(prochaineActionRapport(etat({ maintenant: paris(12, 10), relanceJ3Le: paris(12, 9) })), 'aucune');
  assert.equal(prochaineActionRapport(etat({ maintenant: paris(16, 10), relanceJ3Le: paris(12, 9) })), 'relancer_j7');
  assert.equal(prochaineActionRapport(etat({ maintenant: paris(15, 10) })), 'aucune', 'dimanche');
  assert.equal(prochaineActionRapport(etat({ maintenant: paris(16, 7) })), 'aucune', 'avant 8 h');
  assert.equal(prochaineActionRapport(etat({ maintenant: paris(16, 20) })), 'aucune', 'après 19 h');
  assert.equal(prochaineActionRapport(etat({ maintenant: new Date(paris(9, 10).getTime() + 31 * 86400000) })), 'expirer');
  // rien du tout s'il a répondu, si le lien est révoqué, ou si le rapport n'est plus « Envoyé au client »
  assert.equal(prochaineActionRapport(etat({ reponduOuRevoque: true })), 'aucune');
  for (const s of [STATUT_VALIDE_CLIENT, STATUT_RESERVES, 'Validé & Clôturé', null]) {
    assert.equal(prochaineActionRapport(etat({ statutRapport: s as any })), 'aucune', String(s));
  }
});

test('révocation : seuls les champs que le client voit comptent', () => {
  const base = {
    rapportFinal: 'Travaux terminés', compteRendu: null, actionsRealiseesJson: '["A"]', client: 'Atlas', chantier: 'Fuite',
    siteAdresse: '3 rue Y', objet: 'Fuite', corpsEtat: 'Plomberie', typeIntervention: 'Dépannage', dateReelle: new Date('2026-11-10'),
    photosJson: JSON.stringify([{ id: 'a', url: PNG, caption: 'x' }]),
    statutRapport: 'Envoyé au client', notes: 'interne', numeroFacture: null, amount: 100,
  };
  assert.equal(contenuRapportModifie(base, { ...base, notes: 'autre note', numeroFacture: 'F-1', amount: 200, statutRapport: 'Réserves client' }), false);
  assert.equal(contenuRapportModifie(base, { ...base, dateReelle: new Date('2026-11-10T20:00:00Z') }), false, 'même jour');
  assert.equal(contenuRapportModifie(base, { ...base, rapportFinal: 'Travaux terminés et vérifiés' }), true);
  assert.equal(contenuRapportModifie(base, { ...base, actionsRealiseesJson: '["A","B"]' }), true);
  assert.equal(contenuRapportModifie(base, { ...base, photosJson: JSON.stringify([{ id: 'a', url: PNG, caption: 'x' }, { id: 'b', url: PNG }]) }), true);
  assert.equal(contenuRapportModifie(base, { ...base, client: 'Autre client' }), true);
  assert.equal(contenuRapportModifie(base, { ...base, dateReelle: new Date('2026-11-11') }), true);
});

test('PDF du rapport : un vrai PDF, accents et photo intégrés, texte long sur plusieurs pages', async () => {
  const dispo = photosTransmissibles([{ id: 'a', url: PNG, caption: 'Avant travaux' }]);
  const contenu = fabriquerContenu(
    { client: 'Société Générale d’Électricité', chantier: 'Réparation fuite → cuve', rapportFinal: 'Intervention réalisée. '.repeat(400) },
    'INT-001', ['Remplacement du joint', 'Contrôle d’étanchéité ≥ 10 bars'], dispo
  );
  const octets = Buffer.from(PNG.split(',')[1], 'base64');
  const pdf = await genererPdfRapport({ societe: 'Sirène Bâtiment', contenu, photos: [{ id: 'a', caption: 'Avant travaux', category: 'AVANT', octets, type: 'png' }] });
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  const v = validerPdf('rapport.pdf', pdf.toString('base64'), 'rapport');
  assert.equal(v.ok, true, 'le PDF généré passe la validation du dépôt');
  const { PDFDocument } = await import('pdf-lib');
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 2, 'le texte long passe sur plusieurs pages');
});
