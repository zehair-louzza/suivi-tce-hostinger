// Période du tableau de bord : un seul endroit qui dit ce qu'une période veut dire.
//
// Le sélecteur de période ne faisait que changer un libellé : aucune donnée n'était filtrée,
// et le sous-titre « Année 2026 » était écrit en dur. Ici, le libellé et le filtre viennent
// de la même source, donc ce qui est affiché correspond toujours à ce qui est compté.
import type { Devis, Intervention } from './api';

export type PeriodeId = 'today' | 'week' | 'month' | 'year' | 'all';

export const PERIODES: PeriodeId[] = ['today', 'week', 'month', 'year', 'all'];

const jour = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Libellé affiché, calculé sur la date réelle : aucune année écrite en dur. */
export function periodeLabel(id: PeriodeId, now = new Date()): string {
  switch (id) {
    case 'today':
      return 'Aujourd’hui';
    case 'week':
      return 'Cette semaine';
    case 'year':
      return `Année ${now.getFullYear()}`;
    case 'all':
      return 'Depuis le début';
    case 'month':
    default:
      try {
        return capitale(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now));
      } catch {
        return `${now.getMonth() + 1}/${now.getFullYear()}`;
      }
  }
}

export interface PeriodeRange {
  id: PeriodeId;
  /** premier jour inclus, au format AAAA-MM-JJ ; vide si la période est illimitée */
  debut: string;
  /** dernier jour inclus */
  fin: string;
}

/** Bornes de la période, en jours locaux. La semaine commence le lundi. */
export function periodeRange(id: PeriodeId, now = new Date()): PeriodeRange {
  const fin = jour(now);
  switch (id) {
    case 'today':
      return { id, debut: fin, fin };
    case 'week': {
      const d = new Date(now);
      const decalage = (d.getDay() + 6) % 7; // lundi = 0
      d.setDate(d.getDate() - decalage);
      return { id, debut: jour(d), fin };
    }
    case 'month':
      return { id, debut: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, fin };
    case 'year':
      return { id, debut: `${now.getFullYear()}-01-01`, fin };
    case 'all':
    default:
      return { id, debut: '', fin: '9999-12-31' };
  }
}

export function dansPeriode(date: string | null | undefined, r: PeriodeRange): boolean {
  if (r.id === 'all') return true;
  const d = String(date || '').slice(0, 10);
  if (!d) return false;
  return d >= r.debut && d <= r.fin;
}

/**
 * Date qui situe une intervention dans le temps : ce qui s'est réellement passé d'abord,
 * sinon ce qui est prévu.
 */
export const dateIntervention = (i: Intervention): string =>
  String(i.dateReelle || i.datePlanifiee || i.dateDemande || '').slice(0, 10);

/** Date qui situe un devis : son envoi, sinon sa création. */
export const dateDevis = (d: Devis): string =>
  String(d.dateEnvoi || d.dateCreated || '').slice(0, 10);

export const filtrerInterventions = (list: Intervention[], r: PeriodeRange): Intervention[] =>
  r.id === 'all' ? list : list.filter((i) => dansPeriode(dateIntervention(i), r));

export const filtrerDevis = (list: Devis[], r: PeriodeRange): Devis[] =>
  r.id === 'all' ? list : list.filter((d) => dansPeriode(dateDevis(d), r));
