// Règles d'accès par rôle (étape 1 du cloisonnement) : fonctions pures, testées pour les 5 rôles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accessFor, canReadDevis, canReadIntervention, censorDevis, censorIntervention, techMatches,
} from '../server/lib/access.js';

const user = (role: string, extra: Record<string, unknown> = {}) =>
  accessFor({ id: 50, role, name: 'Karim Benali', technicienNom: role === 'TECHNICIEN' ? 'Karim Benali' : null, ...extra });

const ADMIN = user('ADMIN');
const CHIFFRAGE = user('CHIFFRAGE_DEVIS');
const CONDUCTEUR = user('CONDUCTEUR_TRAVAUX');
const RAPPORTS = user('REDACTEUR_RAPPORTS');
const TECH = user('TECHNICIEN');

test('demandes : seuls direction, chiffrage et conducteur les trient', () => {
  assert.deepEqual(
    [ADMIN, CHIFFRAGE, CONDUCTEUR, RAPPORTS, TECH].map((a) => a.canTriageDemandes),
    [true, true, true, false, false]
  );
});

test('pointages et GPS de toute l\'équipe : direction et conducteur uniquement', () => {
  assert.deepEqual(
    [ADMIN, CHIFFRAGE, CONDUCTEUR, RAPPORTS, TECH].map((a) => a.canSeeTeam),
    [true, false, true, false, false]
  );
});

test('montants : jamais pour un technicien', () => {
  assert.equal(TECH.canSeeAmounts, false);
  assert.deepEqual([ADMIN, CHIFFRAGE, CONDUCTEUR, RAPPORTS].map((a) => a.canSeeAmounts), [true, true, true, true]);
});

test('un droit retiré individuellement est respecté (montants)', () => {
  const sansMontants = user('CHIFFRAGE_DEVIS', { permissionsJson: JSON.stringify({ canViewFinancials: false }) });
  assert.equal(sansMontants.canSeeAmounts, false);
});

test('un technicien ne lit que SES visites de chiffrage ; un numéro deviné ne donne rien', () => {
  assert.equal(canReadDevis(TECH, { visiteTechnicien: 'Karim Benali', statutCommercial: 'Envoyé' }), true);
  assert.equal(canReadDevis(TECH, { visiteTechnicien: 'Sofia Martin', statutCommercial: 'Accepté' }), false);
  assert.equal(canReadDevis(TECH, { visiteTechnicien: null, statutCommercial: 'Accepté' }), false);
});

test('un technicien sans nom ne lit rien (jamais de correspondance vide)', () => {
  const sansNom = accessFor({ id: 60, role: 'TECHNICIEN', name: '', technicienNom: '' });
  assert.equal(canReadDevis(sansNom, { visiteTechnicien: 'Karim Benali' }), false);
  assert.equal(canReadIntervention(sansNom, { entreprise: 'Karim Benali', technicien: 'Karim Benali' }), false);
  assert.equal(techMatches('', ''), false);
});

test('un technicien ne lit que SES interventions', () => {
  assert.equal(canReadIntervention(TECH, { entreprise: 'Karim Benali' }), true);
  assert.equal(canReadIntervention(TECH, { technicien: 'karim benali' }), true);
  assert.equal(canReadIntervention(TECH, { entreprise: 'Sofia Martin', technicien: 'Sofia Martin' }), false);
  assert.equal(canReadIntervention(TECH, {}), false);
});

test('un profil mobile par droit individuel est traité comme un technicien', () => {
  const mobile = user('CONDUCTEUR_TRAVAUX', { permissionsJson: JSON.stringify({ mobileOnly: true }) });
  assert.equal(mobile.isFieldOnly, true);
  assert.equal(canReadIntervention(mobile, { entreprise: 'Autre' }), false);
});

test('devis : direction et chiffrage lisent tout ; conducteur seulement les devis acceptés ou ses visites', () => {
  const envoye = { visiteTechnicien: null, statutCommercial: 'Envoyé' };
  const accepte = { visiteTechnicien: null, statutCommercial: 'Accepté' };
  assert.equal(canReadDevis(ADMIN, envoye), true);
  assert.equal(canReadDevis(CHIFFRAGE, envoye), true);
  assert.equal(canReadDevis(CONDUCTEUR, envoye), false);
  assert.equal(canReadDevis(CONDUCTEUR, accepte), true);
  assert.equal(canReadDevis(RAPPORTS, accepte), false);
});

test('le masquage retire bien tous les montants', () => {
  const d = censorDevis({ amount: 1200, montantHt: 1000, client: 'X', computed: { totalFactureHt: 900, alerte: 'ok' } });
  assert.equal(d.amount, null);
  assert.equal(d.montantHt, null);
  assert.equal(d.computed.totalFactureHt, 0);
  assert.equal(d.computed.alerte, 'ok');
  const i = censorIntervention({ amount: 500, montantHt: 400, client: 'X' });
  assert.equal(i.amount, 0);
  assert.equal(i.montantHt, null);
  assert.equal(i.client, 'X');
});
