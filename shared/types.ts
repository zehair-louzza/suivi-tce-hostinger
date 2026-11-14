// Shared types, ANELEC business lists, formulas, and validation schemas
import { z } from 'zod';

// ============================================================================
// 1. RÉFÉRENTIELS MÉTIER ANELEC (issus de analyse-45-colonnes-ANELEC.csv)
// ============================================================================

export const DEFAULT_CLIENTS = [
  'Presta maintenance',
  'Presta la rochelle',
  'C-Multi-Serv',
  'GMS',
  'EMALEC',
  'IPC',
  'Crea-maintenance',
  'Particulier',
] as const;

export type ClientProfileType = 'DONNEUR_ORDRE' | 'ENTREPRISE' | 'PARTICULIER' | 'SOUS_TRAITANT';

/**
 * Service / Département interne d'un client ou donneur d'ordre avec email dédié
 */
export interface ClientServiceContact {
  id: string;
  nomService: string; // ex: "Service Travaux & Technique", "Comptabilité & Facturation", "Gestionnaire / Exploitation", etc.
  email: string; // ex: "travaux@client.fr"
  contactNom?: string; // ex: "M. Thomas Leroy"
  contactRole?: string; // ex: "Responsable Technique"
  telephone?: string; // ex: "01 42 68 55 10"
  recevoirRapports?: boolean; // Reçoit les rapports d'intervention par défaut
  recevoirFactures?: boolean; // Reçoit les factures
  recevoirDevis?: boolean; // Reçoit les devis
}

export interface ClientProfile {
  id: string;
  nom: string;
  type: ClientProfileType;
  email: string;
  telephone?: string;
  contactNom?: string;
  contactRole?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  siret?: string;
  delaiPaiement?: string;
  tauxHoraireNegocie?: number;
  consignesParticulieres?: string;
  notesInternes?: string;
  services?: ClientServiceContact[]; // Multiples services et adresses email de l'entreprise
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_CLIENT_PROFILES: ClientProfile[] = [
  {
    id: 'presta-maintenance',
    nom: 'Presta maintenance',
    type: 'DONNEUR_ORDRE',
    email: 'travaux@prestamaintenance.fr',
    telephone: '01 42 68 55 00',
    contactNom: 'Service Travaux & Maintenance Bâtiment',
    contactRole: 'Responsable Opérations',
    adresse: '15 Rue de Berri',
    codePostal: '75008',
    ville: 'Paris',
    siret: '812 345 678 00012',
    delaiPaiement: '45 jours fin de mois',
    tauxHoraireNegocie: 58,
    consignesParticulieres: 'Validation contradictoire obligatoire sur site. Rapport complet avec photos Avant/Après à transmettre sous 48h maximum.',
    services: [
      {
        id: 'srv-pm-travaux',
        nomService: 'Service Travaux & Maintenance',
        email: 'travaux@prestamaintenance.fr',
        contactNom: 'M. Thomas Leroy',
        contactRole: 'Conducteur d’Opérations',
        telephone: '01 42 68 55 01',
        recevoirRapports: true,
        recevoirDevis: true,
      },
      {
        id: 'srv-pm-compta',
        nomService: 'Comptabilité & Facturation',
        email: 'facturation@prestamaintenance.fr',
        contactNom: 'Mme Claire Valette',
        contactRole: 'Responsable Comptable Fournisseurs',
        telephone: '01 42 68 55 05',
        recevoirFactures: true,
        recevoirRapports: false,
      },
      {
        id: 'srv-pm-direction',
        nomService: 'Direction Technique & Exploitation',
        email: 'direction@prestamaintenance.fr',
        contactNom: 'M. Marc Delorme',
        contactRole: 'Directeur Général Adjoint',
        telephone: '01 42 68 55 00',
        recevoirRapports: true,
      },
    ],
    active: true,
  },
  {
    id: 'presta-la-rochelle',
    nom: 'Presta la rochelle',
    type: 'DONNEUR_ORDRE',
    email: 'agence.larochelle@presta.fr',
    telephone: '05 46 00 12 34',
    contactNom: 'Agence Technique 17',
    contactRole: "Conducteur d'opérations régionales",
    adresse: '4 Quai Duperré',
    codePostal: '17000',
    ville: 'La Rochelle',
    siret: '812 345 678 00045',
    delaiPaiement: '30 jours fin de mois',
    tauxHoraireNegocie: 60,
    consignesParticulieres: "Mentionner impérativement les heures réelles d'arrivée et départ du technicien sur le bon d'attachement.",
    services: [
      {
        id: 'srv-plr-tech',
        nomService: 'Pôle Technique Régional',
        email: 'agence.larochelle@presta.fr',
        contactNom: 'Mme Sophie Martin',
        contactRole: 'Conductrice Travaux Charente-Maritime',
        telephone: '05 46 00 12 35',
        recevoirRapports: true,
        recevoirDevis: true,
      },
      {
        id: 'srv-plr-compta',
        nomService: 'Comptabilité Régionale',
        email: 'compta.larochelle@presta.fr',
        contactNom: 'Pôle Factures Agences',
        recevoirFactures: true,
      },
    ],
    active: true,
  },
  {
    id: 'c-multi-serv',
    nom: 'C-Multi-Serv',
    type: 'DONNEUR_ORDRE',
    email: 'dispatch@c-multiserv.com',
    telephone: '01 84 19 22 10',
    contactNom: "Cellule Conduite d'Activité Multi-Sites",
    contactRole: 'Superviseur National',
    adresse: '28 Boulevard Haussmann',
    codePostal: '75009',
    ville: 'Paris',
    siret: '794 567 890 00023',
    delaiPaiement: '30 jours',
    tauxHoraireNegocie: 55,
    consignesParticulieres: 'Photos Avant et Après obligatoires sur chaque tâche réalisée. Rapport par email à adresser à dispatch@c-multiserv.com.',
    services: [
      {
        id: 'srv-cms-dispatch',
        nomService: "Cellule Dispatch & Rapports d'Activité",
        email: 'dispatch@c-multiserv.com',
        contactNom: 'Centre de Gestion National',
        telephone: '01 84 19 22 11',
        recevoirRapports: true,
        recevoirDevis: true,
      },
      {
        id: 'srv-cms-facturation',
        nomService: 'Facturation & Règlements Fournisseurs',
        email: 'facturation@c-multiserv.com',
        telephone: '01 84 19 22 15',
        recevoirFactures: true,
      },
    ],
    active: true,
  },
  {
    id: 'gms',
    nom: 'GMS',
    type: 'DONNEUR_ORDRE',
    email: 'interventions@gms-services.fr',
    telephone: '01 53 10 40 70',
    contactNom: 'Pôle Grands Comptes Tertiaires',
    contactRole: "Chargé d'Affaires BTP",
    adresse: '12 Rue Vivienne',
    codePostal: '75002',
    ville: 'Paris',
    siret: '488 912 345 00056',
    delaiPaiement: '45 jours fin de mois',
    tauxHoraireNegocie: 62,
    consignesParticulieres: 'Rapport technique avec détail des pièces et fournitures posées.',
    services: [
      {
        id: 'srv-gms-travaux',
        nomService: 'Pôle Suivi de Travaux & Rapports',
        email: 'interventions@gms-services.fr',
        contactNom: 'M. Antoine Garnier',
        telephone: '01 53 10 40 71',
        recevoirRapports: true,
        recevoirDevis: true,
      },
      {
        id: 'srv-gms-compta',
        nomService: 'Service Comptabilité Clients/Fournisseurs',
        email: 'compta@gms-services.fr',
        telephone: '01 53 10 40 75',
        recevoirFactures: true,
      },
    ],
    active: true,
  },
  {
    id: 'emalec',
    nom: 'EMALEC',
    type: 'DONNEUR_ORDRE',
    email: 'operations@emalec.com',
    telephone: '04 72 26 80 00',
    contactNom: 'Service Exploitation & Maintenance Multitechnique',
    contactRole: 'Chef de Projet Facility Management',
    adresse: "Parc d'Activités des Ronzières",
    codePostal: '69340',
    ville: 'Francheville',
    siret: '423 789 012 00034',
    delaiPaiement: '45 jours',
    tauxHoraireNegocie: 59,
    consignesParticulieres: "Envoi systématique du compte rendu technique dès signature du bon d'intervention.",
    services: [
      {
        id: 'srv-ema-ops',
        nomService: 'Service Exploitation & Conduite d’Activité',
        email: 'operations@emalec.com',
        contactNom: 'M. Nicolas Perrin',
        telephone: '04 72 26 80 02',
        recevoirRapports: true,
        recevoirDevis: true,
      },
      {
        id: 'srv-ema-factures',
        nomService: 'Pôle Facturation & Dépenses Sous-Traitance',
        email: 'factures@emalec.com',
        recevoirFactures: true,
      },
    ],
    active: true,
  },
  {
    id: 'ipc',
    nom: 'IPC',
    type: 'DONNEUR_ORDRE',
    email: 'technique@ipc-groupe.fr',
    telephone: '01 40 12 34 56',
    contactNom: 'Direction Technique & Travaux',
    contactRole: 'Directeur Travaux',
    adresse: '8 Rue de la Victoire',
    codePostal: '75009',
    ville: 'Paris',
    siret: '512 345 678 00099',
    delaiPaiement: '30 jours',
    tauxHoraireNegocie: 65,
    consignesParticulieres: 'Devis complémentaire requis si dépassement de la commande initiale.',
    services: [
      {
        id: 'srv-ipc-tech',
        nomService: 'Direction Technique & Rapports de Chantier',
        email: 'technique@ipc-groupe.fr',
        contactNom: 'M. Laurent Mercier',
        telephone: '01 40 12 34 57',
        recevoirRapports: true,
        recevoirDevis: true,
      },
      {
        id: 'srv-ipc-be',
        nomService: "Bureau d'Études & Devis",
        email: 'devis@ipc-groupe.fr',
        recevoirDevis: true,
      },
      {
        id: 'srv-ipc-compta',
        nomService: 'Comptabilité Fournisseurs',
        email: 'compta@ipc-groupe.fr',
        recevoirFactures: true,
      },
    ],
    active: true,
  },
  {
    id: 'crea-maintenance',
    nom: 'Crea-maintenance',
    type: 'DONNEUR_ORDRE',
    email: 'contact@crea-maintenance.fr',
    telephone: '01 48 00 90 90',
    contactNom: 'Service Dispatch & Dépannages Urgents',
    contactRole: 'Coordinateur Logistique',
    adresse: '55 Avenue des Champs-Élysées',
    codePostal: '75008',
    ville: 'Paris',
    siret: '610 987 654 00018',
    delaiPaiement: '30 jours',
    tauxHoraireNegocie: 58,
    consignesParticulieres: "Transmettre le rapport d'urgence le jour même par email.",
    active: true,
  },
  {
    id: 'particulier',
    nom: 'Particulier',
    type: 'PARTICULIER',
    email: '',
    telephone: '',
    contactNom: 'Clients Particuliers & Copropriétés B2C',
    contactRole: 'Propriétaire / Locataire',
    adresse: '',
    codePostal: '75000',
    ville: 'Île-de-France',
    delaiPaiement: 'Paiement immédiat à réception',
    tauxHoraireNegocie: 65,
    consignesParticulieres: 'Devis systématiquement signé avant démarrage des travaux. Facture avec attestation TVA le cas échéant.',
    active: true,
  },
];

export interface SendReportEmailPayload {
  toEmail: string;
  ccEmail?: string;
  subject?: string;
  customMessage?: string;
  rapportFinal?: string;
  includePhotos?: boolean;
}

export const DEFAULT_CORPS_ETAT = [
  'Tous corps d’état',
  'Plomberie',
  'Électricité',
  'CVC / Climatisation',
  'Chauffage',
  'Serrurerie',
  'Menuiserie',
  'Peinture',
  'Plâtrerie',
  'Faux plafond',
  'Revêtement de sol',
  'Maçonnerie',
] as const;

export const DEFAULT_ORIGINES = [
  "Donneur d'ordre",
  'Client',
  'Contrat de maintenance',
  'Technicien',
  'Syndic / gestionnaire',
  'Locataire / occupant',
  'Interne',
] as const;

export const DEFAULT_RESPONSABLES = [
  'Anouar',
  'Najoua',
  'Zehair',
  'Fatima',
  'Randa',
] as const;

export const DEFAULT_TECHNICIENS = [
  'Anouar',
  'Mohamed',
  'Haitam',
  'Jamal',
  'Manneh',
  'Yankoubou',
  'Sous-traitant',
] as const;

export const STATUTS_COMMERCIAUX_DEVIS = [
  'À préparer',

  'À valider en interne',
  'Envoyé au client',

  'Accepté',
  'Expiré',
  'Refusé',
  'Annulé',
] as const;

export const TRAITEMENTS_ADMIN = [
  'À traiter',
  'En cours de traitement',
  'En attente client',
  'En attente fournisseur',
  'En attente technicien',
  'Bloqué',
  'Traité',
  'Classé sans suite',
] as const;

export const PROCHAINES_ACTIONS_DEVIS = [
  'Chiffrer',
  'Demander des informations',
  'Faire valider',
  'Envoyer au client',
  'Relancer le client',
  'Réviser le prix',
  'Planifier après accord',
  'Aucune',
] as const;

export const PRIORITES = [
  'Basse',
  'Normale',
  'Haute',
  'Urgente',
] as const;

export const TYPES_INTERVENTION = [
  'Visite technique devis',
  'Préventive',
  'Corrective',
  'Dépannage',
  'SAV',
  'Contrôle / diagnostic',
  'Travaux complémentaires',
  
] as const;

export const MODES_PLANIFICATION = [
  'Planifiée',
  'Non planifiée',
] as const;

export const STATUTS_OPERATIONNELS_INTERVENTION = [

  'À planifier',
  'Planifiée',
  'Affectée',


  'En cours',
  'Suspendue',
  'Terminée - à valider',
  'Clôturée',
  'Annulée',
] as const;

export const DEFAULT_MOTIFS_BLOCAGE = [
  'Matériel / pièces manquants',
  'Matériel en commande',
  'Accord client en attente',
  'Devis complémentaire à établir',
  'Client / occupant absent',
  'Accès au site impossible',
  'Autre corps d’état nécessaire',
  'Sous-traitant en attente',
  'Autorisation / consignation manquante',
  'Diagnostic complémentaire nécessaire',
  'Météo défavorable',
  'Zone non sécurisée',
] as const;

export const DEFAULT_RESULTATS_TECHNIQUES = [
  'Conforme / Résolu définitivement',
  'Dépannage provisoire effectué',
  'Réserve / Finition à prévoir',
  'Devis complémentaire nécessaire',
  'Pièce à remplacer (en commande)',
  'Relevé / Diagnostic chiffrage complet',
  'Non résolu (accès / client absent)',
] as const;

export const STATUTS_FACTURE = [
  'Non facturée',
  'Facturée',
] as const;

// Legacy compatibility enums
export const StatutDevis = ['a-traiter', 'en-cours', 'en-attente', 'bloque', 'traite'] as const;
export const StatutIntervention = ['a-traiter', 'en-cours', 'en-attente', 'bloque', 'traite'] as const;
export type StatutDevisType = typeof StatutDevis[number];
export type StatutInterventionType = typeof StatutIntervention[number];

export const STATUT_LABELS: Record<StatutDevisType | StatutInterventionType, string> = {
  'a-traiter': 'À traiter',
  'en-cours': 'En cours de traitement',
  'en-attente': 'En attente',
  'bloque': 'Bloqué',
  'traite': 'Traité / Clôturé',
};

export const STATUT_COLORS: Record<StatutDevisType | StatutInterventionType, { bg: string; text: string }> = {
  'a-traiter': { bg: '#e5e7eb', text: '#374151' },
  'en-cours': { bg: '#dbeafe', text: '#1e40af' },
  'en-attente': { bg: '#fef3c7', text: '#92400e' },
  'bloque': { bg: '#fee2e2', text: '#991b1b' },
  'traite': { bg: '#dcfce7', text: '#166534' },
};

// Map administrative treatment label <-> legacy code
export function traitementToStatusCode(traitement?: string | null): StatutDevisType {
  if (!traitement) return 'a-traiter';
  const t = traitement.toLowerCase();
  if (t.includes('bloqué') || t === 'bloque') return 'bloque';
  if (t.includes('attente') || t === 'en-attente') return 'en-attente';
  if (t.includes('cours') || t === 'en-cours') return 'en-cours';
  if (t === 'traité' || t === 'traite' || t.includes('classé sans suite')) return 'traite';
  return 'a-traiter';
}

export function statusCodeToTraitement(status?: string | null): string {
  switch (status?.toLowerCase().replace('_', '-')) {
    case 'en-cours': return 'En cours de traitement';
    case 'en-attente': return 'En attente client';
    case 'bloque': return 'Bloqué';
    case 'traite': return 'Traité';
    default: return 'À traiter';
  }
}

// ============================================================================
// 2. HISTORIQUE & MODÈLES
// ============================================================================

export interface HistoriqueEvent {
  id: string;
  date: string; // ISO string
  auteur: string;
  action: string;
  details?: string;
}

export interface EquipeJournaliere {
  id: string;
  nomEquipe: string; // ex: "Anouar + Haitam" ou "Anouar + Mohamed + Manneh"
  membres: string[]; // 2, 3 individus ou plus
  dateDebut: string; // YYYY-MM-DD (par défaut : la journée active)
  dateFin: string;   // YYYY-MM-DD (égal à dateDebut si par journée, ou plage de dates si affecté à une durée)
  touteLaJournee: boolean; // true = toute la journée, false = heures spécifiques dans la journée
  heureDebut: string; // ex: "08:00"
  heureFin: string;   // ex: "17:30"
  createdAt?: string;
}

export interface ReferentielsMap {
  clients: string[];
  clients_fiches?: ClientProfile[];
  corps_etat: string[];
  origines: string[];
  responsables: string[];
  techniciens: string[];
  motifs_blocage: string[];
  resultats_techniques: string[];
  technicien_competences?: Record<string, string[]>;
  equipes_journalieres?: EquipeJournaliere[];
  positions_gps_techniciens?: Record<string, GpsPositionPayload>;
}

export const DEFAULT_REFERENTIELS: ReferentielsMap = {
  clients: [...DEFAULT_CLIENTS],
  clients_fiches: [...DEFAULT_CLIENT_PROFILES],
  corps_etat: [...DEFAULT_CORPS_ETAT],
  origines: [...DEFAULT_ORIGINES],
  responsables: [...DEFAULT_RESPONSABLES],
  techniciens: [...DEFAULT_TECHNICIENS],
  motifs_blocage: [...DEFAULT_MOTIFS_BLOCAGE],
  resultats_techniques: [...DEFAULT_RESULTATS_TECHNIQUES],
};

// ============================================================================
// 3. CALCULS AUTOMATIQUES ANELEC (Formules Excel & Fuseau Europe/Paris)
// ============================================================================

export function getTodayParisISO(): string {
  try {
    const parts = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback
  }
  return new Date().toISOString().split('T')[0];
}

function diffDaysISO(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}

export interface DevisComputed {
  dateExpiration: string | null; // Col N: =IF(I5="","",I5+M5) — seulement si validité présente !
  joursOuverts: number | null;   // Col U: =IF(G5="","",IF(OR(J5="Accepté",J5="Refusé",J5="Annulé"),"",TODAY()-G5))
  alerte: 'Traité' | 'Relance en retard' | 'Réponse en retard' | 'À suivre'; // Col V
  alerteExplication: string;
  qualiteAlertes: string[];      // Séparé des retards !
}

export function computeDevisCalculations(d: {
  dateCreated?: string | null;
  echeance?: string | null;
  dateEnvoi?: string | null;
  validiteJours?: number | null;
  dateRelance?: string | null;
  statutCommercial?: string | null;
  traitement?: string | null;
  prochaineAction?: string | null;
  responsable?: string | null;
  client?: string | null;
  site?: string | null;
  amount?: number | null;
}): DevisComputed {
  const today = getTodayParisISO();
  const statut = d.statutCommercial || 'À préparer';
  const isTerminal = ['Accepté', 'Refusé', 'Annulé'].includes(statut);

  // Col N: Date d'expiration calculée seulement si dateEnvoi ET validiteJours > 0
  // (Règle métier: absence de validité n'est pas expiration le jour d'envoi)
  const dateExpiration =
    d.dateEnvoi && typeof d.validiteJours === 'number' && d.validiteJours > 0
      ? addDaysISO(d.dateEnvoi, d.validiteJours)
      : null;

  // Col U: Jours ouverts depuis demande hors états terminaux
  const joursOuverts =
    !isTerminal && d.dateCreated ? Math.max(0, diffDaysISO(today, d.dateCreated)) : null;

  // Col V: Alerte Devis
  let alerte: DevisComputed['alerte'] = 'À suivre';
  let alerteExplication = 'Suivi normal en cours';

  if (isTerminal) {
    alerte = 'Traité';
    alerteExplication = `État commercial terminal (${statut})`;
  } else if (d.dateRelance && d.dateRelance < today) {
    alerte = 'Relance en retard';
    const retard = diffDaysISO(today, d.dateRelance);
    alerteExplication = `Relance prévue le ${formatDateFR(d.dateRelance)}, dépassée de ${retard} j.`;
  } else if (d.echeance && d.echeance < today) {
    alerte = 'Réponse en retard';
    const retard = diffDaysISO(today, d.echeance);
    alerteExplication = `Date limite du ${formatDateFR(d.echeance)} dépassée de ${retard} j.`;
  } else if (d.dateRelance && d.dateRelance === today) {
    alerteExplication = `Relance prévue aujourd'hui (${formatDateFR(d.dateRelance)})`;
  }

  // Qualité des données (affichée séparément des retards)
  const qualiteAlertes: string[] = [];
  if (!isTerminal && d.traitement !== 'Classé sans suite') {
    if (!d.responsable) qualiteAlertes.push('Aucun responsable assigné');
    if (!d.prochaineAction || d.prochaineAction === 'Aucune') {
      qualiteAlertes.push('Aucune prochaine action définie');
    }
  }
  if (!d.site) qualiteAlertes.push('Site / adresse à préciser');
  if (
    ['Envoyé au client', 'En négociation', 'Accepté'].includes(statut) &&
    (d.amount === null || d.amount === undefined)
  ) {
    qualiteAlertes.push('Montant HT manquant sur devis envoyé/accepté');
  }
  if (dateExpiration && dateExpiration < today && !isTerminal && statut !== 'Expiré') {
    qualiteAlertes.push(`Validité dépassée depuis le ${formatDateFR(dateExpiration)} (statut non basculé automatiquement)`);
  }

  return {
    dateExpiration,
    joursOuverts,
    alerte,
    alerteExplication,
    qualiteAlertes,
  };
}

export interface InterventionComputed {
  alerteDelai: 'Traité' | 'En retard' | 'Aujourd’hui' | 'À suivre'; // Col R
  alerteExplication: string;
  qualiteAlertes: string[];
  dureeHeures: number | null;
}

export function computeInterventionCalculations(i: {
  dateDemande?: string | null;
  datePlanifiee?: string | null;
  echeance?: string | null;
  statutOperationnel?: string | null;
  traitement?: string | null;
  entreprise?: string | null;
  motifBlocage?: string | null;
  resultatTechnique?: string | null;
  compteRendu?: string | null;
  statutFacture?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
}): InterventionComputed {
  const today = getTodayParisISO();
  const statutOp = i.statutOperationnel || 'À planifier';
  const isTerminal = ['Clôturée', 'Annulée'].includes(statutOp);

  // Col R: =IF(A5="","",IF(OR(L5="Clôturée",L5="Annulée"),"Traité",IF(AND(Q5<>"",Q5<TODAY()),"En retard",IF(AND(K5<>"",K5=TODAY()),"Aujourd’hui","À suivre"))))
  let alerteDelai: InterventionComputed['alerteDelai'] = 'À suivre';
  let alerteExplication = i.datePlanifiee
    ? `Planifiée le ${formatDateFR(i.datePlanifiee)}`
    : 'En attente de date de planification';

  if (isTerminal) {
    alerteDelai = 'Traité';
    alerteExplication = `Intervention ${statutOp.toLowerCase()}`;
  } else if (i.echeance && i.echeance < today) {
    alerteDelai = 'En retard';
    const retard = diffDaysISO(today, i.echeance);
    alerteExplication = `Échéance du ${formatDateFR(i.echeance)} dépassée de ${retard} j.`;
  } else if (i.datePlanifiee && i.datePlanifiee === today) {
    alerteDelai = 'Aujourd’hui';
    alerteExplication = `Intervention prévue aujourd'hui${i.heureDebut ? ` (${i.heureDebut}-${i.heureFin || ''})` : ''}`;
  } else if (i.datePlanifiee && i.datePlanifiee < today && !isTerminal) {
    alerteDelai = 'En retard';
    const retard = diffDaysISO(today, i.datePlanifiee);
    alerteExplication = `Date planifiée (${formatDateFR(i.datePlanifiee)}) dépassée de ${retard} j.`;
  }

  // Qualité des données (dont incohérence date planifiée < date demande, ex: K9 en 2025 et J9 en 2026)
  const qualiteAlertes: string[] = [];
  if (i.datePlanifiee && i.dateDemande && i.datePlanifiee < i.dateDemande) {
    qualiteAlertes.push(
      `Incohérence de dates : planifiée le ${formatDateFR(i.datePlanifiee)} avant la demande du ${formatDateFR(i.dateDemande)}`
    );
  }
  if (!isTerminal && !i.entreprise && ['Planifiée', 'Affectée', 'En cours', 'Sur site'].includes(statutOp)) {
    qualiteAlertes.push('Technicien non affecté sur une intervention planifiée');
  }
  if ((i.traitement === 'Bloqué' || statutOp === 'Suspendue') && !i.motifBlocage) {
    qualiteAlertes.push('Motif de blocage à préciser');
  }
  if (statutOp === 'Clôturée' && (!i.compteRendu || !i.resultatTechnique)) {
    qualiteAlertes.push('Clôturée sans résultat technique ou compte rendu complet');
  }

  const dureeHeures = computeDurationHours(i.heureDebut, i.heureFin);

  return {
    alerteDelai,
    alerteExplication,
    qualiteAlertes,
    dureeHeures,
  };
}

function toDateSlice(v?: string | Date | null): string | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const str = String(v).trim();
  return str.length >= 10 ? str.slice(0, 10) : null;
}

export function applyDevisAutomations<T extends Record<string, any>>(next: T, prev?: Partial<T> | null): T {
  const out: any = { ...next };
  const today = getTodayParisISO();

  const dateCreated = toDateSlice(out.dateCreated ?? out.dateDemande) || toDateSlice(prev?.dateCreated) || today;
  out.dateCreated = dateCreated;

  const validite = typeof out.validiteJours === 'number' && out.validiteJours > 0 ? out.validiteJours : 30;
  if (out.validiteJours === undefined || out.validiteJours === null) {
    out.validiteJours = 30;
  }

  let statut = String(out.statutCommercial || 'À préparer');
  const prevStatut = prev?.statutCommercial ? String(prev.statutCommercial) : undefined;

  let dateEnvoi = toDateSlice(out.dateEnvoi);
  const prevEnvoi = toDateSlice(prev?.dateEnvoi);

  let dateRelance = toDateSlice(out.dateRelance);
  const prevRelance = toDateSlice(prev?.dateRelance);

  let echeance = toDateSlice(out.echeance ?? out.dateLimite);
  const prevEcheance = toDateSlice(prev?.echeance ?? (prev as any)?.dateLimite);

  // 1. Saisie d'un montant > 0 sur un brouillon sans date d'envoi => prêt à valider en interne
  if (
    prev &&
    Number(out.amount || 0) > 0 &&
    Number(prev.amount || 0) <= 0 &&
    statut === 'À préparer' &&
    statut === prevStatut &&
    !dateEnvoi
  ) {
    statut = 'À valider en interne';
  }

  const defaultPrepDeadline = addDaysISO(dateCreated, 7);

  // 2. Date d'envoi saisie ou modifiée => passe en "Envoyé au client" + calcule J+3 relance & échéance
  if (dateEnvoi && dateEnvoi !== prevEnvoi) {
    if (['À préparer', 'À valider en interne'].includes(statut)) {
      statut = 'Envoyé au client';
    }
    if (!dateRelance || dateRelance === prevRelance) {
      dateRelance = addDaysISO(dateEnvoi, 3);
    }
    if (!echeance || echeance === prevEcheance || echeance === defaultPrepDeadline) {
      echeance = addDaysISO(dateEnvoi, validite);
    }
  }

  // 3. Passage manuel à "Envoyé au client" => auto-remplit dateEnvoi, dateRelance (J+3), échéance (+validité)
  if (statut === 'Envoyé au client' && prevStatut !== 'Envoyé au client') {
    if (!dateEnvoi) dateEnvoi = today;
    if (!dateRelance) dateRelance = addDaysISO(dateEnvoi, 3);
    if (!echeance || echeance === defaultPrepDeadline) echeance = addDaysISO(dateEnvoi, validite);
  }

  // 4. Recalcul échéance si validité modifiée alors que dateEnvoi est présente
  if (dateEnvoi && prev && out.validiteJours !== prev.validiteJours && (!echeance || echeance === prevEcheance)) {
    echeance = addDaysISO(dateEnvoi, validite);
  }

  // 5. Filet de sécurité : devis déjà "Envoyé au client" avec dateEnvoi mais sans dateRelance (et non effacée manuellement)
  if (statut === 'Envoyé au client' && dateEnvoi && !dateRelance && !prevRelance) {
    dateRelance = addDaysISO(dateEnvoi, 3);
  }

  // 6. Auto-expiration si envoyé et date d'expiration dépassée
  if (statut === 'Envoyé au client' && dateEnvoi && validite > 0) {
    const exp = addDaysISO(dateEnvoi, validite);
    if (exp < today && prevStatut !== 'Expiré') {
      statut = 'Expiré';
    }
  }

  // 7. Échéance par défaut à la création (J+7 pour chiffrer/répondre)
  if (!echeance && statut === 'À préparer' && !prev) {
    echeance = addDaysISO(dateCreated, 7);
  }

  // 8. États terminaux : aucune relance en attente (évite les fausses alertes)
  const isTerminal = ['Accepté', 'Refusé', 'Annulé', 'Expiré'].includes(statut);
  if (isTerminal && (!prev || statut !== prevStatut || dateRelance === prevRelance)) {
    dateRelance = null;
  }

  out.statutCommercial = statut;
  out.dateEnvoi = dateEnvoi;
  out.dateRelance = dateRelance;
  out.echeance = echeance;

  // 9. Déduction automatique de traitement & prochaineAction (respecte les choix manuels)
  const visiteChanged = Boolean(out.visiteNecessaire) !== Boolean(prev?.visiteNecessaire) || toDateSlice(out.visiteDate) !== toDateSlice(prev?.visiteDate);
  const statutChanged = !prev || statut !== prevStatut;
  const traitementTouched = prev && out.traitement !== prev.traitement;
  if (!traitementTouched && (!out.traitement || statutChanged || visiteChanged)) {
    out.traitement =
      out.visiteNecessaire && !toDateSlice(out.visiteDate)
        ? 'En attente technicien'
        : isTerminal
        ? 'Traité'
        : statut === 'Envoyé au client'
        ? 'En attente client'
        : statut === 'À préparer' && !prev
        ? 'À traiter'
        : 'En cours de traitement';
  }
  const actionTouched = prev && out.prochaineAction !== prev.prochaineAction;
  if (!actionTouched && (!out.prochaineAction || statutChanged)) {
    out.prochaineAction =
      statut === 'À préparer'
        ? 'Chiffrer'
        : statut === 'À valider en interne'
        ? 'Faire valider'
        : statut === 'Envoyé au client'
        ? 'Relancer le client'
        : statut === 'Accepté'
        ? 'Planifier après accord'
        : 'Aucune';
  }

  return out;
}

function slaDaysForPriority(priorite?: string | null): number {
  const p = String(priorite || 'Normale').toLowerCase();
  if (p.includes('urg')) return 1;
  if (p.includes('haut')) return 3;
  if (p.includes('bass')) return 14;
  return 7;
}

export function applyInterventionAutomations<T extends Record<string, any>>(next: T, prev?: Partial<T> | null): T {
  const out: any = { ...next };
  const today = getTodayParisISO();

  const dateDemande = toDateSlice(out.dateDemande) || toDateSlice(prev?.dateDemande) || today;
  out.dateDemande = dateDemande;

  const tech = String(out.entreprise || out.technicien || '').trim();
  const prevTech = String(prev?.entreprise || (prev as any)?.technicien || '').trim();

  const datePlan = toDateSlice(out.datePlanifiee);
  const prevPlan = toDateSlice(prev?.datePlanifiee);

  let echeance = toDateSlice(out.echeance ?? out.dateEcheance);
  const prevEcheance = toDateSlice(prev?.echeance ?? (prev as any)?.dateEcheance);

  let statut = String(out.statutOperationnel || 'À planifier');


  // 1. Technicien renseigné => Affectée (sans date) ou Planifiée (avec date) + créneau par défaut
  if (tech && datePlan && ['À planifier', 'Affectée'].includes(statut) && (!prev || tech !== prevTech || datePlan !== prevPlan)) {
    statut = 'Planifiée';
    if (!out.heureDebut) out.heureDebut = '08:00';
    if (!out.heureFin) out.heureFin = '12:00';
  } else if (tech && !datePlan && statut === 'À planifier' && (!prev || tech !== prevTech)) {
    statut = 'Affectée';
  }

  // 2. Technicien retiré => repasse à "À planifier" si était "Planifiée" ou "Affectée"
  if (!tech && prevTech && ['Planifiée', 'Affectée'].includes(statut)) {
    statut = 'À planifier';
  }

  // 3. Échéance auto selon datePlanifiee ou SLA priorité
  if (datePlan && datePlan !== prevPlan && (!echeance || echeance === prevEcheance)) {
    echeance = datePlan;
  } else if (!echeance || (prev && out.priorite !== prev.priorite && echeance === prevEcheance)) {
    echeance = datePlan || addDaysISO(dateDemande, slaDaysForPriority(out.priorite));
  }

  // 4. Motif de blocage saisi => bascule auto en "Suspendue" + traitement "Bloqué"
  const motif = String(out.motifBlocage || '').trim();
  const prevMotif = String(prev?.motifBlocage || '').trim();
  if (motif && motif !== prevMotif && !['Clôturée', 'Annulée'].includes(statut)) {
    statut = 'Suspendue';
    out.traitement = 'Bloqué';
  }

  // 5. Réalisation / Clôture => date réelle du jour & statut rapport validé
  if (['Terminée - à valider', 'Clôturée'].includes(statut) && !toDateSlice(out.dateReelle)) {
    out.dateReelle = today;
  }
  if (statut === 'Clôturée' && (!out.statutRapport || ['En attente', 'Déclaré par technicien'].includes(out.statutRapport))) {
    out.statutRapport = 'Validé';
  }

  // 6. N° de facture saisi => statut facture auto "Facturée"
  const numFact = String(out.numeroFacture || '').trim();
  const prevNumFact = String(prev?.numeroFacture || '').trim();
  if (numFact && numFact !== prevNumFact) {
    out.statutFacture = 'Facturée';
  } else if (!out.statutFacture) {
    out.statutFacture = 'Non facturée';
  }

  out.statutOperationnel = statut;
  out.echeance = echeance;
  out.modePlanification = datePlan ? 'Planifiée' : 'Non planifiée';

  return out;
}


// ============================================================================
// 4. PARSEUR D'INTERVALLES HORAIRES CLAVIER & SOURIS ("08:30-11:00", "8h-12h", etc.)
// ============================================================================

export function computeDurationHours(heureDebut?: string | null, heureFin?: string | null): number | null {
  if (!heureDebut || !heureFin) return null;
  const m1 = /^(\d{1,2}):(\d{2})$/.exec(heureDebut);
  const m2 = /^(\d{1,2}):(\d{2})$/.exec(heureFin);
  if (!m1 || !m2) return null;
  const startMin = parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10);
  const endMin = parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
  if (endMin <= startMin) return null;
  return Math.round(((endMin - startMin) / 60) * 100) / 100;
}

/**
 * Parse une saisie clavier souple en intervalle { heureDebut: "HH:MM", heureFin: "HH:MM" }
 * Exemples supportés :
 * - "08:30-11:00", "8h30 - 11h", "8:30 à 11:30", "830-1100"
 * - "14h+2h", "09:00+1h30"
 * - "matin" -> 08:00 - 12:00
 * - "apres-midi" / "am" -> 13:30 - 17:30
 * - "journee" -> 08:00 - 17:30
 */
export function parseTimeIntervalInput(raw: string): { heureDebut: string; heureFin: string } | null {
  const clean = raw.trim().toLowerCase();
  if (!clean) return null;

  if (clean === 'matin' || clean === 'mat') {
    return { heureDebut: '08:00', heureFin: '12:00' };
  }
  if (clean === 'apres-midi' || clean === 'après-midi' || clean === 'aprem' || clean === 'pm') {
    return { heureDebut: '13:30', heureFin: '17:30' };
  }
  if (clean === 'journee' || clean === 'journée' || clean === 'jour') {
    return { heureDebut: '08:00', heureFin: '17:30' };
  }

  const normalizeSingleTime = (token: string): number | null => {
    const t = token.trim().replace(/\s+/g, '');
    // Format "8h30", "08:30", "8h", "14"
    let m = /^(\d{1,2})(?:[:h](\d{1,2})?)?$/.exec(t);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0;
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
    }
    // Format "0830" or "830"
    m = /^(\d{3,4})$/.exec(t);
    if (m) {
      const str = m[1].padStart(4, '0');
      const h = parseInt(str.slice(0, 2), 10);
      const min = parseInt(str.slice(2, 4), 10);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
    }
    return null;
  };

  const minToHHMM = (totalMin: number): string => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMin));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Format addition : "14h+2h30" ou "09:00+2"
  if (clean.includes('+')) {
    const [startPart, durPart] = clean.split('+');
    const startMin = normalizeSingleTime(startPart);
    if (startMin !== null && durPart) {
      const dm = /^(\d{1,2})(?:[h:](\d{1,2})?)?$/.exec(durPart.trim());
      if (dm) {
        const dh = parseInt(dm[1], 10);
        const dmin = dm[2] ? parseInt(dm[2].padEnd(2, '0'), 10) : 0;
        const endMin = startMin + dh * 60 + dmin;
        if (endMin > startMin) {
          return { heureDebut: minToHHMM(startMin), heureFin: minToHHMM(endMin) };
        }
      }
    }
  }

  // Format plage : "08:30 - 11:00", "8h à 11h30", "8h/12h"
  const parts = clean.split(/\s*(?:[-–—/]|à|a|to)\s*/);
  if (parts.length === 2) {
    const startMin = normalizeSingleTime(parts[0]);
    const endMin = normalizeSingleTime(parts[1]);
    if (startMin !== null && endMin !== null && endMin > startMin) {
      return { heureDebut: minToHHMM(startMin), heureFin: minToHHMM(endMin) };
    }
  }

  return null;
}

// ============================================================================
// 5. ZOD SCHEMAS & TYPES
// ============================================================================

export interface GpsPositionPayload {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: string;
  technicien: string;
  missionId?: number;
  missionRef?: string;
  chantier?: string;
  client?: string;
  statut?: 'EN_COURS' | 'CLOTUREE' | 'EN_SERVICE';
  source?: 'GPS_MOBILE' | 'GEOCODED_FALLBACK';
}

export const DevisSchema = z.object({
  id: z.number().int().positive().optional(),
  reference: z.string().max(100).optional().nullable(),
  client: z.string().min(1, 'Client est requis').max(200),
  site: z.string().max(250).optional().nullable(),
  objet: z.string().max(300).optional().nullable(),
  corpsEtat: z.string().max(100).optional().nullable(),
  origine: z.string().max(100).optional().nullable(),
  dateCreated: z.string().optional(),
  echeance: z.string().optional().nullable(),
  dateEnvoi: z.string().optional().nullable(),
  statutCommercial: z.string().default('À préparer'),
  status: z.enum(StatutDevis).default('a-traiter'),
  traitement: z.string().optional().nullable(),
  amount: z.number().nonnegative().optional().nullable(),
  /** Taux de TVA choisi à la saisie ; null = présélection selon le type de client */
  tauxTVA: z.number().min(0).max(100).optional().nullable(),
  validiteJours: z.number().int().positive().optional().nullable(),
  prochaineAction: z.string().max(150).optional().nullable(),
  dateRelance: z.string().optional().nullable(),
  responsable: z.string().max(100).optional().nullable(),
  priorite: z.string().default('Normale'),
  refInterventionTexte: z.string().max(150).optional().nullable(),
  numeroDI: z.string().max(40).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  visiteNecessaire: z.boolean().optional().default(false),
  visiteTechnicien: z.string().max(100).optional().nullable(),
  visiteDate: z.string().optional().nullable(),
  visiteHeureDebut: z.string().max(10).optional().nullable(),
  visiteHeureFin: z.string().max(10).optional().nullable(),
  visiteStatut: z.string().max(50).optional().nullable(),
  gpsCloture: z.any().optional().nullable(),
  historique: z.array(z.any()).optional(),
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional(),
});

export const InterventionSchema = z.object({
  id: z.number().int().positive().optional(),
  reference: z.string().max(100).optional().nullable(),
  refDevisTexte: z.string().max(100).optional().nullable(),
  numeroDI: z.string().max(40).optional().nullable(),
  client: z.string().max(200).optional().nullable(),
  chantier: z.string().min(1, 'Site / Chantier est requis').max(250),
  objet: z.string().max(300).optional().nullable(),
  origine: z.string().max(100).optional().nullable(),
  typeIntervention: z.string().max(100).optional().nullable(),
  modePlanification: z.string().max(50).optional().nullable(),
  corpsEtat: z.string().max(100).optional().nullable(),
  priorite: z.string().default('Normale'),
  dateDemande: z.string().optional().nullable(),
  datePlanifiee: z.string().optional().nullable(),
  statutOperationnel: z.string().default('À planifier'),
  status: z.enum(StatutIntervention).default('a-traiter'),
  traitement: z.string().optional().nullable(),
  entreprise: z.string().max(200).optional().nullable(),
  dateDebut: z.string().optional().nullable(),
  dateReelle: z.string().optional().nullable(),
  echeance: z.string().optional().nullable(),
  resultatTechnique: z.string().max(500).optional().nullable(),
  motifBlocage: z.string().max(200).optional().nullable(),
  numeroFacture: z.string().max(100).optional().nullable(),
  statutFacture: z.string().max(50).optional().nullable(),
  compteRendu: z.string().max(4000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  amount: z.number().nonnegative().optional().nullable(),
  /** Taux de TVA choisi à la saisie ; null = présélection selon le type de client */
  tauxTVA: z.number().min(0).max(100).optional().nullable(),
  heureDebut: z.string().max(10).optional().nullable(),
  heureFin: z.string().max(10).optional().nullable(),
  heureDebutReelle: z.string().max(10).optional().nullable(),
  heureFinReelle: z.string().max(10).optional().nullable(),
  actionsRealisees: z.array(z.string()).optional(),
  photos: z.array(z.any()).optional(),
  elementsChiffrage: z.string().max(4000).optional().nullable(),
  rapportFinal: z.string().max(8000).optional().nullable(),
  statutRapport: z.string().max(80).optional().nullable(),
  reponseTechnicien: z.string().max(20).optional().nullable(),
  reponseLe: z.string().optional().nullable(),
  motifRefus: z.string().max(300).optional().nullable(),
  affecteLe: z.string().optional().nullable(),
  isVisiteDevis: z.boolean().optional().default(false),
  origineDevisId: z.number().int().positive().optional().nullable(),
  origineDevisClient: z.string().max(200).optional().nullable(),
  origineDevisDate: z.string().optional().nullable(),
  devisId: z.number().int().positive().optional().nullable(),
  gpsCloture: z.any().optional().nullable(),
  historique: z.array(z.any()).optional(),
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional(),
});

export type Devis = z.infer<typeof DevisSchema> & {
  id: number;
  computed?: DevisComputed;
  interventionsCount?: number;
};

export type Intervention = z.infer<typeof InterventionSchema> & {
  id: number;
  computed?: InterventionComputed;
};

/**
 * Demande reçue du donneur d'ordre, avant d'être orientée en visite, devis ou intervention.
 * Le numéro de DI est émis par le client : la clé de suivi est le couple (client + numeroDI).
 * Un particulier n'a pas de DI et reçoit une référence interne.
 */
export const TYPES_DEMANDEUR = ['DONNEUR_ORDRE', 'ENTREPRISE', 'PARTICULIER', 'SOUS_TRAITANT'] as const;
export const STATUTS_DEMANDE = ['A_DECIDER', 'ORIENTEE', 'ANNULEE'] as const;
export const DECISIONS_DEMANDE = ['VISITE', 'DEVIS', 'INTERVENTION'] as const;

export type TypeDemandeur = (typeof TYPES_DEMANDEUR)[number];
export type StatutDemande = (typeof STATUTS_DEMANDE)[number];
export type DecisionDemande = (typeof DECISIONS_DEMANDE)[number];

export const CANAUX_RECEPTION = ['E-mail', 'Téléphone', 'Portail client', 'Courrier', 'Sur place'] as const;

export interface Demande {
  id: number;
  typeDemandeur: TypeDemandeur;
  client: string;
  numeroDI?: string | null;
  referenceInterne?: string | null;
  site?: string | null;
  objet?: string | null;
  corpsEtat?: string | null;
  priorite: string;
  canalReception?: string | null;
  dateReception: string;
  echeanceSouhaitee?: string | null;
  notes?: string | null;
  statut: StatutDemande;
  decision?: DecisionDemande | null;
  decidedAt?: string | null;
  devisId?: number | null;
  interventionId?: number | null;
  historique?: HistoriqueEvent[];
  /** Clé de suivi affichable : « client · DI », jamais le DI seul */
  cleDossier: string;
  isB2C: boolean;
  companyId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRoleCode =
  | 'ADMIN'
  | 'CHIFFRAGE_DEVIS'
  | 'CONDUCTEUR_TRAVAUX'
  | 'REDACTEUR_RAPPORTS'
  | 'TECHNICIEN'
  | 'USER'
  | 'VIEWER';

export interface UserPermissions {
  canManageUsers: boolean;
  canManageReferentiels: boolean;
  canEditDevis: boolean;
  canViewFinancials: boolean;
  canConvertDevis: boolean;
  canEditPlanning: boolean;
  canEditInterventions: boolean;
  canWriteReports: boolean;
  canManageBilling: boolean;
  canDeleteRecords: boolean;
  canAccessMobileTech: boolean;
  mobileOnly: boolean;
}

export interface CompanyInfo {
  id: number;
  name: string;
  siret?: string | null;
  siren?: string | null;
  /** Ouvrir le tableau de bord sur « Ma file » (réglage de la société) */
  accueilMaFile?: boolean | null;
  /** Adresse du siège : point de départ des tournées, propre à chaque entreprise */
  siegeAdresse?: string | null;
  siegeLat?: number | null;
  siegeLng?: number | null;
}

export type ThemeId = 'light' | 'dark' | 'atlas' | 'craft' | 'signal' | 'swiss' | 'bento';

export interface UserThemeSettings {
  companyDefault: ThemeId;
  allowOverride: boolean;
  userPref: ThemeId | null;
  resolved: ThemeId;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRoleCode | string;
  technicienNom?: string | null;
  permissions?: UserPermissions;
  active?: boolean;
  companyId?: number | null;
  companyName?: string | null;
  companySiret?: string | null;
  company?: CompanyInfo | null;
  theme?: UserThemeSettings;
  createdAt?: number | string;
}

export interface TerrainPhoto {
  id: string;
  url: string;
  caption?: string;
  category?: 'AVANT' | 'APRES' | 'RELEVE_CHIFFRAGE' | 'CONSTAT';
  takenAt: string;
  auteur?: string;
}

export interface PointageTechnicienItem {
  id: number;
  technicien: string;
  userId?: number | null;
  dateJour: string;
  heureArriveeBureau?: string | null;
  timestampArrivee?: string | null;
  heureFinJournee?: string | null;
  timestampFin?: string | null;
  statutJournee: 'EN_SERVICE' | 'TERMINEE';
  derniereInterventionRef?: string | null;
  commentaireJournee?: string | null;
  dureeMinutes?: number | null;
}

// Helpers
export function formatDateFR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 'Non chiffré';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export function getStatutLabel(statut: StatutDevisType | StatutInterventionType): string {
  return STATUT_LABELS[statut] || statut;
}

export function getStatutColors(statut: StatutDevisType | StatutInterventionType): { bg: string; text: string } {
  return STATUT_COLORS[statut] || { bg: '#e5e7eb', text: '#374151' };
}


// ============================================================================
// 6. MATRICE DE COMPÉTENCES TECHNICIENS & ALGORITHME MOINDRE COMPÉTENCE
// ============================================================================

export const DEFAULT_TECHNICIEN_COMPETENCES: Record<string, string[]> = {
  Haitam: ['Électricité'],
  Manneh: ['Plomberie'],
  Yankoubou: ['CVC / Climatisation', 'Chauffage'],
  Mohamed: ['Plomberie', 'CVC / Climatisation', 'Chauffage'],
  Anouar: ['Électricité', 'Plomberie', 'Serrurerie'],
  Jamal: ['Menuiserie', 'Serrurerie', 'Peinture', 'Plâtrerie'],
  'Sous-traitant': ['Tous corps d’état', 'Maçonnerie', 'Faux plafond', 'Revêtement de sol'],
};

function normalizeSkillToken(val?: string | null): string {
  return (val || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Classe les techniciens pour un corps d'état / métier donné selon la règle ANELEC :
 * 1) Seuls les techniciens ayant la compétence requise (ou 'Tous corps d’état') sont éligibles.
 * 2) Parmi les techniciens éligibles, on choisit EN PRIORITÉ celui qui a LE MOINDRE DE COMPÉTENCES
 *    (ex: un technicien qui maîtrise uniquement l'Électricité (1 compétence) passe AVANT un technicien
 *    polyvalent qui maîtrise Électricité + Plomberie + Serrurerie (3 compétences), afin de préserver
 *    le technicien polyvalent pour d'autres interventions nécessitant ses autres compétences).
 * 3) En cas d'égalité du nombre de compétences, on départage par la charge horaire journalière la plus faible.
 */
export function rankTechniciansForTrade(
  requiredTrade: string | null | undefined,
  techniciens: string[],
  competencesMap?: Record<string, string[]>,
  currentLoadByTech: Record<string, number> = {}
): {
  qualified: { technicien: string; skillCount: number; skills: string[]; isWildcard: boolean }[];
  allRanked: { technicien: string; skillCount: number; skills: string[]; isQualified: boolean }[];
} {
  const map = competencesMap || {};
  const reqNorm = normalizeSkillToken(requiredTrade);
  const isGeneric =
    !reqNorm ||
    reqNorm.includes('tous corps') ||
    reqNorm === 'visite devis' ||
    reqNorm === 'intervention';

  const evaluated = techniciens.map((tech) => {
    const rawSkills = Array.isArray(map[tech])
      ? map[tech].filter(Boolean)
      : [];
    const normSkills = rawSkills.map(normalizeSkillToken);
    const hasWildcard = normSkills.some((k) => k.includes('tous corps'));
    const hasDirectSkill =
      !isGeneric &&
      normSkills.some((k) => k === reqNorm || k.includes(reqNorm) || reqNorm.includes(k));

    const specificSkills = rawSkills.filter((k) => !normalizeSkillToken(k).includes('tous corps'));
    const skillCount = rawSkills.length;
    // On classe strictement par le nombre réel de compétences cochées (du moindre de compétences au plus polyvalent)
    const effectiveSkillCount =
      rawSkills.length > 0
        ? specificSkills.length > 0
          ? rawSkills.length
          : 12
        : 99;

    const isQualified = isGeneric ? rawSkills.length > 0 : hasDirectSkill || hasWildcard;

    return {
      technicien: tech,
      skills: rawSkills,
      skillCount,
      effectiveSkillCount,
      hasDirectSkill,
      isWildcard: hasWildcard && !hasDirectSkill,
      isQualified,
      load: currentLoadByTech[tech] ?? 0,
    };
  });

  const qualified = evaluated
    .filter((e) => e.isQualified)
    .sort((a, b) => {
      if (a.isWildcard !== b.isWildcard) return a.isWildcard ? 1 : -1;
      if (a.effectiveSkillCount !== b.effectiveSkillCount) {
        return a.effectiveSkillCount - b.effectiveSkillCount;
      }
      return a.load - b.load;
    })
    .map((e) => ({
      technicien: e.technicien,
      skillCount: e.skillCount,
      skills: e.skills,
      isWildcard: e.isWildcard,
    }));

  const allRanked = [...evaluated]
    .sort((a, b) => {
      if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1;
      if (a.effectiveSkillCount !== b.effectiveSkillCount) {
        return a.effectiveSkillCount - b.effectiveSkillCount;
      }
      return a.load - b.load;
    })
    .map((e) => ({
      technicien: e.technicien,
      skillCount: e.skillCount,
      skills: e.skills,
      isQualified: e.isQualified,
    }));

  return { qualified, allRanked };
}

// ============================================================================
// 7. ARCHITECTURE RBAC ANELEC : RÔLES, DROITS & ACTIONS PRÉ-REMPLIES MOBILE
// ============================================================================

export interface RoleDefinition {
  code: UserRoleCode;
  label: string;
  badgeColor: string;
  summary: string;
  keyResponsibilities: string[];
  defaultPermissions: UserPermissions;
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  ADMIN: {
    code: 'ADMIN',
    label: 'Direction (administrateur de la société)',
    badgeColor: '#dc2626',
    summary:
      'Dirige sa société et elle seule : comptes et droits de ses collaborateurs, paramètres, validation avant facturation, facturation et rentabilité. Aucun accès aux autres sociétés.',
    keyResponsibilities: [
      'Créer les comptes de sa société et leur attribuer un profil (les droits restent bornés par le profil)',
      'Configurer les techniciens, compétences et paramètres métier de sa société',
      'Trier les demandes entrantes (accepter, refuser, orienter) et superviser les pointages',
      'Valider les rapports terminés, suivre la facturation et la rentabilité',
    ],
    defaultPermissions: {
      canManageUsers: true,
      canManageReferentiels: true,
      canEditDevis: true,
      canViewFinancials: true,
      canConvertDevis: true,
      canEditPlanning: true,
      canEditInterventions: true,
      canWriteReports: true,
      canManageBilling: true,
      canDeleteRecords: true,
      canAccessMobileTech: true,
      mobileOnly: false,
    },
  },
  CHIFFRAGE_DEVIS: {
    code: 'CHIFFRAGE_DEVIS',
    label: 'Chargé d’études (chiffrage)',
    badgeColor: '#2563eb',
    summary:
      'Prépare et chiffre les devis. Ne voit des interventions que celles liées à ses devis ou à ses visites de chiffrage ; l’exécution des travaux ne le concerne pas.',
    keyResponsibilities: [
      'Créer, chiffrer (montants HT, validité) et envoyer les devis, puis suivre leurs relances',
      'Planifier ses visites de chiffrage et consulter les relevés et photos de ces visites',
      'Transformer un devis accepté en intervention',
      'Jamais : planning des équipes, rapports, facturation, comptes et droits',
    ],
    defaultPermissions: {
      canManageUsers: false,
      canManageReferentiels: false,
      canEditDevis: true,
      canViewFinancials: true,
      canConvertDevis: true,
      canEditPlanning: true,
      canEditInterventions: false,
      canWriteReports: false,
      canManageBilling: false,
      canDeleteRecords: false,
      canAccessMobileTech: false,
      mobileOnly: false,
    },
  },
  CONDUCTEUR_TRAVAUX: {
    code: 'CONDUCTEUR_TRAVAUX',
    label: 'Planificateur',
    badgeColor: '#7c3aed',
    summary:
      'Pilote l’exécution : planifie et affecte les techniciens, suit le terrain, débloque les retards et clôture les interventions terminées. Voit les montants en lecture, sans chiffrer ni facturer.',
    keyResponsibilities: [
      'Planifier, affecter et replanifier les interventions (planning Gantt, auto-planification par compétence)',
      'Créer et modifier les fiches d’intervention, sauf la partie facturation',
      'Suivre les missions et les pointages des techniciens, débloquer les interventions en retard',
      'Clôturer une intervention terminée. Jamais : chiffrage des devis, facturation, comptes et droits',
    ],
    defaultPermissions: {
      canManageUsers: false,
      canManageReferentiels: true,
      canEditDevis: false,
      canViewFinancials: true,
      canConvertDevis: true,
      canEditPlanning: true,
      canEditInterventions: true,
      canWriteReports: true,
      canManageBilling: false,
      canDeleteRecords: false,
      canAccessMobileTech: true,
      mobileOnly: false,
    },
  },
  REDACTEUR_RAPPORTS: {
    code: 'REDACTEUR_RAPPORTS',
    label: 'Rapports et facturation',
    badgeColor: '#059669',
    summary:
      'Transforme les déclarations du terrain en rapports officiels, puis renseigne la facturation des interventions clôturées. Ne touche ni au planning ni aux devis.',
    keyResponsibilities: [
      'Relire les comptes rendus et photos des techniciens, rédiger et valider le rapport final',
      'Clôturer les rapports validés et envoyer le rapport au client',
      'Renseigner le numéro et le statut de facture des interventions clôturées',
      'Jamais : planning, affectations, devis et chiffrage, comptes et droits',
    ],
    defaultPermissions: {
      canManageUsers: false,
      canManageReferentiels: false,
      canEditDevis: false,
      canViewFinancials: true,
      canConvertDevis: false,
      canEditPlanning: false,
      canEditInterventions: true,
      canWriteReports: true,
      canManageBilling: true,
      canDeleteRecords: false,
      canAccessMobileTech: false,
      mobileOnly: false,
    },
  },
  TECHNICIEN: {
    code: 'TECHNICIEN',
    label: 'Technicien (sur ses propres missions)',
    badgeColor: '#d97706',
    summary:
      'Application mobile dédiée : ne voit que SES missions, sans montants, sans facturation ni historique. Pointe, démarre et termine ses interventions, renseigne son compte rendu et ses photos.',
    keyResponsibilities: [
      'Pointer son arrivée le matin et la fin de sa journée le soir',
      'Démarrer et terminer ses interventions et ses visites de chiffrage en temps réel',
      'Remplir son compte rendu (actions pré-remplies) et joindre ses photos Avant / Après / Relevé',
      'Jamais : les missions des autres, les montants, la facturation, le planning',
    ],
    defaultPermissions: {
      canManageUsers: false,
      canManageReferentiels: false,
      canEditDevis: false,
      canViewFinancials: false,
      canConvertDevis: false,
      canEditPlanning: false,
      canEditInterventions: true,
      canWriteReports: false,
      canManageBilling: false,
      canDeleteRecords: false,
      canAccessMobileTech: true,
      mobileOnly: true,
    },
  },
};

/**
 * PLAFOND PAR RÔLE : droits qu'un badge individuel ne pourra JAMAIS accorder à ce rôle.
 * Les badges par utilisateur restent des réglages fins, mais bornés par ce plafond (appliqué serveur ET écran).
 */
const NEVER_FOR_NON_ADMIN: (keyof UserPermissions)[] = ['canManageUsers', 'canDeleteRecords'];

export const ROLE_FORBIDDEN_PERMISSIONS: Record<string, (keyof UserPermissions)[]> = {
  // La direction ne peut pas être réduite à l'interface mobile (elle se verrouillerait hors de l'application)
  ADMIN: ['mobileOnly'],
  CHIFFRAGE_DEVIS: [
    ...NEVER_FOR_NON_ADMIN,
    'canManageBilling',
    'canWriteReports',
    'canEditInterventions',
    'canManageReferentiels',
  ],
  CONDUCTEUR_TRAVAUX: [...NEVER_FOR_NON_ADMIN, 'canManageBilling', 'canEditDevis'],
  REDACTEUR_RAPPORTS: [
    ...NEVER_FOR_NON_ADMIN,
    'canEditDevis',
    'canConvertDevis',
    'canEditPlanning',
    'canManageReferentiels',
  ],
  // Technicien : uniquement l'espace mobile et la mise à jour de SES missions
  TECHNICIEN: [
    ...NEVER_FOR_NON_ADMIN,
    'canManageReferentiels',
    'canEditDevis',
    'canViewFinancials',
    'canConvertDevis',
    'canEditPlanning',
    'canWriteReports',
    'canManageBilling',
  ],
};

/** Profil (espace de travail) correspondant à chaque rôle — pour afficher périmètre et limites côté administration. */
export const ROLE_ESPACE: Record<string, EspaceRole> = {
  ADMIN: 'direction',
  CHIFFRAGE_DEVIS: 'chiffrage',
  CONDUCTEUR_TRAVAUX: 'travaux',
  REDACTEUR_RAPPORTS: 'rapports',
  TECHNICIEN: 'terrain',
};

/** Ce droit peut-il être accordé à ce rôle ? (utilisé par l'écran d'administration pour griser les cases) */
export function isPermissionAllowedForRole(role: string | null | undefined, key: keyof UserPermissions): boolean {
  const forbidden = ROLE_FORBIDDEN_PERMISSIONS[(role || '').toUpperCase()];
  // Rôle inconnu : rien n'est accordable
  if (!forbidden) return false;
  return !forbidden.includes(key);
}

/** Retire d'un jeu de droits ceux que le rôle n'a pas le droit de porter (à l'enregistrement). */
export function sanitizePermissionsForRole<T extends Partial<UserPermissions>>(role: string | null | undefined, perms: T): T {
  const forbidden = ROLE_FORBIDDEN_PERMISSIONS[(role || '').toUpperCase()] || [];
  const out: any = { ...perms };
  for (const k of forbidden) if (k in out) out[k] = false;
  return out;
}

/** Rôles que l'application sait gérer. */
export function isKnownRole(role: string | null | undefined): boolean {
  return Object.prototype.hasOwnProperty.call(ROLE_FORBIDDEN_PERMISSIONS, (role || '').toUpperCase());
}

export function getEffectivePermissions(
  role?: string | null,
  customPermissionsJson?: string | null
): UserPermissions {
  const merged = mergePermissions(role, customPermissionsJson);
  const forbidden = ROLE_FORBIDDEN_PERMISSIONS[(role || '').toUpperCase()] || [];
  for (const k of forbidden) (merged as any)[k] = false;
  return merged;
}

function mergePermissions(
  role?: string | null,
  customPermissionsJson?: string | null
): UserPermissions {
  const normRole = (role || 'USER').toUpperCase();
  const base =
    ROLE_DEFINITIONS[normRole]?.defaultPermissions ||
    (normRole === 'ADMIN'
      ? ROLE_DEFINITIONS.ADMIN.defaultPermissions
      : normRole === 'TECHNICIEN'
      ? ROLE_DEFINITIONS.TECHNICIEN.defaultPermissions
      : ROLE_DEFINITIONS.CONDUCTEUR_TRAVAUX.defaultPermissions);

  if (!customPermissionsJson) return { ...base };
  try {
    const parsed = JSON.parse(customPermissionsJson);
    return { ...base, ...parsed };
  } catch {
    return { ...base };
  }
}

/**
 * Détecte si un utilisateur est strictement restreint à l'application mobile terrain.
 * S'applique si :
 * - Il a le rôle TECHNICIEN
 * - OU la permission mobileOnly est activée
 * - OU un nom de technicien lui est associé et il n'a aucun droit de gestion de bureau (Devis, Planning, Facturation, Admin)
 */
/** Droit de créer un devis (écrans) : même règle que le serveur — direction et chiffrage. */
export function canUserCreateDevis(user?: User | null): boolean {
  if (!user || isUserMobileOnly(user)) return false;
  const role = (user.role || '').toUpperCase();
  const perms = user.permissions || getEffectivePermissions(role, null);
  const isAdmin = user.id === 1 || role === 'ADMIN' || Boolean(perms.canManageUsers);
  return isAdmin || Boolean(perms.canEditDevis);
}

/** Droit de déposer / envoyer un rapport au client par lien sécurisé : même règle que le serveur (rapports.sendClient). */
export function canUserSendRapportClient(user?: User | null): boolean {
  if (!user || isUserMobileOnly(user)) return false;
  const role = (user.role || '').toUpperCase();
  const perms = user.permissions || getEffectivePermissions(role, null);
  const isAdmin = user.id === 1 || role === 'ADMIN' || Boolean(perms.canManageUsers);
  return isAdmin || Boolean(perms.canWriteReports || perms.canEditInterventions || perms.canManageBilling);
}

/**
 * Périmètre de chaque profil, en langage métier : ce qu'il valide, ce qu'il ne valide pas (et qui s'en charge).
 * Affiché dans « Mon travail » pour que chacun sache où s'arrête sa responsabilité.
 */
export type EspaceRole = 'direction' | 'chiffrage' | 'travaux' | 'rapports' | 'terrain';

export const ROLE_PERIMETRE: Record<
  EspaceRole,
  { titre: string; vousValidez: string[]; horsPerimetre: string[] }
> = {
  direction: {
    titre: 'Direction',
    vousValidez: [
      'Les demandes entrantes (accepter, refuser, orienter)',
      'Les rapports terminés avant facturation',
      'La facturation et la rentabilité',
      'Les comptes, les droits et les paramètres de la société',
    ],
    horsPerimetre: ['Le détail du terrain : les techniciens renseignent eux-mêmes leurs missions'],
  },
  chiffrage: {
    titre: 'Chargé d’études — chiffrage',
    vousValidez: [
      'Le chiffrage des devis (montants, validité) et leur envoi au client',
      'Les visites de chiffrage et leurs relevés',
      'La transformation d’un devis accepté en intervention',
    ],
    horsPerimetre: [
      'L’exécution des travaux et le planning des équipes → planificateur',
      'Les rapports de fin d’intervention → rapports',
      'La facturation → rapports et facturation / direction',
      'Les comptes et les droits → direction',
    ],
  },
  travaux: {
    titre: 'Planificateur',
    vousValidez: [
      'La planification et l’affectation des techniciens',
      'Le déblocage des interventions en retard ou suspendues',
      'La clôture d’une intervention terminée',
    ],
    horsPerimetre: [
      'Le chiffrage et les montants des devis → chargé d’études',
      'La facturation → rapports et facturation / direction',
      'Les comptes et les droits → direction',
    ],
  },
  rapports: {
    titre: 'Rapports et facturation',
    vousValidez: [
      'Les rapports terminés (relecture puis clôture)',
      'Le numéro et le statut de facture des interventions clôturées',
    ],
    horsPerimetre: [
      'Le planning, les dates et les techniciens → planificateur',
      'Les devis et le chiffrage → chargé d’études',
      'Les comptes et les droits → direction',
    ],
  },
  terrain: {
    titre: 'Technicien',
    vousValidez: [
      'L’avancement de vos missions : arrivée, fin, compte rendu et photos',
      'Vos relevés de visite de chiffrage',
    ],
    horsPerimetre: [
      'Les montants, la facturation et les devis',
      'Le planning des autres équipes',
      'La clôture des interventions → planificateur / rapports',
    ],
  },
};

/** Profil d'espace de travail d'un utilisateur (déduit de son rôle, puis de ses droits). */
export function espaceRoleOf(user?: User | null): EspaceRole {
  if (!user) return 'terrain';
  const role = (user.role || '').toUpperCase();
  const perms = user.permissions || getEffectivePermissions(role, null);
  const isAdmin = user.id === 1 || role === 'ADMIN' || Boolean(perms.canManageUsers);
  if (isAdmin) return 'direction';
  if (isUserMobileOnly(user) || role === 'TECHNICIEN') return 'terrain';
  switch (role) {
    case 'CHIFFRAGE_DEVIS':
      return 'chiffrage';
    case 'CONDUCTEUR_TRAVAUX':
      return 'travaux';
    case 'REDACTEUR_RAPPORTS':
      return 'rapports';
    default:
      return 'terrain';
  }
}

/** Droit de créer une intervention (écrans) : même règle que le serveur — direction, planificateur, chargé d'études. */
export function canUserCreateIntervention(user?: User | null): boolean {
  if (!user || isUserMobileOnly(user)) return false;
  const role = (user.role || '').toUpperCase();
  const perms = user.permissions || getEffectivePermissions(role, null);
  const isAdmin = user.id === 1 || role === 'ADMIN' || Boolean(perms.canManageUsers);
  return isAdmin || Boolean(perms.canEditPlanning);
}

/** Droit de valider / clôturer un rapport (écrans) : direction, planificateur, rapports. */
export function canUserCloseIntervention(user?: User | null): boolean {
  if (!user || isUserMobileOnly(user)) return false;
  const role = (user.role || '').toUpperCase();
  const perms = user.permissions || getEffectivePermissions(role, null);
  const isAdmin = user.id === 1 || role === 'ADMIN' || Boolean(perms.canManageUsers);
  return isAdmin || Boolean(perms.canEditInterventions) || Boolean(perms.canWriteReports);
}

export function isUserMobileOnly(user?: User | null): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const perms = user.permissions || getEffectivePermissions(role, null);
  const isAdmin = user.id === 1 || role === 'ADMIN' || Boolean(perms.canManageUsers);
  if (isAdmin) return false;

  if (role === 'TECHNICIEN' || Boolean(perms.mobileOnly)) return true;

  // Utilisateur lié à un profil technicien terrain sans droits d'administration de bureau
  if (
    Boolean(user.technicienNom) &&
    !perms.canEditDevis &&
    !perms.canManageBilling &&
    !perms.canEditPlanning &&
    !perms.canManageReferentiels
  ) {
    return true;
  }

  return false;
}

/**
 * Vérifie de façon étanche si un collaborateur a le droit d'accéder à un service / module métier.
 * Chaque service est strictement cloisonné selon les permissions attribuées.
 */
export function canUserAccessSection(
  section: string,
  user?: User | null
): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const perms = user.permissions || getEffectivePermissions(role, null);
  const isAdmin = user.id === 1 || role === 'ADMIN' || Boolean(perms.canManageUsers);

  // Un utilisateur mobile-only (Technicien terrain) n'a accès QU'À l'espace mobile
  if (isUserMobileOnly(user)) {
    return section === 'mobile_tech';
  }

  if (isAdmin) return true;

  switch (section) {
    case 'mobile_tech':
      // Espace terrain : réservé aux profils qui ont le droit « Accès mobile terrain » (plus d'accès universel)
      return Boolean(perms.canAccessMobileTech);

    case 'admin':
      return Boolean(perms.canManageUsers);

    case 'referentiels':
      return Boolean(perms.canManageReferentiels);

    case 'demandes':
      // La file d'entrée est triée par la direction, le chiffrage et le planificateur (même règle que le serveur)
      return Boolean(perms.canEditDevis) || Boolean(perms.canEditPlanning);

    case 'devis':
      // Chiffrage : tout le pipeline ; planificateur : les devis acceptés à transformer en intervention (lecture)
      return Boolean(perms.canEditDevis) || Boolean(perms.canConvertDevis);

    case 'planning':
      return Boolean(perms.canEditPlanning);

    case 'interventions':
      // Le chiffrage lit (sans modifier) les interventions rattachées à ses devis
      return (
        Boolean(perms.canEditInterventions) ||
        Boolean(perms.canWriteReports) ||
        (role === 'CHIFFRAGE_DEVIS' && Boolean(perms.canEditDevis))
      );

    case 'carte':
      // La carte sert à planifier : chiffrage (visites) et planificateur, pas aux rapports ni à la facturation
      return Boolean(perms.canEditPlanning);

    case 'facturation':
      return Boolean(perms.canManageBilling);

    case 'rentabilite':
      // Rentabilité et coûts d'équipe : direction uniquement (décision validée)
      return false;

    case 'clients':
      return Boolean(perms.canEditDevis) || Boolean(perms.canManageBilling) || Boolean(perms.canEditInterventions);

    case 'aujourdhui':
      // Chaque profil de bureau a son espace « Mon travail » (file, validations, périmètre)
      return (
        Boolean(perms.canEditPlanning) ||
        Boolean(perms.canEditDevis) ||
        Boolean(perms.canConvertDevis) ||
        Boolean(perms.canEditInterventions) ||
        Boolean(perms.canWriteReports) ||
        Boolean(perms.canManageBilling)
      );

    default:
      return false;
  }
}

/**
 * Retourne le premier service autorisé pour rediriger proprement l'utilisateur
 */
export function getDefaultAuthorizedSection(user?: User | null): string {
  if (isUserMobileOnly(user)) return 'mobile_tech';

  const order = [
    'aujourdhui',
    'planning',
    'devis',
    'interventions',
    'carte',
    'facturation',
    'rentabilite',
    'clients',
    'referentiels',
    'admin',
    'mobile_tech',
  ];

  for (const sec of order) {
    if (canUserAccessSection(sec, user)) return sec;
  }

  return 'mobile_tech';
}

export const ACTIONS_PREREMPLIES_TERRAIN: Record<string, string[]> = {
  'Visite Devis & Chiffrage': [
    'Relevé dimensionnel & métrés complets effectués',
    'Photos de l’existant et des accès jointes',
    'Vérification de la faisabilité technique validée',
    'Chiffrage matériel spécifique listé en observation',
    'Nécessite nacelle / échafaudage / accès spécifique',
    'Présence client / gardien sur site lors de la visite',
  ],
  Électricité: [
    'Consignation & mise en sécurité électrique effectuée',
    'Diagnostic de panne & recherche de défaut d’isolement',
    'Remplacement disjoncteur / appareillage tableau',
    'Tirage de câbles & raccordement appareillage',
    'Remplacement luminaire / BAES / éclairage',
    'Essais sous tension & contrôle de bon fonctionnement OK',
  ],
  'Plomberie / CVC / Chauffage': [
    'Coupure d’eau & mise hors d’eau effectuée',
    'Recherche de fuite destructive / non destructive réalisée',
    'Réparation de fuite sur canalisation / raccord',
    'Dégorgement & curage canalisation effectué',
    'Remplacement robinetterie / mécanisme / ballon ECS',
    'Contrôle pression, étanchéité & remise en eau OK',
  ],
  'Serrurerie / Menuiserie / TCE': [
    'Ouverture / sécurisation provisoire de porte ou accès',
    'Remplacement cylindre / serrure / ferme-porte',
    'Réglage huisserie, gonds et alignement menuiserie',
    'Reprise enduit / peinture / finition propre',
    'Nettoyage de la zone d’intervention & évacuation gravats',
    'Validation sur place avec l’occupant / gardien',
  ],
  'Suivi & Suites à donner': [
    'Intervention terminée à 100% — Sans réserve',
    'Mise en sécurité effectuée — Devis complémentaire à établir',
    'En attente de pièce spécifique à commander',
    'Accès impossible / Occupant absent (Avis de passage)',
  ],
};
