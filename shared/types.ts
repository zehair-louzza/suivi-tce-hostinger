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
  'En préparation',
  'À valider en interne',
  'Envoyé au client',
  'En négociation',
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
  'Mise en conformité',
  'Planifiée',
  'Non planifiée',
  'Urgente',
] as const;

export const MODES_PLANIFICATION = [
  'Planifiée',
  'Non planifiée',
] as const;

export const STATUTS_OPERATIONNELS_INTERVENTION = [
  'Nouvelle demande',
  'À planifier',
  'Planifiée',
  'Affectée',
  'En route',
  'Sur site',
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

export interface ReferentielsMap {
  clients: string[];
  corps_etat: string[];
  origines: string[];
  responsables: string[];
  techniciens: string[];
  motifs_blocage: string[];
  resultats_techniques: string[];
  technicien_competences?: Record<string, string[]>;
}

export const DEFAULT_REFERENTIELS: ReferentielsMap = {
  clients: [...DEFAULT_CLIENTS],
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

function addDaysISO(dateISO: string, days: number): string {
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
  validiteJours: z.number().int().positive().optional().nullable(),
  prochaineAction: z.string().max(150).optional().nullable(),
  dateRelance: z.string().optional().nullable(),
  responsable: z.string().max(100).optional().nullable(),
  priorite: z.string().default('Normale'),
  refInterventionTexte: z.string().max(150).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  visiteNecessaire: z.boolean().optional().default(false),
  visiteTechnicien: z.string().max(100).optional().nullable(),
  visiteDate: z.string().optional().nullable(),
  visiteHeureDebut: z.string().max(10).optional().nullable(),
  visiteHeureFin: z.string().max(10).optional().nullable(),
  visiteStatut: z.string().max(50).optional().nullable(),
  historique: z.array(z.any()).optional(),
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional(),
});

export const InterventionSchema = z.object({
  id: z.number().int().positive().optional(),
  reference: z.string().max(100).optional().nullable(),
  refDevisTexte: z.string().max(100).optional().nullable(),
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
  heureDebut: z.string().max(10).optional().nullable(),
  heureFin: z.string().max(10).optional().nullable(),
  heureDebutReelle: z.string().max(10).optional().nullable(),
  heureFinReelle: z.string().max(10).optional().nullable(),
  actionsRealisees: z.array(z.string()).optional(),
  photos: z.array(z.any()).optional(),
  elementsChiffrage: z.string().max(4000).optional().nullable(),
  rapportFinal: z.string().max(8000).optional().nullable(),
  statutRapport: z.string().max(80).optional().nullable(),
  isVisiteDevis: z.boolean().optional().default(false),
  origineDevisId: z.number().int().positive().optional().nullable(),
  origineDevisClient: z.string().max(200).optional().nullable(),
  origineDevisDate: z.string().optional().nullable(),
  devisId: z.number().int().positive().optional().nullable(),
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

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRoleCode | string;
  technicienNom?: string | null;
  permissions?: UserPermissions;
  active?: boolean;
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
  const map = competencesMap || DEFAULT_TECHNICIEN_COMPETENCES;
  const reqNorm = normalizeSkillToken(requiredTrade);
  const isGeneric =
    !reqNorm ||
    reqNorm.includes('tous corps') ||
    reqNorm === 'visite devis' ||
    reqNorm === 'intervention';

  const evaluated = techniciens.map((tech) => {
    const rawSkills = Array.isArray(map[tech])
      ? map[tech].filter(Boolean)
      : DEFAULT_TECHNICIEN_COMPETENCES[tech] || [];
    const normSkills = rawSkills.map(normalizeSkillToken);
    const hasWildcard = normSkills.some((k) => k.includes('tous corps'));
    const hasDirectSkill =
      !isGeneric &&
      normSkills.some((k) => k === reqNorm || k.includes(reqNorm) || reqNorm.includes(k));

    const specificSkills = rawSkills.filter((k) => !normalizeSkillToken(k).includes('tous corps'));
    const skillCount = rawSkills.length;
    const effectiveSkillCount = hasWildcard
      ? Math.max(15, specificSkills.length + 10)
      : Math.max(1, specificSkills.length || rawSkills.length || 99);

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
    label: 'Super-Administrateur / Direction',
    badgeColor: '#dc2626',
    summary:
      'Contrôle intégral : gestion des utilisateurs et permissions, référentiels, compétences métier, chiffrage devis HT, planning Gantt, rapports et facturation.',
    keyResponsibilities: [
      'Créer et désigner les utilisateurs avec attribution granulaire des droits de modification',
      'Configurer les compétences métier des techniciens et les référentiels ANELEC',
      'Superviser les pointages journaliers (arrivée bureau matin / fin dernière intervention soir)',
      'Valider et modifier sans restriction les Devis (22 col.), Interventions (23 col.), Rapports et Factures',
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
    label: 'Chargé d’Études & Chiffrage Devis',
    badgeColor: '#2563eb',
    summary:
      'Spécialiste du pipeline Devis et du chiffrage : exploite les relevés techniques, métrés et photos des visites techniciens pour chiffrer et convertir les devis.',
    keyResponsibilities: [
      'Créer, chiffrer (Montants HT, validité) et suivre les relances des Devis (22 colonnes)',
      'Déclencher des demandes de Visite Technique Devis et consulter les éléments de chiffrage & photos terrain',
      'Convertir les Devis acceptés en Interventions opérationnelles',
      'Consulter le planning pour coordonner les visites de chiffrage',
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
    label: 'Conducteur de Travaux / Dispatcher',
    badgeColor: '#7c3aed',
    summary:
      'Pilote opérationnel du Planning Gantt et des équipes terrain : affecte les missions selon les compétences, suit les pointages et débloque les chantiers.',
    keyResponsibilities: [
      'Gérer le Planning Gantt, l’auto-planification par moindre compétence et la Bourse de Dispatch',
      'Créer et modifier les fiches Interventions (23 colonnes), affecter les techniciens et gérer les urgences',
      'Suivre en direct l’activation/désactivation des missions et les pointages matin/soir des techniciens',
      'Valider techniquement les travaux réalisés avant rédaction du rapport final',
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
    label: 'Chargé de Rapports, Qualité & Facturation',
    badgeColor: '#059669',
    summary:
      'Exploite les déclarations terrain des techniciens (comptes rendus, actions pré-remplies, photos, horaires réels) pour rédiger les rapports officiels et facturer.',
    keyResponsibilities: [
      'Réceptionner les déclarations terrain des techniciens (actions cochées, observations, photos Avant/Après)',
      'Rédiger, mettre en forme et valider le Rapport Final d’Intervention pour le client / donneur d’ordre',
      'Clôturer les interventions validées et renseigner le numéro et statut de Facturation',
      'Contrôler la complétude documentaire (photos, résultat technique, levée de réserves)',
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
    label: 'Technicien Terrain (App Mobile Dédiée)',
    badgeColor: '#d97706',
    summary:
      'Interface mobile dédiée : pointage arrivée bureau matin / fin de journée soir, activation/désactivation des interventions & visites devis, actions pré-remplies et photos.',
    keyResponsibilities: [
      'Activer son heure d’arrivée au bureau chaque matin et désactiver sa journée le soir après la dernière intervention',
      'Activer (Démarrer) et Désactiver (Terminer) chaque intervention ou visite de devis en temps réel',
      'Remplir les petits comptes rendus avec actions pré-remplies en 1 clic + éléments utiles au chiffrage',
      'Prendre ou joindre des photos (Avant / Après / Relevé pour devis) directement depuis son smartphone',
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

export function getEffectivePermissions(
  role?: string | null,
  customPermissionsJson?: string | null
): UserPermissions {
  const normRole = (role || 'USER').toUpperCase();
  const base =
    ROLE_DEFINITIONS[normRole]?.defaultPermissions ||
    (normRole === 'ADMIN'
      ? ROLE_DEFINITIONS.ADMIN.defaultPermissions
      : ROLE_DEFINITIONS.CONDUCTEUR_TRAVAUX.defaultPermissions);

  if (!customPermissionsJson) return { ...base };
  try {
    const parsed = JSON.parse(customPermissionsJson);
    return { ...base, ...parsed };
  } catch {
    return { ...base };
  }
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
