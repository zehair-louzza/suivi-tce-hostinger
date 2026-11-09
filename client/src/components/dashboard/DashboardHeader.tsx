import { useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  ChevronDown,
  LayoutGrid,
  Wrench,
  PieChart,
  FileText,
  Check,
} from 'lucide-react';

interface DashboardHeaderProps {
  activeTab: 'synthese' | 'operations' | 'analyse';
  onTabChange: (tab: 'synthese' | 'operations' | 'analyse') => void;
  alertCount?: number;
  onNewDevis?: () => void;
  onNewIntv?: () => void;
  period?: string;
  onPeriodChange?: (period: string) => void;
}

export function DashboardHeader({
  activeTab,
  onTabChange,
  alertCount = 3,
  onNewDevis,
  onNewIntv,
  period = 'month',
  onPeriodChange,
}: DashboardHeaderProps) {
  const [currentPeriod, setCurrentPeriod] = useState(period);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

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

  const periodLabel = useMemo(() => {
    switch (currentPeriod) {
      case 'today':
        return 'Aujourd’hui';
      case 'week':
        return 'Cette semaine';
      case 'year':
        return 'Année 2026';
      case 'month':
      default:
        try {
          const m = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
          return m.charAt(0).toUpperCase() + m.slice(1);
        } catch {
          return 'Novembre 2026';
        }
    }
  }, [currentPeriod]);

  const handleSelectPeriod = (val: string) => {
    setCurrentPeriod(val);
    setPeriodOpen(false);
    onPeriodChange?.(val);
  };

  return (
    <>
      <header className="m-page-head">
        <div className="m-page-titles">
          <span className="m-eyebrow">{todayFormatted}</span>
          <h1>Tableau de bord</h1>
          <p>Vue d’ensemble de l’activité, des interventions et du chiffre d’affaires.</p>
        </div>
        <div className="m-page-actions">
          {/* Période Dropdown */}
          <div className="m-dd">
            <button
              type="button"
              className="m-dd-btn"
              onClick={() => {
                setPeriodOpen((v) => !v);
                setNewMenuOpen(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={periodOpen}
            >
              <CalendarDays size={16} />
              <span>{periodLabel}</span>
              <ChevronDown size={14} />
            </button>
            {periodOpen && (
              <div className="m-menu" role="listbox">
                {[
                  { id: 'today', label: 'Aujourd’hui' },
                  { id: 'week', label: 'Cette semaine' },
                  { id: 'month', label: periodLabel },
                  { id: 'year', label: 'Année 2026' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={currentPeriod === opt.id}
                    className={`m-menu-item ${currentPeriod === opt.id ? 'is-active' : ''}`}
                    onClick={() => handleSelectPeriod(opt.id)}
                  >
                    <span>{opt.label}</span>
                    {currentPeriod === opt.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bouton + Nouveau groupé */}
          <div className="m-dd">
            <button
              type="button"
              className="m-btn m-btn--primary m-btn--md"
              onClick={() => {
                setNewMenuOpen((v) => !v);
                setPeriodOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={newMenuOpen}
            >
              <Plus size={16} />
              <span>Nouveau</span>
              <ChevronDown size={14} />
            </button>
            {newMenuOpen && (
              <div className="m-menu m-menu--right" role="menu">
                <button
                  type="button"
                  className="m-menu-item"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onNewDevis?.();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} />
                    <span>Devis</span>
                  </div>
                  <span className="m-mono m-small" style={{ color: 'var(--muted)' }}>D</span>
                </button>
                <button
                  type="button"
                  className="m-menu-item"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onNewIntv?.();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wrench size={16} />
                    <span>Intervention</span>
                  </div>
                  <span className="m-mono m-small" style={{ color: 'var(--muted)' }}>I</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SubNav avec onglets Atlas */}
      <div className="m-page-sub">
        <nav className="m-subnav" aria-label="Onglets du tableau de bord">
          <button
            type="button"
            className={`m-subnav-item ${activeTab === 'synthese' ? 'is-active' : ''}`}
            onClick={() => onTabChange('synthese')}
          >
            <LayoutGrid size={16} />
            <span>Synthèse</span>
          </button>
          <button
            type="button"
            className={`m-subnav-item ${activeTab === 'operations' ? 'is-active' : ''}`}
            onClick={() => onTabChange('operations')}
          >
            <Wrench size={16} />
            <span>Opérations</span>
            {alertCount > 0 && <em className="is-alert">{alertCount}</em>}
          </button>
          <button
            type="button"
            className={`m-subnav-item ${activeTab === 'analyse' ? 'is-active' : ''}`}
            onClick={() => onTabChange('analyse')}
          >
            <PieChart size={16} />
            <span>Analyse</span>
          </button>
        </nav>
      </div>
    </>
  );
}
