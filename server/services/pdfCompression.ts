// Compression haute qualité (perte visuelle imperceptible) des images et flux PDF.
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { AppError } from '../middleware/errorHandler.js';

type SharpFn = typeof import('sharp')['default'];

let sharpLoader: Promise<SharpFn | null> | null = null;

const MAX_IMAGE_PIXELS = 12_000_000;
const MAX_IMAGE_SIDE = 5_000;
const MAX_INFLATE_BYTES = 16 * 1024 * 1024;
const MAX_PDF_INFLATE_TOTAL = 64 * 1024 * 1024;
const MAX_PNG_METADATA_CHUNK_BYTES = 512 * 1024;
const MAX_PNG_CHUNKS = 4096;

function isSafePngStructure(buf: Uint8Array): boolean {
  if (
    buf.length < 33 ||
    buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47 ||
    buf[4] !== 0x0d || buf[5] !== 0x0a || buf[6] !== 0x1a || buf[7] !== 0x0a
  ) {
    return false;
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 8;
  let sawIhdr = false;
  let sawIend = false;
  let chunks = 0;

  while (offset + 12 <= buf.length && chunks < MAX_PNG_CHUNKS) {
    const chunkLen = view.getUint32(offset, false);
    if (chunkLen > 0x7fff_ffff || offset + 12 + chunkLen > buf.length) {
      return false;
    }
    const type = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);
    if (chunks === 0) {
      if (type !== 'IHDR' || chunkLen !== 13) return false;
      const w = view.getUint32(offset + 8, false);
      const h = view.getUint32(offset + 12, false);
      const bitDepth = buf[offset + 16];
      const colorType = buf[offset + 17];
      if (
        w === 0 || h === 0 || w > MAX_IMAGE_SIDE || h > MAX_IMAGE_SIDE || w * h > MAX_IMAGE_PIXELS ||
        ![1, 2, 4, 8, 16].includes(bitDepth) || ![0, 2, 3, 4, 6].includes(colorType)
      ) {
        return false;
      }
      sawIhdr = true;
    }
    if ((type === 'zTXt' || type === 'iTXt' || type === 'iCCP') && chunkLen > MAX_PNG_METADATA_CHUNK_BYTES) {
      return false;
    }
    offset += 12 + chunkLen;
    chunks++;
    if (type === 'IEND') {
      sawIend = chunkLen === 0;
      break;
    }
  }
  return sawIhdr && sawIend;
}

function isSafeJpegDimensions(buf: Uint8Array): boolean {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return true;
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 3 >= buf.length) return false;
    const segLen = (buf[i + 2] << 8) | buf[i + 3];
    if (segLen < 2 || i + 2 + segLen > buf.length) return false;
    if ((marker >= 0xc0 && marker <= 0xc3) && segLen >= 7) {
      const h = (buf[i + 5] << 8) | buf[i + 6];
      const w = (buf[i + 7] << 8) | buf[i + 8];
      if (w === 0 || h === 0 || w > MAX_IMAGE_SIDE || h > MAX_IMAGE_SIDE || w * h > MAX_IMAGE_PIXELS) {
        return false;
      }
      return true;
    }
    i += 2 + segLen;
  }
  return true;
}

export function isSafeImageDimensions(buf: Uint8Array): boolean {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return isSafePngStructure(buf);
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    return isSafeJpegDimensions(buf);
  }
  return true;
}

async function getSharp(): Promise<SharpFn | null> {
  if (!sharpLoader) {
    sharpLoader = import('sharp')
      .then((m: any) => {
        const s = (m?.default || m) as SharpFn;
        try {
          (s as any)?.cache?.(false);
          (s as any)?.concurrency?.(1);
        } catch {
          // ignore
        }
        return s;
      })
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
  if (!isSafeImageDimensions(octets)) {
    throw new Error('Image trop volumineuse (dimensions dépassées)');
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
      sharp(octets, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS })
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
    throw new Error('Image corrompue ou dangereuse rejetée avant traitement PDF');
  }
}

let cachedLogo: { hash: string; buf: Buffer } | null = null;

/**
 * Optimise le logo marque transparent une seule fois (144 px de large ≈ >280 DPI pour un affichage 36 pt)
 * tout en préservant strictement le canal alpha RGBA.
 */
export async function optimiserLogoPngPourPdf(markBuf: Buffer): Promise<Buffer> {
  if (!markBuf?.length) return markBuf;
  if (!isSafeImageDimensions(markBuf)) {
    throw new Error('Logo image invalide ou trop volumineux');
  }
  const hash = crypto.createHash('sha1').update(markBuf).digest('hex');
  if (cachedLogo && cachedLogo.hash === hash) return cachedLogo.buf;

  const sharp = await getSharp();
  if (!sharp) return markBuf;
  try {
    const out = await sharp(markBuf, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS })
      .resize({ width: 144, height: 159, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .png({ compressionLevel: 9, palette: false, effort: 10 })
      .toBuffer();
    const chosen = out.length < markBuf.length ? out : markBuf;
    cachedLogo = { hash, buf: chosen };
    return chosen;
  } catch {
    throw new Error('Logo PNG invalide rejeté avant incorporation PDF');
  }
}

function getFilterName(stream: PDFRawStream): string | null {
  const filter = stream.dict.get(PDFName.of('Filter'));
  if (!filter) return null;
  if (filter instanceof PDFName) return filter.decodeText();
  return null;
}

class PdfZipBombError extends AppError {
  constructor(message: string) {
    super(400, message, 'INVALID_PDF');
    this.name = 'PdfZipBombError';
  }
}

/**
 * Pré-contrôle des flux /FlateDecode bruts AVANT tout appel à PDFDocument.load,
 * afin de rejeter toute bombe de décompression sans épuiser le tas Node.
 */
export function assertPdfFlateStreamsBounded(octets: Buffer): void {
  const MAX_STREAMS_SCAN = 2000;
  let cursor = 0;
  let scanned = 0;
  let totalInflated = 0;

  while (cursor < octets.length && scanned < MAX_STREAMS_SCAN) {
    const streamIdx = octets.indexOf('stream', cursor, 'latin1');
    if (streamIdx === -1) break;
    scanned++;

    // S'assurer qu'il s'agit bien du mot-clé PDF `stream` suivi d'un retour ligne
    let dataStart = streamIdx + 6;
    if (octets[dataStart] === 0x0d && octets[dataStart + 1] === 0x0a) dataStart += 2;
    else if (octets[dataStart] === 0x0a) dataStart += 1;
    else {
      cursor = streamIdx + 6;
      continue;
    }

    const endIdx = octets.indexOf('endstream', dataStart, 'latin1');
    if (endIdx === -1) break;

    const dictWindowStart = Math.max(0, streamIdx - 4096);
    const dictSlice = octets.toString('latin1', dictWindowStart, streamIdx);
    const dictStartIdx = dictSlice.lastIndexOf('<<');
    const inspectedDict = dictStartIdx >= 0 ? dictSlice.slice(dictStartIdx) : dictSlice;
    if (inspectedDict.includes('/FlateDecode')) {
      const compressedSlice = octets.subarray(dataStart, endIdx);
      const remainingTotal = MAX_PDF_INFLATE_TOTAL - totalInflated;
      if (remainingTotal <= 0) {
        throw new PdfZipBombError('PDF rejeté : volume total décompressé excessif');
      }
      const cap = Math.min(MAX_INFLATE_BYTES, remainingTotal);
      try {
        const inflated = zlib.inflateSync(compressedSlice, { maxOutputLength: cap });
        totalInflated += inflated.length;
      } catch (err: any) {
        if (err?.code === 'ERR_BUFFER_TOO_LARGE' || /output length|buffer limit/i.test(String(err?.message || ''))) {
          throw new PdfZipBombError('PDF rejeté : flux compressé dépassant le plafond de décompression autorisé');
        }
        // Flux non-zlib standard ou chiffré : la suite (PDFDocument.load) décidera
      }
    }
    cursor = endIdx + 9;
  }
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
  let totalInflated = 0;

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
          if (!isSafeImageDimensions(obj.contents)) continue;
          const meta = await sharp(obj.contents, { failOn: 'none', limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
          const maxDim = Math.max(meta.width || 0, meta.height || 0);
          if (maxDim > 0 && (!meta.width || !meta.height || meta.width * meta.height <= MAX_IMAGE_PIXELS)) {
            const targetMax = Math.min(maxDim, 1400);
            const recomp = await sharp(obj.contents, { failOn: 'none', limitInputPixels: MAX_IMAGE_PIXELS })
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
    if (!isImage && filterName === 'FlateDecode' && !dict.has(PDFName.of('DecodeParms')) && obj.contents.length > 128 && totalInflated < MAX_PDF_INFLATE_TOTAL) {
      try {
        const raw = zlib.inflateSync(obj.contents, { maxOutputLength: MAX_INFLATE_BYTES });
        totalInflated += raw.length;
        if (totalInflated > MAX_PDF_INFLATE_TOTAL) continue;
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
  assertPdfFlateStreamsBounded(octets);
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
  } catch (err) {
    if (err instanceof PdfZipBombError) throw err;
    // PDF chiffré ou structure exotique : conserver l'original intact
  }
  return {
    octets,
    sha256: crypto.createHash('sha256').update(octets).digest('hex'),
    compressed: false,
  };
}
