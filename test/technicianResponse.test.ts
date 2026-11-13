// Automatisation A — logique pure : relances, heures de bureau, suggestions, validation de la réponse.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dansHeuresBureau,
  estNouvelleAffectation,
  normaliserDelai,
  prochaineAction,
  suggererRemplacants,
  validerReponse,
} from '../server/domain/technicianResponse.js';

// Novembre 2026 : heure d'hiver (Paris = UTC+1). Lundi 16 nov. 2026.
const lundi = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 16, h - 1, m));
const dimanche = (h: number) => new Date(Date.UTC(2026, 10, 15, h - 1, 0));

test('heures de bureau : lundi–samedi, 8 h–19 h (heure de Paris)', () => {
  assert.equal(dansHeuresBureau(lundi(9)), true);
  assert.equal(dansHeuresBureau(lundi(7, 59)), false);
  assert.equal(dansHeuresBureau(lundi(19)), false);
  assert.equal(dansHeuresBureau(lundi(18, 59)), true);
  assert.equal(dansHeuresBureau(dimanche(10)), false);
});

test('nouvelle affectation : seulement quand un technicien est désigné et change', () => {
  assert.equal(estNouvelleAffectation(null, 'Karim'), true);
  assert.equal(estNouvelleAffectation('Karim', 'karim '), false);
  assert.equal(estNouvelleAffectation('Karim', 'Sofia'), true);
  assert.equal(estNouvelleAffectation('Karim', ''), false);
  assert.equal(estNouvelleAffectation('Karim', null), false);
});

test('délai : borné et valeur par défaut de 2 h', () => {
  assert.equal(normaliserDelai(undefined), 120);
  assert.equal(normaliserDelai('abc'), 120);
  assert.equal(normaliserDelai(1), 15);
  assert.equal(normaliserDelai(999999), 1440);
  assert.equal(normaliserDelai(90), 90);
});

test('relance : rien avant 2 h, une relance après 2 h, puis alerte au planificateur 2 h plus tard, jamais deux fois', () => {
  const affecteLe = lundi(9);
  const base = { reponse: 'EN_ATTENTE', affecteLe, relanceLe: null, alerteLe: null, delaiMinutes: 120 };
  assert.equal(prochaineAction({ ...base, maintenant: lundi(10, 59) }), 'aucune');
  assert.equal(prochaineAction({ ...base, maintenant: lundi(11, 0) }), 'relancer_technicien');
  const relanceLe = lundi(11, 0);
  assert.equal(prochaineAction({ ...base, relanceLe, maintenant: lundi(12, 59) }), 'aucune');
  assert.equal(prochaineAction({ ...base, relanceLe, maintenant: lundi(13, 0) }), 'alerter_planificateur');
  assert.equal(prochaineAction({ ...base, relanceLe, alerteLe: lundi(13, 0), maintenant: lundi(18, 0) }), 'aucune');
});

test('relance : aucune si le technicien a répondu, ni la nuit, ni le dimanche', () => {
  const base = { affecteLe: lundi(9), relanceLe: null, alerteLe: null, delaiMinutes: 120 };
  assert.equal(prochaineAction({ ...base, reponse: 'ACCEPTEE', maintenant: lundi(15) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: 'REFUSEE', maintenant: lundi(15) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: null, maintenant: lundi(15) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: 'EN_ATTENTE', maintenant: lundi(21) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: 'EN_ATTENTE', maintenant: dimanche(12) }), 'aucune');
});

test('remplaçants : jamais le refusant, compétence d\'abord, puis charge du jour la plus faible', () => {
  const r = suggererRemplacants(
    [
      { nom: 'Karim', chargeDuJour: 0, competences: ['Électricité'] },
      { nom: 'Sofia', chargeDuJour: 3, competences: ['Électricité'] },
      { nom: 'Luc', chargeDuJour: 0, competences: ['Plomberie'] },
      { nom: 'Ines', chargeDuJour: 1, competences: ['Électricité'] },
    ],
    'Karim',
    'Électricité'
  );
  assert.deepEqual(r.map((c) => c.nom), ['Ines', 'Sofia', 'Luc']);
  assert.equal(suggererRemplacants([], 'Karim').length, 0);
});

test('réponse : refus sans motif rejeté, réponse inconnue rejetée, acceptation sans motif acceptée', () => {
  assert.equal(validerReponse({ reponse: 'refusee' }).ok, false);
  assert.equal(validerReponse({ reponse: 'REFUSEE', motif: 'ok' }).ok, false);
  assert.equal(validerReponse({ reponse: 'PEUT-ETRE' }).ok, false);
  assert.equal(validerReponse(undefined).ok, false);
  const ok = validerReponse({ reponse: 'REFUSEE', motif: 'Je suis en congés ce jour-là' });
  assert.equal(ok.ok && ok.value.reponse, 'REFUSEE');
  assert.equal(validerReponse({ reponse: 'acceptee' }).ok, true);
});
