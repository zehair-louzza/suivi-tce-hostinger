// Layout with sidebar, header, and content area
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/authStore';
import { useDevisRealtime } from '../hooks/useSocket';
import { useInterventionRealtime } from '../hooks/useSocket';

export function Layout() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Enable real-time updates
  useDevisRealtime();
  useInterventionRealtime();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Tableau de bord', icon: DashboardIcon },
    { path: '/devis', label: 'Devis', icon: DevisIcon },
    { path: '/interventions', label: 'Interventions', icon: InterventionIcon },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar" role="navigation" aria-label="Navigation principale">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <BrandIcon />
            <span>Suivi TCE</span>
          </div>
        </div>
        
        <nav className="sidebar-nav" aria-label="Menu principal">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `sidebar-item ${isActive ? 'active' : ''}`
              }
              aria-current={({ isActive }) => isActive ? 'page' : undefined}
            >
              <item.icon />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={handleLogout}
            aria-label="Déconnexion"
            title="Déconnexion"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" role="main">
        {/* Header/Toolbar */}
        <header className="toolbar" role="banner">
          <div className="header-left">
            <Outlet context={{}} />
          </div>
          <div className="header-right">
            <span className="last-updated" id="lastUpdated">
              Dernière mise à jour : <span id="lastUpdatedTime">—</span>
            </span>
          </div>
        </header>

        {/* Page content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Update last updated time
import { useEffect } from 'react';

function LastUpdater() {
  useEffect(() => {
    const updateTime = () => {
      const el = document.getElementById('lastUpdatedTime');
      if (el) {
        el.textContent = new Date().toLocaleString('fr-FR', {
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

// Icons
function BrandIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12h6" strokeWidth="2" />
      <path d="M12 9v6" strokeWidth="2" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function DevisIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function InterventionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}