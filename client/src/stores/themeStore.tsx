/**
 * ANELEC — Thème (apparence) sélectionnable
 * ─────────────────────────────────────────
 * • Deux couches de préférence :
 *   1. Un défaut *entreprise*, choisi par l'administrateur (persistance BDD).
 *   2. Une préférence *personnelle* par utilisateur (persistance BDD si autorisée).
 * • Sources :
 *   - Au boot, on prend localStorage (affichage instantané).
 *   - Dès que /me répond, on remplace par les valeurs du serveur (source de vérité).
 *   - Les changements admin / utilisateur appellent l'API et, si OK, mettent à jour
 *     localStorage + authStore.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from './authStore';

export type ThemeId = 'light' | 'dark' | 'atlas' | 'craft' | 'signal' | 'swiss' | 'bento';

export interface ThemeDescriptor {
  id: ThemeId;
  name: string;
  tagline: string;
  description: string;
  swatches: string[];
  fonts: { display: string; body: string };
  mood: 'light' | 'dark';
  tags: string[];
  isOriginal?: boolean;
}

export const THEMES: ThemeDescriptor[] = [
  {
    id: 'light',
    name: 'Clarté',
    tagline: 'Sobre et lisible : l’apparence ANELEC, sans surprise.',
    description:
      "Quatre cartes KPI en ligne, barre latérale bleu nuit, vert d'action. Le meilleur choix pour une prise en main immédiate, au bureau comme sur le terrain.",
    swatches: ['#047857', '#00bf63', '#142536', '#f6f8fa', '#b91c1c'],
    fonts: { display: 'Inter', body: 'Inter' },
    mood: 'light',
    tags: ['Par défaut', 'Sobre', 'Équilibré'],
    isOriginal: true,
  },
  {
    id: 'craft',
    name: 'Chronologie',
    tagline: 'Chaleureux : la journée se lit comme une frise.',
    description:
      "Fonds crème, ambre et formes arrondies. Les indicateurs forment un seul bandeau et le planning du jour se lit comme une chronologie. Idéal pour suivre la journée d'équipe.",
    swatches: ['#b45309', '#047857', '#2a2118', '#fbf7ef', '#b91c1c'],
    fonts: { display: 'Manrope', body: 'Manrope' },
    mood: 'light',
    tags: ['Chaleureux', 'Arrondi', 'Journée'],
  },
  {
    id: 'signal',
    name: 'Signal',
    tagline: 'Pilotage : un filet de couleur dit tout de suite où agir.',
    description:
      "Fond clair aux couleurs du site, filets de statut colorés en haut de chaque carte (vert, jaune, ambre, rouge) et chiffres en police à chasse fixe. Pour ceux qui traitent beaucoup de dossiers.",
    swatches: ['#047857', '#f5b400', '#e8edf2', '#f6f8fa', '#ef4444'],
    fonts: { display: 'IBM Plex Sans', body: 'IBM Plex Sans' },
    mood: 'light',
    tags: ['Pilotage', 'Dense', 'Statuts'],
  },
  {
    id: 'atlas',
    name: 'Atlas',
    tagline: 'Un chiffre phare, trois indicateurs en pile.',
    description:
      "Bleu profond, grand chiffre d'affaires à gauche et trois indicateurs empilés à droite. Une lecture en un coup d'œil pour la direction.",
    swatches: ['#1d4ed8', '#60a5fa', '#0f172a', '#f6f7fb', '#dc2626'],
    fonts: { display: 'Space Grotesk', body: 'Space Grotesk' },
    mood: 'light',
    tags: ['Direction', 'Moderne', 'Synthèse'],
  },
  {
    id: 'bento',
    name: 'Bento',
    tagline: 'Des tuiles colorées, très arrondies, faciles à toucher.',
    description:
      "Tuile noire large pour le chiffre d'affaires, tuiles jaune et rouge pour ce qui demande de l'attention. Très lisible sur téléphone et tablette.",
    swatches: ['#111827', '#f5b400', '#15803d', '#f2f3f5', '#b91c1c'],
    fonts: { display: 'Sora', body: 'Figtree' },
    mood: 'light',
    tags: ['Tuiles', 'Tactile', 'Marque'],
  },
  {
    id: 'swiss',
    name: 'Éditorial',
    tagline: 'Typographie d’abord : grands chiffres, filets, aucun décor.',
    description:
      "Blanc, encre et bleu royal, angles vifs. Les indicateurs sont de grands chiffres séparés par des filets, sans cartes. Pour un rendu sérieux et très imprimable.",
    swatches: ['#0b3b8f', '#e07a5f', '#0b1220', '#ffffff', '#b91c1c'],
    fonts: { display: 'Manrope', body: 'Karla' },
    mood: 'light',
    tags: ['Typographique', 'Sobre', 'Imprimable'],
  },
  {
    id: 'dark',
    name: 'Mode sombre',
    tagline: 'La même structure que Clarté, en sombre.',
    description:
      "Pour les longues sessions en soirée ou les postes peu éclairés. Mêmes repères et mêmes emplacements que Clarté.",
    swatches: ['#10b981', '#00bf63', '#0a1017', '#0b111a', '#ef4444'],
    fonts: { display: 'Inter', body: 'Inter' },
    mood: 'dark',
    tags: ['Sombre', 'Confort visuel'],
  },
];

/** Polices propres à chaque direction (Clarté et Mode sombre : Inter, déjà chargée). */
const THEME_FONT_QUERY: Partial<Record<ThemeId, string>> = {
  craft: 'family=Manrope:wght@500;600;700;800',
  signal: 'family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600',
  atlas: 'family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600',
  bento: 'family=Sora:wght@500;600;700;800&family=Figtree:wght@400;500;600;700',
  swiss: 'family=Manrope:wght@500;600;700;800&family=Karla:wght@400;500;600;700&family=Source+Code+Pro:wght@500;600',
};

/** Charge les polices d'une direction à la demande (une seule fois par direction). */
function ensureThemeFonts(id: ThemeId): void {
  const query = THEME_FONT_QUERY[id];
  if (!query || typeof document === 'undefined') return;
  const linkId = `anelec-theme-fonts-${id}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  document.head.appendChild(link);
}

export const DEFAULT_THEME: ThemeId = 'atlas';
const ALL_IDS = THEMES.map((t) => t.id);
const isValid = (v: unknown): v is ThemeId => typeof v === 'string' && (ALL_IDS as string[]).includes(v);

// Clés localStorage (cache rapide pour le premier rendu)
const K_COMPANY = 'anelec_theme_company_default';
const K_USER = 'anelec_theme_user_pref';
const K_ALLOW = 'anelec_theme_allow_user_override';

function readCompanyDefault(): ThemeId {
  const v = localStorage.getItem(K_COMPANY);
  return isValid(v) ? v : DEFAULT_THEME;
}
function readUserPref(): ThemeId | null {
  const v = localStorage.getItem(K_USER);
  return isValid(v) ? v : null;
}
function readAllowOverride(): boolean {
  return localStorage.getItem(K_ALLOW) !== 'false';
}
function writeCache(companyDefault: ThemeId, userPref: ThemeId | null, allowOverride: boolean) {
  localStorage.setItem(K_COMPANY, companyDefault);
  localStorage.setItem(K_ALLOW, String(allowOverride));
  if (userPref) localStorage.setItem(K_USER, userPref);
  else localStorage.removeItem(K_USER);
}

function applyTheme(id: ThemeId): void {
  ensureThemeFonts(id);
  const html = document.documentElement;
  html.setAttribute('data-theme-switching', '1');
  html.setAttribute('data-theme', id);
  window.setTimeout(() => html.removeAttribute('data-theme-switching'), 260);
}

function resolve(companyDefault: ThemeId, userPref: ThemeId | null, allow: boolean): ThemeId {
  return allow && userPref ? userPref : companyDefault;
}

export interface ThemeContextValue {
  current: ThemeId;
  companyDefault: ThemeId;
  userPref: ThemeId | null;
  allowUserOverride: boolean;
  isPending: boolean;
  setCompanyDefault: (id: ThemeId) => Promise<void>;
  setUserPref: (id: ThemeId | null) => Promise<void>;
  setAllowUserOverride: (allow: boolean) => Promise<void>;
  previewTheme: (id: ThemeId | null) => void;
  themes: ThemeDescriptor[];
  previewFor: (id: ThemeId) => ThemeDescriptor | undefined;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ThemeId>(DEFAULT_THEME);
  const [companyDefault, setCompanyDefaultState] = useState<ThemeId>(DEFAULT_THEME);
  const [userPref, setUserPrefState] = useState<ThemeId | null>(null);
  const [allowUserOverride, setAllowUserOverrideState] = useState<boolean>(true);
  const [isPending, setIsPending] = useState<boolean>(false);

  // 1) Au boot : lire le cache local pour un rendu instantané.
  useEffect(() => {
    const cd = readCompanyDefault();
    const up = readUserPref();
    const allow = readAllowOverride();
    setCompanyDefaultState(cd);
    setUserPrefState(up);
    setAllowUserOverrideState(allow);
    const resolved = resolve(cd, up, allow);
    setCurrent(resolved);
    applyTheme(resolved);
  }, []);

  // 2) Dès que /me a répondu, prendre le serveur comme source de vérité.
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      const u = state.user;
      if (!u || !u.theme) return;
      const cd = (isValid(u.theme.companyDefault) ? u.theme.companyDefault : DEFAULT_THEME) as ThemeId;
      const up = (isValid(u.theme.userPref) ? u.theme.userPref : null) as ThemeId | null;
      const allow = u.theme.allowOverride !== false;
      setCompanyDefaultState(cd);
      setUserPrefState(up);
      setAllowUserOverrideState(allow);
      writeCache(cd, up, allow);
      const resolved = resolve(cd, up, allow);
      setCurrent(resolved);
      applyTheme(resolved);
    });
    // Appliquer immédiatement si un user est déjà en mémoire (navigation interne)
    const u = useAuthStore.getState().user;
    if (u?.theme) {
      const cd = (isValid(u.theme.companyDefault) ? u.theme.companyDefault : DEFAULT_THEME) as ThemeId;
      const up = (isValid(u.theme.userPref) ? u.theme.userPref : null) as ThemeId | null;
      const allow = u.theme.allowOverride !== false;
      setCompanyDefaultState(cd);
      setUserPrefState(up);
      setAllowUserOverrideState(allow);
      writeCache(cd, up, allow);
      const resolved = resolve(cd, up, allow);
      setCurrent(resolved);
      applyTheme(resolved);
    }
    return () => unsub();
  }, []);

  // Multi-onglets
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (![K_COMPANY, K_USER, K_ALLOW].includes(e.key || '')) return;
      const cd = readCompanyDefault();
      const up = readUserPref();
      const allow = readAllowOverride();
      setCompanyDefaultState(cd);
      setUserPrefState(up);
      setAllowUserOverrideState(allow);
      const resolved = resolve(cd, up, allow);
      setCurrent(resolved);
      applyTheme(resolved);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Aperçu temporaire (survol) — n'est pas persisté côté serveur. */
  const previewTheme = useCallback((id: ThemeId | null) => {
    const resolved = id ?? resolve(companyDefault, userPref, allowUserOverride);
    ensureThemeFonts(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, [companyDefault, userPref, allowUserOverride]);

  const setCompanyDefault = useCallback(async (id: ThemeId) => {
    setIsPending(true);
    try {
      await api.patch('/admin/appearance', { defaultTheme: id });
      setCompanyDefaultState(id);
      writeCache(id, userPref, allowUserOverride);
      const resolved = resolve(id, userPref, allowUserOverride);
      setCurrent(resolved);
      applyTheme(resolved);
    } finally {
      setIsPending(false);
    }
  }, [userPref, allowUserOverride]);

  const setUserPref = useCallback(async (id: ThemeId | null) => {
    setIsPending(true);
    try {
      await api.patch('/auth/me/theme', { theme: id ?? 'reset' });
      setUserPrefState(id);
      writeCache(companyDefault, id, allowUserOverride);
      const resolved = resolve(companyDefault, id, allowUserOverride);
      setCurrent(resolved);
      applyTheme(resolved);
    } finally {
      setIsPending(false);
    }
  }, [companyDefault, allowUserOverride]);

  const setAllowUserOverride = useCallback(async (allow: boolean) => {
    setIsPending(true);
    try {
      await api.patch('/admin/appearance', { allowThemeOverride: allow });
      setAllowUserOverrideState(allow);
      writeCache(companyDefault, userPref, allow);
      const resolved = resolve(companyDefault, userPref, allow);
      setCurrent(resolved);
      applyTheme(resolved);
    } finally {
      setIsPending(false);
    }
  }, [companyDefault, userPref]);

  const value = useMemo<ThemeContextValue>(() => ({
    current,
    companyDefault,
    userPref,
    allowUserOverride,
    isPending,
    setCompanyDefault,
    setUserPref,
    setAllowUserOverride,
    previewTheme,
    themes: THEMES,
    previewFor: (id: ThemeId) => THEMES.find((t) => t.id === id),
  }), [current, companyDefault, userPref, allowUserOverride, isPending, setCompanyDefault, setUserPref, setAllowUserOverride, previewTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé à l’intérieur d’un <ThemeProvider />');
  return ctx;
}
