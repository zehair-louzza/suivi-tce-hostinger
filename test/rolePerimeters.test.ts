// Étape 3 — périmètres de données par rôle : plafonds de droits, champs écrits/lus, vues terrain.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accessFor,
  canReadIntervention,
  fieldViewDevis,
  fieldViewIntervention,
  limitDevisBody,
  limitToWritable,
  shapeClientFiche,
  shapeDevis,
  shapeIntervention,
  writableInterventionFields,
} from '../server/lib/access.js';
import { canUserAccessSection, getEffectivePermissions, isPermissionAllowedForRole } from '../shared/types.js';

const user = (role: string, extra: Record<string, unknown> = {}) =>
  accessFor({ id: 50, role, name: 'Karim', technicienNom: role === 'TECHNICIEN' ? 'Karim' : null, ...extra } as any);

test('plafond : un badge individuel ne peut jamais donner Facturation/Admin à un technicien', () => {
  const p = getEffectivePermissions(
    'TECHNICIEN',
    JSON.stringify({ canManageBilling: true, canManageUsers: true, canViewFinancials: true, canEditDevis: true })
  );
  assert.equal(p.canManageBilling, false);
  assert.equal(p.canManageUsers, false);
  assert.equal(p.canViewFinancials, false);
  assert.equal(p.canEditDevis, false);
  assert.equal(p.canAccessMobileTech, true);
});

test('plafond : personne hors direction ne gère les utilisateurs ni ne supprime', () => {
  for (const role of ['CHIFFRAGE_DEVIS', 'CONDUCTEUR_TRAVAUX', 'REDACTEUR_RAPPORTS', 'TECHNICIEN']) {
    const p = getEffectivePermissions(role, JSON.stringify({ canManageUsers: true, canDeleteRecords: true }));
    assert.equal(p.canManageUsers, false, role);
    assert.equal(p.canDeleteRecords, false, role);
    assert.equal(user(role, { permissionsJson: JSON.stringify({ canManageUsers: true }) }).isAdmin, false, role);
  }
  assert.equal(isPermissionAllowedForRole('TECHNICIEN', 'canManageBilling'), false);
  assert.equal(isPermissionAllowedForRole('ADMIN', 'canManageBilling'), true);
  assert.equal(isPermissionAllowedForRole('PIRATE', 'canEditDevis'), false);
});

test('plafond : le chiffrage ne facture pas, le rapports ne planifie pas ni ne chiffre', () => {
  const c = getEffectivePermissions('CHIFFRAGE_DEVIS', JSON.stringify({ canManageBilling: true, canEditInterventions: true }));
  assert.equal(c.canManageBilling, false);
  assert.equal(c.canEditInterventions, false);
  const r = getEffectivePermissions('REDACTEUR_RAPPORTS', JSON.stringify({ canEditDevis: true, canEditPlanning: true }));
  assert.equal(r.canEditDevis, false);
  assert.equal(r.canEditPlanning, false);
});

test('rentabilité : direction uniquement ; le chargé d\'études lit les interventions mais n\'a pas la facturation', () => {
  const mk = (role: string) => ({ id: 50, role, permissions: getEffectivePermissions(role, null) } as any);
  for (const role of ['CHIFFRAGE_DEVIS', 'CONDUCTEUR_TRAVAUX', 'REDACTEUR_RAPPORTS', 'TECHNICIEN']) {
    assert.equal(canUserAccessSection('rentabilite', mk(role)), false, role);
  }
  assert.equal(canUserAccessSection('rentabilite', { id: 6, role: 'ADMIN' } as any), true);
  assert.equal(canUserAccessSection('interventions', mk('CHIFFRAGE_DEVIS')), true);
  assert.equal(canUserAccessSection('facturation', mk('CHIFFRAGE_DEVIS')), false);
  assert.equal(canUserAccessSection('facturation', mk('REDACTEUR_RAPPORTS')), true);
  assert.equal(canUserAccessSection('facturation', mk('CONDUCTEUR_TRAVAUX')), false);
});

test('écriture intervention : rapports = rapport seulement ; facturation = facturation seulement', () => {
  const allowed = writableInterventionFields(user('REDACTEUR_RAPPORTS'))!;
  for (const k of ['compteRendu', 'rapportFinal', 'statutRapport', 'photos']) assert.ok(allowed.has(k), k);
  for (const k of ['datePlanifiee', 'entreprise', 'technicien', 'statutOperationnel', 'heureDebut']) {
    assert.ok(!allowed.has(k), `rapports ne modifie pas ${k}`);
  }
  assert.ok(allowed.has('numeroFacture'), 'rapports a aussi la facturation par défaut');
  // Facturation seule (rapports sans le droit rapport)
  const billing = writableInterventionFields(
    user('REDACTEUR_RAPPORTS', {
      permissionsJson: JSON.stringify({ canWriteReports: false, canEditInterventions: false }),
    })
  )!;
  assert.deepEqual([...billing].sort(), ['amount', 'numeroFacture', 'statutFacture', 'tauxTVA']);
});

test('écriture intervention : le conducteur modifie la fiche mais jamais la facturation', () => {
  const allowed = writableInterventionFields(user('CONDUCTEUR_TRAVAUX'))!;
  for (const k of ['datePlanifiee', 'entreprise', 'chantier', 'compteRendu']) assert.ok(allowed.has(k), k);
  assert.ok(!allowed.has('numeroFacture'));
  assert.ok(!allowed.has('statutFacture'));
});

test('écriture intervention : le terrain ne modifie que l\'avancement de SES missions', () => {
  const allowed = writableInterventionFields(user('TECHNICIEN'))!;
  for (const k of ['statutOperationnel', 'heureDebutReelle', 'heureFinReelle', 'compteRendu', 'photos', 'gpsCloture']) {
    assert.ok(allowed.has(k), k);
  }
  for (const k of ['amount', 'numeroFacture', 'entreprise', 'datePlanifiee', 'devisId', 'rapportFinal', 'client']) {
    assert.ok(!allowed.has(k), `terrain ne modifie pas ${k}`);
  }
  const { clean, dropped } = limitToWritable({ amount: 99999, statutOperationnel: 'Clôturée' }, allowed);
  assert.deepEqual(clean, { statutOperationnel: 'Clôturée' });
  assert.deepEqual(dropped, ['amount']);
});

test('écriture intervention : le chargé d\'études ne planifie que les visites de chiffrage', () => {
  const a = user('CHIFFRAGE_DEVIS');
  assert.equal([...(writableInterventionFields(a, { isVisiteDevis: false })!)].length, 0);
  assert.ok(writableInterventionFields(a, { isVisiteDevis: true })!.has('datePlanifiee'));
  assert.ok(!writableInterventionFields(a, { isVisiteDevis: true })!.has('numeroFacture'));
  assert.equal(writableInterventionFields(user('ADMIN')), null);
});

test('lecture intervention : le chargé d\'études ne lit que celles rattachées à un devis', () => {
  const a = user('CHIFFRAGE_DEVIS');
  assert.equal(canReadIntervention(a, { devisId: 4 }), true);
  assert.equal(canReadIntervention(a, { isVisiteDevis: true }), true);
  assert.equal(canReadIntervention(a, { devisId: null, origineDevisId: null, isVisiteDevis: false }), false);
  assert.equal(canReadIntervention(user('CONDUCTEUR_TRAVAUX'), {}), true);
  // Technicien sans nom : rien du tout
  assert.equal(canReadIntervention(accessFor({ id: 9, role: 'TECHNICIEN', name: '', technicienNom: '' }), { entreprise: 'Karim' }), false);
});

const FULL = {
  id: 1, reference: 'INT-2026-001', client: 'ACME', chantier: '12 rue X', notes: 'Gardien 06 11 22 33 44',
  amount: 1500, montantHt: '1500.00', tauxTVA: 20, numeroFacture: 'F-1', statutFacture: 'Facturée',
  origine: 'Tel', numeroDI: 'DI-1', rapportFinal: 'Rapport', historique: [{ auteur: 'bureau' }],
  statutOperationnel: 'Planifiée', entreprise: 'Karim', gpsCloture: null, photos: [], computed: { x: 1 },
};

test('vue terrain : client, adresse, contact sur place — aucun montant, aucune facturation, aucun historique', () => {
  const v = fieldViewIntervention(FULL) as any;
  assert.equal(v.client, 'ACME');
  assert.equal(v.chantier, '12 rue X');
  assert.ok(v.notes.includes('06 11 22 33 44'));
  for (const k of ['amount', 'montantHt', 'tauxTVA', 'numeroFacture', 'statutFacture', 'origine', 'numeroDI', 'rapportFinal', 'historique']) {
    assert.ok(!(k in v), `le terrain ne reçoit pas ${k}`);
  }
});

test('forme par rôle : conducteur sans montants et sans facturation ; facturation voit la facture', () => {
  const noAmounts = accessFor({ id: 13, role: 'CONDUCTEUR_TRAVAUX', permissionsJson: JSON.stringify({ canViewFinancials: false }) });
  const s = shapeIntervention(noAmounts, FULL) as any;
  assert.equal(s.amount, 0);
  assert.equal(s.numeroFacture, null);
  const billing = shapeIntervention(user('REDACTEUR_RAPPORTS'), FULL) as any;
  assert.equal(billing.numeroFacture, 'F-1');
  assert.equal((shapeIntervention(user('ADMIN'), FULL) as any).amount, 1500);
});

test('devis : le terrain ne reçoit ni montant ni historique ; ne modifie que le relevé de visite', () => {
  const d = { id: 3, client: 'ACME', siteAdresse: '12 rue X', amount: 9000, montantHt: '9000.00', historique: [1], interventions: [1], notes: 'n', visiteTechnicien: 'Karim', computed: {} };
  const v = fieldViewDevis(d) as any;
  assert.equal(v.client, 'ACME');
  for (const k of ['amount', 'montantHt', 'historique', 'interventions', 'computed']) assert.ok(!(k in v), k);
  const t = user('TECHNICIEN');
  const r = limitDevisBody(t, { montantHt: 1, visiteStatut: 'Terminée', responsable: 'x' });
  assert.deepEqual(r.clean, { visiteStatut: 'Terminée' });
  assert.deepEqual(r.dropped.sort(), ['montantHt', 'responsable']);
  assert.equal((shapeDevis(user('ADMIN'), d) as any).amount, 9000);
});

test('devis : chiffrage sans droit Montants ne peut pas écrire de montant ; conversion seule = suivi du dossier', () => {
  const blind = accessFor({ id: 11, role: 'CHIFFRAGE_DEVIS', permissionsJson: JSON.stringify({ canViewFinancials: false }) });
  const r = limitDevisBody(blind, { montantHt: 5, objet: 'x' });
  assert.deepEqual(r.clean, { objet: 'x' });
  const conv = user('CONDUCTEUR_TRAVAUX');
  const c = limitDevisBody(conv, { client: 'Z', prochaineAction: 'Planifier' });
  assert.deepEqual(c.clean, { prochaineAction: 'Planifier' });
});

test('fiches clients : taux négocié masqué sans droit Montants ; terrain = contact et adresse seulement', () => {
  const fiche = { id: 'a', nom: 'ACME', adresse: '1 rue', contactNom: 'M. Durand', telephone: '01', tauxHoraireNegocie: 58, siret: '123', delaiPaiement: '30j', notesInternes: 'secret', services: [{}] };
  const field = shapeClientFiche(user('TECHNICIEN'), fiche);
  assert.deepEqual(Object.keys(field).sort(), ['adresse', 'contactNom', 'id', 'nom', 'telephone']);
  const blind = shapeClientFiche(accessFor({ id: 13, role: 'CONDUCTEUR_TRAVAUX', permissionsJson: JSON.stringify({ canViewFinancials: false }) }), fiche);
  assert.ok(!('tauxHoraireNegocie' in blind));
  assert.equal(shapeClientFiche(user('ADMIN'), fiche).tauxHoraireNegocie, 58);
});

import { limitInterventionBody } from '../server/lib/access.js';
import { canUserCloseIntervention, canUserCreateIntervention, isKnownRole, sanitizePermissionsForRole } from '../shared/types.js';

test('rapports : peut clôturer (valider son rapport) mais pas changer le statut autrement', () => {
  const r = user('REDACTEUR_RAPPORTS');
  const close = limitInterventionBody(r, { statutOperationnel: 'CLOTUREE', compteRendu: 'ok' });
  assert.equal(close.clean.statutOperationnel, 'CLOTUREE');
  assert.deepEqual(close.dropped, []);
  const other = limitInterventionBody(r, { statutOperationnel: 'Planifiée', datePlanifiee: '2026-12-01' });
  assert.deepEqual(other.clean, {});
  assert.deepEqual(other.dropped.sort(), ['datePlanifiee', 'statutOperationnel']);
  // Le terrain garde sa propre liste ; le chiffrage ne clôture pas
  assert.ok(!('statutOperationnel' in limitInterventionBody(user('CHIFFRAGE_DEVIS'), { statutOperationnel: 'CLOTUREE' }, { isVisiteDevis: false }).clean));
});

test('enregistrement des droits : plafond appliqué, rôle inconnu refusé', () => {
  const s = sanitizePermissionsForRole('TECHNICIEN', { canManageBilling: true, canAccessMobileTech: true });
  assert.equal(s.canManageBilling, false);
  assert.equal(s.canAccessMobileTech, true);
  assert.equal(isKnownRole('PIRATE'), false);
  assert.equal(isKnownRole('conducteur_travaux'), true);
});

test('écrans : création et clôture suivent les mêmes règles que le serveur', () => {
  const u = (role: string) => ({ id: 50, role, permissions: getEffectivePermissions(role, null) } as any);
  assert.equal(canUserCreateIntervention(u('CONDUCTEUR_TRAVAUX')), true);
  assert.equal(canUserCreateIntervention(u('CHIFFRAGE_DEVIS')), true);
  assert.equal(canUserCreateIntervention(u('REDACTEUR_RAPPORTS')), false);
  assert.equal(canUserCreateIntervention(u('TECHNICIEN')), false);
  assert.equal(canUserCloseIntervention(u('REDACTEUR_RAPPORTS')), true);
  assert.equal(canUserCloseIntervention(u('CHIFFRAGE_DEVIS')), false);
  assert.equal(canUserCloseIntervention(u('TECHNICIEN')), false);
});

import { describeRefusal, rolesAllowedToWrite } from '../server/lib/access.js';

test('message de refus : dit quelle partie et quels rôles peuvent la modifier', () => {
  const r = describeRefusal('intervention', ['datePlanifiee', 'numeroFacture']);
  assert.match(r.message, /Vous n'avez pas le droit de modifier le planning/);
  assert.match(r.message, /Peuvent la modifier : Direction ; Conducteur de travaux/);
  assert.match(r.message, /la facturation/);
  assert.match(r.message, /Rapports et facturation/);
  assert.equal(r.parts.length, 2);
  assert.ok(!r.message.includes('Technicien'), 'le terrain ne modifie ni planning ni facturation');
});

test('rôles autorisés : calculés avec les vraies règles (chiffrage = visites seulement, terrain = ses missions)', () => {
  const planning = rolesAllowedToWrite('intervention', 'datePlanifiee');
  assert.deepEqual(planning, [
    'Direction',
    'Conducteur de travaux',
    "Chargé d'études (chiffrage), pour les visites de chiffrage uniquement",
  ]);
  const report = rolesAllowedToWrite('intervention', 'compteRendu');
  assert.ok(report.includes('Technicien (sur ses propres missions)'));
  assert.ok(report.includes('Rapports et facturation'));
  assert.ok(!report.some((x) => x.startsWith("Chargé d'études")));
  assert.deepEqual(rolesAllowedToWrite('devis', 'montantHt'), ['Direction', "Chargé d'études (chiffrage)"]);
});
