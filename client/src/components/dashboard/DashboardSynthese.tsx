import { buildLedgerContext, amountOf, isVisite } from '../../lib/dossiers';
import type { PeriodeId } from '../../lib/periode';
import { PERIODES, filtrerDevis, filtrerInterventions, periodeLabel, periodeRange } from '../../lib/periode';
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Euro,
  Receipt,
  FileText,
  Camera,
  AlertTriangle,
  ArrowRight,
  Siren,
  Send,
  CalendarDays,
  Clock,
  Wrench,
  CalendarRange,
  LayoutGrid,
  Activity,
  PieChart,
  TrendingUp,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Devis, Intervention, formatCurrency } from '../../lib/api';

export interface DashboardQueues {
  devisARelancer: Devis[];
  devisProchesEcheance: Devis[];
  devisAcceptesSansIntv: Devis[];
  visitesDevisAPlanifier: Devis[];
  intvAPlanifier: Intervention[];
  intvEnRetard: Intervention[];
  intvAFacturer: Intervention[];
  rapportsEnAttente: Intervention[];
  anomaliesQualite: Array<{
    ref: string;
    type: 'DEVIS' | 'INTERVENTION';
    message: string;
    item: any;
  }>;
}

interface DashboardSyntheseProps {
  devisList: Devis[];
  interventionsList: Intervention[];
  /** Période sélectionnée, partagée avec les autres vues du tableau de bord */
  period?: PeriodeId;
  onPeriodChange?: (p: PeriodeId) => void;
  techniciensList?: string[];
  queues: DashboardQueues;
  activeTab: 'synthese' | 'operations' | 'analyse';
  onTabChange: (tab: 'synthese' | 'operations' | 'analyse') => void;
  onNavigateSection: (section: any) => void;
  onOpenDevis: (devis: Devis) => void;
  onOpenIntv: (intv: Intervention) => void;
  onNewIntv: () => void;
  onConvertDevis: (devis: Devis) => void;
  onGoAdminRapports: () => void;
  onFilterInterventions: (search: string) => void;
  onOpenSituationModal?: () => void;
}

/* Mini sparkline SVG */
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24}`)
    .join(' ');
  return (
    <svg className="m-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Tooltip personnalisé pour le graphique CA */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const val = payload[0].value;
  return (
    <div className="m-chart-tip">
      <strong>
        {label} {new Date().getFullYear()}
      </strong>
      <span>{typeof val === 'number' ? formatCurrency(val) : val}</span>
    </div>
  );
}

export function DashboardSynthese({
  devisList,
  interventionsList,
  period: periodProp,
  onPeriodChange,
  techniciensList = [],
  queues,
  activeTab,
  onTabChange,
  onNavigateSection,
  onOpenDevis: _onOpenDevis,
  onOpenIntv: _onOpenIntv,
  onNewIntv,
  onConvertDevis: _onConvertDevis,
  onGoAdminRapports,
  onFilterInterventions: _onFilterInterventions,
  onOpenSituationModal,
}: DashboardSyntheseProps) {
  const [periodLocal, setPeriodLocal] = useState<PeriodeId>('month');
  const period = periodProp ?? periodLocal;
  const setPeriod = (p: PeriodeId) => {
    setPeriodLocal(p);
    onPeriodChange?.(p);
  };
  const [periodOpen, setPeriodOpen] = useState(false);

  // La période filtre réellement les indicateurs. Le contexte comptable reste construit sur
  // les listes complètes, sinon un devis hors période ne serait plus retrouvé.
  const range = useMemo(() => periodeRange(period), [period]);
  const intvPeriode = useMemo(() => filtrerInterventions(interventionsList, range), [interventionsList, range]);
  const devisPeriode = useMemo(() => filtrerDevis(devisList, range), [devisList, range]);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  // Date du jour formatée en français
  const todayFormatted = useMemo(() => {
    try {
      const d = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date());
      return d.toUpperCase();
    } catch {
      return 'VENDREDI 6 NOVEMBRE 2026';
    }
  }, []);

  const currentMonthLabel = useMemo(() => {
    try {
      const formatted = new Intl.DateTimeFormat('fr-FR', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return 'Novembre 2026';
    }
  }, []);

  // =========================================================================
  // CALCULS ÉCONOMIQUES & COMMERCIAUX RÉELS
  // =========================================================================
  const {
    totalCAClotureHT,
    totalAFacturerHT,
    intvAFacturerCount,
    devisASuivreCount,
    totalDevisEnPortefeuille,
    tauxTransformation,
    rapportsAValiderCount,
    clotureesCount,
  } = useMemo(() => {
    const ledger = buildLedgerContext(devisList, interventionsList);
    // Les visites de chiffrage ne sont pas du chiffre d'affaires
    const cloturees = intvPeriode.filter(
      (i) => !isVisite(i) && ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel || '')
    );
    const caCloture = cloturees.reduce((acc, i) => acc + amountOf(i, ledger), 0);

    const aFacturer = intvPeriode.filter(
      (i) => !isVisite(i) && i.statutOperationnel === 'Terminée - à valider'
    );
    const caAFacturer = aFacturer.reduce((acc, i) => acc + amountOf(i, ledger), 0);

    const devisAttente = devisPeriode.filter((d) => ['À préparer', 'À valider en interne', 'Envoyé', 'Envoyé au client', 'En négociation', 'Accepté'].includes(d.statutCommercial || ''));
    const totalDevisPortefeuille = devisAttente.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

    const totalDevisNonBrouillon = devisPeriode.filter((d) => d.statutCommercial !== 'À préparer').length;
    const acceptesCount = devisPeriode.filter((d) => d.statutCommercial === 'Accepté').length;
    const taux = totalDevisNonBrouillon > 0 ? Math.round((acceptesCount / totalDevisNonBrouillon) * 100) : 0;

    return {
      totalCAClotureHT: caCloture,
      totalAFacturerHT: caAFacturer,
      intvAFacturerCount: aFacturer.length,
      devisASuivreCount: devisAttente.length,
      totalDevisEnPortefeuille: totalDevisPortefeuille,
      tauxTransformation: taux,
      rapportsAValiderCount: queues.rapportsEnAttente.length,
      clotureesCount: cloturees.length,
    };
  }, [devisList, interventionsList, devisPeriode, intvPeriode, queues]);

  // =========================================================================
  // CA MENSUEL RÉEL : interventions terminées / clôturées, par mois de réalisation
  // =========================================================================
  const caMonthlyData = useMemo(() => {
    const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const year = now.getFullYear();
    const totals = new Array(12).fill(0) as number[];
    const ledger = buildLedgerContext(devisList, interventionsList);
    for (const i of interventionsList) {
      if (isVisite(i) || !['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel || '')) continue;
      const day = i.datePlanifiee || i.dateDemande || '';
      if (!day.startsWith(String(year))) continue;
      const month = Number(day.slice(5, 7)) - 1;
      if (month >= 0 && month < 12) totals[month] += amountOf(i, ledger);
    }
    return labels.slice(0, now.getMonth() + 1).map((m, idx) => ({ m, ca: totals[idx] }));
  }, [interventionsList, devisList]);

  const caSparkline = useMemo(() => {
    const vals = caMonthlyData.map((d) => d.ca);
    return vals.length >= 2 ? vals : [0, ...vals, ...(vals.length === 0 ? [0] : [])];
  }, [caMonthlyData]);

  // Variation réelle du mois en cours par rapport au précédent.
  // Elle n'a de sens que si la période affichée EST le mois : sinon on n'affiche rien
  // plutôt que de comparer une semaine à un mois.
  const caDeltaPct = useMemo(() => {
    if (period !== 'month') return null;
    const n = caMonthlyData.length;
    if (n < 2) return null;
    const prev = caMonthlyData[n - 2].ca;
    const cur = caMonthlyData[n - 1].ca;
    if (prev <= 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [caMonthlyData, period]);

  // =========================================================================
  // LISTE DES PRIORITÉS (HYBRIDE DONNÉES RÉELLES + EXEMPLES STRUCTURELS)
  // =========================================================================
  const priorityItems = useMemo(() => {
    const list: Array<{
      id: string;
      icon: any;
      tone: 'teal' | 'red' | 'green' | 'blue' | 'amber';
      title: string;
      meta: string;
      amount: number;
      cta: string;
      onClick: () => void;
    }> = [];
    const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

    // 1. Rapports terrain à valider
    if (queues.rapportsEnAttente.length > 0) {
      const first = queues.rapportsEnAttente[0];
      const nb = first.photos?.length || 0;
      list.push({
        id: 'prio-rapports',
        icon: Camera,
        tone: 'blue',
        title: queues.rapportsEnAttente.length > 1
          ? `Valider ${plural(queues.rapportsEnAttente.length, 'rapport')} terrain`
          : 'Valider le rapport terrain',
        meta: `${first.reference || `INT-${first.id}`} · ${first.client || 'Client'}${nb ? ` · ${plural(nb, 'photo')} reçue${nb > 1 ? 's' : ''}` : ''}`,
        amount: Number(first.amount) || 0,
        cta: 'Valider',
        onClick: onGoAdminRapports,
      });
    }

    // 2. Interventions à planifier / affecter
    if (queues.intvAPlanifier.length > 0) {
      const first = queues.intvAPlanifier[0];
      const urgent = first.priorite === 'Urgente' || first.priorite === 'Haute';
      list.push({
        id: 'prio-urgence',
        icon: Siren,
        tone: urgent ? 'red' : 'amber',
        title: queues.intvAPlanifier.length > 1
          ? `Planifier ${plural(queues.intvAPlanifier.length, 'intervention')}`
          : urgent ? 'Affecter l’urgence' : 'Planifier l’intervention',
        meta: `${first.reference || `INT-${first.id}`} · ${first.objet || first.chantier || 'Intervention'}${first.client ? ` · ${first.client}` : ''}`,
        amount: Number(first.amount) || 0,
        cta: 'Affecter',
        onClick: () => onNavigateSection('planning'),
      });
    }

    // 3. Facturation des chantiers terminés
    if (queues.intvAFacturer.length > 0) {
      list.push({
        id: 'prio-factu',
        icon: Receipt,
        tone: 'green',
        title: `Facturer ${plural(queues.intvAFacturer.length, 'intervention')} terminée${queues.intvAFacturer.length > 1 ? 's' : ''}`,
        meta: `${Array.from(new Set(queues.intvAFacturer.map((i) => i.client).filter(Boolean))).slice(0, 2).join(' et ')} · rapports validés`,
        amount: queues.intvAFacturer.reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
        cta: 'Facturer',
        onClick: () => onNavigateSection('facturation'),
      });
    }

    // 4. Devis à relancer
    if (queues.devisARelancer.length > 0) {
      const first = queues.devisARelancer[0];
      list.push({
        id: 'prio-relance',
        icon: Send,
        tone: 'blue',
        title: queues.devisARelancer.length > 1
          ? `Relancer ${plural(queues.devisARelancer.length, 'devis')}`
          : 'Relancer le devis envoyé',
        meta: `${first.reference || `DEV-${first.id}`} · ${first.client || 'Client'}`,
        amount: Number(first.amount) || 0,
        cta: 'Relancer',
        onClick: () => onNavigateSection('devis'),
      });
    }

    // 5. Chantiers bloqués (motif de blocage renseigné, intervention non terminée)
    const bloques = interventionsList.filter(
      (i) => (i.traitement === 'Bloqué' || i.statutOperationnel === 'Suspendue') && i.statutOperationnel !== 'Clôturée'
    );
    if (bloques.length > 0) {
      const first = bloques[0];
      list.push({
        id: 'prio-bloque',
        icon: AlertTriangle,
        tone: 'amber',
        title: bloques.length > 1 ? `${plural(bloques.length, 'chantier')} bloqué${bloques.length > 1 ? 's' : ''}` : 'Chantier bloqué',
        meta: `${first.reference || `INT-${first.id}`} · ${first.motifBlocage || first.objet || 'Motif à préciser'}`,
        amount: Number(first.amount) || 0,
        cta: 'Ouvrir',
        onClick: () => onNavigateSection('interventions'),
      });
    }

    return list;
  }, [queues, interventionsList, onGoAdminRapports, onNavigateSection]);

  // =========================================================================
  // PLANNING DU JOUR
  // =========================================================================
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const techPalette = ['#1D4ED8', '#10B981', '#6366F1', '#0EA5A4', '#EC4899', '#F59E0B', '#8B5CF6', '#DC2626'];
  const colorOfTech = (name?: string | null) => {
    const idx = name ? techniciensList.indexOf(name) : -1;
    return techPalette[(idx >= 0 ? idx : 0) % techPalette.length];
  };

  // Missions du jour : uniquement les vraies interventions planifiées aujourd'hui
  const todayMissions = useMemo(() => {
    return interventionsList
      .filter((i) => i.datePlanifiee === todayIso)
      .sort((x, y) => (x.heureDebut || '').localeCompare(y.heureDebut || ''))
      .slice(0, 12)
      .map((i, idx) => ({
        id: i.id || idx,
        start: i.heureDebut || '—',
        end: i.heureFin || '—',
        client: i.client || '—',
        ref: i.reference || `INT-${i.id}`,
        label: i.chantier || i.objet || 'Intervention',
        kind: ((i.priorite === 'Urgente' || i.priorite === 'Haute') ? 'urgence' : i.statutOperationnel === 'Visite devis' ? 'visite' : 'travaux') as 'travaux' | 'visite' | 'urgence',
        techName: i.entreprise || 'À affecter',
        techInitials: (i.entreprise ? i.entreprise.slice(0, 2) : '?').toUpperCase(),
        techColor: colorOfTech(i.entreprise),
      }));
  }, [interventionsList, todayIso, techniciensList]);

  // =========================================================================
  // ÉQUIPE AUJOURD’HUI (missions réelles du jour par technicien)
  // =========================================================================
  const teamStatus = useMemo(() => {
    return techniciensList.map((name) => {
      const mine = interventionsList.filter((i) => i.datePlanifiee === todayIso && i.entreprise === name);
      return {
        id: name,
        name,
        initials: name.slice(0, 2).toUpperCase(),
        color: colorOfTech(name),
        since: null as string | null,
        done: mine.filter((i) => i.statutOperationnel === 'Clôturée' || i.statutOperationnel === 'Terminée - à valider').length,
        total: mine.length,
      };
    });
  }, [techniciensList, interventionsList, todayIso]);

  const totalQueuesCount =
    queues.devisAcceptesSansIntv.length +
    queues.visitesDevisAPlanifier.length +
    queues.intvAPlanifier.length +
    queues.rapportsEnAttente.length;

  return (
    <div className="m-page" data-testid="atlas-screen-dashboard">
      {/* =====================================================================
          EN-TÊTE ATLAS CLARITY (Eyebrow + H1 + Actions + SubNav)
         ===================================================================== */}
      <header className="m-page-head">
        <div className="m-page-titles">
          <span className="m-eyebrow">{todayFormatted}</span>
          <h1 data-testid="dashboard-title">Tableau de bord</h1>
          <p>Vue d’ensemble de l’activité, des interventions et du chiffre d’affaires.</p>
        </div>

        <div className="m-page-actions">
          {/* Menu déroulant Période */}
          <div className="m-dd">
            <button
              type="button"
              className="m-dd-btn"
              onClick={() => setPeriodOpen(!periodOpen)}
              data-testid="dashboard-period-dropdown"
            >
              <CalendarDays size={15} style={{ color: 'var(--muted)' }} />
              <span>{periodeLabel(period)}</span>
              <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
            </button>
            {periodOpen && (
              <div className="m-menu m-menu--left">
                {PERIODES.map((id) => ({ id, label: periodeLabel(id) })).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`m-menu-item ${period === opt.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setPeriod(opt.id);
                      setPeriodOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    {period === opt.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Situation Excel */}
          {onOpenSituationModal && (
            <button
              type="button"
              className="m-btn m-btn--secondary"
              onClick={onOpenSituationModal}
              title="Exporter un rapport de situation complet en fichier Excel (.xlsx)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              <span>Situation Excel</span>
            </button>
          )}

          {/* Menu + Nouveau (Atlas Clarity) */}
          <div className="m-dd">
            <button
              type="button"
              className="m-btn m-btn--primary"
              onClick={() => setNewMenuOpen(!newMenuOpen)}
              data-testid="dashboard-new-button"
            >
              <span>+ Nouveau</span>
              <ChevronDown size={14} />
            </button>
            {newMenuOpen && (
              <div className="m-menu">
                <button
                  type="button"
                  className="m-menu-item"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onNewIntv();
                  }}
                >
                  <span>+ Intervention TCE</span>
                </button>
                <button
                  type="button"
                  className="m-menu-item"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onNavigateSection('devis');
                  }}
                >
                  <span>+ Devis client</span>
                </button>
                <button
                  type="button"
                  className="m-menu-item"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onNewIntv();
                  }}
                >
                  <span>+ Bon d’urgence</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          ONGLETS SUB-NAVIGATION ATLAS CLARITY (Synthèse / Opérations / Analyse)
         ===================================================================== */}
      <div className="m-page-sub">
        <nav className="m-subnav" aria-label="Sections du tableau de bord">
          <button
            type="button"
            className={`m-subnav-item ${activeTab === 'synthese' ? 'is-active' : ''}`}
            onClick={() => onTabChange('synthese')}
          >
            <LayoutGrid size={15} />
            <span>Synthèse</span>
          </button>
          <button
            type="button"
            className={`m-subnav-item ${activeTab === 'operations' ? 'is-active' : ''}`}
            onClick={() => onTabChange('operations')}
          >
            <Wrench size={15} />
            <span>Opérations</span>
            {totalQueuesCount > 0 && <em className="is-alert">{totalQueuesCount}</em>}
          </button>
          <button
            type="button"
            className={`m-subnav-item ${activeTab === 'analyse' ? 'is-active' : ''}`}
            onClick={() => onTabChange('analyse')}
          >
            <PieChart size={15} />
            <span>Analyse</span>
          </button>
        </nav>
      </div>

      {/* =====================================================================
          CONTENU PRINCIPAL SYNTHÈSE
         ===================================================================== */}
      <div className="m-page-body">
        {/* 1. LES 4 KPIS EN LIGNE NETTE AVEC SPARKLINE ET ICÔNES DOUCES */}
        <section className="m-kpis m-kpis--4" aria-label="Indicateurs clés">
          {/* KPI 1 : CA travaux réalisés */}
          <div
            className="m-kpi m-kpi-tone-blue is-click"
            onClick={() => onNavigateSection('interventions')}
            role="button"
            tabIndex={0}
            data-testid="atlas-kpi-ca"
          >
            <div className="m-kpi-top">
              <span className="m-kpi-icon">
                <Euro size={16} />
              </span>
              <span className="m-kpi-label">CA travaux réalisés</span>
              {caDeltaPct !== null && (
                <span className={`m-kpi-delta ${caDeltaPct >= 0 ? 'is-up' : 'is-down'}`}>
                  <TrendingUp size={13} />
                  {caDeltaPct >= 0 ? '+' : ''}{caDeltaPct} %
                </span>
              )}
            </div>
            <div className="m-kpi-value">{formatCurrency(totalCAClotureHT)}</div>
            <div className="m-kpi-foot">
              <span className="m-kpi-hint">
                {periodeLabel(period)} · {clotureesCount} clôturée{clotureesCount > 1 ? 's' : ''}
                {period === 'month' ? ' · vs mois précédent' : ''}
              </span>
              <Sparkline data={caSparkline} />
            </div>
          </div>

          {/* KPI 2 : Prêt à facturer */}
          <div
            className="m-kpi m-kpi-tone-green is-click"
            onClick={() => onNavigateSection('facturation')}
            role="button"
            tabIndex={0}
            data-testid="atlas-kpi-facturer"
          >
            <div className="m-kpi-top">
              <span className="m-kpi-icon">
                <Receipt size={16} />
              </span>
              <span className="m-kpi-label">Prêt à facturer</span>
            </div>
            <div className="m-kpi-value">{formatCurrency(totalAFacturerHT)}</div>
            <div className="m-kpi-foot">
              <span className="m-kpi-hint">{intvAFacturerCount} chantiers validés</span>
            </div>
            <span className="m-kpi-action">Ouvrir la facturation →</span>
          </div>

          {/* KPI 3 : Devis à suivre */}
          <div
            className="m-kpi m-kpi-tone-amber is-click"
            onClick={() => onNavigateSection('devis')}
            role="button"
            tabIndex={0}
            data-testid="atlas-kpi-devis"
          >
            <div className="m-kpi-top">
              <span className="m-kpi-icon">
                <FileText size={16} />
              </span>
              <span className="m-kpi-label">Devis à suivre</span>
              <span className="m-kpi-delta is-up">
                <TrendingUp size={13} />
                {tauxTransformation}% signés
              </span>
            </div>
            <div className="m-kpi-value">{devisASuivreCount}</div>
            <div className="m-kpi-foot">
              <span className="m-kpi-hint">{formatCurrency(totalDevisEnPortefeuille)} en portefeuille</span>
            </div>
            <span className="m-kpi-action">Voir les devis →</span>
          </div>

          {/* KPI 4 : Rapports à valider */}
          <div
            className="m-kpi m-kpi-tone-blue is-click"
            onClick={onGoAdminRapports}
            role="button"
            tabIndex={0}
            data-testid="atlas-kpi-rapports"
          >
            <div className="m-kpi-top">
              <span className="m-kpi-icon">
                <Camera size={16} />
              </span>
              <span className="m-kpi-label">Rapports à valider</span>
            </div>
            <div className="m-kpi-value">{rapportsAValiderCount}</div>
            <div className="m-kpi-foot">
              <span className="m-kpi-hint">{rapportsAValiderCount} photos terrain</span>
            </div>
            <span className="m-kpi-action">Valider →</span>
          </div>
        </section>

        {/* 2. SECTION « À TRAITER EN PRIORITÉ » (Atlas Clarity) */}
        <section className="m-card m-dash-priority" data-testid="atlas-priority-card">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <AlertTriangle size={16} className="m-card-icon" />
                À traiter en priorité
              </h2>
              <p>Classé par impact financier et urgence</p>
            </div>
          </header>
          <div className="m-card-body">
            <ul className="m-prio">
              {priorityItems.length === 0 && (
                <p style={{ margin: 0, padding: '18px 4px', color: 'var(--muted, #64748b)', fontSize: 13 }}>Rien à traiter en priorité pour le moment.</p>
              )}
              {priorityItems.map((p, i) => (
                <li key={p.id} className="m-prio-item">
                  <span className={`m-prio-ic m-tone-${p.tone}`}>
                    <p.icon size={16} />
                  </span>
                  <div className="m-prio-text">
                    <strong>{p.title}</strong>
                    <span>{p.meta}</span>
                  </div>
                  <span className="m-prio-amount m-mono">{formatCurrency(p.amount)}</span>
                  <button
                    type="button"
                    className={`m-btn m-btn--sm ${i === 0 ? 'm-btn--primary' : 'm-btn--secondary'}`}
                    onClick={p.onClick}
                  >
                    {p.cta === 'Valider' && <Check size={14} />}
                    <span>{p.cta}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. SECTION « PLANNING DU JOUR » (Timeline Visuelle Atlas) */}
        <section className="m-card m-dash-today" data-testid="atlas-today-card">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <CalendarRange size={16} className="m-card-icon" />
                Planning du jour
              </h2>
              <p>{todayMissions.length} missions · {techniciensList.length} techniciens · {queues.intvAPlanifier.length} à affecter</p>
            </div>
            <div className="m-card-actions">
              <button
                type="button"
                className="m-btn m-btn--sm m-btn--ghost"
                onClick={() => onNavigateSection('planning')}
              >
                <span>Planning</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </header>
          <div className="m-card-body">
            <ul className="m-agenda">
              {todayMissions.length === 0 && (
                <p style={{ margin: 0, padding: '18px 4px', color: 'var(--muted, #64748b)', fontSize: 13 }}>Aucune intervention planifiée aujourd’hui.</p>
              )}
              {todayMissions.map((b) => (
                <li
                  key={b.id}
                  className={`m-agenda-item m-agenda--${b.kind}`}
                  onClick={() => onNavigateSection('planning')}
                >
                  <span className="m-agenda-time m-mono">
                    {b.start}
                    <small>{b.end}</small>
                  </span>
                  <i className="m-agenda-bar" />
                  <div className="m-agenda-text">
                    <strong>
                      {b.client} · <span className="m-mono">{b.ref}</span>
                    </strong>
                    <span>{b.label}</span>
                  </div>
                  <span
                    className="m-avatar"
                    style={{
                      width: '26px',
                      height: '26px',
                      fontSize: '11px',
                      background: b.techColor || '#1D4ED8',
                    }}
                    title={b.techName}
                  >
                    {b.techInitials}
                  </span>
                  <span className={`m-kind m-kind--${b.kind}`}>
                    {b.kind === 'urgence' ? 'Urgence' : b.kind === 'visite' ? 'Visite devis' : 'Travaux'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. SECTION « CHIFFRE D’AFFAIRES 2026 » (Graphique AreaChart Atlas) */}
        <section className="m-card m-dash-chart" data-testid="atlas-ca-chart">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <Activity size={16} className="m-card-icon" />
                Chiffre d’affaires 2026
              </h2>
              <p>Montants HT par mois · {currentMonthLabel} en cours</p>
            </div>
          </header>
          <div className="m-card-body">
            <div className="m-chart" style={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={caMonthlyData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ca-atlas-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="m"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)' }} />
                  <Area
                    type="monotone"
                    dataKey="ca"
                    stroke="#1D4ED8"
                    strokeWidth={2.5}
                    fill="url(#ca-atlas-gradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* 5. SECTION « ÉQUIPE AUJOURD’HUI » (Suivi & Pointage Techniciens) */}
        <section className="m-card m-dash-team" data-testid="atlas-team-card">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <Clock size={16} className="m-card-icon" />
                Équipe aujourd’hui
              </h2>
              <p>
                {teamStatus.filter((t) => t.since).length} pointés sur {teamStatus.length}
              </p>
            </div>
          </header>
          <div className="m-card-body">
            <ul className="m-team">
              {teamStatus.length === 0 && (
                <p style={{ margin: 0, padding: '18px 4px', color: 'var(--muted, #64748b)', fontSize: 13 }}>Aucun technicien enregistré. Ajoutez votre équipe dans Paramètres métier.</p>
              )}
              {teamStatus.map((t) => (
                <li key={t.id}>
                  <span
                    className="m-avatar"
                    style={{
                      width: '30px',
                      height: '30px',
                      fontSize: '12px',
                      background: t.color,
                    }}
                  >
                    {t.initials}
                  </span>
                  <div className="m-team-text">
                    <strong>{t.name}</strong>
                    <span className={t.since ? 'is-clocked' : ''}>
                      {t.since ? `Pointé à ${t.since}` : 'Pas encore pointé'}
                    </span>
                  </div>
                  <div className="m-team-prog">
                    <span className="m-mono m-small">
                      {t.done}/{t.total}
                    </span>
                    <div className="m-progress">
                      <span
                        className={`m-progress-bar ${t.since ? 'm-progress--ok' : 'm-progress--danger'}`}
                        style={{ width: `${(t.done / (t.total || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  {/* Aucun envoi automatique n'existe : on ouvre les rapports à relancer */}
                  {!t.since ? (
                    <button type="button" className="m-btn m-btn--sm m-btn--ghost" onClick={onGoAdminRapports}>
                      Voir ses rapports
                    </button>
                  ) : (
                    <span style={{ width: '60px' }} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
