// Génération du PDF interne : Rapport de Visite Technique Préalable (définition technique & préparation du devis).
import type { VisiteRapportInterne } from '../../shared/types.js';
import {
  PALETTE,
  createDocumentPdf,
  dateFrPdf,
  type ClientPdfInfo,
  type LigneCarteInfo,
  type PhotoPdf,
  type SocietePdfInfo,
} from './pdfLayout.js';

export type ContenuVisiteTechniquePdf = {
  reference: string;
  numeroDI?: string | null;
  client: string | null;
  site?: string | null;
  objet?: string | null;
  corpsEtat?: string | null;
  responsable?: string | null;
  technicien?: string | null;
  dateVisite?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
  statutVisite?: string | null;
  rapport: VisiteRapportInterne;
  comptesRendusTerrain?: string[];
};

export async function genererPdfVisiteTechnique(p: {
  societe: string;
  societeInfo?: SocietePdfInfo;
  clientInfo?: ClientPdfInfo | null;
  contenu: ContenuVisiteTechniquePdf;
  photos: PhotoPdf[];
}): Promise<Buffer> {
  const c = p.contenu;
  const societeInfo: SocietePdfInfo = p.societeInfo || { nom: p.societe };
  const dateVisiteStr = dateFrPdf(c.dateVisite) || dateFrPdf(c.rapport.redigeLe) || dateFrPdf(new Date().toISOString().slice(0, 10));

  const doc = await createDocumentPdf({
    title: `Rapport de visite technique préalable — ${c.reference}`,
    societe: societeInfo,
    badgeType: 'VISITE TECHNIQUE INTERNE',
    reference: c.reference,
    dateLigne: `Visite du ${dateVisiteStr}`,
    sousRefLigne: c.numeroDI ? `N° DI : ${c.numeroDI}` : null,
    accent: PALETTE.violetDark,
  });

  // Bandeau d'avertissement usage interne
  doc.dessinerBlocTexte(
    'DOCUMENT INTERNE — DEFINITION TECHNIQUE & PREPARATION DU DEVIS. Destiné exclusivement au bureau d’études et au chiffrage avant rédaction du devis commercial.',
    {
      font: doc.gras,
      taille: 8.8,
      fond: PALETTE.violetBg,
      barreGauche: PALETTE.violetDark,
    }
  );

  // ── 1. Cartes Équipe Études & Site à étudier ──────────────────────────────
  const emetteurLignes: LigneCarteInfo[] = [];
  if (societeInfo.adresse) emetteurLignes.push({ value: societeInfo.adresse });
  if (c.responsable) emetteurLignes.push({ label: 'Chargé d’affaires / études', value: c.responsable, bold: true });
  if (c.technicien || c.rapport.redigePar) {
    emetteurLignes.push({ label: 'Visiteur / Rédacteur', value: c.rapport.redigePar || c.technicien || '', bold: true });
  }
  if (c.corpsEtat) emetteurLignes.push({ label: "Corps d'état", value: c.corpsEtat });

  const clientLignes: LigneCarteInfo[] = [];
  if (p.clientInfo?.contact) clientLignes.push({ label: 'Interlocuteur sur site', value: p.clientInfo.contact });
  if (p.clientInfo?.telephone) clientLignes.push({ label: 'Tél.', value: p.clientInfo.telephone });
  if (p.clientInfo?.email) clientLignes.push({ label: 'E-mail', value: p.clientInfo.email });
  if (c.site) clientLignes.push({ label: 'Site à étudier', value: c.site, bold: true });
  else if (p.clientInfo?.adresse) clientLignes.push({ label: 'Adresse client', value: p.clientInfo.adresse });
  if (c.numeroDI) clientLignes.push({ label: 'N° DI / Suivi', value: c.numeroDI });

  doc.dessinerDeuxColonnes(
    {
      titre: 'Usage Interne — Études & Relevé',
      nomPrincipal: societeInfo.nom,
      lignes: emetteurLignes,
      fondTeinte: PALETTE.white,
      barreCouleur: PALETTE.navy,
    },
    {
      titre: 'Client & Site à Chiffrer',
      nomPrincipal: c.client || p.clientInfo?.nom || 'Client non renseigné',
      lignes: clientLignes,
      fondTeinte: PALETTE.surface,
      barreCouleur: PALETTE.violetDark,
    }
  );

  // ── 2. Bandeau synthèse visite ─────────────────────────────────────────────
  const creneau =
    c.heureDebut && c.heureFin ? `${c.heureDebut} - ${c.heureFin}` : c.heureDebut || 'Non précisé';
  const statutV = c.statutVisite || 'Réalisée';
  const badgeCouleur = /term|réalis|effect/i.test(statutV) ? PALETTE.emeraldDark : PALETTE.violetDark;

  doc.dessinerBandeauKpi([
    { label: 'Date de visite', value: dateVisiteStr },
    { label: 'Créneau sur site', value: creneau },
    { label: 'Durée / Effectif est.', value: c.rapport.estimationDuree || 'À évaluer au chiffrage' },
    { label: 'Statut visite', value: statutV, pillColor: badgeCouleur },
  ]);

  // ── 3. Objet de la demande ─────────────────────────────────────────────────
  if (c.objet) {
    doc.dessinerTitreSection('Objet de la demande & périmètre', PALETTE.navy);
    doc.dessinerBlocTexte(c.objet, { fond: PALETTE.white });
  }

  // ── 4. Constat terrain & relevé technique ──────────────────────────────────
  const extraCr = (c.comptesRendusTerrain || []).filter(
    (txt) => txt && txt.trim() && txt.trim() !== (c.rapport.constatTechnique || '').trim()
  );
  const constatComplet = [c.rapport.constatTechnique, ...extraCr].filter(Boolean).join('\n\n');
  doc.dessinerTitreSection('1. Constat terrain & relevé technique', PALETTE.violetDark);
  doc.dessinerBlocTexte(constatComplet, {
    fond: PALETTE.white,
    videMessage: 'Aucun constat saisi pour le moment. Complétez ce relevé avant rédaction du devis.',
  });

  // ── 5. Travaux & prestations à chiffrer ────────────────────────────────────
  if (c.rapport.travauxAPrevoir) {
    doc.dessinerTitreSection('2. Travaux & prestations à chiffrer', PALETTE.emeraldDark);
    doc.dessinerBlocTexte(c.rapport.travauxAPrevoir, {
      fond: PALETTE.emeraldBg,
      barreGauche: PALETTE.emerald,
    });
  }

  // ── 6. Matériel, fournitures & moyens à prévoir ────────────────────────────
  if (c.rapport.materielNecessaire) {
    doc.dessinerTitreSection('3. Matériel, fournitures & moyens à prévoir', PALETTE.blue);
    doc.dessinerBlocTexte(c.rapport.materielNecessaire, { fond: PALETTE.surface });
  }

  // ── 7. Contraintes d'accès, sécurité & consignes ───────────────────────────
  if (c.rapport.contraintesAcces) {
    doc.dessinerTitreSection("4. Contraintes d'accès, sécurité & consignes", PALETTE.amberDark);
    doc.dessinerBlocTexte(c.rapport.contraintesAcces, {
      fond: PALETTE.amberBg,
      barreGauche: PALETTE.amberDark,
    });
  }

  // ── 8. Dossier photographique de visite ────────────────────────────────────
  if (p.photos.length > 0) {
    await doc.dessinerGrillePhotos(p.photos, `Dossier photographique de visite (${p.photos.length})`);
  }

  // ── 9. Visa interne Relevé → Chiffrage ─────────────────────────────────────
  doc.espacer(4);
  doc.dessinerSignatures({
    titreGauche: 'Relevé terrain / Visiteur',
    detailGauche: [
      `Rédacteur : ${c.rapport.redigePar || c.technicien || '-'}`,
      `Date du relevé : ${dateFrPdf(c.rapport.redigeLe || c.dateVisite) || dateVisiteStr}`,
      `Dossier : ${c.reference}`,
    ],
    titreDroite: "Exploitation chiffrage (Bureau d'études)",
    detailDroite: [
      `Chargé d'affaires : ${c.responsable || 'À attribuer'}`,
      'Décision chiffrage / Observations :',
      'Date de reprise pour devis :',
    ],
    mentionLegale: `Rapport de visite technique préalable à usage strictement interne édité par ${societeInfo.nom} via ANELEC SUIVI TCE (https://suivi.anelecgroupe.com) pour la définition et la rédaction du devis ${c.reference}.`,
  });

  return doc.finaliser();
}
