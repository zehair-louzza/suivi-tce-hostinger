// ----------------------------------------------------------------------------
// Sélection résiliente des utilisateurs (compatibilité des colonnes d'apparence)
// ----------------------------------------------------------------------------
// Les colonnes d'apparence (users.themePref, companies.defaultTheme,
// companies.allowThemeOverride) ont été introduites par la migration
// `20261107193000_theme_persistence`.
//
// Sur une base où cette migration n'a PAS encore été appliquée (par exemple une
// instance Supabase déployée avant d'avoir exécuté `prisma migrate deploy`), ces
// colonnes n'existent pas. Les sélectionner y provoque une erreur Prisma P2022
// (« column does not exist ») qui remontait auparavant en 500
// « Erreur interne du serveur » sur /api/auth/login — rendant toute connexion
// impossible.
//
// Ce module rend l'authentification robuste quel que soit l'état de la base :
//   - on ne demande les colonnes d'apparence QUE tant qu'on les croit présentes ;
//   - la première fois que la base signale qu'elles manquent, on bascule un
//     indicateur en cache et on réessaie la lecture sans ces colonnes.
// Les valeurs d'apparence retombent alors sur leurs valeurs par défaut (gérées
// par formatPublicUser), ce qui permet à la connexion de toujours réussir.

import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

let themeColumnsAvailable = true;
let phoneColumnAvailable = true;

export function areThemeColumnsAvailable(): boolean {
  return themeColumnsAvailable;
}

/** Erreurs Prisma signalant une colonne/table/relation manquante dans la base. */
export function isMissingSchemaError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === 'P2022' || e.code === 'P2021' || e.code === 'P2010')
  );
}

export interface AuthUserRow {
  id: number;
  email: string;
  phone?: string | null;
  name: string;
  role: string;
  technicienNom: string | null;
  permissionsJson: string | null;
  active: boolean;
  emailConfirmed: boolean;
  companyId: number | null;
  createdAt: Date;
  password?: string;
  themePref?: string | null;
  company?: {
    id: number;
    name: string;
    siret: string | null;
    siren: string | null;
    defaultTheme?: string | null;
    allowThemeOverride?: boolean | null;
    siegeAdresse?: string | null;
    siegeLat?: number | null;
    siegeLng?: number | null;
  } | null;
}

// Sélection de base SANS colonnes d'apparence — toujours sûre (lecture/écriture).
export const basePublicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  technicienNom: true,
  permissionsJson: true,
  active: true,
  emailConfirmed: true,
  companyId: true,
  company: {
    select: {
      id: true,
      name: true,
      siret: true,
      siren: true,
      siegeAdresse: true,
      siegeLat: true,
      siegeLng: true,
    },
  },
  createdAt: true,
} satisfies Prisma.UserSelect;

type SelectOpts = { withPassword?: boolean };

function buildSelect(opts: SelectOpts = {}): Prisma.UserSelect {
  const companySelect: Record<string, boolean> = {
    id: true,
    name: true,
    siret: true,
    siren: true,
    siegeAdresse: true,
    siegeLat: true,
    siegeLng: true,
  };
  if (themeColumnsAvailable) {
    companySelect.defaultTheme = true;
    companySelect.allowThemeOverride = true;
    companySelect.accueilMaFile = true;
  }
  const select: Record<string, unknown> = {
    id: true,
    email: true,
    name: true,
    role: true,
    technicienNom: true,
    permissionsJson: true,
    active: true,
    emailConfirmed: true,
    companyId: true,
    company: { select: companySelect },
    createdAt: true,
  };
  if (phoneColumnAvailable) select.phone = true;
  if (themeColumnsAvailable) select.themePref = true;
  if (opts.withPassword) select.password = true;
  return select as Prisma.UserSelect;
}

async function withThemeFallback<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if ((themeColumnsAvailable || phoneColumnAvailable) && isMissingSchemaError(e)) {
      themeColumnsAvailable = false;
      phoneColumnAvailable = false;
      console.warn(
        "[auth] Colonnes optionnelles (thème/téléphone) absentes de la base — repli activé. " +
          'Exécutez `prisma migrate deploy` pour synchroniser le schéma.'
      );
      return await run();
    }
    throw e;
  }
}

/** Lecture résiliente d'un utilisateur unique (clé unique). */
export async function findPublicUserUnique(
  where: Prisma.UserWhereUniqueInput,
  opts: SelectOpts = {}
): Promise<AuthUserRow | null> {
  const row = await withThemeFallback(() =>
    prisma.user.findUnique({ where, select: buildSelect(opts) })
  );
  return row as unknown as AuthUserRow | null;
}

/** Lecture résiliente du premier utilisateur correspondant à un filtre. */
export async function findPublicUserFirst(
  where: Prisma.UserWhereInput,
  opts: SelectOpts = {}
): Promise<AuthUserRow | null> {
  const row = await withThemeFallback(() =>
    prisma.user.findFirst({ where, select: buildSelect(opts) })
  );
  return row as unknown as AuthUserRow | null;
}

// ----------------------------------------------------------------------------
// Un même e-mail peut avoir UN compte par entreprise
// ----------------------------------------------------------------------------
// Un compte est identifié par le couple (e-mail, entreprise). Il n'existe donc plus de recherche
// « par e-mail seul » qui renvoie un compte unique : on récupère la liste des comptes portant cet e-mail
// et l'appelant choisit (mot de passe, entreprise choisie, jeton…).

/** Normalise une adresse e-mail saisie (espaces, casse). */
export function normaliserEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

/** Filtre « e-mail égal, sans tenir compte de la casse ». */
export function emailEgal(email: string): { equals: string; mode: 'insensitive' } {
  return { equals: normaliserEmail(email), mode: 'insensitive' };
}

/** Tous les comptes portant cet e-mail (un par entreprise au maximum), du plus ancien au plus récent. */
export async function findPublicUsersByEmail(
  email: string,
  opts: SelectOpts & { companyId?: number | null } = {}
): Promise<AuthUserRow[]> {
  const where: Record<string, unknown> = { email: emailEgal(email) };
  if (opts.companyId != null) where.companyId = opts.companyId;
  const rows = await withThemeFallback(() =>
    prisma.user.findMany({ where, select: buildSelect(opts), orderBy: { id: 'asc' } })
  );
  return rows as unknown as AuthUserRow[];
}

/** Le compte (e-mail, entreprise) s'il existe : sert aux contrôles de doublon, qui se font PAR entreprise. */
export async function findUserInCompany(email: string, companyId: number): Promise<{ id: number } | null> {
  return (await prisma.user.findFirst({
    where: { email: emailEgal(email), companyId },
    select: { id: true },
  })) as { id: number } | null;
}

/** Entreprise telle que présentée à l'utilisateur pour choisir son compte : nom + SIREN / SIRET. */
export function descriptionEntreprise(u: Pick<AuthUserRow, 'companyId' | 'company'>) {
  return {
    companyId: u.companyId,
    nom: u.company?.name ?? 'Sans entreprise',
    siren: u.company?.siren ?? null,
    siret: u.company?.siret ?? null,
  };
}
