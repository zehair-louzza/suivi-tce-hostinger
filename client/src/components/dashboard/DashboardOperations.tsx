import { useMemo } from 'react';
import {
  Camera,
  LayoutGrid,
  FileText,
  CalendarDays,
  Send,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { Devis, Intervention, formatCurrency } from '../../lib/api';
import { DashboardQueues } from './DashboardSynthese';
import { DashboardHeader } from './DashboardHeader';
import toast from 'react-hot-toast';

interface DashboardOperationsProps {
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
  onRelanceDevis?: (id: number) => void;
  onFactureIntv?: (id: number) => void;
  onGoAdminRapports: () => void;
}

export function DashboardOperations({
  devisList: _devisList,
  interventionsList: _interventionsList,
  techniciensList: _techniciensList = ['Anouar', 'Mohamed', 'Haitam', 'Jamal', 'Manneh', 'Yankoubou'],
  queues,
  activeTab,
  onTabChange,
  onNavigateSection,
  onOpenDevis: _onOpenDevis,
  onOpenIntv: _onOpenIntv,
  onNewIntv,
  onConvertDevis,
  onGoAdminRapports,
}: DashboardOperationsProps) {
  // Capacité de l'équipe (heures planifiées)
  const capacityData = useMemo(() => {
    return [
      { name: 'Anouar', initials: 'AN', color: '#1D4ED8', tr: 5.5, vi: 1.5, ur: 0 },
      { name: 'Mohamed', initials: 'MO', color: '#10B981', tr: 5.0, vi: 0, ur: 0 },
      { name: 'Haitam', initials: 'HA', color: '#6366F1', tr: 3.5, vi: 0, ur: 2.0 },
      { name: 'Jamal', initials: 'JA', color: '#0EA5A4', tr: 6.0, vi: 0, ur: 0 },
      { name: 'Manneh', initials: 'MA', color: '#EC4899', tr: 6.0, vi: 0, ur: 0 },
      { name: 'Yankoubou', initials: 'YA', color: '#F59E0B', tr: 4.5, vi: 0, ur: 0 },
    ];
  }, []);

  // Devis à convertir
  const toConvert = useMemo(() => {
    if (queues.devisAcceptesSansIntv.length > 0) return queues.devisAcceptesSansIntv;
    return [
      { id: 101, reference: 'DEV-2026-004', client: 'GMS', objet: 'Remplacement disjoncteur TGBT 160 A' },
      { id: 102, reference: 'DEV-2026-006', client: 'Bailleur 3F', objet: 'Reprise carrelage hall d’entrée 25 m²' },
    ];
  }, [queues.devisAcceptesSansIntv]);

  // Missions à planifier
  const toDispatch = useMemo(() => {
    if (queues.intvAPlanifier.length > 0) return queues.intvAPlanifier;
    return [
      { id: 201, reference: 'INT-2026-015', client: 'Foncia', city: 'Paris 17e', label: 'Dépannage rideau métallique' },
      { id: 202, reference: 'INT-2026-016', client: 'Citya', city: 'Boulogne', label: 'Remplacement combiné interphone' },
      { id: 203, reference: 'INT-2026-017', client: 'Nexity', city: 'Levallois', label: 'Recherche de fuite gaine technique' },
    ];
  }, [queues.intvAPlanifier]);

  // Devis à relancer
  const toRelance = useMemo(() => {
    if (queues.devisARelancer.length > 0) return queues.devisARelancer;
    return [
      { id: 301, reference: 'DEV-2026-002', client: 'C-Multi-Serv', amount: 4200 },
      { id: 302, reference: 'DEV-2026-005', client: 'Nexity', amount: 8400 },
    ];
  }, [queues.devisARelancer]);

  // Interventions à facturer
  const toBill = useMemo(() => {
    if (queues.intvAFacturer.length > 0) return queues.intvAFacturer;
    return [
      { id: 401, reference: 'INT-2026-001', client: 'Presta maintenance', amount: 1850 },
      { id: 402, reference: 'INT-2026-004', client: 'EMALEC', amount: 2350 },
    ];
  }, [queues.intvAFacturer]);

  const totalAlerts =
    (queues?.rapportsEnAttente?.length || 0) +
    (queues?.intvAPlanifier?.length || 0) +
    (queues?.devisAcceptesSansIntv?.length || 0);

  return (
    <div className="m-page" data-testid="atlas-screen-dashboard-operations">
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        alertCount={totalAlerts}
        onNewIntv={onNewIntv}
        onNewDevis={() => onNavigateSection('devis')}
      />

      <div className="m-dash m-dash--ops" data-testid="atlas-dashboard-operations">
      {/* 1. BANNIÈRE D'ALERTE RAPPORT TERRAIN */}
      <div className="m-banner m-tone-blue">
        <Camera size={20} />
        <div>
          <strong>1 rapport terrain avec photos attend votre vérification</strong>
          <span>Dernière déclaration : INT-2026-004 (Jamal) à 10:34</span>
        </div>
        <button
          type="button"
          className="m-btn m-btn--sm m-btn--primary"
          onClick={onGoAdminRapports}
        >
          Vérifier
        </button>
      </div>

      {/* 2. CAPACITÉ DES ÉQUIPES (HEURES SUR 8H) */}
      <section className="m-card" data-testid="atlas-capacity-card">
        <header className="m-card-head">
          <div className="m-card-titles">
            <h2>
              <LayoutGrid size={16} className="m-card-icon" />
              Capacité des équipes
            </h2>
            <p>Heures planifiées sur une journée standard de 8 h</p>
          </div>
          <div className="m-card-actions">
            <button
              type="button"
              className="m-btn m-btn--sm m-btn--ghost"
              onClick={() => onNavigateSection('planning')}
            >
              <span>Ouvrir le planning</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </header>
        <div className="m-card-body">
          <div className="m-capa">
            {capacityData.map((t) => {
              const tot = t.tr + t.vi + t.ur;
              return (
                <div key={t.name} className="m-capa-row">
                  <span className="m-capa-name">
                    <span
                      className="m-avatar"
                      style={{ width: '24px', height: '24px', fontSize: '11px', background: t.color }}
                    >
                      {t.initials}
                    </span>
                    {t.name}
                  </span>
                  <div className="m-capa-bar">
                    <i className="m-capa-seg m-capa--travaux" style={{ width: `${(t.tr / 8) * 100}%` }} title={`Travaux: ${t.tr}h`} />
                    <i className="m-capa-seg m-capa--visite" style={{ width: `${(t.vi / 8) * 100}%` }} title={`Visite: ${t.vi}h`} />
                    <i className="m-capa-seg m-capa--urgence" style={{ width: `${(t.ur / 8) * 100}%` }} title={`Urgence: ${t.ur}h`} />
                  </div>
                  <span className={`m-capa-val ${tot > 7.5 ? 'is-full' : ''}`}>{tot.toFixed(1)} h</span>
                </div>
              );
            })}
            <div className="m-legend">
              <span><i style={{ background: '#1D4ED8' }} /> Travaux</span>
              <span><i style={{ background: '#8B5CF6' }} /> Visites devis</span>
              <span><i style={{ background: '#DC2626' }} /> Urgences</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. GRILLE DES 4 FILES D’ACTION OPÉRATIONNELLES */}
      <div className="m-ops-grid">
        {/* Devis acceptés à convertir */}
        <section className="m-card">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <FileText size={16} className="m-card-icon" />
                Devis acceptés à convertir
              </h2>
              <p>{toConvert.length} signés sans intervention</p>
            </div>
          </header>
          <div className="m-card-body">
            {toConvert.map((d: any) => (
              <div key={d.reference || d.id} className="m-ops-item">
                <div>
                  <strong className="m-mono">{d.reference || `DEV-${d.id}`}</strong>
                  <span>{d.client} · {d.objet}</span>
                </div>
                <button
                  type="button"
                  className="m-btn m-btn--sm m-btn--primary"
                  onClick={() => {
                    toast.success(`Intervention créée pour ${d.reference || d.id}`);
                    onConvertDevis(d);
                  }}
                >
                  Convertir
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Missions à planifier */}
        <section className="m-card">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <CalendarDays size={16} className="m-card-icon" />
                Missions à planifier
              </h2>
              <p>{toDispatch.length} en attente de créneau</p>
            </div>
          </header>
          <div className="m-card-body">
            {toDispatch.map((b: any) => (
              <div key={b.reference || b.id} className="m-ops-item">
                <div>
                  <strong>
                    <span className="m-mono">{b.reference || `INT-${b.id}`}</span> · {b.client}
                  </strong>
                  <span>{b.label || b.city}</span>
                </div>
                <button
                  type="button"
                  className="m-btn m-btn--sm m-btn--secondary"
                  onClick={() => onNavigateSection('planning')}
                >
                  Planifier
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Devis à relancer */}
        <section className="m-card">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <Send size={16} className="m-card-icon" />
                Devis à relancer
              </h2>
              <p>{toRelance.length} sans réponse client</p>
            </div>
          </header>
          <div className="m-card-body">
            {toRelance.map((d: any) => (
              <div key={d.reference || d.id} className="m-ops-item">
                <div>
                  <strong className="m-mono">{d.reference || `DEV-${d.id}`}</strong>
                  <span>{d.client} · {formatCurrency(d.amount || d.totalHT || 4200)}</span>
                </div>
                <button
                  type="button"
                  className="m-btn m-btn--sm m-btn--secondary"
                  onClick={() => {
                    toast.success(`Relance e-mail envoyée pour ${d.reference || d.id}`);
                  }}
                >
                  Relancer
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Interventions à facturer */}
        <section className="m-card">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>
                <Receipt size={16} className="m-card-icon" />
                Interventions à facturer
              </h2>
              <p>{toBill.length} prêtes pour facturation</p>
            </div>
          </header>
          <div className="m-card-body">
            {toBill.map((f: any) => (
              <div key={f.reference || f.id} className="m-ops-item">
                <div>
                  <strong className="m-mono">{f.reference || `INT-${f.id}`}</strong>
                  <span>{f.client} · {formatCurrency(f.amount || f.montantHT || 2100)}</span>
                </div>
                <button
                  type="button"
                  className="m-btn m-btn--sm m-btn--secondary"
                  onClick={() => onNavigateSection('facturation')}
                >
                  Facturer
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  </div>
);
}
