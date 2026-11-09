import { useMemo } from 'react';
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

export function DashboardSynthese({
  devisList,
  interventionsList,
  techniciensList,
  queues,
  activeTab,
  onTabChange,
  onNavigateSection,
  onOpenDevis,
  onOpenIntv,
  onNewIntv,
  onConvertDevis,
  onGoAdminRapports,
  onFilterInterventions,
  onOpenSituationModal,
}: DashboardSyntheseProps) {
  // Date du jour en Europe/Paris
  const todayParisISO = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat('fr-CA', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // fallback
    }
    return new Date().toISOString().slice(0, 10);
  }, []);

  // Mois courant formatté (ex: "Novembre 2026")
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
  // CALCULS ÉCONOMIQUES & COMMERCIAUX RÉELS
  // =========================================================================
  const {
    totalCAClotureHT,
    totalAFacturerHT,
    intvAFacturerCount,
    devisASuivreCount,
    devisAcceptesCount,
    tauxTransformation,
    rapportsAValiderCount,
  } = useMemo(() => {
    // 1. CA travaux réalisés (Terminée - à valider + Clôturée)
    const cloturees = interventionsList.filter((i) =>
      ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel || '')
    );
    const caCloture = cloturees.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

    // 2. Prêt à facturer (terminées non encore facturées)
    const aFacturerList = cloturees.filter((i) => i.statutFacture !== 'Facturée');
    const aFacturerCA = aFacturerList.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

    // 3. Devis à suivre (devis en cours / à relancer / en négo)
    const enCoursDevis = devisList.filter(
      (d) => !['Refusé', 'Annulé'].includes(d.statutCommercial || '')
    );
    const acceptesDevis = devisList.filter((d) => d.statutCommercial === 'Accepté');
    const transfo =
      devisList.length > 0 ? Math.round((acceptesDevis.length / devisList.length) * 100) : 0;

    // 4. Rapports à valider
    const rapportsCount = queues.rapportsEnAttente.length;

    return {
      totalCAClotureHT: caCloture,
      totalAFacturerHT: aFacturerCA,
      intvAFacturerCount: aFacturerList.length,
      devisASuivreCount: enCoursDevis.length,
      devisAcceptesCount: acceptesDevis.length,
      tauxTransformation: transfo,
      rapportsAValiderCount: rapportsCount,
    };
  }, [interventionsList, devisList, queues.rapportsEnAttente]);

  // =========================================================================
  // PLANNING DU JOUR
  // =========================================================================
  const { todayMissions, isFallbackUpcoming } = useMemo(() => {
    // Interventions de la date du jour
    const forToday = interventionsList.filter((i) => {
      const d = i.datePlanifiee || i.dateDebut || '';
      return d.slice(0, 10) === todayParisISO;
    });

    if (forToday.length > 0) {
      // Trier par heure de début
      const sorted = [...forToday].sort((a, b) =>
        (a.heureDebut || '08:00').localeCompare(b.heureDebut || '08:00')
      );
      return { todayMissions: sorted.slice(0, 6), isFallbackUpcoming: false };
    }

    // Si aucune intervention aujourd'hui, afficher les prochaines missions planifiées
    const upcoming = interventionsList
      .filter((i) => ['Planifiée', 'En cours', 'À planifier'].includes(i.statutOperationnel || ''))
      .sort((a, b) => (a.datePlanifiee || '9999').localeCompare(b.datePlanifiee || '9999'));

    return { todayMissions: upcoming.slice(0, 5), isFallbackUpcoming: true };
  }, [interventionsList, todayParisISO]);

  // =========================================================================
  // ACTIVITÉ PAR CORPS D'ÉTAT (MATRICE MÉTIER ANELEC)
  // =========================================================================
  const tradeRows = useMemo(() => {
    const corpsEtatDefs = [
      { trade: 'Électricité', label: 'Électricité' },
      { trade: 'Plomberie', label: 'Plomberie' },
      { trade: 'Serrurerie', label: 'Serrurerie' },
      { trade: 'Peinture', label: 'Peinture' },
      { trade: 'Menuiserie', label: 'Menuiserie' },
      { trade: 'Tous corps', label: 'Tous corps d’état' },
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
      const progressPct =
        intvs.length > 0 ? Math.round((closedIntvs.length / intvs.length) * 100) : 0;

      return {
        ...def,
        totalIntvs: intvs.length,
        activeIntvs: activeIntvs.length,
        closedIntvs: closedIntvs.length,
        devisCount: devis.length,
        caTrade,
        progressPct,
      };
    });
  }, [interventionsList, devisList]);

  // Helper pour formater l'horaire
  const formatTimeSlot = (i: Intervention) => {
    if (i.heureDebut && i.heureFin) {
      return `${i.heureDebut} – ${i.heureFin}`;
    }
    if (i.heureDebut) {
      return `À partir de ${i.heureDebut}`;
    }
    return 'Journée';
  };

  // Helper pour les badges d'état
  const renderStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'En cours':
        return <span className="badge badge--success">En cours</span>;
      case 'Planifiée':
        return <span className="badge badge--info">Planifiée</span>;
      case 'Terminée - à valider':
      case 'Clôturée':
        return <span className="badge badge--success">Terminée</span>;
      case 'Bloquée':
      case 'En retard':
        return <span className="badge badge--danger">Bloquée</span>;
      default:
        return <span className="badge badge--neutral">{status || 'À planifier'}</span>;
    }
  };

  return (
    <div className="dashboard-container">
      {/* =====================================================================
          EN-TÊTE DU TABLEAU DE BORD (Conforme à image1.jpg)
         ===================================================================== */}
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <div className="dashboard-header__titles">
            <h1 className="dashboard-header__title">Tableau de bord</h1>
            <p className="dashboard-header__description">
              Vue d’ensemble de l’activité, des interventions et du chiffre d’affaires ANELEC.
            </p>
          </div>
          <div className="dashboard-header__actions">
            <div className="date-pill" title="Période en cours">
              <span className="date-pill__dot" />
              <span>Ce mois-ci · {currentMonthLabel}</span>
            </div>
            {onOpenSituationModal && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={onOpenSituationModal}
                title="Exporter un rapport de situation complet en fichier Excel (.xlsx)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
                <span>Situation Excel</span>
              </button>
            )}
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
              <span>Nouvelle intervention</span>
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
          1. LES 4 CARTES KPI (Conforme à image1.jpg)
         ===================================================================== */}
      <section className="kpi-grid" aria-label="Indicateurs clés">
        {/* KPI 1 : CA travaux réalisés */}
        <div
          className="kpi-card"
          onClick={() => onNavigateSection('interventions')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateSection('interventions')}
          title="Cliquez pour afficher les interventions réalisées"
        >
          <div className="kpi-card__label">CA travaux réalisés</div>
          <div className="kpi-card__value kpi-card__value--highlight">
            {formatCurrency(totalCAClotureHT)}
          </div>
          <div className="kpi-card__context" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="kpi-card__badge kpi-card__badge--success">
              {interventionsList.filter((i) => ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel || '')).length} clôturées
            </span>
            <span>Exécuté ce mois</span>
          </div>
        </div>

        {/* KPI 2 : Prêt à facturer */}
        <div
          className="kpi-card"
          onClick={() => onNavigateSection('facturation')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateSection('facturation')}
          title="Cliquez pour accéder au module de facturation"
        >
          <div className="kpi-card__label">Prêt à facturer</div>
          <div className="kpi-card__value">
            {formatCurrency(totalAFacturerHT)}
          </div>
          <div className="kpi-card__context">
            <span className="kpi-card__subtext">
              {intvAFacturerCount} chantier{intvAFacturerCount > 1 ? 's' : ''} terminé{intvAFacturerCount > 1 ? 's' : ''} à valider
            </span>
          </div>
        </div>

        {/* KPI 3 : Devis à suivre */}
        <div
          className="kpi-card"
          onClick={() => onNavigateSection('devis')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateSection('devis')}
          title="Cliquez pour ouvrir le pipeline de devis"
        >
          <div className="kpi-card__label">Devis à suivre</div>
          <div className="kpi-card__value">
            {devisASuivreCount}
          </div>
          <div className="kpi-card__context">
            <span className="kpi-card__subtext">
              {devisAcceptesCount} devis accepté{devisAcceptesCount > 1 ? 's' : ''} ({tauxTransformation}% signés)
            </span>
          </div>
        </div>

        {/* KPI 4 : Rapports à valider */}
        <div
          className="kpi-card"
          onClick={onGoAdminRapports}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onGoAdminRapports()}
          title="Cliquez pour vérifier les rapports et photos reçus"
        >
          <div className="kpi-card__label">Rapports à valider</div>
          <div
            className={`kpi-card__value ${rapportsAValiderCount > 0 ? 'kpi-card__value--warning' : ''}`}
          >
            {rapportsAValiderCount}
          </div>
          <div className="kpi-card__context">
            <span className="kpi-card__subtext">
              {rapportsAValiderCount > 0
                ? `${rapportsAValiderCount} rapport${rapportsAValiderCount > 1 ? 's' : ''} avec photos terrain`
                : 'Aucun rapport en attente'}
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. GRILLE À 2 COLONNES (À traiter en priorité & Planning du jour)
         ===================================================================== */}
      <section className="dashboard-grid">
        {/* Colonne Gauche : À traiter en priorité */}
        <div className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">À traiter en priorité</h2>
              <p className="panel__description">
                Dossiers nécessitant une décision rapide
              </p>
            </div>
          </div>
          <div className="panel__body">
            {/* Priorité 1 : Rapports terrain en attente */}
            {queues.rapportsEnAttente.length > 0 && (
              <div className="priority-item">
                <div className="priority-item__icon" aria-hidden="true">
                  !
                </div>
                <div className="priority-item__content">
                  <div className="priority-item__title">
                    Valider les rapports terrain ({queues.rapportsEnAttente.length})
                  </div>
                  <div className="priority-item__description">
                    {queues.rapportsEnAttente.slice(0, 2).map((r) => r.reference || `INT-${r.id}`).join(', ')}
                    {queues.rapportsEnAttente.length > 2 ? ` et ${queues.rapportsEnAttente.length - 2} autre(s)` : ''} reçus avec photos.
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={onGoAdminRapports}
                  >
                    Valider le rapport →
                  </button>
                </div>
              </div>
            )}

            {/* Priorité 2 : Devis acceptés à convertir en intervention */}
            {queues.devisAcceptesSansIntv.length > 0 && (
              <div className="priority-item">
                <div className="priority-item__icon" aria-hidden="true">
                  !
                </div>
                <div className="priority-item__content">
                  <div className="priority-item__title">
                    Créer les interventions signées ({queues.devisAcceptesSansIntv.length})
                  </div>
                  <div className="priority-item__description">
                    Devis acceptés en attente d’ordre de mission :{' '}
                    {queues.devisAcceptesSansIntv[0].reference || `DEV-${queues.devisAcceptesSansIntv[0].id}`} — {queues.devisAcceptesSansIntv[0].client}
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => onConvertDevis(queues.devisAcceptesSansIntv[0])}
                  >
                    Créer l’intervention →
                  </button>
                </div>
              </div>
            )}

            {/* Priorité 3 : Devis à relancer */}
            {queues.devisARelancer.length > 0 && (
              <div className="priority-item">
                <div className="priority-item__icon" aria-hidden="true">
                  !
                </div>
                <div className="priority-item__content">
                  <div className="priority-item__title">
                    Relancer les devis en attente ({queues.devisARelancer.length})
                  </div>
                  <div className="priority-item__description">
                    {queues.devisARelancer[0].client} — {queues.devisARelancer[0].objet || 'Prestation TCE'} (échéance relance)
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      onOpenDevis(queues.devisARelancer[0]);
                    }}
                  >
                    Relancer le devis →
                  </button>
                </div>
              </div>
            )}

            {/* Priorité 4 : Interventions terminées à facturer */}
            {queues.intvAFacturer.length > 0 && (
              <div className="priority-item">
                <div className="priority-item__icon" aria-hidden="true">
                  !
                </div>
                <div className="priority-item__content">
                  <div className="priority-item__title">
                    Interventions à facturer ({queues.intvAFacturer.length})
                  </div>
                  <div className="priority-item__description">
                    {queues.intvAFacturer[0].reference || `INT-${queues.intvAFacturer[0].id}`} ({queues.intvAFacturer[0].client}) prêt pour émission de facture.
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => onNavigateSection('facturation')}
                  >
                    Accéder à la facturation →
                  </button>
                </div>
              </div>
            )}

            {/* Si aucune urgence critique */}
            {queues.rapportsEnAttente.length === 0 &&
              queues.devisAcceptesSansIntv.length === 0 &&
              queues.devisARelancer.length === 0 &&
              queues.intvAFacturer.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>✓</div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--color-text)' }}>
                    Toutes les priorités sont à jour
                  </div>
                  <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
                    Aucun rapport en attente, devis bloqué ou intervention urgente non traitée.
                  </p>
                </div>
              )}
          </div>
        </div>

        {/* Colonne Droite : Planning du jour */}
        <div className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Planning du jour</h2>
              <p className="panel__description">
                {isFallbackUpcoming
                  ? 'Prochaines missions programmées'
                  : `${todayMissions.length} intervention${todayMissions.length > 1 ? 's' : ''} planifiée${todayMissions.length > 1 ? 's' : ''} aujourd’hui`}
              </p>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() => onNavigateSection('planning')}
              style={{ fontSize: '13px' }}
            >
              Voir le planning complet →
            </button>
          </div>
          <div className="panel__body">
            {todayMissions.length > 0 ? (
              todayMissions.map((item) => (
                <div
                  key={item.id}
                  className="schedule-item"
                  onClick={() => onOpenIntv(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onOpenIntv(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="schedule-item__time">
                    {formatTimeSlot(item)}
                  </div>
                  <div className="schedule-item__content">
                    <div className="schedule-item__name">
                      {item.client || 'Client'} · {item.reference || `INT-${item.id}`}
                    </div>
                    <div className="schedule-item__description">
                      {item.entreprise ? `${item.entreprise} · ` : ''}
                      {item.chantier || item.objet || 'Prestation sur site'}
                    </div>
                  </div>
                  <div className="schedule-item__badge">
                    {renderStatusBadge(item.statutOperationnel)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p style={{ fontSize: '13px' }}>Aucune intervention planifiée pour le moment.</p>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => onNavigateSection('planning')}
                  style={{ marginTop: '12px' }}
                >
                  Planifier sur le Gantt →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. TABLEAU ACTIVITÉ PAR MÉTIER (Conforme à image1.jpg)
         ===================================================================== */}
      <section className="panel" aria-label="Activité par corps d'état">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Activité par métier</h2>
            <p className="panel__description">
              Suivi de l’avancement et du chiffre d’affaires exécuté par corps d’état
            </p>
          </div>
          <button
            type="button"
            className="text-link"
            onClick={() => onNavigateSection('interventions')}
            style={{ fontSize: '13px' }}
          >
            Voir toutes les interventions →
          </button>
        </div>
        <div className="desktop-only-block table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Corps d’état</th>
                <th className="align-right">En cours</th>
                <th className="align-right">Terminées</th>
                <th className="align-right">Devis</th>
                <th className="align-right">CA réalisé</th>
                <th className="align-right" style={{ minWidth: '180px' }}>Progression</th>
              </tr>
            </thead>
            <tbody>
              {tradeRows.map((row) => (
                <tr
                  key={row.trade}
                  onClick={() => {
                    onFilterInterventions(row.trade);
                    onNavigateSection('interventions');
                  }}
                  style={{ cursor: 'pointer' }}
                  title={`Filtrer les interventions pour ${row.label}`}
                >
                  <td style={{ fontWeight: 600 }}>{row.label}</td>
                  <td className="align-right">{row.activeIntvs}</td>
                  <td className="align-right">{row.closedIntvs}</td>
                  <td className="align-right">{row.devisCount}</td>
                  <td className="align-right amount">
                    {formatCurrency(row.caTrade)}
                  </td>
                  <td className="align-right">
                    <div className="progress-cell">
                      <progress
                        className="progress"
                        value={row.progressPct}
                        max="100"
                        aria-label={`Progression ${row.label}: ${row.progressPct}%`}
                      />
                      <span className="progress-cell__label">{row.progressPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Vue Mobile Tactile : Cartes Métiers & Progression */}
        <div className="mobile-only-block mobile-card-grid" style={{ padding: '12px 14px' }}>
          {tradeRows.map((row) => (
            <div
              key={row.trade}
              className="mobile-touch-card"
              onClick={() => {
                onFilterInterventions(row.trade);
                onNavigateSection('interventions');
              }}
              style={{
                background: '#fff',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                  {row.label}
                </span>
                <span className="font-mono" style={{ fontWeight: 800, fontSize: '13px', color: '#047857' }}>
                  {formatCurrency(row.caTrade)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                <span>▸ {row.activeIntvs} en cours • ✓ {row.closedIntvs} terminées</span>
                <span>≡ {row.devisCount} devis</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, row.progressPct)}%`, background: '#00bf63', height: '100%' }} />
                </div>
                <span className="font-mono" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {row.progressPct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PIED DE PAGE DISCRET DU TABLEAU DE BORD */}
      <footer className="dashboard-footer">
        <span>Système d’Exploitation TCE ANELEC GROUPE · Paris {techniciensList ? `· ${techniciensList.length} techniciens actifs` : ''}</span>
        <span>Données synchronisées en temps réel</span>
      </footer>
    </div>
  );
}
