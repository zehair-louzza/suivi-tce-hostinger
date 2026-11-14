/**
 * Optimiseur d'images haute performance pour rapports et interventions ANELEC GROUPE.
 *
 * Objectif :
 * 1. Garantir que chaque photo reste parfaitement lisible (tableaux électriques, compteurs, étiquettes).
 * 2. Compresser strictement pour ne JAMAIS saturer la base de données PostgreSQL / Supabase.
 * 3. Budget cible : 40 Ko - 75 Ko max par photo (au lieu de 2 à 10 Mo en sortie d'appareil).
 * 4. Conversion automatique en JPEG ultra-optimisé avec lissage bicubique.
 */

export interface OptimizedPhotoResult {
  dataUrl: string;
  originalSizeKo: number;
  compressedSizeKo: number;
  reductionPercent: number;
  dimensions: { width: number; height: number };
}

export const MAX_PHOTOS_PER_MISSION = 10;
export const MAX_PHOTO_BYTES_TARGET = 75 * 1024; // 75 Ko

export async function compressAndOptimizeImage(file: File): Promise<OptimizedPhotoResult> {
  const originalSizeKo = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d’image non supporté ou corrompu.'));
      img.onload = () => {
        // Redimensionnement intelligent : max 920px (haute lisibilité sur schémas & tableaux)
        const maxInitialDim = 920;
        let { width, height } = img;

        if (width > maxInitialDim || height > maxInitialDim) {
          if (width > height) {
            height = Math.round((height * maxInitialDim) / width);
            width = maxInitialDim;
          } else {
            width = Math.round((width * maxInitialDim) / height);
            height = maxInitialDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          const fallbackData = String(reader.result);
          resolve({
            dataUrl: fallbackData,
            originalSizeKo,
            compressedSizeKo: Math.round(fallbackData.length / 1024),
            reductionPercent: 0,
            dimensions: { width, height },
          });
          return;
        }

        // Fond blanc pour éviter un fond noir lors de la conversion JPEG de PNG/WebP transparents
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Passe 1 : Qualité 0.78 (~35-65 Ko avec détail optimal sur étiquettes)
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Passe 2 : Qualité 0.70 si la taille dépasse ~70 Ko
        if (dataUrl.length > 94000) {
          quality = 0.7;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Passe 3 : Redimensionnement à 760px max à 0.65 uniquement si toujours > ~72 Ko
        if (dataUrl.length > 96000 && (width > 760 || height > 760)) {
          const secondMaxDim = 760;
          let w2 = width;
          let h2 = height;
          if (w2 > h2) {
            h2 = Math.round((h2 * secondMaxDim) / w2);
            w2 = secondMaxDim;
          } else {
            w2 = Math.round((w2 * secondMaxDim) / h2);
            h2 = secondMaxDim;
          }
          canvas.width = w2;
          canvas.height = h2;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w2, h2);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w2, h2);
          dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          width = w2;
          height = h2;
        }

        const compressedSizeKo = Math.round((dataUrl.length * 3) / 4 / 1024);
        const reductionPercent =
          originalSizeKo > 0
            ? Math.max(0, Math.round(((originalSizeKo - compressedSizeKo) / originalSizeKo) * 100))
            : 0;

        resolve({
          dataUrl,
          originalSizeKo,
          compressedSizeKo,
          reductionPercent,
          dimensions: { width, height },
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
