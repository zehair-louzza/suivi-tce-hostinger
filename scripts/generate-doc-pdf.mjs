import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = 'C:/Users/Zeh/suivi-tce-hostinger';
const IMAGES_DIR = path.join(ROOT_DIR, 'docs/images');
const HTML_OUTPUT = path.join(ROOT_DIR, 'docs/GUIDE_UTILISATEUR_PROCEDURES_ANELEC_TCE.html');
const PDF_OUTPUT = path.join(ROOT_DIR, 'docs/GUIDE_UTILISATEUR_PROCEDURES_ANELEC_TCE.pdf');
const PDF_BACKUP = path.join(ROOT_DIR, 'docs/RAPPORT_COMPLET_TCE_ANELEC.pdf');
const ARTIFACT_PDF = 'C:/Users/Zeh/.gemini/antigravity/brain/d2fd77b6-f5a7-44a6-956a-412bdfedd8dd/GUIDE_UTILISATEUR_PROCEDURES_ANELEC_TCE.pdf';

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

// Images chargées
const imgLogo = toBase64('01-logo-anelec-groupe.png');
const imgSynthesePc = toBase64('02-dashboard-synthese-pc.png');
const imgOperationsPc = toBase64('02b-dashboard-operations-pc.png');
const imgAnalysePc = toBase64('02c-dashboard-analyse-pc.png');
const imgCartePc = toBase64('03-carte-tournees-pc.png');
const imgPlanningPc = toBase64('04-dispatch-planning-gantt-pc.png');
const imgDevisPc = toBase64('05-pipeline-devis-pc.png');
const imgModalReconv = toBase64('04b-grille-reconversion-modal.png');
const imgIntervPc = toBase64('06-interventions-tce-pc.png');
const imgFacturePc = toBase64('07-facturation-clients-pc.png');
const imgRentabilitePc = toBase64('08-rentabilite-equipes-pc.png');
const imgMobileSynthese = toBase64('09-mobile-dashboard-synthese.png');
const imgMobileCarte = toBase64('10-mobile-carte-tournees.png');
const imgMobileTech = toBase64('11-mobile-tech-app.png');

const schema01 = toBase64('schema-01-cycle-tce.svg');
const schema02 = toBase64('schema-02-workflow-technicien-mobile.svg');
const schema03 = toBase64('schema-03-grille-reconversion-devis.svg');
const schema04 = toBase64('schema-04-tri-facturation-arbitrage.svg');

const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Guide Utilisateur & Procédures Métier — ANELEC GROUPE TCE</title>
<style>
  @page {
    size: A4;
    margin: 10mm 12mm 12mm 12mm;
    @bottom-right {
      content: counter(page);
    }
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.45;
    font-size: 9.5pt;
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
    min-height: 260mm;
    padding: 16mm 14mm;
    border: 3px solid #047857;
    border-radius: 12px;
    background: linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #064e3b 100%);
    color: #ffffff;
  }

  .cover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #ffffff;
    padding: 14px 22px;
    border-radius: 10px;
  }

  .cover-logo {
    max-height: 60px;
    object-fit: contain;
  }

  .cover-meta {
    text-align: right;
    color: #0f172a;
    font-size: 8.5pt;
    font-weight: 600;
  }

  .cover-meta .pill {
    background: #047857;
    color: #ffffff;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 8pt;
    display: inline-block;
    margin-bottom: 3px;
  }

  .cover-body {
    margin: 30mm 0 20mm 0;
  }

  .cover-title {
    font-size: 26pt;
    font-weight: 800;
    line-height: 1.2;
    margin: 0 0 10px 0;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .cover-title span {
    color: #10b981;
  }

  .cover-subtitle {
    font-size: 13.5pt;
    color: #94a3b8;
    margin: 0 0 25px 0;
    font-weight: 400;
    line-height: 1.4;
  }

  .cover-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .cover-tag {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 9pt;
    font-weight: 600;
  }

  .cover-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 12px;
    font-size: 8pt;
    color: #cbd5e1;
  }

  /* Typography */
  h1 {
    font-size: 15pt;
    font-weight: 800;
    color: #0f172a;
    margin: 16px 0 10px 0;
    padding-bottom: 6px;
    border-bottom: 2px solid #047857;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  h2 {
    font-size: 11.5pt;
    font-weight: 700;
    color: #065f46;
    margin: 12px 0 6px 0;
  }

  h3 {
    font-size: 10pt;
    font-weight: 600;
    color: #1e293b;
    margin: 8px 0 4px 0;
  }

  p {
    margin: 0 0 8px 0;
    color: #334155;
  }

  /* Components */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 12px;
  }

  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 10px;
  }

  .card-header {
    font-weight: 700;
    font-size: 9.5pt;
    color: #0f172a;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Procedural Steps with Numbered Pins */
  .step-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 10px 0;
  }

  .step-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }

  .step-pin {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #047857;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 9pt;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .step-content {
    flex: 1;
  }

  .step-title {
    font-weight: 700;
    font-size: 9pt;
    color: #0f172a;
  }

  .step-desc {
    font-size: 8.5pt;
    color: #475569;
    margin-top: 2px;
  }

  /* Callout Badges */
  .badge-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #dcfce7;
    color: #166534;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 700;
    border: 1px solid #86efac;
  }

  .badge-rule {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #fef3c7;
    color: #92400e;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 700;
    border: 1px solid #fde68a;
  }

  .badge-device-pc {
    background: #e0e7ff;
    color: #3730a3;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 700;
  }

  .badge-device-mob {
    background: #fce7f3;
    color: #9d174d;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 700;
  }

  /* Figures & Screenshots */
  .figure-box {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 6px;
    margin: 8px 0;
    text-align: center;
  }

  .figure-img {
    width: 100%;
    max-height: 260px;
    object-fit: contain;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
  }

  .figure-caption {
    font-size: 8pt;
    color: #475569;
    margin-top: 4px;
    text-align: left;
    padding: 0 4px;
  }

  .figure-caption strong {
    color: #0f172a;
  }

  /* Arrow annotations */
  .arrow-indicator {
    color: #047857;
    font-weight: 800;
    margin: 0 4px;
  }

  /* Table of Contents */
  .toc {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 14px 0;
  }

  .toc-item {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    border-bottom: 1px dashed #cbd5e1;
    font-size: 8.5pt;
  }

  .toc-item:last-child {
    border-bottom: none;
  }

  .toc-title {
    font-weight: 600;
    color: #0f172a;
  }

  .toc-tag {
    color: #047857;
    font-weight: 700;
  }
</style>
</head>
<body>

<!-- PAGE 1 : COUVERTURE OFFICIELLE -->
<div class="cover">
  <div class="cover-header">
    <img src="${imgLogo}" alt="Logo Officiel ANELEC GROUPE" class="cover-logo" />
    <div class="cover-meta">
      <span class="pill">PRODUCTION 2026</span><br>
      Plateforme Suivi TCE & Dispatching<br>
      <strong>suivi.anelecgroupe.com</strong>
    </div>
  </div>

  <div class="cover-body">
    <div style="color: #10b981; font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
      Document de Référence & Guide Opérationnel
    </div>
    <h1 class="cover-title">
      Guide Utilisateur &<br>Procédures Métier <span>Pas-à-Pas</span>
    </h1>
    <p class="cover-subtitle">
      Manuel d'exploitation Tout Corps d'État (TCE) : De la prise de devis et du dispatching Gantt jusqu'à la tournée routière assistée, l'intervention mobile et la facturation certifiée.
    </p>

    <div class="cover-tags">
      <span class="cover-tag">🖥️ Version PC Grand Écran & Laptop</span>
      <span class="cover-tag">📱 Version Smartphone PWA Terrain</span>
      <span class="cover-tag">🗺️ Optimiseur de Tournées GPS</span>
      <span class="cover-tag">⚡ 5 Profils Métier Séparés</span>
    </div>
  </div>

  <div class="cover-footer">
    <div>
      <strong>ANELEC GROUPE</strong> — 9 Rue des Colonnes, 75002 Paris<br>
      Système d'Exploitation TCE Déployé sur Hostinger Cloud VPS
    </div>
    <div style="text-align: right;">
      Validé conforme à la maquette 2026<br>
      Édition Officielle · Novembre 2026
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 2 : SOMMAIRE & MATRICE DES MÉTIERS -->
<h1>📑 Sommaire Général & Matrice des Rôles</h1>

<div class="toc">
  <div class="toc-item">
    <span class="toc-title">1. Architecture Globale : Écosystème PC vs Téléphone Portable</span>
    <span class="toc-tag">Page 3</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">2. Le Nouveau Tableau de Bord (Synthèse, Opérations, Analyse)</span>
    <span class="toc-tag">Page 4</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">3. Carte Interactive & Calcul Automatique d'Itinéraires (TSP 2-Opt)</span>
    <span class="toc-tag">Page 5</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">4. Procédure Métier A : Direction & Gérance (Pilotage Financier & Rentabilité)</span>
    <span class="toc-tag">Page 6</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">5. Procédure Métier B : Bureau d'Études & Chiffrage (Devis & Reconversion)</span>
    <span class="toc-tag">Page 7</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">6. Procédure Métier C : Conducteur de Travaux & Dispatcher (Gantt & Tournées)</span>
    <span class="toc-tag">Page 8</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">7. Procédure Métier D : Technicien Terrain (Mobile PWA, Photos & Clôture)</span>
    <span class="toc-tag">Page 9</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">8. Procédure Métier E : Responsable Facturation (Tri 5 Bacs & Arbitrage Fiscal)</span>
    <span class="toc-tag">Page 10</span>
  </div>
</div>

<h2>👥 Répartition des Rôles & Accès Métier</h2>
<p>
  L'application ANELEC intègre un contrôle d'accès basé sur les rôles (RBAC) garantissant que chaque collaborateur accède aux fonctionnalités précises de sa mission :
</p>

<div class="grid-2">
  <div class="card" style="border-left: 4px solid #047857;">
    <div class="card-header">
      <span class="badge-device-pc">PC Bureau</span>
      <strong>Poste Administratif & Dispatching</strong>
    </div>
    <p style="font-size: 8.5pt; margin: 4px 0;">
      Utilisé par la <strong>Direction</strong>, le <strong>Bureau d'Études</strong>, les <strong>Conducteurs de travaux</strong> et la <strong>Comptabilité</strong>. Affichage plein écran avec barre latérale hiérarchisée, topbar globale avec recherche Ctrl+K, ordonnancement Gantt 60 fps et cartographie grand angle.
    </p>
  </div>

  <div class="card" style="border-left: 4px solid #2563eb;">
    <div class="card-header">
      <span class="badge-device-mob">Téléphone Mobile</span>
      <strong>Application Smartphone PWA</strong>
    </div>
    <p style="font-size: 8.5pt; margin: 4px 0;">
      Utilisé sur le terrain par les <strong>Techniciens</strong> et en mobilité par les <strong>Gestionnaires</strong>. Navigation ergonomique au pouce en bas de l'écran, prise de photo automatique avec compression &lt; 75 Ko, guidage GPS Waze / Google Maps en 1 clic et pointage certifié.
    </p>
  </div>
</div>

<div class="figure-box">
  <img src="${schema01}" alt="Cycle Complet TCE ANELEC" style="max-height: 140px; width: 100%; object-fit: contain;" />
  <div class="figure-caption">
    <strong>Schéma 1 :</strong> Le cycle opérationnel intégré TCE : Demande $\to$ Devis & Visite $\to$ Dispatch Gantt $\to$ Mobile Terrain $\to$ Facturation $\to$ Rentabilité.
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 3 : ARCHITECTURE & ERGONOMIE PC VS MOBILE -->
<h1>1. Architecture & Ergonomie : Version PC vs Mobile</h1>

<p>
  La plateforme a été entièrement adaptée pour offrir un confort d'usage optimal quel que soit l'appareil utilisé, avec <strong>zéro débordement horizontal</strong> et <strong>aucun texte masqué</strong>.
</p>

<div class="grid-2">
  <div>
    <h2>🖥️ Version PC & Ordinateur Portable</h2>
    <div class="step-container">
      <div class="step-row">
        <div class="step-pin">1</div>
        <div class="step-content">
          <div class="step-title">Barre latérale hiérarchisée (Sidebar 254px)</div>
          <div class="step-desc">Regroupement structuré en 3 blocs : <em>Espace de travail</em>, <em>Gestion</em>, et <em>Administration</em> avec pastilles de notifications urgentes.</div>
        </div>
      </div>
      <div class="step-row">
        <div class="step-pin">2</div>
        <div class="step-content">
          <div class="step-title">Barre supérieure universelle (Topbar)</div>
          <div class="step-desc">Titre de page sans coupure, recherche rapide Ctrl+K, date et heure de Paris en direct, boutons d'action rapide (+ Devis, + Intervention).</div>
        </div>
      </div>
      <div class="step-row">
        <div class="step-pin">3</div>
        <div class="step-content">
          <div class="step-title">Grilles fluides adaptatives</div>
          <div class="step-desc">Adaptation automatique sur les écrans Full HD (1920x1080), MacBook (1440x900) et PC portables compacts (1366x768 et 1280x800).</div>
        </div>
      </div>
    </div>
  </div>

  <div>
    <h2>📱 Version Téléphone Smartphone</h2>
    <div class="step-container">
      <div class="step-row">
        <div class="step-pin">1</div>
        <div class="step-content">
          <div class="step-title">Barre de navigation inférieure au pouce</div>
          <div class="step-desc">Accès immédiat d'une seule main aux sections clés : <em>Pilotage</em>, <em>Planning</em>, <em>Devis</em>, <em>Travaux</em>, <em>Carte</em>, <em>Factures</em>.</div>
        </div>
      </div>
      <div class="step-row">
        <div class="step-pin">2</div>
        <div class="step-content">
          <div class="step-title">Dégagement de sécurité (Padding 84px)</div>
          <div class="step-desc">Le bas de page conserve une marge de sécurité de 30px au-dessus de la barre : aucun bouton ou texte ne peut être caché derrière.</div>
        </div>
      </div>
      <div class="step-row">
        <div class="step-pin">3</div>
        <div class="step-content">
          <div class="step-title">Tableaux tactiles défilants</div>
          <div class="step-desc">Conteneurs <code>.table-scroll</code> avec glissement tactile fluide sans jamais élargir la page ni bloquer l'écran.</div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgSynthesePc}" alt="Tableau de bord PC" class="figure-img" style="max-height: 180px;" />
    <div class="figure-caption">
      <strong>Figure 1.1 :</strong> Interface PC (1440x900) — Affichage grand écran avec navigation latérale et cartes côte à côte.
    </div>
  </div>

  <div class="figure-box">
    <img src="${imgMobileSynthese}" alt="Tableau de bord Mobile" class="figure-img" style="max-height: 180px;" />
    <div class="figure-caption">
      <strong>Figure 1.2 :</strong> Interface Mobile (390x844) — Colonne unique épurée avec barre inférieure fixée pour usage au pouce.
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 4 : NOUVEAU TABLEAU DE BORD (3 VOLETS) -->
<h1>2. Le Nouveau Tableau de Bord (3 Volets Métier)</h1>

<p>
  Le tableau de bord d'ANELEC GROUPE a été entièrement repensé autour de 3 sous-onglets spécialisés accessibles d'un seul clic :
</p>

<h2>① Volet Synthèse — Le Baromètre Visuel</h2>
<div class="figure-box">
  <img src="${imgSynthesePc}" alt="Volet Synthèse PC" class="figure-img" style="max-height: 190px;" />
  <div class="figure-caption">
    <strong>Figure 2.1 :</strong> Volet Synthèse — 4 Cartes KPI principales, bloc prioritaire et planning journalier.
  </div>
</div>

<div class="grid-2">
  <div class="card">
    <div class="card-header"><span class="badge-action">4 KPIs Clés</span> Chiffres d'activité immédiats</div>
    <ul style="margin: 4px 0; padding-left: 18px; font-size: 8.5pt;">
      <li><strong>CA travaux réalisés :</strong> Montant HT des chantiers achevés dans le mois.</li>
      <li><strong>Prêt à facturer :</strong> Volume financier des travaux finis en attente d'émission.</li>
      <li><strong>Devis à suivre :</strong> Nombre de devis en cours et taux de concrétisation (%).</li>
      <li><strong>Rapports à valider :</strong> Signalements avec photos terrain reçus.</li>
    </ul>
  </div>

  <div class="card">
    <div class="card-header"><span class="badge-rule">Priorités & Planning</span> Actions directes</div>
    <ul style="margin: 4px 0; padding-left: 18px; font-size: 8.5pt;">
      <li><strong>À traiter en priorité :</strong> Alertes cliquables vers les rapports photos et devis signés.</li>
      <li><strong>Planning du jour :</strong> Chronologie des interventions planifiées avec statut coloré.</li>
      <li><strong>Activité par corps d'état :</strong> Tableau ventilé par métier (Électricité, Plomberie, etc.).</li>
    </ul>
  </div>
</div>

<h2>② Volet Opérations — La Console de Dispatch & Capacité</h2>
<div class="figure-box">
  <img src="${imgOperationsPc}" alt="Volet Opérations PC" class="figure-img" style="max-height: 170px;" />
  <div class="figure-caption">
    <strong>Figure 2.2 :</strong> Volet Opérations — Les 4 files de traitement, disponibilité des équipes et alertes photos.
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 5 : CARTE INTERACTIVE & CALCUL AUTOMATIQUE TOURNEES -->
<h1>3. Carte Interactive & Calcul Automatique d'Itinéraires</h1>

<p>
  Le module cartographique calcule automatiquement le parcours routier optimal (algorithme TSP 2-Opt) pour l'ensemble des interventions et visites de devis prévues.
</p>

<div class="card" style="border-left: 4px solid #047857; background: #ecfdf5;">
  <strong style="color: #065f46;">📍 Règle Métier Absolue : Départ & Arrivée Fixes au Siège ANELEC</strong><br>
  <span style="font-size: 8.5pt; color: #047857;">
    Le calcul d'itinéraire commence et se termine <strong>strictement au bureau d'ANELEC GROUPE (9 Rue des Colonnes, 75002 Paris)</strong>. La localisation GPS personnelle du smartphone n'est jamais utilisée pour le calcul du trajet, assurant une parfaite neutralité et un respect strict de la vie privée.
  </span>
</div>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgCartePc}" alt="Carte PC Grand Écran" class="figure-img" style="max-height: 200px;" />
    <div class="figure-caption">
      <strong>Figure 3.1 :</strong> Carte sur PC — Visualisation du circuit routier avec étiquettes de chantiers et fiche récapitulative.
    </div>
  </div>

  <div class="figure-box">
    <img src="${imgMobileCarte}" alt="Carte Mobile Smartphone" class="figure-img" style="max-height: 200px;" />
    <div class="figure-caption">
      <strong>Figure 3.2 :</strong> Carte sur Smartphone — Lancement du guidage GPS Waze ou Google Maps en 1 clic.
    </div>
  </div>
</div>

<h2>🗺️ Comment utiliser le calcul de tournée étape par étape :</h2>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">①</div>
    <div class="step-content">
      <div class="step-title">Sélectionner les filtres (Technicien & Date)</div>
      <div class="step-desc">
        En haut à droite, choisissez un technicien spécifique ou <em>« Tous les techniciens »</em>, ainsi que la date voulue ou <em>« Toutes les dates »</em>.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">②</div>
    <div class="step-content">
      <div class="step-title">Calcul automatique instantané (Bannière TSP 2-Opt)</div>
      <div class="step-desc">
        L'algorithme réordonne instantanément les adresses des interventions et visites pour minimiser les kilomètres parcourus et le temps passé dans les bouchons.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">③</div>
    <div class="step-content">
      <div class="step-title">Lancer la navigation GPS en 1 clic (Waze & Google Maps)</div>
      <div class="step-desc">
        Sur smartphone, le technicien appuie sur le bouton <strong>Google Maps</strong> ou <strong>Waze</strong> en face de l'étape correspondante : l'application GPS s'ouvre avec l'adresse exacte déjà saisie.
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 6 : PROCEDURE METIER 1 : DIRECTION & GERANCE -->
<h1>4. Procédure Métier A : Direction & Gérance</h1>

<p>
  <strong>Profil utilisateur :</strong> Super-Administrateur, Gérant, Directeur Administratif et Financier.
</p>

<h2>Objectif : Surveiller la rentabilité horaire, les marges et valider les pointages</h2>

<div class="figure-box">
  <img src="${imgRentabilitePc}" alt="Module Rentabilité et Marges" class="figure-img" style="max-height: 200px;" />
  <div class="figure-caption">
    <strong>Figure 4.1 :</strong> Console Contrôle de Gestion — Rentabilité horaire réelle (€ HT/h), marge brute et simulateur de coût chargé.
  </div>
</div>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">Consulter le Baromètre Économique (Tableau de bord > Analyse)</div>
      <div class="step-desc">
        Vérifiez le chiffre d'affaires cumulé HT et l'avancement dans l'entonnoir commercial à 5 étapes.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Ajuster le simulateur de coût moyen horaire</div>
      <div class="step-desc">
        Dans la section <em>Rentabilité & Équipes</em>, faites glisser le curseur (ex: 35 €/h) pour évaluer la marge nette dégagée par chaque corps d'état.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Vérifier les pointages journaliers de la flotte</div>
      <div class="step-desc">
        Dans <em>Utilisateurs & Accès</em>, auditez l'heure d'arrivée au bureau (☀️) et l'heure de départ le soir (🌙) pour chaque intervenant.
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 7 : PROCEDURE METIER 2 : BUREAU D'ETUDES (DEVIS) -->
<h1>5. Procédure Métier B : Bureau d'Études & Devis</h1>

<p>
  <strong>Profil utilisateur :</strong> Chargé d'Affaires, Métreur, Chiffreur TCE.
</p>

<h2>Objectif : Enregistrer les devis, programmer les visites et convertir en travaux sans doublon</h2>

<div class="figure-box">
  <img src="${imgDevisPc}" alt="Pipeline Devis Commercial" class="figure-img" style="max-height: 190px;" />
  <div class="figure-caption">
    <strong>Figure 5.1 :</strong> Pipeline Devis (22 colonnes) — Filtrage rapide, identification des visites et conversion.
  </div>
</div>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">Créer un nouveau devis chiffrage</div>
      <div class="step-desc">
        Cliquez sur le bouton <strong>+ Devis</strong> en haut à droite. Saisissez le client, l'adresse du chantier, l'objet et le corps d'état.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Prise de cotes nécessaire sur site ?</div>
      <div class="step-desc">
        Si un déplacement préalable est requis, cochez <em>« Visite nécessaire »</em>. Un créneau unifié <strong>VIS • DEV</strong> sera créé dans la bourse de planification pour le technicien.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Conversion sécurisée du devis accepté</div>
      <div class="step-desc">
        Dès signature du client, cliquez sur <strong>Convertir en intervention</strong>. Si le devis possède déjà une intervention, la <em>Grille de Reconversion Intelligente</em> s'affiche pour choisir la qualification exacte :
      </div>
    </div>
  </div>
</div>

<div class="figure-box">
  <img src="${imgModalReconv}" alt="Grille de Reconversion" class="figure-img" style="max-height: 150px;" />
  <div class="figure-caption">
    <strong>Figure 5.2 :</strong> Grille de Reconversion Sécurisée — Empêche les interventions doublons en qualifiant le motif : SAV, Reprise, Avenant ou Phase 2.
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 8 : PROCEDURE METIER 3 : DISPATCHER & PLANNING -->
<h1>6. Procédure Métier C : Dispatcher & Conducteur de Travaux</h1>

<p>
  <strong>Profil utilisateur :</strong> Dispatcher, Conducteur de Travaux, Ordonnanceur.
</p>

<h2>Objectif : Placer les missions sur le calendrier Gantt et optimiser le temps de route</h2>

<div class="figure-box">
  <img src="${imgPlanningPc}" alt="Planning Gantt Pro" class="figure-img" style="max-height: 200px;" />
  <div class="figure-caption">
    <strong>Figure 6.1 :</strong> Planning Gantt Pro Multi-Ressources — Glisser-déposer fluide, créneaux VIS-DEV et bourse de dispatch.
  </div>
</div>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">Consulter la Bourse de Dispatch</div>
      <div class="step-desc">
        Dans le volet latéral gauche du planning, retrouvez toutes les interventions et visites non planifiées.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Glisser-déposer sur la timeline du technicien</div>
      <div class="step-desc">
        Déposez la mission sur la ligne du technicien compétent à l'heure souhaitée (ex: 08h30). Étirez le bord inférieur du bloc pour ajuster sa durée.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Vérifier la cohérence géographique (Carte & Tournées)</div>
      <div class="step-desc">
        Basculez sur l'onglet <strong>Carte & Tournées</strong> pour vous assurer que les chantiers de la journée suivent un circuit routier logique sans allers-retours inutiles.
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 9 : PROCEDURE METIER 4 : TECHNICIEN TERRAIN (MOBILE) -->
<h1>7. Procédure Métier D : Technicien Terrain (Mobile PWA)</h1>

<p>
  <strong>Profil utilisateur :</strong> Technicien électricien, plombier, serrurier, peintre, menuisier, polyvalent TCE.
</p>

<h2>Objectif : Pointer son arrivée, naviguer sur le chantier, prendre les photos et clôturer</h2>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgMobileTech}" alt="App Mobile Technicien" class="figure-img" style="max-height: 250px;" />
    <div class="figure-caption">
      <strong>Figure 7.1 :</strong> Application Mobile Technicien — Pointage arrivée au bureau et bouton de prise de mission.
    </div>
  </div>

  <div>
    <div class="step-container">
      <div class="step-row">
        <div class="step-pin">1</div>
        <div class="step-content">
          <div class="step-title">Pointage obligatoire le matin (07h30)</div>
          <div class="step-desc">
            À l'arrivée au siège, appuyez sur <strong>☀️ Pointer mon arrivée au bureau</strong>. Le démarrage des chantiers est bloqué tant que ce pointage n'est pas effectué.
          </div>
        </div>
      </div>

      <div class="step-row">
        <div class="step-pin">2</div>
        <div class="step-content">
          <div class="step-title">Guidage GPS vers le chantier</div>
          <div class="step-desc">
            Appuyez sur <strong>Waze</strong> ou <strong>Google Maps</strong> pour lancer le guidage routier en direct.
          </div>
        </div>
      </div>

      <div class="step-row">
        <div class="step-pin">3</div>
        <div class="step-content">
          <div class="step-title">Prise de photos & Actions réalisées</div>
          <div class="step-desc">
            Prenez les photos avant/après (compressées automatiquement à moins de 75 Ko) et cochez les tâches effectuées.
          </div>
        </div>
      </div>

      <div class="step-row">
        <div class="step-pin">4</div>
        <div class="step-content">
          <div class="step-title">Clôture certifiée & Pointage soir</div>
          <div class="step-desc">
            Faites signer le client et appuyez sur <strong>Clôturer l'intervention</strong>. En fin de journée, appuyez sur <strong>🌙 Pointer ma fin de journée</strong>.
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 10 : PROCEDURE METIER 5 : FACTURATION & COMPTABILITE -->
<h1>8. Procédure Métier E : Facturation & Comptabilité</h1>

<p>
  <strong>Profil utilisateur :</strong> Responsable Facturation, Comptable, Gestionnaire Administratif.
</p>

<h2>Objectif : Facturer les chantiers achevés dans les 5 bacs de tri et arbitrer B2B vs B2C</h2>

<div class="figure-box">
  <img src="${imgFacturePc}" alt="Facturation et Bacs de Tri" class="figure-img" style="max-height: 200px;" />
  <div class="figure-caption">
    <strong>Figure 8.1 :</strong> Studio Facturation — Les 5 bacs de tri de conformité et arbitrage fiscal direct HT / TTC.
  </div>
</div>

<div class="card" style="border-left: 4px solid #b45309; background: #fffbeb;">
  <strong style="color: #92400e;">⚡ Règle d'Or Comptable ANELEC GROUPE :</strong><br>
  <span style="font-size: 8.5pt; color: #78350f;">
    <strong>« On ne facture que les chantiers achevés et vérifiés, jamais un devis »</strong>. Les visites de prise de cotes ne sont jamais facturées.
  </span>
</div>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">Consulter le Bac 1 : 🟢 À facturer (Prêtes)</div>
      <div class="step-desc">
        Seuls les chantiers avec rapport validé et justificatifs complets y apparaissent.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Choisir le régime fiscal adapté (B2B vs B2C)</div>
      <div class="step-desc">
        <strong>Clients B2B (Syndics, Professionnels) :</strong> Saisie en <strong>HT</strong>, autoliquidation TVA 0% (art. 283-2 nonies) ou TVA 20%, Bon de Commande obligatoire.<br>
        <strong>Clients B2C (Particuliers) :</strong> Saisie en <strong>TTC</strong>, TVA réduite à 10% (rénovation &gt; 2 ans) ou 5,5% (énergétique).
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Émettre la facture et transférer en comptabilité</div>
      <div class="step-desc">
        Validez la facture : le dossier bascule instantanément dans le Bac <strong>✅ Facturées</strong> et incrémente le chiffre d'affaires définitif.
      </div>
    </div>
  </div>
</div>

<!-- BANNIÈRE DE CERTIFICATION OFFICIELLE -->
<div class="card" style="margin-top: 20px; background: #0f172a; color: #ffffff; text-align: center; padding: 14px; border: 2px solid #047857;">
  <div style="font-size: 10.5pt; font-weight: 800; color: #10b981; margin-bottom: 4px;">
    ANELEC GROUPE — HOMOLOGATION OFFICIELLE DES PROCÉDURES TCE 2026
  </div>
  <div style="font-size: 8pt; color: #cbd5e1; max-width: 650px; margin: 0 auto;">
    Ce document constitue le manuel d'exploitation officiel du progiciel ANELEC TCE. Toutes les procédures décrites sont protégées et synchronisées en temps réel avec la base de données de production.
  </div>
</div>

</body>
</html>
`;

fs.writeFileSync(HTML_OUTPUT, htmlContent, 'utf-8');
console.log('Fichier HTML généré avec succès :', HTML_OUTPUT);

try {
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const cmd = `"${chromePath}" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${PDF_OUTPUT}" --no-pdf-header-footer "${HTML_OUTPUT}"`;
  console.log('Compilation du PDF officiel avec Chrome headless...');
  execSync(cmd, { stdio: 'inherit' });
  console.log('PDF officiel généré avec succès :', PDF_OUTPUT);

  fs.copyFileSync(PDF_OUTPUT, PDF_BACKUP);
  fs.copyFileSync(PDF_OUTPUT, ARTIFACT_PDF);
  console.log('PDF dupliqué avec succès vers :', ARTIFACT_PDF);
} catch (err) {
  console.error('Erreur lors de la génération du PDF :', err);
}
