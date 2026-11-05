// Layout with ANELEC GROUPE branding, 5 navigation spaces, and theme toggle (Dark Charcoal / Light Off-White)
import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../stores/authStore';
import { useDevisRealtime, useInterventionRealtime } from '../hooks/useSocket';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lightTheme, setLightTheme] = useState(false);

  useDevisRealtime();
  useInterventionRealtime();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', lightTheme ? 'light' : 'dark');
  }, [lightTheme]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Aujourd’hui', subtitle: 'Pilotage & Alertes', icon: TodayIcon },
    { path: '/devis', label: 'Devis', subtitle: '22 col. & Relances', icon: DevisIcon },
    { path: '/interventions', label: 'Interventions', subtitle: '23 col. & Clôture', icon: InterventionIcon },
    { path: '/planning', label: 'Planning Techniciens', subtitle: 'Souris & Clavier', icon: PlanningIcon },
    { path: '/referentiels', label: 'Référentiels', subtitle: 'Listes ANELEC', icon: ListesIcon },
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/devis':
        return 'Pilotage Commercial des Devis (22 colonnes ANELEC)';
      case '/interventions':
        return 'Suivi Opérationnel des Interventions (23 colonnes ANELEC)';
      case '/planning':
        return 'Planning Interactif Techniciens — Interventions & Visites Devis';
      case '/referentiels':
        return 'Référentiels & Listes de Choix Métier ANELEC';
      default:
        return 'Poste de Pilotage Quotidien — « À faire aujourd’hui »';
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar" role="navigation" aria-label="Navigation principale">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <AnelecLogo />
            <div className="brand-text-block">
              <span className="brand-title">ANELEC GROUPE</span>
              <span className="brand-subtitle">Poste de Pilotage TCE</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Menu principal">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <item.icon />
              <div className="sidebar-item-labels">
                <span className="sidebar-item-title">{item.label}</span>
                <span className="sidebar-item-sub">{item.subtitle}</span>
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.name || 'Zehair'}</span>
              <span className="user-role">{user?.role || 'Coordination'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setLightTheme(!lightTheme)}
              title={lightTheme ? 'Passer au thème Charbon (Sombre)' : 'Passer au thème Blanc cassé ANELEC (Clair)'}
              aria-label="Changer de thème"
            >
              {lightTheme ? '🌙' : '☀️'}
            </button>
            <button
              className="btn btn-ghost btn-icon"
              onClick={handleLogout}
              aria-label="Déconnexion"
              title="Déconnexion"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content" role="main">
        <header className="toolbar" role="banner">
          <div className="header-left">
            <span className="page-title">{getPageTitle()}</span>
          </div>
          <div className="header-right">
            <span className="timezone-badge">🌍 Fuseau : Europe/Paris</span>
            <span className="last-updated" id="lastUpdated">
              Mis à jour : <span id="lastUpdatedTime">—</span>
              <LastUpdater />
            </span>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function LastUpdater() {
  useEffect(() => {
    const updateTime = () => {
      const el = document.getElementById('lastUpdatedTime');
      if (el) {
        el.textContent = new Date().toLocaleString('fr-FR', {
          timeZone: 'Europe/Paris',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return null;
}

function AnelecLogo() {
  return (
    <svg width="42" height="32" viewBox="0 0 600 360" fill="none" aria-label="ANELEC GROUPE">
      <polyline
        points="60,150 300,20 540,150"
        fill="none"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="300"
        y="245"
        textAnchor="middle"
        fill="currentColor"
        fontSize="115"
        fontWeight="800"
        fontFamily="Inter, serif"
        letterSpacing="6"
      >
        ANELEC
      </text>
      <line x1="70" y1="285" x2="510" y2="285" stroke="#2EAF6C" strokeWidth="18" strokeLinecap="round" />
      <polygon points="500,260 555,285 500,310" fill="#2EAF6C" />
    </svg>
  );
}

function TodayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function DevisIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function InterventionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function PlanningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function ListesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
