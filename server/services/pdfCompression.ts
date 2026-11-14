// Compression haute qualité (perte visuelle imperceptible) des images et flux PDF.
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

type SharpFn = typeof import('sharp')['default'];

let sharpLoader: Promise<SharpFn | null> | null = null;

async function getSharp(): Promise<SharpFn | null> {
  if (!sharpLoader) {
    sharpLoader = import('sharp')
      .then((m: any) => (m?.default || m) as SharpFn)
      .catch(() => null);
  }
  return sharpLoader;
}

const SKIP_STREAM_FILTERS = new Set(['DCTDecode', 'JPXDecode', 'JBIG2Decode', 'CCITTFaxDecode']);

/**
 * Optimise une photo terrain avant insertion dans une carte A4 2 colonnes (~244 pt ≈ 8,6 cm de large).
 * 920 px max correspond à ~270 DPI à taille d'impression : netteté optimale même en zoom sur étiquettes/tableaux,
 * avec encodage MozJPEG pour réduire drastiquement le poids du PDF final.
 */
export async function optimiserPhotoPourPdf(
  octets: Buffer,
  type: string,
  opts: { skipJpegUnderBytes?: number } = {}
): Promise<{ octets: Buffer; type: 'jpeg' | 'png' }> {
  const normType = type.toLowerCase() === 'png' ? 'png' : type.toLowerCase() === 'jpeg' || type.toLowerCase() === 'jpg' ? 'jpeg' : 'other';
  if (!octets || octets.length === 0) {
    return { octets, type: normType === 'png' ? 'png' : 'jpeg' };
  }
  const jpegKeepLimit = opts.skipJpegUnderBytes ?? 50 * 1024;
  // Conserver les JPEG déjà optimisés (<= 50 Ko) pour éviter toute double compression avec perte, ainsi que les images < 10 Ko.
  if ((normType === 'jpeg' && octets.length <= jpegKeepLimit) || (normType === 'png' && octets.length <= 10 * 1024)) {
    return { octets, type: normType };
  }

  const sharp = await getSharp();
  if (!sharp) {
    return { octets, type: normType === 'png' ? 'png' : 'jpeg' };
  }

  try {
    const encoder = async (maxSide: number, quality: number) =>
      sharp(octets, { failOn: 'none' })
        .rotate()
        .flatten({ background: '#ffffff' })
        .resize({
          width: maxSide,
          height: maxSide,
          fit: 'inside',
          withoutEnlargement: true,
          kernel: 'lanczos3',
        })
        .jpeg({
          quality,
          mozjpeg: true,
          progressive: false,
          chromaSubsampling: '4:2:0',
        })
        .toBuffer();

    let candidate = await encoder(920, 76);
    if (candidate.length > 50 * 1024) {
      const pass2 = await encoder(780, 68);
      if (pass2.length < candidate.length) candidate = pass2;
    }

    // Pour WebP / GIF (non supportés directement par pdf-lib), toujours convertir en JPEG.
    if (normType === 'other' || candidate.length < octets.length) {
      return { octets: candidate, type: 'jpeg' };
    }
    return { octets, type: normType };
  } catch {
    return { octets, type: normType === 'png' ? 'png' : 'jpeg' };
  }
}

let cachedLogo: { hash: string; buf: Buffer } | null = null;

/**
 * Optimise le logo marque transparent une seule fois (144 px de large ≈ >280 DPI pour un affichage 36 pt)
 * tout en préservant strictement le canal alpha RGBA.
 */
export async function optimiserLogoPngPourPdf(markBuf: Buffer): Promise<Buffer> {
  if (!markBuf?.length) return markBuf;
  const hash = crypto.createHash('sha1').update(markBuf).digest('hex');
  if (cachedLogo && cachedLogo.hash === hash) return cachedLogo.buf;

  const sharp = await getSharp();
  if (!sharp) return markBuf;
  try {
    const out = await sharp(markBuf, { failOn: 'none' })
      .resize({ width: 144, height: 159, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .png({ compressionLevel: 9, palette: false, effort: 10 })
      .toBuffer();
    const chosen = out.length < markBuf.length ? out : markBuf;
    cachedLogo = { hash, buf: chosen };
    return chosen;
  } catch {
    return markBuf;
  }
}

function getFilterName(stream: PDFRawStream): string | null {
  const filter = stream.dict.get(PDFName.of('Filter'));
  if (!filter) return null;
  if (filter instanceof PDFName) return filter.decodeText();
  return null;
}

/**
 * Compresse en lossless (zlib niveau 9) les flux bruts ou faiblement compressés d'un PDFDocument en mémoire.
 * Réduit également les images JPEG surdimensionnées dans les PDF externes importés si `optimiserImages = true`.
 */
export async function optimiserDocumentPdfEnPlace(
  pdf: PDFDocument,
  opts: { optimiserImages?: boolean } = {}
): Promise<void> {
  const sharp = opts.optimiserImages ? await getSharp() : null;

  for (const [ref, obj] of pdf.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    const subtype = dict.get(PDFName.of('Subtype'));
    const typeObj = dict.get(PDFName.of('Type'));
    const filterName = getFilterName(obj);
    const isImage = subtype === PDFName.of('Image');
    const isXRefOrObjStm = typeObj === PDFName.of('XRef') || typeObj === PDFName.of('ObjStm');

    if (isXRefOrObjStm) continue;

    // 1. Recompression sélective des images JPEG lourdes (> 60 Ko, sans masque/parms exotiques) sur PDF externes déposés
    if (isImage && opts.optimiserImages && sharp && filterName === 'DCTDecode') {
      const hasSmask = dict.has(PDFName.of('SMask')) || dict.has(PDFName.of('Mask')) || dict.has(PDFName.of('DecodeParms'));
      const cs = dict.get(PDFName.of('ColorSpace'));
      const csSafe = cs === PDFName.of('DeviceRGB') || cs === PDFName.of('DeviceGray');
      if (!hasSmask && csSafe && obj.contents.length > 60 * 1024) {
        try {
          const meta = await sharp(obj.contents, { failOn: 'none' }).metadata();
          const maxDim = Math.max(meta.width || 0, meta.height || 0);
          if (maxDim > 0) {
            const targetMax = Math.min(maxDim, 1400);
            const recomp = await sharp(obj.contents, { failOn: 'none' })
              .resize({ width: targetMax, height: targetMax, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
              .jpeg({ quality: 75, mozjpeg: true, progressive: false })
              .toBuffer();
            const newMeta = await sharp(recomp).metadata();
            if (recomp.length < obj.contents.length * 0.9 && newMeta.width && newMeta.height) {
              dict.set(PDFName.of('Width'), pdf.context.obj(newMeta.width));
              dict.set(PDFName.of('Height'), pdf.context.obj(newMeta.height));
              dict.set(PDFName.of('Length'), pdf.context.obj(recomp.length));
              pdf.context.assign(ref, PDFRawStream.of(dict, recomp));
            }
          }
        } catch {
          // Conserver le flux image d'origine si le décodage JPEG échoue
        }
      }
      continue;
    }

    if (filterName && SKIP_STREAM_FILTERS.has(filterName)) continue;

    // 2. Flux sans filtre -> compression zlib niveau 9
    if (!filterName && !dict.has(PDFName.of('Filter')) && obj.contents.length > 64) {
      const compressed = zlib.deflateSync(obj.contents, { level: 9 });
      if (compressed.length < obj.contents.length) {
        dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
        dict.set(PDFName.of('Length'), pdf.context.obj(compressed.length));
        pdf.context.assign(ref, PDFRawStream.of(dict, compressed));
      }
      continue;
    }

    // 3. Flux non-image déjà en FlateDecode -> tenter niveau 9 si pas de DecodeParms
    if (!isImage && filterName === 'FlateDecode' && !dict.has(PDFName.of('DecodeParms')) && obj.contents.length > 128) {
      try {
        const raw = zlib.inflateSync(obj.contents);
        const better = zlib.deflateSync(raw, { level: 9 });
        if (better.length < obj.contents.length) {
          dict.set(PDFName.of('Length'), pdf.context.obj(better.length));
          pdf.context.assign(ref, PDFRawStream.of(dict, better));
        }
      } catch {
        // Ignorer flux non standard
      }
    }
  }
}

/**
 * Sauvegarde un PDFDocument généré en activant les object streams et la compression maximale lossless.
 */
export async function sauvegarderPdfCompresse(pdf: PDFDocument): Promise<Buffer> {
  await optimiserDocumentPdfEnPlace(pdf, { optimiserImages: false });
  const bytes = await pdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  return Buffer.from(bytes);
}

/**
 * Compresse un PDF déposé manuellement (devis ou rapport externe) sans perte visible de lisibilité.
 * Ne grossit jamais le fichier : si la compression n'apporte pas de gain net, conserve l'original.
 */
export async function preparerPdfDeposeCompresse(
  octets: Buffer
): Promise<{ octets: Buffer; sha256: string; compressed: boolean }> {
  try {
    const pdf = await PDFDocument.load(octets, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    await optimiserDocumentPdfEnPlace(pdf, { optimiserImages: true });
    const saved = Buffer.from(
      await pdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
        updateFieldAppearances: false,
      })
    );
    if (saved.length > 0 && saved.length < octets.length) {
      return {
        octets: saved,
        sha256: crypto.createHash('sha256').update(saved).digest('hex'),
        compressed: true,
      };
    }
  } catch {
    // PDF chiffré ou structure exotique : conserver l'original intact
  }
  return {
    octets,
    sha256: crypto.createHash('sha256').update(octets).digest('hex'),
    compressed: false,
  };
}
