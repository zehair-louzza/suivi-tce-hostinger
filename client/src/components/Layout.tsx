import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../stores/authStore';
import { useTheme, THEMES, SIDEBAR_MODELS, SidebarModelId } from '../stores/themeStore';
import { SidebarPreviewMini } from './SidebarPreviewMini';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BubbleBackdrop } from './BubbleBackdrop';
import { InstallAppButton } from './InstallAppButton';
import { ProfileMenu } from './ProfileMenu';
import { isUserMobileOnly, canUserAccessSection, canUserCreateIntervention, canUserCreateDevis, espaceRoleOf, ROLE_PERIMETRE } from '../../../shared/types';
import { ProGlyph } from './ProIcons';
import { NotificationBell } from './NotificationBell';

export type AppSection =
  | 'aujourdhui'
  | 'demandes'
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
    demandes?: number;
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
  /** Ouvre une intervention à partir d'une notification. */
  onOpenInterventionById?: (id: number) => void;
  onOpenDevisById?: (id: number) => void;
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
  onOpenInterventionById,
  onOpenDevisById,
}: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const espace = espaceRoleOf(user);
  const isDirection = espace === 'direction';
  const roleLabel = ROLE_PERIMETRE[espace]?.titre || 'Collaborateur';
  const companyName = (user?.companyName || '').trim() || 'Mon entreprise';

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('anelec_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('anelec_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [parisTime, setParisTime] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  // L'apparence est entièrement gérée par le ThemeProvider (défaut entreprise +
  // préférence individuelle).
  const {
    current: currentTheme,
    allowUserOverride,
    setUserPref,
    isPending: isThemePending,
    sidebarModel,
    sidebarCompanyDefault,
    sidebarUserPref,
    setSidebarUserPref,
  } = useTheme();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [popoverTab, setPopoverTab] = useState<'theme' | 'sidebar'>('theme');
  const [m5Query, setM5Query] = useState('');
  const [m5OpenGroups, setM5OpenGroups] = useState<Record<string, boolean>>({
    'ESPACE DE TRAVAIL': true,
    GESTION: true,
    ADMINISTRATION: true,
    'ESPACE TERRAIN': true,
  });
  const [m3ActiveGroupTitle, setM3ActiveGroupTitle] = useState<string>('ESPACE DE TRAVAIL');
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
          label: isDirection ? 'Tableau de bord' : 'Mon travail',
          subtitle: isDirection ? 'Synthèse, opérations & analyse' : 'Ce qui vous est assigné et ce que vous validez',
          badge: badges?.aujourdhui,
          urgent: (badges?.aujourdhui || 0) > 0,
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
          id: 'demandes',
          label: 'Demandes reçues',
          subtitle: 'File d’entrée · DI du donneur d’ordre',
          badge: badges?.demandes,
          urgent: (badges?.demandes || 0) > 0,
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
              <polyline points="3 7 12 13 21 7" />
            </svg>
          ),
        },
        {
          id: 'planning',
          label: 'Planning',
          subtitle: 'Gantt, dispatch & ordonnancement',
          badge: badges?.planning,
          urgent: (badges?.planning || 0) > 0,
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
  const isMobileTechMode = isMobileTechOnly || activeSection === 'mobile_tech';

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
  const effectiveCollapsed = collapsed && !mobileMenuOpen;
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'ZL';
  const activeGroupTitle =
    visibleGroups.find((g) => g.items.some((i) => i.id === activeSection))?.title ||
    visibleGroups[0]?.title ||
    'ESPACE DE TRAVAIL';
  const selectedM3Group =
    visibleGroups.find((g) => g.title === m3ActiveGroupTitle) ||
    visibleGroups.find((g) => g.title === activeGroupTitle) ||
    visibleGroups[0];

  const handleSelectSection = (sec: AppSection) => {
    setMobileMenuOpen(false);
    if (!canUserAccessSection(sec, user)) {
      toast.error('Accès non autorisé à ce service');
      return;
    }
    const parentGroup = visibleGroups.find((g) => g.items.some((i) => i.id === sec));
    if (parentGroup) {
      setM3ActiveGroupTitle(parentGroup.title);
      setM5OpenGroups((prev) => ({ ...prev, [parentGroup.title]: true }));
    }
    onSectionChange?.(sec);
  };

  const renderCollapseChevron = (flipped = effectiveCollapsed) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      {flipped ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
    </svg>
  );

  const renderBrandBar = (showInlineToggle: boolean) => (
    <div className="sb-brand-bar">
      <div
        onClick={() => handleSelectSection(isMobileTechOnly ? 'mobile_tech' : 'aujourdhui')}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
      >
        <CompanyMark name={companyName} />
        {!effectiveCollapsed && (
          <div style={{ minWidth: 0 }}>
            <div className="sb-brand-title" data-testid="sidebar-company-name" title={companyName}>
              {companyName}
            </div>
            <div className="sb-brand-sub">Pilotage TCE BTP</div>
          </div>
        )}
      </div>
      {showInlineToggle && (
        <button
          type="button"
          onClick={() => (mobileMenuOpen ? setMobileMenuOpen(false) : toggleCollapsed())}
          className="sb-inline-toggle"
          title={mobileMenuOpen ? 'Fermer le menu' : 'Replier la barre latérale'}
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Replier la barre latérale'}
        >
          {mobileMenuOpen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            renderCollapseChevron(false)
          )}
        </button>
      )}
    </div>
  );

  const renderNavItem = (item: NavItemDef, showSubtitle = false) => {
    const isActive = activeSection === item.id;
    const hasBadge = item.badge !== undefined && item.badge > 0;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelectSection(item.id)}
        className={`sb-item ${isActive ? 'is-active' : ''}`}
        title={`${item.label} — ${item.subtitle}`}
        style={showSubtitle ? { alignItems: 'flex-start', paddingBlock: 7 } : undefined}
      >
        <span className="sb-item-icon" style={showSubtitle ? { marginTop: 2 } : undefined}>
          {item.icon}
          {effectiveCollapsed && hasBadge && (
            <span className={`sb-dot ${item.urgent ? 'is-urgent' : ''}`} />
          )}
        </span>
        {!effectiveCollapsed && (
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span className="sb-item-label">{item.label}</span>
            {showSubtitle && (
              <span className="sb-brand-sub" style={{ marginTop: 1 }}>
                {item.subtitle}
              </span>
            )}
          </span>
        )}
        {!effectiveCollapsed && hasBadge && (
          <span className={`sb-badge ${item.urgent ? 'is-urgent' : ''}`}>{item.badge}</span>
        )}
      </button>
    );
  };

  const renderSyncPill = () => {
    if (!canUserAccessSection('planning', user)) return null;
    if (effectiveCollapsed) {
      return (
        <div
          className="sb-sync-pill"
          title="Moteur Planning · Sync active"
          style={{ justifyContent: 'center', padding: '7px 0', marginInline: 'auto', width: 40 }}
        >
          <span className="sb-sync-dot" />
        </div>
      );
    }
    return (
      <div className="sb-sync-pill">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span className="sb-sync-dot" />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Moteur Planning · Sync active
          </span>
        </span>
        {sidebarModel === 'line' && <span className="sb-live-tag">LIVE</span>}
      </div>
    );
  };

  const renderFooter = (floatingCardWrap = false, omitCollapsedTestId = false) => {
    if (!user) return null;
    const inner = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: effectiveCollapsed ? 'center' : 'space-between',
          gap: '6px',
          width: '100%',
        }}
      >
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          data-testid={effectiveCollapsed && omitCollapsedTestId ? undefined : 'sidebar-profile-trigger'}
          title={effectiveCollapsed ? `${user.name || 'Utilisateur'} — Mon profil` : 'Mon profil'}
          className="sb-profile-btn"
          style={effectiveCollapsed ? { justifyContent: 'center', flex: 'unset', padding: '2px' } : undefined}
        >
          <div className="sb-avatar">{userInitials}</div>
          {!effectiveCollapsed && (
            <div style={{ minWidth: 0 }}>
              <div className="sb-brand-title" style={{ fontSize: '13px', fontWeight: 600 }}>
                {user.name || 'Utilisateur'}
              </div>
              <div className="sb-brand-sub" style={{ fontSize: '11px' }}>
                {roleLabel}
              </div>
            </div>
          )}
        </button>
        {!effectiveCollapsed && (
          <button
            type="button"
            onClick={handleLogout}
            className="sb-logout-btn"
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    );

    return (
      <div className="sb-footer">
        {floatingCardWrap ? <div className="sb-floating-footer-card">{inner}</div> : inner}
      </div>
    );
  };

  const renderStandardGroups = () => (
    <div className="sb-groups-stack">
      {visibleGroups.map((group, idx) => (
        <div key={group.title}>
          {effectiveCollapsed ? (
            idx > 0 && <div className="sb-collapsed-sep" />
          ) : (
            <div className="sb-section-label">{group.title}</div>
          )}
          <div className="sb-items-stack">{group.items.map((item) => renderNavItem(item))}</div>
        </div>
      ))}
    </div>
  );

  const renderRailPillarIcon = (title: string, fallbackIcon: ReactNode) => {
    switch (title) {
      case 'ESPACE DE TRAVAIL':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        );
      case 'GESTION':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="6" y1="10" x2="18" y2="10" />
            <line x1="6" y1="14" x2="13" y2="14" />
          </svg>
        );
      case 'ADMINISTRATION':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      default:
        return fallbackIcon;
    }
  };

  return (
    <div className={`enterprise-shell ${isMobileTechMode ? 'mobile-tech-shell' : ''}`}>
      <BubbleBackdrop />
      {/* Backdrop pour le tiroir mobile */}
      <div
        className={`mobile-sidebar-backdrop ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* LEFT SIDEBAR NAVIGATION (6 modèles harmonisés × 7 Directions Artistiques) */}
      <aside
        className={`enterprise-sidebar sb-v2 sb-model-${sidebarModel} ${effectiveCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}
        data-sidebar-model={sidebarModel}
      >
        {sidebarModel === 'rail' ? (
          <>
            <div className="sb-rail-col">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div
                  onClick={() => handleSelectSection(isMobileTechOnly ? 'mobile_tech' : 'aujourdhui')}
                  style={{ cursor: 'pointer' }}
                  title={companyName}
                >
                  <CompanyMark name={companyName} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {visibleGroups.map((group) => {
                    const isGroupActive = selectedM3Group?.title === group.title;
                    const groupHasUrgent = group.items.some((i) => i.urgent && (i.badge || 0) > 0);
                    const groupHasBadge = group.items.some((i) => (i.badge || 0) > 0);
                    return (
                      <button
                        key={group.title}
                        type="button"
                        onClick={() => {
                          setM3ActiveGroupTitle(group.title);
                          if (effectiveCollapsed && group.items[0]) {
                            handleSelectSection(group.items[0].id);
                          }
                        }}
                        className={`sb-rail-btn ${isGroupActive ? 'is-active' : ''}`}
                        title={group.title}
                        aria-label={group.title}
                      >
                        {renderRailPillarIcon(group.title, group.items[0]?.icon)}
                        {groupHasBadge && (
                          <span className={`sb-rail-dot ${groupHasUrgent ? 'is-urgent' : ''}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {effectiveCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  {!mobileMenuOpen && (
                    <button
                      type="button"
                      onClick={toggleCollapsed}
                      className="sb-inline-toggle"
                      style={{ color: '#cbd5e1', background: 'rgba(255,255,255,0.08)' }}
                      title="Déplier la barre latérale"
                      aria-label="Déplier la barre latérale"
                    >
                      {renderCollapseChevron(true)}
                    </button>
                  )}
                  {user && (
                    <button
                      type="button"
                      onClick={() => setProfileOpen(true)}
                      data-testid="sidebar-profile-trigger"
                      title={`${user.name || 'Utilisateur'} — Mon profil`}
                      className="sb-profile-btn"
                      style={{ flex: 'unset', padding: 2, justifyContent: 'center' }}
                    >
                      <div className="sb-avatar">{userInitials}</div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {!effectiveCollapsed && (
              <div className="sb-rail-panel">
                {renderBrandBar(true)}
                <nav className="sb-nav">
                  <div className="sb-groups-stack">
                    {selectedM3Group && (
                      <div>
                        <div className="sb-section-label">{selectedM3Group.title}</div>
                        <div className="sb-items-stack">
                          {selectedM3Group.items.map((item) => renderNavItem(item, true))}
                        </div>
                      </div>
                    )}
                    {visibleGroups.length > 1 && (
                      <div>
                        <div className="sb-section-label" style={{ marginTop: 4 }}>Autres pôles</div>
                        <div className="sb-items-stack">
                          {visibleGroups
                            .filter((g) => g.title !== selectedM3Group?.title)
                            .map((g) => {
                              const firstItem = g.items[0];
                              const count = g.items.reduce((acc, i) => acc + (i.badge || 0), 0);
                              return (
                                <button
                                  key={g.title}
                                  type="button"
                                  onClick={() => setM3ActiveGroupTitle(g.title)}
                                  className="sb-item"
                                  title={`Basculer vers ${g.title}`}
                                >
                                  <span className="sb-item-icon">
                                    {renderRailPillarIcon(g.title, firstItem?.icon)}
                                  </span>
                                  <span className="sb-item-label" style={{ textTransform: 'capitalize' }}>
                                    {g.title.toLowerCase()}
                                  </span>
                                  {count > 0 && <span className="sb-badge">{count}</span>}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                  {renderSyncPill()}
                </nav>
                {renderFooter(false, true)}
              </div>
            )}
          </>
        ) : sidebarModel === 'floating' ? (
          <div className="sb-floating-card">
            {effectiveCollapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="sb-edge-toggle"
                title="Déplier la barre latérale"
                aria-label="Déplier la barre latérale"
              >
                {renderCollapseChevron(true)}
              </button>
            )}
            {renderBrandBar(!effectiveCollapsed || mobileMenuOpen)}
            {(onQuickNewDevis || onQuickNewIntervention) && (
              <div style={{ padding: effectiveCollapsed ? '8px 10px 0' : '8px 10px 0' }}>
                <button
                  type="button"
                  className="sb-quick-cta"
                  onClick={() => (onQuickNewDevis || onQuickNewIntervention)?.()}
                  title={onQuickNewDevis ? 'Nouveau devis' : 'Nouvelle intervention'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {!effectiveCollapsed && (
                    <span>{onQuickNewDevis ? 'Nouveau devis' : 'Nouvelle intervention'}</span>
                  )}
                </button>
              </div>
            )}
            <nav className="sb-nav">
              {renderStandardGroups()}
              {renderSyncPill()}
            </nav>
            {renderFooter(true)}
          </div>
        ) : sidebarModel === 'cards' ? (
          <>
            {effectiveCollapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="sb-edge-toggle"
                title="Déplier la barre latérale"
                aria-label="Déplier la barre latérale"
              >
                {renderCollapseChevron(true)}
              </button>
            )}
            {renderBrandBar(!effectiveCollapsed || mobileMenuOpen)}
            <nav className="sb-nav">
              <div className="sb-groups-stack">
                {visibleGroups
                  .filter((g) => g.title !== 'ESPACE TERRAIN')
                  .map((group, idx) =>
                    effectiveCollapsed ? (
                      <div key={group.title}>
                        {idx > 0 && <div className="sb-collapsed-sep" />}
                        <div className="sb-items-stack">{group.items.map((item) => renderNavItem(item))}</div>
                      </div>
                    ) : (
                      <div key={group.title} className="sb-card-group">
                        <div className="sb-section-label">{group.title}</div>
                        <div className="sb-items-stack">{group.items.map((item) => renderNavItem(item))}</div>
                      </div>
                    ),
                  )}
              </div>
              <div style={{ marginTop: 8 }}>
                {visibleNavItems.some((i) => i.id === 'mobile_tech') && (
                  <button
                    type="button"
                    onClick={() => handleSelectSection('mobile_tech')}
                    className={`sb-field-cta ${activeSection === 'mobile_tech' ? 'is-active' : ''}`}
                    title="App Mobile Technicien — Pointage, interventions & photos"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: activeSection === 'mobile_tech' ? 'currentColor' : 'var(--sb-field-icon)', flexShrink: 0 }}>
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                    {!effectiveCollapsed && <span>App Mobile Technicien</span>}
                  </button>
                )}
                {renderSyncPill()}
              </div>
            </nav>
            {renderFooter()}
          </>
        ) : sidebarModel === 'accordion' ? (
          <>
            {effectiveCollapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="sb-edge-toggle"
                title="Déplier la barre latérale"
                aria-label="Déplier la barre latérale"
              >
                {renderCollapseChevron(true)}
              </button>
            )}
            {renderBrandBar(!effectiveCollapsed || mobileMenuOpen)}
            {!effectiveCollapsed && (
              <div className="sb-search-box">
                <div className="sb-search-wrap">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    style={{ position: 'absolute', left: 9, color: 'var(--sb-muted)', pointerEvents: 'none' }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={m5Query}
                    onChange={(e) => setM5Query(e.target.value)}
                    placeholder="Filtrer les modules..."
                    className="sb-search-input"
                    aria-label="Filtrer les modules"
                  />
                  {m5Query && (
                    <button
                      type="button"
                      onClick={() => setM5Query('')}
                      style={{
                        position: 'absolute',
                        right: 6,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--sb-muted)',
                        cursor: 'pointer',
                        fontSize: 13,
                        lineHeight: 1,
                        padding: 2,
                      }}
                      title="Effacer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
            <nav className="sb-nav">
              {effectiveCollapsed ? (
                renderStandardGroups()
              ) : (
                <div className="sb-groups-stack">
                  {visibleGroups.map((group) => {
                    const normalized = m5Query.trim().toLowerCase();
                    const matchingItems = normalized
                      ? group.items.filter(
                          (item) =>
                            item.label.toLowerCase().includes(normalized) ||
                            item.subtitle.toLowerCase().includes(normalized),
                        )
                      : group.items;
                    if (matchingItems.length === 0) return null;
                    const isOpen = normalized !== '' || m5OpenGroups[group.title] !== false;
                    return (
                      <div key={group.title}>
                        <button
                          type="button"
                          className="sb-acc-trigger"
                          onClick={() =>
                            setM5OpenGroups((prev) => ({
                              ...prev,
                              [group.title]: !(prev[group.title] !== false),
                            }))
                          }
                        >
                          <span>{group.title}</span>
                          <span>{isOpen ? '▾' : '▸'}</span>
                        </button>
                        {isOpen && (
                          <div className="sb-items-stack" style={{ marginTop: 2 }}>
                            {matchingItems.map((item) => renderNavItem(item))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {renderSyncPill()}
            </nav>
            {renderFooter()}
          </>
        ) : (
          /* classic (Modèle 1) & line (Modèle 2) */
          <>
            {(sidebarModel === 'classic' || effectiveCollapsed) && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="sb-edge-toggle"
                title={effectiveCollapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
                aria-label={effectiveCollapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
              >
                {renderCollapseChevron()}
              </button>
            )}
            {renderBrandBar(sidebarModel === 'line' ? !effectiveCollapsed || mobileMenuOpen : mobileMenuOpen)}
            <nav className="sb-nav">
              {renderStandardGroups()}
              {renderSyncPill()}
            </nav>
            {renderFooter()}
          </>
        )}
      </aside>
      <ProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} onLogout={handleLogout} />

      {/* MAIN WORKSPACE */}
      <div className="enterprise-main">
        {activeSection === 'mobile_tech' && !isMobileTechOnly && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'linear-gradient(90deg, #0f172a, #1e293b)',
            color: '#f8fafc',
            fontSize: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProGlyph name="phone" size={16} />
              <span style={{ fontWeight: 700 }}>Mode Mobile Technicien</span>
              <span style={{
                fontSize: '10.5px',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                fontWeight: 700,
              }}>
                {user?.name || user?.email} · {roleLabel}{user?.companyName ? ` · ${user.companyName}` : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectSection('aujourdhui')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ← Revenir au bureau PC
            </button>
          </div>
        )}
        {!isMobileTechMode && (
        <header className="enterprise-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            {/* Bouton Menu Hamburger sur mobile (si plusieurs sections disponibles) */}
            {!isMobileTechOnly && (
              <button
                type="button"
                data-testid="mobile-menu-trigger"
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
                <CompanyMark name={companyName} />
              </div>
            )}

            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                {!isMobileTechOnly && (
                  <span className="topbar-breadcrumb-prefix">
                    {(user?.companyName ? user.companyName.toUpperCase() : 'MON ENTREPRISE')} /
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
                    ? (isDirection ? "Vue d'ensemble" : 'Mon travail')
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
                <span className="topbar-compact-label">Situation Excel</span>
              </button>
            )}

            <NotificationBell onOpenIntervention={onOpenInterventionById} onOpenDevis={onOpenDevisById} />

            {!isMobileTechOnly && canUserAccessSection('mobile_tech', user) && (
              <button
                type="button"
                className="btn btn--secondary desktop-only-el"
                onClick={() => handleSelectSection('mobile_tech')}
                title="Afficher l’application mobile technicien"
                style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                data-testid="topbar-mobile-tech-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                <span>Version Mobile</span>
              </button>
            )}

            {!isMobileTechOnly && onQuickNewDevis && activeSection !== 'devis' && canUserAccessSection('devis', user) && canUserCreateDevis(user) && (
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

            {!isMobileTechOnly && onQuickNewIntervention && activeSection !== 'interventions' && canUserAccessSection('interventions', user) && canUserCreateIntervention(user) && (
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
                data-testid="topbar-appearance-toggle"
                onClick={() => setThemeDropdownOpen((open) => !open)}
                className="btn btn-secondary btn-sm"
                title="Choisir la direction artistique et le modèle de menu latéral"
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
                      width: '352px',
                      maxWidth: 'calc(100vw - 20px)',
                      background: 'var(--bg-surface, #ffffff)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '14px',
                      boxShadow: '0 18px 40px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.1)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          <ProGlyph name="palette" size={14} style={{ marginRight: 6 }} />Apparence & Menu latéral
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          Personnalisez votre espace en direct
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
                          flexShrink: 0,
                        }}
                      >
                        {popoverTab === 'theme' ? '7 styles' : '6 modèles'}
                      </span>
                    </div>

                    {/* Onglets Direction Artistique / Menu latéral */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '4px',
                        padding: '3px',
                        borderRadius: '9px',
                        background: 'var(--color-surface-subtle, rgba(15, 23, 42, 0.05))',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPopoverTab('theme')}
                        data-testid="popover-tab-theme"
                        style={{
                          padding: '6px 8px',
                          borderRadius: '7px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          background: popoverTab === 'theme' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                          color: popoverTab === 'theme' ? 'var(--text-primary)' : 'var(--text-secondary)',
                          boxShadow: popoverTab === 'theme' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 140ms ease',
                        }}
                      >
                        Direction (7)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPopoverTab('sidebar')}
                        data-testid="popover-tab-sidebar"
                        style={{
                          padding: '6px 8px',
                          borderRadius: '7px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          background: popoverTab === 'sidebar' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                          color: popoverTab === 'sidebar' ? 'var(--text-primary)' : 'var(--text-secondary)',
                          boxShadow: popoverTab === 'sidebar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 140ms ease',
                        }}
                      >
                        Menu latéral (6)
                      </button>
                    </div>

                    {popoverTab === 'theme' ? (
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
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                        {SIDEBAR_MODELS.map((m) => {
                          const isCurrent = m.id === sidebarModel;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              disabled={isThemePending}
                              data-testid={`popover-sidebar-${m.id}`}
                              onClick={async () => {
                                try {
                                  await setSidebarUserPref(m.id as SidebarModelId);
                                  toast.success(`Menu latéral « ${m.name} » activé !`);
                                } catch {
                                  toast.error('Impossible de changer le modèle de menu');
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '7px 9px',
                                borderRadius: '10px',
                                border: isCurrent ? '1.5px solid var(--accent-primary, #047857)' : '1px solid var(--border-subtle, #e2e8f0)',
                                background: isCurrent ? 'var(--color-primary-soft, rgba(4,120,87,0.08))' : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <SidebarPreviewMini modelId={m.id} themeId={currentTheme} width={68} height={50} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span
                                    style={{
                                      fontSize: '9.5px',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'var(--color-surface-subtle, rgba(15,23,42,0.06))',
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    {`M${m.number}`}
                                  </span>
                                  <strong
                                    style={{
                                      fontSize: '12px',
                                      color: 'var(--text-primary)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {m.name}
                                  </strong>
                                </div>
                                <div
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--text-muted)',
                                    marginTop: '2px',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {m.tagline}
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
                        {sidebarUserPref && sidebarUserPref !== sidebarCompanyDefault && (
                          <button
                            type="button"
                            disabled={isThemePending}
                            onClick={async () => {
                              await setSidebarUserPref(null);
                              toast.success('Retour au menu par défaut de l’entreprise.');
                            }}
                            style={{
                              marginTop: '2px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px dashed var(--border-subtle, #cbd5e1)',
                              background: 'transparent',
                              color: 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Revenir au défaut ({SIDEBAR_MODELS.find((x) => x.id === sidebarCompanyDefault)?.name})
                          </button>
                        )}
                      </div>
                    )}

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
        {!isMobileTechMode && visibleNavItems.length > 1 && (
          <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
            {visibleNavItems.slice(0, 6).map((item) => {
              const isActive = activeSection === item.id;
              const shortLabel =
                item.id === 'aujourdhui'
                  ? (isDirection ? 'Pilotage' : 'Mon travail')
                  : item.id === 'demandes'
                  ? 'Demandes'
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
                  : item.id === 'clients'
                  ? 'Profils'
                  : item.id === 'referentiels'
                  ? 'Paramètres'
                  : item.id === 'admin'
                  ? 'Accès'
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

function CompanyMark({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'E';
  return (
    <div aria-hidden="true" className="sb-brand-mark">
      {initials}
    </div>
  );
}
