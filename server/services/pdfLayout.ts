// Socle commun de mise en page PDF professionnelle (pdf-lib, 100 % JavaScript) pour rapports terrain et devis.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { optimiserLogoPngPourPdf, optimiserPhotoPourPdf, sauvegarderPdfCompresse } from './pdfCompression.js';

export type PhotoPdf = { id: string; caption: string; category: string; octets: Buffer; type: string };

export type SocietePdfInfo = {
  nom: string;
  siret?: string | null;
  siren?: string | null;
  adresse?: string | null;
  email?: string | null;
};

export type ClientPdfInfo = {
  nom?: string | null;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  siret?: string | null;
};

export type LigneCarteInfo = { label?: string; value: string; bold?: boolean };

export type CarteInfo = {
  titre: string;
  nomPrincipal: string;
  lignes: LigneCarteInfo[];
  fondTeinte?: Color;
  barreCouleur?: Color;
};

export type KpiCell = { label: string; value: string; pillColor?: Color };

export const A4 = { w: 595.28, h: 841.89 };
export const MARGE = 36;
export const LARGEUR = A4.w - 2 * MARGE;
const BAS_MIN = 56;

export const PALETTE = {
  navy: rgb(0.118, 0.227, 0.373), // #1E3A5F (encre & filets bleu ardoise)
  headerBg: rgb(0.114, 0.388, 0.659), // #1D63A8 (bleu azur lumineux & lisible)
  cloudLight: rgb(0.847, 0.929, 0.996), // #D8EDFE (halo nuage pastel)
  cloudMid: rgb(0.451, 0.749, 0.976), // #73BFF9 (deuxième vague nuage)
  cloudSoft: rgb(0.937, 0.969, 1), // #EFF7FF (vague pied de page & continuation)
  cloudLine: rgb(0.749, 0.871, 0.98), // #BFDEFA (trait vague fin)
  headerDivider: rgb(0.451, 0.686, 0.882), // #73AFE1
  headerSubtle: rgb(0.902, 0.945, 0.988), // #E6F1FC
  tableHeadBg: rgb(0.918, 0.953, 0.992), // #EAF3FD
  tableHeadBorder: rgb(0.71, 0.82, 0.941), // #B5D1F0
  brandGold: rgb(0.851, 0.561, 0.039), // #D98F0A (signature ANELEC)
  brandCrimson: rgb(0.78, 0.141, 0.141), // #C72424 (signature ANELEC)
  slateDark: rgb(0.157, 0.227, 0.318), // #283A51
  slate: rgb(0.392, 0.455, 0.545), // #64748B
  slateLight: rgb(0.58, 0.639, 0.722), // #94A3B8
  dividerDark: rgb(0.392, 0.608, 0.8), // #649BCC
  border: rgb(0.796, 0.835, 0.882), // #CBD5E1
  surface: rgb(0.973, 0.98, 0.988), // #F8FAFC
  tintHeader: rgb(0.945, 0.961, 0.976), // #F1F5F9
  white: rgb(1, 1, 1),
  emerald: rgb(0, 0.749, 0.388), // #00BF63
  emeraldDark: rgb(0.016, 0.471, 0.341), // #047857
  emeraldBg: rgb(0.925, 0.992, 0.961), // #ECFDF5
  blue: rgb(0.145, 0.388, 0.922), // #2563EB
  blueSky: rgb(0.055, 0.647, 0.914), // #0EA5E9
  blueDark: rgb(0.114, 0.306, 0.847), // #1D4ED8
  blueBg: rgb(0.937, 0.965, 1), // #EFF6FF
  amberDark: rgb(0.706, 0.325, 0.035), // #B45309
  amberBg: rgb(0.996, 0.953, 0.78), // #FEF3C7
  violetDark: rgb(0.427, 0.157, 0.851), // #6D28D9
  violetBg: rgb(0.953, 0.91, 1), // #F3E8FF
};

const brandCache = new Map<string, Buffer | null>();

export function chargerLogoBrand(
  fichier: 'anelec-logo-white.png' | 'anelec-logo.png' | 'anelec-mark.png' | 'anelec-mark-256.png'
): Buffer | null {
  if (brandCache.has(fichier)) return brandCache.get(fichier) || null;
  const candidats = [
    path.resolve(process.cwd(), 'client/public/brand', fichier),
    path.resolve(process.cwd(), 'dist/client/brand', fichier),
  ];
  for (const p of candidats) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        brandCache.set(fichier, buf);
        return buf;
      }
    } catch {
      /* ignore */
    }
  }
  brandCache.set(fichier, null);
  return null;
}

/** Les polices standard PDF ne gèrent pas tous les caractères Unicode : normalisation sûre en WinAnsi. */
export function sur(texte: string, font: PDFFont): string {
  const t = String(texte ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/[✓✔]/g, '[x]')
    .replace(/•/g, '-')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\r\t]/g, ' ');
  let out = '';
  for (const ch of t) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += ch === '\n' ? '\n' : '?';
    }
  }
  return out;
}

export function decouper(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  for (const paragraphe of sur(texte, font).split('\n')) {
    if (!paragraphe.trim()) {
      lignes.push('');
      continue;
    }
    let courante = '';
    for (const mot of paragraphe.split(/\s+/)) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (font.widthOfTextAtSize(essai, taille) <= largeur) {
        courante = essai;
        continue;
      }
      if (courante) lignes.push(courante);
      let reste = mot;
      while (font.widthOfTextAtSize(reste, taille) > largeur) {
        let n = reste.length;
        while (n > 1 && font.widthOfTextAtSize(reste.slice(0, n), taille) > largeur) n--;
        lignes.push(reste.slice(0, n));
        reste = reste.slice(n);
      }
      courante = reste;
    }
    if (courante) lignes.push(courante);
  }
  return lignes;
}

export const dateFrPdf = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : '')).toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '';

export function euroPdf(montant: number): string {
  const signe = montant < 0 ? '-' : '';
  const abs = Math.abs(montant);
  const [entier, dec] = abs.toFixed(2).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${signe}${groupe},${dec} EUR`;
}

function pillCouleurPhoto(category: string): { bg: Color; fg: Color; label: string } {
  const c = (category || 'Terrain').trim().toLowerCase();
  if (c === 'avant' || c.includes('avant')) return { bg: PALETTE.amberBg, fg: PALETTE.amberDark, label: 'AVANT TRAVAUX' };
  if (c === 'apres' || c.includes('apr') || c.includes('fin')) return { bg: PALETTE.emeraldBg, fg: PALETTE.emeraldDark, label: 'APRES TRAVAUX' };
  if (c === 'releve_chiffrage' || c.includes('visite') || c.includes('chiffrage')) {
    return { bg: PALETTE.violetBg, fg: PALETTE.violetDark, label: 'VISITE / CHIFFRAGE' };
  }
  if (c === 'constat') return { bg: PALETTE.blueBg, fg: PALETTE.blueDark, label: 'CONSTAT TERRAIN' };
  if (c.includes('cours') || c.includes('pendant')) return { bg: PALETTE.blueBg, fg: PALETTE.blueDark, label: category.toUpperCase() };
  return { bg: PALETTE.tintHeader, fg: PALETTE.slateDark, label: (category || 'TERRAIN').toUpperCase() };
}

export async function createDocumentPdf(opts: {
  title: string;
  societe: SocietePdfInfo;
  badgeType: string;
  reference: string;
  dateLigne?: string | null;
  sousRefLigne?: string | null;
  accent: Color;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title);
  pdf.setProducer('ANELEC SUIVI TCE');
  pdf.setCreator('ANELEC SUIVI TCE');
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const marqueSerif = await pdf.embedFont(StandardFonts.TimesRomanBold);

  let markImg: PDFImage | null = null;
  const rawMarkBuf = chargerLogoBrand('anelec-mark.png') || chargerLogoBrand('anelec-mark-256.png');
  const markBuf = rawMarkBuf ? await optimiserLogoPngPourPdf(rawMarkBuf) : null;
  try {
    if (markBuf) markImg = await pdf.embedPng(markBuf);
  } catch {
    markImg = null;
  }

  // ── Motifs discrets d'identité ANELEC en filigrane de page ───────────────────
  const dessinerMotifsPage = (pg: PDFPage, inclureHaut = false) => {
    // Matrice de micro-points techniques sur la bordure droite
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        pg.drawCircle({
          x: A4.w - 22 + c * 6,
          y: A4.h - (inclureHaut ? 156 : 58) - r * 7,
          size: 0.9,
          color: PALETTE.headerBg,
          opacity: 0.14 - c * 0.03,
        });
      }
    }
    // Filigrane géométrique inspiré des 3 brins hexagonaux ANELEC en bas à droite
    const hexPath1 = 'M 0 18 L 28 2 L 56 18 L 56 46 L 44 53';
    const hexPath2 = 'M 10 50 L 38 66 L 66 50 L 66 22';
    const hexPath3 = 'M 18 14 L 18 42 L 42 56';
    pg.drawSvgPath(hexPath1, { x: A4.w - 118, y: 120, borderColor: PALETTE.emerald, borderWidth: 2.2, borderOpacity: 0.07 });
    pg.drawSvgPath(hexPath2, { x: A4.w - 118, y: 120, borderColor: PALETTE.headerBg, borderWidth: 2.2, borderOpacity: 0.07 });
    pg.drawSvgPath(hexPath3, { x: A4.w - 118, y: 120, borderColor: PALETTE.brandGold, borderWidth: 2.2, borderOpacity: 0.07 });

    // Micro-grille verticale discrète marge gauche
    for (let i = 0; i < 4; i++) {
      pg.drawCircle({ x: 16, y: 210 + i * 9, size: 0.9, color: PALETTE.headerBg, opacity: 0.12 });
    }
  };

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h;
  dessinerMotifsPage(page, true);

  const nouvellePage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    dessinerMotifsPage(page, false);
    // Bandeau nuage/vague discret de continuation
    const miniWaveHalo =
      'M 0 0 L 596 0 L 596 34 C 520 44, 455 26, 390 36 C 320 46, 255 25, 190 35 C 120 46, 55 28, 0 36 Z';
    const miniWaveLine =
      'M 0 35 C 55 27, 120 45, 190 34 C 255 24, 320 45, 390 35 C 455 25, 520 43, 596 33';
    page.drawSvgPath(miniWaveHalo, { x: 0, y: A4.h, color: PALETTE.cloudSoft });
    page.drawSvgPath(miniWaveLine, { x: 0, y: A4.h, borderColor: opts.accent, borderWidth: 1.6, borderOpacity: 0.85 });

    if (markImg) {
      const mh = 15;
      const mw = mh * (markImg.width / markImg.height);
      page.drawImage(markImg, { x: MARGE, y: A4.h - 22, width: mw, height: mh });
      page.drawText(sur(opts.societe.nom, gras), {
        x: MARGE + mw + 8,
        y: A4.h - 18,
        size: 9,
        font: gras,
        color: PALETTE.navy,
      });
    } else {
      page.drawText(sur(opts.societe.nom, gras), {
        x: MARGE,
        y: A4.h - 18,
        size: 9,
        font: gras,
        color: PALETTE.navy,
      });
    }
    const droite = sur(`${opts.badgeType}  -  ${opts.reference}`, police);
    const rw = police.widthOfTextAtSize(droite, 8.5);
    page.drawText(droite, { x: A4.w - MARGE - rw, y: A4.h - 18, size: 8.5, font: police, color: PALETTE.slate });
    y = A4.h - 54;
  };

  const place = (hauteur: number) => {
    if (y - hauteur < BAS_MIN) nouvellePage();
  };

  // ── En-tête artistique page 1 : Vague Nuage multicouches & motifs ────────────
  const cloudBackPath =
    'M 0 0 L 596 0 L 596 106 C 560 123, 514 123, 478 102 C 440 122, 388 122, 352 99 C 308 125, 250 124, 212 100 C 166 123, 108 123, 72 101 C 40 116, 16 112, 0 98 Z';
  const cloudMidPath =
    'M 0 0 L 596 0 L 596 97 C 556 114, 508 112, 472 91 C 430 113, 376 111, 340 89 C 294 115, 236 113, 196 89 C 150 111, 96 111, 60 91 C 32 104, 12 101, 0 91 Z';
  const accentWavePath =
    'M 0 0 L 596 0 L 596 92 C 562 108, 518 106, 484 89 C 444 109, 396 107, 360 87 C 314 110, 256 108, 214 88 C 168 108, 112 107, 74 89 C 42 101, 16 99, 0 90 Z';
  const mainCloudWavePath =
    'M 0 0 L 596 0 L 596 88 C 562 104, 518 102, 484 85 C 444 105, 396 103, 360 83 C 314 106, 256 104, 214 84 C 168 104, 112 103, 74 85 C 42 97, 16 95, 0 86 Z';

  page.drawSvgPath(cloudBackPath, { x: 0, y: A4.h, color: PALETTE.cloudLight });
  page.drawSvgPath(cloudMidPath, { x: 0, y: A4.h, color: PALETTE.cloudMid, opacity: 0.48 });
  page.drawSvgPath(accentWavePath, { x: 0, y: A4.h, color: opts.accent, opacity: 0.92 });
  page.drawSvgPath(mainCloudWavePath, { x: 0, y: A4.h, color: PALETTE.headerBg });

  // Motifs nuages & géométrie technique subtils à l'intérieur du bandeau vague
  const innerSwirl =
    'M 210 92 C 255 62, 315 58, 368 82 C 415 52, 485 48, 545 78 C 565 65, 582 62, 596 66 L 596 0 L 210 0 Z';
  page.drawSvgPath(innerSwirl, { x: 0, y: A4.h, color: PALETTE.white, opacity: 0.06 });
  page.drawCircle({ x: 525, y: A4.h - 24, size: 36, color: PALETTE.white, opacity: 0.05 });
  page.drawCircle({ x: 486, y: A4.h - 14, size: 22, color: PALETTE.white, opacity: 0.06 });
  page.drawCircle({ x: 356, y: A4.h - 18, size: 26, color: PALETTE.white, opacity: 0.045 });
  for (let gx = 0; gx < 5; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      page.drawCircle({
        x: 344 + gx * 8,
        y: A4.h - 16 - gy * 7,
        size: 1.0,
        color: PALETTE.white,
        opacity: 0.14,
      });
    }
  }

  const URL_SOLUTION = 'https://suivi.anelecgroupe.com';

  /** Trace l'URL centrée exactement dans la largeur [leftX .. leftX + maxWidth] sans jamais dépasser les extrémités. */
  const dessinerUrlBornee = (pg: PDFPage, leftX: number, maxWidth: number, baseY: number, color: Color, maxSize = 6.8) => {
    const wRef = police.widthOfTextAtSize(URL_SOLUTION, 10);
    const size = Math.min(maxSize, ((maxWidth - 1) / Math.max(wRef, 1)) * 10);
    const w = police.widthOfTextAtSize(URL_SOLUTION, size);
    pg.drawText(URL_SOLUTION, {
      x: leftX + Math.max(0, (maxWidth - w) / 2),
      y: baseY,
      size,
      font: police,
      color,
    });
  };

  let infoStartX = MARGE;
  const markH = 38;
  const markW = markImg ? markH * (markImg.width / markImg.height) : 0;
  const markY = A4.h - 57;
  if (markImg) {
    page.drawImage(markImg, { x: MARGE, y: markY, width: markW, height: markH });
  }
  const brandTextX = markImg ? MARGE + markW + 8 : MARGE;
  const line1 = 'ANELEC';
  const line2 = 'SUIVI TCE';
  const s1 = 16;
  const s2 = 12;
  const l1W = marqueSerif.widthOfTextAtSize(line1, s1);
  const l2W = marqueSerif.widthOfTextAtSize(line2, s2);
  const brandColW = Math.max(l1W, l2W);
  const topLineY = A4.h - 31;
  page.drawText(line1, { x: brandTextX, y: topLineY, size: s1, font: marqueSerif, color: PALETTE.white });
  page.drawText(line2, { x: brandTextX, y: topLineY - 14.5, size: s2, font: marqueSerif, color: PALETTE.white });
  page.drawRectangle({ x: brandTextX, y: topLineY - 20.5, width: brandColW - 4, height: 1.2, color: PALETTE.white });
  page.drawRectangle({ x: brandTextX + brandColW - 3.5, y: topLineY - 21.8, width: 3.6, height: 3.6, color: PALETTE.white });

  const logoBlocW = (brandTextX + brandColW) - MARGE;
  dessinerUrlBornee(page, MARGE, logoBlocW, A4.h - 68.5, PALETTE.headerSubtle, 6.8);

  const sepX = brandTextX + brandColW + 14;
  page.drawLine({
    start: { x: sepX, y: A4.h - 15 },
    end: { x: sepX, y: A4.h - 72 },
    thickness: 1,
    color: PALETTE.headerDivider,
  });
  infoStartX = sepX + 14;

  // Bloc droit (badge + référence + date) calculé pour connaître la largeur restante du nom société
  const badgeText = sur(opts.badgeType.toUpperCase(), gras);
  const badgeW = Math.max(122, gras.widthOfTextAtSize(badgeText, 8) + 20);
  const rightEdge = A4.w - MARGE;
  const maxNomW = Math.max(120, rightEdge - Math.max(badgeW, 170) - 16 - infoStartX);

  const nomTaille = gras.widthOfTextAtSize(sur(opts.societe.nom, gras), 13.5) <= maxNomW ? 13.5 : 11.5;
  const nomLignes = decouper(opts.societe.nom, gras, nomTaille, maxNomW).slice(0, 2);
  let ty = A4.h - 21;
  for (const l of nomLignes) {
    page.drawText(l, { x: infoStartX, y: ty - nomTaille, size: nomTaille, font: gras, color: PALETTE.white });
    ty -= nomTaille + 3;
  }

  const sousLignes: string[] = [];
  if (opts.societe.siret) sousLignes.push(`SIRET ${opts.societe.siret}`);
  else if (opts.societe.siren) sousLignes.push(`SIREN ${opts.societe.siren}`);
  if (opts.societe.adresse) sousLignes.push(opts.societe.adresse);
  const sousTxt = sousLignes.length ? sousLignes.join('  -  ') : 'Plateforme de suivi technique ANELEC SUIVI TCE';
  for (const sl of decouper(sousTxt, police, 7.8, maxNomW).slice(0, 2)) {
    page.drawText(sl, { x: infoStartX, y: ty - 8, size: 7.8, font: police, color: PALETTE.headerSubtle });
    ty -= 10.5;
  }

  // Colonne droite dans le bandeau
  const bx = rightEdge - badgeW;
  const by = A4.h - 29;
  page.drawRectangle({ x: bx, y: by, width: badgeW, height: 17, color: opts.accent });
  const btw = gras.widthOfTextAtSize(badgeText, 8);
  page.drawText(badgeText, { x: bx + (badgeW - btw) / 2, y: by + 5.5, size: 8, font: gras, color: PALETTE.white });

  const refTxt = sur(opts.reference, gras);
  const refSize = gras.widthOfTextAtSize(refTxt, 15.5) > 175 ? 12.5 : 15.5;
  const rtw = gras.widthOfTextAtSize(refTxt, refSize);
  page.drawText(refTxt, { x: rightEdge - rtw, y: by - 19, size: refSize, font: gras, color: PALETTE.white });

  let ry = by - 31;
  if (opts.dateLigne) {
    const dl = sur(opts.dateLigne, police);
    page.drawText(dl, {
      x: rightEdge - police.widthOfTextAtSize(dl, 8),
      y: ry,
      size: 8,
      font: police,
      color: PALETTE.white,
    });
    ry -= 10.5;
  }
  if (opts.sousRefLigne) {
    const sr = sur(opts.sousRefLigne, police);
    page.drawText(sr, {
      x: rightEdge - police.widthOfTextAtSize(sr, 7.8),
      y: ry,
      size: 7.8,
      font: police,
      color: PALETTE.headerSubtle,
    });
  }

  y = A4.h - 130;

  // ── Deux colonnes Émetteur / Client & Site ─────────────────────────────────
  const prepareCarte = (carte: CarteInfo, cardW: number) => {
    const innerW = cardW - 22;
    const nomWrapped = decouper(carte.nomPrincipal || '-', gras, 10.5, innerW);
    const itemsWrapped: Array<{ label?: string; lines: string[]; bold?: boolean }> = [];
    for (const item of carte.lignes) {
      if (!item.value) continue;
      const prefix = item.label ? `${item.label} : ` : '';
      const f = item.bold ? gras : police;
      itemsWrapped.push({
        lines: decouper(`${prefix}${item.value}`, f, 8.8, innerW),
        bold: item.bold,
      });
    }
    const h =
      26 + // titre + padding haut
      nomWrapped.length * 13.5 +
      4 +
      itemsWrapped.reduce((s, it) => s + it.lines.length * 11.5 + 2, 0) +
      10;
    return { carte, nomWrapped, itemsWrapped, h };
  };

  const dessinerDeuxColonnes = (gauche: CarteInfo, droite: CarteInfo) => {
    const gap = 12;
    const cardW = (LARGEUR - gap) / 2;
    const pG = prepareCarte(gauche, cardW);
    const pD = prepareCarte(droite, cardW);
    const h = Math.max(pG.h, pD.h, 88);
    place(h + 10);

    const drawOne = (prep: ReturnType<typeof prepareCarte>, x: number) => {
      const top = y;
      page.drawRectangle({
        x,
        y: top - h,
        width: cardW,
        height: h,
        color: prep.carte.fondTeinte || PALETTE.white,
        borderColor: PALETTE.border,
        borderWidth: 0.75,
      });
      page.drawRectangle({
        x,
        y: top - 3,
        width: cardW,
        height: 3,
        color: prep.carte.barreCouleur || opts.accent,
      });
      // Discret motif de points d'architecture en haut à droite de la carte
      for (let c = 0; c < 3; c++) {
        page.drawCircle({
          x: x + cardW - 24 + c * 6,
          y: top - 14,
          size: 1.1,
          color: prep.carte.barreCouleur || opts.accent,
          opacity: 0.25 + c * 0.12,
        });
      }
      let cy = top - 16;
      page.drawText(sur(prep.carte.titre.toUpperCase(), gras), {
        x: x + 11,
        y: cy,
        size: 7.5,
        font: gras,
        color: prep.carte.barreCouleur || PALETTE.slate,
      });
      cy -= 14;
      for (const l of prep.nomWrapped) {
        page.drawText(l, { x: x + 11, y: cy, size: 10.5, font: gras, color: PALETTE.navy });
        cy -= 13.5;
      }
      cy -= 2;
      for (const it of prep.itemsWrapped) {
        const f = it.bold ? gras : police;
        for (const l of it.lines) {
          page.drawText(l, { x: x + 11, y: cy, size: 8.8, font: f, color: PALETTE.slateDark });
          cy -= 11.5;
        }
        cy -= 2;
      }
    };

    drawOne(pG, MARGE);
    drawOne(pD, MARGE + cardW + gap);
    y -= h + 10;
  };

  // ── Bandeau KPI 4 colonnes ─────────────────────────────────────────────────
  const dessinerBandeauKpi = (cells: KpiCell[]) => {
    if (!cells.length) return;
    const h = 40;
    place(h + 12);
    const top = y;
    page.drawRectangle({
      x: MARGE,
      y: top - h,
      width: LARGEUR,
      height: h,
      color: PALETTE.tintHeader,
      borderColor: PALETTE.border,
      borderWidth: 0.6,
    });
    const colW = LARGEUR / cells.length;
    cells.forEach((cell, idx) => {
      const cx = MARGE + idx * colW;
      if (idx > 0) {
        page.drawLine({
          start: { x: cx, y: top - 7 },
          end: { x: cx, y: top - h + 7 },
          thickness: 0.6,
          color: PALETTE.border,
        });
      }
      page.drawText(sur(cell.label.toUpperCase(), gras), {
        x: cx + 10,
        y: top - 13,
        size: 7.2,
        font: gras,
        color: PALETTE.slate,
      });
      const valMaxW = colW - 20;
      const valTxt = decouper(cell.value || '-', gras, 9, valMaxW)[0] || '-';
      if (cell.pillColor) {
        const pw = Math.min(valMaxW, gras.widthOfTextAtSize(valTxt, 8.2) + 12);
        page.drawRectangle({ x: cx + 10, y: top - 33, width: pw, height: 14, color: cell.pillColor });
        page.drawText(valTxt, { x: cx + 16, y: top - 28.5, size: 8.2, font: gras, color: PALETTE.white });
      } else {
        page.drawText(valTxt, { x: cx + 10, y: top - 29, size: 9, font: gras, color: PALETTE.navy });
      }
    });
    y -= h + 14;
  };

  // ── Titre de section avec signature tricolore ANELEC & motif ───────────────
  const dessinerTitreSection = (titre: string, couleur: Color = opts.accent) => {
    const h = 21;
    // Garantit au moins ~62 pt après le titre pour éviter un titre orphelin en bas de page
    place(h + 62);
    page.drawRectangle({ x: MARGE, y: y - h, width: LARGEUR, height: h, color: PALETTE.tableHeadBg });
    page.drawRectangle({ x: MARGE, y: y - h, width: 3.5, height: h, color: couleur });
    // Mini triptyque ANELEC (or / rouge / vert) rappelant l'emblème
    page.drawRectangle({ x: MARGE + 5, y: y - h + 4, width: 1.8, height: 13, color: PALETTE.brandGold, opacity: 0.85 });
    page.drawRectangle({ x: MARGE + 7.5, y: y - h + 4, width: 1.8, height: 13, color: PALETTE.brandCrimson, opacity: 0.85 });
    page.drawRectangle({ x: MARGE + 10, y: y - h + 4, width: 1.8, height: 13, color: PALETTE.emerald, opacity: 0.9 });
    page.drawText(sur(titre.toUpperCase(), gras), {
      x: MARGE + 17,
      y: y - 14,
      size: 9.2,
      font: gras,
      color: PALETTE.navy,
    });
    for (let d = 0; d < 4; d++) {
      page.drawCircle({
        x: MARGE + LARGEUR - 30 + d * 6,
        y: y - h / 2,
        size: 1.2,
        color: couleur,
        opacity: 0.2 + d * 0.14,
      });
    }
    y -= h + 8;
  };

  // ── Encadré texte multi-lignes avec pagination sûre ─────────────────────────
  const dessinerBlocTexte = (
    texte: string,
    o: { font?: PDFFont; taille?: number; fond?: Color; barreGauche?: Color; videMessage?: string } = {}
  ) => {
    const contenu = (texte || '').trim() || o.videMessage || '';
    if (!contenu) return;
    const f = o.font || police;
    const taille = o.taille || 9.8;
    const interligne = taille * 1.45;
    const padX = 12;
    const padY = 10;
    const lignes = decouper(contenu, f, taille, LARGEUR - 2 * padX);

    let idx = 0;
    while (idx < lignes.length) {
      const dispo = y - BAS_MIN - 2 * padY;
      const maxLignes = Math.max(1, Math.floor(dispo / interligne));
      const tranche = lignes.slice(idx, idx + maxLignes);
      const boxH = tranche.length * interligne + 2 * padY;
      if (y - boxH < BAS_MIN) {
        nouvellePage();
        continue;
      }
      const top = y;
      page.drawRectangle({
        x: MARGE,
        y: top - boxH,
        width: LARGEUR,
        height: boxH,
        color: o.fond || PALETTE.white,
        borderColor: PALETTE.border,
        borderWidth: 0.7,
      });
      if (o.barreGauche) {
        page.drawRectangle({ x: MARGE, y: top - boxH, width: 3.5, height: boxH, color: o.barreGauche });
      }
      let ly = top - padY - taille;
      for (const l of tranche) {
        if (l) page.drawText(l, { x: MARGE + padX + (o.barreGauche ? 3 : 0), y: ly, size: taille, font: f, color: PALETTE.slateDark });
        ly -= interligne;
      }
      y -= boxH + 10;
      idx += tranche.length;
    }
  };

  // ── Liste d'actions / prestations avec coche vectorielle sur 2 colonnes ────
  const dessinerListeActions = (actions: string[], couleur: Color = opts.accent) => {
    if (!actions.length) return;
    const gap = 10;
    const colW = (LARGEUR - gap) / 2;
    const textW = colW - 22;

    for (let i = 0; i < actions.length; i += 2) {
      const gLines = decouper(actions[i], police, 9.2, textW);
      const dLines = actions[i + 1] ? decouper(actions[i + 1], police, 9.2, textW) : [];
      const rowH = Math.max(gLines.length, dLines.length) * 13 + 8;
      place(rowH + 4);
      const top = y;

      const drawItem = (lines: string[], x: number) => {
        page.drawRectangle({
          x,
          y: top - rowH + 4,
          width: colW,
          height: rowH - 2,
          color: PALETTE.surface,
          borderColor: PALETTE.border,
          borderWidth: 0.5,
        });
        // Case cochée vectorielle (zéro caractère Unicode non supporté)
        const bx = x + 7;
        const by = top - 15;
        page.drawRectangle({ x: bx, y: by, width: 9, height: 9, color: couleur });
        page.drawLine({ start: { x: bx + 2, y: by + 4.5 }, end: { x: bx + 4, y: by + 2.3 }, thickness: 1.3, color: PALETTE.white });
        page.drawLine({ start: { x: bx + 4, y: by + 2.3 }, end: { x: bx + 7.2, y: by + 6.8 }, thickness: 1.3, color: PALETTE.white });
        let ty = top - 14;
        for (const l of lines) {
          page.drawText(l, { x: x + 21, y: ty, size: 9.2, font: police, color: PALETTE.slateDark });
          ty -= 13;
        }
      };

      drawItem(gLines, MARGE);
      if (actions[i + 1]) drawItem(dLines, MARGE + colW + gap);
      y -= rowH + 2;
    }
    y -= 6;
  };

  // ── Tableau financier devis + encadré Net TTC ──────────────────────────────
  const dessinerTableauChiffrage = (o: {
    designation: string;
    corpsEtat?: string | null;
    tauxTVA?: number | null;
    montantHt: number;
    montantTtc?: number | null;
  }) => {
    const colWidths = [275, 110, 50, LARGEUR - 435]; // Total = LARGEUR
    const desLines = decouper(o.designation || 'Travaux selon descriptif', police, 9.5, colWidths[0] - 16);
    const bodyH = Math.max(32, desLines.length * 13 + 14);
    const headerH = 22;
    const tvaMontant = o.tauxTVA != null ? Math.round(o.montantHt * (o.tauxTVA / 100) * 100) / 100 : null;
    const recapH = o.tauxTVA != null ? 72 : 52;

    place(headerH + bodyH + recapH + 22);

    // En-tête tableau (bleu clair doux, lisible à l'écran et à l'impression)
    const top = y;
    page.drawRectangle({
      x: MARGE,
      y: top - headerH,
      width: LARGEUR,
      height: headerH,
      color: PALETTE.tableHeadBg,
      borderColor: PALETTE.tableHeadBorder,
      borderWidth: 0.7,
    });
    page.drawRectangle({ x: MARGE, y: top - headerH, width: LARGEUR, height: 1.8, color: PALETTE.headerBg });
    const headers = ['DESIGNATION DES PRESTATIONS', "CORPS D'ETAT", 'TVA', 'MONTANT HT'];
    let hx = MARGE;
    headers.forEach((h, i) => {
      const txt = sur(h, gras);
      if (i >= 2) {
        const tw = gras.widthOfTextAtSize(txt, 7.8);
        page.drawText(txt, { x: hx + colWidths[i] - tw - 8, y: top - 14, size: 7.8, font: gras, color: PALETTE.navy });
      } else {
        page.drawText(txt, { x: hx + 8, y: top - 14, size: 7.8, font: gras, color: PALETTE.navy });
      }
      hx += colWidths[i];
    });

    // Ligne principale
    const rowTop = top - headerH;
    page.drawRectangle({
      x: MARGE,
      y: rowTop - bodyH,
      width: LARGEUR,
      height: bodyH,
      color: PALETTE.white,
      borderColor: PALETTE.border,
      borderWidth: 0.7,
    });
    let ly = rowTop - 15;
    for (const l of desLines) {
      page.drawText(l, { x: MARGE + 8, y: ly, size: 9.5, font: police, color: PALETTE.slateDark });
      ly -= 13;
    }
    const ceTxt = decouper(o.corpsEtat || '-', police, 8.8, colWidths[1] - 12)[0] || '-';
    page.drawText(ceTxt, { x: MARGE + colWidths[0] + 8, y: rowTop - 15, size: 8.8, font: police, color: PALETTE.slateDark });

    const tvaStr = o.tauxTVA != null ? `${o.tauxTVA} %` : '-';
    const tvaW = police.widthOfTextAtSize(tvaStr, 8.8);
    page.drawText(tvaStr, {
      x: MARGE + colWidths[0] + colWidths[1] + colWidths[2] - tvaW - 8,
      y: rowTop - 15,
      size: 8.8,
      font: police,
      color: PALETTE.slateDark,
    });

    const htStr = euroPdf(o.montantHt);
    const htW = gras.widthOfTextAtSize(htStr, 9.5);
    page.drawText(htStr, {
      x: MARGE + LARGEUR - htW - 8,
      y: rowTop - 15,
      size: 9.5,
      font: gras,
      color: PALETTE.navy,
    });

    y = rowTop - bodyH - 10;

    // Bloc totaux aligné à droite
    const boxW = 236;
    const bx = MARGE + LARGEUR - boxW;
    const tTop = y;
    const rows: Array<{ label: string; val: string; highlight?: boolean }> = [{ label: 'Total HT', val: euroPdf(o.montantHt) }];
    if (o.tauxTVA != null && tvaMontant != null) {
      rows.push({ label: `TVA (${o.tauxTVA} %)`, val: euroPdf(tvaMontant) });
    }
    if (o.montantTtc != null) {
      rows.push({ label: 'NET A PAYER TTC', val: euroPdf(o.montantTtc), highlight: true });
    }

    let ry = tTop;
    for (const r of rows) {
      const rh = r.highlight ? 26 : 20;
      page.drawRectangle({
        x: bx,
        y: ry - rh,
        width: boxW,
        height: rh,
        color: r.highlight ? PALETTE.headerBg : PALETTE.surface,
        borderColor: r.highlight ? PALETTE.headerBg : PALETTE.border,
        borderWidth: 0.7,
      });
      const lblF = r.highlight ? gras : police;
      const lblS = r.highlight ? 10 : 9;
      const valS = r.highlight ? 11 : 9.5;
      const fg = r.highlight ? PALETTE.white : PALETTE.slateDark;
      page.drawText(sur(r.label, lblF), { x: bx + 10, y: ry - (rh / 2 + lblS / 2.5), size: lblS, font: lblF, color: fg });
      const vw = gras.widthOfTextAtSize(r.val, valS);
      page.drawText(r.val, { x: bx + boxW - vw - 10, y: ry - (rh / 2 + valS / 2.5), size: valS, font: gras, color: fg });
      ry -= rh;
    }
    y = ry - 14;
  };

  // ── Grille photos 2 colonnes avec pastille catégorie & légende ─────────────
  const dessinerGrillePhotos = async (photos: PhotoPdf[], titre = `DOSSIER PHOTOGRAPHIQUE (${photos.length})`) => {
    if (!photos.length) return;
    dessinerTitreSection(titre);
    const gap = 12;
    const cardW = (LARGEUR - gap) / 2;
    const imgBoxH = 148;

    type CardPrepped = {
      ph: PhotoPdf;
      img: PDFImage | null;
      capLines: string[];
      capH: number;
    };
    const cards: CardPrepped[] = [];
    for (const ph of photos) {
      let img: PDFImage | null = null;
      try {
        const opt = await optimiserPhotoPourPdf(ph.octets, ph.type);
        if (opt.type === 'jpeg') img = await pdf.embedJpg(opt.octets);
        else if (opt.type === 'png') img = await pdf.embedPng(opt.octets);
      } catch {
        img = null;
      }
      const cap = (ph.caption || '').trim() || 'Observation terrain jointe au dossier';
      const capLines = decouper(cap, police, 8.3, cardW - 16).slice(0, 3);
      cards.push({ ph, img, capLines, capH: Math.max(24, capLines.length * 11 + 10) });
    }

    for (let i = 0; i < cards.length; i += 2) {
      const c1 = cards[i];
      const c2 = cards[i + 1] || null;
      const headerStrip = 20;
      const capAreaH = Math.max(c1.capH, c2?.capH ?? 0);
      const cardH = headerStrip + imgBoxH + capAreaH;
      place(cardH + 10);

      const drawCard = (c: CardPrepped, x: number) => {
        const top = y;
        // Cadre complet
        page.drawRectangle({
          x,
          y: top - cardH,
          width: cardW,
          height: cardH,
          color: PALETTE.white,
          borderColor: PALETTE.border,
          borderWidth: 0.8,
        });
        // Bandeau haut catégorie
        page.drawRectangle({ x, y: top - headerStrip, width: cardW, height: headerStrip, color: PALETTE.tintHeader });
        const cat = pillCouleurPhoto(c.ph.category);
        const catTxt = sur(cat.label, gras);
        const pw = Math.min(cardW - 16, gras.widthOfTextAtSize(catTxt, 7.2) + 12);
        page.drawRectangle({ x: x + 6, y: top - 16, width: pw, height: 12, color: cat.bg });
        page.drawText(catTxt, { x: x + 12, y: top - 12.5, size: 7.2, font: gras, color: cat.fg });

        // Image centrée dans son cadre
        const stageTop = top - headerStrip;
        const innerW = cardW - 12;
        const innerH = imgBoxH - 10;
        if (c.img) {
          const sc = Math.min(innerW / c.img.width, innerH / c.img.height, 1.5);
          const w = c.img.width * sc;
          const h = c.img.height * sc;
          const ix = x + 6 + (innerW - w) / 2;
          const iy = stageTop - imgBoxH + (imgBoxH - h) / 2;
          page.drawImage(c.img, { x: ix, y: iy, width: w, height: h });
        } else {
          page.drawRectangle({ x: x + 8, y: stageTop - imgBoxH + 6, width: innerW - 4, height: innerH, color: PALETTE.surface });
          page.drawText(sur('Apercu non integrable (visible via lien client)', police), {
            x: x + 18,
            y: stageTop - imgBoxH / 2,
            size: 8,
            font: police,
            color: PALETTE.slate,
          });
        }

        // Pied de carte : légende
        page.drawLine({
          start: { x, y: stageTop - imgBoxH },
          end: { x: x + cardW, y: stageTop - imgBoxH },
          thickness: 0.6,
          color: PALETTE.border,
        });
        let ly = stageTop - imgBoxH - 12;
        for (const l of c.capLines) {
          page.drawText(l, { x: x + 8, y: ly, size: 8.3, font: police, color: PALETTE.slateDark });
          ly -= 11;
        }
      };

      drawCard(c1, MARGE);
      if (c2) drawCard(c2, MARGE + cardW + gap);
      y -= cardH + 10;
    }
  };

  // ── Zone de signatures & validation ────────────────────────────────────────
  const dessinerSignatures = (o: {
    titreGauche: string;
    detailGauche: string[];
    titreDroite: string;
    detailDroite: string[];
    mentionLegale: string;
  }) => {
    const gap = 12;
    const boxW = (LARGEUR - gap) / 2;
    const boxH = 74;
    place(boxH + 34);

    const drawBox = (titre: string, details: string[], x: number) => {
      const top = y;
      page.drawRectangle({
        x,
        y: top - boxH,
        width: boxW,
        height: boxH,
        color: PALETTE.surface,
        borderColor: PALETTE.border,
        borderWidth: 0.7,
      });
      page.drawText(sur(titre.toUpperCase(), gras), { x: x + 10, y: top - 14, size: 7.5, font: gras, color: PALETTE.slate });
      let ly = top - 27;
      for (const d of details.filter(Boolean).slice(0, 3)) {
        for (const l of decouper(d, police, 8.2, boxW - 20).slice(0, 1)) {
          page.drawText(l, { x: x + 10, y: ly, size: 8.2, font: police, color: PALETTE.slateDark });
          ly -= 11;
        }
      }
      page.drawLine({
        start: { x: x + 10, y: top - boxH + 14 },
        end: { x: x + boxW - 10, y: top - boxH + 14 },
        thickness: 0.5,
        color: PALETTE.border,
      });
    };

    drawBox(o.titreGauche, o.detailGauche, MARGE);
    drawBox(o.titreDroite, o.detailDroite, MARGE + boxW + gap);
    y -= boxH + 8;

    for (const l of decouper(o.mentionLegale, police, 7.5, LARGEUR)) {
      page.drawText(l, { x: MARGE, y: y - 7.5, size: 7.5, font: police, color: PALETTE.slate });
      y -= 10;
    }
  };

  // ── Finalisation et pied de page sur toutes les pages ──────────────────────
  const finaliser = async (): Promise<Buffer> => {
    const pages = pdf.getPages();
    const gaucheParts = [opts.societe.nom];
    if (opts.societe.siret) gaucheParts.push(`SIRET ${opts.societe.siret}`);
    if (opts.societe.adresse) gaucheParts.push(opts.societe.adresse);
    const piedGauche = sur(gaucheParts.join('  -  '), police);

    pages.forEach((pg, i) => {
      // Vague nuage douce en pied de page en écho à l'en-tête
      const footCloudBack =
        'M 0 8 C 85 -2, 165 18, 250 6 C 340 -4, 425 18, 510 5 C 548 -1, 575 6, 596 9 L 596 46 L 0 46 Z';
      const footWaveLine =
        'M 0 9 C 85 -1, 165 19, 250 7 C 340 -3, 425 19, 510 6 C 548 0, 575 7, 596 10';
      pg.drawSvgPath(footCloudBack, { x: 0, y: 46, color: PALETTE.cloudSoft });
      pg.drawSvgPath(footWaveLine, { x: 0, y: 46, borderColor: PALETTE.cloudLine, borderWidth: 1.1 });

      const rightBrand = sur('ANELEC SUIVI TCE', police);
      const rightPage = sur(`  |  Page ${i + 1} / ${pages.length}`, police);
      const brandW = police.widthOfTextAtSize(rightBrand, 7.6);
      const pageW = police.widthOfTextAtSize(rightPage, 7.6);
      const rw = brandW + pageW;
      const iconW = markImg ? 10 : 0;
      const iconGap = markImg ? 4 : 0;
      const footLogoLeftX = A4.w - MARGE - rw - iconW - iconGap;
      const footLogoBlocW = iconW + iconGap + brandW;

      const maxLeftW = LARGEUR - (rw + iconW + iconGap + 18);
      const gLine = decouper(piedGauche, police, 7.6, maxLeftW)[0] || '';
      pg.drawText(gLine, { x: MARGE, y: 22.5, size: 7.6, font: police, color: PALETTE.slate });

      if (markImg) {
        pg.drawImage(markImg, { x: footLogoLeftX, y: 20, width: iconW, height: 10 });
      }
      pg.drawText(rightBrand, { x: footLogoLeftX + iconW + iconGap, y: 22.5, size: 7.6, font: police, color: PALETTE.navy });
      pg.drawText(rightPage, { x: footLogoLeftX + footLogoBlocW, y: 22.5, size: 7.6, font: police, color: PALETTE.slate });
      dessinerUrlBornee(pg, footLogoLeftX, footLogoBlocW, 11.5, PALETTE.headerBg, 6.4);
    });

    return sauvegarderPdfCompresse(pdf);
  };

  return {
    police,
    gras,
    dessinerDeuxColonnes,
    dessinerBandeauKpi,
    dessinerTitreSection,
    dessinerBlocTexte,
    dessinerListeActions,
    dessinerTableauChiffrage,
    dessinerGrillePhotos,
    dessinerSignatures,
    espacer: (px: number) => {
      y -= px;
    },
    finaliser,
  };
}
