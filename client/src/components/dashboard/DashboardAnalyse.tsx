import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  PieChart,
  ChevronRight,
  Euro,
  FileText,
  Activity,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import { Devis, Intervention, formatCurrency } from '../../lib/api';
import { DashboardQueues } from './DashboardSynthese';
import { DashboardHeader } from './DashboardHeader';

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

const ATLAS_CHART_COLORS = [
  '#1D4ED8', // Bleu roi Atlas
  '#10B981', // Vert émeraude
  '#F59E0B', // Ambre
  '#6366F1', // Indigo
  '#0EA5E9', // Cyan ciel
  '#EC4899', // Rose fuchsia
];

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="m-chart-tip">
      <strong>{label}</strong>
      <span>{formatCurrency(payload[0].value)} HT</span>
    </div>
  );
}

export function DashboardAnalyse({
  devisList = [],
  interventionsList = [],
  queues,
  activeTab,
  onTabChange,
  onNavigateSection,
  onNewIntv,
  onFilterInterventions,
  onGoAdminRapports,
}: DashboardAnalyseProps) {
  // Alertes opérationnelles
  const totalAlerts =
    (queues?.rapportsEnAttente?.length || 0) +
    (queues?.intvAPlanifier?.length || 0) +
    (queues?.devisAcceptesSansIntv?.length || 0);

  // 1. Calculs entonnoir (Funnel)
  const funnelData = useMemo(() => {
    const devisEnCours = devisList.filter(
      (d) => !['Refusé', 'Annulé'].includes(d.statutCommercial || '')
    );
    const devisVisites = devisList.filter((d) => Boolean(d.visiteNecessaire));
    const missionsAPlanifier =
      (queues?.visitesDevisAPlanifier?.length || 0) + (queues?.intvAPlanifier?.length || 0);
    const missionsPlanifiees = interventionsList.filter(
      (i) => i.statutOperationnel === 'Planifiée'
    );
    const intvEnCours = interventionsList.filter(
      (i) => i.statutOperationnel === 'En cours'
    );
    const rapportsAValider = queues?.rapportsEnAttente?.length || 0;
    const cloturees = interventionsList.filter((i) =>
      ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel || '')
    );
    const facturees = interventionsList.filter((i) => i.statutFacture === 'Facturée');

    const devisVal = devisEnCours.length;
    const planVal = missionsPlanifiees.length;
    const encoursVal = intvEnCours.length;
    const rapportsVal = rapportsAValider;
    const clotureesVal = cloturees.length;
    const factureesVal = facturees.length;
    const pctFact = clotureesVal > 0 ? Math.round((factureesVal / clotureesVal) * 100) : 0;

    return [
      {
        step: 'Devis & chiffrages',
        value: devisVal,
        hint: `${devisVisites.length} visites requises`,
        action: () => onNavigateSection('devis'),
      },
      {
        step: 'Ordonnancement',
        value: planVal,
        hint: `${missionsAPlanifier} missions à affecter`,
        action: () => onNavigateSection('planning'),
      },
      {
        step: 'Terrain en direct',
        value: encoursVal,
        hint: 'interventions en cours',
        action: () => onNavigateSection('interventions'),
      },
      {
        step: 'Contrôle & rapports',
        value: rapportsVal,
        hint: 'À valider avant facture',
        action: onGoAdminRapports,
      },
      {
        step: 'Clôturées & facturées',
        value: clotureesVal,
        hint: `${factureesVal} facturées (${pctFact} %)`,
        action: () => onNavigateSection('facturation'),
      },
    ];
  }, [devisList, interventionsList, queues, onNavigateSection, onGoAdminRapports]);

  // 2. KPIs Pipeline
  const pipelineStats = useMemo(() => {
    const devisEnCours = devisList.filter(
      (d) => !['Refusé', 'Annulé'].includes(d.statutCommercial || '')
    );
    const devisAcceptes = devisList.filter((d) => d.statutCommercial === 'Accepté');
    const totalPipelineHT = devisEnCours.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    const totalAccepteHT = devisAcceptes.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    const tauxTransfo =
      devisList.length > 0
        ? Math.round((devisAcceptes.length / devisList.length) * 100)
        : 0;
    const panierMoyen =
      devisList.length > 0
        ? Math.round(totalPipelineHT / devisList.length)
        : 0;

    return {
      pipelineTotal: totalPipelineHT,
      devisCount: devisEnCours.length,
      accepteTotal: totalAccepteHT,
      acceptesCount: devisAcceptes.length,
      tauxTransfo,
      panierMoyen,
    };
  }, [devisList]);

  // 3. CA par donneur d'ordre (Graphique Recharts BarChart)
  const caByClient = useMemo(() => {
    const totalsByClient: Record<string, number> = {};
    interventionsList.forEach((i) => {
      const name = i.client || 'Sans client';
      const amount = Number(i.amount) || 0;
      totalsByClient[name] = (totalsByClient[name] || 0) + amount;
    });

    return Object.entries(totalsByClient)
      .map(([name, ca]) => ({ name, ca }))
      .filter((e) => e.ca > 0)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 6);
  }, [interventionsList]);

  // 4. Performance par corps d'état
  const corpsStats = useMemo(() => {
    const trades = ['Électricité', 'Plomberie', 'Peinture', 'Menuiserie', 'Serrurerie', 'CVC / Climatisation'];
    return trades.map((corps) => {
      const key = corps.toLowerCase();
      const intvs = interventionsList.filter((i) => (i.corpsEtat || '').toLowerCase().includes(key));
      const actifs = intvs.filter((i) =>
        ['À planifier', 'Planifiée', 'En cours'].includes(i.statutOperationnel || '')
      ).length;
      const done = intvs.filter((i) => ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel || ''));
      const ca = done.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
      const pct = intvs.length > 0 ? Math.round((done.length / intvs.length) * 100) : 0;
      return { corps, actifs, clotures: done.length, ca, pct };
    });
  }, [interventionsList]);

  return (
    <div className="m-page" data-testid="atlas-screen-dashboard-analyse">
      {/* HEADER DE PAGE ATLAS UNIFIÉ */}
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        alertCount={totalAlerts}
        onNewIntv={onNewIntv}
        onNewDevis={() => onNavigateSection('devis')}
      />

      <div className="m-dash m-dash--analyse" data-testid="mock-dashboard-analyse">
        {/* ENTONNOIR D'AVANCEMENT */}
        <section className="m-card" data-testid="mock-funnel">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <PieChart size={16} className="m-card-icon" />
                Entonnoir d’avancement
              </h2>
              <p>Du chiffrage à la facturation, en temps réel</p>
            </div>
            <div className="m-card-actions">
              <span className="m-pill m-pill--green">Synchronisé</span>
            </div>
          </header>
          <div className="m-card-body">
            <ol className="m-funnel">
              {funnelData.map((f, i) => (
                <React.Fragment key={f.step}>
                  <li
                    onClick={f.action}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    title={`Étape ${i + 1} · Cliquer pour accéder`}
                  >
                    <span className="m-funnel-step">Étape {i + 1}</span>
                    <strong>{f.step}</strong>
                    <b className="m-funnel-val">{f.value}</b>
                    <small>{f.hint}</small>
                  </li>
                  {i < funnelData.length - 1 && (
                    <ChevronRight className="m-funnel-arrow" size={18} />
                  )}
                </React.Fragment>
              ))}
            </ol>
          </div>
        </section>

        {/* 4 KPIS PIPELINE */}
        <div className="m-kpis m-kpis--4">
          <div className="m-kpi">
            <div className="m-kpi-row">
              <span className="m-kpi-label">Pipeline devis en cours</span>
              <span className="m-kpi-ic m-tone-blue">
                <FileText size={18} />
              </span>
            </div>
            <div className="m-kpi-val m-mono">{formatCurrency(pipelineStats.pipelineTotal)}</div>
            <div className="m-kpi-foot">
              <span className="m-kpi-hint">
                {pipelineStats.devisCount} chiffrage{pipelineStats.devisCount > 1 ? 's' : ''} émis
              </span>
            </div>
          </div>

          <div className="m-kpi">
            <div className="m-kpi-row">
              <span className="m-kpi-label">Devis signés</span>
              <span className="m-kpi-ic m-tone-green">
                <Euro size={18} />
              </span>
            </div>
            <div className="m-kpi-val m-mono">{formatCurrency(pipelineStats.accepteTotal)}</div>
            <div className="m-kpi-foot">
              <span className="m-kpi-hint">
                {pipelineStats.acceptesCount} devis validé{pipelineStats.acceptesCount > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="m-kpi">
            <div className="m-kpi-row">
              <span className="m-kpi-label">Taux de transformation</span>
              <span className="m-kpi-ic m-tone-teal">
                <Activity size={18} />
              </span>
            </div>
            <div className="m-kpi-val m-mono">{pipelineStats.tauxTransfo} %</div>
            <div className="m-kpi-foot">
              <span className="m-kpi-hint">Signatures / devis émis</span>
            </div>
          </div>

          <div className="m-kpi">
            <div className="m-kpi-row">
              <span className="m-kpi-label">Panier moyen</span>
              <span className="m-kpi-ic m-tone-amber">
                <Wrench size={18} />
              </span>
            </div>
            <div className="m-kpi-val m-mono">{formatCurrency(pipelineStats.panierMoyen)}</div>
            <div className="m-kpi-foot">
              <span className="m-kpi-hint">Par dossier chiffré</span>
            </div>
          </div>
        </div>

        {/* 2 COLONNES : GRAPHIQUE CA PAR DONNEUR D'ORDRE & PERFORMANCE CORPS D'ÉTAT */}
        <div className="m-grid-2 m-grid-2--wide">
          {/* Graphique CA par donneur d'ordre */}
          <section className="m-card" data-testid="mock-ca-client-chart">
            <header className="m-card-head">
              <div className="m-card-titles">
                <h2>CA par donneur d’ordre</h2>
                <p>Année 2026, HT</p>
              </div>
            </header>
            <div className="m-card-body">
              <div className="m-chart" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={caByClient}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--muted)', fontSize: 11 }}
                      tickFormatter={(v) => `${v / 1000}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--text)', fontSize: 12 }}
                    />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-2)' }} />
                    <Bar dataKey="ca" radius={[0, 6, 6, 0]} barSize={16}>
                      {caByClient.map((d, i) => (
                        <Cell
                          key={d.name}
                          fill={ATLAS_CHART_COLORS[i % ATLAS_CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Tableau de performance par corps d'état */}
          <section className="m-card" data-testid="mock-corps-table" style={{ padding: 0 }}>
            <header
              className="m-card-head"
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="m-card-titles">
                <h2>Performance par corps d’état</h2>
                <p>Chantiers, devis et complétion</p>
              </div>
              <div className="m-card-actions">
                <button
                  type="button"
                  className="m-btn m-btn--ghost m-btn--sm"
                  onClick={() => onNavigateSection('rentabilite')}
                  data-testid="mock-analyse-open-compta"
                >
                  <span>Rentabilité</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </header>
            <div className="m-card-body" style={{ padding: 0 }}>
              <table className="m-table m-table--compact">
                <thead>
                  <tr>
                    <th>Corps d’état</th>
                    <th style={{ textAlign: 'right' }}>Actifs</th>
                    <th style={{ textAlign: 'right' }}>Clôturés</th>
                    <th style={{ textAlign: 'right' }}>CA HT</th>
                    <th>Complétion</th>
                  </tr>
                </thead>
                <tbody>
                  {corpsStats.map((s) => (
                    <tr
                      key={s.corps}
                      onClick={() => {
                        onFilterInterventions(s.corps);
                        onNavigateSection('interventions');
                      }}
                      style={{ cursor: 'pointer' }}
                      title={`Filtrer les interventions ${s.corps}`}
                    >
                      <td>
                        <strong>{s.corps}</strong>
                      </td>
                      <td style={{ textAlign: 'right' }} className="m-mono">
                        {s.actifs}
                      </td>
                      <td style={{ textAlign: 'right' }} className="m-mono">
                        {s.clotures}
                      </td>
                      <td style={{ textAlign: 'right' }} className="m-mono">
                        {formatCurrency(s.ca)}
                      </td>
                      <td>
                        <div className="m-inline-prog">
                          <div className="m-progress">
                            <div
                              className="m-progress-bar"
                              style={{ width: `${s.pct}%` }}
                            />
                          </div>
                          <span className="m-mono m-small">{s.pct} %</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
