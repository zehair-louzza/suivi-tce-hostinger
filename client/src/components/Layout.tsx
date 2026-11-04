import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../stores/authStore';
import { useDevisRealtime, useInterventionRealtime } from '../hooks/useSocket';

function Icon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    devis: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
    interventions: 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8 21h8 M12 17v4',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
    brand: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 12h6 M12 9v6',
  };
  return <svg width={kind === 'brand' ? 28 : 20} height={kind === 'brand' ? 28 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [clock, setClock] = useState(() => new Date());
  useDevisRealtime();
  useInterventionRealtime();
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const navItems = [
    { path: '/', label: 'Tableau de bord', icon: 'dashboard' },
    { path: '/devis', label: 'Devis', icon: 'devis' },
    { path: '/interventions', label: 'Interventions', icon: 'interventions' },
  ];
  const title = navItems.find(item => item.path === pathname)?.label || 'Tableau de bord';
  const handleLogout = async () => { await logout(); navigate('/login'); };
  return (
    <div className="layout">
      <aside className="sidebar" aria-label="Navigation principale">
        <div className="sidebar-header"><div className="sidebar-brand"><Icon kind="brand" /><span>Suivi TCE</span></div></div>
        <nav className="sidebar-nav" aria-label="Menu principal">
          {navItems.map(item => <NavLink key={item.path} to={item.path} end className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}><Icon kind={item.icon} /><span>{item.label}</span></NavLink>)}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info"><div className="user-avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</div><div className="user-details"><span className="user-name">{user?.name}</span><span className="user-role">{user?.role}</span></div></div>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} aria-label="Déconnexion" title="Déconnexion"><Icon kind="logout" /></button>
        </div>
      </aside>
      <main className="main-content">
        <header className="toolbar"><div className="header-left"><h1 className="page-title">{title}</h1></div><div className="header-right"><span className="last-updated">Heure locale : {clock.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div></header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}
