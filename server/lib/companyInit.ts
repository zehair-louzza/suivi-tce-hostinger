import { prisma } from './prisma.js';
import {
  DEFAULT_CORPS_ETAT,
  DEFAULT_MOTIFS_BLOCAGE,
  DEFAULT_ORIGINES,
  DEFAULT_RESULTATS_TECHNIQUES,
} from '../../shared/types.js';

/**
 * Initialise les référentiels métier de base pour une nouvelle entreprise.
 * Aucune donnée ANELEC (clients, techniciens, compétences) n'est copiée.
 */
export async function initCompanyReferentiels(companyId: number, adminName: string): Promise<void> {
  const cleanAdmin = String(adminName || '').trim();
  await prisma.referentiel.createMany({
    data: [
      { categorie: 'corpsEtat', valeurs: JSON.stringify([...DEFAULT_CORPS_ETAT]), companyId },
      { categorie: 'origines', valeurs: JSON.stringify([...DEFAULT_ORIGINES]), companyId },
      { categorie: 'motifs_blocage', valeurs: JSON.stringify([...DEFAULT_MOTIFS_BLOCAGE]), companyId },
      { categorie: 'resultats_techniques', valeurs: JSON.stringify([...DEFAULT_RESULTATS_TECHNIQUES]), companyId },
      { categorie: 'responsables', valeurs: JSON.stringify(cleanAdmin ? [cleanAdmin] : []), companyId },
      { categorie: 'techniciens', valeurs: JSON.stringify([]), companyId },
      { categorie: 'clients', valeurs: JSON.stringify([]), companyId },
      { categorie: 'clients_fiches', valeurs: JSON.stringify([]), companyId },
      { categorie: 'technicien_competences', valeurs: JSON.stringify({}), companyId },
    ],
    skipDuplicates: true,
  });
}
