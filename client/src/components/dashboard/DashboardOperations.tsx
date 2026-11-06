import { useMemo } from 'react';
import { Devis, Intervention, formatCurrency, formatDateFR } from '../../lib/api';
import { DashboardQueues } from './DashboardSynthese';

interface DashboardOperationsProps {
  devisList: Devis[];
  interventionsList: Intervention[];
  techniciensList: string[];
  queues: DashboardQueues;
  activeTab: 'synthese' | 'operations' | 'analyse';
  onTabChange: (tab: 'synthese' | 'operations' | 'analyse') => void;
  onNavigateSection: (section: any) => void;
  onOpenDevis: (devis: Devis) => void;
  onOpenIntv: (intv: Intervention) => void;
  onNewIntv: () => void;
  onConvertDevis: (devis: Devis) => void;
  onRelanceDevis: (id: number) => void;
  onFactureIntv: (id: number) => void;
  onGoAdminRapports: () => void;
}

export function DashboardOperations({
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
  onRelanceDevis,
  onFactureIntv,
  onGoAdminRapports,
}: DashboardOperationsProps) {
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

  return (
    <div className="dashboard-container">
      {/* =====================================================================
          EN-TÊTE
         ===================================================================== */}
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <div className="dashboard-header__titles">
            <h1 className="dashboard-header__title">Tableau de bord · Opérations</h1>
            <p className="dashboard-header__description">
              Files de traitement opérationnelles, capacité des équipes et suivi du cycle de production TCE.
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
          BANNIÈRE D'ALERTE RAPPORTS TERRAIN & PHOTOS
         ===================================================================== */}
      {queues.rapportsEnAttente.length > 0 && (
        <div
          className="panel"
          style={{
            borderLeft: '4px solid #0284c7',
            background: 'var(--color-surface)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '18px',
              }}
            >
              📷
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text)' }}>
                {queues.rapportsEnAttente.length} rapport{queues.rapportsEnAttente.length > 1 ? 's' : ''} terrain avec photos reçus des techniciens en attente de vérification
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Dernières déclarations :{' '}
                {queues.rapportsEnAttente
                  .slice(0, 4)
                  .map((r) => `${r.reference || `INT-${r.id}`} (${r.entreprise || 'Tech'})`)
                  .join(' · ')}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onGoAdminRapports}
            style={{ whiteSpace: 'nowrap' }}
          >
            Vérifier dans le Centre des Rapports →
          </button>
        </div>
      )}

      {/* =====================================================================
          CAPACITÉ & DISPATCH ÉQUIPES TERRAIN
         ===================================================================== */}
      <section className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Capacité & Affectation des équipes terrain</h2>
            <p className="panel__description">
              Disponibilité temps réel et charge de travail par technicien
            </p>
          </div>
          <button
            type="button"
            className="text-link"
            onClick={() => onNavigateSection('planning')}
            style={{ fontSize: '13px' }}
          >
            Ouvrir la Console Dispatch & Gantt →
          </button>
        </div>
        <div className="panel__body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            {techniciensList.map((tech) => {
              const techIntvs = interventionsList.filter(
                (i) => i.entreprise === tech && i.statutOperationnel !== 'Clôturée'
              );
              const techVisites = devisList.filter(
                (d) => d.visiteTechnicien === tech && d.statutCommercial !== 'Refusé'
              );
              const totalMissions = techIntvs.length + techVisites.length;

              return (
                <div
                  key={tech}
                  onClick={() => onNavigateSection('planning')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onNavigateSection('planning')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                  title={`Cliquer pour afficher la piste Gantt de ${tech}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--color-text)' }}>
                      {tech}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: totalMissions > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {totalMissions} mission{totalMissions > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      fontSize: '11.5px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <span>{techVisites.length} visite{techVisites.length > 1 ? 's' : ''} devis</span>
                    <span>·</span>
                    <span>{techIntvs.length} chantier{techIntvs.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          LES 4 FILES D'ACTION OPÉRATIONNELLES (Action Queues)
         ===================================================================== */}
      <section className="operations-queues-grid">
        {/* File 1 : Devis acceptés à convertir */}
        <div className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Devis acceptés à convertir</h2>
              <p className="panel__description">
                {queues.devisAcceptesSansIntv.length > 0
                  ? `${queues.devisAcceptesSansIntv.length} devis signé(s) sans intervention créée`
                  : 'Tous les devis acceptés ont une intervention liée.'}
              </p>
            </div>
            {queues.devisAcceptesSansIntv.length > 0 && (
              <span className="badge badge--success">{queues.devisAcceptesSansIntv.length}</span>
            )}
          </div>
          <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queues.devisAcceptesSansIntv.length > 0 ? (
              queues.devisAcceptesSansIntv.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{ cursor: 'pointer', minWidth: 0 }}
                    onClick={() => onOpenDevis(d)}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                      <span style={{ color: 'var(--color-primary)' }}>{d.reference || `DEV-${d.id}`}</span> · {d.client}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px',
                      }}
                    >
                      {d.objet || d.site || 'Prestation TCE'} · {formatCurrency(d.amount || 0)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => onConvertDevis(d)}
                  >
                    Créer intervention
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Aucun devis en attente de conversion.
              </div>
            )}
          </div>
        </div>

        {/* File 2 : Visites devis & interventions à planifier */}
        <div className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Visites & travaux à planifier</h2>
              <p className="panel__description">
                {queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length > 0
                  ? `${queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length} créneau(x) à ordonnancer`
                  : 'Aucune mission en attente de créneau.'}
              </p>
            </div>
            {queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length > 0 && (
              <span className="badge badge--info">
                {queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length}
              </span>
            )}
          </div>
          <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queues.visitesDevisAPlanifier.slice(0, 3).map((d) => (
              <div
                key={`v-${d.id}`}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  borderLeft: '3px solid #7c3aed',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                    <span style={{ color: '#7c3aed' }}>[Visite devis]</span> {d.reference || `DEV-${d.id}`} · {d.client}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {d.site || d.objet || 'Visite technique requise'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                  onClick={() => onNavigateSection('planning')}
                >
                  Dispatcher →
                </button>
              </div>
            ))}

            {queues.intvAPlanifier.slice(0, 3).map((i) => (
              <div
                key={`i-${i.id}`}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  borderLeft: '3px solid #0284c7',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                    <span style={{ color: '#0284c7' }}>[Travaux]</span> {i.reference || `INT-${i.id}`} · {i.client}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {i.chantier || i.objet || 'Prestation'} · {i.corpsEtat || 'TCE'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                  onClick={() => onNavigateSection('planning')}
                >
                  Dispatcher →
                </button>
              </div>
            ))}

            {queues.visitesDevisAPlanifier.length === 0 && queues.intvAPlanifier.length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Toutes les visites et interventions sont planifiées.
              </div>
            )}
          </div>
        </div>

        {/* File 3 : Devis à relancer aujourd'hui */}
        <div className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Devis à relancer</h2>
              <p className="panel__description">
                {queues.devisARelancer.length > 0
                  ? `${queues.devisARelancer.length} relance(s) commerciale(s) échue(s)`
                  : 'Aucune relance commerciale en attente.'}
              </p>
            </div>
            {queues.devisARelancer.length > 0 && (
              <span className="badge badge--warning">{queues.devisARelancer.length}</span>
            )}
          </div>
          <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queues.devisARelancer.length > 0 ? (
              queues.devisARelancer.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{ cursor: 'pointer', minWidth: 0 }}
                    onClick={() => onOpenDevis(d)}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                      <span style={{ color: 'var(--color-warning)' }}>{d.reference || `DEV-${d.id}`}</span> · {d.client}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Échéance : {formatDateFR(d.dateRelance)} · Resp : {d.responsable || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => onRelanceDevis(d.id)}
                  >
                    Relancé (J+3)
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Aucun devis à relancer.
              </div>
            )}
          </div>
        </div>

        {/* File 4 : Interventions terminées à facturer */}
        <div className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Interventions terminées à facturer</h2>
              <p className="panel__description">
                {queues.intvAFacturer.length > 0
                  ? `${queues.intvAFacturer.length} chantier(s) clôturé(s) sans facture émise`
                  : 'Aucune intervention en attente de facturation.'}
              </p>
            </div>
            {queues.intvAFacturer.length > 0 && (
              <span className="badge badge--info">{queues.intvAFacturer.length}</span>
            )}
          </div>
          <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queues.intvAFacturer.length > 0 ? (
              queues.intvAFacturer.slice(0, 5).map((i) => (
                <div
                  key={i.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{ cursor: 'pointer', minWidth: 0 }}
                    onClick={() => onOpenIntv(i)}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                      <span style={{ color: 'var(--color-primary)' }}>{i.reference || `INT-${i.id}`}</span> · {i.client}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Montant : {formatCurrency(i.amount || 0)} · Tech : {i.entreprise || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => onFactureIntv(i.id)}
                  >
                    Marquer facturée
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Toutes les interventions clôturées sont facturées.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          CONTRÔLE QUALITÉ DES DONNÉES
         ===================================================================== */}
      {queues.anomaliesQualite.length > 0 && (
        <div
          className="panel"
          style={{
            borderLeft: '4px solid #64748b',
            background: 'var(--color-surface-subtle)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
              Contrôle qualité des données · {queues.anomaliesQualite.length} fiche(s) incomplète(s)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Exemples :{' '}
              {queues.anomaliesQualite
                .slice(0, 3)
                .map((a) => `${a.ref} (${a.message})`)
                .join(' · ')}
            </div>
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ fontSize: '12.5px' }}
            onClick={() => {
              const first = queues.anomaliesQualite[0];
              if (first.type === 'DEVIS') {
                onOpenDevis(first.item);
              } else {
                onOpenIntv(first.item);
              }
            }}
          >
            Compléter la 1ère fiche →
          </button>
        </div>
      )}
    </div>
  );
}
