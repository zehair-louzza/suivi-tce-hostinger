import { AppError } from '../middleware/errorHandler.js';

export const MAX_DOCS_PER_RECORD = 20;
export const MAX_COMPANY_DOCUMENT_BYTES = 250 * 1024 * 1024;

async function sumModelBytes(model: any, companyId: number): Promise<number> {
  if (typeof model?.aggregate === 'function') {
    const res = await model.aggregate({ where: { companyId }, _sum: { taille: true } });
    return Number(res?._sum?.taille || 0);
  }
  if (typeof model?.findMany === 'function') {
    const rows: Array<{ taille?: number | null }> = await model.findMany({
      where: { companyId },
      select: { taille: true },
    });
    return rows.reduce((sum, r) => sum + Number(r?.taille || 0), 0);
  }
  return 0;
}

/** Vérifie le quota par fiche (max 20 PDF) et le quota global BYTEA par entreprise (250 Mo). */
export async function assertDocumentStorageQuota(
  tx: any,
  companyId: number,
  scope: { devisId?: number; interventionId?: number },
  incomingBytes: number
): Promise<void> {
  if (scope.devisId !== undefined && typeof tx.devisDocument?.count === 'function') {
    const count = await tx.devisDocument.count({ where: { companyId, devisId: scope.devisId } });
    if (count >= MAX_DOCS_PER_RECORD) {
      throw new AppError(413, `Nombre maximal de documents atteint pour ce devis (${MAX_DOCS_PER_RECORD}).`, 'DOCUMENT_QUOTA_EXCEEDED');
    }
  }
  if (scope.interventionId !== undefined && typeof tx.rapportDocument?.count === 'function') {
    const count = await tx.rapportDocument.count({ where: { companyId, interventionId: scope.interventionId } });
    if (count >= MAX_DOCS_PER_RECORD) {
      throw new AppError(413, `Nombre maximal de documents atteint pour cette intervention (${MAX_DOCS_PER_RECORD}).`, 'DOCUMENT_QUOTA_EXCEEDED');
    }
  }

  const [devisBytes, rapportBytes] = await Promise.all([
    sumModelBytes(tx.devisDocument, companyId),
    sumModelBytes(tx.rapportDocument, companyId),
  ]);
  if (devisBytes + rapportBytes + incomingBytes > MAX_COMPANY_DOCUMENT_BYTES) {
    throw new AppError(
      413,
      'Quota de stockage documentaire de l’entreprise dépassé (250 Mo). Archivez ou supprimez d’anciens PDF.',
      'COMPANY_STORAGE_QUOTA_EXCEEDED'
    );
  }
}
