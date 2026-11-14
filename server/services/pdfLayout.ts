// Socle commun de mise en page PDF (pdf-lib, 100 % JavaScript) pour rapports terrain et devis.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

export type PhotoPdf = { id: string; caption: string; category: string; octets: Buffer; type: string };

export const A4 = { w: 595.28, h: 841.89 };
export const MARGE = 48;

/** Les polices standard PDF ne gèrent pas tous les caractères Unicode : normalisation sûre en WinAnsi. */
export function sur(texte: string, font: PDFFont): string {
  const t = String(texte ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/€|EUR/g, (m) => m)
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

export async function createPdfWriter(title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setProducer('ANELEC TCE');
  pdf.setCreator('ANELEC TCE');
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const largeur = A4.w - 2 * MARGE;

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGE;

  const nouvellePage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - MARGE;
  };

  const place = (hauteur: number) => {
    if (y - hauteur < MARGE) nouvellePage();
  };

  const ecrire = (
    texte: string,
    o: { taille?: number; font?: PDFFont; couleur?: [number, number, number]; espace?: number } = {}
  ) => {
    const taille = o.taille ?? 10.5;
    const font = o.font ?? police;
    const interligne = taille * 1.4;
    for (const l of decouper(texte, font, taille, largeur)) {
      place(interligne);
      if (l) {
        page.drawText(l, {
          x: MARGE,
          y: y - taille,
          size: taille,
          font,
          color: rgb(...(o.couleur ?? [0.06, 0.09, 0.16])),
        });
      }
      y -= interligne;
    }
    y -= o.espace ?? 0;
  };

  const ecrirePaires = (infos: Array<[string, string | null | undefined]>) => {
    for (const [libelle, valeur] of infos) {
      if (!valeur) continue;
      ecrire(`${libelle} : ${valeur}`, { taille: 10.5 });
    }
    y -= 8;
  };

  const ecrirePhotos = async (photos: PhotoPdf[], titre = `Photos (${photos.length})`) => {
    if (!photos.length) return;
    ecrire(titre, { taille: 13, font: gras, espace: 4 });
    for (const ph of photos) {
      let img: PDFImage | null = null;
      try {
        if (ph.type === 'jpeg') img = await pdf.embedJpg(ph.octets);
        else if (ph.type === 'png') img = await pdf.embedPng(ph.octets);
      } catch {
        img = null;
      }
      const legende = [ph.category, ph.caption].filter(Boolean).join(' — ');
      if (!img) {
        ecrire(`[Photo ${legende || ph.id} : format non intégré à ce PDF, visible sur la page du lien]`, {
          taille: 9,
          couleur: [0.39, 0.45, 0.55],
          espace: 4,
        });
        continue;
      }
      const maxH = 300;
      const echelle = Math.min(largeur / img.width, maxH / img.height, 1);
      const w = img.width * echelle;
      const h = img.height * echelle;
      place(h + 26);
      page.drawImage(img, { x: MARGE, y: y - h, width: w, height: h });
      y -= h + 4;
      if (legende) ecrire(legende, { taille: 9, couleur: [0.39, 0.45, 0.55] });
      y -= 8;
    }
  };

  const finaliser = async (piedTexte: string): Promise<Buffer> => {
    const pages = pdf.getPages();
    pages.forEach((pg, i) => {
      pg.drawText(sur(`${piedTexte} - page ${i + 1}/${pages.length}`, police), {
        x: MARGE,
        y: 24,
        size: 8,
        font: police,
        color: rgb(0.58, 0.64, 0.72),
      });
    });
    return Buffer.from(await pdf.save());
  };

  return {
    police,
    gras,
    ecrire,
    ecrirePaires,
    ecrirePhotos,
    espacer: (px: number) => {
      y -= px;
    },
    finaliser,
  };
}
