import React, { useEffect, useState } from 'react';
import { Search, Bell, Sheet, ChevronDown, LogOut, MoreHorizontal, X, Menu as MenuIcon, Radio, Plus, Settings, User, ChevronLeft, ChevronRight, Activity, Users, Zap } from 'lucide-react';
import { NAV, NAV_ITEMS, NAV_BY_ID, MOBILE_PRIMARY } from './nav';
import { useMock, Logo, Avatar, IconBtn, Menu, Pill } from './ui';
import { ME, COMPANY, TODAY_LABEL, ACTIVITY, TECHS } from '../data/sample';
import { useNavigate } from 'react-router-dom';
import { DIRECTIONS, ORIGINAL_THEMES } from '../data/directions';

function NavButton({ item, active, onClick, showLabel = true, variant = '' }) {
  const Icon = item.icon;
  return (
    <button type="button" className={`m-nav-item ${variant} ${active ? 'is-active' : ''}`} onClick={onClick} title={item.label} data-testid={`mock-nav-${item.id}`}>
      <Icon size={18} />
      {showLabel && <span className="m-nav-label">{item.label}</span>}
      {item.badge ? <em className={`m-nav-badge ${item.urgent ? 'is-urgent' : ''}`}>{item.badge}</em> : null}
    </button>
  );
}

function UserMenu({ compact, onOpenProfile }) {
  const { go } = useMock();
  return (
    <Menu
      align="right"
      testid="mock-user-menu"
      trigger={(
        <button type="button" className="m-user-btn">
          <Avatar name={ME.name} initials={ME.initials} size={30} />
          {!compact && <span className="m-user-meta"><strong>{ME.name}</strong><small>{ME.role}</small></span>}
          {!compact && <ChevronDown size={14} />}
        </button>
      )}
      items={[
        { label: 'Mon profil', icon: User, onClick: onOpenProfile, testid: 'mock-open-profile' },
        { label: 'Paramètres métier', icon: Settings, onClick: () => go('parametres') },
        { label: 'Voir la page vitrine', icon: Radio, onClick: () => go('vitrine') },
        { sep: true },
        { label: 'Se déconnecter', icon: LogOut, danger: true, onClick: () => go('connexion'), testid: 'mock-logout' },
      ]}
    />
  );
}

function ProfileModal({ open, onClose }) {
  const { go, dir, screen } = useMock();
  const navigate = useNavigate();
  const companyDefault = 'atlas';
  const allowOverride = true;
  const themes = [
    ...DIRECTIONS.map((d) => ({ id: d.id, name: d.name, dark: d.dark, sw: [d.swatches[0], d.swatches[2]] })),
    ...ORIGINAL_THEMES.map((t) => ({ id: t.id, name: t.name, dark: t.dark, sw: [t.swatches[0], t.swatches[2]] })),
  ];
  const active = dir.id;
  const choose = (id) => { if (id !== active) navigate(`/m/${id}/${screen}`); };
  if (!open) return null;
  return (
    <div className="m-overlay" data-testid="mock-profile-modal" onClick={onClose}>
      <div className="m-modal" style={{ '--mw': '680px' }} onClick={(e) => e.stopPropagation()}>
        <header className="m-modal-head">
          <span className="m-modal-icon"><User size={18} /></span>
          <div className="m-modal-titles">
            <h3>Mon profil</h3>
            <p>{ME.name} · {ME.email} · <strong>{ME.role}</strong></p>
          </div>
          <button type="button" className="m-icon-btn" onClick={onClose} data-testid="mock-profile-close" aria-label="Fermer"><X size={16} /></button>
        </header>
        <main className="m-modal-body">
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div>
                <strong style={{ fontSize: 14 }}>Mon apparence</strong>
                <p className="m-muted m-small" style={{ margin: '2px 0 0' }}>Choisissez votre apparence personnelle, elle vous suit d'un appareil à l'autre.</p>
              </div>
              {active !== companyDefault && (
                <button type="button" className="m-btn m-btn--sm" onClick={() => choose(companyDefault)} data-testid="mock-profile-reset">↺ Revenir au défaut entreprise</button>
              )}
            </div>
            {!allowOverride ? (
              <div className="m-callout m-callout--note">
                <strong>Désactivée par votre administrateur</strong>
                <p style={{ margin: 0 }}>Le thème ANELEC Original — Clair s'applique à tous les collaborateurs sans possibilité de le modifier.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {themes.map((t) => {
                  const isActive = active === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => choose(t.id)}
                      data-testid={`mock-profile-theme-${t.id}`}
                      style={{ all: 'unset', cursor: 'pointer', padding: 10, borderRadius: 10, border: `2px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <div style={{ width: 40, height: 28, borderRadius: 6, background: `linear-gradient(135deg, ${t.sw[0]} 0%, ${t.sw[1]} 100%)`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</strong>
                        <span className="m-muted" style={{ fontSize: 10.5 }}>{t.dark ? 'Sombre' : 'Clair'}</span>
                      </div>
                      {isActive && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'var(--primary-soft)', color: 'var(--primary)' }}>Actif</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          <section>
            <strong style={{ fontSize: 14 }}>Accès mobile terrain</strong>
            <button
              type="button"
              className="m-btn m-btn--primary"
              style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
              onClick={() => {
                onClose();
                go('terrain');
              }}
              data-testid="mock-profile-open-terrain"
            >
              📱 Ouvrir l’app mobile technicien
            </button>
          </section>
          <section>
            <strong style={{ fontSize: 14 }}>Mes informations</strong>
            <div className="m-dl" style={{ marginTop: 8 }}>
              <div><dt>Entreprise</dt><dd>{COMPANY.name}</dd></div>
              <div><dt>Rôle</dt><dd>{ME.role}</dd></div>
              <div><dt>Dernière connexion</dt><dd>Aujourd'hui, 09:14</dd></div>
            </div>
          </section>
        </main>
        <footer className="m-modal-foot">
          <span className="m-muted">Besoin d'aide ? Contactez votre administrateur.</span>
          <button type="button" className="m-btn" onClick={onClose}>Fermer</button>
          <button type="button" className="m-btn m-btn--primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { onClose(); go('connexion'); }} data-testid="mock-profile-logout">
            <LogOut size={14} /> Se déconnecter
          </button>
        </footer>
      </div>
    </div>
  );
}

function TopActions({ compactSearch }) {
  const { openCommand, openExcel } = useMock();
  return (
    <>
      {compactSearch ? (
        <IconBtn icon={Search} label="Rechercher (Ctrl K)" onClick={openCommand} data-testid="mock-search-button" />
      ) : (
        <button type="button" className="m-search-trigger" onClick={openCommand} data-testid="mock-search-button">
          <Search size={15} />
          <span>Rechercher un devis, un client, un technicien…</span>
          <kbd>Ctrl K</kbd>
        </button>
      )}
      <IconBtn icon={Sheet} label="Situation Excel" onClick={openExcel} data-testid="mock-excel-button" />
      <IconBtn icon={Bell} label="Notifications" badge={3} data-testid="mock-notifications-button" />
    </>
  );
}

/* ------------------------- Panneau de commande (Signal) ------------------------- */
function CommandPanel({ onClose }) {
  return (
    <aside className="m-cmdpanel" data-testid="mock-command-panel">
      <header>
        <span><Activity size={15} /> En direct</span>
        <IconBtn icon={X} label="Masquer le panneau" onClick={onClose} data-testid="mock-command-panel-close" />
      </header>
      <div className="m-cmdpanel-sec">
        <h4><Users size={14} /> Équipe sur le terrain</h4>
        {TECHS.map((t) => (
          <div key={t.id} className="m-cmdpanel-tech">
            <Avatar name={t.name} initials={t.initials} color={t.color} size={24} />
            <span className="m-cmdpanel-name">{t.name}</span>
            <Pill tone={t.status === 'Non pointé' ? 'red' : t.status.startsWith('Termin') ? 'teal' : t.status === 'En route' ? 'blue' : 'indigo'}>{t.status === 'Terminé — rapport envoyé' ? 'Rapport envoyé' : t.status}</Pill>
          </div>
        ))}
      </div>
      <div className="m-cmdpanel-sec">
        <h4><Zap size={14} /> Fil d’activité</h4>
        <ol className="m-feed">
          {ACTIVITY.map((a) => (
            <li key={a.t + a.who}>
              <time>{a.t}</time>
              <i className={`m-feed-dot m-tone-${a.tone}`} />
              <p><strong>{a.who}</strong> {a.what}</p>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

/* ------------------------- Navigation mobile ------------------------- */
function MoreSheet({ open, onClose }) {
  const { go, screen } = useMock();
  if (!open) return null;
  return (
    <div className="m-overlay m-overlay--sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-sheet" data-testid="mock-more-sheet">
        <div className="m-sheet-grip" />
        <header className="m-sheet-head"><strong>Tous les modules</strong><IconBtn icon={X} label="Fermer" onClick={onClose} data-testid="mock-more-sheet-close" /></header>
        {NAV.map((g) => (
          <div key={g.group} className="m-sheet-group">
            <span>{g.group}</span>
            <div className="m-sheet-grid">
              {g.items.map((it) => (
                <button key={it.id} type="button" className={`m-sheet-item ${screen === it.id ? 'is-active' : ''}`} onClick={() => { onClose(); go(it.id); }} data-testid={`mock-more-${it.id}`}>
                  <it.icon size={20} />
                  <span>{it.short}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwissIndex({ open, onClose }) {
  const { go, screen } = useMock();
  if (!open) return null;
  let n = 0;
  return (
    <div className="m-swiss-index" data-testid="mock-swiss-index">
      <header>
        <span className="m-swiss-word">ANELEC<b>—</b>TCE</span>
        <button type="button" className="m-swiss-menu-btn" onClick={onClose} data-testid="mock-swiss-index-close">Fermer <X size={16} /></button>
      </header>
      {NAV.map((g) => (
        <div key={g.group} className="m-swiss-index-group">
          <span>{g.group}</span>
          {g.items.map((it) => {
            n += 1;
            return (
              <button key={it.id} type="button" className={screen === it.id ? 'is-active' : ''} onClick={() => { onClose(); go(it.id); }} data-testid={`mock-swiss-index-${it.id}`}>
                <em>{String(n).padStart(2, '0')}</em>{it.label}
              </button>
            );
          })}
        </div>
      ))}
      <button type="button" className="m-swiss-index-out" onClick={() => go('connexion')}>Se déconnecter</button>
    </div>
  );
}

function MobileBar({ title }) {
  const { dir, openCommand } = useMock();
  return (
    <header className="m-mtop">
      <Logo compact />
      <h1 className="m-mtop-title">{title}</h1>
      <IconBtn icon={Search} label="Rechercher" onClick={openCommand} data-testid="mock-mobile-search" />
      {dir.id !== 'swiss' && <IconBtn icon={Bell} label="Notifications" badge={3} data-testid="mock-mobile-notifications" />}
    </header>
  );
}

function MobileNav() {
  const { dir, go, screen } = useMock();
  const [more, setMore] = useState(false);
  const prim = MOBILE_PRIMARY.map((id) => NAV_BY_ID[id]);
  const inPrim = MOBILE_PRIMARY.includes(screen);
  if (dir.id === 'craft') {
    return (
      <>
        <nav className="m-bnav" data-testid="mock-mobile-nav">
          {prim.slice(0, 2).map((it) => (
            <button key={it.id} type="button" className={`m-bnav-btn ${screen === it.id ? 'is-active' : ''}`} onClick={() => go(it.id)} data-testid={`mock-bnav-${it.id}`}><it.icon size={20} /><span>{it.short}</span></button>
          ))}
          <button type="button" className="m-bnav-fab" onClick={() => go('devis', '?new=1')} data-testid="mock-bnav-new" aria-label="Nouveau"><Plus size={24} /></button>
          <button type="button" className={`m-bnav-btn ${screen === 'interventions' ? 'is-active' : ''}`} onClick={() => go('interventions')} data-testid="mock-bnav-interventions"><NAV_BY_ID.interventions.icon size={20} /><span>Travaux</span></button>
          <button type="button" className={`m-bnav-btn ${!inPrim ? 'is-active' : ''}`} onClick={() => setMore(true)} data-testid="mock-bnav-more"><MoreHorizontal size={20} /><span>Plus</span></button>
        </nav>
        <MoreSheet open={more} onClose={() => setMore(false)} />
      </>
    );
  }
  return (
    <>
      <nav className="m-bnav" data-testid="mock-mobile-nav">
        {prim.map((it) => (
          <button key={it.id} type="button" className={`m-bnav-btn ${screen === it.id ? 'is-active' : ''}`} onClick={() => go(it.id)} data-testid={`mock-bnav-${it.id}`}>
            <it.icon size={20} />
            <span>{it.short}</span>
          </button>
        ))}
        <button type="button" className={`m-bnav-btn ${!inPrim ? 'is-active' : ''}`} onClick={() => setMore(true)} data-testid="mock-bnav-more">
          <MoreHorizontal size={20} />
          <span>Plus</span>
        </button>
      </nav>
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </>
  );
}

/* ------------------------- Shell principal ------------------------- */
export function Shell({ screen, children }) {
  const { dir, go, isMobile } = useMock();
  const [collapsed, setCollapsed] = useState(false);
  const [panel, setPanel] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1360);
  const [swissIdx, setSwissIdx] = useState(false);
  const [profile, setProfile] = useState(false);
  const openProfile = () => setProfile(true);
  const current = NAV_BY_ID[screen] || NAV_ITEMS[0];
  const [clock, setClock] = useState('10:36');
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  if (isMobile) {
    return (
      <div className={`m-app m-app--mobile m-app--${dir.id}`}>
        {dir.id === 'swiss' ? (
          <header className="m-mtop m-mtop--swiss">
            <span className="m-swiss-word">ANELEC<b>—</b>TCE</span>
            <button type="button" className="m-swiss-menu-btn" onClick={() => setSwissIdx(true)} data-testid="mock-swiss-menu">Menu <MenuIcon size={16} /></button>
          </header>
        ) : (
          <MobileBar title={current.label} />
        )}
        <main className="m-content">{children}</main>
        {dir.id !== 'swiss' && <MobileNav />}
        <SwissIndex open={swissIdx} onClose={() => setSwissIdx(false)} />
            <ProfileModal open={profile} onClose={() => setProfile(false)} />
    </div>
    );
  }

  /* ---- 2. Craft : navigation horizontale ---- */
  if (dir.id === 'craft') {
    const gestion = NAV[1].items;
    const admin = NAV[2].items;
    const inG = gestion.some((i) => i.id === screen);
    const inA = admin.some((i) => i.id === screen);
    return (
      <div className="m-app m-app--craft">
        <header className="m-topnav">
          <button type="button" className="m-topnav-logo" onClick={() => go('tableau-de-bord')} data-testid="mock-logo"><Logo /></button>
          <nav className="m-topnav-links">
            {NAV[0].items.map((it) => (
              <button key={it.id} type="button" className={`m-topnav-link ${screen === it.id ? 'is-active' : ''}`} onClick={() => go(it.id)} data-testid={`mock-nav-${it.id}`}>
                {it.short === 'Pilotage' ? 'Pilotage' : it.label}
                {it.badge && it.id === 'planning' ? <em>{it.badge}</em> : null}
              </button>
            ))}
            <Menu align="left" testid="mock-nav-gestion" trigger={<button type="button" className={`m-topnav-link ${inG ? 'is-active' : ''}`}>Gestion <ChevronDown size={14} /></button>} items={gestion.map((it) => ({ label: it.label, icon: it.icon, onClick: () => go(it.id), testid: `mock-nav-${it.id}` }))} />
            <Menu align="left" testid="mock-nav-admin" trigger={<button type="button" className={`m-topnav-link ${inA ? 'is-active' : ''}`}>Administration <ChevronDown size={14} /></button>} items={admin.map((it) => ({ label: it.label, icon: it.icon, onClick: () => go(it.id), testid: `mock-nav-${it.id}` }))} />
            <button type="button" className={`m-topnav-link ${screen === 'terrain' ? 'is-active' : ''}`} onClick={() => go('terrain')} data-testid="mock-nav-terrain">Terrain</button>
          </nav>
          <div className="m-topnav-end">
            <TopActions compactSearch />
            <UserMenu compact onOpenProfile={openProfile} />
          </div>
        </header>
        <main className="m-content">{children}</main>
            <ProfileModal open={profile} onClose={() => setProfile(false)} />
    </div>
    );
  }

  /* ---- 4. Swiss : en-tête éditorial ---- */
  if (dir.id === 'swiss') {
    return (
      <div className="m-app m-app--swiss">
        <header className="m-swiss-head">
          <button type="button" className="m-swiss-word" onClick={() => go('tableau-de-bord')} data-testid="mock-logo">ANELEC<b>—</b>TCE</button>
          <nav className="m-swiss-nav">
            {NAV_ITEMS.map((it) => (
              <button key={it.id} type="button" className={screen === it.id ? 'is-active' : ''} onClick={() => go(it.id)} data-testid={`mock-nav-${it.id}`}>{it.short}</button>
            ))}
          </nav>
          <div className="m-topnav-end">
            <TopActions compactSearch />
            <UserMenu compact onOpenProfile={openProfile} />
          </div>
        </header>
        <div className="m-swiss-crumbs">
          <span>{COMPANY.name}</span><span>/</span><strong>{current.label}</strong>
          <time>{TODAY_LABEL}</time>
        </div>
        <main className="m-content">{children}</main>
            <ProfileModal open={profile} onClose={() => setProfile(false)} />
    </div>
    );
  }

  /* ---- 3. Signal : rail + panneau de commande ---- */
  if (dir.id === 'signal') {
    return (
      <div className={`m-app m-app--signal ${panel ? 'has-panel' : ''}`}>
        <aside className="m-rail">
          <button type="button" className="m-rail-logo" onClick={() => go('tableau-de-bord')} data-testid="mock-logo"><Logo compact /></button>
          <nav>
            {NAV.map((g, gi) => (
              <div key={g.group} className="m-rail-group">
                {gi > 0 && <hr />}
                {g.items.map((it) => <NavButton key={it.id} item={it} active={screen === it.id} onClick={() => go(it.id)} showLabel={false} variant="m-rail-item" />)}
              </div>
            ))}
          </nav>
          <UserMenu compact onOpenProfile={openProfile} />
        </aside>
        <div className="m-main">
          <header className="m-topbar">
            <div className="m-topbar-title">
              <span className="m-live"><i /> EN DIRECT</span>
              <strong>{current.label}</strong>
              <span className="m-mono m-muted">{TODAY_LABEL} · {clock}</span>
            </div>
            <div className="m-topbar-end">
              <TopActions />
              {!panel && <IconBtn icon={Activity} label="Afficher le fil en direct" onClick={() => setPanel(true)} data-testid="mock-command-panel-open" />}
            </div>
          </header>
          <main className="m-content">{children}</main>
        </div>
        {panel && <CommandPanel onClose={() => setPanel(false)} />}
            <ProfileModal open={profile} onClose={() => setProfile(false)} />
    </div>
    );
  }

  /* ---- 1. Atlas & 5. Bento : barre latérale ---- */
  const bento = dir.id === 'bento';
  return (
    <div className={`m-app m-app--${dir.id} ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="m-side">
        <div className="m-side-brand">
          <button type="button" onClick={() => go('tableau-de-bord')} className="m-side-logo" data-testid="mock-logo">{collapsed ? <Logo compact /> : <Logo />}</button>
          <IconBtn icon={collapsed ? ChevronRight : ChevronLeft} label={collapsed ? 'Déplier' : 'Replier'} onClick={() => setCollapsed((c) => !c)} className="m-side-collapse" size={14} data-testid="mock-sidebar-collapse" />
        </div>
        {bento && !collapsed && (
          <div className="m-side-company">
            <span className="m-side-company-mark">AG</span>
            <span><strong>{COMPANY.name}</strong><small>Espace entreprise</small></span>
          </div>
        )}
        <nav className="m-side-nav">
          {NAV.map((g) => (
            <div key={g.group} className="m-side-group">
              {!collapsed && <span className="m-side-label">{g.group}</span>}
              {g.items.map((it) => <NavButton key={it.id} item={it} active={screen === it.id} onClick={() => go(it.id)} showLabel={!collapsed} />)}
            </div>
          ))}
        </nav>
        {!collapsed && (
          <div className="m-side-foot">
            {bento ? (
              <div className="m-side-sync"><i /> <span><strong>Planning synchronisé</strong><small>6 techniciens connectés</small></span></div>
            ) : (
              <UserMenu onOpenProfile={openProfile} />
            )}
          </div>
        )}
      </aside>
      <div className="m-main">
        <header className="m-topbar">
          <div className="m-topbar-title">
            {bento ? (
              <span className="m-muted">{TODAY_LABEL}</span>
            ) : (
              <span className="m-crumbs"><span>{COMPANY.name}</span><ChevronRight size={14} /><strong>{current.label}</strong></span>
            )}
          </div>
          <div className="m-topbar-end">
            <TopActions />
            {bento && <UserMenu compact onOpenProfile={openProfile} />}
          </div>
        </header>
        <main className="m-content">{children}</main>
      </div>
        <ProfileModal open={profile} onClose={() => setProfile(false)} />
  </div>
  );
}
