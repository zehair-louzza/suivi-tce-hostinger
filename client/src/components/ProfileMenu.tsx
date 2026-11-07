/**
 * ProfileMenu
 * ─────────────
 * Modal "Mon profil" déclenché depuis la sidebar (avatar + nom).
 * Contient :
 *  - Rappel identitaire (nom, e-mail, rôle, entreprise)
 *  - PersonalThemePicker : le collaborateur choisit son apparence
 *  - Bouton de déconnexion
 */

import { useEffect } from 'react';
import { useAuth } from '../stores/authStore';
import { PersonalThemePicker } from './AppearancePanel';

interface ProfileMenuProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function ProfileMenu({ open, onClose, onLogout }: ProfileMenuProps) {
  const { user } = useAuth();

  // Fermer avec Échap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !user) return null;

  const initials = user.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'U';
  const roleLabel = user.role === 'ADMIN' ? 'Administrateur' : user.role === 'CHIFFRAGE_DEVIS' ? 'Chiffrage & Devis' : user.role === 'CONDUCTEUR_TRAVAUX' ? 'Conducteur de travaux' : user.role === 'REDACTEUR_RAPPORTS' ? 'Rédacteur de rapports' : user.role === 'TECHNICIEN' ? 'Technicien terrain' : user.role === 'VIEWER' ? 'Consultation seule' : user.role || 'Collaborateur';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-menu-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px 20px',
        animation: 'profile-fade 160ms ease',
      }}
      data-testid="profile-menu-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--rounded-card, 12px)',
          boxShadow: 'var(--shadow-lg, 0 24px 60px rgba(15,23,42,.25))',
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        data-testid="profile-menu-modal"
      >
        {/* En-tête */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '18px 22px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--color-primary)',
              color: 'var(--color-primary-ink, #fff)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 17,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong id="profile-menu-title" style={{ fontSize: 16, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </strong>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                {roleLabel}
              </span>
              {user.companyName && (
                <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{user.companyName}</span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            data-testid="profile-menu-close"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-subtle)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
            }}
          >
            ✕
          </button>
        </header>

        {/* Contenu */}
        <main
          style={{
            padding: '18px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <section>
            <PersonalThemePicker />
          </section>
        </main>

        {/* Pied */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 22px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface-subtle)',
          }}
        >
          <span style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: 12 }}>
            Besoin d'aide ? Contactez votre administrateur.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onLogout(); }}
            data-testid="profile-menu-logout"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-danger, #DC2626)',
              background: 'var(--color-danger, #DC2626)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Se déconnecter
          </button>
        </footer>
      </div>
      <style>{`
        @keyframes profile-fade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
