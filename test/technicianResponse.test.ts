// Automatisation A — logique pure : relances, heures de bureau, suggestions, validation de la réponse.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dansHeuresBureau,
  estNouvelleAffectation,
  normaliserDelai,
  normaliserDelaiAlerte,
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

test('délais : bornés, relance à 15 min et alerte 5 min après par défaut', () => {
  assert.equal(normaliserDelai(undefined), 15);
  assert.equal(normaliserDelai('abc'), 15);
  assert.equal(normaliserDelai(1), 5);
  assert.equal(normaliserDelai(999999), 1440);
  assert.equal(normaliserDelai(90), 90);
  assert.equal(normaliserDelaiAlerte(undefined), 5);
  assert.equal(normaliserDelaiAlerte(0), 5);
});

test('relance : rien avant 15 min, relance à 15 min, alerte planificateur+direction 5 min plus tard, jamais deux fois', () => {
  const affecteLe = lundi(9);
  const base = { reponse: 'EN_ATTENTE', affecteLe, relanceLe: null, alerteLe: null, delaiMinutes: 15, delaiAlerteMinutes: 5 };
  assert.equal(prochaineAction({ ...base, maintenant: lundi(9, 14) }), 'aucune');
  assert.equal(prochaineAction({ ...base, maintenant: lundi(9, 15) }), 'relancer_technicien');
  const relanceLe = lundi(9, 16);
  assert.equal(prochaineAction({ ...base, relanceLe, maintenant: lundi(9, 20) }), 'aucune');
  assert.equal(prochaineAction({ ...base, relanceLe, maintenant: lundi(9, 21) }), 'alerter_planificateur');
  assert.equal(prochaineAction({ ...base, relanceLe, alerteLe: lundi(9, 21), maintenant: lundi(18, 0) }), 'aucune');
});

test('relance : aucune si le technicien a répondu, ni la nuit ni le dimanche (sauf si les heures de bureau sont désactivées)', () => {
  const base = { affecteLe: lundi(9), relanceLe: null, alerteLe: null, delaiMinutes: 15, delaiAlerteMinutes: 5 };
  assert.equal(prochaineAction({ ...base, reponse: 'ACCEPTEE', maintenant: lundi(15) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: 'REFUSEE', maintenant: lundi(15) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: null, maintenant: lundi(15) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: 'EN_ATTENTE', maintenant: lundi(21) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: 'EN_ATTENTE', maintenant: dimanche(12) }), 'aucune');
  assert.equal(prochaineAction({ ...base, reponse: 'EN_ATTENTE', maintenant: lundi(21), heuresBureauSeulement: false }), 'relancer_technicien');
  assert.equal(prochaineAction({ ...base, affecteLe: dimanche(9), reponse: 'EN_ATTENTE', maintenant: dimanche(12), heuresBureauSeulement: false }), 'relancer_technicien');
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
