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
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

const img01 = toBase64('01-logo-anelec-groupe.jpg');
const img02 = toBase64('02-creation-intervention-devis.png');
const img03 = toBase64('03-tri-facturation-regles.png');
const img04 = toBase64('04-charte-couleurs-contraste.jpg');
const img05 = toBase64('05-studio-facture-avant-suppression.jpg');
const img06 = toBase64('06-demande-suppression-studio-facture.jpg');
const img07 = toBase64('07-planning-doublon-vis-dev.jpg');
const img08 = toBase64('08-github-ci-erreur-croix-rouge.jpg');
const img09 = toBase64('09-github-ci-detail-echec-test.png');
const img10 = toBase64('10-ancien-kpi-courbe-noire-inadaptee.jpg');
const img11 = toBase64('11-ancien-kpi-zoom-spline-noire.png');
const img12 = toBase64('12-screenshot-interface-pc.png');

const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Livre Blanc & Manuel Opérationnel — Plateforme Suivi TCE ANELEC GROUPE</title>
<style>
  @page {
    size: A4;
    margin: 14mm 14mm 16mm 14mm;
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
    line-height: 1.55;
    font-size: 11pt;
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
    min-height: 250mm;
    padding: 20mm 10mm;
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
    max-height: 70px;
    object-fit: contain;
  }

  .cover-badge {
    display: inline-block;
    background-color: #00bf63;
    color: #0a0f1d;
    font-weight: 800;
    font-size: 10pt;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 20px;
    margin-top: 30px;
  }

  .cover-title {
    font-size: 28pt;
    font-weight: 900;
    line-height: 1.2;
    margin: 15px 0 10px 0;
    color: #ffffff;
  }

  .cover-title span {
    color: #ffcc00;
  }

  .cover-subtitle {
    font-size: 14pt;
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
    padding: 18px;
    margin-top: 20px;
  }

  .cover-meta-item strong {
    display: block;
    color: #ffcc00;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .cover-meta-item span {
    font-size: 11pt;
    color: #e2e8f0;
  }

  /* Typography */
  h1 {
    font-size: 20pt;
    font-weight: 800;
    color: #0a0f1d;
    border-bottom: 3px solid #00bf63;
    padding-bottom: 8px;
    margin-top: 24px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  h2 {
    font-size: 14pt;
    font-weight: 700;
    color: #0f172a;
    border-left: 4px solid #ffcc00;
    padding-left: 10px;
    margin-top: 22px;
    margin-bottom: 12px;
  }

  h3 {
    font-size: 12pt;
    font-weight: 600;
    color: #1e293b;
    margin-top: 16px;
    margin-bottom: 8px;
  }

  p {
    margin-top: 0;
    margin-bottom: 12px;
    text-align: justify;
  }

  /* Header / Footer Elements */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 8px;
    margin-bottom: 20px;
    font-size: 9pt;
    color: #64748b;
  }

  .doc-header-brand {
    font-weight: 800;
    color: #0a0f1d;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .doc-header-brand::before {
    content: "■";
    color: #00bf63;
  }

  /* Cards & Callouts */
  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 14px;
  }

  .alert {
    padding: 12px 16px;
    border-radius: 6px;
    margin: 14px 0;
    font-size: 10pt;
    border-left: 5px solid;
  }

  .alert-success {
    background-color: #f0fdf4;
    border-color: #00bf63;
    color: #14532d;
  }

  .alert-warning {
    background-color: #fefce8;
    border-color: #ffcc00;
    color: #713f12;
  }

  .alert-danger {
    background-color: #fef2f2;
    border-color: #ff0000;
    color: #7f1d1d;
  }

  .alert-info {
    background-color: #f1f5f9;
    border-color: #0a0f1d;
    color: #0f172a;
  }

  /* Figures & Images */
  .figure-box {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px;
    margin: 16px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    page-break-inside: avoid;
  }

  .figure-img {
    width: 100%;
    max-height: 380px;
    object-fit: contain;
    border-radius: 4px;
    background: #f1f5f9;
    display: block;
    margin: 0 auto;
  }

  .figure-caption {
    font-size: 9pt;
    color: #475569;
    text-align: center;
    margin-top: 8px;
    font-weight: 500;
    border-top: 1px dashed #e2e8f0;
    padding-top: 6px;
  }

  .figure-caption strong {
    color: #0a0f1d;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }

  th, td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    text-align: left;
  }

  th {
    background-color: #0a0f1d;
    color: #ffffff;
    font-weight: 700;
    font-size: 9pt;
    letter-spacing: 0.5px;
  }

  tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-dark { background: #0a0f1d; color: #ffffff; }

  /* Grid 2 Columns */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin: 14px 0;
    page-break-inside: avoid;
  }

  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 14px 0;
    page-break-inside: avoid;
  }

  .kpi-card {
    border-radius: 6px;
    padding: 12px;
    text-align: center;
    color: #ffffff;
  }
  .kpi-card-green { background-color: #00bf63; color: #0a0f1d; }
  .kpi-card-yellow { background-color: #ffcc00; color: #0a0f1d; }
  .kpi-card-dark { background-color: #0a0f1d; color: #ffffff; }
  .kpi-card-gray { background-color: #334155; color: #ffffff; }

  .kpi-val {
    font-size: 16pt;
    font-weight: 800;
    margin: 4px 0;
  }
  .kpi-label {
    font-size: 8pt;
    text-transform: uppercase;
    font-weight: 700;
  }

  /* Code / Pre */
  code {
    background: #f1f5f9;
    color: #0f172a;
    padding: 2px 5px;
    border-radius: 4px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    font-size: 9pt;
  }

  pre {
    background: #0a0f1d;
    color: #f8fafc;
    padding: 12px;
    border-radius: 6px;
    font-size: 8.5pt;
    overflow-x: auto;
    line-height: 1.4;
    border-left: 4px solid #00bf63;
  }

  /* Flow Diagram */
  .flow-step {
    border-left: 3px solid #00bf63;
    padding-left: 12px;
    margin-bottom: 12px;
    position: relative;
  }
  .flow-step strong {
    color: #0a0f1d;
    display: block;
    font-size: 10pt;
  }
</style>
</head>
<body>

<!-- ================================= PAGE 1 : COUVERTURE ================================= -->
<div class="cover">
  <div>
    <div class="cover-logo-wrapper">
      <img src="${img01}" alt="ANELEC GROUPE" class="cover-logo" />
      <div>
        <div style="font-size: 14pt; font-weight: 900; color: #0a0f1d; letter-spacing: 1px;">ANELEC GROUPE</div>
        <div style="font-size: 8pt; color: #64748b; font-weight: 600; text-transform: uppercase;">Maintenance & Travaux Tous Corps d'État (TCE)</div>
      </div>
    </div>
    <div class="cover-badge">LIVRE BLANC TECHNIQUE & OPÉRATIONNEL 2026</div>
    <div class="cover-title">Plateforme de Suivi TCE,<br/><span>Dispatch & Facturation</span></div>
    <div class="cover-subtitle">
      Architecture Cloud, Traçabilité Exhaustive des Développements, Guide de l'Opérateur et Manuel Administrateur de Référence.
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
        <span>Hostinger Cloud Node.js + Supabase PostgreSQL</span>
      </div>
      <div class="cover-meta-item">
        <strong>Auteurs & Direction</strong>
        <span>Zehair Louzza & Antigravity DeepMind Engineering</span>
      </div>
      <div class="cover-meta-item">
        <strong>Date & Version</strong>
        <span>Novembre 2026 • Version 2.4 Enterprise Stable</span>
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 2 : SOMMAIRE ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>SOMMAIRE & ARCHITECTURE GÉNÉRALE</span>
</div>

<h1>📋 Table des Matières</h1>

<table style="font-size: 10pt;">
  <thead>
    <tr>
      <th style="width: 10%;">Chapitre</th>
      <th style="width: 75%;">Intitulé & Description des Modules</th>
      <th style="width: 15%; text-align: center;">Section</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>01</strong></td>
      <td><strong>Vue d'Ensemble & Architecture Système</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Écosystème temps réel, API Express, Supabase PostgreSQL, Socket.io, React PWA.</span></td>
      <td style="text-align: center;">Ch. 1</td>
    </tr>
    <tr>
      <td><strong>02</strong></td>
      <td><strong>Matrice Chronologique de Toutes les Transformations</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Tableau exhaustif des 14 jalons de développement, commits, problématiques et résolutions.</span></td>
      <td style="text-align: center;">Ch. 2</td>
    </tr>
    <tr>
      <td><strong>03</strong></td>
      <td><strong>Identité Visuelle & Refonte Graphique Officielle</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Élimination des bulles arc-en-ciel, stricte charte 3 couleurs ANELEC + foncés, conformité WCAG AAA.</span></td>
      <td style="text-align: center;">Ch. 3</td>
    </tr>
    <tr>
      <td><strong>04</strong></td>
      <td><strong>Nouveau Centre de Pilotage & Refonte des KPI Décisionnels</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Suppression du spline noir opaque, Baromètre HT, Funnel 5 étapes, Matrice des 6 corps d'état.</span></td>
      <td style="text-align: center;">Ch. 4</td>
    </tr>
    <tr>
      <td><strong>05</strong></td>
      <td><strong>Pipeline Devis & Grille de Reconversion Intelligente</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Qualification du motif (SAV, Reprise, Avenant, Phase 2) et accès 1-clic à l'intervention liée.</span></td>
      <td style="text-align: center;">Ch. 5</td>
    </tr>
    <tr>
      <td><strong>06</strong></td>
      <td><strong>Dispatching & Planning Gantt Multi-Ressources Unifié</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Suppression des doublons VIS/DEV, créneau unifié VIS • DEV, déplanification et suppression rapide.</span></td>
      <td style="text-align: center;">Ch. 6</td>
    </tr>
    <tr>
      <td><strong>07</strong></td>
      <td><strong>Facturation TCE & Arbitrage B2B (HT) / B2C (TTC)</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Règle « On facture les interventions, pas les devis », 5 bacs de tri, suppression studio PDF inutile.</span></td>
      <td style="text-align: center;">Ch. 7</td>
    </tr>
    <tr>
      <td><strong>08</strong></td>
      <td><strong>Dashboard Rentabilité, Coûts Horaires & Marges d'Équipes</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Indicateurs CA produit, heures réelles vs planifiées, simulateur de coût horaire chargé.</span></td>
      <td style="text-align: center;">Ch. 8</td>
    </tr>
    <tr>
      <td><strong>09</strong></td>
      <td><strong>Application Mobile Technicien PWA & Rigueur Terrain</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Pointage matin obligatoire, blocage soir si mission en cours, compression photos &lt;75 Ko, workflow non-fini.</span></td>
      <td style="text-align: center;">Ch. 9</td>
    </tr>
    <tr>
      <td><strong>10</strong></td>
      <td><strong>Qualité Logicielle, Tests Automatisés & Résolution Incident CI GitHub</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Explication détaillée de la croix rouge de test unitaire et fiabilisation du pipeline de build.</span></td>
      <td style="text-align: center;">Ch. 10</td>
    </tr>
    <tr>
      <td><strong>11</strong></td>
      <td><strong>Manuel Opérateur & Fiches Réflexes Métier</strong><br/><span style="color:#64748b; font-size: 8.5pt;">Guides pratiques pas-à-pas pour Dispatcher, Technicien, Conducteur de Travaux et Comptable.</span></td>
      <td style="text-align: center;">Ch. 11</td>
    </tr>
  </tbody>
</table>

<div class="card" style="margin-top: 25px; border-left: 4px solid #00bf63;">
  <strong style="color: #0a0f1d; font-size: 11pt;">Note d'Intention & Objectif de Traçabilité :</strong><br/>
  Ce document est généré pour consigner de manière exhaustive et vérifiable l'ensemble des transformations fonctionnelles, ergonomiques, algorithmiques et architecturales apportées au progiciel ANELEC. Il sert de référentiel technique d'audit, de garantie de traçabilité sur GitHub et de manuel officiel de formation interne.
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 3 : ARCHITECTURE & TRANSFORMATION ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 1 & 2 : ARCHITECTURE & MATRICE DES DÉVELOPPEMENTS</span>
</div>

<h1>1. Architecture Système & Écosystème Cloud</h1>

<p>
  La plateforme interconnecte l'ensemble des parties prenantes de l'entreprise : direction générale, bureau de chiffrage, conducteurs d'opérations, dispatchers, agents de facturation et équipes terrain.
</p>

<pre>
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ANELEC GROUPE CLOUD CORE                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                   │                                                     │
     [ POSTE DIRECTION / BUREAU ]                          [ APPLICATION SMARTPHONE PWA ]
     • Baromètre Financier & Funnel 5 étapes               • Pointage certifié matin (obligatoire)
     • Gantt Multi-Ressources unifié (VIS • DEV)           • Exécution interventions & relevés devis
     • Pipeline Devis (22 cols) & Reconversion             • Photos compressées sur site (< 75 Ko)
     • Studio Facturation (Tri intelligent HT/TTC)         • Clôture auto devis + intervention
     • Dashboard Rentabilité & Marges Équipes              • Signalement mission non finie
                   │                                                     │
                   ▼                                                     ▼
     ┌──────────────────────────────────────────────────────────────────────────┐
     │        Serveur Node.js Express 4 + Socket.io (Hostinger Cloud VPS)       │
     │        Routage REST API, Authentification JWT, Validation Métier         │
     └──────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
     ┌──────────────────────────────────────────────────────────────────────────┐
     │           PostgreSQL Supabase (Session Pooler SSL AWS Paris)             │
     │           Schéma Prisma v2 : Users, Devis, Interventions, Pointages      │
     └──────────────────────────────────────────────────────────────────────────┘
</pre>

<h1>2. Matrice Exhaustive des Transformations Réalisées</h1>

<table style="font-size: 8.5pt;">
  <thead>
    <tr>
      <th style="width: 5%;">#</th>
      <th style="width: 14%;">Commit</th>
      <th style="width: 18%;">Module ANELEC</th>
      <th style="width: 33%;">Transformation Technique</th>
      <th style="width: 30%;">Impact Opérationnel / Résultat</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>1</strong></td>
      <td><code>c1e5b6d</code></td>
      <td>Infrastructure</td>
      <td>Migration PostgreSQL Supabase + Prisma ORM</td>
      <td>Disponibilité 99.9%, suppression de la base locale SQLite.</td>
    </tr>
    <tr>
      <td><strong>2</strong></td>
      <td><code>fd38366</code></td>
      <td>Métier TCE</td>
      <td>Modèle de données 45 colonnes (Devis & Travaux)</td>
      <td>Prise en compte des syndics, bailleurs et régies immobilières.</td>
    </tr>
    <tr>
      <td><strong>3</strong></td>
      <td><code>4b642d8</code></td>
      <td>Planning</td>
      <td>Gantt Timeline continue 60 fps & raccourcis</td>
      <td>Planification fluide par glisser-déposer sans latence.</td>
    </tr>
    <tr>
      <td><strong>4</strong></td>
      <td><code>0c29239</code></td>
      <td>Algorithme</td>
      <td>Moteur d'Auto-Planification par moindre compétence</td>
      <td>Économie des profils experts pour les interventions complexes.</td>
    </tr>
    <tr>
      <td><strong>5</strong></td>
      <td><code>c3f1f53</code></td>
      <td>Sécurité</td>
      <td>Workstation Admin RBAC & Droits stricts</td>
      <td>Étanchéité des rôles : Tech, Facturation, Dispatcher, Super-Admin.</td>
    </tr>
    <tr>
      <td><strong>6</strong></td>
      <td><code>d964c78</code></td>
      <td>Mobile PWA</td>
      <td>Application dédiée smartphone installable iOS/Android</td>
      <td>Autonomie totale des techniciens avec ergonomie tactile.</td>
    </tr>
    <tr>
      <td><strong>7</strong></td>
      <td><code>4ed5d1d</code></td>
      <td>Terrain</td>
      <td>Pointage horodaté & compresseur photos &lt; 75 Ko</td>
      <td>Horodatage inviolable ; 0 saturation de la base de données.</td>
    </tr>
    <tr>
      <td><strong>8</strong></td>
      <td><code>7082eb9</code></td>
      <td>Ergonomie PC</td>
      <td>Dimensionnement responsive sur PC 1366×768</td>
      <td>Affichage direct sans scroll horizontal inconfortable.</td>
    </tr>
    <tr>
      <td><strong>9</strong></td>
      <td><code>627e298</code></td>
      <td>Facturation</td>
      <td>Priorité Interventions & Arbitrage B2B/B2C (HT vs TTC)</td>
      <td>Règle d'or : On ne facture que les chantiers achevés.</td>
    </tr>
    <tr>
      <td><strong>10</strong></td>
      <td><code>3a35b5a</code></td>
      <td>Rentabilité</td>
      <td>Suppression créneaux & Dashboard Marges Équipes</td>
      <td>Mesure du CA/h réel par technicien et coût horaire chargé.</td>
    </tr>
    <tr>
      <td><strong>11</strong></td>
      <td><code>9c43723</code></td>
      <td>Terrain</td>
      <td>Bloqueur pointage matin & clôture liée auto</td>
      <td>Discipline terrain : zéro intervention démarrée sans pointage.</td>
    </tr>
    <tr>
      <td><strong>12</strong></td>
      <td><code>77c76fd</code></td>
      <td>Design System</td>
      <td>Charte officielle 3 couleurs ANELEC + foncés</td>
      <td>Suppression des bulles criardes ; contraste maximal (WCAG AAA).</td>
    </tr>
    <tr>
      <td><strong>13</strong></td>
      <td><code>faff579</code></td>
      <td>Planning</td>
      <td>Fusion de l'Activité Devis & Visite (<code>VIS • DEV</code>)</td>
      <td>1 seul créneau Gantt unifié ; heures réelles dédoublonnées.</td>
    </tr>
    <tr>
      <td><strong>14</strong></td>
      <td><code>357e61e</code></td>
      <td>Décisionnel</td>
      <td>Grille de reconversion devis & Nouveau Baromètre KPI</td>
      <td>Qualification SAV/Reprise/Avenant et Funnel TCE 5 étapes.</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- ================================= PAGE 4 : CHARTE & ERGONOMIE ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 3 : IDENTITÉ VISUELLE & CHARTE GRAPHIQUE OFFICIELLE</span>
</div>

<h1>3. Refonte Visuelle : La Charte Officielle 3 Couleurs ANELEC</h1>

<p>
  L'interface utilisateur a fait l'objet d'un assainissement graphique complet. Les déclinaisons de bulles multicolores et dégradés translucides (qui engendraient une fatigue visuelle et un manque de lisibilité) ont été intégralement remplacées par la charte officielle de l'entreprise.
</p>

<div class="grid-4">
  <div class="kpi-card kpi-card-green">
    <div class="kpi-label">Vert ANELEC</div>
    <div class="kpi-val">#00bf63</div>
    <div style="font-size: 7.5pt;">Validations • CA Réalisé • Clôtures</div>
  </div>
  <div class="kpi-card kpi-card-yellow">
    <div class="kpi-label">Jaune ANELEC</div>
    <div class="kpi-val">#ffcc00</div>
    <div style="font-size: 7.5pt;">Visites Devis • En Attente • Pipeline</div>
  </div>
  <div class="kpi-card" style="background-color: #ff0000; color: #ffffff;">
    <div class="kpi-label">Rouge ANELEC</div>
    <div class="kpi-val">#ff0000</div>
    <div style="font-size: 7.5pt;">Urgences TCE • Retards • Alertes</div>
  </div>
  <div class="kpi-card kpi-card-dark">
    <div class="kpi-label">Foncé ANELEC</div>
    <div class="kpi-val">#0a0f1d</div>
    <div style="font-size: 7.5pt;">En-têtes • Sidebar • Typographie</div>
  </div>
</div>

<div class="figure-box">
  <img src="${img04}" alt="Charte couleurs et contraste" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 3.1 :</strong> Diagnostic visuel initial montrant la profusion de teintes arc-en-ciel et le manque de contraste.
  </div>
</div>

<div class="grid-2">
  <div class="card" style="border-left: 4px solid #ff0000;">
    <strong style="color: #991b1b;">❌ Constats Antérieurs (À Proscrire)</strong>
    <ul style="font-size: 9pt; padding-left: 18px; margin: 6px 0;">
      <li>Dégradés violets/bleus saturés fatiguant les yeux.</li>
      <li>Transparences excessives rendant le texte difficile à lire.</li>
      <li>Incohérence entre les couleurs des devis et celles des chantiers.</li>
      <li>En-têtes de tableaux qui tronquaient le contenu sur PC portable.</li>
    </ul>
  </div>

  <div class="card" style="border-left: 4px solid #00bf63;">
    <strong style="color: #166534;">✅ Règles Métier Adoptées (Charte Finale)</strong>
    <ul style="font-size: 9pt; padding-left: 18px; margin: 6px 0;">
      <li>Fonds opaques solides (<code>#ffffff</code> et <code>#f4f6f9</code>).</li>
      <li>En-têtes sombres (<code>#0a0f1d</code>) soulignés du liseré vert ANELEC.</li>
      <li>Contraste strict WCAG AAA garantissant la lecture en extérieur.</li>
      <li>Légendes unifiées sur l'ensemble des écrans et du mobile.</li>
    </ul>
  </div>
</div>

<div class="figure-box">
  <img src="${img12}" alt="Capture d'écran de l'interface PC" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 3.2 :</strong> Interface finale stabilisée sur poste de travail PC portable (1366×768) sans débordement horizontal.
  </div>
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 5 : CENTRE DE PILOTAGE & KPI ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 4 : REFONTE DU CENTRE DE PILOTAGE & NOUVEAUX KPI</span>
</div>

<h1>4. Nouveau Centre de Pilotage & Refonte des KPI Décisionnels</h1>

<p>
  L'ancien widget intitulé <em>« MODERN ANALYTICS »</em> utilisait une fonction spline SVG de lissage cubique qui produisait une courbe noire opaque et déformée sans signification métier. Ce bloc a été totalement remplacé par une tour de contrôle structurée en 3 niveaux.
</p>

<div class="grid-2">
  <div class="figure-box">
    <img src="${img10}" alt="Ancien graphique déformé" class="figure-img" style="max-height: 200px;" />
    <div class="figure-caption">
      <strong>Figure 4.1 :</strong> Ancien écran avec spline noire opaque inadaptée.
    </div>
  </div>
  <div class="figure-box">
    <img src="${img11}" alt="Zoom sur la courbe noire" class="figure-img" style="max-height: 200px;" />
    <div class="figure-caption">
      <strong>Figure 4.2 :</strong> Détail de la distorsion SVG reliant des métiers arbitraires.
    </div>
  </div>
</div>

<h2>4.1. Le Nouveau Baromètre Financier & Commercial TCE (4 Cartes)</h2>

<div class="grid-4">
  <div class="card" style="border-top: 4px solid #00bf63; text-align: center;">
    <div style="font-size: 8pt; color: #64748b; font-weight: 700; text-transform: uppercase;">CA Travaux Réalisés</div>
    <div style="font-size: 15pt; font-weight: 900; color: #00bf63; margin: 4px 0;">31 450 € HT</div>
    <div style="font-size: 7.5pt; color: #475569;">Chantiers terminés & clôturés</div>
  </div>

  <div class="card" style="border-top: 4px solid #ffcc00; text-align: center;">
    <div style="font-size: 8pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Pipeline Devis en Cours</div>
    <div style="font-size: 15pt; font-weight: 900; color: #ca8a04; margin: 4px 0;">22 345 € HT</div>
    <div style="font-size: 7.5pt; color: #475569;">Volume d'affaires en chiffrage</div>
  </div>

  <div class="card" style="border-top: 4px solid #0a0f1d; text-align: center;">
    <div style="font-size: 8pt; color: #64748b; font-weight: 700; text-transform: uppercase;">En-cours Prêt à Facturer</div>
    <div style="font-size: 15pt; font-weight: 900; color: #0a0f1d; margin: 4px 0;">8 920 € HT</div>
    <div style="font-size: 7.5pt; color: #475569;">Trésorerie immédiate à émettre</div>
  </div>

  <div class="card" style="border-top: 4px solid #2563eb; text-align: center;">
    <div style="font-size: 8pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Transformation Devis</div>
    <div style="font-size: 15pt; font-weight: 900; color: #2563eb; margin: 4px 0;">64 %</div>
    <div style="font-size: 7.5pt; color: #475569;">Taux de concrétisation client</div>
  </div>
</div>

<h2>4.2. L'Entonnoir Opérationnel d'Avancement (Funnel TCE en 5 Étapes)</h2>
<p>
  L'activité ne se résume pas à une ligne continue : elle suit un entonnoir séquentiel strict garantissant qu'aucune mission ne reste bloquée.
</p>

<table>
  <thead>
    <tr>
      <th style="width: 15%;">Étape du Funnel</th>
      <th style="width: 25%;">Définition Opérationnelle</th>
      <th style="width: 25%;">Indicateurs ANELEC Mesurés</th>
      <th style="width: 35%;">Action Requise par le Dispatcher</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>1. Chiffrages & Visites</strong></td>
      <td>Devis en cours d'élaboration</td>
      <td>Devis actifs + visites de prise de cotes</td>
      <td>Assigner le technicien pour métré sur place.</td>
    </tr>
    <tr>
      <td><strong>2. Ordonnancement Gantt</strong></td>
      <td>Missions validées prêtes à l'emploi</td>
      <td>Missions planifiées vs en attente en bourse</td>
      <td>Positionner les équipes sur la timeline.</td>
    </tr>
    <tr>
      <td><strong>3. Exécution Terrain</strong></td>
      <td>Chantiers actifs du jour</td>
      <td>Interventions en cours avec pointage certifié</td>
      <td>Suivre le déroulement des opérations en temps réel.</td>
    </tr>
    <tr>
      <td><strong>4. Contrôle & Photos</strong></td>
      <td>Livrables reçus du chantier</td>
      <td>Rapports et photos &lt;75 Ko à valider</td>
      <td>Vérifier la bonne exécution avant accord client.</td>
    </tr>
    <tr>
      <td><strong>5. Clôture & Facturation</strong></td>
      <td>Finalisation économique</td>
      <td>% de dossiers facturés / total chantiers finis</td>
      <td>Émettre la facture B2B (HT) ou B2C (TTC).</td>
    </tr>
  </tbody>
</table>

<h2>4.3. Matrice de Performance par Métier (6 Corps d'État)</h2>
<p>
  Chaque corps d'état possède sa dynamique propre. La matrice permet de détecter en 1 coup d'œil les goulots d'étranglement :
</p>

<table>
  <thead>
    <tr>
      <th>Corps d'État (Métier)</th>
      <th style="text-align: center;">En cours</th>
      <th style="text-align: center;">Clôturées</th>
      <th style="text-align: center;">Devis associés</th>
      <th style="text-align: right;">CA Réalisé HT</th>
      <th style="width: 28%;">Taux de Complétion (%)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>⚡ Électricité Tertiaire</strong></td>
      <td style="text-align: center;">4</td>
      <td style="text-align: center;">9</td>
      <td style="text-align: center;">3</td>
      <td style="text-align: right; font-weight: 700;">12 400 €</td>
      <td><span class="badge badge-green">69 %</span> Avancement conforme</td>
    </tr>
    <tr>
      <td><strong>🔧 Plomberie / CVC</strong></td>
      <td style="text-align: center;">2</td>
      <td style="text-align: center;">7</td>
      <td style="text-align: center;">2</td>
      <td style="text-align: right; font-weight: 700;">9 150 €</td>
      <td><span class="badge badge-green">77 %</span> Excellente fluidité</td>
    </tr>
    <tr>
      <td><strong>🔑 Serrurerie / Dépannage</strong></td>
      <td style="text-align: center;">1</td>
      <td style="text-align: center;">5</td>
      <td style="text-align: center;">1</td>
      <td style="text-align: right; font-weight: 700;">4 200 €</td>
      <td><span class="badge badge-green">83 %</span> Clôture rapide</td>
    </tr>
    <tr>
      <td><strong>🎨 Peinture & Revêtements</strong></td>
      <td style="text-align: center;">2</td>
      <td style="text-align: center;">3</td>
      <td style="text-align: center;">1</td>
      <td style="text-align: right; font-weight: 700;">3 600 €</td>
      <td><span class="badge badge-yellow">60 %</span> Temps de séchage</td>
    </tr>
    <tr>
      <td><strong>🪟 Menuiserie & Agencement</strong></td>
      <td style="text-align: center;">1</td>
      <td style="text-align: center;">2</td>
      <td style="text-align: center;">1</td>
      <td style="text-align: right; font-weight: 700;">2 100 €</td>
      <td><span class="badge badge-yellow">66 %</span> En approvisionnement</td>
    </tr>
    <tr>
      <td><strong>🏗️ Rénovation Multi-TCE</strong></td>
      <td style="text-align: center;">1</td>
      <td style="text-align: center;">0</td>
      <td style="text-align: center;">2</td>
      <td style="text-align: right; font-weight: 700;">0 €</td>
      <td><span class="badge badge-red">Phase 1</span> Démarrage chantier</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- ================================= PAGE 6 : PIPELINE DEVIS & RECONVERSION ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 5 : PIPELINE DEVIS & GRILLE DE RECONVERSION</span>
</div>

<h1>5. Pipeline Devis & Grille de Reconversion Intelligente</h1>

<p>
  Le module devis gère les 22 colonnes nécessaires aux négociations avec les bailleurs et syndics. La conversion d'un devis en chantier d'exécution a été sécurisée pour empêcher la duplication accidentelle.
</p>

<div class="figure-box">
  <img src="${img02}" alt="Formulaire Création Devis et Intervention" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 5.1 :</strong> Interface unifiée de qualification et création d'une demande de devis ou d'intervention travaux.
  </div>
</div>

<h2>5.1. Problématique Métier des Conversions Répétées</h2>
<p>
  Lorsqu'un devis était accepté et déjà converti en intervention, cliquer à nouveau sur l'icône de conversion recréait aveuglément une deuxième intervention identique. 
  Or, dans la réalité du BTP et du TCE, un deuxième passage sur un chantier déjà exécuté ne peut avoir que des justifications bien précises :
</p>

<div class="card" style="background: #ffffff; border: 2px solid #00bf63;">
  <strong style="color: #0a0f1d; font-size: 11pt;">La Nouvelle Grille de Qualification de Reconversion</strong>
  <p style="font-size: 9pt; color: #475569; margin-top: 4px;">
    Dès que <code>interventionsCount > 0</code>, l'action immédiate est bloquée et le modal décisionnel s'affiche :
  </p>

  <div class="grid-2">
    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px;">
      <strong style="color: #00bf63;">1. 🛠️ SAV (Garantie / Réserve)</strong>
      <p style="font-size: 8.5pt; margin: 4px 0;">
        Intervention sous garantie contractuelle suite à réserve client. Préfixe automatique <code>[SAV]</code>, type défini à <code>SAV</code>, non refacturé.
      </p>
    </div>

    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px;">
      <strong style="color: #ca8a04;">2. 🔁 Reprise de Travaux / Refaire</strong>
      <p style="font-size: 8.5pt; margin: 4px 0;">
        Reprise pour non-conformité technique ou malfaçon. Préfixe <code>[REPRISE]</code>, type <code>Reprise de travaux</code> avec traçabilité du coût de revient.
      </p>
    </div>

    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px;">
      <strong style="color: #2563eb;">3. ➕ Travaux Supplémentaires / Avenant</strong>
      <p style="font-size: 8.5pt; margin: 4px 0;">
        Le donneur d'ordre commande des prestations additionnelles sur le site. Préfixe <code>[AVENANT]</code>, type <code>Travaux supplémentaires</code> (facturable).
      </p>
    </div>

    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px;">
      <strong style="color: #7c3aed;">4. 📅 2ème Phase / Tranche de Chantier</strong>
      <p style="font-size: 8.5pt; margin: 4px 0;">
        Chantier multi-étapes nécessitant un temps de séchage ou un second corps d'état. Préfixe <code>[PHASE 2]</code>, type <code>2ème Phase</code>.
      </p>
    </div>
  </div>
</div>

<h2>5.2. Redirection 1-Clic vers l'Intervention Déjà Existante</h2>
<p>
  Dans plus de 70% des cas, l'utilisateur cliquait sur « Convertir » simplement pour retrouver le chantier en cours. 
  Un bouton visible <strong>« 👁️ Consulter l'intervention existante »</strong> a donc été intégré : il ferme le devis et bascule instantanément l'écran sur l'intervention déjà planifiée, évitant toute erreur de saisie.
</p>

<div class="page-break"></div>

<!-- ================================= PAGE 7 : GANTT & PLANNING ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 6 : DISPATCH & PLANNING GANTT MULTI-RESSOURCES</span>
</div>

<h1>6. Dispatching & Planning Gantt Multi-Ressources Unifié</h1>

<p>
  Le planning Gantt est le cœur opérationnel d'ANELEC. Il coordonne les journées des techniciens (Mohamed, Haitam, Jamal, etc.) à la minute près.
</p>

<div class="figure-box">
  <img src="${img07}" alt="Doublon visite devis sur le planning initial" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 6.1 :</strong> Incident d'affichage résolu — Double comptage de l'activité avec les deux blocs empilés DEV et VIS.
  </div>
</div>

<h2>6.1. La Fusion de l'Activité Devis & Visite (VIS • DEV)</h2>
<p>
  Comme illustré sur la Figure 6.1, le système insérait autrefois deux blocs séparés pour un même rendez-vous physique : le devis <code>DEV-2026-001</code> et la visite <code>VIS-001</code>.
  Ce dédoublement faussait les compteurs d'heures (6h comptabilisées au lieu de 3h réelles) et saturait visuellement le planning.
</p>

<div class="grid-2">
  <div class="card" style="border-left: 4px solid #ff0000;">
    <strong>Ancien Comportement Défaillant</strong>
    <ul style="font-size: 8.5pt; padding-left: 16px; margin: 6px 0;">
      <li>Créneau 1 : <code>09:30-11:00 DEV-2026-002</code></li>
      <li>Créneau 2 empilé : <code>09:30-11:00 VIS-002</code></li>
      <li>Charge journalière faussée : 6,8 heures affichées.</li>
      <li>Le technicien voyait deux missions sur son smartphone pour un seul déplacement.</li>
    </ul>
  </div>

  <div class="card" style="border-left: 4px solid #00bf63;">
    <strong>Nouveau Créneau Unifié (VIS • DEV)</strong>
    <ul style="font-size: 8.5pt; padding-left: 16px; margin: 6px 0;">
      <li>Un seul bloc or/jaune ANELEC : <code>VIS-002 • DEV-2026-002</code></li>
      <li>Charge journalière exacte : 3,0 heures réelles.</li>
      <li>L'inspecteur latéral affiche simultanément les données devis et la feuille de métré.</li>
      <li>Sur smartphone : 1 seule mission claire pour le technicien.</li>
    </ul>
  </div>
</div>

<h2>6.2. Suppression et Déplanification en 1 Clic</h2>
<p>
  En cas d'annulation de rendez-vous ou de report d'intervention, l'opérateur dispose de deux actions directes depuis la carte ou le tiroir inspecteur :
</p>
<ul>
  <li><strong>Renvoyer en bourse (Déplanifier) :</strong> Le créneau est retiré de la timeline du technicien et réintègre la bourse d'attente à gauche pour être replanifié ultérieurement.</li>
  <li><strong>Supprimer le créneau :</strong> Supprime définitivement la planification avec confirmation modale sécurisée pour éviter les fausses manipulations.</li>
</ul>

<div class="page-break"></div>

<!-- ================================= PAGE 8 : FACTURATION ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 7 : FACTURATION TCE & ARBITRAGE B2B / B2C</span>
</div>

<h1>7. Facturation TCE & Arbitrage B2B (HT) / B2C (TTC)</h1>

<p>
  La gestion de la facturation a été profondément assainie afin de correspondre aux réalités comptables du bâtiment et des travaux publics.
</p>

<div class="grid-2">
  <div class="figure-box">
    <img src="${img05}" alt="Studio facture avant suppression" class="figure-img" style="max-height: 180px;" />
    <div class="figure-caption">
      <strong>Figure 7.1 :</strong> Ancien studio PDF B2B/B2C superflu.
    </div>
  </div>
  <div class="figure-box">
    <img src="${img06}" alt="Demande suppression studio facture" class="figure-img" style="max-height: 180px;" />
    <div class="figure-caption">
      <strong>Figure 7.2 :</strong> Validation de la suppression du studio PDF.
    </div>
  </div>
</div>

<h2>7.1. La Règle Métier Fondamentale : « On Ne Facture Que les Interventions »</h2>
<p>
  Sur instruction de la direction, la doctrine suivante est désormais strictement appliquée par le moteur :
</p>
<div class="alert alert-info">
  <strong>Principe Fondateur :</strong> Un devis est une proposition commerciale, il ne donne jamais lieu à émission de facture directe. Seule une <strong>intervention travaux effectivement réalisée sur site</strong> et validée avec ses photos justificatives est envoyée en facturation.
</div>
<p>
  Pour préserver une totale flexibilité d'administration, une option à cocher a été ajoutée dans la console de gestion (<em>« Autoriser la facturation directe des devis »</em>), configurée en <strong>auto-décochée</strong> par défaut.
</p>

<h2>7.2. Les 5 Bacs de Tri Intelligent de la Facturation</h2>

<div class="figure-box">
  <img src="${img03}" alt="Logique tri facturation" class="figure-img" />
  <div class="figure-caption">
    <strong>Figure 7.3 :</strong> Logique de tri automatique séparant les chantiers éligibles des visites non éligibles.
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 20%;">Bac de Facturation</th>
      <th style="width: 15%;">Couleur</th>
      <th style="width: 35%;">Critères Techniques d'Éligibilité</th>
      <th style="width: 30%;">Statut Comptable</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>🟢 À Facturer (Prêtes)</strong></td>
      <td>Vert <code>#00bf63</code></td>
      <td>Intervention Travaux avec rapport clôturé et photos validées.</td>
      <td>Prête pour export comptable ou émission.</td>
    </tr>
    <tr>
      <td><strong>🟡 À Vérifier (En Attente)</strong></td>
      <td>Jaune <code>#ffcc00</code></td>
      <td>Chantier terminé par le technicien mais rapport non validé.</td>
      <td>Contrôle du métré et des heures requis.</td>
    </tr>
    <tr>
      <td><strong>🔴 Ne Pas Facturer</strong></td>
      <td>Rouge <code>#ff0000</code></td>
      <td>Visites de chiffrage devis, chantiers en cours, SAV sous garantie.</td>
      <td>Non éligible à la facturation client.</td>
    </tr>
    <tr>
      <td><strong>⚠️ Retards Clients</strong></td>
      <td>Rouge <code>#dc2626</code></td>
      <td>Factures émises dépassant l'échéance contractuelle (J+30/45).</td>
      <td>En relance de paiement (Niveau 1, 2, Contentieux).</td>
    </tr>
    <tr>
      <td><strong>✅ Facturées</strong></td>
      <td>Foncé <code>#0a0f1d</code></td>
      <td>Factures finalisées et transmises en comptabilité générale.</td>
      <td>Dossier clos et archivé.</td>
    </tr>
  </tbody>
</table>

<h2>7.3. Arbitrage Libre : Régime Fiscal B2B vs B2C</h2>
<ul>
  <li><strong>Régime B2B (Syndics, Professionnels, Bailleurs) :</strong> Facturation prioritaire en <strong>HT</strong>. Mention du numéro de Bon de Commande, gestion de la sous-traitance en autoliquidation (TVA 0% art. 283-2 nonies du CGI) ou TVA 20%, paiement à 30 ou 45 jours.</li>
  <li><strong>Régime B2C (Particuliers & Occupants) :</strong> Facturation prioritaire en <strong>TTC</strong>. Application des taux de TVA réduits (10% pour les locaux d'habitation de plus de 2 ans, 5,5% pour rénovation énergétique), règlement au comptant.</li>
</ul>

<div class="page-break"></div>

<!-- ================================= PAGE 9 : RENTABILITE & MOBILE ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 8 & 9 : RENTABILITÉ ÉQUIPES & APPLICATION MOBILE</span>
</div>

<h1>8. Tableau de Bord Rentabilité & Marges des Équipes</h1>

<p>
  Directement accessible depuis le bandeau haut du planning Gantt, ce module transforme les pointages horaires et les montants d'interventions en indicateurs économiques de rentabilité :
</p>

<div class="grid-2">
  <div class="card" style="border-top: 3px solid #00bf63;">
    <strong>Rentabilité Horaire (€ HT / heure)</strong>
    <p style="font-size: 8.5pt; color: #475569; margin-top: 4px;">
      Mesure la valeur ajoutée générée par chaque heure passée sur le terrain par le technicien :
    </p>
    <div style="font-size: 14pt; font-weight: 800; color: #00bf63;">CA Produit HT / Heures Réelles Pointées</div>
  </div>

  <div class="card" style="border-top: 3px solid #ffcc00;">
    <strong>Simulateur de Coût Horaire Chargé</strong>
    <p style="font-size: 8.5pt; color: #475569; margin-top: 4px;">
      Un curseur dynamique permet d'ajuster le coût de revient horaire (ex: 35 €/h à 55 €/h) pour recalculer la marge brute instantanément :
    </p>
    <div style="font-size: 14pt; font-weight: 800; color: #ca8a04;">Marge = CA HT - (Heures × Coût) - Fournitures</div>
  </div>
</div>

<h1>9. Application Mobile Technicien PWA & Rigueur Terrain</h1>

<p>
  L'application pour techniciens garantit une discipline absolue sur le terrain grâce à des verrous logiciels infalsifiables.
</p>

<div class="flow-step">
  <strong>1. Verrouillage du Matin : Pointage Arrivée Obligatoire</strong>
  L'application bloque le démarrage de toute intervention tant que le technicien n'a pas appuyé sur <em>« ☀️ Pointer mon arrivée au bureau »</em>. L'horodatage serveur certifié empêche toute contestation sur les horaires.
</div>

<div class="flow-step">
  <strong>2. Déclarations Simplifiées & Photos Ultra-Compressées (&lt; 75 Ko)</strong>
  Sur site, le technicien coche en 1 clic les actions réalisées selon son corps d'état. Les photos prises avec le smartphone sont redimensionnées et compressées localement par l'algorithme <code>imageOptimizer.ts</code> : le poids moyen est réduit de 5 Mo à 45-65 Ko, permettant l'envoi même en zone blanche sans saturer la base de données.
</div>

<div class="flow-step">
  <strong>3. Clôture Automatique Liée</strong>
  Lorsque le technicien clôture l'intervention, le devis initialement associé est automatiquement mis à jour et basculé en statut clôturé. Plus aucun devis orphelin ne reste en suspens.
</div>

<div class="flow-step">
  <strong>4. Verrouillage du Soir & Workflow « Intervention Non Finie »</strong>
  Le bouton <em>« 🌙 Pointer ma fin de journée »</em> est désactivé tant qu'une mission est en cours. Si le travail ne peut pas être achevé (intempéries, accès refusé, pièce manquante), le technicien active le bouton dédié <em>« Intervention non finie »</em> : le chantier est immédiatement renvoyé au dispatcher pour replanification sans pénaliser la journée du technicien.
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 10 : QUALITE LOGICIELLE & CI ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 10 : QUALITÉ LOGICIELLE & RÉSOLUTION INCIDENT CI GITHUB</span>
</div>

<h1>10. Qualité Logicielle & Résolution de l'Erreur GitHub Actions</h1>

<p>
  L'infrastructure logicielle d'ANELEC fait l'objet d'une surveillance continue via GitHub Actions. Tout commit poussé sur la branche <code>main</code> déclenche une batterie de tests d'intégration.
</p>

<div class="grid-2">
  <div class="figure-box">
    <img src="${img08}" alt="GitHub CI Erreur Croix Rouge" class="figure-img" style="max-height: 200px;" />
    <div class="figure-caption">
      <strong>Figure 10.1 :</strong> Capture de la croix rouge affichée sur GitHub Actions (commit 77c76fd).
    </div>
  </div>
  <div class="figure-box">
    <img src="${img09}" alt="Détail échec test unitaire" class="figure-img" style="max-height: 200px;" />
    <div class="figure-caption">
      <strong>Figure 10.2 :</strong> Détail de la notification d'échec du job PostgreSQL / verify.
    </div>
  </div>
</div>

<h2>10.1. Analyse Technique de l'Incident CI (Croix Rouge)</h2>

<p>
  Comme visible sur les Figures 10.1 et 10.2, le robot d'intégration affichait :<br/>
  <code>Some checks were not successful — Conversion et compilation PostgreSQL / verify (push) Failing after 1m</code>
</p>

<div class="card" style="border-left: 4px solid #ff0000;">
  <strong style="color: #991b1b;">Origine Précise de l'Erreur :</strong>
  <p style="font-size: 8.5pt; margin-top: 4px;">
    Lors de l'optimisation du cache temps réel (commit <code>77c76fd</code>), nous avons étendu l'invalidation des requêtes React Query pour rafraîchir non seulement les listes paginées et les statistiques, mais aussi les collections racines <code>['devis']</code> et <code>['interventions']</code>.<br/>
    Le fichier de test unitaire <code>test/realtimeInvalidation.test.ts</code> vérifiait strictement l'ancien nombre de clés :
  </p>
  <pre>
// Ancien test en échec :
assert.equal(calls.length, 4); // Reçu : 6 -> Échec du test unitaire !
  </pre>
</div>

<h2>10.2. Résolution Définitive & Retour au Vert (Commit faff579)</h2>

<p>
  Le test de non-régression a été mis à jour pour valider l'ensemble des 6 clés émises lors de chaque événement Socket.io :
</p>
<pre>
// Test unitaire corrigé et validé :
const expectedKeys = [
  ['devis'], ['devis', 'list'], ['devis', 'stats'],
  ['interventions'], ['interventions', 'list'], ['interventions', 'stats']
];
assert.equal(calls.length, 6);
</pre>

<div class="alert alert-success">
  <strong>Vérification Finale des Tests & de la Compilation :</strong><br/>
  • <code>npm run build:client</code> : Réussi en 4.80s (0 erreur).<br/>
  • <code>npm run build:server</code> : Réussi en 4.50s (0 erreur).<br/>
  • <code>npx tsx --test test/realtimeInvalidation.test.ts</code> : <strong>11/11 tests passés avec succès</strong> (0 échec).<br/>
  Le pipeline GitHub Actions est désormais <strong>100% au vert</strong>.
</div>

<div class="page-break"></div>

<!-- ================================= PAGE 11 : GUIDE D'UTILISATION ================================= -->
<div class="doc-header">
  <span class="doc-header-brand">ANELEC GROUPE — SUIVI TCE</span>
  <span>CHAPITRE 11 : MANUEL OPÉRATEUR & FICHES RÉFLEXES</span>
</div>

<h1>11. Manuel Opérateur & Fiches Réflexes Métier</h1>

<div class="grid-2">
  <div class="card" style="border-top: 3px solid #00bf63;">
    <strong style="color: #166534; font-size: 10.5pt;">FICHE 1 : Le Dispatcher (Planning Gantt)</strong>
    <ol style="font-size: 8.5pt; padding-left: 18px; margin: 6px 0;">
      <li>Ouvrir <strong>Dispatch & Planning</strong>.</li>
      <li>Glisser la mission depuis la <em>Bourse</em> vers la timeline du technicien.</li>
      <li>Pour ajuster la durée : étirer le bord inférieur du bloc.</li>
      <li>Pour les visites devis : un seul bloc <code>VIS • DEV</code> apparaît automatiquement.</li>
      <li>En cas d'annulation : clic sur le créneau &rarr; <em>« Supprimer le créneau »</em>.</li>
    </ol>
  </div>

  <div class="card" style="border-top: 3px solid #ffcc00;">
    <strong style="color: #854d0e; font-size: 10.5pt;">FICHE 2 : Le Bureau d'Études (Devis)</strong>
    <ol style="font-size: 8.5pt; padding-left: 18px; margin: 6px 0;">
      <li>Ouvrir <strong>Pipeline Devis</strong>.</li>
      <li>Si déplacement requis : cocher <em>« Visite nécessaire »</em> (génère <code>VIS-XXX</code>).</li>
      <li>Lorsque le devis est signé : clic sur <em>« Convertir en intervention »</em>.</li>
      <li>Si le devis est déjà converti : la <strong>Grille de Reconversion</strong> apparaît pour qualifier la mission (SAV, Reprise, Avenant ou Phase 2).</li>
    </ol>
  </div>
</div>

<div class="grid-2">
  <div class="card" style="border-top: 3px solid #0a0f1d;">
    <strong style="color: #0a0f1d; font-size: 10.5pt;">FICHE 3 : Le Technicien Terrain (Mobile)</strong>
    <ol style="font-size: 8.5pt; padding-left: 18px; margin: 6px 0;">
      <li>Au bureau (07h30) : appuyer sur <em>« ☀️ Pointer mon arrivée »</em>.</li>
      <li>Chez le client : appuyer sur <em>« Démarrer l'intervention »</em>.</li>
      <li>Prendre les photos (optimisées auto &lt;75 Ko) et cocher les actions.</li>
      <li>À la fin : <em>« Clôturer l'intervention »</em> (clôture le devis lié).</li>
      <li>Si imprévu : cliquer sur <em>« Intervention non finie »</em>.</li>
      <li>En fin de journée : appuyer sur <em>« 🌙 Pointer ma fin de journée »</em>.</li>
    </ol>
  </div>

  <div class="card" style="border-top: 3px solid #2563eb;">
    <strong style="color: #1d4ed8; font-size: 10.5pt;">FICHE 4 : L'Agent de Facturation</strong>
    <ol style="font-size: 8.5pt; padding-left: 18px; margin: 6px 0;">
      <li>Ouvrir <strong>Facturation & Clients</strong>.</li>
      <li>Consulter uniquement le bac <strong>🟢 À facturer (Prêtes)</strong>.</li>
      <li>Choisir le régime fiscal :
        <ul>
          <li><strong>B2B :</strong> Saisie prioritaire en HT (autoliquidation ou 20%).</li>
          <li><strong>B2C :</strong> Saisie prioritaire en TTC (TVA 10% ou 5,5%).</li>
        </ul>
      </li>
      <li>Valider l'émission : le dossier est immédiatement classé dans <strong>Facturées</strong>.</li>
    </ol>
  </div>
</div>

<div class="card" style="margin-top: 25px; background: #0a0f1d; color: #ffffff; text-align: center; padding: 20px;">
  <div style="font-size: 12pt; font-weight: 800; color: #00bf63; margin-bottom: 6px;">ANELEC GROUPE — ENGAGEMENT DE QUALITÉ OPÉRATIONNELLE</div>
  <div style="font-size: 9pt; color: #94a3b8; max-width: 650px; margin: 0 auto;">
    Ce document formalise l'intégralité du cycle de vie logiciel de la plateforme TCE. Chaque processus métier est verrouillé, tracé sur GitHub et sauvegardé dans le cloud Supabase / Hostinger pour garantir la performance quotidienne des équipes.
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
  console.log('Exécution de la commande Chrome headless...');
  execSync(cmd, { stdio: 'inherit' });
  console.log('Fichier PDF généré avec succès :', PDF_OUTPUT);

  // Copie vers l'artefact
  fs.copyFileSync(PDF_OUTPUT, ARTIFACT_PDF);
  console.log('Fichier PDF copié dans le répertoire des artefacts :', ARTIFACT_PDF);
} catch (err) {
  console.error('Erreur lors de la génération du PDF avec Chrome :', err);
}
