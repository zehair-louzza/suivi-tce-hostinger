import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = 'C:/Users/Zeh/suivi-tce-hostinger';
const IMAGES_DIR = path.join(ROOT_DIR, 'docs/images');
const HTML_OUTPUT = path.join(ROOT_DIR, 'docs/RAPPORT_COMPLET_TCE_ANELEC.html');
const PDF_OUTPUT = path.join(ROOT_DIR, 'docs/RAPPORT_COMPLET_TCE_ANELEC.pdf');
const ARTIFACT_PDF = 'C:/Users/Zeh/.gemini/antigravity/brain/d2fd77b6-f5a7-44a6-956a-412bdfedd8dd/RAPPORT_COMPLET_TCE_ANELEC.pdf';

function toBase64(file) {
  const filePath = path.join(IMAGES_DIR, file);
  if (!fs.existsSync(filePath)) return '';
  const ext = path.extname(file).replace('.', '');
  if (ext === 'svg') {
    return `data:image/svg+xml;utf8,${encodeURIComponent(fs.readFileSync(filePath, 'utf-8'))}`;
  }
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

const imgLogo = toBase64('01-logo-anelec-groupe.jpg');
const imgLogin = toBase64('01-connexion-espace-securise.png');
const imgPilotage = toBase64('02-centre-de-pilotage-kpi-barometre.png');
const imgPlanning = toBase64('03-dispatch-planning-gantt-pro.png');
const imgDevis = toBase64('04-pipeline-devis-commercial.png');
const imgModal = toBase64('04b-grille-reconversion-modal.png');
const imgInterv = toBase64('05-interventions-tce-synthese.png');
const imgFacture = toBase64('06-facturation-bacs-tri-b2b-b2c.png');
const imgRentabilite = toBase64('07-rentabilite-marges-equipes.png');
const imgAdmin = toBase64('08-workstation-admin-pointages.png');
const imgMobile = toBase64('09-application-mobile-technicien.png');

const schema01 = toBase64('schema-01-cycle-tce.svg');
const schema02 = toBase64('schema-02-workflow-technicien-mobile.svg');
const schema03 = toBase64('schema-03-grille-reconversion-devis.svg');
const schema04 = toBase64('schema-04-tri-facturation-arbitrage.svg');

const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Livre Blanc & Manuel Opérationnel — Plateforme Suivi TCE ANELEC GROUPE</title>
<style>
  @page {
    size: A4;
    margin: 12mm 12mm 14mm 12mm;
    @bottom-right {
      content: counter(page);
    }
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background-color: #ffffff;
    line-height: 1.5;
    font-size: 10pt;
    margin: 0;
    padding: 0;
  }

  .page-break {
    page-break-after: always;
    break-after: page;
  }

  /* Cover Page */
  .cover {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 255mm;
    padding: 20mm 12mm;
    border: 3px solid #00bf63;
    border-radius: 8px;
    background: linear-gradient(135deg, #0a0f1d 0%, #1e293b 100%);
    color: #ffffff;
  }

  .cover-logo-wrapper {
    display: flex;
    align-items: center;
    gap: 20px;
    background: #ffffff;
    padding: 16px 24px;
    border-radius: 12px;
    width: fit-content;
  }

  .cover-logo {
    max-height: 65px;
    object-fit: contain;
  }

  .cover-badge {
    display: inline-block;
    background-color: #00bf63;
    color: #0a0f1d;
    font-weight: 800;
    font-size: 9.5pt;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 20px;
    margin-top: 30px;
  }

  .cover-title {
    font-size: 26pt;
    font-weight: 900;
    line-height: 1.2;
    margin: 15px 0 10px 0;
    color: #ffffff;
  }

  .cover-title span {
    color: #ffcc00;
  }

  .cover-subtitle {
    font-size: 13pt;
    color: #94a3b8;
    max-width: 650px;
    line-height: 1.4;
    margin-bottom: 30px;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 16px;
    margin-top: 20px;
  }

  .cover-meta-item strong {
    display: block;
    color: #ffcc00;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .cover-meta-item span {
    font-size: 10.5pt;
    color: #e2e8f0;
  }

  /* Typography */
  h1 {
    font-size: 17pt;
    font-weight: 800;
    color: #0a0f1d;
    border-bottom: 2.5px solid #00bf63;
    padding-bottom: 6px;
    margin-top: 18px;
    margin-bottom: 12px;
  }

  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #0f172a;
    border-left: 4px solid #ffcc00;
    padding-left: 8px;
    margin-top: 16px;
    margin-bottom: 10px;
  }

  p {
    margin-top: 0;
    margin-bottom: 10px;
    text-align: justify;
  }

  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 6px;
    margin-bottom: 16px;
    font-size: 8.5pt;
    color: #64748b;
  }

  .doc-header-brand {
    font-weight: 800;
    color: #0a0f1d;
  }

  .figure-box {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px;
    margin: 12px 0;
    page-break-inside: avoid;
  }

  .figure-img {
    width: 100%;
    max-height: 360px;
    object-fit: contain;
    border-radius: 4px;
    background: #f8fafc;
    display: block;
    margin: 0 auto;
  }

  .figure-caption {
    font-size: 8.5pt;
    color: #475569;
    text-align: center;
    margin-top: 6px;
    font-weight: 500;
    border-top: 1px dashed #e2e8f0;
    padding-top: 4px;
  }

  .figure-caption strong {
    color: #0a0f1d;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 12px 0;
    page-break-inside: avoid;
  }

  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 10px 0;
    page-break-inside: avoid;
  }

  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 10px;
  }

  .kpi-card {
    border-radius: 6px;
    padding: 10px;
    text-align: center;
  }
  .kpi-card-green { background-color: #00bf63; color: #0a0f1d; }
  .kpi-card-yellow { background-color: #ffcc00; color: #0a0f1d; }
  .kpi-card-dark { background-color: #0a0f1d; color: #ffffff; }
  .kpi-card-blue { background-color: #2563eb; color: #ffffff; }

  .kpi-val {
    font-size: 15pt;
    font-weight: 800;
    margin: 3px 0;
  }
  .kpi-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    font-weight: 700;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }

  th, td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
  }

  th {
    background-color: #0a0f1d;
    color: #ffffff;
    font-weight: 700;
    font-size: 8.5pt;
  }

  tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-dark { background: #0a0f1d; color: #ffffff; }
</style>
</head>
<body>

<!-- ================================= PAGE 1 : COUVERTURE ================================= -->
<div class="cover">
  <div>
    <div class="cover-logo-wrapper">
      <img src="${imgLogo}" alt="ANELEC GROUPE" class="cover-logo" />
      <div>
        <div style="font-size: 13pt; font-weight: 900; color: #0a0f1d; letter-spacing: 1px;">ANELEC GROUPE</div>
        <div style="font-size: 7.5pt; color: #64748b; font-weight: 600; text-transform: uppercase;">Maintenance & Travaux Tous Corps d'État (TCE)</div>
      </div>
    </div>
    <div class="cover-badge">LIVRE BLANC TECHNIQUE & OPÉRATIONNEL 2026</div>
    <div class="cover-title">Plateforme de Suivi TCE,<br/><span>Dispatch & Facturation</span></div>
    <div class="cover-subtitle">
      Démonstration intégrale des réalisations fonctionnelles, architecture cloud, baromètre financier et manuel opérateur.
    </div>
  </div>

  <div>
    <div class="cover-meta-grid">
      <div class="cover-meta-item">
        <strong>Environnement Production</strong>
        <span>https://suivi.anelecgroupe.com</span>
      </div>
      <div class="cover-meta-item">
        <strong>Hébergement Cloud</strong>
        <span>Hostinger Cloud VPS + Supabase PostgreSQL</span>
      </div>
      <div class="cover-meta-item">
        <strong>Auteurs & Direction</strong>
        <span>Direction ANELEC & Antigravity Engineering</span>
      </div>
      <div class="cover-meta-item">
        <strong>Version Officielle</strong>
        <span>Production 2026 Enterprise Stable</span>
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 2 : SOMMAIRE & ARCHITECTURE ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>SOMMAIRE & ARCHITECTURE GÉNÉRALE DU CYCLE TCE</span>
</div>

<h1>1. Vue d'Ensemble & Architecture du Cycle Complet TCE</h1>

<p>
  La plateforme <strong>Suivi TCE ANELEC</strong> digitalise l'intégralité du cycle de vie des chantiers Tous Corps d'État (TCE) : de la demande de devis à la facturation finale, en passant par le dispatching Gantt et l'exécution mobile par les techniciens.
</p>

<div class="figure-box">
  <img src="${schema01}" alt="Cycle Complet TCE ANELEC" class="figure-img" />
  <div class="figure-caption">
    <strong>Schéma 1 :</strong> Architecture séquentielle du cycle complet des chantiers ANELEC GROUPE.
  </div>
</div>

<h2>Table des Matières</h2>
<table style="font-size: 9pt;">
  <thead>
    <tr>
      <th style="width: 10%;">Section</th>
      <th style="width: 75%;">Module Fonctionnel Réalisé & État de Service</th>
      <th style="width: 15%; text-align: center;">Statut</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>01</strong></td>
      <td><strong>Centre de Pilotage & Baromètre Économique HT</strong> (4 cartes financières, Funnel 5 étapes, 6 corps d'état)</td>
      <td style="text-align:center;"><span class="badge badge-green">Actif</span></td>
    </tr>
    <tr>
      <td><strong>02</strong></td>
      <td><strong>Dispatching & Planning Gantt Pro Multi-Ressources</strong> (Timeline continue, créneau unifié VIS • DEV)</td>
      <td style="text-align:center;"><span class="badge badge-green">Actif</span></td>
    </tr>
    <tr>
      <td><strong>03</strong></td>
      <td><strong>Pipeline Devis & Grille de Reconversion Sécurisée</strong> (22 colonnes, qualification SAV / Reprise / Avenant)</td>
      <td style="text-align:center;"><span class="badge badge-green">Actif</span></td>
    </tr>
    <tr>
      <td><strong>04</strong></td>
      <td><strong>Interventions TCE & Tableau Synthétique Responsive</strong> (Vue 8 colonnes sans scroll horizontal)</td>
      <td style="text-align:center;"><span class="badge badge-green">Actif</span></td>
    </tr>
    <tr>
      <td><strong>05</strong></td>
      <td><strong>Facturation Intelligente & Arbitrage B2B (HT) / B2C (TTC)</strong> (5 bacs de tri, règle "interventions uniquement")</td>
      <td style="text-align:center;"><span class="badge badge-green">Actif</span></td>
    </tr>
    <tr>
      <td><strong>06</strong></td>
      <td><strong>Contrôle de Gestion : Rentabilité & Marges d'Équipes</strong> (CA/h produit, simulateur coût chargé)</td>
      <td style="text-align:center;"><span class="badge badge-green">Actif</span></td>
    </tr>
    <tr>
      <td><strong>07</strong></td>
      <td><strong>Workstation Super-Admin & Suivi des Pointages Flotte</strong> (Audit arrivée/départ, rédaction rapports)</td>
      <td style="text-align:center;"><span class="badge badge-green">Actif</span></td>
    </tr>
    <tr>
      <td><strong>08</strong></td>
      <td><strong>Application Mobile Technicien PWA & Rigueur Terrain</strong> (Pointage certifié matin/soir, photos &lt;75 Ko)</td>
      <td style="text-align:center;"><span class="badge badge-green">Actif</span></td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- ================================= PAGE 3 : CENTRE DE PILOTAGE ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CENTRE DE PILOTAGE & BAROMÈTRE ÉCONOMIQUE HT</span>
</div>

<h1>2. Centre de Pilotage & Baromètre Économique HT</h1>

<p>
  Le <strong>Centre de Pilotage</strong> constitue la tour de contrôle opérationnelle et économique de l'entreprise. Il affiche en temps réel les volumes financiers engagés, l'état d'avancement des travaux et la performance par spécialité technique.
</p>

<div class="figure-box">
  <img src="${imgPilotage}" alt="Centre de Pilotage Live" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 2.1 :</strong> Capture réelle du Centre de Pilotage sur <code>suivi.anelecgroupe.com</code> avec le Baromètre HT et le Funnel 5 étapes.
  </div>
</div>

<div class="grid-4">
  <div class="kpi-card kpi-card-green">
    <div class="kpi-label">CA Travaux Réalisés</div>
    <div class="kpi-val">46 331 € HT</div>
    <div style="font-size: 7.5pt;">Chantiers clôturés</div>
  </div>
  <div class="kpi-card kpi-card-yellow">
    <div class="kpi-label">Pipeline Devis en Cours</div>
    <div class="kpi-val">0 € HT</div>
    <div style="font-size: 7.5pt;">Volume en négociation</div>
  </div>
  <div class="kpi-card kpi-card-dark">
    <div class="kpi-label">En-cours Prêt à Facturer</div>
    <div class="kpi-val">0 € HT</div>
    <div style="font-size: 7.5pt;">Trésorerie immédiate</div>
  </div>
  <div class="kpi-card kpi-card-blue">
    <div class="kpi-label">Transformation Devis</div>
    <div class="kpi-val">50 %</div>
    <div style="font-size: 7.5pt;">1 devis accepté sur 2</div>
  </div>
</div>

<h2>L'Entonnoir Opérationnel d'Avancement (Funnel TCE 5 Étapes)</h2>
<p>
  Le suivi suit un flux séquentiel strict garantissant qu'aucun chantier ne reste orphelin :
</p>
<ul>
  <li><strong>Étape 1 : Devis & Chiffrages :</strong> Total des devis actifs et visites de prise de cotes à réaliser sur site.</li>
  <li><strong>Étape 2 : Ordonnancement Gantt :</strong> Missions validées prêtes pour placement sur le calendrier des techniciens.</li>
  <li><strong>Étape 3 : Sur le Terrain Aujourd'hui :</strong> Interventions en cours d'exécution avec pointage certifié actif.</li>
  <li><strong>Étape 4 : Rapports & Photos Reçus :</strong> Dossiers clôturés par le technicien, photos et descriptifs à valider avant facturation.</li>
  <li><strong>Étape 5 : Clôturées & Facturées :</strong> Chantiers facturés avec traçabilité comptable intégrale.</li>
</ul>

<div class="page-break"></div>

<!-- ================================= PAGE 4 : PLANNING GANTT PRO ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>DISPATCHING & PLANNING GANTT PRO MULTI-RESSOURCES</span>
</div>

<h1>3. Dispatching & Planning Gantt Pro Multi-Ressources</h1>

<p>
  Le planning Gantt ordonnance les journées de chaque technicien (Anouar, Mohamed, Haitam, etc.) à la minute près avec glisser-déposer fluide (Pointer Events 60 fps).
</p>

<div class="figure-box">
  <img src="${imgPlanning}" alt="Planning Gantt Pro Live" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 3.1 :</strong> Capture réelle du Planning Gantt Pro sur <code>suivi.anelecgroupe.com</code> avec la Bourse de dispatch et la timeline journalière.
  </div>
</div>

<h2>Fonctionnalités Clés du Moteur de Planification</h2>
<div class="grid-2">
  <div class="card" style="border-left: 4px solid #00bf63;">
    <strong style="color: #166534;">Créneau Unifié Visite & Devis (VIS • DEV)</strong>
    <p style="font-size: 8.5pt; margin-top: 4px;">
      Un seul déplacement physique est représenté par un unique bloc doré <code>VIS • DEV</code>. Les heures réelles du technicien sont calculées sans doublon (exactitude 100%).
    </p>
  </div>
  <div class="card" style="border-left: 4px solid #ffcc00;">
    <strong style="color: #854d0e;">Auto-Planification & Bourse de Dispatch</strong>
    <p style="font-size: 8.5pt; margin-top: 4px;">
      L'algorithme analyse les compétences métiers requises et place les missions sans conflit selon la règle de <em>moindre compétence nécessaire</em>.
    </p>
  </div>
</div>

<div class="grid-2">
  <div class="card" style="border-left: 4px solid #0a0f1d;">
    <strong style="color: #0a0f1d;">Déplanification en 1 Clic</strong>
    <p style="font-size: 8.5pt; margin-top: 4px;">
      Le bouton <em>« Renvoyer en bourse »</em> retire le créneau du calendrier pour le replacer dans la liste d'attente à gauche.
    </p>
  </div>
  <div class="card" style="border-left: 4px solid #ff0000;">
    <strong style="color: #991b1b;">Suppression Sécurisée de Créneau</strong>
    <p style="font-size: 8.5pt; margin-top: 4px;">
      Bouton rouge avec confirmation modale pour annuler un rendez-vous erroné sans risque de fausse manipulation.
    </p>
  </div>
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 5 : PIPELINE DEVIS & RECONVERSION ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>PIPELINE DEVIS & GRILLE DE RECONVERSION SÉCURISÉE</span>
</div>

<h1>4. Pipeline Devis & Grille de Reconversion Sécurisée</h1>

<p>
  Le pipeline commercial permet de piloter l'ensemble des devis de l'entreprise (22 colonnes analytiques) et de sécuriser leur transformation en chantier d'exécution.
</p>

<div class="figure-box">
  <img src="${imgDevis}" alt="Pipeline Devis Commercial Live" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 4.1 :</strong> Capture réelle du Pipeline Devis avec le bouton d'action <code>+ SAV/Suite</code>.
  </div>
</div>

<h2>La Grille de Reconversion Intelligente</h2>
<p>
  Lorsqu'un devis a déjà été transformé en intervention (badge vert <code>INT liée</code>), appuyer à nouveau sur conversion ouvre la grille de qualification ci-dessous :
</p>

<div class="figure-box">
  <img src="${schema03}" alt="Schéma Grille de Reconversion" class="figure-img" />
  <div class="figure-caption">
    <strong>Schéma 4.1 :</strong> Arbre de décision opérationnel de reconversion devis.
  </div>
</div>

<div class="figure-box">
  <img src="${imgModal}" alt="Modal Reconversion Devis Live" class="figure-img" style="max-height: 280px;" />
  <div class="figure-caption">
    <strong>Figure 4.2 :</strong> Capture réelle de la boîte de dialogue de qualification du motif d'intervention.
  </div>
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 6 : INTERVENTIONS TCE ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>INTERVENTIONS TCE & TABLEAU SYNTHÉTIQUE RESPONSIVE</span>
</div>

<h1>5. Interventions TCE & Tableau Synthétique</h1>

<p>
  Le tableau des interventions rassemble l'ensemble des chantiers tous corps d'état avec affichage plein écran direct (8 colonnes optimisées sans scroll horizontal) :
</p>

<div class="figure-box">
  <img src="${imgInterv}" alt="Interventions TCE Synthèse Live" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 5.1 :</strong> Capture réelle du tableau synthétique des interventions sur <code>suivi.anelecgroupe.com</code>.
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 12%;">RÉFÉRENCE</th>
      <th style="width: 20%;">CLIENT & CHANTIER</th>
      <th style="width: 20%;">CORPS D'ÉTAT & OBJET</th>
      <th style="width: 15%;">TECHNICIEN</th>
      <th style="width: 13%;">CRÉNEAU</th>
      <th style="width: 10%;">STATUT</th>
      <th style="width: 10%;">PHOTOS</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>VIS-001</strong></td>
      <td>a • Site Paris</td>
      <td>Tous corps d'état [Visite Devis]</td>
      <td>Mohamed</td>
      <td>05/11/2026</td>
      <td><span class="badge badge-green">Clôturée</span></td>
      <td>4 reçues</td>
    </tr>
    <tr>
      <td><strong>INT-2026-008</strong></td>
      <td>a • Intervention travaux</td>
      <td>Tous corps d'état</td>
      <td>Mohamed</td>
      <td>05/11/2026</td>
      <td><span class="badge badge-green">Clôturée</span></td>
      <td>2 photos</td>
    </tr>
    <tr>
      <td><strong>INT-2026-006</strong></td>
      <td>azerty • Dépannage</td>
      <td>Tous corps d'état</td>
      <td>Haitam</td>
      <td>05/11/2026</td>
      <td><span class="badge badge-green">Clôturée</span></td>
      <td>Rapport OK</td>
    </tr>
    <tr>
      <td><strong>INT-2026-011</strong></td>
      <td>Client Paris 16</td>
      <td>Menuiserie • Remplacement</td>
      <td>Yankoubou</td>
      <td>06/11/2026</td>
      <td><span class="badge badge-yellow">Planifiée</span></td>
      <td>En attente</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- ================================= PAGE 7 : FACTURATION B2B / B2C ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>FACTURATION TCE & ARBITRAGE B2B (HT) / B2C (TTC)</span>
</div>

<h1>6. Facturation Intelligente & Arbitrage Fiscal (B2B vs B2C)</h1>

<p>
  La gestion de la facturation applique la règle d'or : <strong>« On ne facture que les chantiers achevés, pas les devis »</strong>.
</p>

<div class="figure-box">
  <img src="${schema04}" alt="Schéma Facturation et Arbitrage" class="figure-img" />
  <div class="figure-caption">
    <strong>Schéma 6.1 :</strong> Architecture des 5 bacs de tri et arbitrage fiscal B2B / B2C.
  </div>
</div>

<div class="figure-box">
  <img src="${imgFacture}" alt="Facturation et Bacs de Tri Live" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 6.1 :</strong> Capture réelle de l'espace Facturation & Clients sur <code>suivi.anelecgroupe.com</code>.
  </div>
</div>

<div class="grid-2">
  <div class="card" style="border-left: 4px solid #00bf63;">
    <strong style="color: #166534;">🏢 Régime B2B (Professionnel & Syndic)</strong>
    <p style="font-size: 8.5pt; margin-top: 4px;">
      Saisie prioritaire en <strong>Montant HT</strong>. Gestion de l'autoliquidation de sous-traitance (TVA 0% art. 283-2 nonies) ou TVA normale 20%, mention du Bon de Commande et échéance à 30/45 jours.
    </p>
  </div>
  <div class="card" style="border-left: 4px solid #2563eb;">
    <strong style="color: #1d4ed8;">🏠 Régime B2C (Particulier & Occupant)</strong>
    <p style="font-size: 8.5pt; margin-top: 4px;">
      Saisie prioritaire en <strong>Montant TTC</strong>. Application des taux de TVA réduits (10% pour locaux d'habitation de plus de 2 ans, 5,5% énergétique) avec encaissement direct au comptant.
    </p>
  </div>
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 8 : RENTABILITE & ADMIN ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>RENTABILITÉ DES ÉQUIPES & WORKSTATION ADMINISTRATEUR</span>
</div>

<h1>7. Contrôle de Gestion : Rentabilité & Marges d'Équipes</h1>

<p>
  Ce tableau de bord financier croise en temps réel les heures pointées, les durées planifiées et les montants d'interventions :
</p>

<div class="figure-box">
  <img src="${imgRentabilite}" alt="Tableau de bord Rentabilité Live" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 7.1 :</strong> Capture réelle du tableau de bord de Rentabilité & Marges sur <code>suivi.anelecgroupe.com</code>.
  </div>
</div>

<h1>8. Workstation Super-Admin & Suivi des Pointages</h1>

<p>
  Console d'audit et de commandement dédiée au super-administrateur pour la gestion des droits utilisateurs et le contrôle des heures de la flotte :
</p>

<div class="figure-box">
  <img src="${imgAdmin}" alt="Workstation Admin Live" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 8.1 :</strong> Capture réelle du poste d'administration avec matrice des permissions et pointages journaliers.
  </div>
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 9 : APPLICATION MOBILE TECHNICIEN ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>APPLICATION MOBILE TECHNICIEN PWA & SÉCURITÉ DE CONNEXION</span>
</div>

<h1>9. Application Mobile Technicien PWA & Rigueur Terrain</h1>

<p>
  L'application pour smartphone impose une rigueur opérationnelle stricte grâce à des verrous logiciels infalsifiables :
</p>

<div class="figure-box">
  <img src="${schema02}" alt="Schéma Workflow Technicien Mobile" class="figure-img" />
  <div class="figure-caption">
    <strong>Schéma 9.1 :</strong> Workflow quotidien certifié du technicien sur le terrain.
  </div>
</div>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgMobile}" alt="Application Mobile Live" class="figure-img" style="max-height: 290px;" />
    <div class="figure-caption">
      <strong>Figure 9.1 :</strong> Capture réelle de l'interface mobile smartphone (pointage matin obligatoire).
    </div>
  </div>

  <div>
    <div class="card" style="border-left: 4px solid #00bf63; margin-bottom: 8px;">
      <strong style="color: #166534;">1. Pointage Matin Obligatoire</strong>
      <p style="font-size: 8pt; margin: 2px 0;">
        Impossible de démarrer une intervention sans avoir pointé son arrivée au bureau (horodatage serveur certifié).
      </p>
    </div>
    <div class="card" style="border-left: 4px solid #ffcc00; margin-bottom: 8px;">
      <strong style="color: #854d0e;">2. Photos Compressées (&lt; 75 Ko)</strong>
      <p style="font-size: 8pt; margin: 2px 0;">
        Réduction automatique du poids des photos de 95% sans perte de netteté pour envoi instantané en 3G/4G.
      </p>
    </div>
    <div class="card" style="border-left: 4px solid #2563eb; margin-bottom: 8px;">
      <strong style="color: #1d4ed8;">3. Clôture Liée Auto</strong>
      <p style="font-size: 8pt; margin: 2px 0;">
        La clôture du chantier finalise automatiquement le devis rattaché.
      </p>
    </div>
    <div class="card" style="border-left: 4px solid #ff0000;">
      <strong style="color: #991b1b;">4. Verrouillage du Soir & Non Finie</strong>
      <p style="font-size: 8pt; margin: 2px 0;">
        Impossible de pointer sa fin de journée si un chantier est en cours. Bouton <em>« Intervention non finie »</em> pour replanification.
      </p>
    </div>
  </div>
</div>

<h1>10. Connexion Sécurisée & Contrôle d'Accès RBAC</h1>

<div class="figure-box">
  <img src="${imgLogin}" alt="Connexion Espace Sécurisé Live" class="figure-img" style="max-height: 180px;" />
  <div class="figure-caption">
    <strong>Figure 10.1 :</strong> Capture réelle de l'écran d'authentification sur <code>suivi.anelecgroupe.com/login</code>.
  </div>
</div>

<div class="card" style="margin-top: 15px; background: #0a0f1d; color: #ffffff; text-align: center; padding: 16px;">
  <div style="font-size: 11pt; font-weight: 800; color: #00bf63; margin-bottom: 4px;">ANELEC GROUPE — CERTIFICATION TECHNIQUE DU LIVRE BLANC 2026</div>
  <div style="font-size: 8.5pt; color: #94a3b8; max-width: 650px; margin: 0 auto;">
    L'ensemble des captures de ce document provient directement du système déployé en production. Chaque flux est vérifié, conforme aux règles d'entreprise et sécurisé.
  </div>
</div>

</body>
</html>
`;

fs.writeFileSync(HTML_OUTPUT, htmlContent, 'utf-8');
console.log('HTML généré avec succès :', HTML_OUTPUT);

try {
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const cmd = `"${chromePath}" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${PDF_OUTPUT}" --no-pdf-header-footer "${HTML_OUTPUT}"`;
  console.log('Compilation du PDF avec Chrome headless...');
  execSync(cmd, { stdio: 'inherit' });
  console.log('PDF généré avec succès :', PDF_OUTPUT);

  fs.copyFileSync(PDF_OUTPUT, ARTIFACT_PDF);
  console.log('PDF copié vers les artefacts :', ARTIFACT_PDF);
} catch (err) {
  console.error('Erreur lors de la génération du PDF :', err);
}
