import { optimiserPhotoPourPdf } from '../services/pdfCompression.js';

/**
 * Photos prises sur le terrain (interventions et visites devis) :
 * stockage JSON borné et compressé pour préserver la netteté sans saturer la base.
 */
export const MAX_TERRAIN_PHOTOS = 10;

export function parsePhotosJson(json?: string | null): any[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function sanitizePhotosJson(rawPhotos: any): string | null {
  if (!Array.isArray(rawPhotos) || rawPhotos.length === 0) return null;
  const capped = rawPhotos.slice(0, MAX_TERRAIN_PHOTOS);
  const sanitized = capped
    .map((p, idx) => ({
      id: p?.id ? String(p.id).slice(0, 50) : `ph-${Date.now()}-${idx}`,
      url: typeof p?.url === 'string' ? p.url : '',
      category: typeof p?.category === 'string' ? p.category.slice(0, 60) : 'Terrain',
      caption: typeof p?.caption === 'string' ? p.caption.slice(0, 200) : '',
      takenAt: typeof p?.takenAt === 'string' ? p.takenAt : new Date().toISOString(),
      auteur: typeof p?.auteur === 'string' ? p.auteur.slice(0, 60) : '',
    }))
    .filter((p) => Boolean(p.url));
  return sanitized.length > 0 ? JSON.stringify(sanitized) : null;
}

const DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i;

/**
 * Sanitise ET compresse côté serveur (MozJPEG Lanczos3) les photos envoyées par les techniciens ou le bureau
 * lorsque les données dépassent le budget cible, sans re-compresser les JPEG déjà optimisés (<= 50 Ko).
 */
export async function sanitizeAndOptimizePhotosJson(rawPhotos: any): Promise<string | null> {
  const baseJson = sanitizePhotosJson(rawPhotos);
  if (!baseJson) return null;
  const items = JSON.parse(baseJson) as Array<{
    id: string;
    url: string;
    category: string;
    caption: string;
    takenAt: string;
    auteur: string;
  }>;

  const optimized = await Promise.all(
    items.map(async (item) => {
      const m = DATA_IMAGE_RE.exec(item.url);
      if (!m) return item;
      const rawBuf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
      const res = await optimiserPhotoPourPdf(rawBuf, m[1], { skipJpegUnderBytes: 50 * 1024 });
      if (res.octets === rawBuf) return item;
      return {
        ...item,
        url: `data:image/${res.type};base64,${res.octets.toString('base64')}`,
      };
    })
  );

  return JSON.stringify(optimized);
}
