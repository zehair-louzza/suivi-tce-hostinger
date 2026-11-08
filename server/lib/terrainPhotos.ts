/**
 * Photos prises sur le terrain (interventions et visites devis) :
 * stockage JSON borné pour éviter toute saturation de la base.
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
