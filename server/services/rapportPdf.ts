// Génération du PDF du rapport d'intervention (pdf-lib : 100 % JavaScript, aucune dépendance système).
// Le PDF est figé à l'envoi : le client voit exactement ce qui a été validé en interne.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { ContenuRapport } from '../domain/rapportClient.js';

export type PhotoPdf = { id: string; caption: string; category: string; octets: Buffer; type: string };

const A4 = { w: 595.28, h: 841.89 };
const MARGE = 48;

/** Les polices standard PDF ne gèrent pas tous les caractères Unicode : on remplace ce qui ne passe pas en WinAnsi. */
function sur(texte: string, font: PDFFont): string {
  const t = String(texte ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/ /g, ' ')
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

function decouper(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
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
      // mot plus long qu'une ligne : coupé
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

const dateFr = (iso: string | null) => (iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : '')).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'long', year: 'numeric' }) : '');

export async function genererPdfRapport(p: { societe: string; contenu: ContenuRapport; photos: PhotoPdf[] }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rapport d'intervention ${p.contenu.reference}`);
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
  const ecrire = (texte: string, o: { taille?: number; font?: PDFFont; couleur?: [number, number, number]; espace?: number } = {}) => {
    const taille = o.taille ?? 10.5;
    const font = o.font ?? police;
    const interligne = taille * 1.4;
    for (const l of decouper(texte, font, taille, largeur)) {
      place(interligne);
      if (l) page.drawText(l, { x: MARGE, y: y - taille, size: taille, font, color: rgb(...(o.couleur ?? [0.06, 0.09, 0.16])) });
      y -= interligne;
    }
    y -= o.espace ?? 0;
  };

  ecrire(p.societe, { taille: 11, font: gras, couleur: [0.39, 0.45, 0.55] });
  ecrire(`Rapport d'intervention ${p.contenu.reference}`, { taille: 20, font: gras, espace: 6 });

  const infos: Array<[string, string | null]> = [
    ['Client', p.contenu.client],
    ['Intervention', p.contenu.chantier],
    ['Site', p.contenu.site],
    ['Objet', p.contenu.objet],
    ['Corps d\'état', p.contenu.corpsEtat],
    ['Type', p.contenu.typeIntervention],
    ['Date prévue', dateFr(p.contenu.datePlanifiee) || null],
    ['Date de réalisation', dateFr(p.contenu.dateReelle) || null],
  ];
  for (const [libelle, valeur] of infos) {
    if (!valeur) continue;
    ecrire(`${libelle} : ${valeur}`, { taille: 10.5 });
  }
  y -= 8;

  if (p.contenu.actionsRealisees.length) {
    ecrire('Actions réalisées', { taille: 13, font: gras, espace: 2 });
    for (const a of p.contenu.actionsRealisees) ecrire(`- ${a}`, { taille: 10.5 });
    y -= 8;
  }
  if (p.contenu.rapport) {
    ecrire('Compte rendu', { taille: 13, font: gras, espace: 2 });
    ecrire(p.contenu.rapport, { taille: 10.5, espace: 8 });
  }

  if (p.photos.length) {
    ecrire(`Photos (${p.photos.length})`, { taille: 13, font: gras, espace: 4 });
    for (const ph of p.photos) {
      let img: PDFImage | null = null;
      try {
        if (ph.type === 'jpeg') img = await pdf.embedJpg(ph.octets);
        else if (ph.type === 'png') img = await pdf.embedPng(ph.octets);
      } catch {
        img = null;
      }
      const legende = [ph.category, ph.caption].filter(Boolean).join(' — ');
      if (!img) {
        // webp / gif : non intégrables au PDF (restent visibles sur la page du lien)
        ecrire(`[Photo ${legende || ph.id} : format non intégré à ce PDF, visible sur la page du rapport]`, { taille: 9, couleur: [0.39, 0.45, 0.55], espace: 4 });
        continue;
      }
      const maxL = largeur;
      const maxH = 300;
      const echelle = Math.min(maxL / img.width, maxH / img.height, 1);
      const w = img.width * echelle;
      const h = img.height * echelle;
      place(h + 26);
      page.drawImage(img, { x: MARGE, y: y - h, width: w, height: h });
      y -= h + 4;
      if (legende) ecrire(legende, { taille: 9, couleur: [0.39, 0.45, 0.55] });
      y -= 8;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    pg.drawText(sur(`${p.societe} - ${p.contenu.reference} - page ${i + 1}/${pages.length}`, police), {
      x: MARGE, y: 24, size: 8, font: police, color: rgb(0.58, 0.64, 0.72),
    });
  });
  return Buffer.from(await pdf.save());
}
