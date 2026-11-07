/**
 * ANELEC — Thème (apparence) sélectionnable
 * ─────────────────────────────────────────
 * • Deux couches de préférence :
 *   1. Un défaut *entreprise*, choisi par l'administrateur (clé entreprise).
 *   2. Une préférence *personnelle* par utilisateur (si l'option est autorisée).
 * • Persistance : localStorage. Pas de dépendance backend pour cette première
 *   itération — l'intégration côté API peut être ajoutée sans rupture.
 * • L'attribut `data-theme` est posé sur <html> : les tokens CSS (themes.css +
 *   design-tokens.css) prennent le relais automatiquement, sans toucher aux
 *   composants existants.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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
    name: 'ANELEC Original — Clair',
    tagline: "L'apparence actuelle en mode clair.",
    description:
      "Le design historique du Suivi TCE ANELEC avec sa sidebar bleu nuit et son vert d'action. Idéal pour continuer sans rupture visuelle.",
    swatches: ['#047857', '#142536', '#f6f8fa', '#ffffff', '#b91c1c'],
    fonts: { display: 'Inter', body: 'Inter' },
    mood: 'light',
    tags: ['Original', 'Léger', 'Équilibré'],
    isOriginal: true,
  },
  {
    id: 'dark',
    name: 'ANELEC Original — Sombre',
    tagline: "La version sombre de l'apparence actuelle.",
    description:
      "Même structure et même ergonomie que l'original, en mode sombre pour les longues sessions en soirée ou les postes en intérieur peu lumineux.",
    swatches: ['#10b981', '#0a1017', '#0b111a', '#111a26', '#ef4444'],
    fonts: { display: 'Inter', body: 'Inter' },
    mood: 'dark',
    tags: ['Original', 'Sombre', 'Confort visuel'],
    isOriginal: true,
  },
  {
    id: 'atlas',
    name: 'Atlas Clarity',
    tagline: 'Entreprise moderne, clarté maximale, bleu profond.',
    description:
      "Densité équilibrée, polices techniques (Space Grotesk + IBM Plex Mono), bleu profond et accent corail. L'image d'un progiciel pro sérieux type Linear ou Stripe.",
    swatches: ['#1D4ED8', '#0EA5A4', '#0F172A', '#F6F7FB', '#F59E0B'],
    fonts: { display: 'Space Grotesk', body: 'Space Grotesk' },
    mood: 'light',
    tags: ['Enterprise', 'Dense', 'Clair'],
  },
  {
    id: 'craft',
    name: 'Craft Warmth',
    tagline: 'Chaleureux, artisan, arrondi — plus humain.',
    description:
      "Teal profond + ocre, formes arrondies, polices chaudes (Merriweather Sans + Work Sans). Fait sortir ANELEC du cliché de l'outil administratif sec.",
    swatches: ['#0F766E', '#D97706', '#22201C', '#FAF7F2', '#B91C1C'],
    fonts: { display: 'Merriweather Sans', body: 'Work Sans' },
    mood: 'light',
    tags: ['Chaleureux', 'Arrondi', 'Humain'],
  },
  {
    id: 'signal',
    name: 'Signal Command',
    tagline: 'Cockpit sombre, cyan vif, pour les dispatchers.',
    description:
      "Thème sombre premium avec cyan et ambre d'alerte. Confort visuel maximal pour les longues sessions de pilotage.",
    swatches: ['#38BDF8', '#F59E0B', '#0B1220', '#13213A', '#34D399'],
    fonts: { display: 'IBM Plex Sans', body: 'IBM Plex Sans' },
    mood: 'dark',
    tags: ['Sombre', 'Dense', 'Cockpit'],
  },
  {
    id: 'swiss',
    name: 'Editorial Swiss',
    tagline: 'Grille typographique premium, bleu royal + corail.',
    description:
      "Angles vifs, typographies Manrope/Karla, grille suisse. Position haut de gamme, présentation comme un cahier technique bien tenu.",
    swatches: ['#0B3B8F', '#E07A5F', '#0B1220', '#FFFFFF', '#2A9D8F'],
    fonts: { display: 'Manrope', body: 'Karla' },
    mood: 'light',
    tags: ['Premium', 'Typographique', 'Éditorial'],
  },
  {
    id: 'bento',
    name: 'Bento Modular',
    tagline: 'Marque ANELEC : jaune, corail, vert — tuiles arrondies.',
    description:
      "Tuiles bento larges, encre noire, accents marque (jaune + corail + vert). Style Apple/Vercel, pour faire parler la marque.",
    swatches: ['#111827', '#F5B400', '#EF5B4C', '#16A34A', '#F2F3F5'],
    fonts: { display: 'Sora', body: 'Figtree' },
    mood: 'light',
    tags: ['Moderne', 'Marque', 'Modulaire'],
  },
];

export const DEFAULT_THEME: ThemeId = 'light';

// Clés localStorage
const K_COMPANY = 'anelec_theme_company_default';
const K_USER = 'anelec_theme_user_pref';
const K_ALLOW = 'anelec_theme_allow_user_override';

export function readCompanyDefault(): ThemeId {
  const v = localStorage.getItem(K_COMPANY) as ThemeId | null;
  return v && THEMES.some((t) => t.id === v) ? v : DEFAULT_THEME;
}
export function readUserPref(): ThemeId | null {
  const v = localStorage.getItem(K_USER) as ThemeId | null;
  return v && THEMES.some((t) => t.id === v) ? v : null;
}
export function readAllowOverride(): boolean {
  return localStorage.getItem(K_ALLOW) !== 'false';
}

export function resolveTheme(): ThemeId {
  const allow = readAllowOverride();
  if (allow) {
    const u = readUserPref();
    if (u) return u;
  }
  return readCompanyDefault();
}

function applyTheme(id: ThemeId): void {
  const html = document.documentElement;
  html.setAttribute('data-theme-switching', '1');
  html.setAttribute('data-theme', id);
  window.setTimeout(() => html.removeAttribute('data-theme-switching'), 260);
}

export interface ThemeContextValue {
  current: ThemeId;
  companyDefault: ThemeId;
  userPref: ThemeId | null;
  allowUserOverride: boolean;
  setCompanyDefault: (id: ThemeId) => void;
  setUserPref: (id: ThemeId | null) => void;
  setAllowUserOverride: (allow: boolean) => void;
  themes: ThemeDescriptor[];
  previewFor: (id: ThemeId) => ThemeDescriptor | undefined;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ThemeId>(DEFAULT_THEME);
  const [companyDefault, setCompanyDefaultState] = useState<ThemeId>(DEFAULT_THEME);
  const [userPref, setUserPrefState] = useState<ThemeId | null>(null);
  const [allowUserOverride, setAllowUserOverrideState] = useState<boolean>(true);

  // Initial read + application
  useEffect(() => {
    const cd = readCompanyDefault();
    const up = readUserPref();
    const allow = readAllowOverride();
    setCompanyDefaultState(cd);
    setUserPrefState(up);
    setAllowUserOverrideState(allow);
    const resolved = allow && up ? up : cd;
    setCurrent(resolved);
    applyTheme(resolved);
  }, []);

  // React to multi-tab changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (![K_COMPANY, K_USER, K_ALLOW].includes(e.key || '')) return;
      const cd = readCompanyDefault();
      const up = readUserPref();
      const allow = readAllowOverride();
      setCompanyDefaultState(cd);
      setUserPrefState(up);
      setAllowUserOverrideState(allow);
      const resolved = allow && up ? up : cd;
      setCurrent(resolved);
      applyTheme(resolved);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCompanyDefault = useCallback((id: ThemeId) => {
    localStorage.setItem(K_COMPANY, id);
    setCompanyDefaultState(id);
    const allow = readAllowOverride();
    const up = readUserPref();
    const resolved = allow && up ? up : id;
    setCurrent(resolved);
    applyTheme(resolved);
  }, []);

  const setUserPref = useCallback((id: ThemeId | null) => {
    if (id === null) localStorage.removeItem(K_USER);
    else localStorage.setItem(K_USER, id);
    setUserPrefState(id);
    const allow = readAllowOverride();
    const cd = readCompanyDefault();
    const resolved = allow && id ? id : cd;
    setCurrent(resolved);
    applyTheme(resolved);
  }, []);

  const setAllowUserOverride = useCallback((allow: boolean) => {
    localStorage.setItem(K_ALLOW, String(allow));
    setAllowUserOverrideState(allow);
    const cd = readCompanyDefault();
    const up = readUserPref();
    const resolved = allow && up ? up : cd;
    setCurrent(resolved);
    applyTheme(resolved);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    current,
    companyDefault,
    userPref,
    allowUserOverride,
    setCompanyDefault,
    setUserPref,
    setAllowUserOverride,
    themes: THEMES,
    previewFor: (id: ThemeId) => THEMES.find((t) => t.id === id),
  }), [current, companyDefault, userPref, allowUserOverride, setCompanyDefault, setUserPref, setAllowUserOverride]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé à l’intérieur d’un <ThemeProvider />');
  return ctx;
}
