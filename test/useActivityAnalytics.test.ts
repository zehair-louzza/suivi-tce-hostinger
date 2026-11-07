import assert from 'node:assert/strict';
import { computeActivityDays, extractCivilDate, extractAcceptanceDate } from '../client/src/activity/useActivityAnalytics';
import type { Devis, Intervention } from '../client/src/lib/api';

console.log('--- Test useActivityAnalytics ---');

// 1. Test extractCivilDate
assert.equal(extractCivilDate('2026-11-04T14:25:00.000Z'), '2026-11-04');
assert.equal(extractCivilDate('2026-11-05'), '2026-11-05');
assert.equal(extractCivilDate(null), null);

// 2. Test extractAcceptanceDate
const devisWithHistory: Partial<Devis> = {
  id: 1,
  client: 'Test Client',
  statutCommercial: 'Accepté',
  historique: [
    { id: '1', date: '2026-11-03T10:00:00Z', auteur: 'Client', action: 'Devis Accepté par le client' }
  ]
};
const accRes = extractAcceptanceDate(devisWithHistory as Devis);
assert.notEqual(accRes, null);
assert.equal(accRes?.date, '2026-11-03');
assert.equal(accRes?.isRealDate, true);

// 3. Test comptable : CA facturé strictly adossé aux factures
const sampleInterventions: Partial<Intervention>[] = [
  {
    id: 101,
    client: 'Client A',
    chantier: 'Chantier 1',
    amount: 150.50, // 15050 cents
    datePlanifiee: '2026-11-02',
    dateReelle: '2026-11-02',
    statutOperationnel: 'Clôturée',
    statutFacture: 'Facturée', // Billed
  },
  {
    id: 102,
    client: 'Client B',
    chantier: 'Chantier 2',
    amount: 300.00, // 30000 cents
    datePlanifiee: '2026-11-03',
    dateReelle: '2026-11-03',
    statutOperationnel: 'Terminée - à valider',
    statutFacture: 'Non facturée', // Not billed
  },
  {
    id: 103,
    client: 'Client C',
    chantier: 'Chantier 3',
    amount: 500.00,
    datePlanifiee: '2026-11-03',
    statutOperationnel: 'Annulée', // Cancelled -> must be excluded!
    statutFacture: 'Facturée',
  },
];

const sampleDevis: Partial<Devis>[] = [
  {
    id: 201,
    client: 'Client A',
    amount: 450.00, // 45000 cents
    dateCreated: '2026-11-02T08:00:00Z',
    dateEnvoi: '2026-11-02',
    statutCommercial: 'Envoyé au client',
  },
  {
    id: 202,
    client: 'Client B',
    amount: 800.00, // 80000 cents
    dateCreated: '2026-11-03T09:00:00Z',
    dateEnvoi: '2026-11-03',
    statutCommercial: 'Accepté',
    historique: [
      { id: 'h1', date: '2026-11-03T15:00:00Z', auteur: 'Client B', action: 'Accepté' }
    ],
  },
  {
    id: 203,
    client: 'Client D',
    amount: 1200.00,
    dateCreated: '2026-11-03T10:00:00Z',
    statutCommercial: 'À préparer', // Draft -> excluded from issued quotes!
  }
];

const { days, issues } = computeActivityDays(
  sampleInterventions as Intervention[],
  sampleDevis as Devis[]
);

assert(days.length >= 2, 'Doit comporter au moins 2 jours');

// Jour 2026-11-02
const day1 = days.find((d) => d.date === '2026-11-02');
assert.notEqual(day1, undefined);
assert.equal(day1?.invoiced, 15050, 'CA facturé doit être de 150.50 € (15050 cents)');
assert.equal(day1?.performed, 15050, 'Intervention effectuée doit être de 150.50 € (15050 cents)');
assert.equal(day1?.interventions, 1, '1 intervention effectuée');
assert.equal(day1?.quoted, 45000, 'Devis émis 450 € (45000 cents)');
assert.equal(day1?.quotes, 1, '1 devis émis');
assert.equal(day1?.accepted, 0, 'Aucun devis accepté le 02');

// Jour 2026-11-03
const day2 = days.find((d) => d.date === '2026-11-03');
assert.notEqual(day2, undefined);
assert.equal(day2?.invoiced, 0, 'Aucune facture émise (intv 102 non facturée, 103 annulée)');
assert.equal(day2?.performed, 30000, 'Intervention 102 effectuée 300 € (30000 cents)');
assert.equal(day2?.interventions, 1, '1 intervention réalisée');
assert.equal(day2?.quoted, 80000, 'Devis émis 800 € (80000 cents), le brouillon 203 est exclu');
assert.equal(day2?.quotes, 1, '1 devis émis');
assert.equal(day2?.accepted, 80000, 'Devis 202 accepté 800 € (80000 cents)');

// Vérification de la déduplication multi-techniciens
const multiTechInterventions = [
  ...sampleInterventions,
  sampleInterventions[0], // Duplicate of intv 101
];
const resultDedup = computeActivityDays(
  multiTechInterventions as Intervention[],
  sampleDevis as Devis[]
);
const day1Dedup = resultDedup.days.find((d) => d.date === '2026-11-02');
assert.equal(day1Dedup?.interventions, 1, 'L intervention en doublon ne doit être comptée qu 1 seule fois');
assert.equal(day1Dedup?.performed, 15050, 'Le montant ne doit pas être dupliqué');

console.log('✓ Tous les tests computeActivityDays sont passés avec succès');
