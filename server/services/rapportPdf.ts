// Génération du PDF du rapport d'intervention (pdf-lib : 100 % JavaScript, aucune dépendance système).
// Le PDF est figé à l'envoi : le client voit exactement ce qui a été validé en interne.
import type { ContenuRapport } from '../domain/rapportClient.js';
import { createPdfWriter, dateFrPdf, type PhotoPdf } from './pdfLayout.js';

export type { PhotoPdf };

export async function genererPdfRapport(p: { societe: string; contenu: ContenuRapport; photos: PhotoPdf[] }): Promise<Buffer> {
  const w = await createPdfWriter(`Rapport d'intervention ${p.contenu.reference}`);

  w.ecrire(p.societe, { taille: 11, font: w.gras, couleur: [0.39, 0.45, 0.55] });
  w.ecrire(`Rapport d'intervention ${p.contenu.reference}`, { taille: 20, font: w.gras, espace: 6 });

  w.ecrirePaires([
    ['Client', p.contenu.client],
    ['Intervention', p.contenu.chantier],
    ['Site', p.contenu.site],
    ['Objet', p.contenu.objet],
    ["Corps d'état", p.contenu.corpsEtat],
    ['Type', p.contenu.typeIntervention],
    ['Date prévue', dateFrPdf(p.contenu.datePlanifiee) || null],
    ['Date de réalisation', dateFrPdf(p.contenu.dateReelle) || null],
  ]);

  if (p.contenu.actionsRealisees.length) {
    w.ecrire('Actions réalisées', { taille: 13, font: w.gras, espace: 2 });
    for (const a of p.contenu.actionsRealisees) w.ecrire(`- ${a}`, { taille: 10.5 });
    w.espacer(8);
  }
  if (p.contenu.rapport) {
    w.ecrire('Compte rendu', { taille: 13, font: w.gras, espace: 2 });
    w.ecrire(p.contenu.rapport, { taille: 10.5, espace: 8 });
  }

  await w.ecrirePhotos(p.photos);
  return w.finaliser(`${p.societe} - ${p.contenu.reference}`);
}
