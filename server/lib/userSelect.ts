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
  if (themeColumnsAvailable) select.themePref = true;
  if (opts.withPassword) select.password = true;
  return select as Prisma.UserSelect;
}

async function withThemeFallback<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (themeColumnsAvailable && isMissingSchemaError(e)) {
      themeColumnsAvailable = false;
      console.warn(
        "[auth] Colonnes d'apparence absentes de la base — repli sans thème. " +
          'Exécutez `prisma migrate deploy` pour activer la persistance du thème.'
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
