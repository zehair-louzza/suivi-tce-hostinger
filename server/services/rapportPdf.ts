// Génération du PDF professionnel du rapport d'intervention (pdf-lib, 100 % JS).
import type { ContenuRapport } from '../domain/rapportClient.js';
import {
  PALETTE,
  createDocumentPdf,
  dateFrPdf,
  type ClientPdfInfo,
  type LigneCarteInfo,
  type PhotoPdf,
  type SocietePdfInfo,
} from './pdfLayout.js';

export type { PhotoPdf };

export async function genererPdfRapport(p: {
  societe: string;
  societeInfo?: SocietePdfInfo;
  clientInfo?: ClientPdfInfo | null;
  contenu: ContenuRapport;
  photos: PhotoPdf[];
}): Promise<Buffer> {
  const c = p.contenu;
  const societeInfo: SocietePdfInfo = p.societeInfo || { nom: p.societe };
  const dateEdit = dateFrPdf(c.dateReelle || c.datePlanifiee) || dateFrPdf(new Date().toISOString().slice(0, 10));

  const doc = await createDocumentPdf({
    title: `Rapport d'intervention ${c.reference}`,
    societe: societeInfo,
    badgeType: "RAPPORT D'INTERVENTION",
    reference: c.reference,
    dateLigne: `Date : ${dateEdit}`,
    sousRefLigne: c.numeroDI ? `N° DI : ${c.numeroDI}` : null,
    accent: PALETTE.emerald,
  });

  // ── 1. Cartes Émetteur & Client / Site ─────────────────────────────────────
  const emetteurLignes: LigneCarteInfo[] = [];
  if (societeInfo.adresse) emetteurLignes.push({ value: societeInfo.adresse });
  if (societeInfo.siret) emetteurLignes.push({ label: 'SIRET', value: societeInfo.siret });
  if (societeInfo.email) emetteurLignes.push({ label: 'Contact', value: societeInfo.email });
  if (c.technicien) emetteurLignes.push({ label: 'Technicien intervenant', value: c.technicien, bold: true });
  emetteurLignes.push({ label: "Corps d'état", value: c.corpsEtat || 'Tous corps d’état' });

  const siteAffiche = c.site && c.chantier && c.site !== c.chantier ? `${c.chantier} - ${c.site}` : c.site || c.chantier || '';
  const clientLignes: LigneCarteInfo[] = [];
  if (p.clientInfo?.contact) clientLignes.push({ label: 'Interlocuteur', value: p.clientInfo.contact });
  if (p.clientInfo?.email) clientLignes.push({ label: 'E-mail', value: p.clientInfo.email });
  if (p.clientInfo?.telephone) clientLignes.push({ label: 'Tél.', value: p.clientInfo.telephone });
  if (siteAffiche) clientLignes.push({ label: "Site d'intervention", value: siteAffiche, bold: true });
  else if (p.clientInfo?.adresse) clientLignes.push({ label: 'Adresse client', value: p.clientInfo.adresse });
  if (c.numeroDI) clientLignes.push({ label: 'N° DI / Bon de commande', value: c.numeroDI });

  doc.dessinerDeuxColonnes(
    {
      titre: 'Émetteur / Prestataire',
      nomPrincipal: societeInfo.nom,
      lignes: emetteurLignes,
      fondTeinte: PALETTE.white,
      barreCouleur: PALETTE.navy,
    },
    {
      titre: 'Client & Site d’intervention',
      nomPrincipal: c.client || p.clientInfo?.nom || 'Client non renseigné',
      lignes: clientLignes,
      fondTeinte: PALETTE.surface,
      barreCouleur: PALETTE.emerald,
    }
  );

  // ── 2. Bandeau chronologie & statut ────────────────────────────────────────
  const horaire =
    c.heureDebutReelle && c.heureFinReelle
      ? `${c.heureDebutReelle} - ${c.heureFinReelle}`
      : c.heureDebutReelle || '';
  const realStr = [dateFrPdf(c.dateReelle) || dateFrPdf(c.datePlanifiee) || 'À confirmer', horaire]
    .filter(Boolean)
    .join('  •  ');
  const statutAffiche = c.statutRapport || 'Validé & Clôturé';
  const estValide = /valid|clotur|clôtur|envoy/i.test(statutAffiche);

  doc.dessinerBandeauKpi([
    { label: 'Type de mission', value: c.typeIntervention || 'Intervention technique' },
    { label: 'Date planifiée', value: dateFrPdf(c.datePlanifiee) || '-' },
    { label: 'Réalisation / Pointage', value: realStr },
    {
      label: 'Statut du rapport',
      value: statutAffiche,
      pillColor: estValide ? PALETTE.emeraldDark : PALETTE.blue,
    },
  ]);

  // ── 3. Objet de l'intervention ─────────────────────────────────────────────
  if (c.objet && c.objet !== siteAffiche) {
    doc.dessinerTitreSection("Objet de l'intervention", PALETTE.navy);
    doc.dessinerBlocTexte(c.objet, { fond: PALETTE.surface });
  }

  // ── 4. Prestations & actions réalisées ─────────────────────────────────────
  if (c.actionsRealisees.length > 0) {
    doc.dessinerTitreSection(`Prestations et actions réalisées (${c.actionsRealisees.length})`, PALETTE.emerald);
    doc.dessinerListeActions(c.actionsRealisees, PALETTE.emerald);
  }

  // ── 5. Compte-rendu technique détaillé ─────────────────────────────────────
  doc.dessinerTitreSection('Compte-rendu technique détaillé', PALETTE.navy);
  doc.dessinerBlocTexte(c.rapport, {
    fond: PALETTE.white,
    videMessage: 'Intervention réalisée conformément aux consignes techniques.',
  });

  // ── 6. Conclusion / Résultat technique ─────────────────────────────────────
  if (c.resultatTechnique) {
    doc.dessinerTitreSection('Conclusion & Résultat technique', PALETTE.emeraldDark);
    doc.dessinerBlocTexte(c.resultatTechnique, {
      font: doc.gras,
      fond: PALETTE.emeraldBg,
      barreGauche: PALETTE.emerald,
    });
  }

  // ── 7. Dossier photographique terrain (grille 2 colonnes) ──────────────────
  if (p.photos.length > 0) {
    await doc.dessinerGrillePhotos(p.photos, `Dossier photographique terrain (${p.photos.length})`);
  }

  // ── 8. Signatures & mentions de traçabilité ────────────────────────────────
  doc.espacer(4);
  doc.dessinerSignatures({
    titreGauche: 'Exécutant / Technicien',
    detailGauche: [
      `Société : ${societeInfo.nom}`,
      c.technicien ? `Intervenant : ${c.technicien}` : 'Validation technique interne',
      `Référence : ${c.reference}`,
    ],
    titreDroite: 'Validation client / Donneur d’ordre',
    detailDroite: [
      `Client : ${c.client || '-'}`,
      'Nom du signataire & qualité :',
      'Date et signature :',
    ],
    mentionLegale: `Rapport d'intervention horodaté édité par ${societeInfo.nom} via la plateforme ANELEC SUIVI TCE. Les photos et observations ci-dessus constituent le justificatif officiel de réalisation.`,
  });

  return doc.finaliser();
}
