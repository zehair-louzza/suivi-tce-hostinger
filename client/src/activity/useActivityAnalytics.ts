import { useMemo } from 'react';
import { Devis, Intervention } from '../lib/api';
import { ActivityDay } from './types';
import { addDays, businessToday, normalize } from './analytics';

export interface ActivityAnalyticsResult {
  days: ActivityDay[];
  issues: string[];
  loading: boolean;
  error?: string;
}

/**
 * Normalise une date brute en chaîne civile ISO YYYY-MM-DD
 */
export function extractCivilDate(raw?: number | string | Date | null): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Extrait la date d'acceptation effective d'un devis depuis son historique ou fallback
 */
export function extractAcceptanceDate(devis: Devis): { date: string; isRealDate: boolean } | null {
  // 1. Recherche dans l'historique d'un événement d'acceptation
  if (Array.isArray(devis.historique) && devis.historique.length > 0) {
    const acceptEvt = devis.historique.find((h: any) => {
      const act = String(h?.action || '').toLowerCase();
      const det = String(h?.details || '').toLowerCase();
      return act.includes('accept') || det.includes('accept');
    });
    if (acceptEvt?.date) {
      const parsed = extractCivilDate(acceptEvt.date);
      if (parsed) return { date: parsed, isRealDate: true };
    }
  }

  // 2. Fallback transparent documenté : date d'envoi ou date de création
  const fallback = extractCivilDate(devis.dateEnvoi) || extractCivilDate(devis.dateCreated);
  if (fallback) return { date: fallback, isRealDate: false };
  return null;
}

/**
 * Transforme les devis et interventions en série quotidienne ActivityDay[]
 * selon les règles comptables strictes de l'audit TCE
 */
export function computeActivityDays(
  interventionsList: Intervention[],
  devisList: Devis[]
): { days: ActivityDay[]; issues: string[] } {
  const issues: string[] = [];
  const dayBuckets = new Map<
    string,
    {
      invoicedCents: number;
      performedCents: number;
      quotedCents: number;
      acceptedCents: number;
      interventionIds: Set<number>;
      quoteIds: Set<number>;
    }
  >();

  const getOrCreateBucket = (date: string) => {
    let b = dayBuckets.get(date);
    if (!b) {
      b = {
        invoicedCents: 0,
        performedCents: 0,
        quotedCents: 0,
        acceptedCents: 0,
        interventionIds: new Set<number>(),
        quoteIds: new Set<number>(),
      };
      dayBuckets.set(date, b);
    }
    return b;
  };

  let estimatedAcceptanceDateCount = 0;
  let nonValuedInterventionsCount = 0;

  // 1. Traitement des Interventions
  // Déduplication préalable par ID pour éviter les doublons multi-techniciens
  const uniqueInterventions = new Map<number, Intervention>();
  for (const intv of interventionsList) {
    if (intv && typeof intv.id === 'number') {
      uniqueInterventions.set(intv.id, intv);
    }
  }

  for (const intv of uniqueInterventions.values()) {
    // Exclusion des interventions annulées
    if (intv.statutOperationnel === 'Annulée') continue;

    const opStatus = intv.statutOperationnel || '';
    const isCompleted = opStatus === 'Clôturée' || opStatus === 'Terminée - à valider';
    const isBilled = intv.statutFacture === 'Facturée';

    const intvAmountHT = typeof intv.amount === 'number' && Number.isFinite(intv.amount) && intv.amount >= 0
      ? intv.amount
      : 0;

    if (isCompleted && intvAmountHT === 0) {
      nonValuedInterventionsCount++;
    }

    const intvCents = Math.round(intvAmountHT * 100);

    // Date réelle ou date planifiée
    const perfDate = extractCivilDate(intv.dateReelle) || extractCivilDate(intv.datePlanifiee) || extractCivilDate(intv.dateDebut);

    // A. Interventions effectuées HT & Volume interventions
    if (isCompleted && perfDate) {
      const bucket = getOrCreateBucket(perfDate);
      bucket.performedCents += intvCents;
      bucket.interventionIds.add(intv.id);
    }

    // B. CA facturé HT (exclusivement factures effectives)
    if (isBilled) {
      const billDate = extractCivilDate(intv.dateReelle) || perfDate || extractCivilDate(intv.createdAt);
      if (billDate) {
        const bucket = getOrCreateBucket(billDate);
        bucket.invoicedCents += intvCents;
      }
    }
  }

  // 2. Traitement des Devis
  const uniqueDevis = new Map<number, Devis>();
  for (const devis of devisList) {
    if (devis && typeof devis.id === 'number') {
      uniqueDevis.set(devis.id, devis);
    }
  }

  for (const devis of uniqueDevis.values()) {
    const statutComm = devis.statutCommercial || 'À préparer';
    // Exclure les devis encore en préparation / brouillons non émis
    const isDraft = statutComm === 'À préparer' || statutComm === 'En préparation';
    const isIssued = !isDraft || Boolean(devis.dateEnvoi);

    const devisRawAmount = typeof devis.amount === 'number' ? devis.amount : 0;
    const devisAmountHT = Number.isFinite(devisRawAmount) && devisRawAmount >= 0 ? devisRawAmount : 0;
    const devisCents = Math.round(devisAmountHT * 100);

    const quoteDate = extractCivilDate(devis.dateEnvoi) || extractCivilDate(devis.dateCreated);

    // A. Devis émis HT & Volume devis
    if (isIssued && quoteDate) {
      const bucket = getOrCreateBucket(quoteDate);
      bucket.quotedCents += devisCents;
      bucket.quoteIds.add(devis.id);
    }

    // B. Devis acceptés HT
    const isAccepted = statutComm === 'Accepté' || statutComm === 'Validé client' || devis.status === 'traite';
    if (isAccepted) {
      const acceptRes = extractAcceptanceDate(devis);
      if (acceptRes) {
        if (!acceptRes.isRealDate) estimatedAcceptanceDateCount++;
        const bucket = getOrCreateBucket(acceptRes.date);
        bucket.acceptedCents += devisCents;
      }
    }
  }

  // Documenter la qualité des données et les règles d'intégrité
  if (estimatedAcceptanceDateCount > 0) {
    issues.push(
      `${estimatedAcceptanceDateCount} devis accepté(s) sans horodatage contradictoire : calés par date d'envoi/création.`
    );
  }
  if (nonValuedInterventionsCount > 0) {
    issues.push(
      `${nonValuedInterventionsCount} intervention(s) réalisée(s) à montant non valorisé (0 € HT).`
    );
  }
  issues.push(
    "CA facturé strictement adossé aux interventions ayant le statut 'Facturée' (hors devis et en-cours)."
  );
  issues.push(
    "Interventions multi-techniciens dédupliquées par identifiant unique au niveau des volumes globaux."
  );

  // 3. Transformation en tableau ActivityDay[]
  const rawDays: ActivityDay[] = [];
  const sortedDates = Array.from(dayBuckets.keys()).sort();

  if (sortedDates.length === 0) {
    // Si aucune date trouvée, générer une période de base jusqu'à aujourd'hui
    const today = businessToday();
    rawDays.push({
      date: today,
      invoiced: 0,
      performed: 0,
      quoted: 0,
      accepted: 0,
      interventions: 0,
      quotes: 0,
    });
  } else {
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
      const b = dayBuckets.get(date);
      rawDays.push({
        date,
        invoiced: b ? b.invoicedCents : 0,
        performed: b ? b.performedCents : 0,
        quoted: b ? b.quotedCents : 0,
        accepted: b ? b.acceptedCents : 0,
        interventions: b ? b.interventionIds.size : 0,
        quotes: b ? b.quoteIds.size : 0,
      });
    }
  }

  // Normaliser (garantit la validation structurelle de la série continue)
  const days = normalize(rawDays);

  return { days, issues };
}

/**
 * Hook React intégrant l'acquisition des données d'activité et de chiffre d'affaires
 */
export function useActivityAnalytics(
  interventionsList: Intervention[],
  devisList: Devis[],
  loading = false,
  error?: string
): ActivityAnalyticsResult {
  const result = useMemo(() => {
    if (loading) {
      return { days: [], issues: [], loading: true, error: undefined };
    }
    if (error) {
      return { days: [], issues: [], loading: false, error };
    }
    const computed = computeActivityDays(interventionsList, devisList);
    return {
      days: computed.days,
      issues: computed.issues,
      loading: false,
      error: undefined,
    };
  }, [interventionsList, devisList, loading, error]);

  return result;
}
