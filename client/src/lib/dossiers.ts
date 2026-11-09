import type { Devis, Intervention } from './api';

/** Cohérence devis ↔ interventions ↔ comptabilité : toutes les règles de calcul au même endroit. */

const low = (s?: string | null) => (s || '').trim().toLowerCase();
export const normDI = (s?: string | null) => String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Une visite de chiffrage n'est pas du chiffre d'affaires. */
export function isVisite(i: Intervention): boolean {
  return Boolean(i.isVisiteDevis) || low(i.typeIntervention) === 'visite technique devis';
}
export function isCancelled(i: Intervention): boolean {
  return low(i.statutOperationnel).startsWith('annul');
}
/** Terminée (à valider) ou clôturée. */
export function isDone(i: Intervention): boolean {
  const s = low(i.statutOperationnel);
  return s.startsWith('clôtur') || s.startsWith('cloutur') || s.startsWith('terminée') || s.startsWith('terminee');
}
export function isBilled(i: Intervention): boolean {
  return low(i.statutFacture).startsWith('factur') && !low(i.statutFacture).startsWith('non');
}
/** Intervention comptabilisée dans le CA : travaux terminés, hors visites et annulations. */
export function isRevenue(i: Intervention): boolean {
  return !isVisite(i) && !isCancelled(i) && isDone(i);
}

function minutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
function span(a?: string | null, b?: string | null): number | null {
  const x = minutes(a);
  const y = minutes(b);
  if (x === null || y === null || y <= x) return null;
  return (y - x) / 60;
}

/** Heures réelles pointées, à défaut le créneau planifié ; 0 si aucun horaire n'est renseigné. */
export function hoursOf(i: Intervention): { hours: number; source: 'reel' | 'prevu' | 'aucun' } {
  const real = span(i.heureDebutReelle, i.heureFinReelle);
  if (real !== null) return { hours: real, source: 'reel' };
  const planned = span(i.heureDebut, i.heureFin);
  if (planned !== null) return { hours: planned, source: 'prevu' };
  return { hours: 0, source: 'aucun' };
}
export function plannedHours(i: Intervention): number {
  return span(i.heureDebut, i.heureFin) ?? 0;
}

export function dayOf(i: Intervention): string {
  return String(i.dateReelle || i.datePlanifiee || i.dateDemande || '').slice(0, 10);
}

export type Period = 'week' | 'month' | 'all';
export function inPeriod(day: string, period: Period, now = new Date()): boolean {
  if (period === 'all') return true;
  if (!day) return false;
  if (period === 'month') return day.slice(0, 7) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const d = new Date(day + 'T00:00:00');
  const diff = (now.getTime() - d.getTime()) / 86400000;
  return diff >= 0 && diff <= 7;
}

export interface LedgerContext {
  devisById: Map<number, Devis>;
  devisByDI: Map<string, Devis>;
  revenueCountByDevis: Map<number, number>;
}

export function buildLedgerContext(devisList: Devis[], interventionsList: Intervention[]): LedgerContext {
  const devisById = new Map<number, Devis>();
  const devisByDI = new Map<string, Devis>();
  [...devisList].sort((a, b) => (a.id || 0) - (b.id || 0)).forEach((d) => {
    if (d.id) devisById.set(d.id, d);
    const k = normDI(d.numeroDI);
    if (k) devisByDI.set(k, d); // le plus récent l'emporte, comme côté serveur
  });
  const ctx: LedgerContext = { devisById, devisByDI, revenueCountByDevis: new Map() };
  interventionsList.forEach((i) => {
    if (isVisite(i) || isCancelled(i)) return;
    const d = linkedDevis(i, ctx);
    if (d?.id) ctx.revenueCountByDevis.set(d.id, (ctx.revenueCountByDevis.get(d.id) || 0) + 1);
  });
  return ctx;
}

export function linkedDevis(i: Intervention, ctx: LedgerContext): Devis | undefined {
  const id = i.devisId || i.origineDevisId;
  if (id && ctx.devisById.has(id)) return ctx.devisById.get(id);
  const k = normDI(i.numeroDI);
  return k ? ctx.devisByDI.get(k) : undefined;
}

/** Montant HT d'une intervention : son montant, sinon celui du devis si elle en est l'unique intervention de travaux. */
export function amountOf(i: Intervention, ctx: LedgerContext): number {
  const own = Number(i.amount) || 0;
  if (own > 0) return own;
  if (isVisite(i)) return 0;
  const d = linkedDevis(i, ctx);
  if (d?.id && ctx.revenueCountByDevis.get(d.id) === 1) return Number(d.amount) || 0;
  return 0;
}

export interface Dossier {
  key: string;
  di: string;
  client: string;
  devis?: Devis;
  devisMontant: number;
  travaux: Intervention[];
  visites: Intervention[];
  caRealise: number;
  facture: number;
  resteAFacturer: number;
  anomalies: string[];
}

const TOL = 0.5;

export function buildDossiers(devisList: Devis[], interventionsList: Intervention[], ctx = buildLedgerContext(devisList, interventionsList)): Dossier[] {
  const groups = new Map<string, Dossier>();
  const get = (key: string, init: () => Dossier) => {
    let g = groups.get(key);
    if (!g) {
      g = init();
      groups.set(key, g);
    }
    return g;
  };

  devisList.forEach((d) => {
    get(`D${d.id}`, () => ({
      key: `D${d.id}`, di: normDI(d.numeroDI), client: d.client || '—', devis: d, devisMontant: Number(d.amount) || 0,
      travaux: [], visites: [], caRealise: 0, facture: 0, resteAFacturer: 0, anomalies: [],
    }));
  });

  interventionsList.forEach((i) => {
    if (isCancelled(i)) return;
    const d = linkedDevis(i, ctx);
    const di = normDI(i.numeroDI);
    const key = d ? `D${d.id}` : di ? `DI:${di}` : `I${i.id}`;
    const g = get(key, () => ({
      key, di, client: i.client || '—', devis: undefined, devisMontant: 0,
      travaux: [], visites: [], caRealise: 0, facture: 0, resteAFacturer: 0, anomalies: [],
    }));
    if (!g.di && di) g.di = di;
    (isVisite(i) ? g.visites : g.travaux).push(i);
  });

  const list = Array.from(groups.values());
  const diCount = new Map<string, number>();
  devisList.forEach((d) => {
    const k = normDI(d.numeroDI);
    if (k) diCount.set(k, (diCount.get(k) || 0) + 1);
  });

  list.forEach((g) => {
    g.travaux.forEach((i) => {
      if (!isDone(i)) return;
      const amt = amountOf(i, ctx);
      g.caRealise += amt;
      if (isBilled(i)) g.facture += amt;
    });
    g.resteAFacturer = Math.max(0, g.caRealise - g.facture);

    const a = g.anomalies;
    if (g.devis && !g.di) a.push('Devis sans numéro de DI');
    if (!g.devis && g.travaux.length + g.visites.length > 0 && !g.di) a.push('Intervention sans DI ni devis');
    if (g.di && (diCount.get(g.di) || 0) > 1) a.push(`DI porté par ${diCount.get(g.di)} devis`);
    if (g.devis && low(g.devis.statutCommercial).startsWith('accept') && g.travaux.length === 0) a.push('Devis accepté sans intervention');
    const sommeTravaux = g.travaux.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    if (g.devis && g.devisMontant > 0 && sommeTravaux > g.devisMontant + TOL) a.push('Interventions supérieures au montant du devis');
    if (g.travaux.some((i) => isDone(i) && amountOf(i, ctx) <= 0)) a.push('Intervention terminée sans montant');
  });

  return list
    .filter((g) => g.devis || g.travaux.length || g.visites.length)
    .sort((x, y) => y.anomalies.length - x.anomalies.length || (y.devis?.id || 0) - (x.devis?.id || 0));
}
