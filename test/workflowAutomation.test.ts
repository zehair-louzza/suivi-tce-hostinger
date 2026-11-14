import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDevisAutomations,
  applyInterventionAutomations,
  addDaysISO,
  getTodayParisISO,
} from '../shared/types.js';

test('Devis : valeurs initiales automatiques à la création (dateCreated, echeance J+7, validité 30j, statut À préparer)', () => {
  const today = getTodayParisISO();
  const res = applyDevisAutomations({
    client: 'Syndic Alpha',
    numeroDI: 'DI-100',
    statutCommercial: 'À préparer',
    amount: 0,
  });

  assert.equal(res.dateCreated, today);
  assert.equal(res.echeance, addDaysISO(today, 7));
  assert.equal(res.validiteJours, 30);
  assert.equal(res.statutCommercial, 'À préparer');
  assert.equal(res.traitement, 'À traiter');
  assert.equal(res.prochaineAction, 'Chiffrer');
  assert.equal(res.dateRelance ?? null, null);
});

test('Devis : saisie montant > 0 passe en « À valider en interne »', () => {
  const prev = applyDevisAutomations({
    statutCommercial: 'À préparer',
    amount: 0,
    dateCreated: '2026-11-10',
  });
  const next = applyDevisAutomations({ ...prev, amount: 1850 }, prev);

  assert.equal(next.statutCommercial, 'À valider en interne');
  assert.equal(next.prochaineAction, 'Faire valider');
});

test('Devis : saisie de dateEnvoi calcule dateRelance (J+3), échéance (+validité) et statut « Envoyé au client »', () => {
  const today = getTodayParisISO();
  const prev = applyDevisAutomations({
    statutCommercial: 'À valider en interne',
    amount: 2400,
    validiteJours: 30,
    dateCreated: today,
  });
  const next = applyDevisAutomations({ ...prev, dateEnvoi: today }, prev);

  assert.equal(next.statutCommercial, 'Envoyé au client');
  assert.equal(next.dateRelance, addDaysISO(today, 3));
  assert.equal(next.echeance, addDaysISO(today, 30));
  assert.equal(next.traitement, 'En attente client');
  assert.equal(next.prochaineAction, 'Relancer le client');
});

test('Devis : passage manuel à « Envoyé au client » sans dateEnvoi remplit dateEnvoi=aujourd’hui, dateRelance J+3 et échéance', () => {
  const today = getTodayParisISO();
  const prev = applyDevisAutomations({
    statutCommercial: 'À valider en interne',
    amount: 900,
    validiteJours: 45,
    dateCreated: today,
  });
  const next = applyDevisAutomations({ ...prev, statutCommercial: 'Envoyé au client' }, prev);

  assert.equal(next.dateEnvoi, today);
  assert.equal(next.dateRelance, addDaysISO(today, 3));
  assert.equal(next.echeance, addDaysISO(today, 45));
});

test('Devis : filet de sécurité sur un devis déjà Envoyé avec dateEnvoi sans dateRelance (cas screenshot)', () => {
  const today = getTodayParisISO();
  const res = applyDevisAutomations({
    statutCommercial: 'Envoyé au client',
    dateCreated: today,
    dateEnvoi: today,
    dateRelance: null,
    validiteJours: 30,
  });
  assert.equal(res.dateRelance, addDaysISO(today, 3));
});

test('Devis : auto-expiration si Envoyé et validité dépassée', () => {
  const res = applyDevisAutomations({
    statutCommercial: 'Envoyé au client',
    dateCreated: '2025-01-01',
    dateEnvoi: '2025-01-02',
    validiteJours: 30,
  });
  assert.equal(res.statutCommercial, 'Expiré');
  assert.equal(res.dateRelance, null);
  assert.equal(res.traitement, 'Traité');
});

test('Devis : état terminal (Accepté / Refusé / Annulé) efface dateRelance et met à jour action & traitement', () => {
  const today = getTodayParisISO();
  const prev = applyDevisAutomations({
    statutCommercial: 'Envoyé au client',
    dateCreated: today,
    dateEnvoi: today,
    dateRelance: addDaysISO(today, 3),
  });
  const accepted = applyDevisAutomations({ ...prev, statutCommercial: 'Accepté' }, prev);
  assert.equal(accepted.dateRelance, null);
  assert.equal(accepted.traitement, 'Traité');
  assert.equal(accepted.prochaineAction, 'Planifier après accord');
});

test('Intervention : SLA automatique selon priorité à la création (Urgente=J+1, Haute=J+3, Normale=J+7, Basse=J+14)', () => {
  const baseDate = '2026-11-14';
  assert.equal(
    applyInterventionAutomations({ dateDemande: baseDate, priorite: 'Urgente', statutOperationnel: 'À planifier' }).echeance,
    '2026-11-15'
  );
  assert.equal(
    applyInterventionAutomations({ dateDemande: baseDate, priorite: 'Haute', statutOperationnel: 'À planifier' }).echeance,
    '2026-11-17'
  );
  assert.equal(
    applyInterventionAutomations({ dateDemande: baseDate, priorite: 'Normale', statutOperationnel: 'À planifier' }).echeance,
    '2026-11-21'
  );
  assert.equal(
    applyInterventionAutomations({ dateDemande: baseDate, priorite: 'Basse', statutOperationnel: 'À planifier' }).echeance,
    '2026-11-28'
  );
});

test('Intervention : affectation technicien seul => « Affectée » ; technicien + datePlanifiee => « Planifiée » + horaires + mode', () => {
  const prev = applyInterventionAutomations({
    dateDemande: '2026-11-14',
    statutOperationnel: 'À planifier',
    priorite: 'Normale',
    entreprise: '',
    datePlanifiee: null,
  });
  assert.equal(prev.statutOperationnel, 'À planifier');
  assert.equal(prev.modePlanification, 'Non planifiée');

  const assignedOnly = applyInterventionAutomations({ ...prev, entreprise: 'Karim' }, prev);
  assert.equal(assignedOnly.statutOperationnel, 'Affectée');

  const planned = applyInterventionAutomations({ ...assignedOnly, datePlanifiee: '2026-11-18' }, assignedOnly);
  assert.equal(planned.statutOperationnel, 'Planifiée');
  assert.equal(planned.modePlanification, 'Planifiée');
  assert.equal(planned.echeance, '2026-11-18');
  assert.equal(planned.heureDebut, '08:00');
  assert.equal(planned.heureFin, '12:00');

  // Retrait du technicien => retour À planifier
  const unassigned = applyInterventionAutomations({ ...planned, entreprise: '' }, planned);
  assert.equal(unassigned.statutOperationnel, 'À planifier');
});

test('Intervention : motif de blocage => « Suspendue » / « Bloqué » ; numéro de facture => « Facturée » ; Clôturée => dateReelle & Validé', () => {
  const prev = applyInterventionAutomations({
    dateDemande: '2026-11-14',
    statutOperationnel: 'En cours',
    entreprise: 'Karim',
    datePlanifiee: '2026-11-14',
  });
  const blocked = applyInterventionAutomations({ ...prev, motifBlocage: 'Attente pièce constructeur' }, prev);
  assert.equal(blocked.statutOperationnel, 'Suspendue');
  assert.equal(blocked.traitement, 'Bloqué');

  const closed = applyInterventionAutomations({ ...blocked, statutOperationnel: 'Clôturée', numeroFacture: 'FAC-2026-09' }, blocked);
  assert.equal(closed.dateReelle, getTodayParisISO());
  assert.equal(closed.statutRapport, 'Validé');
  assert.equal(closed.statutFacture, 'Facturée');
});
