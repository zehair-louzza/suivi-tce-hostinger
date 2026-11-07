import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getInterventionAvancement,
  getDevisAvancement,
  exportSituationCompleteExcel,
  exportSituationInterventionsExcel,
  exportSituationDevisExcel,
} from '../client/src/lib/exportSituationExcel';
import type { Devis, Intervention } from '../client/src/lib/api';
import * as XLSX from 'xlsx';

console.log('--- Test exportSituationExcel ---');

// 1. Test getInterventionAvancement
const intvBilled: Partial<Intervention> = {
  id: 1,
  statutOperationnel: 'Clôturée',
  statutFacture: 'Facturée',
};
const stepBilled = getInterventionAvancement(intvBilled as Intervention);
assert.equal(stepBilled.stepNumber, 7);
assert.equal(stepBilled.category, 'FACTURE');

const intvClosed: Partial<Intervention> = {
  id: 2,
  statutOperationnel: 'Clôturée',
  statutFacture: 'Non facturée',
};
const stepClosed = getInterventionAvancement(intvClosed as Intervention);
assert.equal(stepClosed.stepNumber, 6);
assert.equal(stepClosed.category, 'VALIDE');

const intvFinished: Partial<Intervention> = {
  id: 3,
  statutOperationnel: 'Terminée - à valider',
  statutRapport: 'Transmis bureau',
};
const stepFinished = getInterventionAvancement(intvFinished as Intervention);
assert.equal(stepFinished.stepNumber, 5);
assert.equal(stepFinished.category, 'VALIDE');

const intvBlocked: Partial<Intervention> = {
  id: 4,
  statutOperationnel: 'Suspendue',
  motifBlocage: 'Attente accord client',
};
const stepBlocked = getInterventionAvancement(intvBlocked as Intervention);
assert.equal(stepBlocked.stepNumber, 99);
assert.equal(stepBlocked.category, 'BLOQUE');

// 2. Test getDevisAvancement
const devisAccepted: Partial<Devis> = {
  id: 10,
  statutCommercial: 'Accepté',
  amount: 2500,
};
const stepDevisAcc = getDevisAvancement(devisAccepted as Devis);
assert.equal(stepDevisAcc.stepNumber, 5);
assert.equal(stepDevisAcc.category, 'ACCEPTE');

const devisSent: Partial<Devis> = {
  id: 11,
  statutCommercial: 'Envoyé au client',
  dateEnvoi: '2026-11-05',
};
const stepDevisSent = getDevisAvancement(devisSent as Devis);
assert.equal(stepDevisSent.stepNumber, 3);
assert.equal(stepDevisSent.category, 'ENVOYE');

const devisVisit: Partial<Devis> = {
  id: 12,
  statutCommercial: 'À préparer',
  visiteNecessaire: true,
  visiteTechnicien: 'Anouar',
};
const stepDevisVisit = getDevisAvancement(devisVisit as Devis);
assert.equal(stepDevisVisit.stepNumber, 2);
assert.equal(stepDevisVisit.category, 'PREPARATION');

// 3. Test Excel generation with real file creation & inspection
const sampleIntvs: Partial<Intervention>[] = [
  {
    id: 101,
    reference: 'INT-101',
    client: 'Presta maintenance',
    chantier: 'Site A',
    amount: 450,
    statutOperationnel: 'Clôturée',
    statutFacture: 'Facturée',
    datePlanifiee: '2026-11-04',
    dateReelle: '2026-11-04',
    entreprise: 'Anouar',
  },
  {
    id: 102,
    reference: 'INT-102',
    client: 'C-Multi-Serv',
    chantier: 'Site B',
    amount: 800,
    statutOperationnel: 'En cours',
    statutFacture: 'Non facturée',
    datePlanifiee: '2026-11-06',
    entreprise: 'Mohamed',
  },
];

const sampleDevisList: Partial<Devis>[] = [
  {
    id: 201,
    reference: 'DEV-201',
    client: 'Presta maintenance',
    site: 'Immeuble C',
    amount: 1500,
    statutCommercial: 'Accepté',
    dateCreated: '2026-11-01',
    dateEnvoi: '2026-11-02',
    responsable: 'Anouar',
  },
  {
    id: 202,
    reference: 'DEV-202',
    client: 'GMS',
    site: 'Tour D',
    amount: 3200,
    statutCommercial: 'Envoyé au client',
    dateCreated: '2026-11-03',
    dateEnvoi: '2026-11-04',
    responsable: 'Najoua',
  },
];

const testCompletePath = path.join(process.cwd(), 'test_situation_complete.xlsx');
const testIntvPath = path.join(process.cwd(), 'test_situation_intv.xlsx');
const testDevisPath = path.join(process.cwd(), 'test_situation_devis.xlsx');

const xlsx = (XLSX as any).default || XLSX;

try {
  // Test Export Complet avec options de dates (Jour / Mois / Année)
  exportSituationCompleteExcel(sampleIntvs as Intervention[], sampleDevisList as Devis[], {
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    client: 'Presta maintenance',
  }, testCompletePath);
  assert(fs.existsSync(testCompletePath), 'Fichier test_situation_complete.xlsx créé');
  const wbComplete = xlsx.readFile(testCompletePath);
  assert.deepEqual(wbComplete.SheetNames, ['1. Synthèse Globale', '2. Avancement Interventions', '3. Avancement Devis']);
  const syntheseSheet = wbComplete.Sheets['1. Synthèse Globale'];
  const syntheseText = JSON.stringify(syntheseSheet);
  assert(syntheseText.includes('Du 01/11/2026 au 07/11/2026'), 'La période doit être inscrite au format JJ/MM/AAAA');
  assert(syntheseText.includes('Presta maintenance'), 'Le client doit être inscrit dans la synthèse');

  // Test Export Interventions avec dates
  exportSituationInterventionsExcel(sampleIntvs as Intervention[], {
    startDate: '2026-11-04',
    endDate: '2026-11-06',
  }, testIntvPath);
  assert(fs.existsSync(testIntvPath), 'Fichier test_situation_intv.xlsx créé');
  const wbIntv = xlsx.readFile(testIntvPath);
  assert.deepEqual(wbIntv.SheetNames, ['Synthèse Chantiers', 'Avancement Interventions']);

  // Test Export Devis avec dates
  exportSituationDevisExcel(sampleDevisList as Devis[], {
    startDate: '2026-11-01',
    endDate: '2026-11-30',
  }, testDevisPath);
  assert(fs.existsSync(testDevisPath), 'Fichier test_situation_devis.xlsx créé');
  const wbDevis = xlsx.readFile(testDevisPath);
  assert.deepEqual(wbDevis.SheetNames, ['Synthèse Devis', 'Avancement Devis']);

  console.log('✓ Tous les tests exportSituationExcel sont passés avec succès');
} finally {
  if (fs.existsSync(testCompletePath)) fs.unlinkSync(testCompletePath);
  if (fs.existsSync(testIntvPath)) fs.unlinkSync(testIntvPath);
  if (fs.existsSync(testDevisPath)) fs.unlinkSync(testDevisPath);
}
