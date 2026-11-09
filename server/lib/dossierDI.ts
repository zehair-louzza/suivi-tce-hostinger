import { prisma } from './prisma.js';

/**
 * Numéro de DI (demande d'intervention) : numéro de suivi d'un dossier.
 *
 * Le DI est émis par le donneur d'ordre, pas par l'entreprise qui utilise l'application :
 * chaque donneur d'ordre numérote chez lui, donc deux clients différents peuvent très bien
 * porter le même numéro. La clé d'un dossier est donc le couple (donneur d'ordre + DI),
 * jamais le DI seul. Les demandes de particuliers (B2C) n'ont pas de DI : elles sont suivies
 * par une référence interne.
 */
export function normalizeDI(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const v = String(raw).replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 40);
  return v === '' ? null : v;
}

/** Nom de client comparable : casse et espaces ne doivent pas séparer deux fois le même client. */
export function normalizeClient(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  return String(raw).replace(/\s+/g, ' ').trim().toUpperCase();
}

export function sameClient(a: unknown, b: unknown): boolean {
  const x = normalizeClient(a);
  const y = normalizeClient(b);
  return x !== '' && x === y;
}

/**
 * Devis du dossier (donneur d'ordre + DI).
 *
 * Avec un nom de client, seul un devis du même client est retenu : un devis d'un autre
 * donneur d'ordre portant le même numéro n'est jamais rattaché. Sans nom de client, le
 * rattachement n'a lieu que si un seul devis de l'entreprise porte ce DI ; en cas
 * d'ambiguïté on ne devine pas.
 */
export async function findDevisByDI(di: string | null, companyId: number, client?: unknown) {
  if (!di) return null;
  const candidates = await prisma.devis.findMany({
    where: { companyId, numeroDI: di },
    orderBy: { id: 'desc' },
  });
  if (candidates.length === 0) return null;
  if (normalizeClient(client) !== '') {
    return candidates.find((d: { client: string | null }) => sameClient(d.client, client)) ?? null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Cohérence côté intervention : à partir du DI saisi et/ou du devis choisi, renvoie le DI et le devis à retenir.
 *  - devis explicite sans DI saisi  -> l'intervention reprend le DI du devis
 *  - DI saisi sans devis explicite  -> rattachement au devis du même client portant ce DI
 */
export async function resolveInterventionDossier(
  companyId: number,
  input: { numeroDI: string | null; devisId: number | null; client?: unknown }
) {
  let di = input.numeroDI;
  let devis = input.devisId
    ? await prisma.devis.findFirst({ where: { id: input.devisId, companyId } })
    : null;
  if (devis && !di && devis.numeroDI) di = devis.numeroDI;
  // Le client de l'intervention, à défaut celui du devis explicitement choisi
  const client = normalizeClient(input.client) !== '' ? input.client : devis?.client;
  if (!devis && di) devis = await findDevisByDI(di, companyId, client);
  return { numeroDI: di, devisId: devis ? devis.id : null, devis };
}

/** Si le devis lié n'a pas encore de DI, il hérite de celui de l'intervention. */
export async function pushDIToDevis(devis: { id: number; numeroDI?: string | null } | null, di: string | null) {
  if (!devis || !di || devis.numeroDI) return;
  await prisma.devis.update({ where: { id: devis.id }, data: { numeroDI: di } });
}

/**
 * Cohérence côté devis : les interventions du MÊME CLIENT portant le même DI sont rattachées au devis,
 * et celles déjà liées au devis reprennent son DI.
 *
 * Le filtre sur le client est ce qui empêche deux dossiers de donneurs d'ordre différents,
 * numérotés pareil, de fusionner.
 */
export async function syncDevisDossier(
  devis: { id: number; numeroDI?: string | null; referenceMetier?: string | null; client?: string | null },
  companyId: number
) {
  const di = devis.numeroDI || null;
  if (!di) return;
  const ref = devis.referenceMetier || `DEV-${new Date().getFullYear()}-${String(devis.id).padStart(3, '0')}`;

  // 1. Interventions orphelines portant ce DI : rattachées seulement si le client correspond
  const orphelines = await prisma.intervention.findMany({
    where: { companyId, numeroDI: di, devisId: null },
    select: { id: true, client: true },
  });
  const aRattacher = orphelines
    .filter((i: { client: string | null }) =>
      normalizeClient(devis.client) === '' ? true : sameClient(i.client, devis.client) || normalizeClient(i.client) === ''
    )
    .map((i: { id: number }) => i.id);
  if (aRattacher.length > 0) {
    await prisma.intervention.updateMany({
      where: { id: { in: aRattacher }, companyId },
      data: { devisId: devis.id, origineDevisId: devis.id, refDevisTexte: ref },
    });
  }

  // 2. Interventions déjà liées à ce devis : elles reprennent son DI
  const liees = await prisma.intervention.findMany({
    where: { companyId, devisId: devis.id },
    select: { id: true, numeroDI: true },
  });
  const aAligner = liees.filter((i: { numeroDI: string | null }) => i.numeroDI !== di).map((i: { id: number }) => i.id);
  if (aAligner.length > 0) {
    await prisma.intervention.updateMany({
      where: { id: { in: aAligner }, companyId },
      data: { numeroDI: di },
    });
  }
}
