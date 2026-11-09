import { prisma } from './prisma.js';

/**
 * Numéro de DI (demande d'intervention) : numéro de suivi d'un dossier.
 * Il relie un devis à ses interventions (travaux, visites…) au sein d'une même entreprise.
 */
export function normalizeDI(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const v = String(raw).replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 40);
  return v === '' ? null : v;
}

/** Devis le plus récent de l'entreprise portant ce DI. */
export async function findDevisByDI(di: string | null, companyId: number) {
  if (!di) return null;
  return prisma.devis.findFirst({
    where: { companyId, numeroDI: di },
    orderBy: { id: 'desc' },
  });
}

/**
 * Cohérence côté intervention : à partir du DI saisi et/ou du devis choisi, renvoie le DI et le devis à retenir.
 *  - devis explicite sans DI saisi  -> l'intervention reprend le DI du devis
 *  - DI saisi sans devis explicite  -> l'intervention est rattachée au devis qui porte ce DI
 */
export async function resolveInterventionDossier(
  companyId: number,
  input: { numeroDI: string | null; devisId: number | null }
) {
  let di = input.numeroDI;
  let devis = input.devisId
    ? await prisma.devis.findFirst({ where: { id: input.devisId, companyId } })
    : null;
  if (devis && !di && devis.numeroDI) di = devis.numeroDI;
  if (!devis && di) devis = await findDevisByDI(di, companyId);
  return { numeroDI: di, devisId: devis ? devis.id : null, devis };
}

/** Si le devis lié n'a pas encore de DI, il hérite de celui de l'intervention. */
export async function pushDIToDevis(devis: { id: number; numeroDI?: string | null } | null, di: string | null) {
  if (!devis || !di || devis.numeroDI) return;
  await prisma.devis.update({ where: { id: devis.id }, data: { numeroDI: di } });
}

/**
 * Cohérence côté devis : toutes les interventions de l'entreprise qui portent le même DI sont rattachées au devis,
 * et celles déjà liées au devis reprennent son DI.
 */
export async function syncDevisDossier(
  devis: { id: number; numeroDI?: string | null; referenceMetier?: string | null },
  companyId: number
) {
  const di = devis.numeroDI || null;
  if (!di) return;
  const ref = devis.referenceMetier || `DEV-2026-${String(devis.id).padStart(3, '0')}`;
  await prisma.intervention.updateMany({
    where: { companyId, numeroDI: di, devisId: null },
    data: { devisId: devis.id, origineDevisId: devis.id, refDevisTexte: ref },
  });
  await prisma.intervention.updateMany({
    where: { companyId, devisId: devis.id, OR: [{ numeroDI: null }, { numeroDI: { not: di } }] },
    data: { numeroDI: di },
  });
}
