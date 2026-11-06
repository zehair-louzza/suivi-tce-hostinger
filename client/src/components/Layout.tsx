import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BubbleBackdrop } from './BubbleBackdrop';
import { InstallAppButton } from './InstallAppButton';

export type AppSection =
  | 'aujourdhui'
  | 'planning'
  | 'devis'
  | 'interventions'
  | 'facturation'
  | 'rentabilite'
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
    facturation?: number;
    planning?: number;
    admin?: number;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      subtitle: '23 colonnes & suivi',
      badge: badges?.interventions,
      shortcut: '4',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      id: 'facturation',
      label: 'Facturation & Clients',
      subtitle: 'B2B/B2C, Retards & Motifs',
      badge: badges?.facturation,
      urgent: (badges?.facturation || 0) > 0,
      shortcut: '5',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="6" y1="9" x2="18" y2="9" />
          <line x1="6" y1="13" x2="12" y2="13" />
          <line x1="15" y1="15" x2="18" y2="15" />
        </svg>
      ),
    },
    {
      id: 'rentabilite',
      label: 'Rentabilité & Équipes',
      subtitle: 'KPIs Techniciens & Marges',
      shortcut: '6',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      id: 'referentiels',
      label: 'Référentiels Métier',
      subtitle: 'Équipes & paramètres',
      shortcut: '7',
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
      badge: badges?.admin,
      urgent: (badges?.admin || 0) > 0,
      shortcut: '8',
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
      shortcut: '8',
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

  const handleSelectSection = (sec: AppSection) => {
    setMobileMenuOpen(false);
    onSectionChange?.(sec);
  };

  return (
    <div className={`enterprise-shell ${isMobileTechOnly ? 'mobile-tech-shell' : ''}`}>
      <BubbleBackdrop />
      {/* Backdrop pour le tiroir mobile */}
      <div
        className={`mobile-sidebar-backdrop ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* LEFT SIDEBAR NAVIGATION (ServiceTitan / Linear / Praxedo Standard) */}
      <aside className={`enterprise-sidebar ${collapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div
            onClick={() => handleSelectSection(isMobileTechOnly ? 'mobile_tech' : 'aujourdhui')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', overflow: 'hidden' }}
          >
            {!collapsed ? (
              <img
                src="/brand/anelec-logo-white.png"
                alt="ANELEC GROUPE"
                style={{ height: '38px', maxWidth: '175px', objectFit: 'contain' }}
              />
            ) : (
              <AnelecBrandMark />
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="desktop-only-el"
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
                onClick={() => handleSelectSection(item.id)}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                title={`${item.label} — ${item.subtitle}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isActive ? '#00bf63' : 'inherit' }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 400 }}>
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
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Moteur Planning
                </span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00bf63', boxShadow: '0 0 6px #00bf63' }} />
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
                Synchronisation auto des <strong style={{ color: '#ffcc00' }}>Visites Devis</strong> & <strong style={{ color: '#00bf63' }}>Interventions</strong> active.
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
                  background: '#00bf63',
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
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    {isMobileTechOnly ? 'Technicien Terrain' : (user?.companyName || 'ANELEC GROUPE')}
                  </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            {/* Bouton Menu Hamburger sur mobile (si plusieurs sections disponibles) */}
            {!isMobileTechOnly && (
              <button
                type="button"
                className="mobile-only-flex btn btn-secondary btn-sm"
                onClick={() => setMobileMenuOpen((o) => !o)}
                style={{ padding: '6px 8px', flexShrink: 0 }}
                title="Menu de navigation"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}

            {isMobileTechOnly && (
              <div style={{ flexShrink: 0 }}>
                <AnelecBrandMark />
              </div>
            )}

            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span
                  className="desktop-only-el"
                  style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}
                >
                  {(user?.companyName ? user.companyName.toUpperCase() : 'ANELEC TCE')} /
                </span>
                <h1
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {isMobileTechOnly ? `ANELEC Terrain • ${user?.technicienNom || user?.name || ''}` : activeMeta.label}
                </h1>
              </div>
            </div>
          </div>

          {/* Center Global Command Bar Trigger (Ctrl+K) - Masqué sur smartphone pour libérer le titre */}
          {!isMobileTechOnly && (
            <div className="desktop-only-flex" style={{ alignItems: 'center', gap: '8px', flexShrink: 1, minWidth: '140px', flex: 1, maxWidth: '380px' }}>
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="cmd-trigger"
                title="Recherche globale & commandes rapides (Ctrl+K)"
                style={{ width: '100%', minWidth: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Rechercher devis, client, technicien...
                </span>
                <span className="kbd-shortcut cmd-kbd" style={{ flexShrink: 0 }}>Ctrl K</span>
              </button>
            </div>
          )}

          {/* Right Quick Actions, Theme & Mobile Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Loupe compacte mobile pour ouvrir le Ctrl+K */}
            {!isMobileTechOnly && onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="btn btn-secondary btn-sm mobile-only-flex"
                style={{ padding: '6px 8px' }}
                title="Rechercher (Ctrl+K)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
            {parisTime && (
              <div
                className="font-mono desktop-only-el"
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
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00bf63' }} />
                {parisTime}
              </div>
            )}

            {!isMobileTechOnly && onQuickNewDevis && (
              <button type="button" className="btn btn-secondary btn-sm desktop-only-el" onClick={onQuickNewDevis}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Devis
              </button>
            )}

            {!isMobileTechOnly && onQuickNewIntervention && (
              <button type="button" className="btn btn-primary btn-sm desktop-only-el" onClick={onQuickNewIntervention}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Intervention
              </button>
            )}

            <InstallAppButton />

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

            {/* Bouton Déconnexion direct dans la barre du haut sur mobile ou compte Technicien */}
            <button
              type="button"
              onClick={handleLogout}
              className={`btn btn-secondary btn-sm ${isMobileTechOnly ? '' : 'mobile-only-flex'}`}
              style={{ padding: '6px 9px', color: '#dc2626' }}
              title="Se déconnecter"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {isMobileTechOnly && <span style={{ fontSize: '11.5px', fontWeight: 700 }}>Sortir</span>}
            </button>
          </div>
        </header>

        <main className="enterprise-content">
          {children}
        </main>

        {/* BARRE DE NAVIGATION INFÉRIEURE SUR SMARTPHONE (pour les comptes multi-sections) */}
        {!isMobileTechOnly && visibleNavItems.length > 1 && (
          <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
            {visibleNavItems.slice(0, 6).map((item) => {
              const isActive = activeSection === item.id;
              const shortLabel =
                item.id === 'aujourdhui'
                  ? 'Pilotage'
                  : item.id === 'planning'
                  ? 'Planning'
                  : item.id === 'devis'
                  ? 'Devis'
                  : item.id === 'interventions'
                  ? 'Travaux'
                  : item.id === 'facturation'
                  ? 'Factures'
                  : item.id === 'rentabilite'
                  ? 'Rentabilité'
                  : item.id === 'admin'
                  ? 'Admin'
                  : item.id === 'mobile_tech'
                  ? 'Terrain'
                  : 'Métier';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  className={`mobile-bottom-nav-btn ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{shortLabel}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

function AnelecBrandMark() {
  return (
    <div
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.18)',
        padding: '4px',
      }}
    >
      <img src="/brand/anelec-mark.png" alt="ANELEC Groupe" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}
