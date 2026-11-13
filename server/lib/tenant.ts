// ----------------------------------------------------------------------------
// Isolation stricte entre entreprises
// ----------------------------------------------------------------------------
// Chaque entreprise est un espace étanche : un compte ne voit et ne modifie QUE les données de sa
// propre entreprise. Il n'existe aucune exception : ni super administrateur, ni utilisateur n° 1,
// ni entreprise « par défaut ».
//
// Règle : l'entreprise vient TOUJOURS du compte authentifié, jamais d'un paramètre de la requête,
// et jamais d'une valeur de repli. Un compte rattaché à aucune entreprise n'a accès à aucune donnée.

import { AppError } from '../middleware/errorHandler.js';

export function requireCompanyId(companyId: number | null | undefined): number {
  if (typeof companyId !== 'number' || !Number.isInteger(companyId) || companyId <= 0) {
    throw new AppError(403, "Votre compte n'est rattaché à aucune entreprise", 'NO_COMPANY');
  }
  return companyId;
}
