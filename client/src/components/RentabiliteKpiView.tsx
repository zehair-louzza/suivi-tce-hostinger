import { useState, useMemo } from 'react';
import {
  Devis,
  Intervention,
  formatCurrency,
  formatDateFR,
  computeDurationHours,
} from '../lib/api';
import toast from 'react-hot-toast';

interface RentabiliteKpiViewProps {
  interventionsList: Intervention[];
  devisList: Devis[];
  techniciens?: string[];
  onNavigateToPlanning?: () => void;
  onOpenInterventionDrawer?: (intervention: Intervention) => void;
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
  // Coût horaire moyen paramétrable (€/h chargé)
  const [hourlyCostParam, setHourlyCostParam] = useState<number>(35);
  // Tri du tableau des techniciens
  const [sortBy, setSortBy] = useState<'hourlyRevenue' | 'totalMontant' | 'margin' | 'productivity'>('hourlyRevenue');
  // Recherche
  const [searchQuery, setSearchQuery] = useState('');
  // Onglet vue active : par Technicien ou par Équipe / Corps d'état
  const [activeViewTab, setActiveViewTab] = useState<'techniciens' | 'equipes'>('techniciens');

  const today = useMemo(() => new Date(), []);
  const currentMonthPrefix = useMemo(() => today.toISOString().slice(0, 7), [today]);

  // Filtrage des interventions par période
  const periodFilteredInterventions = useMemo(() => {
    return interventionsList.filter((intv) => {
      if (filterStatut === 'CLOTUREE') {
        const statut = intv.statutOperationnel || '';
        if (statut !== 'Clôturée' && statut !== 'Terminée - à valider') return false;
      }

      if (selectedPeriod === 'MONTH') {
        const dateStr = intv.datePlanifiee ? intv.datePlanifiee.slice(0, 7) : '';
        if (dateStr !== currentMonthPrefix) return false;
      } else if (selectedPeriod === 'WEEK') {
        if (!intv.datePlanifiee) return false;
        const d = new Date(intv.datePlanifiee);
        const diffDays = Math.abs(today.getTime() - d.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }
      return true;
    });
  }, [interventionsList, filterStatut, selectedPeriod, currentMonthPrefix, today]);

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
        label: '🌱 En progression',
        bg: 'rgba(59, 130, 246, 0.12)',
        color: '#2563eb',
      };
      if (hourlyRevenueHT >= 110) {
        performanceBadge = {
          label: '🔥 Rentabilité Exceptionnelle (>110€/h)',
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#059669',
        };
      } else if (hourlyRevenueHT >= 80) {
        performanceBadge = {
          label: '⭐ Forte Rentabilité (80–110€/h)',
          bg: 'rgba(124, 58, 237, 0.14)',
          color: '#7c3aed',
        };
      } else if (hourlyRevenueHT >= 50) {
        performanceBadge = {
          label: '✓ Conforme au budget (50–80€/h)',
          bg: 'rgba(14, 165, 233, 0.14)',
          color: '#0284c7',
        };
      } else if (totalInterventions > 0) {
        performanceBadge = {
          label: '⚠️ Vigilance Rentabilité (<50€/h)',
          bg: 'rgba(239, 68, 68, 0.14)',
          color: '#dc2626',
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
      `📊 RAPPORT DE RENTABILITÉ & PERFORMANCE DES TECHNICIENS — ANELEC GROUPE`,
      `Date : ${formatDateFR(today.toISOString().slice(0, 10))} • Base coût horaire : ${hourlyCostParam} €/h chargé`,
      `--------------------------------------------------------------------------`,
      `• Chiffre d'Affaires Produit Total : ${formatCurrency(globalMetrics.totalCA)} HT`,
      `• Heures Réelles Effectuées : ${globalMetrics.totalRealHours}h (Heures planifiées : ${globalMetrics.totalPlannedHours}h)`,
      `• Rentabilité Horaire Moyenne : ${globalMetrics.globalHourlyRevenue} € HT / heure`,
      `• Marge Brute Globale Estimée : ${formatCurrency(globalMetrics.globalMargin)} HT (${globalMetrics.globalMarginRate}%)`,
      `• Taux de Productivité Global : ${globalMetrics.globalProductivity}%`,
      `• Interventions Clôturées : ${globalMetrics.totalCloturees} / ${globalMetrics.totalInterventions}`,
      ``,
      `🏆 CLASSEMENT DES TECHNICIENS PAR RENTABILITÉ HORAIRE :`,
    ];

    filteredAndSortedTechniciens.forEach((t, idx) => {
      lines.push(
        `${idx + 1}. ${t.technicien.toUpperCase()} : ${t.hourlyRevenueHT} €/h | CA: ${formatCurrency(t.totalMontantHT)} HT | ${t.totalRealHours}h réelles | Marge: ${formatCurrency(t.estimatedMarginHT)} (${t.marginRate}%) | ${t.clotureesCount}/${t.totalInterventions} clôturées`
      );
    });

    lines.push('');
    lines.push('🏗️ RENTABILITÉ PAR ÉQUIPE / CORPS D’ÉTAT :');
    equipesStats.forEach((eq) => {
      lines.push(
        `• ${eq.corpsEtat} : ${eq.hourlyRevenueHT} €/h | CA: ${formatCurrency(eq.totalMontantHT)} HT (${eq.partCA}% du total) | ${eq.totalRealHours}h | ${eq.techniciensCount} tech(s)`
      );
    });

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Rapport de rentabilité copié dans le presse-papiers !', { icon: '📋' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* =====================================================================
          1. EN-TÊTE DE LA CONSOLE DE RENTABILITÉ & PERFORMANCE
         ===================================================================== */}
      <div className="glass-analytics-card" style={{ padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#059669',
                  letterSpacing: '0.04em',
                }}
              >
                ANALYTICS & CONTRÔLE DE GESTION TCE
              </span>
              <h2 style={{ fontSize: '17px', fontWeight: 800 }}>
                Rentabilité, Débits Horaires & Performance des Techniciens & Équipes
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Croisez en temps réel les montants des interventions, les heures réelles pointées, les durées planifiées et les marges brutes générées.
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

            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleCopyReport}
            >
              📋 Copier Synthèse Direction
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. BANDEAU DES KPIS STRATÉGIQUES DE RENTABILITÉ
         ===================================================================== */}
      <div className="kpi-strip">
        <div className="kpi-card" style={{ borderTop: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>
              💶 CA Total Produit
            </span>
            <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Interventions
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatCurrency(globalMetrics.totalCA)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {globalMetrics.totalCloturees} clôturée(s) sur {globalMetrics.totalInterventions}
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
              ⚡ Rentabilité Horaire
            </span>
            <span className="font-mono" style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>
              Moyenne
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '24px', fontWeight: 800, color: '#1d4ed8' }}>
            {globalMetrics.globalHourlyRevenue} € / heure
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {globalMetrics.totalRealHours}h réelles pointées ({globalMetrics.totalPlannedHours}h prévues)
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed' }}>
              📈 Marge Brute Globale
            </span>
            <span className="font-mono" style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 800 }}>
              {globalMetrics.globalMarginRate}%
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '24px', fontWeight: 800, color: '#6d28d9' }}>
            {formatCurrency(globalMetrics.globalMargin)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Déduction base coût : {hourlyCostParam} €/h
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706' }}>
              ⏱️ Efficience / Délais
            </span>
            <span className="font-mono" style={{ fontSize: '11px', color: '#d97706', fontWeight: 700 }}>
              Ratio
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {globalMetrics.globalProductivity}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {globalMetrics.globalProductivity >= 100
              ? '✓ En avance sur créneaux prévus'
              : 'Dépassement créneaux prévus'}
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid #ec4899' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#db2777' }}>
              🏆 Top Rentabilité
            </span>
            <span className="badge badge-primary" style={{ fontSize: '9px' }}>N°1</span>
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {globalMetrics.topPerformer?.technicien || 'Aucun'}
          </div>
          <div className="font-mono" style={{ fontSize: '11.5px', color: '#db2777', fontWeight: 700 }}>
            {globalMetrics.topPerformer ? `${globalMetrics.topPerformer.hourlyRevenueHT} €/h (${formatCurrency(globalMetrics.topPerformer.totalMontantHT)})` : '—'}
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. SIMULATEUR DE COÛT HORAIRE & BARRE DE TRI / VUE
         ===================================================================== */}
      <div
        className="glass-analytics-card"
        style={{
          padding: '12px 18px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.92)',
        }}
      >
        {/* Commutateur de vue : Par Technicien vs Par Équipe / Métier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${activeViewTab === 'techniciens' ? 'active' : ''}`}
              onClick={() => setActiveViewTab('techniciens')}
            >
              👷 Rentabilité par Technicien ({filteredAndSortedTechniciens.length})
            </button>
            <button
              type="button"
              className={`segmented-btn ${activeViewTab === 'equipes' ? 'active' : ''}`}
              onClick={() => setActiveViewTab('equipes')}
            >
              🏗️ Rentabilité par Équipe / Corps d'État ({equipesStats.length})
            </button>
          </div>
        </div>

        {/* Simulateur / Réglage Coût Horaire Moyen Chargé */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1e40af' }}>
            🧮 Coût Moyen Chargé :
          </span>
          <input
            type="range"
            min={20}
            max={70}
            step={1}
            value={hourlyCostParam}
            onChange={(e) => setHourlyCostParam(Number(e.target.value))}
            style={{ width: '100px', cursor: 'pointer', accentColor: '#2563eb' }}
          />
          <span className="font-mono" style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', minWidth: '46px' }}>
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
              <option value="hourlyRevenue">⚡ Rentabilité Horaire (€/h)</option>
              <option value="totalMontant">💶 Chiffre d'Affaires HT</option>
              <option value="margin">📈 Marge Brute (€ HT)</option>
              <option value="productivity">⏱️ Taux d'Efficience / Délais</option>
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
          4. VUE A : TABLEAU COMPARATIF DÉTAILLÉ PAR TECHNICIEN
         ===================================================================== */}
      {activeViewTab === 'techniciens' && (
        <div className="pro-table-container">
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
                  const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
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
                            ⚠️ {t.retardsCount} retard(s)
                          </div>
                        )}
                        {t.enCoursCount > 0 && (
                          <div style={{ fontSize: '10.5px', color: '#0284c7' }}>
                            ⚡ {t.enCoursCount} en cours
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
                          📷 {t.photosCount} photo(s)
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          📝 {t.rapportsCount} rapport(s)
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
                          📅 Planning
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          5. VUE B : ANALYSE DE RENTABILITÉ PAR ÉQUIPE / CORPS D'ÉTAT
         ===================================================================== */}
      {activeViewTab === 'equipes' && (
        <div className="pro-table-container">
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
                      <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e40af' }}>
                        🔨 {eq.corpsEtat}
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
                        <div style={{ width: '50px', background: '#e2e8f0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, eq.partCA)}%`, background: '#2563eb', height: '100%' }} />
                        </div>
                        <span className="font-mono" style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>
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
      )}
    </div>
  );
}
