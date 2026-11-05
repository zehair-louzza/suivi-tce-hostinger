import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export type AppSection =
  | 'aujourdhui'
  | 'planning'
  | 'devis'
  | 'interventions'
  | 'referentiels'
  | 'admin'
  | 'mobile_tech';

interface LayoutProps {
  children: ReactNode;
  activeSection?: AppSection;
  onSectionChange?: (section: AppSection) => void;
  badges?: {
    aujourdhui?: number;
    devis?: number;
    interventions?: number;
    planning?: number;
  };
  onOpenCommandPalette?: () => void;
  onQuickNewDevis?: () => void;
  onQuickNewIntervention?: () => void;
}

export function Layout({
  children,
  activeSection = 'aujourdhui',
  onSectionChange,
  badges,
  onOpenCommandPalette,
  onQuickNewDevis,
  onQuickNewIntervention,
}: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [parisTime, setParisTime] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('anelec-theme-v2');
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('anelec-theme-v2', theme);
  }, [theme]);

  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        setParisTime(
          new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Europe/Paris',
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(now)
        );
      } catch {
        setParisTime('');
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Session fermée');
      navigate('/login');
    } catch {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const navItems: {
    id: AppSection;
    label: string;
    subtitle: string;
    badge?: number;
    urgent?: boolean;
    shortcut: string;
    icon: JSX.Element;
  }[] = [
    {
      id: 'aujourdhui',
      label: 'Centre de Pilotage',
      subtitle: 'KPI & files prioritaires',
      badge: badges?.aujourdhui,
      urgent: (badges?.aujourdhui || 0) > 0,
      shortcut: '1',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'planning',
      label: 'Dispatch & Planning',
      subtitle: 'Gantt, Semaine & Auto-IA',
      badge: badges?.planning,
      urgent: (badges?.planning || 0) > 0,
      shortcut: '2',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M7 14h4" />
          <path d="M13 17h4" />
        </svg>
      ),
    },
    {
      id: 'devis',
      label: 'Pipeline Devis',
      subtitle: '22 colonnes & visites',
      badge: badges?.devis,
      shortcut: '3',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      ),
    },
    {
      id: 'interventions',
      label: 'Interventions TCE',
      subtitle: '23 colonnes & facturation',
      badge: badges?.interventions,
      shortcut: '4',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      id: 'referentiels',
      label: 'Référentiels Métier',
      subtitle: 'Équipes & paramètres',
      shortcut: '5',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      id: 'admin',
      label: 'Workstation Admin',
      subtitle: 'Droits, Pointages & Rapports',
      shortcut: '6',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'mobile_tech',
      label: 'App Mobile Technicien',
      subtitle: 'Pointage, Actions & Photos',
      shortcut: '7',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      ),
    },
  ];

  const isAdminOrManager =
    user?.id === 1 ||
    (user?.role || '').toUpperCase() === 'ADMIN' ||
    Boolean(user?.permissions?.canManageUsers) ||
    Boolean(user?.permissions?.canWriteReports);

  const isMobileTechOnly =
    (user?.role || '').toUpperCase() === 'TECHNICIEN' ||
    (Boolean(user?.permissions?.mobileOnly) && !isAdminOrManager);

  const visibleNavItems = navItems.filter((item) => {
    if (isMobileTechOnly) {
      return item.id === 'mobile_tech';
    }
    if (item.id === 'admin') {
      return isAdminOrManager;
    }
    return true;
  });

  const activeMeta = visibleNavItems.find((item) => item.id === activeSection) || navItems[0];

  return (
    <div className="enterprise-shell">
      {/* LEFT SIDEBAR NAVIGATION (ServiceTitan / Linear / Praxedo Standard) */}
      <aside className={`enterprise-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div
            onClick={() => onSectionChange?.('aujourdhui')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', overflow: 'hidden' }}
          >
            <AnelecBrandMark />
            {!collapsed && (
              <div>
                <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.07em', color: '#ffffff', lineHeight: 1.1 }}>
                  ANELEC
                </div>
                <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.16em', color: '#60a5fa', textTransform: 'uppercase' }}>
                  FSM DISPATCH PRO
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8',
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-section-label">Opérations & Dispatch</div>}
          {visibleNavItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange?.(item.id)}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                title={`${item.label} — ${item.subtitle}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isActive ? '#60a5fa' : 'inherit' }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 400 }}>
                      {item.subtitle}
                    </span>
                  </div>
                )}
                {!collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className={`sidebar-badge ${item.urgent ? 'urgent' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {!collapsed && (
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.07)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Moteur Planning
                </span>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
                Synchronisation auto des <strong style={{ color: '#d8b4fe' }}>Visites Devis</strong> & <strong style={{ color: '#93c5fd' }}>Interventions</strong> active.
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && user && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {user.name?.slice(0, 2).toUpperCase() || 'AN'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Dispatcher ANELEC</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                title="Se déconnecter"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <div className="enterprise-main">
        <header className="enterprise-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ANELEC TCE
                </span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {activeMeta.label}
                </h1>
              </div>
            </div>
          </div>

          {/* Center Global Command Bar Trigger (Ctrl+K) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="cmd-trigger"
              title="Recherche globale & commandes rapides (Ctrl+K)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span style={{ flex: 1, textAlign: 'left' }}>Rechercher devis, client, technicien ou commande...</span>
              <span className="kbd-shortcut">Ctrl K</span>
            </button>
          </div>

          {/* Right Quick Actions & Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {parisTime && (
              <div
                className="font-mono"
                style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  padding: '5px 10px',
                  borderRadius: '7px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Fuseau horaire métier : Europe/Paris"
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                {parisTime}
              </div>
            )}

            {onQuickNewDevis && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onQuickNewDevis}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Devis
              </button>
            )}

            {onQuickNewIntervention && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onQuickNewIntervention}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Intervention
              </button>
            )}

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="btn btn-secondary btn-sm"
              title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              style={{ padding: '6px 9px' }}
            >
              {theme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <main className="enterprise-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function AnelecBrandMark() {
  return (
    <div
      style={{
        width: '34px',
        height: '34px',
        borderRadius: '9px',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(59, 130, 246, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 10px rgba(59, 130, 246, 0.25)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path d="M50 10 L14 88 H33 L42 67 H58 L50 47 L67 88 H86 L50 10 Z" fill="#ffffff" />
        <polygon points="47,54 57,54 51,69 61,69 44,92 49,73 41,73" fill="#3b82f6" />
      </svg>
    </div>
  );
}
