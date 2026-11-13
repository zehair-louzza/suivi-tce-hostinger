import { getCompanyName } from '../lib/companyHQ';
import { useState, useMemo } from 'react';
import {
  Devis,
  Intervention,
  formatCurrency,
  formatDateFR,
  computeDurationHours,
} from '../lib/api';
import { ActivityRevenueDashboard, useActivityAnalytics } from '../activity';
import toast from 'react-hot-toast';

interface RentabiliteKpiViewProps {
  interventionsList: Intervention[];
  devisList: Devis[];
  techniciens?: string[];
  onNavigateToPlanning?: () => void;
  onOpenInterventionDrawer?: (intervention: Intervention) => void;
}

function extractDateParts(rawDate?: any): { year: string; month: string; day: string } | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return {
      year: String(rawDate.getFullYear()),
      month: String(rawDate.getMonth() + 1).padStart(2, '0'),
      day: String(rawDate.getDate()).padStart(2, '0'),
    };
  }
  const s = String(rawDate).trim();
  if (!s) return null;
  if (/^\d{12,}$/.test(s)) {
    const d = new Date(Number(s));
    if (!isNaN(d.getTime())) {
      return {
        year: String(d.getFullYear()),
        month: String(d.getMonth() + 1).padStart(2, '0'),
        day: String(d.getDate()).padStart(2, '0'),
      };
    }
  }
  if (s.includes('-')) {
    const parts = s.slice(0, 10).split('-');
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        return { year: parts[0], month: parts[1].padStart(2, '0'), day: parts[2].padStart(2, '0') };
      }
      return { year: parts[2], month: parts[1].padStart(2, '0'), day: parts[0].padStart(2, '0') };
    }
  }
  if (s.includes('/')) {
    const parts = s.slice(0, 10).split('/');
    if (parts.length >= 3) {
      if (parts[2].length === 4) {
        return { year: parts[2], month: parts[1].padStart(2, '0'), day: parts[0].padStart(2, '0') };
      }
      return { year: parts[0], month: parts[1].padStart(2, '0'), day: parts[2].padStart(2, '0') };
    }
  }
  return null;
}

export interface TechPerformanceStats {
  technicien: string;
  totalInterventions: number;
  clotureesCount: number;
  enCoursCount: number;
  retardsCount: number;
  totalMontantHT: number;
  totalPlannedHours: number;
  totalRealHours: number;
  savedHours: number;
  hourlyRevenueHT: number; // € HT / heure réelle
  estimatedHourlyCost: number; // Coût horaire chargé (€/h)
  estimatedMarginHT: number; // CA - (Heures réelles * Coût)
  marginRate: number; // % Marge
  productivityRate: number; // (Heures prévues / Heures réelles) * 100
  photosCount: number;
  rapportsCount: number;
  specialites: string[];
  performanceBadge: { label: string; bg: string; color: string };
}

export interface EquipePerformanceStats {
  corpsEtat: string;
  techniciensCount: number;
  interventionsCount: number;
  clotureesCount: number;
  totalMontantHT: number;
  totalRealHours: number;
  hourlyRevenueHT: number;
  estimatedMarginHT: number;
  marginRate: number;
  partCA: number; // % du CA global
}

export function RentabiliteKpiView({
  interventionsList,
  devisList,
  techniciens = [],
  onNavigateToPlanning,
}: RentabiliteKpiViewProps) {
  // Période sélectionnée
  const [selectedPeriod, setSelectedPeriod] = useState<'ALL' | 'MONTH' | 'WEEK'>('ALL');
  // Filtre statut
  const [filterStatut, setFilterStatut] = useState<'ALL' | 'CLOTUREE'>('ALL');
  // Filtres Année et Mois
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  // Métrique du graphe en bâtonnets
  const [chartMetric, setChartMetric] = useState<'ca' | 'hours' | 'margin' | 'hourlyRevenue'>('ca');
  // Coût horaire moyen paramétrable (€/h chargé)
  const [hourlyCostParam, setHourlyCostParam] = useState<number>(35);
  // Tri du tableau des techniciens
  const [sortBy, setSortBy] = useState<'hourlyRevenue' | 'totalMontant' | 'margin' | 'productivity'>('hourlyRevenue');
  // Recherche
  const [searchQuery, setSearchQuery] = useState('');
  // Données analytiques consolidées Suivi d'Activité & CA
  const {
    days: activityDays,
    issues: activityIssues,
    loading: activityLoading,
    error: activityError,
  } = useActivityAnalytics(interventionsList, devisList);

  // Onglet vue active : Suivi Activité & CA, par Technicien ou par Équipe / Corps d'état
  const [activeViewTab, setActiveViewTab] = useState<'activite' | 'techniciens' | 'equipes'>('activite');

  const today = useMemo(() => new Date(), []);
  const currentMonthPrefix = useMemo(() => today.toISOString().slice(0, 7), [today]);

  // Liste des années disponibles
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const curYear = new Date().getFullYear();
    years.add(String(curYear));
    years.add(String(curYear - 1));
    interventionsList.forEach((intv) => {
      const parts = extractDateParts(
        intv.datePlanifiee ||
        intv.dateReelle ||
        intv.dateDebut ||
        intv.dateDemande ||
        (intv.createdAt ? String(intv.createdAt).slice(0, 10) : '')
      );
      if (parts?.year) years.add(parts.year);
    });
    return Array.from(years).sort().reverse();
  }, [interventionsList]);

  // Filtrage des interventions par période (Mois / Année / Statut)
  const periodFilteredInterventions = useMemo(() => {
    return interventionsList.filter((intv) => {
      if (filterStatut === 'CLOTUREE') {
        const statut = intv.statutOperationnel || '';
        if (statut !== 'Clôturée' && statut !== 'Terminée - à valider') return false;
      }

      if (filterYear !== 'ALL' || filterMonth !== 'ALL') {
        const parts = extractDateParts(
          intv.datePlanifiee ||
          intv.dateReelle ||
          intv.dateDebut ||
          intv.dateDemande ||
          (intv.createdAt ? String(intv.createdAt).slice(0, 10) : '')
        );
        if (!parts) return false;
        if (filterYear !== 'ALL' && parts.year !== filterYear) return false;
        if (filterMonth !== 'ALL' && parts.month !== filterMonth) return false;
      }

      if (selectedPeriod === 'MONTH') {
        const parts = extractDateParts(intv.datePlanifiee || intv.dateReelle);
        if (!parts || `${parts.year}-${parts.month}` !== currentMonthPrefix) return false;
      } else if (selectedPeriod === 'WEEK') {
        const rawDate = intv.datePlanifiee || intv.dateReelle;
        if (!rawDate) return false;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return false;
        const diffDays = Math.abs(today.getTime() - d.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }
      return true;
    });
  }, [interventionsList, filterStatut, filterYear, filterMonth, selectedPeriod, currentMonthPrefix, today]);

  // Agrégation des KPI par Technicien
  const techniciensStats = useMemo<TechPerformanceStats[]>(() => {
    // Liste de tous les techniciens connus (dans referentiels ou trouvés dans les interventions)
    const allTechNames = Array.from(
      new Set([
        ...techniciens,
        ...interventionsList.map((i) => i.entreprise || '').filter(Boolean),
      ])
    ).filter((t) => t !== 'Non affecté' && t !== 'Non assigné');

    return allTechNames.map((tech) => {
      const techIntvs = periodFilteredInterventions.filter(
        (i) => (i.entreprise || '').toLowerCase() === tech.toLowerCase()
      );

      const totalInterventions = techIntvs.length;
      const cloturees = techIntvs.filter(
        (i) => i.statutOperationnel === 'Clôturée' || i.statutOperationnel === 'Terminée - à valider'
      );
      const enCours = techIntvs.filter((i) => i.statutOperationnel === 'En cours');
      const retards = techIntvs.filter((i) => i.computed?.alerteDelai === 'En retard' || i.motifBlocage);

      // Calcul du Montant Total HT
      const totalMontantHT = techIntvs.reduce((acc, i) => {
        let amount = Number(i.amount) || 0;
        if (!amount && i.devisId) {
          const linked = devisList.find((d) => d.id === i.devisId);
          if (linked && Number(linked.amount) > 0) amount = Number(linked.amount);
        }
        return acc + amount;
      }, 0);

      // Heures prévues vs réelles
      let totalPlannedHours = 0;
      let totalRealHours = 0;

      techIntvs.forEach((i) => {
        const planH = computeDurationHours(i.heureDebut, i.heureFin) || 2;
        totalPlannedHours += planH;

        const realH = computeDurationHours(i.heureDebutReelle, i.heureFinReelle);
        if (realH && realH > 0) {
          totalRealHours += realH;
        } else if (i.statutOperationnel === 'Clôturée') {
          totalRealHours += planH; // estimation sur créneau prévu
        }
      });

      // Si pas d'heures réelles enregistrées mais interventions existantes
      if (totalRealHours === 0 && totalPlannedHours > 0) {
        totalRealHours = totalPlannedHours;
      }

      totalPlannedHours = Math.round(totalPlannedHours * 10) / 10;
      totalRealHours = Math.round(totalRealHours * 10) / 10;
      const savedHours = Math.round((totalPlannedHours - totalRealHours) * 10) / 10;

      // Rentabilité horaire (€ HT / heure réelle)
      const hourlyRevenueHT =
        totalRealHours > 0 ? Math.round(totalMontantHT / totalRealHours) : 0;

      // Marge brute estimée
      const totalCostMO = totalRealHours * hourlyCostParam;
      const estimatedMarginHT = Math.round((totalMontantHT - totalCostMO) * 100) / 100;
      const marginRate =
        totalMontantHT > 0 ? Math.round((estimatedMarginHT / totalMontantHT) * 100) : 0;

      // Taux de productivité
      const productivityRate =
        totalRealHours > 0 ? Math.round((totalPlannedHours / totalRealHours) * 100) : 100;

      // Dossiers photos et rapports
      const photosCount = techIntvs.reduce((acc, i) => acc + (Array.isArray(i.photos) ? i.photos.length : 0), 0);
      const rapportsCount = techIntvs.filter((i) => Boolean(i.rapportFinal || i.compteRendu)).length;

      // Corps d'état pratiqués
      const specialites = Array.from(new Set(techIntvs.map((i) => i.corpsEtat).filter(Boolean))) as string[];

      // Badge de performance basé sur le taux horaire produit
      let performanceBadge = {
        label: '• En progression',
        bg: 'rgba(59, 130, 246, 0.12)',
        color: '#2563eb',
      };
      if (hourlyRevenueHT >= 80) {
        performanceBadge = {
          label: 'Forte Rentabilité (≥80€/h)',
          bg: '#ecfdf5',
          color: '#047857',
        };
      } else if (hourlyRevenueHT >= 50) {
        performanceBadge = {
          label: '✓ Conforme au budget (50–80€/h)',
          bg: '#fffbeb',
          color: '#b45309',
        };
      } else if (totalInterventions > 0) {
        performanceBadge = {
          label: 'Vigilance Rentabilité (<50€/h)',
          bg: '#fef2f2',
          color: '#b91c1c',
        };
      }

      return {
        technicien: tech,
        totalInterventions,
        clotureesCount: cloturees.length,
        enCoursCount: enCours.length,
        retardsCount: retards.length,
        totalMontantHT,
        totalPlannedHours,
        totalRealHours,
        savedHours,
        hourlyRevenueHT,
        estimatedHourlyCost: hourlyCostParam,
        estimatedMarginHT,
        marginRate,
        productivityRate,
        photosCount,
        rapportsCount,
        specialites,
        performanceBadge,
      };
    });
  }, [techniciens, periodFilteredInterventions, interventionsList, devisList, hourlyCostParam]);

  // Agrégation par Équipe / Corps d'état
  const equipesStats = useMemo<EquipePerformanceStats[]>(() => {
    const totalGlobalCA = techniciensStats.reduce((acc, t) => acc + t.totalMontantHT, 0);
    const tradesMap: Record<string, {
      techs: Set<string>;
      interventionsCount: number;
      clotureesCount: number;
      totalMontantHT: number;
      totalRealHours: number;
    }> = {};

    periodFilteredInterventions.forEach((intv) => {
      const trade = intv.corpsEtat || 'Tous corps d’état';
      if (!tradesMap[trade]) {
        tradesMap[trade] = {
          techs: new Set(),
          interventionsCount: 0,
          clotureesCount: 0,
          totalMontantHT: 0,
          totalRealHours: 0,
        };
      }

      if (intv.entreprise) tradesMap[trade].techs.add(intv.entreprise);
      tradesMap[trade].interventionsCount += 1;
      if (intv.statutOperationnel === 'Clôturée' || intv.statutOperationnel === 'Terminée - à valider') {
        tradesMap[trade].clotureesCount += 1;
      }

      let amount = Number(intv.amount) || 0;
      if (!amount && intv.devisId) {
        const linked = devisList.find((d) => d.id === intv.devisId);
        if (linked) amount = Number(linked.amount) || 0;
      }
      tradesMap[trade].totalMontantHT += amount;

      const planH = computeDurationHours(intv.heureDebut, intv.heureFin) || 2;
      const realH = computeDurationHours(intv.heureDebutReelle, intv.heureFinReelle) || planH;
      tradesMap[trade].totalRealHours += realH;
    });

    return Object.entries(tradesMap).map(([trade, data]) => {
      const totalRealHours = Math.round(data.totalRealHours * 10) / 10;
      const hourlyRevenueHT =
        totalRealHours > 0 ? Math.round(data.totalMontantHT / totalRealHours) : 0;
      const costMO = totalRealHours * hourlyCostParam;
      const estimatedMarginHT = Math.round((data.totalMontantHT - costMO) * 100) / 100;
      const marginRate =
        data.totalMontantHT > 0 ? Math.round((estimatedMarginHT / data.totalMontantHT) * 100) : 0;
      const partCA =
        totalGlobalCA > 0 ? Math.round((data.totalMontantHT / totalGlobalCA) * 100) : 0;

      return {
        corpsEtat: trade,
        techniciensCount: data.techs.size,
        interventionsCount: data.interventionsCount,
        clotureesCount: data.clotureesCount,
        totalMontantHT: data.totalMontantHT,
        totalRealHours,
        hourlyRevenueHT,
        estimatedMarginHT,
        marginRate,
        partCA,
      };
    }).sort((a, b) => b.totalMontantHT - a.totalMontantHT);
  }, [periodFilteredInterventions, techniciensStats, devisList, hourlyCostParam]);

  // Tri et recherche des techniciens
  const filteredAndSortedTechniciens = useMemo(() => {
    let list = techniciensStats.filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.technicien.toLowerCase().includes(q) ||
        t.specialites.some((s) => s.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'hourlyRevenue') return b.hourlyRevenueHT - a.hourlyRevenueHT;
      if (sortBy === 'totalMontant') return b.totalMontantHT - a.totalMontantHT;
      if (sortBy === 'margin') return b.estimatedMarginHT - a.estimatedMarginHT;
      if (sortBy === 'productivity') return b.productivityRate - a.productivityRate;
      return 0;
    });

    return list;
  }, [techniciensStats, searchQuery, sortBy]);

  // Métriques globales pour le bandeau KPI supérieur
  const globalMetrics = useMemo(() => {
    const totalCA = techniciensStats.reduce((acc, t) => acc + t.totalMontantHT, 0);
    const totalPlannedHours = techniciensStats.reduce((acc, t) => acc + t.totalPlannedHours, 0);
    const totalRealHours = techniciensStats.reduce((acc, t) => acc + t.totalRealHours, 0);
    const totalCloturees = techniciensStats.reduce((acc, t) => acc + t.clotureesCount, 0);
    const totalInterventions = techniciensStats.reduce((acc, t) => acc + t.totalInterventions, 0);
    const globalHourlyRevenue =
      totalRealHours > 0 ? Math.round(totalCA / totalRealHours) : 0;
    const totalCost = totalRealHours * hourlyCostParam;
    const globalMargin = Math.round((totalCA - totalCost) * 100) / 100;
    const globalMarginRate = totalCA > 0 ? Math.round((globalMargin / totalCA) * 100) : 0;
    const globalProductivity =
      totalRealHours > 0 ? Math.round((totalPlannedHours / totalRealHours) * 100) : 100;

    // Top Performer
    const topPerformer = [...techniciensStats].sort((a, b) => b.hourlyRevenueHT - a.hourlyRevenueHT)[0] || null;

    return {
      totalCA,
      totalPlannedHours: Math.round(totalPlannedHours),
      totalRealHours: Math.round(totalRealHours),
      totalCloturees,
      totalInterventions,
      globalHourlyRevenue,
      globalMargin,
      globalMarginRate,
      globalProductivity,
      topPerformer,
    };
  }, [techniciensStats, hourlyCostParam]);

  // Copie d'un briefing exécutif dans le presse-papiers
  const handleCopyReport = () => {
    const lines = [
      `⊞ RAPPORT DE RENTABILITÉ & PERFORMANCE DES TECHNICIENS — ${getCompanyName().toUpperCase()}`,
      `Date : ${formatDateFR(today.toISOString().slice(0, 10))} • Base coût horaire : ${hourlyCostParam} €/h chargé`,
      `--------------------------------------------------------------------------`,
      `• Chiffre d'Affaires Produit Total : ${formatCurrency(globalMetrics.totalCA)} HT`,
      `• Heures Réelles Effectuées : ${globalMetrics.totalRealHours}h (Heures planifiées : ${globalMetrics.totalPlannedHours}h)`,
      `• Rentabilité Horaire Moyenne : ${globalMetrics.globalHourlyRevenue} € HT / heure`,
      `• Marge Brute Globale Estimée : ${formatCurrency(globalMetrics.globalMargin)} HT (${globalMetrics.globalMarginRate}%)`,
      `• Taux de Productivité Global : ${globalMetrics.globalProductivity}%`,
      `• Interventions Clôturées : ${globalMetrics.totalCloturees} / ${globalMetrics.totalInterventions}`,
      ``,
      `CLASSEMENT DES TECHNICIENS PAR RENTABILITÉ HORAIRE :`,
    ];

    filteredAndSortedTechniciens.forEach((t, idx) => {
      lines.push(
        `${idx + 1}. ${t.technicien.toUpperCase()} : ${t.hourlyRevenueHT} €/h | CA: ${formatCurrency(t.totalMontantHT)} HT | ${t.totalRealHours}h réelles | Marge: ${formatCurrency(t.estimatedMarginHT)} (${t.marginRate}%) | ${t.clotureesCount}/${t.totalInterventions} clôturées`
      );
    });

    lines.push('');
    lines.push('RENTABILITÉ PAR ÉQUIPE / CORPS D’ÉTAT :');
    equipesStats.forEach((eq) => {
      lines.push(
        `• ${eq.corpsEtat} : ${eq.hourlyRevenueHT} €/h | CA: ${formatCurrency(eq.totalMontantHT)} HT (${eq.partCA}% du total) | ${eq.totalRealHours}h | ${eq.techniciensCount} tech(s)`
      );
    });

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Rapport de rentabilité copié dans le presse-papiers !', { icon: '≡' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* =====================================================================
          COMMUTATEUR PRINCIPAL DU VOLET COMPTABILITÉ & ÉQUIPE
         ===================================================================== */}
      <div
        className="pro-table-container"
        style={{
          padding: '12px 18px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
        }}
      >
        <div className="segmented-control segmented-control-fluid" style={{ flex: '1 1 auto' }}>
          <button
            type="button"
            className={`segmented-btn ${activeViewTab === 'activite' ? 'active' : ''}`}
            onClick={() => setActiveViewTab('activite')}
          >
            <span className="desktop-only-el">↗ Suivi Activité & Chiffre d'Affaires (Sky & Ice)</span>
            <span className="mobile-only-flex">↗ Suivi Activité & CA</span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${activeViewTab === 'techniciens' ? 'active' : ''}`}
            onClick={() => setActiveViewTab('techniciens')}
          >
            <span className="desktop-only-el">Rentabilité par Technicien ({filteredAndSortedTechniciens.length})</span>
            <span className="mobile-only-flex">Techniciens ({filteredAndSortedTechniciens.length})</span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${activeViewTab === 'equipes' ? 'active' : ''}`}
            onClick={() => setActiveViewTab('equipes')}
          >
            <span className="desktop-only-el">Rentabilité par Équipe / Métier ({equipesStats.length})</span>
            <span className="mobile-only-flex">Équipes ({equipesStats.length})</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          VUE 1 : SUIVI DE L'ACTIVITÉ ET DU CHIFFRE D'AFFAIRES (SKY & ICE)
         ===================================================================== */}
      {activeViewTab === 'activite' && (
        <ActivityRevenueDashboard
          days={activityDays}
          issues={activityIssues}
          loading={activityLoading}
          error={activityError}
        />
      )}

      {/* =====================================================================
          VUES 2 & 3 : RENTABILITÉ DÉTAILLÉE PAR TECHNICIEN ET ÉQUIPES
         ===================================================================== */}
      {activeViewTab !== 'activite' && (
        <>
          {/* =====================================================================
              1. EN-TÊTE DE LA CONSOLE DE RENTABILITÉ & PERFORMANCE (STYLE VOLET 2)
             ===================================================================== */}
          <div className="pro-table-container" style={{ padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Rentabilité, Débits Horaires & Performance des Équipes
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Suivi consolidé des montants d'intervention, heures pointées, rentabilité horaire et marges brutes.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Filtre Statut Interventions */}
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${filterStatut === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterStatut('ALL')}
              >
                Toutes missions
              </button>
              <button
                type="button"
                className={`segmented-btn ${filterStatut === 'CLOTUREE' ? 'active' : ''}`}
                onClick={() => setFilterStatut('CLOTUREE')}
              >
                Clôturées uniquement
              </button>
            </div>

            {/* Filtre Période */}
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${selectedPeriod === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedPeriod('ALL')}
              >
                Historique Complet
              </button>
              <button
                type="button"
                className={`segmented-btn ${selectedPeriod === 'MONTH' ? 'active' : ''}`}
                onClick={() => setSelectedPeriod('MONTH')}
              >
                Ce Mois-ci
              </button>
              <button
                type="button"
                className={`segmented-btn ${selectedPeriod === 'WEEK' ? 'active' : ''}`}
                onClick={() => setSelectedPeriod('WEEK')}
              >
                7 Derniers Jours
              </button>
            </div>

            {/* Filtre Année & Mois */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                className="select"
                style={{ width: '120px', height: '32px', fontSize: '11.5px', padding: '2px 8px' }}
                value={filterYear}
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  setSelectedPeriod('ALL');
                }}
                title="Filtrer par Année"
              >
                <option value="ALL">Année (Toutes)</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <select
                className="select"
                style={{ width: '130px', height: '32px', fontSize: '11.5px', padding: '2px 8px' }}
                value={filterMonth}
                onChange={(e) => {
                  setFilterMonth(e.target.value);
                  setSelectedPeriod('ALL');
                }}
                title="Filtrer par Mois"
              >
                <option value="ALL">Mois (Tous)</option>
                <option value="01">01 - Janvier</option>
                <option value="02">02 - Février</option>
                <option value="03">03 - Mars</option>
                <option value="04">04 - Avril</option>
                <option value="05">05 - Mai</option>
                <option value="06">06 - Juin</option>
                <option value="07">07 - Juillet</option>
                <option value="08">08 - Août</option>
                <option value="09">09 - Septembre</option>
                <option value="10">10 - Octobre</option>
                <option value="11">11 - Novembre</option>
                <option value="12">12 - Décembre</option>
              </select>

              {(filterYear !== 'ALL' || filterMonth !== 'ALL') && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ height: '32px', padding: '2px 8px', fontSize: '11px', color: '#dc2626' }}
                  onClick={() => {
                    setFilterYear('ALL');
                    setFilterMonth('ALL');
                  }}
                  title="Réinitialiser filtres d'année et mois"
                >
                  ✕ Effacer date
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}
              onClick={handleCopyReport}
            >
              ≡ Copier Synthèse
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. BANDEAU DES KPIS STRATÉGIQUES DE RENTABILITÉ (STYLE VOLET 2)
         ===================================================================== */}
      <div className="kpi-strip">
        <div className="kpi-card" style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
              CA Total Produit
            </span>
            <span className="font-mono" style={{ fontSize: '10.5px', color: '#94a3b8' }}>
              Interventions
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
            {formatCurrency(globalMetrics.totalCA)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {globalMetrics.totalCloturees} clôturée(s) sur {globalMetrics.totalInterventions}
          </div>
        </div>

        <div className="kpi-card" style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
              Rentabilité Horaire
            </span>
            <span className="font-mono" style={{ fontSize: '10.5px', color: '#047857', fontWeight: 700 }}>
              Moyenne
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#047857', margin: '4px 0 2px' }}>
            {globalMetrics.globalHourlyRevenue} € / heure
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {globalMetrics.totalRealHours}h réelles pointées ({globalMetrics.totalPlannedHours}h prévues)
          </div>
        </div>

        <div className="kpi-card" style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
              Marge Brute Estimée
            </span>
            <span className="font-mono" style={{ fontSize: '10.5px', color: '#047857', fontWeight: 700 }}>
              {globalMetrics.globalMarginRate}%
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#047857', margin: '4px 0 2px' }}>
            {formatCurrency(globalMetrics.globalMargin)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Base coût : {hourlyCostParam} €/h
          </div>
        </div>

        <div className="kpi-card" style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
              Efficience / Délais
            </span>
            <span className="font-mono" style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>
              Ratio
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
            {globalMetrics.globalProductivity}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {globalMetrics.globalProductivity >= 100
              ? '✓ Respect des créneaux prévus'
              : 'Dépassement créneaux prévus'}
          </div>
        </div>

        <div className="kpi-card" style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
              Top Rentabilité
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(4, 120, 87, 0.1)', color: '#047857', padding: '1px 6px', borderRadius: '4px' }}>N°1</span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '4px 0 2px' }}>
            {globalMetrics.topPerformer?.technicien || 'Aucun'}
          </div>
          <div className="font-mono" style={{ fontSize: '11.5px', color: '#047857', fontWeight: 700 }}>
            {globalMetrics.topPerformer ? `${globalMetrics.topPerformer.hourlyRevenueHT} €/h (${formatCurrency(globalMetrics.topPerformer.totalMontantHT)})` : '—'}
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. SIMULATEUR DE COÛT HORAIRE & BARRE DE TRI / VUE
         ===================================================================== */}
      <div
        className="pro-table-container"
        style={{
          padding: '12px 18px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Commutateur de vue : Par Technicien vs Par Équipe / Métier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto' }}>
          <div className="segmented-control segmented-control-fluid" style={{ width: '100%' }}>
            <button
              type="button"
              className={`segmented-btn ${activeViewTab === 'techniciens' ? 'active' : ''}`}
              onClick={() => setActiveViewTab('techniciens')}
            >
              <span className="desktop-only-el">Rentabilité par Technicien ({filteredAndSortedTechniciens.length})</span>
              <span className="mobile-only-flex">Techniciens ({filteredAndSortedTechniciens.length})</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${activeViewTab === 'equipes' ? 'active' : ''}`}
              onClick={() => setActiveViewTab('equipes')}
            >
              <span className="desktop-only-el">Rentabilité par Équipe / Corps d'État ({equipesStats.length})</span>
              <span className="mobile-only-flex">Équipes ({equipesStats.length})</span>
            </button>
          </div>
        </div>

        {/* Simulateur / Réglage Coût Horaire Moyen Chargé */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
            ⊞ Coût Moyen Chargé :
          </span>
          <input
            type="range"
            min={20}
            max={70}
            step={1}
            value={hourlyCostParam}
            onChange={(e) => setHourlyCostParam(Number(e.target.value))}
            style={{ width: '100px', cursor: 'pointer', accentColor: '#00bf63' }}
          />
          <span className="font-mono" style={{ fontSize: '12px', fontWeight: 800, color: '#00bf63', minWidth: '46px' }}>
            {hourlyCostParam} €/h
          </span>
        </div>

        {/* Critère de Tri */}
        {activeViewTab === 'techniciens' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Trier par :
            </span>
            <select
              className="select font-mono"
              style={{ fontSize: '11px', height: '30px', padding: '2px 8px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="hourlyRevenue">▸ Rentabilité Horaire (€/h)</option>
              <option value="totalMontant">€ Chiffre d'Affaires HT</option>
              <option value="margin">↗ Marge Brute (€ HT)</option>
              <option value="productivity">Taux d'Efficience / Délais</option>
            </select>
          </div>
        )}

        <input
          type="text"
          className="input"
          style={{ width: '200px', fontSize: '11.5px', height: '30px' }}
          placeholder="Rechercher technicien..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* =====================================================================
          GRAPHE EN BÂTONNETS : PERFORMANCE & RENTABILITÉ DES TECHNICIENS
         ===================================================================== */}
      {activeViewTab === 'techniciens' && (
        <div
          className="pro-table-container"
          style={{
            padding: '16px 20px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                ⊞ Comparatif en Bâtonnets des Techniciens
                <span className="font-mono" style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                  ({filteredAndSortedTechniciens.length} technicien{filteredAndSortedTechniciens.length > 1 ? 's' : ''})
                </span>
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                Visualisation comparative directe de la production, du temps passé sur site et de la rentabilité.
              </p>
            </div>

            {/* Commutateur de métrique du graphe */}
            <div className="segmented-control" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`segmented-btn ${chartMetric === 'ca' ? 'active' : ''}`}
                onClick={() => setChartMetric('ca')}
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
              >
                € CA HT (€)
              </button>
              <button
                type="button"
                className={`segmented-btn ${chartMetric === 'hours' ? 'active' : ''}`}
                onClick={() => setChartMetric('hours')}
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
              >
                Heures Travaillées
              </button>
              <button
                type="button"
                className={`segmented-btn ${chartMetric === 'hourlyRevenue' ? 'active' : ''}`}
                onClick={() => setChartMetric('hourlyRevenue')}
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
              >
                ▸ Débit Horaire (€/h)
              </button>
              <button
                type="button"
                className={`segmented-btn ${chartMetric === 'margin' ? 'active' : ''}`}
                onClick={() => setChartMetric('margin')}
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
              >
                ↗ Marge Estimée (€)
              </button>
            </div>
          </div>

          {/* Visualisation en barres horizontales ultra lisible sur PC et mobile */}
          {filteredAndSortedTechniciens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
              Aucune donnée pour la période sélectionnée.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(() => {
                const getVal = (t: TechPerformanceStats) => {
                  if (chartMetric === 'ca') return t.totalMontantHT;
                  if (chartMetric === 'hours') return t.totalRealHours;
                  if (chartMetric === 'hourlyRevenue') return t.hourlyRevenueHT;
                  return Math.max(0, t.estimatedMarginHT);
                };
                const maxVal = Math.max(...filteredAndSortedTechniciens.map(getVal), 1);

                return filteredAndSortedTechniciens.map((tech, idx) => {
                  const val = getVal(tech);
                  const pct = Math.min(100, Math.max(5, Math.round((val / maxVal) * 100)));

                  let barColor = 'linear-gradient(90deg, #2563eb, #3b82f6)';
                  let formattedVal = '';
                  if (chartMetric === 'ca') {
                    barColor = 'linear-gradient(90deg, #0284c7, #38bdf8)';
                    formattedVal = `${formatCurrency(tech.totalMontantHT)} HT`;
                  } else if (chartMetric === 'hours') {
                    barColor = 'linear-gradient(90deg, #7c3aed, #a855f7)';
                    formattedVal = `${tech.totalRealHours}h réelles (${tech.totalPlannedHours}h prévues)`;
                  } else if (chartMetric === 'hourlyRevenue') {
                    barColor = tech.hourlyRevenueHT >= 65
                      ? 'linear-gradient(90deg, #059669, #10b981)'
                      : 'linear-gradient(90deg, #f59e0b, #fbbf24)';
                    formattedVal = `${tech.hourlyRevenueHT} € HT / heure`;
                  } else {
                    barColor = tech.estimatedMarginHT >= 0
                      ? 'linear-gradient(90deg, #059669, #34d399)'
                      : 'linear-gradient(90deg, #dc2626, #f87171)';
                    formattedVal = `${formatCurrency(tech.estimatedMarginHT)} HT (${tech.marginRate}%)`;
                  }

                  return (
                    <div
                      key={tech.technicien}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: idx === 0 ? 'var(--color-warning-soft, #fef3c7)' : 'var(--bg-surface)',
                              color: idx === 0 ? '#b45309' : 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10.5px',
                              fontWeight: 800,
                            }}
                          >
                            {idx + 1}
                          </span>
                          {tech.technicien}
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                            • {tech.clotureesCount} mission{tech.clotureesCount > 1 ? 's' : ''} clôturée{tech.clotureesCount > 1 ? 's' : ''}
                          </span>
                        </span>

                        <span className="font-mono" style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '12.5px' }}>
                          {formattedVal}
                        </span>
                      </div>

                      {/* Barre en bâtonnet */}
                      <div
                        style={{
                          width: '100%',
                          height: '14px',
                          background: 'var(--border-subtle)',
                          borderRadius: '999px',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: barColor,
                            borderRadius: '999px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. VUE A : TABLEAU COMPARATIF DÉTAILLÉ PAR TECHNICIEN
         ===================================================================== */}
      {activeViewTab === 'techniciens' && (
        <>
          <div className="desktop-only-block pro-table-container">
          <table className="pro-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>Rang</th>
                <th style={{ minWidth: '150px', maxWidth: '200px' }}>Technicien & Spécialités</th>
                <th style={{ width: '115px' }}>Interventions</th>
                <th style={{ width: '150px' }}>Durée Prévue vs Réelle</th>
                <th style={{ width: '115px' }}>CA Produit HT</th>
                <th style={{ width: '155px' }}>Rentabilité Horaire (€/h)</th>
                <th style={{ width: '140px' }}>Marge Brute Estimée</th>
                <th style={{ width: '110px' }}>Preuves & Qualité</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTechniciens.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                    Aucun technicien ne correspond aux filtres appliqués.
                  </td>
                </tr>
              ) : (
                filteredAndSortedTechniciens.map((t, idx) => {
                  const rankIcon = idx === 0 ? '#1' : idx === 1 ? '#2' : idx === 2 ? '#3' : `#${idx + 1}`;
                  return (
                    <tr key={t.technicien}>
                      {/* Rang */}
                      <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                        {rankIcon}
                      </td>

                      {/* Technicien & Spécialités */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {t.technicien}
                          </span>
                        </div>
                        <div style={{ marginTop: '3px' }}>
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: '999px',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              background: t.performanceBadge.bg,
                              color: t.performanceBadge.color,
                              display: 'inline-block',
                            }}
                          >
                            {t.performanceBadge.label}
                          </span>
                        </div>
                        {t.specialites.length > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {t.specialites.join(' • ')}
                          </div>
                        )}
                      </td>

                      {/* Interventions */}
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>
                          {t.clotureesCount} / {t.totalInterventions} clôturée(s)
                        </div>
                        {t.retardsCount > 0 && (
                          <div style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 700 }}>
                            {t.retardsCount} retard(s)
                          </div>
                        )}
                        {t.enCoursCount > 0 && (
                          <div style={{ fontSize: '10.5px', color: '#0284c7' }}>
                            ▸ {t.enCoursCount} en cours
                          </div>
                        )}
                      </td>

                      {/* Durée Prévue vs Réelle */}
                      <td>
                        <div className="font-mono" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                          Réel : <strong>{t.totalRealHours}h</strong> (Prévu : {t.totalPlannedHours}h)
                        </div>
                        <div style={{ fontSize: '10.5px', marginTop: '2px' }}>
                          {t.savedHours > 0 ? (
                            <span style={{ color: '#059669', fontWeight: 700 }}>
                              ✓ Gain : +{t.savedHours}h ({t.productivityRate}% efficience)
                            </span>
                          ) : t.savedHours < 0 ? (
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>
                              Dépassé : {t.savedHours}h ({t.productivityRate}%)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Conforme au créneau (100%)</span>
                          )}
                        </div>
                      </td>

                      {/* CA Produit HT */}
                      <td>
                        <div className="font-mono" style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(t.totalMontantHT)}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Montant HT validé
                        </div>
                      </td>

                      {/* Rentabilité Horaire (€/h) */}
                      <td>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            color: t.hourlyRevenueHT >= 80 ? '#059669' : t.hourlyRevenueHT >= 50 ? '#0284c7' : '#dc2626',
                          }}
                        >
                          {t.hourlyRevenueHT} € / h
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {formatCurrency(t.totalMontantHT)} ÷ {t.totalRealHours}h réelles
                        </div>
                      </td>

                      {/* Marge Brute Estimée */}
                      <td>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            color: t.estimatedMarginHT >= 0 ? '#10b981' : '#dc2626',
                          }}
                        >
                          {formatCurrency(t.estimatedMarginHT)}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          Taux marge : <strong>{t.marginRate}%</strong>
                        </div>
                      </td>

                      {/* Preuves & Qualité */}
                      <td>
                        <div style={{ fontSize: '11px', fontWeight: 600 }}>
                          ⊞ {t.photosCount} photo(s)
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {t.rapportsCount} rapport(s)
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                          onClick={onNavigateToPlanning}
                        >
                          Planning
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Vue Mobile : Cartes tactiles Techniciens */}
        <div className="mobile-only-block mobile-card-grid">
          {filteredAndSortedTechniciens.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '28px',
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              Aucun technicien ne correspond aux filtres.
            </div>
          ) : (
            filteredAndSortedTechniciens.map((t, idx) => {
              const medal = idx === 0 ? '#1' : idx === 1 ? '#2' : idx === 2 ? '#3' : `#${idx + 1}`;
              const rentabColor = t.hourlyRevenueHT >= 80 ? '#059669' : t.hourlyRevenueHT >= 50 ? '#0284c7' : '#dc2626';

              return (
                <div
                  key={t.technicien}
                  className="mobile-touch-card"
                  style={{
                    background: '#fff',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    padding: '12px 14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {/* En-tête de la carte */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800 }}>{medal}</span>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#e0e7ff',
                          color: '#3730a3',
                          fontWeight: 800,
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {t.technicien.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#0a0f1d' }}>{t.technicien}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t.specialites.length > 0 ? t.specialites.join(' • ') : 'Toutes spécialités'}
                        </div>
                      </div>
                    </div>
                    <span
                      className="status-pill"
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        fontSize: '11px',
                        padding: '2px 8px',
                        fontWeight: 700,
                      }}
                    >
                      {t.totalInterventions} intv.
                    </span>
                  </div>

                  {/* KPIs financiers & rentabilité */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '8px',
                      background: 'var(--bg-elevated)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CA HT</div>
                      <div className="font-mono" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatCurrency(t.totalMontantHT)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rentab.</div>
                      <div className="font-mono" style={{ fontSize: '12.5px', fontWeight: 800, color: rentabColor }}>
                        {t.hourlyRevenueHT} €/h
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Marge</div>
                      <div className="font-mono" style={{ fontSize: '12.5px', fontWeight: 800, color: '#10b981' }}>
                        {formatCurrency(t.estimatedMarginHT)}
                      </div>
                    </div>
                  </div>

                  {/* Détail heures & efficience */}
                  <div style={{ fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Heures Réel / Prévu :</span>
                      <span className="font-mono" style={{ fontWeight: 700 }}>
                        {t.totalRealHours}h / {t.totalPlannedHours}h
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Efficience :</span>
                      {t.savedHours > 0 ? (
                        <span style={{ color: '#059669', fontWeight: 700 }}>+{t.savedHours}h ({t.productivityRate}%)</span>
                      ) : t.savedHours < 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>{t.savedHours}h ({t.productivityRate}%)</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0h (100%)</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Preuves & Rapports :</span>
                      <span style={{ fontWeight: 700, color: t.photosCount > 0 ? '#059669' : '#d97706' }}>
                        ⊞ {t.photosCount} photo(s) • {t.rapportsCount} rapport(s)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11.5px', padding: '4px 12px', width: '100%', justifyContent: 'center' }}
                      onClick={onNavigateToPlanning}
                    >
                      Ouvrir dans le Planning
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </>
    )}

      {/* =====================================================================
          5. VUE B : ANALYSE DE RENTABILITÉ PAR ÉQUIPE / CORPS D'ÉTAT
          ===================================================================== */}
      {activeViewTab === 'equipes' && (
        <>
          <div className="desktop-only-block pro-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>Équipe / Corps d'État (Métier)</th>
                  <th style={{ width: '110px' }}>Effectif Tech</th>
                  <th style={{ width: '130px' }}>Interventions</th>
                  <th style={{ width: '130px' }}>Heures Réelles</th>
                  <th style={{ width: '130px' }}>CA Total HT</th>
                  <th style={{ width: '120px' }}>Part CA Total</th>
                  <th style={{ width: '160px' }}>Rentabilité Horaire (€/h)</th>
                  <th style={{ textAlign: 'right', width: '140px' }}>Marge Équipe</th>
                </tr>
              </thead>
              <tbody>
                {equipesStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                      Aucune donnée disponible pour cette période.
                    </td>
                  </tr>
                ) : (
                  equipesStats.map((eq) => (
                    <tr key={eq.corpsEtat}>
                      <td>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#0a0f1d' }}>
                          {eq.corpsEtat}
                        </div>
                      </td>
                      <td>
                        <div className="font-mono" style={{ fontWeight: 700, fontSize: '12px' }}>
                          {eq.techniciensCount} technicien(s)
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>
                          {eq.clotureesCount} / {eq.interventionsCount} clôturée(s)
                        </div>
                      </td>
                      <td>
                        <div className="font-mono" style={{ fontSize: '12px', fontWeight: 700 }}>
                          {eq.totalRealHours}h
                        </div>
                      </td>
                      <td>
                        <div className="font-mono" style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(eq.totalMontantHT)}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '50px', background: 'var(--border-subtle)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, eq.partCA)}%`, background: '#00bf63', height: '100%' }} />
                          </div>
                          <span className="font-mono" style={{ fontSize: '11.5px', fontWeight: 700, color: '#047857' }}>
                            {eq.partCA}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: '14.5px',
                            fontWeight: 800,
                            color: eq.hourlyRevenueHT >= 80 ? '#059669' : eq.hourlyRevenueHT >= 50 ? '#0284c7' : '#dc2626',
                          }}
                        >
                          {eq.hourlyRevenueHT} € / h
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Débit moyen équipe
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="font-mono" style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>
                          {formatCurrency(eq.estimatedMarginHT)}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          Marge : {eq.marginRate}%
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Vue Mobile : Cartes tactiles Équipes / Métiers */}
          <div className="mobile-only-block mobile-card-grid">
            {equipesStats.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '28px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                Aucune donnée disponible pour cette période.
              </div>
            ) : (
              equipesStats.map((eq) => {
                const rentabColor = eq.hourlyRevenueHT >= 80 ? '#059669' : eq.hourlyRevenueHT >= 50 ? '#0284c7' : '#dc2626';

                return (
                  <div
                    key={eq.corpsEtat}
                    className="mobile-touch-card"
                    style={{
                      background: '#fff',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      padding: '12px 14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0a0f1d' }}>
                        {eq.corpsEtat}
                      </div>
                      <span
                        className="status-pill"
                        style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          fontSize: '11px',
                          padding: '2px 8px',
                          fontWeight: 700,
                        }}
                      >
                        {eq.techniciensCount} tech.
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '8px',
                        background: 'var(--bg-elevated)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CA HT</div>
                        <div className="font-mono" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(eq.totalMontantHT)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rentab.</div>
                        <div className="font-mono" style={{ fontSize: '12.5px', fontWeight: 800, color: rentabColor }}>
                          {eq.hourlyRevenueHT} €/h
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Marge</div>
                        <div className="font-mono" style={{ fontSize: '12.5px', fontWeight: 800, color: '#10b981' }}>
                          {formatCurrency(eq.estimatedMarginHT)}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Interventions :</span>
                        <span style={{ fontWeight: 700 }}>
                          {eq.clotureesCount} / {eq.interventionsCount} clôturée(s)
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Heures Réelles :</span>
                        <span className="font-mono" style={{ fontWeight: 700 }}>
                          {eq.totalRealHours}h
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Part CA Global :</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '50px', background: 'var(--border-subtle)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, eq.partCA)}%`, background: '#00bf63', height: '100%' }} />
                          </div>
                          <span className="font-mono" style={{ fontWeight: 700, color: '#047857' }}>{eq.partCA}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}
