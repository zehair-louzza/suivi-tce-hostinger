// Génération automatique du PDF professionnel de devis (+ visite technique et photos si présentes).
import {
  PALETTE,
  createDocumentPdf,
  dateFrPdf,
  type ClientPdfInfo,
  type LigneCarteInfo,
  type PhotoPdf,
  type SocietePdfInfo,
} from './pdfLayout.js';

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

export async function genererPdfDevis(p: {
  societe: string;
  societeInfo?: SocietePdfInfo;
  clientInfo?: ClientPdfInfo | null;
  contenu: ContenuDevisPdf;
  photos: PhotoPdf[];
}): Promise<Buffer> {
  const c = p.contenu;
  const societeInfo: SocietePdfInfo = p.societeInfo || { nom: p.societe };
  const dateEm = dateFrPdf(c.dateEmission) || dateFrPdf(new Date().toISOString().slice(0, 10));

  const doc = await createDocumentPdf({
    title: `Devis ${c.reference}`,
    societe: societeInfo,
    badgeType: 'DEVIS COMMERCIAL',
    reference: c.reference,
    dateLigne: `Émis le ${dateEm}`,
    sousRefLigne: c.numeroDI ? `N° DI : ${c.numeroDI}` : null,
    accent: PALETTE.blue,
  });

  // ── 1. Cartes Émetteur & Client / Chantier ─────────────────────────────────
  const emetteurLignes: LigneCarteInfo[] = [];
  if (societeInfo.adresse) emetteurLignes.push({ value: societeInfo.adresse });
  if (societeInfo.siret) emetteurLignes.push({ label: 'SIRET', value: societeInfo.siret });
  if (societeInfo.email) emetteurLignes.push({ label: 'Contact', value: societeInfo.email });
  if (c.responsable) emetteurLignes.push({ label: 'Chargé d’affaires', value: c.responsable, bold: true });
  if (c.corpsEtat) emetteurLignes.push({ label: "Corps d'état", value: c.corpsEtat });

  const clientLignes: LigneCarteInfo[] = [];
  if (p.clientInfo?.contact) clientLignes.push({ label: 'Interlocuteur', value: p.clientInfo.contact });
  if (p.clientInfo?.email) clientLignes.push({ label: 'E-mail', value: p.clientInfo.email });
  if (p.clientInfo?.telephone) clientLignes.push({ label: 'Tél.', value: p.clientInfo.telephone });
  if (c.site) clientLignes.push({ label: 'Site des travaux', value: c.site, bold: true });
  else if (p.clientInfo?.adresse) clientLignes.push({ label: 'Adresse client', value: p.clientInfo.adresse });
  if (c.numeroDI) clientLignes.push({ label: 'N° DI / Suivi', value: c.numeroDI });

  doc.dessinerDeuxColonnes(
    {
      titre: 'Émetteur / Prestataire',
      nomPrincipal: societeInfo.nom,
      lignes: emetteurLignes,
      fondTeinte: PALETTE.white,
      barreCouleur: PALETTE.navy,
    },
    {
      titre: 'Client / Donneur d’ordre',
      nomPrincipal: c.client || p.clientInfo?.nom || 'Client non renseigné',
      lignes: clientLignes,
      fondTeinte: PALETTE.surface,
      barreCouleur: PALETTE.blue,
    }
  );

  // ── 2. Bandeau dates & validité ────────────────────────────────────────────
  const statutDevis = c.statutCommercial || 'Proposition commerciale';
  const badgeCouleur = /accept/i.test(statutDevis)
    ? PALETTE.emeraldDark
    : /refus|annul|expir/i.test(statutDevis)
    ? PALETTE.amberDark
    : PALETTE.blue;

  doc.dessinerBandeauKpi([
    { label: "Date d'émission", value: dateEm },
    { label: 'Durée de validité', value: c.validiteJours ? `${c.validiteJours} jours` : '30 jours' },
    { label: 'Échéance souhaitée', value: dateFrPdf(c.echeance) || '-' },
    { label: 'Statut', value: statutDevis, pillColor: badgeCouleur },
  ]);

  // ── 3. Objet / Descriptif détaillé des travaux ─────────────────────────────
  if (c.objet) {
    doc.dessinerTitreSection('Objet et descriptif des travaux', PALETTE.navy);
    doc.dessinerBlocTexte(c.objet, { fond: PALETTE.white });
  }

  // ── 4. Tableau de chiffrage financier ──────────────────────────────────────
  if (c.montantHt != null) {
    doc.dessinerTitreSection('Chiffrage financier détaillé', PALETTE.blue);
    doc.dessinerTableauChiffrage({
      designation: c.objet || `Prestation ${c.corpsEtat || 'Tous corps d’état'} — ${c.site || c.reference}`,
      corpsEtat: c.corpsEtat,
      tauxTVA: c.tauxTVA,
      montantHt: c.montantHt,
      montantTtc: c.montantTtc,
    });
  }

  // ── 5. Conditions et remarques ─────────────────────────────────────────────
  if (c.notes) {
    doc.dessinerTitreSection('Conditions, délais et remarques', PALETTE.navy);
    doc.dessinerBlocTexte(c.notes, { fond: PALETTE.surface });
  }

  // ── 6. Rapport de visite technique préalable (+ photos) ────────────────────
  if (c.visite && (c.visite.comptesRendus.length > 0 || p.photos.length > 0)) {
    doc.dessinerTitreSection('Rapport de visite technique préalable', PALETTE.violetDark);
    doc.dessinerBandeauKpi([
      { label: 'Technicien visite', value: c.visite.technicien || '-' },
      { label: 'Date de visite', value: dateFrPdf(c.visite.dateVisite) || '-' },
      { label: 'Statut visite', value: c.visite.statut || 'Réalisée', pillColor: PALETTE.violetDark },
    ]);
    if (c.visite.comptesRendus.length > 0) {
      doc.dessinerBlocTexte(c.visite.comptesRendus.join('\n\n'), {
        fond: PALETTE.white,
        barreGauche: PALETTE.violetDark,
      });
    }
    if (p.photos.length > 0) {
      await doc.dessinerGrillePhotos(p.photos, `Photos de visite technique (${p.photos.length})`);
    }
  }

  // ── 7. Accord client & mentions légales ────────────────────────────────────
  doc.espacer(4);
  doc.dessinerSignatures({
    titreGauche: 'Pour le prestataire',
    detailGauche: [
      `Société : ${societeInfo.nom}`,
      c.responsable ? `Chargé d'affaires : ${c.responsable}` : 'Direction Commerciale',
      `Devis ${c.reference}`,
    ],
    titreDroite: 'Bon pour accord et exécution du devis',
    detailDroite: [
      `Client : ${c.client || '-'}`,
      'Mention "Bon pour accord", date & cachet :',
      'Signature :',
    ],
    mentionLegale: `Devis valable ${c.validiteJours || 30} jours à compter du ${dateEm}. Édité par ${societeInfo.nom} via la plateforme ANELEC SUIVI TCE. La validation électronique ou manuscrite vaut acceptation des conditions et du chiffrage ci-dessus.`,
  });

  return doc.finaliser();
}
