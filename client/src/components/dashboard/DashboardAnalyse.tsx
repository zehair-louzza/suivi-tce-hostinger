import { useMemo } from 'react';
import { Devis, Intervention, formatCurrency } from '../../lib/api';
import { DashboardQueues } from './DashboardSynthese';

interface DashboardAnalyseProps {
  devisList: Devis[];
  interventionsList: Intervention[];
  techniciensList?: string[];
  queues: DashboardQueues;
  activeTab: 'synthese' | 'operations' | 'analyse';
  onTabChange: (tab: 'synthese' | 'operations' | 'analyse') => void;
  onNavigateSection: (section: any) => void;
  onNewIntv: () => void;
  onFilterInterventions: (search: string) => void;
  onGoAdminRapports: () => void;
}

export function DashboardAnalyse({
  devisList,
  interventionsList,
  queues,
  activeTab,
  onTabChange,
  onNavigateSection,
  onNewIntv,
  onFilterInterventions,
  onGoAdminRapports,
}: DashboardAnalyseProps) {
  // Mois courant formatté
  const currentMonthLabel = useMemo(() => {
    try {
      const formatted = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        month: 'long',
        year: 'numeric',
      }).format(new Date());
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return 'Ce mois-ci';
    }
  }, []);

  // =========================================================================
  // ENTONNOIR OPÉRATIONNEL D'AVANCEMENT DES TRAVAUX (FUNNEL TCE 5 ÉTAPES)
  // =========================================================================
  const { funnelSteps, pipelineStats } = useMemo(() => {
    const devisEnCours = devisList.filter(
      (d) => !['Refusé', 'Annulé'].includes(d.statutCommercial || '')
    );
    const devisVisites = devisList.filter((d) => Boolean(d.visiteNecessaire));
    const missionsAPlanifier =
      queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length;
    const missionsPlanifiees = interventionsList.filter(
      (i) => i.statutOperationnel === 'Planifiée'
    ).length;
    const interventionsEnCours = interventionsList.filter(
      (i) => i.statutOperationnel === 'En cours'
    );
    const rapportsAValider = queues.rapportsEnAttente.length;
    const clotureesCount = interventionsList.filter((i) =>
      ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel || '')
    ).length;
    const factureesCount = interventionsList.filter(
      (i) => i.statutFacture === 'Facturée'
    ).length;

    const steps = [
      {
        step: '1',
        title: 'Devis & Chiffrages',
        count: devisEnCours.length,
        sub: `${devisVisites.length} visite(s) requise(s)`,
        badge: 'Amont',
        action: () => onNavigateSection('devis'),
      },
      {
        step: '2',
        title: 'Ordonnancement Gantt',
        count: missionsPlanifiees,
        sub: `${missionsAPlanifier} en attente de créneau`,
        badge: 'Dispatch',
        action: () => onNavigateSection('planning'),
      },
      {
        step: '3',
        title: 'Terrain en direct',
        count: interventionsEnCours.length,
        sub: `${interventionsEnCours.map((i) => i.entreprise).filter(Boolean).slice(0, 2).join(', ') || 'Aucun en cours'}`,
        badge: 'Production',
        action: () => onNavigateSection('interventions'),
      },
      {
        step: '4',
        title: 'Rapports & Photos',
        count: rapportsAValider,
        sub: 'À vérifier avant facturation',
        badge: 'Contrôle',
        action: onGoAdminRapports,
      },
      {
        step: '5',
        title: 'Clôturées & Facturées',
        count: clotureesCount,
        sub: `${factureesCount} facturées (${clotureesCount > 0 ? Math.round((factureesCount / clotureesCount) * 100) : 100}%)`,
        badge: 'Facturation',
        action: () => onNavigateSection('facturation'),
      },
    ];

    // Pipeline commercial
    const devisAcceptes = devisList.filter((d) => d.statutCommercial === 'Accepté');
    const totalPipelineHT = devisEnCours.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    const totalAccepteHT = devisAcceptes.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    const tauxTransfo = devisList.length > 0 ? Math.round((devisAcceptes.length / devisList.length) * 100) : 0;
    const panierMoyenDevis = devisList.length > 0 ? Math.round(totalPipelineHT / devisList.length) : 0;

    return {
      funnelSteps: steps,
      pipelineStats: {
        totalPipelineHT,
        totalAccepteHT,
        tauxTransfo,
        panierMoyenDevis,
        devisCount: devisList.length,
        acceptesCount: devisAcceptes.length,
      },
    };
  }, [devisList, interventionsList, queues, onNavigateSection, onGoAdminRapports]);

  // =========================================================================
  // ANALYSE PAR CORPS D'ÉTAT
  // =========================================================================
  const tradeAnalysis = useMemo(() => {
    const corpsEtatDefs = [
      { trade: 'Électricité', label: 'Électricité Tertiaire & CFO/CFA' },
      { trade: 'Plomberie', label: 'Plomberie, Chauffage & CVC' },
      { trade: 'Serrurerie', label: 'Serrurerie & Dépannage d’accès' },
      { trade: 'Peinture', label: 'Peinture & Revêtements' },
      { trade: 'Menuiserie', label: 'Menuiserie & Agencement' },
      { trade: 'Tous corps', label: 'Rénovation Multi-TCE' },
    ];

    return corpsEtatDefs.map((def) => {
      const key = def.trade.toLowerCase();
      const intvs = interventionsList.filter((i) =>
        (i.corpsEtat || '').toLowerCase().includes(key)
      );
      const devis = devisList.filter((d) =>
        (d.corpsEtat || '').toLowerCase().includes(key)
      );
      const activeIntvs = intvs.filter((i) =>
        ['À planifier', 'Planifiée', 'En cours'].includes(i.statutOperationnel || '')
      );
      const closedIntvs = intvs.filter((i) =>
        ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel || '')
      );
      const caTrade = closedIntvs.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
      const caDevisTrade = devis.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
      const progressPct =
        intvs.length > 0 ? Math.round((closedIntvs.length / intvs.length) * 100) : 0;

      return {
        ...def,
        totalIntvs: intvs.length,
        activeIntvs: activeIntvs.length,
        closedIntvs: closedIntvs.length,
        devisCount: devis.length,
        caDevisTrade,
        caTrade,
        progressPct,
      };
    });
  }, [interventionsList, devisList]);

  return (
    <div className="dashboard-container">
      {/* =====================================================================
          EN-TÊTE
         ===================================================================== */}
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <div className="dashboard-header__titles">
            <h1 className="dashboard-header__title">Tableau de bord · Analyse</h1>
            <p className="dashboard-header__description">
              Entonnoir de réalisation TCE, performance commerciale et répartition analytique par métier.
            </p>
          </div>
          <div className="dashboard-header__actions">
            <div className="date-pill" title="Période en cours">
              <span className="date-pill__dot" />
              <span>Ce mois-ci · {currentMonthLabel}</span>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onNewIntv}
              title="Créer une nouvelle fiche d'intervention TCE"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>+ Nouvelle intervention</span>
            </button>
          </div>
        </div>

        {/* ONGLETS DU TABLEAU DE BORD */}
        <nav className="dashboard-tabs" aria-label="Sections du tableau de bord">
          <button
            type="button"
            className={`dashboard-tab ${activeTab === 'synthese' ? 'dashboard-tab--active' : ''}`}
            onClick={() => onTabChange('synthese')}
          >
            Synthèse
          </button>
          <button
            type="button"
            className={`dashboard-tab ${activeTab === 'operations' ? 'dashboard-tab--active' : ''}`}
            onClick={() => onTabChange('operations')}
          >
            Opérations
            {(queues.devisAcceptesSansIntv.length > 0 ||
              queues.visitesDevisAPlanifier.length > 0 ||
              queues.intvAPlanifier.length > 0 ||
              queues.rapportsEnAttente.length > 0) && (
              <span className="badge badge--neutral" style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px' }}>
                {queues.devisAcceptesSansIntv.length +
                  queues.visitesDevisAPlanifier.length +
                  queues.intvAPlanifier.length +
                  queues.rapportsEnAttente.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`dashboard-tab ${activeTab === 'analyse' ? 'dashboard-tab--active' : ''}`}
            onClick={() => onTabChange('analyse')}
          >
            Analyse
          </button>
        </nav>
      </header>

      {/* =====================================================================
          1. ENTONNOIR OPÉRATIONNEL D'AVANCEMENT DES TRAVAUX (FUNNEL TCE)
         ===================================================================== */}
      <section className="panel" aria-label="Entonnoir d'avancement">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Entonnoir d’avancement des travaux (Cycle complet ANELEC)</h2>
            <p className="panel__description">
              Suivi séquentiel en temps réel : de la qualification commerciale à la facturation finale
            </p>
          </div>
          <span className="badge badge--success">Synchronisation temps réel</span>
        </div>
        <div className="panel__body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            {funnelSteps.map((f, idx) => (
              <div
                key={f.step}
                onClick={f.action}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && f.action()}
                style={{
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px',
                  transition: 'border-color 0.15s ease',
                }}
                title={`Étape ${f.step} · Cliquer pour accéder`}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Étape {f.step} · {f.badge}
                    </span>
                    {idx < funnelSteps.length - 1 && (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>→</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
                    {f.title}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '26px',
                      fontWeight: 600,
                      color: idx === 4 ? 'var(--color-primary)' : 'var(--color-text)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {f.count}
                  </div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px',
                    }}
                  >
                    {f.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. PERFORMANCE DU PIPELINE COMMERCIAL
         ===================================================================== */}
      <section className="kpi-grid" aria-label="Indicateurs de conversion">
        <div className="kpi-card">
          <div className="kpi-card__label">Pipeline devis en cours</div>
          <div className="kpi-card__value">
            {formatCurrency(pipelineStats.totalPipelineHT)}
          </div>
          <div className="kpi-card__context">
            <span className="kpi-card__subtext">
              {pipelineStats.devisCount} chiffrage{pipelineStats.devisCount > 1 ? 's' : ''} émis
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__label">Devis signés (Acceptés)</div>
          <div className="kpi-card__value kpi-card__value--highlight">
            {formatCurrency(pipelineStats.totalAccepteHT)}
          </div>
          <div className="kpi-card__context">
            <span className="kpi-card__subtext">
              {pipelineStats.acceptesCount} devis validé{pipelineStats.acceptesCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__label">Taux de transformation</div>
          <div className="kpi-card__value kpi-card__value--highlight">
            {pipelineStats.tauxTransfo}%
          </div>
          <div className="kpi-card__context">
            <span className="kpi-card__subtext">
              Ratio signatures / devis émis
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__label">Panier moyen devis</div>
          <div className="kpi-card__value">
            {formatCurrency(pipelineStats.panierMoyenDevis)}
          </div>
          <div className="kpi-card__context">
            <span className="kpi-card__subtext">
              Moyenne par dossier chiffré
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. MATRICE COMPLÈTE PAR CORPS D'ÉTAT
         ===================================================================== */}
      <section className="panel" aria-label="Détail analytique par métier">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Répartition analytique et performance par spécialité</h2>
            <p className="panel__description">
              Volumes d’affaires, complétion des chantiers et devis en cours par pôle métier
            </p>
          </div>
          <button
            type="button"
            className="text-link"
            onClick={() => onNavigateSection('rentabilite')}
            style={{ fontSize: '13px' }}
          >
            Consulter le module Rentabilité →
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pôle métier / Corps d’état</th>
                <th className="align-right">Chantiers actifs</th>
                <th className="align-right">Chantiers clôturés</th>
                <th className="align-right">Devis émis</th>
                <th className="align-right">CA Réalisé HT</th>
                <th className="align-right" style={{ minWidth: '180px' }}>Taux de complétion</th>
              </tr>
            </thead>
            <tbody>
              {tradeAnalysis.map((row) => (
                <tr
                  key={row.trade}
                  onClick={() => {
                    onFilterInterventions(row.trade);
                    onNavigateSection('interventions');
                  }}
                  style={{ cursor: 'pointer' }}
                  title={`Voir les interventions ${row.label}`}
                >
                  <td style={{ fontWeight: 600 }}>{row.label}</td>
                  <td className="align-right">{row.activeIntvs}</td>
                  <td className="align-right">{row.closedIntvs}</td>
                  <td className="align-right">{row.devisCount}</td>
                  <td className="align-right amount">{formatCurrency(row.caTrade)}</td>
                  <td className="align-right">
                    <div className="progress-cell">
                      <progress
                        className="progress"
                        value={row.progressPct}
                        max="100"
                        aria-label={`Complétion ${row.label}: ${row.progressPct}%`}
                      />
                      <span className="progress-cell__label">{row.progressPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
