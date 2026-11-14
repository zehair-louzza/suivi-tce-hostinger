// Récupère l'identité de l'entreprise utilisatrice et les coordonnées client pour les PDF.
import { prisma } from '../lib/prisma.js';
import { trouverFiche } from '../domain/devisClient.js';
import type { ClientPdfInfo, SocietePdfInfo } from './pdfLayout.js';

const db = prisma as any;

export async function chargerIdentiteDocument(
  companyId: number,
  nomClient: string | null | undefined
): Promise<{ societe: SocietePdfInfo; client: ClientPdfInfo | null }> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { name: true, siret: true, siren: true, siegeAdresse: true },
  });

  let mailEmail: string | null = null;
  try {
    const mail = await db.companyMailSettings?.findUnique?.({
      where: { companyId },
      select: { replyTo: true, fromEmail: true },
    });
    mailEmail = mail?.replyTo || mail?.fromEmail || null;
  } catch {
    mailEmail = null;
  }

  let client: ClientPdfInfo | null = null;
  if (nomClient) {
    try {
      const ref = await db.referentiel.findFirst({ where: { companyId, categorie: 'clients_fiches' } });
      const fiches = ref?.valeurs ? JSON.parse(ref.valeurs) : [];
      const fiche: any = Array.isArray(fiches) ? trouverFiche(fiches, nomClient) : null;
      if (fiche) {
        const adresseLigne = [fiche.adresse, [fiche.codePostal, fiche.ville].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ');
        client = {
          nom: fiche.nom || nomClient,
          contact: fiche.contactNom || null,
          email: fiche.email || null,
          telephone: fiche.telephone || null,
          adresse: adresseLigne || null,
          siret: fiche.siret || null,
        };
      }
    } catch {
      client = null;
    }
  }

  return {
    societe: {
      nom: company?.name || 'Votre prestataire',
      siret: company?.siret || null,
      siren: company?.siren || null,
      adresse: company?.siegeAdresse || null,
      email: mailEmail,
    },
    client,
  };
}
