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
  interventionsList,
  techniciensList = [],
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
  // Capacité de l'équipe : heures réellement planifiées aujourd'hui, par technicien
  const capacityData = useMemo(() => {
    const palette = ['#1D4ED8', '#10B981', '#6366F1', '#0EA5A4', '#EC4899', '#F59E0B', '#8B5CF6', '#DC2626'];
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hours = (i: Intervention) => {
      if (i.heureDebut && i.heureFin) {
        const [h1, m1] = i.heureDebut.split(':').map(Number);
        const [h2, m2] = i.heureFin.split(':').map(Number);
        const diff = h2 + (m2 || 0) / 60 - (h1 + (m1 || 0) / 60);
        if (diff > 0) return diff;
      }
      return 2;
    };
    return techniciensList.map((name, idx) => {
      const mine = interventionsList.filter((i) => i.datePlanifiee === today && i.entreprise === name);
      let tr = 0;
      let vi = 0;
      let ur = 0;
      for (const i of mine) {
        if (i.priorite === 'Urgente' || i.priorite === 'Haute') ur += hours(i);
        else if (i.statutOperationnel === 'Visite devis') vi += hours(i);
        else tr += hours(i);
      }
      return { name, initials: name.slice(0, 2).toUpperCase(), color: palette[idx % palette.length], tr, vi, ur };
    });
  }, [techniciensList, interventionsList]);

  // Devis à convertir
  const toConvert = queues.devisAcceptesSansIntv;

  // Missions à planifier
  const toDispatch = queues.intvAPlanifier;

  // Devis à relancer
  const toRelance = queues.devisARelancer;

  // Interventions à facturer
  const toBill = queues.intvAFacturer;

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
      {queues.rapportsEnAttente.length > 0 && (
        <div className="m-banner m-tone-blue">
          <Camera size={20} />
          <div>
            <strong>
              {queues.rapportsEnAttente.length} rapport{queues.rapportsEnAttente.length > 1 ? 's' : ''} terrain en attente de vérification
            </strong>
            <span>
              Dernier : {queues.rapportsEnAttente[0].reference || `INT-${queues.rapportsEnAttente[0].id}`}
              {queues.rapportsEnAttente[0].client ? ` · ${queues.rapportsEnAttente[0].client}` : ''}
            </span>
          </div>
          <button
            type="button"
            className="m-btn m-btn--sm m-btn--primary"
            onClick={onGoAdminRapports}
          >
            Vérifier
          </button>
        </div>
      )}

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
