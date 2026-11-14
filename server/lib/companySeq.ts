import { prisma } from './prisma.js';

/**
 * Génère la prochaine référence métier (DEV-AAAA-###, INT-AAAA-###, VIS-AAAA-###)
 * propre à l'entreprise, en repartant de 001 pour chaque nouvelle société.
 */
export async function nextCompanyRef(
  companyId: number,
  prefix: 'DEV' | 'INT' | 'VIS',
  year: number = new Date().getFullYear()
): Promise<string> {
  const pattern = `${prefix}-${year}-`;
  const rows =
    prefix === 'DEV'
      ? await prisma.devis.findMany({
          where: { companyId, referenceMetier: { startsWith: pattern } },
          select: { referenceMetier: true },
        })
      : await prisma.intervention.findMany({
          where: { companyId, referenceMetier: { startsWith: pattern } },
          select: { referenceMetier: true },
        });

  let maxNum = 0;
  for (const r of rows) {
    const ref = String(r.referenceMetier || '');
    const m = ref.slice(pattern.length).match(/^(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${pattern}${String(maxNum + 1).padStart(3, '0')}`;
}
