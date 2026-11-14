// Génération automatique du PDF de devis (+ rapport/photos de visite technique si présent).
import { createPdfWriter, dateFrPdf, type PhotoPdf } from './pdfLayout.js';

export type ContenuDevisPdf = {
  reference: string;
  numeroDI?: string | null;
  client: string | null;
  site?: string | null;
  objet?: string | null;
  corpsEtat?: string | null;
  responsable?: string | null;
  statutCommercial?: string | null;
  dateEmission?: string | null;
  echeance?: string | null;
  validiteJours?: number | null;
  montantHt?: number | null;
  tauxTVA?: number | null;
  montantTtc?: number | null;
  notes?: string | null;
  visite?: {
    technicien?: string | null;
    dateVisite?: string | null;
    statut?: string | null;
    comptesRendus: string[];
  } | null;
};

const euro = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;

export async function genererPdfDevis(p: {
  societe: string;
  contenu: ContenuDevisPdf;
  photos: PhotoPdf[];
}): Promise<Buffer> {
  const c = p.contenu;
  const w = await createPdfWriter(`Devis ${c.reference}`);

  w.ecrire(p.societe, { taille: 11, font: w.gras, couleur: [0.39, 0.45, 0.55] });
  w.ecrire(`Devis ${c.reference}`, { taille: 20, font: w.gras, espace: 6 });

  w.ecrirePaires([
    ['Client / Donneur d’ordre', c.client],
    ['N° DI / Suivi', c.numeroDI],
    ['Site / Adresse', c.site],
    ["Corps d'état", c.corpsEtat],
    ['Chargé d’affaires', c.responsable],
    ['Date d’émission', dateFrPdf(c.dateEmission) || null],
    ['Validité', c.validiteJours ? `${c.validiteJours} jours` : null],
    ['Date limite / Échéance', dateFrPdf(c.echeance) || null],
  ]);

  if (c.objet) {
    w.ecrire('Objet / Description des travaux', { taille: 13, font: w.gras, espace: 2 });
    w.ecrire(c.objet, { taille: 10.5, espace: 8 });
  }

  if (c.montantHt != null) {
    w.ecrire('Chiffrage financier', { taille: 13, font: w.gras, espace: 2 });
    w.ecrire(`Montant HT : ${euro(c.montantHt)}`, { taille: 10.5 });
    if (c.tauxTVA != null) {
      const tvaMontant = Math.round(c.montantHt * (c.tauxTVA / 100) * 100) / 100;
      w.ecrire(`TVA (${c.tauxTVA} %) : ${euro(tvaMontant)}`, { taille: 10.5 });
    }
    if (c.montantTtc != null) {
      w.ecrire(`Total TTC : ${euro(c.montantTtc)}`, { taille: 11.5, font: w.gras });
    }
    w.espacer(8);
  }

  if (c.notes) {
    w.ecrire('Conditions et remarques', { taille: 13, font: w.gras, espace: 2 });
    w.ecrire(c.notes, { taille: 10.5, espace: 8 });
  }

  if (c.visite && (c.visite.comptesRendus.length > 0 || p.photos.length > 0)) {
    w.ecrire('Rapport de visite technique préalable', { taille: 13, font: w.gras, espace: 4 });
    w.ecrirePaires([
      ['Technicien visite', c.visite.technicien],
      ['Date de visite', dateFrPdf(c.visite.dateVisite) || null],
      ['Statut de visite', c.visite.statut],
    ]);
    for (const cr of c.visite.comptesRendus) {
      w.ecrire(cr, { taille: 10.5, espace: 6 });
    }
  }

  await w.ecrirePhotos(p.photos, `Photos de visite technique (${p.photos.length})`);
  return w.finaliser(`${p.societe} - ${c.reference}`);
}
