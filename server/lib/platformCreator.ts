import { prisma } from './prisma.js';
import {
  PLATFORM_CREATOR,
  isPlatformCreatorIdentity,
  normaliserTelephoneFr,
} from '../../shared/types.js';

/**
 * Calcule le numéro de téléphone à persister lors de la création / mise à jour d'un compte.
 * Force le numéro canonique du créateur (+33628618628) dès que l'identité créateur est reconnue.
 */
export function resolveCreatorAwarePhone(email?: string | null, phone?: string | null): string | null {
  const normalized = normaliserTelephoneFr(phone);
  if (isPlatformCreatorIdentity({ email, phone: normalized })) {
    return PLATFORM_CREATOR.phone;
  }
  return normalized || null;
}

/**
 * Garantit la présence en base de la fiche canonique dans `platform_creator`.
 * Tolère l'absence du modèle (tests fakePrisma ou base non encore migrée).
 */
export async function syncPlatformCreatorInDb(): Promise<void> {
  const model = (prisma as unknown as {
    platformCreator?: {
      upsert: (args: {
        where: { id: number };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  }).platformCreator;
  if (!model || typeof model.upsert !== 'function') return;
  try {
    await model.upsert({
      where: { id: 1 },
      update: {
        email: PLATFORM_CREATOR.email,
        phone: PLATFORM_CREATOR.phone,
        name: PLATFORM_CREATOR.name,
        companyName: PLATFORM_CREATOR.companyName,
        role: PLATFORM_CREATOR.role,
        locked: true,
      },
      create: {
        id: 1,
        email: PLATFORM_CREATOR.email,
        phone: PLATFORM_CREATOR.phone,
        name: PLATFORM_CREATOR.name,
        companyName: PLATFORM_CREATOR.companyName,
        role: PLATFORM_CREATOR.role,
        locked: true,
      },
    });
  } catch {
    // Tolère l'absence de table en environnement de test ou avant exécution de la migration SQL
  }
}
