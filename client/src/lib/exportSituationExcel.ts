import * as XLSX from 'xlsx';
import {
  Devis,
  Intervention,
  formatDateFR,
  computeDurationHours,
  computeDevisCalculations,
  computeInterventionCalculations,
  getTodayParisISO,
} from './api';

export type SituationReportMode = 'complete' | 'interventions' | 'devis';

export interface SituationExportOptions {
  startDate?: string | null; // Date début ISO YYYY-MM-DD
  endDate?: string | null;   // Date fin ISO YYYY-MM-DD
  client?: string | null;    // Donneur d'ordre filtré
  titre?: string;
}

export interface InterventionAvancementInfo {
  stepNumber: number;
  label: string;
  badge: string;
  category: 'PLANIFICATION' | 'EN_COURS' | 'VALIDE' | 'FACTURE' | 'BLOQUE';
}

export interface DevisAvancementInfo {
  stepNumber: number;
  label: string;
  badge: string;
  category: 'PREPARATION' | 'ENVOYE' | 'ACCEPTE' | 'REFUSE';
}

/**
 * Calcule l'étape actuelle d'avancement d'une intervention
 */
export function getInterventionAvancement(intv: Intervention): InterventionAvancementInfo {
  const statutOp = (intv.statutOperationnel || '').trim();
  const statutFact = (intv.statutFacture || '').trim();
  const statutRapport = (intv.statutRapport || '').trim();
  const isFacturee = statutFact === 'Facturée';

  if (statutOp === 'Annulée') {
    return { stepNumber: 0, label: 'Annulée', badge: '○ Annulée', category: 'BLOQUE' };
  }
  if (statutOp === 'Suspendue' || (intv.traitement && intv.traitement.toLowerCase().includes('bloqué'))) {
    const motif = intv.motifBlocage ? ` : ${intv.motifBlocage}` : '';
    return {
      stepNumber: 99,
      label: `Bloquée / Suspendue${motif}`,
      badge: '■ Bloquée',
      category: 'BLOQUE',
    };
  }
  if (isFacturee) {
    return {
      stepNumber: 7,
      label: '7. Facturée (Mission terminée & clôturée)',
      badge: '● 7. Facturée',
      category: 'FACTURE',
    };
  }
  if (statutOp === 'Clôturée') {
    return {
      stepNumber: 6,
      label: '6. Clôturée terrain — Prête pour facturation',
      badge: '◆ 6. Clôturée',
      category: 'VALIDE',
    };
  }
  if (statutOp === 'Terminée - à valider') {
    const detail = statutRapport === 'Transmis bureau' ? 'Rapport transmis' : 'Attente validation bureau';
    return {
      stepNumber: 5,
      label: `5. Terminée sur site — ${detail}`,
      badge: '◆ 5. Terminée',
      category: 'VALIDE',
    };
  }
  if (statutOp === 'Sur site' || statutOp === 'En cours') {
    return {
      stepNumber: 4,
      label: '4. Travaux en cours d’exécution sur site',
      badge: '▲ 4. En cours',
      category: 'EN_COURS',
    };
  }
  if (statutOp === 'En route') {
    return {
      stepNumber: 3,
      label: '3. En route vers le chantier',
      badge: '◈ 3. En route',
      category: 'EN_COURS',
    };
  }
  if (statutOp === 'Planifiée' || statutOp === 'Affectée' || Boolean(intv.datePlanifiee)) {
    const tech = intv.entreprise || 'Technicien assigné';
    const dateStr = intv.datePlanifiee ? ` (${formatDateFR(intv.datePlanifiee)})` : '';
    return {
      stepNumber: 2,
      label: `2. Planifiée${dateStr} — ${tech}`,
      badge: '◆ 2. Planifiée',
      category: 'PLANIFICATION',
    };
  }
  return {
    stepNumber: 1,
    label: '1. Demande reçue — À planifier',
    badge: '◷ 1. À planifier',
    category: 'PLANIFICATION',
  };
}

/**
 * Calcule l'étape actuelle d'avancement d'un devis
 */
export function getDevisAvancement(devis: Devis): DevisAvancementInfo {
  const statutComm = (devis.statutCommercial || '').trim();
  const isTerminalRefus = statutComm === 'Refusé' || statutComm === 'Annulé' || statutComm === 'Expiré';
  const isTraite = devis.status === 'traite';

  if (isTerminalRefus) {
    return {
      stepNumber: 0,
      label: `Sans suite / Refusé (${statutComm})`,
      badge: '○ Refusé/Sans suite',
      category: 'REFUSE',
    };
  }
  if (statutComm === 'Accepté' || statutComm === 'Validé client' || isTraite) {
    const hasIntv = (devis.interventionsCount || 0) > 0 || Boolean(devis.refInterventionTexte);
    const detail = hasIntv ? 'Intervention liée planifiée/en cours' : 'Prêt pour planification travaux';
    return {
      stepNumber: 5,
      label: `5. Devis Accepté / Signé — ${detail}`,
      badge: '● 5. Devis Accepté',
      category: 'ACCEPTE',
    };
  }
  if (statutComm === 'En négociation' || Boolean(devis.dateRelance)) {
    const relanceDate = devis.dateRelance ? ` (Relance: ${formatDateFR(devis.dateRelance)})` : '';
    return {
      stepNumber: 4,
      label: `4. En cours de relance / négociation${relanceDate}`,
      badge: '▲ 4. En relance',
      category: 'ENVOYE',
    };
  }
  if (statutComm === 'Envoyé au client' || Boolean(devis.dateEnvoi)) {
    const envoiDate = devis.dateEnvoi ? ` (${formatDateFR(devis.dateEnvoi)})` : '';
    return {
      stepNumber: 3,
      label: `3. Devis envoyé au client${envoiDate} — En attente accord`,
      badge: '◆ 3. Devis envoyé',
      category: 'ENVOYE',
    };
  }
  if (devis.visiteNecessaire) {
    const tech = devis.visiteTechnicien || 'À affecter';
    const statusV = devis.visiteStatut || 'À planifier';
    return {
      stepNumber: 2,
      label: `2. Visite technique préalable requise (${tech} — ${statusV})`,
      badge: '◆ 2. Visite technique',
      category: 'PREPARATION',
    };
  }
  return {
    stepNumber: 1,
    label: '1. Demande reçue — À préparer / chiffrer',
    badge: '◷ 1. À chiffrer',
    category: 'PREPARATION',
  };
}

/**
 * Calcule automatiquement la largeur optimale des colonnes
 */
function computeColumnWidths(data: (string | number | null | undefined)[][]): { wch: number }[] {
  const colCount = Math.max(...data.map((r) => r.length), 0);
  const widths: number[] = new Array(colCount).fill(10);

  for (const row of data) {
    row.forEach((cell, colIdx) => {
      if (cell !== null && cell !== undefined) {
        const str = String(cell);
        const len = str.length;
        if (len > widths[colIdx]) {
          widths[colIdx] = Math.min(len + 3, 65); // Plafonné à 65 caractères max
        }
      }
    });
  }

  return widths.map((w) => ({ wch: Math.max(w, 12) }));
}

/**
 * Crée la feuille de synthèse globale (Tableau de bord de direction)
 */
function createSyntheseSheet(
  interventions: Intervention[],
  devis: Devis[],
  options?: SituationExportOptions
): XLSX.WorkSheet {
  const todayParis = getTodayParisISO();
  const dateFormatted = formatDateFR(todayParis);
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const startDate = options?.startDate;
  const endDate = options?.endDate;
  const client = options?.client && options.client !== 'ALL' ? options.client : null;

  let periodeText = 'Historique complet (Toutes les dates)';
  if (startDate && endDate) {
    periodeText = `Du ${formatDateFR(startDate)} au ${formatDateFR(endDate)}`;
  } else if (startDate) {
    periodeText = `À partir du ${formatDateFR(startDate)}`;
  } else if (endDate) {
    periodeText = `Jusqu'au ${formatDateFR(endDate)}`;
  }

  const clientText = client ? ` | Donneur d'ordre : ${client}` : ' | Tous les donneurs d’ordre';
  const mainTitle = options?.titre || 'SITUATION COMPLÈTE & RAPPORT D\'AVANCEMENT DES TRAVAUX ET DEVIS';

  // Métriques Interventions
  const totalIntv = interventions.length;
  const facturées = interventions.filter((i) => i.statutFacture === 'Facturée');
  const clôturées = interventions.filter((i) => i.statutOperationnel === 'Clôturée');
  const terminées = interventions.filter((i) => i.statutOperationnel === 'Terminée - à valider');
  const enCours = interventions.filter((i) => ['En cours', 'Sur site', 'En route'].includes(i.statutOperationnel || ''));
  const planifiées = interventions.filter((i) => ['Planifiée', 'Affectée'].includes(i.statutOperationnel || ''));
  const aPlanifier = interventions.filter((i) => ['À planifier', 'Nouvelle demande'].includes(i.statutOperationnel || ''));
  const bloquées = interventions.filter((i) => i.statutOperationnel === 'Suspendue' || (i.traitement || '').includes('Bloqué'));

  const montantIntvRealiseesHT = interventions
    .filter((i) => ['Clôturée', 'Terminée - à valider'].includes(i.statutOperationnel || ''))
    .reduce((sum, i) => sum + (typeof i.amount === 'number' ? i.amount : 0), 0);

  const montantFactureHT = facturées
    .reduce((sum, i) => sum + (typeof i.amount === 'number' ? i.amount : 0), 0);

  // Métriques Devis
  const totalDevis = devis.length;
  const devisAcceptes = devis.filter((d) => ['Accepté', 'Validé client'].includes(d.statutCommercial || '') || d.status === 'traite');
  const devisEnvoyes = devis.filter((d) => d.statutCommercial === 'Envoyé au client');
  const devisRelance = devis.filter((d) => Boolean(d.dateRelance) || d.statutCommercial === 'En négociation');
  const devisAChiffrer = devis.filter((d) => ['À préparer', 'En préparation'].includes(d.statutCommercial || ''));
  const devisVisite = devis.filter((d) => Boolean(d.visiteNecessaire));

  const montantDevisEmisHT = devis
    .filter((d) => !['À préparer', 'En préparation'].includes(d.statutCommercial || ''))
    .reduce((sum, d) => sum + (typeof d.amount === 'number' ? d.amount : 0), 0);

  const montantDevisAcceptesHT = devisAcceptes
    .reduce((sum, d) => sum + (typeof d.amount === 'number' ? d.amount : 0), 0);

  const tauxConversionDevis = totalDevis > 0 ? Math.round((devisAcceptes.length / totalDevis) * 100) : 0;
  const tauxClotureIntv = totalIntv > 0 ? Math.round(((clôturées.length + facturées.length) / totalIntv) * 100) : 0;
  const tauxFacturation = montantIntvRealiseesHT > 0 ? Math.round((montantFactureHT / montantIntvRealiseesHT) * 100) : 0;

  const rows: (string | number | null | undefined)[][] = [
    [`GROUPE ANELEC — ${mainTitle}`],
    [`Période d'extraction : ${periodeText}${clientText}`],
    [`Généré le ${dateFormatted} à ${hours}:${minutes} (Fuseau Europe/Paris)`],
    [],
    ['=== 1. INDICATEURS CLÉS DE PILOTAGE GLOBAL ===', ''],
    ['Indicateur Stratégique', 'Valeur', 'Détails & Commentaires'],
    ['Total Dossiers Interventions', totalIntv, `${facturées.length} facturées, ${clôturées.length} clôturées, ${enCours.length} en cours`],
    ['Total Portefeuille Devis', totalDevis, `${devisAcceptes.length} acceptés, ${devisEnvoyes.length} envoyés en attente`],
    ['Montant Total Devis Émis HT', Number(montantDevisEmisHT.toFixed(2)), 'Valeur globale des propositions commerciales transmises'],
    ['Montant Devis Signés / Validés HT', Number(montantDevisAcceptesHT.toFixed(2)), 'Chiffre d’affaires sécurisé en commande'],
    ['Montant Travaux Réalisés HT', Number(montantIntvRealiseesHT.toFixed(2)), 'Interventions terminées et clôturées sur site'],
    ['Montant Facturé Client HT', Number(montantFactureHT.toFixed(2)), 'Facturation effective émise'],
    ['Taux de Transformation Devis', `${tauxConversionDevis} %`, `${devisAcceptes.length} acceptés sur ${totalDevis} devis totaux`],
    ['Taux de Clôture Opérationnelle', `${tauxClotureIntv} %`, 'Taux de réalisation des missions terrain'],
    ['Taux de Facturation des Travaux', `${tauxFacturation} %`, 'Part des travaux réalisés d’ores et déjà facturés'],
    [],
    ['=== 2. RÉCAPITULATIF DE L\'AVANCEMENT DES INTERVENTIONS ===', '', '', ''],
    ['Étape d’Avancement des Travaux', 'Nombre de Chantiers', 'Part (%)', 'Montant Estimé HT (€)'],
    [
      '1. Demande reçue — À planifier',
      aPlanifier.length,
      totalIntv > 0 ? `${Math.round((aPlanifier.length / totalIntv) * 100)} %` : '0 %',
      Number(aPlanifier.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)),
    ],
    [
      '2. Planifiée — En attente d’intervention',
      planifiées.length,
      totalIntv > 0 ? `${Math.round((planifiées.length / totalIntv) * 100)} %` : '0 %',
      Number(planifiées.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)),
    ],
    [
      '3. En cours sur site / En déplacement',
      enCours.length,
      totalIntv > 0 ? `${Math.round((enCours.length / totalIntv) * 100)} %` : '0 %',
      Number(enCours.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)),
    ],
    [
      '4. Terminée — Rapport à valider en bureau',
      terminées.length,
      totalIntv > 0 ? `${Math.round((terminées.length / totalIntv) * 100)} %` : '0 %',
      Number(terminées.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)),
    ],
    [
      '5. Clôturée — Prête pour facturation',
      clôturées.length,
      totalIntv > 0 ? `${Math.round((clôturées.length / totalIntv) * 100)} %` : '0 %',
      Number(clôturées.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)),
    ],
    [
      '6. Facturée (Dossier clos)',
      facturées.length,
      totalIntv > 0 ? `${Math.round((facturées.length / totalIntv) * 100)} %` : '0 %',
      Number(facturées.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)),
    ],
    [
      'Bloquée / Suspendue (Accès, pièces...)',
      bloquées.length,
      totalIntv > 0 ? `${Math.round((bloquées.length / totalIntv) * 100)} %` : '0 %',
      Number(bloquées.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)),
    ],
    [],
    ['=== 3. RÉCAPITULATIF DU PIPELINE COMMERCIAL DEVIS ===', '', '', ''],
    ['Étape du Devis', 'Nombre de Devis', 'Part (%)', 'Montant HT (€)'],
    [
      '1. Demande reçue — À préparer / chiffrer',
      devisAChiffrer.length,
      totalDevis > 0 ? `${Math.round((devisAChiffrer.length / totalDevis) * 100)} %` : '0 %',
      Number(devisAChiffrer.reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)),
    ],
    [
      '2. Visite technique préalable requise',
      devisVisite.length,
      totalDevis > 0 ? `${Math.round((devisVisite.length / totalDevis) * 100)} %` : '0 %',
      Number(devisVisite.reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)),
    ],
    [
      '3. Devis envoyé au client — En attente accord',
      devisEnvoyes.length,
      totalDevis > 0 ? `${Math.round((devisEnvoyes.length / totalDevis) * 100)} %` : '0 %',
      Number(devisEnvoyes.reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)),
    ],
    [
      '4. En cours de relance client / négociation',
      devisRelance.length,
      totalDevis > 0 ? `${Math.round((devisRelance.length / totalDevis) * 100)} %` : '0 %',
      Number(devisRelance.reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)),
    ],
    [
      '5. Devis Accepté / Signé — Travaux à planifier',
      devisAcceptes.length,
      totalDevis > 0 ? `${Math.round((devisAcceptes.length / totalDevis) * 100)} %` : '0 %',
      Number(devisAcceptes.reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)),
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = computeColumnWidths(rows);
  return ws;
}

/**
 * Crée la feuille de données détaillées des interventions
 */
function createInterventionsSheet(interventions: Intervention[]): XLSX.WorkSheet {
  const headers = [
    'Réf. Intervention',
    'Dossier (client · DI)',
    'N° de DI',
    'Étape Actuelle d\'Avancement',
    'Statut Opérationnel',
    'Statut Facturation',
    'Priorité',
    'Client / Donneur d\'ordre',
    'Site / Chantier / Adresse',
    'Corps d\'état TCE',
    'Technicien Intervenant',
    'Type d\'intervention',
    'Date Demande',
    'Date Planifiée',
    'Horaires Prévus',
    'Date Réelle Exécution',
    'Horaires Réels',
    'Durée Réalisée (h)',
    'Montant HT (€)',
    'N° Facture',
    'Statut Rapport Terrain',
    'Devis Rattaché',
    'Alerte Délai / Suivi',
    'Objet / Description des Travaux',
    'Compte Rendu / Résumé Réalisations',
    'Motif de Blocage (si applicable)',
  ];

  const rows: (string | number | null | undefined)[][] = [headers];

  for (const intv of interventions) {
    const avancement = getInterventionAvancement(intv);
    const computed = computeInterventionCalculations(intv);
    const horairesPrevis = intv.heureDebut && intv.heureFin ? `${intv.heureDebut} - ${intv.heureFin}` : intv.heureDebut || '';
    const horairesReels = intv.heureDebutReelle && intv.heureFinReelle ? `${intv.heureDebutReelle} - ${intv.heureFinReelle}` : intv.heureDebutReelle || '';
    const dureeH = computed.dureeHeures ?? computeDurationHours(intv.heureDebutReelle || intv.heureDebut, intv.heureFinReelle || intv.heureFin);

    rows.push([
      intv.reference || `INT-${intv.id}`,
      [intv.client, intv.numeroDI].filter(Boolean).join(' · ') || '',
      intv.numeroDI || '',
      avancement.label,
      intv.statutOperationnel || 'À planifier',
      intv.statutFacture || 'Non facturée',
      intv.priorite || 'Normale',
      intv.client || 'Client non renseigné',
      intv.chantier || '',
      intv.corpsEtat || 'Tous corps d’état',
      intv.entreprise || 'À affecter',
      intv.typeIntervention || 'Corrective',
      intv.dateDemande ? formatDateFR(intv.dateDemande) : '',
      intv.datePlanifiee ? formatDateFR(intv.datePlanifiee) : '',
      horairesPrevis,
      intv.dateReelle ? formatDateFR(intv.dateReelle) : '',
      horairesReels,
      dureeH !== null ? Number(dureeH.toFixed(2)) : '',
      typeof intv.amount === 'number' ? Number(intv.amount.toFixed(2)) : 0,
      intv.numeroFacture || '',
      intv.statutRapport || 'Non rédigé',
      intv.refDevisTexte || (intv.devisId ? `DEV-${intv.devisId}` : ''),
      computed.alerteDelai ? `${computed.alerteDelai} (${computed.alerteExplication})` : 'À suivre',
      intv.objet || '',
      intv.compteRendu || intv.rapportFinal || '',
      intv.motifBlocage || '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = computeColumnWidths(rows);
  ws['!autofilter'] = {
    ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${rows.length}`,
  };
  return ws;
}

/**
 * Crée la feuille de données détaillées des devis
 */
function createDevisSheet(devis: Devis[]): XLSX.WorkSheet {
  const headers = [
    'Réf. Devis',
    'Dossier (client · DI)',
    'N° de DI',
    'Étape Actuelle d\'Avancement',
    'Statut Commercial',
    'Traitement Administratif',
    'Priorité',
    'Client / Donneur d\'ordre',
    'Site / Immeuble / Adresse',
    'Corps d\'état TCE',
    'Responsable Interne',
    'Date Demande',
    'Date Envoi Client',
    'Date Limite Validité',
    'Date Prochaine Relance',
    'Prochaine Action Attendue',
    'Montant HT (€)',
    'Montant TTC Estimé (€)',
    'Visite Préalable Requise',
    'Technicien Visite',
    'Date Visite',
    'Statut Visite',
    'Intervention Liée',
    'Alerte Délai',
    'Objet / Descriptif des Travaux',
    'Commentaires & Notes Internes',
  ];

  const rows: (string | number | null | undefined)[][] = [headers];

  for (const d of devis) {
    const avancement = getDevisAvancement(d);
    const computed = computeDevisCalculations(d);
    const mntHT = typeof d.amount === 'number' ? d.amount : 0;
    const mntTTC = Number((mntHT * 1.2).toFixed(2));

    rows.push([
      d.reference || `DEV-${d.id}`,
      [d.client, d.numeroDI].filter(Boolean).join(' · ') || '',
      d.numeroDI || '',
      avancement.label,
      d.statutCommercial || 'À préparer',
      d.traitement || 'À traiter',
      d.priorite || 'Normale',
      d.client || 'Client non renseigné',
      d.site || '',
      d.corpsEtat || 'Tous corps d’état',
      d.responsable || 'Non assigné',
      d.dateCreated ? formatDateFR(d.dateCreated) : '',
      d.dateEnvoi ? formatDateFR(d.dateEnvoi) : '',
      computed.dateExpiration ? formatDateFR(computed.dateExpiration) : d.echeance ? formatDateFR(d.echeance) : '',
      d.dateRelance ? formatDateFR(d.dateRelance) : '',
      d.prochaineAction || '',
      Number(mntHT.toFixed(2)),
      mntTTC,
      d.visiteNecessaire ? 'OUI' : 'NON',
      d.visiteTechnicien || '',
      d.visiteDate ? formatDateFR(d.visiteDate) : '',
      d.visiteStatut || '',
      d.refInterventionTexte || '',
      computed.alerte ? `${computed.alerte} (${computed.alerteExplication})` : 'À suivre',
      d.objet || '',
      d.notes || '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = computeColumnWidths(rows);
  ws['!autofilter'] = {
    ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${rows.length}`,
  };
  return ws;
}

/**
 * 1. EXPORT DE SITUATION COMPLÈTE (INTERVENTIONS + DEVIS DANS LE MÊME FICHIER)
 */
export function exportSituationCompleteExcel(
  interventions: Intervention[],
  devis: Devis[],
  optionsOrFilename?: SituationExportOptions | string,
  maybeFilename?: string
): void {
  const options: SituationExportOptions =
    typeof optionsOrFilename === 'object' && optionsOrFilename !== null
      ? optionsOrFilename
      : {};
  const dateStr = getTodayParisISO();
  const dateSuffix = options.startDate && options.endDate
    ? `_du_${options.startDate}_au_${options.endDate}`
    : options.startDate
    ? `_a_partir_du_${options.startDate}`
    : options.endDate
    ? `_jusqu_au_${options.endDate}`
    : `_${dateStr}`;
  const clientSuffix = options.client && options.client !== 'ALL'
    ? `_${options.client.replace(/[^a-zA-Z0-9]/g, '_')}`
    : '';

  const defaultFilename = `Situation_Complete_Travaux_Devis_ANELEC${dateSuffix}${clientSuffix}.xlsx`;
  const filename = typeof optionsOrFilename === 'string'
    ? optionsOrFilename
    : maybeFilename || defaultFilename;

  const wb = XLSX.utils.book_new();

  // 1. Feuille Synthèse & Avancement
  const wsSynthese = createSyntheseSheet(interventions, devis, {
    ...options,
    titre: 'SITUATION COMPLÈTE & RAPPORT D\'AVANCEMENT DES TRAVAUX ET DEVIS',
  });
  XLSX.utils.book_append_sheet(wb, wsSynthese, '1. Synthèse Globale');

  // 2. Feuille Détail Interventions
  const wsIntv = createInterventionsSheet(interventions);
  XLSX.utils.book_append_sheet(wb, wsIntv, '2. Avancement Interventions');

  // 3. Feuille Détail Devis
  const wsDevis = createDevisSheet(devis);
  XLSX.utils.book_append_sheet(wb, wsDevis, '3. Avancement Devis');

  XLSX.writeFile(wb, filename);
}

/**
 * 2. EXPORT DE SITUATION INTERVENTIONS SEULES
 */
export function exportSituationInterventionsExcel(
  interventions: Intervention[],
  optionsOrFilename?: SituationExportOptions | string,
  maybeFilename?: string
): void {
  const options: SituationExportOptions =
    typeof optionsOrFilename === 'object' && optionsOrFilename !== null
      ? optionsOrFilename
      : {};
  const dateStr = getTodayParisISO();
  const dateSuffix = options.startDate && options.endDate
    ? `_du_${options.startDate}_au_${options.endDate}`
    : options.startDate
    ? `_a_partir_du_${options.startDate}`
    : options.endDate
    ? `_jusqu_au_${options.endDate}`
    : `_${dateStr}`;
  const clientSuffix = options.client && options.client !== 'ALL'
    ? `_${options.client.replace(/[^a-zA-Z0-9]/g, '_')}`
    : '';

  const defaultFilename = `Situation_Avancement_Interventions_ANELEC${dateSuffix}${clientSuffix}.xlsx`;
  const filename = typeof optionsOrFilename === 'string'
    ? optionsOrFilename
    : maybeFilename || defaultFilename;

  const wb = XLSX.utils.book_new();

  // 1. Synthèse Interventions
  const wsSynthese = createSyntheseSheet(interventions, [], {
    ...options,
    titre: 'SITUATION & AVANCEMENT OPÉRATIONNEL DES INTERVENTIONS TCE',
  });
  XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthèse Chantiers');

  // 2. Détail Interventions
  const wsIntv = createInterventionsSheet(interventions);
  XLSX.utils.book_append_sheet(wb, wsIntv, 'Avancement Interventions');

  XLSX.writeFile(wb, filename);
}

/**
 * 3. EXPORT DE SITUATION DEVIS SEULS
 */
export function exportSituationDevisExcel(
  devis: Devis[],
  optionsOrFilename?: SituationExportOptions | string,
  maybeFilename?: string
): void {
  const options: SituationExportOptions =
    typeof optionsOrFilename === 'object' && optionsOrFilename !== null
      ? optionsOrFilename
      : {};
  const dateStr = getTodayParisISO();
  const dateSuffix = options.startDate && options.endDate
    ? `_du_${options.startDate}_au_${options.endDate}`
    : options.startDate
    ? `_a_partir_du_${options.startDate}`
    : options.endDate
    ? `_jusqu_au_${options.endDate}`
    : `_${dateStr}`;
  const clientSuffix = options.client && options.client !== 'ALL'
    ? `_${options.client.replace(/[^a-zA-Z0-9]/g, '_')}`
    : '';

  const defaultFilename = `Situation_Avancement_Devis_ANELEC${dateSuffix}${clientSuffix}.xlsx`;
  const filename = typeof optionsOrFilename === 'string'
    ? optionsOrFilename
    : maybeFilename || defaultFilename;

  const wb = XLSX.utils.book_new();

  // 1. Synthèse Devis
  const wsSynthese = createSyntheseSheet([], devis, {
    ...options,
    titre: 'SITUATION & AVANCEMENT DU PORTEFEUILLE DEVIS ET CHIFFRAGES',
  });
  XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthèse Devis');

  // 2. Détail Devis
  const wsDevis = createDevisSheet(devis);
  XLSX.utils.book_append_sheet(wb, wsDevis, 'Avancement Devis');

  XLSX.writeFile(wb, filename);
}
