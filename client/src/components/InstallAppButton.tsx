/**
 * Installation de l'application sur téléphone / ordinateur (PWA).
 * - Android / Chrome / Edge / Samsung Internet : capture l'événement `beforeinstallprompt`
 *   pour proposer un vrai bouton « Installer ».
 * - iPhone / iPad (Safari) : Apple n'autorise pas de bouton automatique → on affiche
 *   les étapes « Partager → Sur l'écran d'accueil ».
 */
import { useEffect, useState, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function registerServiceWorker() {
  // Pas de service worker en développement local (évite les caches gênants avec Vite)
  const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '5173';
  if (!('serviceWorker' in navigator) || isLocalDev) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('Service worker non enregistré :', err);
    });
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent || '';
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isIPadOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function isIOSNonSafari(): boolean {
  return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(navigator.userAgent || '');
}

function useDeferredPrompt() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => deferredPrompt,
    () => null
  );
}

interface InstallAppButtonProps {
  /** 'compact' : petit bouton pour la barre du haut ; 'banner' : carte pleine largeur */
  variant?: 'compact' | 'banner';
}

export function InstallAppButton({ variant = 'compact' }: InstallAppButtonProps) {
  const prompt = useDeferredPrompt();
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const platform = typeof window !== 'undefined' ? detectPlatform() : 'desktop';

  useEffect(() => {
    setInstalled(isStandalone());
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      deferredPrompt = null;
      notify();
      if (choice.outcome === 'accepted') setInstalled(true);
      return;
    }
    setShowHelp(true);
  };

  const label = '📲 Installer l’application';

  return (
    <>
      {variant === 'banner' ? (
        <button
          type="button"
          onClick={handleClick}
          className="btn btn-secondary"
          style={{ width: '100%', minHeight: '44px', fontWeight: 800 }}
        >
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px 10px', fontWeight: 700 }}
          title="Installer l’application sur cet appareil"
        >
          <span>📲</span>
          <span className="desktop-only-el">Installer l’app</span>
        </button>
      )}

      {showHelp && (
        <div className="cmd-palette-backdrop" onClick={() => setShowHelp(false)} style={{ alignItems: 'center', paddingTop: 0 }}>
          <div
            className="cmd-palette-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '20px', gap: '12px', maxWidth: '420px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/icons/icon-192.png" alt="" width={48} height={48} style={{ borderRadius: '12px' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px' }}>Installer ANELEC TCE</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  L’application s’ouvrira en plein écran, comme une app native.
                </div>
              </div>
            </div>

            {platform === 'ios' ? (
              isIOSNonSafari() ? (
                <ol style={{ paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.7 }}>
                  <li>Sur iPhone, l’installation se fait depuis <strong>Safari</strong>.</li>
                  <li>Copiez l’adresse <strong>suivi.anelecgroupe.com</strong> et ouvrez-la dans Safari.</li>
                  <li>Puis suivez : <strong>Partager ⬆️ → « Sur l’écran d’accueil »</strong>.</li>
                </ol>
              ) : (
                <ol style={{ paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.7 }}>
                  <li>Touchez le bouton <strong>Partager</strong> ⬆️ en bas de Safari.</li>
                  <li>Faites défiler et choisissez <strong>« Sur l’écran d’accueil »</strong> ➕.</li>
                  <li>Touchez <strong>« Ajouter »</strong> en haut à droite.</li>
                </ol>
              )
            ) : platform === 'android' ? (
              <ol style={{ paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.7 }}>
                <li>Ouvrez le menu <strong>⋮</strong> en haut à droite de Chrome.</li>
                <li>Touchez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.</li>
                <li>Confirmez avec <strong>« Installer »</strong>.</li>
                <li style={{ color: 'var(--text-secondary)' }}>
                  Si l’option n’apparaît pas, rechargez la page une fois puis réessayez.
                </li>
              </ol>
            ) : (
              <ol style={{ paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.7 }}>
                <li>Dans Chrome ou Edge, cliquez sur l’icône <strong>d’installation</strong> ⊕ à droite de la barre d’adresse.</li>
                <li>Ou menu <strong>⋮ → « Installer ANELEC TCE »</strong>.</li>
              </ol>
            )}

            <button type="button" className="btn btn-primary" style={{ minHeight: '42px' }} onClick={() => setShowHelp(false)}>
              J’ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
