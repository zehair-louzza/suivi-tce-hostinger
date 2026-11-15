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
import type { SidebarModelId as SharedSidebarModelId, UserThemeSettings } from '../../../shared/types';

export type ThemeId = 'light' | 'dark' | 'atlas' | 'craft' | 'signal' | 'swiss' | 'bento';
export type SidebarModelId = SharedSidebarModelId;

export interface SidebarModelDescriptor {
  id: SidebarModelId;
  number: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  badgeTag: string;
  tagline: string;
  highlights: string[];
}

export const SIDEBAR_MODELS: SidebarModelDescriptor[] = [
  {
    id: 'classic',
    number: 1,
    name: 'Classique Épuré',
    badgeTag: 'Pilule Douce · Bouton Bordure',
    tagline: 'Évolution directe du menu avec bouton repli flottant sur la bordure, logo T centré et profil ZL préservé.',
    highlights: ['Transition familière', 'Zéro double bordure', 'Avatar ZL visible en réduit'],
  },
  {
    id: 'line',
    number: 2,
    name: 'Filet Architectural Net',
    badgeTag: 'Barre Accent 3px · Sync LIVE',
    tagline: 'Filet vertical net de 3 px collé à gauche et indicateur compact Sync Planning · LIVE.',
    highlights: ['Filet actif net 3px', 'Badge LIVE compact', 'Contraste élevé sur 7 thèmes'],
  },
  {
    id: 'rail',
    number: 3,
    name: 'Double Rail BTP',
    badgeTag: 'Rail Fixe 56px + Volet',
    tagline: 'Rail permanent à gauche pour les 4 pôles métier + avatar ZL, couplé au volet détaillé repliable.',
    highlights: ['Rail permanent ultra-propre', 'Pôles métier immédiats', 'Idéal écran large'],
  },
  {
    id: 'cards',
    number: 4,
    name: 'Cartes Groupées & Terrain',
    badgeTag: 'Pilule Pleine · Accès Mobile',
    tagline: 'Sections regroupées en cartes distinctes, pilule active pleine et bouton isolé pour l’App Mobile Technicien.',
    highlights: ['Pilule active impossible à rater', 'Accès Terrain mis en avant', 'Confort tactile'],
  },
  {
    id: 'accordion',
    number: 5,
    name: 'Accordéon Repliable + Filtre',
    badgeTag: 'Recherche Intégrée · Petit Écran',
    tagline: 'Champ « Filtrer un module... » et sections repliables au clic : zéro défilement même sur petit portable.',
    highlights: ['Filtrage instantané', 'Groupes repliables', 'Compact sans scrollbar'],
  },
  {
    id: 'floating',
    number: 6,
    name: 'Panneau Flottant Hybride',
    badgeTag: 'Flottant + Action Rapide',
    tagline: 'Panneau détaché du bord adapté aux angles du thème, raccourci « + Nouvelle demande / Devis » et carte profil.',
    highlights: ['Panneau flottant moderne', 'Raccourci création rapide', 'Carte profil avec statut'],
  },
];

export const DEFAULT_SIDEBAR_MODEL: SidebarModelId = 'classic';
const ALL_SIDEBAR_IDS = SIDEBAR_MODELS.map((m) => m.id);
const isValidSidebar = (v: unknown): v is SidebarModelId => typeof v === 'string' && (ALL_SIDEBAR_IDS as string[]).includes(v);

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
const K_SIDEBAR_COMPANY = 'anelec_sidebar_company_default';
const K_SIDEBAR_USER = 'anelec_sidebar_user_pref';

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
function readSidebarCompanyDefault(): SidebarModelId {
  const v = localStorage.getItem(K_SIDEBAR_COMPANY);
  return isValidSidebar(v) ? v : DEFAULT_SIDEBAR_MODEL;
}
function readSidebarUserPref(): SidebarModelId | null {
  const v = localStorage.getItem(K_SIDEBAR_USER);
  return isValidSidebar(v) ? v : null;
}
function writeCache(
  companyDefault: ThemeId,
  userPref: ThemeId | null,
  allowOverride: boolean,
  sidebarCompanyDefault: SidebarModelId,
  sidebarUserPref: SidebarModelId | null,
) {
  localStorage.setItem(K_COMPANY, companyDefault);
  localStorage.setItem(K_ALLOW, String(allowOverride));
  if (userPref) localStorage.setItem(K_USER, userPref);
  else localStorage.removeItem(K_USER);
  localStorage.setItem(K_SIDEBAR_COMPANY, sidebarCompanyDefault);
  if (sidebarUserPref) localStorage.setItem(K_SIDEBAR_USER, sidebarUserPref);
  else localStorage.removeItem(K_SIDEBAR_USER);
}

function applyTheme(id: ThemeId): void {
  ensureThemeFonts(id);
  const html = document.documentElement;
  html.setAttribute('data-theme-switching', '1');
  html.setAttribute('data-theme', id);
  html.setAttribute('data-dir', id);
  if (typeof document !== 'undefined' && document.body) { document.body.classList.add('m-body'); }
  window.setTimeout(() => html.removeAttribute('data-theme-switching'), 260);
}

function applySidebarModel(id: SidebarModelId): void {
  document.documentElement.setAttribute('data-sidebar-model', id);
}

function resolve(companyDefault: ThemeId, userPref: ThemeId | null, allow: boolean): ThemeId {
  return allow && userPref ? userPref : companyDefault;
}

function resolveSidebar(companyDefault: SidebarModelId, userPref: SidebarModelId | null): SidebarModelId {
  return userPref || companyDefault;
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
  sidebarModel: SidebarModelId;
  sidebarCompanyDefault: SidebarModelId;
  sidebarUserPref: SidebarModelId | null;
  sidebarModels: SidebarModelDescriptor[];
  setSidebarCompanyDefault: (id: SidebarModelId) => Promise<void>;
  setSidebarUserPref: (id: SidebarModelId | null) => Promise<void>;
  previewSidebarModel: (id: SidebarModelId | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ThemeId>(DEFAULT_THEME);
  const [companyDefault, setCompanyDefaultState] = useState<ThemeId>(DEFAULT_THEME);
  const [userPref, setUserPrefState] = useState<ThemeId | null>(null);
  const [allowUserOverride, setAllowUserOverrideState] = useState<boolean>(true);
  const [sidebarModel, setSidebarModel] = useState<SidebarModelId>(DEFAULT_SIDEBAR_MODEL);
  const [sidebarCompanyDefault, setSidebarCompanyDefaultState] = useState<SidebarModelId>(DEFAULT_SIDEBAR_MODEL);
  const [sidebarUserPref, setSidebarUserPrefState] = useState<SidebarModelId | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);

  const syncFromServerTheme = useCallback((ut: UserThemeSettings) => {
    const cd = (isValid(ut.companyDefault) ? ut.companyDefault : DEFAULT_THEME) as ThemeId;
    const up = (isValid(ut.userPref) ? ut.userPref : null) as ThemeId | null;
    const allow = ut.allowOverride !== false;
    const scd = (isValidSidebar(ut.sidebarCompanyDefault) ? ut.sidebarCompanyDefault : DEFAULT_SIDEBAR_MODEL) as SidebarModelId;
    const sup = (
      ut.sidebarUserPref === undefined
        ? readSidebarUserPref()
        : (isValidSidebar(ut.sidebarUserPref) ? ut.sidebarUserPref : null)
    ) as SidebarModelId | null;
    setCompanyDefaultState(cd);
    setUserPrefState(up);
    setAllowUserOverrideState(allow);
    setSidebarCompanyDefaultState(scd);
    setSidebarUserPrefState(sup);
    writeCache(cd, up, allow, scd, sup);
    const resolved = resolve(cd, up, allow);
    const resolvedSb = resolveSidebar(scd, sup);
    setCurrent(resolved);
    setSidebarModel(resolvedSb);
    applyTheme(resolved);
    applySidebarModel(resolvedSb);
  }, []);

  // 1) Au boot : lire le cache local pour un rendu instantané.
  useEffect(() => {
    const cd = readCompanyDefault();
    const up = readUserPref();
    const allow = readAllowOverride();
    const scd = readSidebarCompanyDefault();
    const sup = readSidebarUserPref();
    setCompanyDefaultState(cd);
    setUserPrefState(up);
    setAllowUserOverrideState(allow);
    setSidebarCompanyDefaultState(scd);
    setSidebarUserPrefState(sup);
    const resolved = resolve(cd, up, allow);
    const resolvedSb = resolveSidebar(scd, sup);
    setCurrent(resolved);
    setSidebarModel(resolvedSb);
    applyTheme(resolved);
    applySidebarModel(resolvedSb);
  }, []);

  // 2) Dès que /me a répondu, prendre le serveur comme source de vérité.
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      if (state.user?.theme) syncFromServerTheme(state.user.theme);
    });
    const u = useAuthStore.getState().user;
    if (u?.theme) syncFromServerTheme(u.theme);
    return () => unsub();
  }, [syncFromServerTheme]);

  // Multi-onglets
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (![K_COMPANY, K_USER, K_ALLOW, K_SIDEBAR_COMPANY, K_SIDEBAR_USER].includes(e.key || '')) return;
      const cd = readCompanyDefault();
      const up = readUserPref();
      const allow = readAllowOverride();
      const scd = readSidebarCompanyDefault();
      const sup = readSidebarUserPref();
      setCompanyDefaultState(cd);
      setUserPrefState(up);
      setAllowUserOverrideState(allow);
      setSidebarCompanyDefaultState(scd);
      setSidebarUserPrefState(sup);
      const resolved = resolve(cd, up, allow);
      const resolvedSb = resolveSidebar(scd, sup);
      setCurrent(resolved);
      setSidebarModel(resolvedSb);
      applyTheme(resolved);
      applySidebarModel(resolvedSb);
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

  const previewSidebarModel = useCallback((id: SidebarModelId | null) => {
    const resolvedSb = id ?? resolveSidebar(sidebarCompanyDefault, sidebarUserPref);
    applySidebarModel(resolvedSb);
  }, [sidebarCompanyDefault, sidebarUserPref]);

  const setCompanyDefault = useCallback(async (id: ThemeId) => {
    setIsPending(true);
    try {
      await api.patch('/admin/appearance', { defaultTheme: id });
      setCompanyDefaultState(id);
      writeCache(id, userPref, allowUserOverride, sidebarCompanyDefault, sidebarUserPref);
      const resolved = resolve(id, userPref, allowUserOverride);
      setCurrent(resolved);
      applyTheme(resolved);
    } finally {
      setIsPending(false);
    }
  }, [userPref, allowUserOverride, sidebarCompanyDefault, sidebarUserPref]);

  const setSidebarCompanyDefault = useCallback(async (id: SidebarModelId) => {
    setIsPending(true);
    try {
      await api.patch('/admin/appearance', { defaultSidebarModel: id });
      setSidebarCompanyDefaultState(id);
      writeCache(companyDefault, userPref, allowUserOverride, id, sidebarUserPref);
      const resolvedSb = resolveSidebar(id, sidebarUserPref);
      setSidebarModel(resolvedSb);
      applySidebarModel(resolvedSb);
    } finally {
      setIsPending(false);
    }
  }, [companyDefault, userPref, allowUserOverride, sidebarUserPref]);

  const setUserPref = useCallback(async (id: ThemeId | null) => {
    setIsPending(true);
    try {
      const res = await api.patch('/auth/me/theme', { theme: id ?? 'reset' });
      if (res.data?.user) useAuthStore.setState({ user: res.data.user });
      setUserPrefState(id);
      writeCache(companyDefault, id, allowUserOverride, sidebarCompanyDefault, sidebarUserPref);
      const resolved = resolve(companyDefault, id, allowUserOverride);
      setCurrent(resolved);
      applyTheme(resolved);
    } finally {
      setIsPending(false);
    }
  }, [companyDefault, allowUserOverride, sidebarCompanyDefault, sidebarUserPref]);

  const setSidebarUserPref = useCallback(async (id: SidebarModelId | null) => {
    setIsPending(true);
    setSidebarUserPrefState(id);
    writeCache(companyDefault, userPref, allowUserOverride, sidebarCompanyDefault, id);
    const resolvedSb = resolveSidebar(sidebarCompanyDefault, id);
    setSidebarModel(resolvedSb);
    applySidebarModel(resolvedSb);
    try {
      const res = await api.patch('/auth/me/theme', { sidebarModel: id ?? 'reset' });
      if (res.data?.user) useAuthStore.setState({ user: res.data.user });
    } finally {
      setIsPending(false);
    }
  }, [companyDefault, userPref, allowUserOverride, sidebarCompanyDefault]);

  const setAllowUserOverride = useCallback(async (allow: boolean) => {
    setIsPending(true);
    try {
      await api.patch('/admin/appearance', { allowThemeOverride: allow });
      setAllowUserOverrideState(allow);
      writeCache(companyDefault, userPref, allow, sidebarCompanyDefault, sidebarUserPref);
      const resolved = resolve(companyDefault, userPref, allow);
      setCurrent(resolved);
      applyTheme(resolved);
    } finally {
      setIsPending(false);
    }
  }, [companyDefault, userPref, sidebarCompanyDefault, sidebarUserPref]);

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
    sidebarModel,
    sidebarCompanyDefault,
    sidebarUserPref,
    sidebarModels: SIDEBAR_MODELS,
    setSidebarCompanyDefault,
    setSidebarUserPref,
    previewSidebarModel,
  }), [
    current,
    companyDefault,
    userPref,
    allowUserOverride,
    isPending,
    setCompanyDefault,
    setUserPref,
    setAllowUserOverride,
    previewTheme,
    sidebarModel,
    sidebarCompanyDefault,
    sidebarUserPref,
    setSidebarCompanyDefault,
    setSidebarUserPref,
    previewSidebarModel,
  ]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé à l’intérieur d’un <ThemeProvider />');
  return ctx;
}
