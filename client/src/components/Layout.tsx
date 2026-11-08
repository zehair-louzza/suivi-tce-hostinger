import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../stores/authStore';
import { useTheme, THEMES } from '../stores/themeStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BubbleBackdrop } from './BubbleBackdrop';
import { InstallAppButton } from './InstallAppButton';
import { ProfileMenu } from './ProfileMenu';
import { isUserMobileOnly, canUserAccessSection } from '../../../shared/types';

export type AppSection =
  | 'aujourdhui'
  | 'planning'
  | 'devis'
  | 'interventions'
  | 'carte'
  | 'facturation'
  | 'rentabilite'
  | 'clients'
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
  onOpenSituationReport?: () => void;
}

export function Layout({
  children,
  activeSection = 'aujourdhui',
  onSectionChange,
  badges,
  onOpenCommandPalette,
  onQuickNewDevis,
  onQuickNewIntervention,
  onOpenSituationReport,
}: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [parisTime, setParisTime] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  // L'apparence est entièrement gérée par le ThemeProvider (défaut entreprise +
  // préférence individuelle).
  const { current: currentTheme, allowUserOverride, setUserPref, isPending: isThemePending } = useTheme();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const isDarkTheme = THEMES.find((t) => t.id === currentTheme)?.mood === 'dark';
  const toggleQuickTheme = async () => {
    try {
      await setUserPref(isDarkTheme ? 'light' : 'dark');
    } catch {
      /* personnalisation désactivée par l'administrateur — on ignore */
    }
  };

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

  interface NavItemDef {
    id: AppSection;
    label: string;
    subtitle: string;
    badge?: number;
    urgent?: boolean;
    shortcut: string;
    icon: JSX.Element;
  }

  interface NavGroupDef {
    title: string;
    items: NavItemDef[];
  }

  const allGroups: NavGroupDef[] = [
    {
      title: 'ESPACE DE TRAVAIL',
      items: [
        {
          id: 'aujourdhui',
          label: 'Tableau de bord',
          subtitle: 'Synthèse, opérations & analyse',
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
          label: 'Planning',
          subtitle: 'Gantt, dispatch & ordonnancement',
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
          label: 'Devis',
          subtitle: 'Pipeline chiffrages & visites',
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
          label: 'Interventions',
          subtitle: 'Chantiers TCE & suivi terrain',
          badge: badges?.interventions,
          shortcut: '4',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          ),
        },
        {
          id: 'carte',
          label: 'Carte et tournées',
          subtitle: 'Circuits & optimisation GPS',
          shortcut: '5',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'GESTION',
      items: [
        {
          id: 'facturation',
          label: 'Facturation',
          subtitle: 'B2B/B2C, factures & règlements',
          badge: badges?.facturation,
          urgent: (badges?.facturation || 0) > 0,
          shortcut: '6',
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
          label: 'Comptabilité & équipe',
          subtitle: 'Activité, CA, marges & rentabilité',
          shortcut: '7',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          ),
        },
        {
          id: 'clients',
          label: "Profils & Donneurs d'ordre",
          subtitle: "Fiches techniques B2B/B2C & emails d'envoi",
          shortcut: '8',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        {
          id: 'referentiels',
          label: 'Paramètres métier',
          subtitle: 'Corps d’état, techniciens & barèmes',
          shortcut: '9',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        },
        {
          id: 'admin',
          label: 'Utilisateurs et accès',
          subtitle: 'Droits, rôles, pointages & rapports',
          badge: badges?.admin,
          urgent: (badges?.admin || 0) > 0,
          shortcut: '0',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'ESPACE TERRAIN',
      items: [
        {
          id: 'mobile_tech',
          label: 'App Mobile Technicien',
          subtitle: 'Pointage, interventions & photos',
          shortcut: '0',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          ),
        },
      ],
    },
  ];

  const isMobileTechOnly = isUserMobileOnly(user);

  // Cloisonnement étanche : filtrer les services affichés strictement selon les droits conférés
  const visibleGroups = allGroups
    .map((group) => {
      if (isMobileTechOnly) {
        if (group.title !== 'ESPACE TERRAIN') return null;
        return group;
      }
      if (group.title === 'ESPACE TERRAIN') {
        const canSeeMobile = canUserAccessSection('mobile_tech', user);
        if (!canSeeMobile) return null;
        return group;
      }
      const filteredItems = group.items.filter((item) => {
        return canUserAccessSection(item.id, user);
      });
      if (filteredItems.length === 0) return null;
      return { ...group, items: filteredItems };
    })
    .filter(Boolean) as NavGroupDef[];

  const allItems = allGroups.flatMap((g) => g.items);
  const visibleNavItems = visibleGroups.flatMap((g) => g.items);

  const activeMeta = visibleNavItems.find((item) => item.id === activeSection) || allItems[0];

  const handleSelectSection = (sec: AppSection) => {
    setMobileMenuOpen(false);
    if (!canUserAccessSection(sec, user)) {
      toast.error('Accès non autorisé à ce service');
      return;
    }
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
          {visibleGroups.map((group) => (
            <div key={group.title} className="sidebar-group" style={{ marginBottom: '8px' }}>
              {!collapsed && (
                <div className="sidebar-section-label">{group.title}</div>
              )}
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSection(item.id)}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    title={`${item.label} — ${item.subtitle}`}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className={`sidebar-badge ${item.urgent ? 'urgent' : ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {!collapsed && (
            <div style={{ marginTop: 'auto', paddingTop: '16px', paddingBottom: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '11px',
                  color: 'var(--color-sidebar-muted)',
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Moteur Planning · Sync active
                </span>
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && user && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                data-testid="sidebar-profile-trigger"
                title="Mon profil"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 6px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'inherit',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <div className="avatar">
                  {user.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'ZL'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.name || 'Utilisateur'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-sidebar-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isMobileTechOnly ? 'Technicien Terrain' : (user.role === 'ADMIN' ? 'Administrateur' : user.role || 'Gestionnaire')}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-sidebar-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Se déconnecter"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
      <ProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} onLogout={handleLogout} />

      {/* MAIN WORKSPACE */}
      <div className="enterprise-main">
        {!isMobileTechOnly && (
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
                {!isMobileTechOnly && (
                  <span className="topbar-breadcrumb-prefix">
                    {(user?.companyName ? user.companyName.toUpperCase() : 'ANELEC GROUPE')} /
                  </span>
                )}
                <h1
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: 0,
                  }}
                >
                  {isMobileTechOnly
                    ? (user?.technicienNom ? `Terrain • ${user.technicienNom}` : 'App Terrain')
                    : activeSection === 'aujourdhui'
                    ? "Vue d'ensemble"
                    : activeMeta.label}
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
            {!isMobileTechOnly && onOpenSituationReport && canUserAccessSection('rentabilite', user) && (
              <button
                type="button"
                onClick={onOpenSituationReport}
                className="btn btn-secondary btn-sm mobile-only-flex"
                style={{ padding: '6px 8px' }}
                title="Rapports de Situation Excel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </button>
            )}
            {parisTime && (
              <div
                className="font-mono topbar-date-pill desktop-only-el"
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
                  flexShrink: 0,
                }}
                title="Fuseau horaire métier : Europe/Paris"
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00bf63' }} />
                {parisTime}
              </div>
            )}

            {!isMobileTechOnly && onOpenSituationReport && canUserAccessSection('rentabilite', user) && (
              <button
                type="button"
                className="btn btn--secondary desktop-only-el"
                onClick={onOpenSituationReport}
                title="Exporter un rapport de situation complet en fichier Excel (.xlsx)"
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: '#10b981',
                  color: 'var(--color-text-primary, #0f172a)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
                <span>Situation Excel</span>
              </button>
            )}

            {!isMobileTechOnly && onQuickNewDevis && canUserAccessSection('devis', user) && (
              <button
                type="button"
                className="btn btn--secondary desktop-only-el"
                onClick={onQuickNewDevis}
                title="Créer un nouveau devis chiffrage"
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                + Devis
              </button>
            )}

            {!isMobileTechOnly && onQuickNewIntervention && canUserAccessSection('interventions', user) && (
              <button
                type="button"
                className="btn btn--primary desktop-only-el"
                onClick={onQuickNewIntervention}
                title="Créer une nouvelle intervention"
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                + Nouvelle intervention
              </button>
            )}

            <InstallAppButton />

            {/* Bouton rapide clair/sombre pour compatibilité */}
            <button
              type="button"
              onClick={toggleQuickTheme}
              className="btn btn-secondary btn-sm desktop-only-el"
              title={isDarkTheme ? 'Passer en mode clair' : 'Passer en mode sombre'}
              style={{ padding: '6px 9px', display: allowUserOverride ? undefined : 'none' }}
              data-testid="quick-theme-toggle"
            >
              {isDarkTheme ? (
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

            {/* Sélecteur Interactif de Thème & Directions Artistiques */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setThemeDropdownOpen((open) => !open)}
                className="btn btn-secondary btn-sm"
                title="Choisir la direction artistique / thème de l'interface"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  fontWeight: 600,
                  fontSize: '12px',
                  borderRadius: '8px',
                  background: themeDropdownOpen ? 'var(--bg-hover)' : undefined,
                }}
              >
                {/* Palette Icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                  <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                  <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                  <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                </svg>

                {/* Swatches pill of active theme */}
                {(() => {
                  const activeT = THEMES.find((t) => t.id === currentTheme) || THEMES[0];
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 5px',
                        background: 'rgba(0,0,0,0.06)',
                        borderRadius: '999px',
                      }}
                    >
                      {activeT.swatches.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: c,
                            display: 'inline-block',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                          }}
                        />
                      ))}
                    </span>
                  );
                })()}

                {/* Theme Name (desktop) */}
                <span className="desktop-only-el" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                  {THEMES.find((t) => t.id === currentTheme)?.name.replace('ANELEC Original — ', '') || 'Apparence'}
                </span>

                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Popover Dropdown */}
              {themeDropdownOpen && (
                <>
                  <div
                    onClick={() => setThemeDropdownOpen(false)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 999,
                      background: 'rgba(0,0,0,0.18)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 8px)',
                      zIndex: 1000,
                      width: '320px',
                      maxWidth: 'calc(100vw - 20px)',
                      background: 'var(--bg-surface, #ffffff)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '14px',
                      boxShadow: '0 18px 40px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.1)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '8px',
                        borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          🎨 Direction Artistique
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          Choisissez votre design préféré en direct
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '999px',
                          background: 'rgba(4, 120, 87, 0.1)',
                          color: '#047857',
                        }}
                      >
                        7 styles
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '340px', overflowY: 'auto' }}>
                      {THEMES.map((t) => {
                        const isCurrent = t.id === currentTheme;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            disabled={isThemePending}
                            onClick={async () => {
                              try {
                                await setUserPref(t.id);
                                setThemeDropdownOpen(false);
                                toast.success(`Design "${t.name}" appliqué !`);
                              } catch {
                                toast.error('Impossible d’appliquer ce thème');
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              border: isCurrent ? '1.5px solid var(--accent-primary, #047857)' : '1px solid transparent',
                              background: isCurrent ? 'var(--color-primary-soft, rgba(4,120,87,0.08))' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.04))';
                            }}
                            onMouseLeave={(e) => {
                              if (!isCurrent) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              {/* Swatches pill */}
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '2px',
                                  padding: '3px',
                                  background: 'rgba(0,0,0,0.08)',
                                  borderRadius: '6px',
                                  flexShrink: 0,
                                }}
                              >
                                {t.swatches.slice(0, 3).map((c, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      width: '9px',
                                      height: '14px',
                                      borderRadius: '2px',
                                      background: c,
                                      display: 'inline-block',
                                    }}
                                  />
                                ))}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: isCurrent ? 800 : 600,
                                    fontSize: '12px',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {t.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {t.tagline}
                                </div>
                              </div>
                            </div>

                            {isCurrent && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: 'var(--accent-primary, #047857)',
                                  flexShrink: 0,
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        paddingTop: '8px',
                        borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setThemeDropdownOpen(false);
                          setProfileOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-primary, #047857)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '11px',
                        }}
                      >
                        Options de profil →
                      </button>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Persistance Supabase
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

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
        )}

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
                  : item.id === 'carte'
                  ? 'Carte'
                  : item.id === 'facturation'
                  ? 'Factures'
                  : item.id === 'rentabilite'
                  ? 'Comptabilité'
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
