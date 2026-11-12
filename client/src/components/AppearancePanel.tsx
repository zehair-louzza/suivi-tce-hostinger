/**
 * ANELEC — Panneau Apparence
 * ─────────────────────────────
 * Panneau destiné à l'onglet « Apparence » de l'administration.
 * Permet à l'administrateur :
 *  1. De choisir l'apparence par défaut de l'entreprise (7 thèmes).
 *  2. D'autoriser (ou non) les utilisateurs à surcharger ce choix sur leur profil.
 *  3. De voir à tout moment un aperçu en direct (le site change de couleurs
 *     à mesure qu'il survole les cartes de thème).
 */

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTheme, THEMES, ThemeId, ThemeDescriptor } from '../stores/themeStore';
import { useAuth } from '../stores/authStore';
import { api, adminApi } from '../lib/api';
import { geocodeAddress } from '../lib/geocoding';
import { ProGlyph } from './ProIcons';

interface ThemeCardProps {
  theme: ThemeDescriptor;
  isDefault: boolean;
  isCurrent: boolean;
  onSelect: (id: ThemeId) => void;
  onHover: (id: ThemeId | null) => void;
}

function ThemeCard({ theme, isDefault, isCurrent, onSelect, onHover }: ThemeCardProps) {
  const isDark = theme.mood === 'dark';
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      onMouseEnter={() => onHover(theme.id)}
      onMouseLeave={() => onHover(null)}
      data-testid={`theme-card-${theme.id}`}
      className={`theme-card ${isDefault ? 'is-default' : ''} ${isCurrent ? 'is-current' : ''}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px',
        border: `2px solid ${isDefault ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 'var(--rounded-card, 10px)',
        background: 'var(--color-surface)',
        boxShadow: isDefault ? '0 0 0 3px var(--color-primary-soft)' : 'var(--shadow-sm)',
        transition: 'border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
      }}
    >
      {/* Miniature */}
      <div
        aria-hidden="true"
        style={{
          height: 118,
          borderRadius: 8,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: isDark ? '42px 1fr' : '42px 1fr',
          background: isDark ? '#0B1220' : '#F4F5F8',
          border: `1px solid ${isDark ? '#23364F' : '#E5E7EB'}`,
        }}
      >
        <div style={{ background: theme.swatches[2] || '#142536', display: 'flex', flexDirection: 'column', gap: 4, padding: 6 }}>
          <span style={{ height: 16, background: theme.swatches[0], borderRadius: 3, display: 'block' }} />
          <span style={{ height: 6, background: 'rgba(255,255,255,.4)', borderRadius: 2, display: 'block' }} />
          <span style={{ height: 6, background: 'rgba(255,255,255,.25)', borderRadius: 2, display: 'block' }} />
          <span style={{ height: 6, background: 'rgba(255,255,255,.25)', borderRadius: 2, display: 'block' }} />
        </div>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 28,
                  background: isDark ? '#13213A' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#23364F' : '#E5E7EB'}`,
                  borderRadius: 6,
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 3, background: theme.swatches[i % theme.swatches.length], display: 'block' }} />
                <span style={{ width: '70%', height: 3, borderRadius: 1, background: isDark ? '#2E4568' : '#CBD5E1', display: 'block' }} />
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              background: isDark ? '#13213A' : '#FFFFFF',
              border: `1px solid ${isDark ? '#23364F' : '#E5E7EB'}`,
              borderRadius: 6,
              padding: 6,
              display: 'flex',
              alignItems: 'flex-end',
            }}
          >
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" width="100%" height="24">
              <polyline
                points="0,20 15,18 30,14 45,10 60,8 75,4 90,6 100,2"
                fill="none"
                stroke={theme.swatches[0]}
                strokeWidth="1.8"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Palette */}
      <div style={{ display: 'flex', gap: 4 }}>
        {theme.swatches.map((c) => (
          <span key={c} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid rgba(0,0,0,.08)' }} />
        ))}
      </div>

      {/* Titre + tagline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>{theme.name}</strong>
          {theme.isOriginal && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--color-surface-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
              Par défaut
            </span>
          )}
          {theme.mood === 'dark' && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#0F172A', color: '#F8FAFC' }}>
              Sombre
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>{theme.tagline}</span>
      </div>

      {/* Badges d'état */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
        {isDefault && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--color-primary)', color: 'var(--color-inverse-text, #fff)' }}>
            Défaut entreprise
          </span>
        )}
        {isCurrent && !isDefault && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--color-info-soft)', color: 'var(--color-info)' }}>
            Aperçu actif
          </span>
        )}
      </div>
    </button>
  );
}

export function AppearancePanel() {
  const { current, companyDefault, allowUserOverride, isPending, setCompanyDefault, setAllowUserOverride, previewTheme } = useTheme();
  const { user } = useAuth();
  const [hover, setHover] = useState<ThemeId | null>(null);
  const [pending, setPending] = useState<ThemeId | null>(null);

  const previewId = hover || pending || current;
  // Appliquer l'aperçu temporairement pendant le survol (non persistant).
  const applyPreview = (id: ThemeId | null) => {
    setHover(id);
    previewTheme(id);
  };

  const confirm = async (id: ThemeId) => {
    try {
      setPending(id);
      await setCompanyDefault(id);
      setHover(null);
      toast.success(
        `Apparence « ${THEMES.find((t) => t.id === id)?.name} » définie comme défaut de l'entreprise.`,
        { duration: 3000 },
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Impossible d'enregistrer le thème. Réessayez.");
    } finally {
      setPending(null);
    }
  };

  const isAdmin = user?.role === 'ADMIN' || Boolean(user?.permissions?.canManageUsers) || user?.id === 1;

  if (!isAdmin) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--rounded-card, 10px)' }}>
        <strong style={{ fontSize: 15, color: 'var(--color-text)' }}>Apparence</strong>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 13.5 }}>
          Ce réglage est réservé aux administrateurs de l'entreprise. Vous pouvez tout de même choisir une apparence personnelle depuis votre profil (si cette option est autorisée).
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="appearance-panel">
      <AccueilMaFileToggle />
      <SiegeAddressPanel />

      {/* Bandeau introductif */}
      <section
        style={{
          padding: 18,
          borderRadius: 'var(--rounded-card, 10px)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'var(--color-primary-soft)',
            color: 'var(--color-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <ProGlyph name="palette" size={22} />
        </span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong style={{ fontSize: 16, color: 'var(--color-text)' }}>Apparence de la plateforme</strong>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
            Choisissez l'apparence par défaut qui s'applique à l'ensemble de votre entreprise.
            Chaque collaborateur pourra ensuite personnaliser la sienne depuis son profil si vous l'autorisez.
            Survolez une carte pour voir le résultat en direct, cliquez pour confirmer.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
              padding: '10px 14px',
              background: 'var(--color-surface-subtle)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--color-text)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Défaut actuel : </strong>
              <strong>{THEMES.find((t) => t.id === companyDefault)?.name}</strong>
            </span>
            <span style={{ flex: 1 }} />
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--color-text)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={allowUserOverride}
                disabled={isPending}
                onChange={async (e) => {
                  const next = e.target.checked;
                  try {
                    await setAllowUserOverride(next);
                    toast.success(
                      next
                        ? 'Les collaborateurs peuvent désormais personnaliser leur apparence.'
                        : 'Personnalisation personnelle désactivée — tous reviennent au défaut.',
                      { duration: 2500 },
                    );
                  } catch (err: any) {
                    toast.error(err?.response?.data?.error || "Modification impossible.");
                  }
                }}
                data-testid="theme-allow-override-toggle"
                style={{ width: 16, height: 16 }}
              />
              Autoriser la personnalisation individuelle
            </label>
          </div>
        </div>
      </section>

      {/* Grille de thèmes */}
      <section>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              isDefault={t.id === companyDefault}
              isCurrent={t.id === previewId}
              onSelect={confirm}
              onHover={applyPreview}
            />
          ))}
        </div>
      </section>

      {/* Note de bas */}
      <section
        style={{
          padding: 14,
          borderRadius: 'var(--rounded-card, 10px)',
          background: 'var(--color-surface-subtle)',
          border: '1px dashed var(--color-border)',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
        }}
      >
        <strong style={{ color: 'var(--color-text)' }}>À savoir :</strong> le choix est appliqué immédiatement à toute l'entreprise.
        Les sessions ouvertes se rafraîchissent automatiquement à la prochaine action, ou dès la prochaine connexion.
        Aucun écran ni aucune fonctionnalité métier n'est modifié — seules les couleurs, typographies et courbures des éléments d'interface changent.
      </section>
    </div>
  );
}

/**
 * Bloc léger pour un onglet « Profil » utilisateur :
 * permet à chacun de choisir son thème personnel ou de revenir au défaut.
 */
export function PersonalThemePicker() {
  const { companyDefault, userPref, allowUserOverride, isPending, setUserPref } = useTheme();
  if (!allowUserOverride) {
    return (
      <div style={{ padding: 14, borderRadius: 'var(--rounded-card, 10px)', background: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        La personnalisation de l'apparence a été désactivée par votre administrateur. Le thème « {THEMES.find((t) => t.id === companyDefault)?.name} » s'applique à l'ensemble de l'entreprise.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>Mon apparence</strong>
          <p style={{ margin: '2px 0 0', color: 'var(--color-text-secondary)', fontSize: 12.5 }}>
            Choisissez votre apparence personnelle, elle s'applique à votre compte et vous suit d'un appareil à l'autre.
          </p>
        </div>
        {userPref && (
          <button
            type="button"
            disabled={isPending}
            onClick={async () => {
              try {
                await setUserPref(null);
                toast.success("Apparence personnelle réinitialisée — retour au défaut de l'entreprise.", { duration: 2500 });
              } catch (err: any) {
                toast.error(err?.response?.data?.error || 'Impossible de réinitialiser.');
              }
            }}
            data-testid="theme-reset-user"
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Revenir au défaut entreprise
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {THEMES.map((t) => {
          const isActive = (userPref ?? companyDefault) === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={isPending}
              onClick={async () => {
                try {
                  await setUserPref(t.id);
                  toast.success(`Votre apparence est désormais « ${t.name} ».`, { duration: 2200 });
                } catch (err: any) {
                  toast.error(err?.response?.data?.error || 'Impossible de changer de thème.');
                }
              }}
              data-testid={`theme-personal-${t.id}`}
              style={{
                all: 'unset',
                cursor: isPending ? 'wait' : 'pointer',
                padding: 10,
                borderRadius: 10,
                border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: 'var(--color-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: isPending ? 0.65 : 1,
              }}
            >
              <div style={{ width: 44, height: 32, borderRadius: 6, background: `linear-gradient(135deg, ${t.swatches[0]} 0%, ${t.swatches[2]} 100%)`, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <strong style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</strong>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t.mood === 'dark' ? 'Sombre' : 'Clair'} · {t.tags.slice(0, 2).join(' · ')}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Section « Adresse du siège » — permet à l'administrateur de définir
 * le point de départ des tournées (géocodé automatiquement via BAN).
 */
function SiegeAddressPanel() {
  const { user, fetchMe } = useAuth();
  const company = (user as any)?.company;
  const currentAddr = company?.siegeAdresse || '';

  const [addr, setAddr] = useState(currentAddr);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<{ lat: number; lng: number; label: string } | null>(null);

  // Sync state if user data changes (e.g. after fetchMe)
  const displayAddr = addr || currentAddr;

  const doGeocode = useCallback(async () => {
    const trimmed = addr.trim();
    if (!trimmed || trimmed.length < 5) {
      toast.error('Veuillez saisir une adresse complète.');
      return;
    }
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const result = await geocodeAddress(trimmed);
      if (result) {
        setGeocodeResult({ lat: result.lat, lng: result.lng, label: result.label || trimmed });
        toast.success(`Adresse trouvée : ${result.label || trimmed}`);
      } else {
        toast.error('Adresse introuvable. Vérifiez et réessayez.');
      }
    } catch {
      toast.error('Erreur de géocodage. Réessayez.');
    } finally {
      setGeocoding(false);
    }
  }, [addr]);

  const doSave = useCallback(async () => {
    if (!geocodeResult) {
      toast.error('Veuillez d\'abord vérifier l\'adresse.');
      return;
    }
    setSaving(true);
    try {
      await adminApi.updateSiege({
        siegeAdresse: geocodeResult.label,
        siegeLat: geocodeResult.lat,
        siegeLng: geocodeResult.lng,
      });
      await fetchMe();
      toast.success('Adresse du siège enregistrée avec succès.');
      setGeocodeResult(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Impossible d\'enregistrer l\'adresse.');
    } finally {
      setSaving(false);
    }
  }, [geocodeResult, fetchMe]);

  return (
    <section
      style={{
        padding: 18,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--rounded-card, 10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      data-testid="siege-address-section"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'var(--color-primary-soft)',
            color: 'var(--color-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <ProGlyph name="pin" size={22} />
        </span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong style={{ fontSize: 16, color: 'var(--color-text)' }}>Adresse du siège</strong>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
            Définissez l'adresse de départ des tournées de votre entreprise. Cette adresse sera utilisée pour le calcul des distances et des temps de trajet sur la carte.
          </p>
        </div>
      </div>

      {/* Adresse actuelle */}
      {currentAddr && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--color-surface-subtle)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Adresse actuelle :</span>
          <span>{currentAddr}</span>
        </div>
      )}

      {/* Champ de saisie */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={displayAddr}
          onChange={(e) => { setAddr(e.target.value); setGeocodeResult(null); }}
          placeholder="Ex : 12 Rue de la Paix, 75002 Paris"
          data-testid="siege-address-input"
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 14,
            outline: 'none',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') doGeocode(); }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={doGeocode}
          disabled={geocoding || !addr.trim()}
          data-testid="siege-address-geocode"
          style={{ whiteSpace: 'nowrap' }}
        >
          {geocoding ? 'Recherche…' : 'Vérifier l\'adresse'}
        </button>
      </div>

      {/* Résultat du géocodage */}
      {geocodeResult && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--color-success-soft, #ecfdf5)',
            borderRadius: 8,
            border: '1px solid var(--color-success, #10b981)',
            fontSize: 13,
            color: 'var(--color-text)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
          data-testid="siege-geocode-result"
        >
          <div>
            <strong>Adresse vérifiée :</strong> {geocodeResult.label}
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
            Coordonnées : {geocodeResult.lat.toFixed(6)}, {geocodeResult.lng.toFixed(6)}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={doSave}
            disabled={saving}
            data-testid="siege-address-save"
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer cette adresse'}
          </button>
        </div>
      )}

      {/* Note explicative */}
      {!currentAddr && !geocodeResult && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--color-warning-soft, #fffbeb)',
            borderRadius: 8,
            border: '1px dashed var(--color-warning, #f59e0b)',
            fontSize: 12.5,
            color: 'var(--color-text-secondary)',
          }}
        >
          ⚠️ Aucune adresse de siège n'est configurée. La carte utilisera une adresse par défaut (Paris) comme point de départ des tournées.
        </div>
      )}
    </section>
  );
}

/**
 * Bascule « ouvrir le tableau de bord sur Ma file », pour toute la société.
 * Désactivée par défaut : l'accueil actuel ne change pour personne tant qu'un
 * administrateur ne l'a pas activée.
 */
function AccueilMaFileToggle() {
  const { user, fetchMe } = useAuth();
  const actif = user?.company?.accueilMaFile === true;
  const [pending, setPending] = useState(false);

  const basculer = async () => {
    setPending(true);
    try {
      await api.patch('/admin/appearance', { accueilMaFile: !actif });
      await fetchMe();
      toast.success(
        !actif
          ? '« Ma file » s’affiche maintenant en haut du tableau de bord pour toute la société.'
          : '« Ma file » est masquée ; le tableau de bord retrouve son accueil habituel.'
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Impossible de modifier ce réglage.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      style={{
        padding: 18,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--rounded-card, 10px)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        alignItems: 'center',
      }}
      data-testid="accueil-mafile-section"
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <strong style={{ fontSize: 15, color: 'var(--color-text)' }}>Accueil sur « Ma file »</strong>
        <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
          Affiche en haut du tableau de bord ce que chaque personne doit faire, selon son rôle : à chiffrer, à
          planifier, interventions du jour, à facturer. Le tableau de bord actuel reste en dessous, inchangé.
        </p>
      </div>
      <button
        type="button"
        className={`btn ${actif ? 'btn-secondary' : 'btn-primary'}`}
        onClick={basculer}
        disabled={pending}
        data-testid="accueil-mafile-toggle"
      >
        {pending ? 'Enregistrement…' : actif ? 'Masquer « Ma file »' : 'Activer « Ma file »'}
      </button>
    </section>
  );
}
