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

export const MAX_TERRAIN_PHOTO_BYTES = 6 * 1024 * 1024;
const DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i;

function sanitizePhotoDataUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  const m = DATA_IMAGE_RE.exec(trimmed);
  if (!m) return '';
  const approxBytes = Math.floor((m[2].replace(/\s/g, '').length * 3) / 4);
  if (approxBytes <= 0 || approxBytes > MAX_TERRAIN_PHOTO_BYTES) return '';
  return trimmed;
}

export function sanitizePhotosJson(rawPhotos: any): string | null {
  if (!Array.isArray(rawPhotos) || rawPhotos.length === 0) return null;
  const capped = rawPhotos.slice(0, MAX_TERRAIN_PHOTOS);
  const sanitized = capped
    .map((p, idx) => ({
      id: p?.id ? String(p.id).slice(0, 50) : `ph-${Date.now()}-${idx}`,
      url: sanitizePhotoDataUrl(p?.url),
      category: typeof p?.category === 'string' ? p.category.slice(0, 60) : 'Terrain',
      caption: typeof p?.caption === 'string' ? p.caption.slice(0, 200) : '',
      takenAt: typeof p?.takenAt === 'string' ? p.takenAt : new Date().toISOString(),
      auteur: typeof p?.auteur === 'string' ? p.auteur.slice(0, 60) : '',
    }))
    .filter((p) => Boolean(p.url));
  return sanitized.length > 0 ? JSON.stringify(sanitized) : null;
}

/**
 * Sanitise ET compresse côté serveur (MozJPEG Lanczos3, de façon séquentielle et bornée) les photos terrain.
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

  const optimized: typeof items = [];
  for (const item of items) {
    const m = DATA_IMAGE_RE.exec(item.url);
    if (!m) continue;
    const rawBuf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
    if (rawBuf.length === 0 || rawBuf.length > MAX_TERRAIN_PHOTO_BYTES) continue;
    try {
      const res = await optimiserPhotoPourPdf(rawBuf, m[1], { skipJpegUnderBytes: 50 * 1024 });
      if (res.octets === rawBuf) {
        optimized.push(item);
      } else {
        optimized.push({
          ...item,
          url: `data:image/${res.type};base64,${res.octets.toString('base64')}`,
        });
      }
    } catch {
      // Ignorer toute image malformée ou dépassant le budget mémoire libvips
    }
  }

  return optimized.length > 0 ? JSON.stringify(optimized) : null;
}
