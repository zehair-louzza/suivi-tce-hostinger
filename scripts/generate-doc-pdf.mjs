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

// Chargement des images et schémas
const imgLogo = toBase64('01-logo-anelec-groupe.png');
const imgMobile01Missions = toBase64('mobile-01-missions.png');
const imgMobile02Tournee = toBase64('mobile-02-tournee.png');
const imgMobile03Historique = toBase64('mobile-03-historique.png');
const imgMobile04Profil = toBase64('mobile-04-profil.png');
const imgDoc01CreationCompte = toBase64('doc-01-creation-compte-google-entreprise.png');
const imgDoc02ActivationEmail = toBase64('doc-02-activation-confirmation-email.png');
const imgDoc03EmailOfficiel = toBase64('doc-03-email-officiel-activation.png');
const imgDoc04DashboardCA = toBase64('doc-04-dashboard-sky-ice-ca.png');
const imgDoc05DashboardVolume = toBase64('doc-05-dashboard-volume-donneurs-ordre.png');
const imgDoc06SituationExcel = toBase64('doc-06-export-situation-excel-dates.png');
const imgDoc07DevisPipeline = toBase64('doc-07-devis-pipeline.png');
const imgDoc08Interventions = toBase64('doc-08-interventions-tce.png');
const imgDoc09CarteAvant = toBase64('doc-09-carte-avant-cloture.png');
const imgDoc10MobileGpsModal = toBase64('doc-10-mobile-cloture-gps-modal.png');
const imgDoc11MobileToast = toBase64('doc-11-mobile-missions-cloturees-toast.png');
const imgDoc12CarteApres = toBase64('doc-12-carte-apres-retrait-missions-finies.png');
const imgDoc13FacturationKpi = toBase64('doc-13-facturation-5-bacs-kpi.png');
const imgDoc14FacturationDiagnostic = toBase64('doc-14-facturation-diagnostic-retards.png');
const imgDoc15AdminSmtp = toBase64('doc-15-admin-workstation-smtp.png');
const imgDoc16ProfilsClients = toBase64('doc-16-profils-donneurs-ordre.png');
const imgDoc17FicheClient = toBase64('doc-17-fiche-technique-client-modal.png');
const imgDoc18RapportEmail = toBase64('doc-18-envoi-rapport-email-modal.png');
const imgPlanningGantt = toBase64('04-dispatch-planning-gantt-pc.png');
const imgModalReconv = toBase64('04b-grille-reconversion-modal.png');

const schema01Cycle = toBase64('schema-01-cycle-tce.svg');
const schema05Supabase = toBase64('schema-05-supabase-multitenant-architecture.svg');

const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Guide d'Utilisation & Manuel Opérationnel — ANELEC GROUPE TCE</title>
<style>
  @page {
    size: A4;
    margin: 10mm 12mm 12mm 12mm;
    @bottom-right {
      content: "Page " counter(page);
      font-size: 8pt;
      font-weight: 600;
      color: #64748b;
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
    max-height: 56px;
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
    font-weight: 700;
  }

  .cover-body {
    margin: 25mm 0 15mm 0;
  }

  .cover-title {
    font-size: 26pt;
    font-weight: 800;
    line-height: 1.2;
    margin: 0 0 12px 0;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .cover-title span {
    color: #10b981;
  }

  .cover-subtitle {
    font-size: 13pt;
    color: #cbd5e1;
    margin: 0 0 25px 0;
    font-weight: 400;
    line-height: 1.45;
  }

  .cover-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .cover-tag {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.25);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 9pt;
    font-weight: 600;
    color: #f8fafc;
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
    font-size: 14pt;
    font-weight: 800;
    color: #0f172a;
    margin: 14px 0 8px 0;
    padding-bottom: 5px;
    border-bottom: 2px solid #047857;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  h2 {
    font-size: 11pt;
    font-weight: 700;
    color: #065f46;
    margin: 10px 0 6px 0;
  }

  h3 {
    font-size: 9.5pt;
    font-weight: 700;
    color: #1e293b;
    margin: 8px 0 4px 0;
  }

  p {
    margin: 0 0 7px 0;
    color: #334155;
    font-size: 9pt;
  }

  /* Grid & Cards */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 10px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }

  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
  }

  .card-header {
    font-weight: 700;
    font-size: 9pt;
    color: #0f172a;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Procedural Steps */
  .step-container {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 8px 0;
  }

  .step-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 7px 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }

  .step-pin {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #047857;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 8.5pt;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .step-content {
    flex: 1;
  }

  .step-title {
    font-weight: 700;
    font-size: 8.5pt;
    color: #0f172a;
  }

  .step-desc {
    font-size: 8pt;
    color: #475569;
    margin-top: 2px;
    line-height: 1.35;
  }

  /* Callout Badges */
  .badge-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #ecfdf5;
    color: #065f46;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 700;
    border: 1px solid #a7f3d0;
  }

  .badge-rule {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #fffbeb;
    color: #92400e;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 700;
    border: 1px solid #fde68a;
  }

  .badge-db {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #eff6ff;
    color: #1e40af;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 700;
    border: 1px solid #bfdbfe;
  }

  /* Figures & Screenshots */
  .figure-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 6px;
    margin: 6px 0;
    text-align: center;
  }

  .figure-img {
    width: 100%;
    max-height: 230px;
    object-fit: contain;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
  }

  .figure-caption {
    font-size: 7.5pt;
    color: #475569;
    margin-top: 4px;
    text-align: left;
    padding: 0 4px;
    line-height: 1.3;
  }

  .figure-caption strong {
    color: #0f172a;
  }

  /* Table Style */
  table.db-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 8pt;
  }

  table.db-table th {
    background: #0f172a;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid #334155;
  }

  table.db-table td {
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    color: #334155;
    vertical-align: top;
  }

  table.db-table tr:nth-child(even) {
    background: #f8fafc;
  }

  /* Table of Contents */
  .toc {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 16px;
    margin: 10px 0;
  }

  .toc-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px dashed #cbd5e1;
    font-size: 8pt;
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
      <span class="pill">PRODUCTION 2026 HOMOLOGUÉE</span><br>
      Plateforme Suivi TCE &amp; Multi-Tenant<br>
      <strong>suivi.anelecgroupe.com</strong>
    </div>
  </div>

  <div class="cover-body">
    <div style="color: #10b981; font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
      Document Technique &amp; Guide Opérationnel Officiel
    </div>
    <h1 class="cover-title">
      Guide d'Utilisation &amp;<br>Création de Compte <span>TCE Pro</span>
    </h1>
    <p class="cover-subtitle">
      Procédure pas-à-pas de création d'espace entreprise (Google 1-clic &amp; classique), architecture de données multi-tenant Supabase PostgreSQL, pilotage des chantiers, tournées GPS et studio de facturation.
    </p>

    <div class="cover-tags">
      <span class="cover-tag">🏢 Création Espace Entreprise</span>
      <span class="cover-tag">🔒 Multi-Tenant Supabase PostgreSQL</span>
      <span class="cover-tag">📱 App Mobile &amp; Clôture GPS</span>
      <span class="cover-tag">🗺️ Optimiseur de Tournées</span>
      <span class="cover-tag">🧾 Facturation B2B / B2C</span>
    </div>
  </div>

  <div class="cover-footer">
    <div>
      <strong>ANELEC GROUPE</strong> — 9 Rue des Colonnes, 75002 Paris<br>
      Plateforme d'Exploitation TCE Déployée sur Supabase &amp; Hostinger Cloud VPS
    </div>
    <div style="text-align: right;">
      Documentation Technique Complète<br>
      Édition Homologuée · Novembre 2026
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 2 : SOMMAIRE & MATRICE -->
<h1>📑 Sommaire Général du Document</h1>

<div class="toc">
  <div class="toc-item">
    <span class="toc-title">1. Création de Compte Entreprise, Connexion Google &amp; Activation</span>
    <span class="toc-tag">Page 3</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">2. Architecture &amp; Fonctionnement Base de Données Supabase Multi-Tenant</span>
    <span class="toc-tag">Page 4</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">3. Tableau de Bord &amp; Pilotage d'Activité (CA, Volume &amp; Filtres Temporels)</span>
    <span class="toc-tag">Page 5</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">4. Module d'Extraction « Situation Excel » Multi-Clients (Dates Début/Fin)</span>
    <span class="toc-tag">Page 6</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">5. Pipeline Devis (22 Colonnes), Visites Techniques &amp; Reconversion</span>
    <span class="toc-tag">Page 7</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">6. Interventions TCE (23 Colonnes) &amp; Envoi de Rapports par E-mail</span>
    <span class="toc-tag">Page 8</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">7. Planning Gantt Multi-Ressources (60 fps) &amp; Bourse de Dispatch</span>
    <span class="toc-tag">Page 9</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">8. Application Mobile Technicien PWA (4 Onglets), Clôture GPS &amp; 7 Thèmes</span>
    <span class="toc-tag">Page 10</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">9. Carte Interactive, Positions vs Trajet &amp; Cockpit Plein Écran PC</span>
    <span class="toc-tag">Page 11</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">10. Studio Facturation (5 Bacs de Tri B2B/B2C &amp; Diagnostic Retards)</span>
    <span class="toc-tag">Page 12</span>
  </div>
  <div class="toc-item">
    <span class="toc-title">11. Profils Donneurs d'Ordre &amp; Administration Supervision SMTP</span>
    <span class="toc-tag">Page 13</span>
  </div>
</div>

<h2>👥 Rôles Utilisateurs &amp; Périmètres Métier</h2>
<div class="grid-3">
  <div class="card" style="border-left: 4px solid #047857;">
    <div class="card-header"><span class="badge-action">ADMIN</span> <strong>Direction &amp; Gérance</strong></div>
    <p style="font-size: 8pt; margin: 3px 0;">
      Accès complet aux données de son entreprise : pilotage CA, facturation, rentabilité horaire, gestion des utilisateurs et configuration des tarifs.
    </p>
  </div>
  <div class="card" style="border-left: 4px solid #2563eb;">
    <div class="card-header"><span class="badge-db">USER</span> <strong>Chargé d'Affaires &amp; Planning</strong></div>
    <p style="font-size: 8pt; margin: 3px 0;">
      Chiffrage devis, planification Gantt, suivi des chantiers en direct, export situation Excel et envoi des rapports aux clients.
    </p>
  </div>
  <div class="card" style="border-left: 4px solid #a855f7;">
    <div class="card-header"><span class="badge-rule">TECH</span> <strong>Technicien Terrain PWA</strong></div>
    <p style="font-size: 8pt; margin: 3px 0;">
      Vue mobile cloisonnée sur ses propres missions : pointage matin/soir, guidage GPS, prise de photos, compte rendu et clôture avec localisation.
    </p>
  </div>
</div>

<div class="figure-box">
  <img src="${schema01Cycle}" alt="Cycle TCE ANELEC" style="max-height: 120px; width: 100%; object-fit: contain;" />
  <div class="figure-caption">
    <strong>Schéma 1 :</strong> Le cycle opérationnel intégré TCE : Demande client $\to$ Chiffrage Devis $\to$ Dispatch Gantt $\to$ Mobile Terrain avec GPS $\to$ Facturation $\to$ Rentabilité.
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 3 : CREATION DE COMPTE & CONNEXION GOOGLE -->
<h1>1. Création de Compte Entreprise, Connexion Google &amp; Activation</h1>

<p>
  La création d'un espace entreprise est conçue pour être fluide et intuitive, avec deux parcours : l'inscription rapide via Google (1-clic) ou le formulaire professionnel direct.
</p>

<div class="figure-box">
  <img src="${imgDoc01CreationCompte}" alt="Formulaire de création de compte entreprise avec Google 1-clic" class="figure-img" style="max-height: 200px;" />
  <div class="figure-caption">
    <strong>Figure 1.1 :</strong> Page d'inscription — Pré-remplissage automatique des informations certifiées Google et saisie de l'entreprise.
  </div>
</div>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">①</div>
    <div class="step-content">
      <div class="step-title">Option A — Inscription Rapide via Google (1-Clic Intelligent)</div>
      <div class="step-desc">
        Cliquez sur <strong>« Continuer avec Google »</strong>. Si votre compte Google n'est pas encore enregistré, le système bascule automatiquement sur l'onglet de création de compte et pré-remplit instantanément votre <strong>Nom complet</strong> et votre <strong>Adresse e-mail certifiée</strong>. Il ne vous reste plus qu'à renseigner la raison sociale de votre entreprise et son numéro SIRET.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">②</div>
    <div class="step-content">
      <div class="step-title">Option B — Formulaire Professionnel Direct</div>
      <div class="step-desc">
        Renseignez la <strong>Raison sociale</strong>, le <strong>SIRET (14 chiffres)</strong> ou <strong>SIREN (9 chiffres)</strong>, le nom du responsable, votre email professionnel et un mot de passe de 8 caractères minimum. Cochez les <strong>CGU et la Politique de Confidentialité RGPD</strong>.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">③</div>
    <div class="step-content">
      <div class="step-title">Réception de l'E-mail d'Activation &amp; Bouton de Secours</div>
      <div class="step-desc">
        Un e-mail officiel est immédiatement expédié depuis <code>zehair@anelecgroupe.com</code> avec un lien d'activation sécurisé. L'écran affiche une bannière claire permettant également de renvoyer l'e-mail ou d'activer le compte en 1 clic.
      </div>
    </div>
  </div>
</div>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgDoc02ActivationEmail}" alt="Bannière de confirmation et renvoi" class="figure-img" style="max-height: 155px;" />
    <div class="figure-caption">
      <strong>Figure 1.2 :</strong> Bannière de confirmation avec statut d'envoi et bouton de renvoi.
    </div>
  </div>
  <div class="figure-box">
    <img src="${imgDoc03EmailOfficiel}" alt="E-mail officiel reçu par l'entreprise" class="figure-img" style="max-height: 155px;" />
    <div class="figure-caption">
      <strong>Figure 1.3 :</strong> E-mail d'activation officiel avec lien sécurisé et rappel contractuel.
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 4 : ARCHITECTURE BASE DE DONNEES SUPABASE MULTI-TENANT -->
<h1>2. Fonctionnement de la Base de Données Supabase PostgreSQL</h1>

<p>
  Toutes les données de la plateforme sont hébergées sur une base de données <strong>Supabase PostgreSQL 17</strong> avec une architecture <strong>Multi-Tenant étanche</strong> pilotée par l'ORM Prisma.
</p>

<div class="figure-box">
  <img src="${schema05Supabase}" alt="Schéma d'Architecture Multi-Tenant Supabase" style="max-height: 165px; width: 100%; object-fit: contain;" />
  <div class="figure-caption">
    <strong>Schéma 2 :</strong> Flux de création de compte dans Supabase : Isolation par <code>companyId</code>, seeding automatique et validation d'intégrité.
  </div>
</div>

<h2>Détail des Tables PostgreSQL Impactées lors de la Création de Compte :</h2>

<table class="db-table">
  <thead>
    <tr>
      <th style="width: 22%;">Table PostgreSQL</th>
      <th style="width: 32%;">Champs Clés &amp; Types</th>
      <th style="width: 46%;">Rôle dans l'Isolation Multi-Tenant</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong><code>public.companies</code></strong></td>
      <td><code>id (PK Serial), name, siret (14), siren (9), active, createdAt</code></td>
      <td>Représente le <strong>Tenant Entreprise</strong>. Chaque entreprise dispose d'un identifiant unique garantissant l'étanchéité absolue de ses dossiers.</td>
    </tr>
    <tr>
      <td><strong><code>public.users</code></strong></td>
      <td><code>id, email, password (bcrypt), role, companyId (FK), emailConfirmed, termsAcceptedAt</code></td>
      <td>Stocke l'administrateur et les collaborateurs. Le mot de passe est haché via <strong>bcrypt (12 rounds)</strong>. L'acceptation des CGU et l'IP sont horodatées.</td>
    </tr>
    <tr>
      <td><strong><code>public.referentiels</code></strong></td>
      <td><code>id, categorie, valeurs (JSON), companyId (FK)</code></td>
      <td><strong>Seed Automatique :</strong> Dès la création de l'entreprise, Supabase initialise automatiquement ses corps d'état, ses origines de dossiers et ses responsables.</td>
    </tr>
    <tr>
      <td><strong><code>public.devis</code></strong></td>
      <td><code>id, referenceMetier, client, amount, visiteStatut, companyId (FK, Indexé)</code></td>
      <td>Chaque devis porte le <code>companyId</code> de l'entreprise. Impossible pour une entreprise B de visualiser ou chiffrer les devis de l'entreprise A.</td>
    </tr>
    <tr>
      <td><strong><code>public.interventions</code></strong></td>
      <td><code>id, referenceMetier, client, technicien, gpsCloture, companyId (FK, Indexé)</code></td>
      <td>Chantiers TCE et visites techniques rattachés au tenant. Les techniciens ne voient que leurs propres missions via filtrage applicatif strict.</td>
    </tr>
  </tbody>
</table>

<div class="card" style="border-left: 4px solid #10b981; background: #ecfdf5; margin-top: 6px;">
  <strong style="color: #065f46;">🔒 Garantie de Sécurité &amp; Confidentialité Supabase :</strong><br>
  <span style="font-size: 8pt; color: #047857;">
    Le jeton de session JWT délivré à chaque connexion embarque obligatoirement les claims <code>{ userId, email, role, companyId }</code>. Chaque requête SQL transmise à Supabase applique systématiquement la clause <code>WHERE companyId = req.user.companyId</code>, empêchant tout accès transversal entre entreprises.
  </span>
</div>

<div class="page-break"></div>

<!-- PAGE 5 : TABLEAU DE BORD & PILOTAGE D'ACTIVITE -->
<h1>3. Tableau de Bord &amp; Pilotage d'Activité TCE</h1>

<p>
  Le tableau de bord centralise en temps réel la production des chantiers, les volumes financiers et la ventilation par donneur d'ordre avec des filtres temporels par Année, Mois et Jour.
</p>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgDoc04DashboardCA}" alt="Pilotage Chiffre d'Affaires et KPIs" class="figure-img" style="max-height: 185px;" />
    <div class="figure-caption">
      <strong>Figure 3.1 :</strong> Volet Chiffre d'Affaires (€) — CA Global, Facturé, Reste à Facturer et Panier moyen.
    </div>
  </div>
  <div class="figure-box">
    <img src="${imgDoc05DashboardVolume}" alt="Volume d'Activité et Ventilation Donneurs d'Ordre" class="figure-img" style="max-height: 185px;" />
    <div class="figure-caption">
      <strong>Figure 3.2 :</strong> Volet Volume d'Activité (Quantités) — Nombre de chantiers par client et taux de complétion.
    </div>
  </div>
</div>

<h2>Fonctionnalités Clés du Tableau de Bord :</h2>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">4 Cartes KPI Financières &amp; Opérationnelles</div>
      <div class="step-desc">
        <strong>CA Global HT :</strong> Totalité du volume d'affaires sur la période.<br>
        <strong>CA Facturé HT :</strong> Montant déjà transformé en factures définitives.<br>
        <strong>Reste à Facturer HT :</strong> Chantiers terminés en attente d'émission comptable.<br>
        <strong>Panier Moyen &amp; Avancement :</strong> Ratio moyen par mission et pourcentage d'achèvement des chantiers.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Filtres Temporels Granulaires (Année, Mois, Jour)</div>
      <div class="step-desc">
        Isolez instantanément les résultats d'un exercice complet, d'un mois spécifique ou d'une journée précise. Les chiffres et graphiques s'actualisent en direct sans rechargement de page.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Bascule Instantanée « Chiffre d'Affaires (€) » ↔ « Volume d'Activité »</div>
      <div class="step-desc">
        Analysez votre production sous l'angle financier (€ HT) ou sous l'angle opérationnel (nombre de missions commandées, réalisées et facturées par syndic et client tertiaire).
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 6 : EXTRACTION SITUATION EXCEL DATES DEBUT/FIN -->
<h1>4. Module d'Extraction « Situation Excel » Multi-Clients</h1>

<p>
  Accessible en un clic depuis le bouton <strong>« Situation Excel »</strong> présent dans la barre supérieure, ce module génère des situations de travaux et des états comptables certifiés au format Excel <code>.xlsx</code>.
</p>

<div class="figure-box">
  <img src="${imgDoc06SituationExcel}" alt="Modale d'extraction Situation Excel avec sélection de dates" class="figure-img" style="max-height: 220px;" />
  <div class="figure-caption">
    <strong>Figure 4.1 :</strong> Modale Situation Excel — Sélection de la plage temporelle (Dates de début et de fin) et multi-sélection des donneurs d'ordre.
  </div>
</div>

<h2>Procédure d'Extraction d'une Situation de Travaux :</h2>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">①</div>
    <div class="step-content">
      <div class="step-title">Définir la Plage Temporelle Exacte (Date Début &amp; Date Fin)</div>
      <div class="step-desc">
        Indiquez le <strong>Jour / Mois / Année de début</strong> et le <strong>Jour / Mois / Année de fin</strong> pour borner précisément la période d'extraction comptable. Des boutons rapides permettent de sélectionner <em>Aujourd'hui</em>, <em>Ce mois-ci</em> ou <em>Cette année</em>.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">②</div>
    <div class="step-content">
      <div class="step-title">Sélectionner les Donneurs d'Ordre Ciblés</div>
      <div class="step-desc">
        Cochez les clients dont vous souhaitez extraire la situation (ex: <em>Presta maintenance, GMS, EMALEC, IPC</em>), ou cochez <strong>« Tous les donneurs d'ordre »</strong> pour un état financier global.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">③</div>
    <div class="step-content">
      <div class="step-title">Génération &amp; Téléchargement Automatique du Classeur Excel</div>
      <div class="step-desc">
        Cliquez sur <strong>« Générer &amp; Télécharger le fichier Excel »</strong>. Le fichier <code>.xlsx</code> structuré contient l'ensemble des colonnes métier : Référence, Chantier, Date de demande, Date planifiée, Montant HT, Statut opérationnel, Technicien et Statut facture.
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 7 : PIPELINE DEVIS & RECONVERSION -->
<h1>5. Pipeline Devis Commercial (22 Colonnes) &amp; Visites</h1>

<p>
  Le module Devis gère le cycle commercial complet : chiffrage initial, programmation des visites préalables de prise de cotes sur le terrain, envoi par email au client et conversion en travaux.
</p>

<div class="figure-box">
  <img src="${imgDoc07DevisPipeline}" alt="Pipeline Devis Commercial" class="figure-img" style="max-height: 195px;" />
  <div class="figure-caption">
    <strong>Figure 5.1 :</strong> Pipeline Devis (22 colonnes) — Filtres de statuts, recherche plein texte et boutons d'action rapide.
  </div>
</div>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">Création d'un Chiffrage &amp; Option « Visite Nécessaire »</div>
      <div class="step-desc">
        Cliquez sur <strong>+ Devis</strong>. Si une prise de cotes sur site est indispensable avant de chiffrer, cochez <strong>« Visite nécessaire »</strong> et choisissez un technicien : un créneau unifié <code>VIS-DEV</code> est immédiatement planifié.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Envoi de Proposition par E-mail en 1 Clic</div>
      <div class="step-desc">
        Transmettez le chiffrage directement au client depuis l'application avec modèle d'accompagnement et traçabilité dans l'historique du devis.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Conversion Sécurisée &amp; Grille Anti-Doublon</div>
      <div class="step-desc">
        Dès accord client, cliquez sur <strong>« Convertir en intervention »</strong>. Si le devis a déjà été converti, la grille intelligente qualifie le motif pour éviter les doublons accidentels.
      </div>
    </div>
  </div>
</div>

<div class="figure-box">
  <img src="${imgModalReconv}" alt="Grille de Reconversion Intelligente" class="figure-img" style="max-height: 140px;" />
  <div class="figure-caption">
    <strong>Figure 5.2 :</strong> Grille de Reconversion — Choix du motif : SAV sous garantie, Reprise de travaux, Avenant / travaux supplémentaires ou 2ème Phase.
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 8 : INTERVENTIONS TCE & ENVOI RAPPORTS -->
<h1>6. Interventions TCE &amp; Envoi des Rapports par E-mail</h1>

<p>
  Le module Interventions assure le pilotage opérationnel des travaux tout corps d'état avec suivi des statuts en direct, vérification des photos terrain et expédition des rapports officiels aux clients.
</p>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgDoc08Interventions}" alt="Tableau des Interventions TCE" class="figure-img" style="max-height: 190px;" />
    <div class="figure-caption">
      <strong>Figure 6.1 :</strong> Vue Interventions TCE (23 colonnes) — Statuts opérationnels, techniciens et boutons d'action.
    </div>
  </div>
  <div class="figure-box">
    <img src="${imgDoc18RapportEmail}" alt="Modale d'envoi de rapport par e-mail" class="figure-img" style="max-height: 190px;" />
    <div class="figure-caption">
      <strong>Figure 6.2 :</strong> Envoi du Rapport Officiel par E-mail avec photos justificatives au donneur d'ordre.
    </div>
  </div>
</div>

<h2>Règles de Conformité &amp; Envoi du Rapport :</h2>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">Vérification des Justificatifs Terrain</div>
      <div class="step-desc">
        Avant transmission au client, le chargé d'affaires consulte le compte rendu rédigé par le technicien, les actions réalisées cochées et les photos horodatées avant/après travaux.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Règle de Sécurité : Envoi Réservé au Bureau Opérationnel</div>
      <div class="step-desc">
        Les techniciens sur le terrain ne peuvent pas envoyer d'e-mails directement aux clients. Ils transmettent leurs éléments à l'équipe bureau qui valide et procède à l'expédition officielle.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Expédition Certifiée &amp; Traçabilité Complète</div>
      <div class="step-desc">
        Le rapport est expédié avec objet normalisé, message personnalisé et photos en pièces jointes. L'événement est archivé dans l'historique inviolable de l'intervention.
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 9 : PLANNING GANTT MULTI-RESSOURCES -->
<h1>7. Planning Gantt Multi-Ressources (60 fps)</h1>

<p>
  Le planning Gantt permet d'ordonnancer les chantiers et les visites techniques avec une fluidité exceptionnelle grâce à la technologie Pointer Events native (60 images par seconde).
</p>

<div class="figure-box">
  <img src="${imgPlanningGantt}" alt="Planning Gantt Multi-Ressources" class="figure-img" style="max-height: 235px;" />
  <div class="figure-caption">
    <strong>Figure 7.1 :</strong> Planning Gantt Dispatch — Bourse latérale gauche, lignes par technicien, créneaux VIS-DEV violets et travaux bleus.
  </div>
</div>

<h2>Fonctionnement de l'Ordonnancement Gantt :</h2>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">①</div>
    <div class="step-content">
      <div class="step-title">La Bourse de Dispatch (Tiroir Latéral Gauche)</div>
      <div class="step-desc">
        Toutes les missions créées sans créneau horaire ou en attente d'affectation sont regroupées dans la bourse de dispatch, prêtes à être glissées dans le calendrier.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">②</div>
    <div class="step-content">
      <div class="step-title">Glisser-Déposer &amp; Redimensionnement Direct à la Souris</div>
      <div class="step-desc">
        Déplacez une mission sur la timeline du technicien choisi. Étirez ou réduisez le bord inférieur du bloc pour ajuster la durée d'intervention par paliers de 15 minutes.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">③</div>
    <div class="step-content">
      <div class="step-title">Synchronisation Instantanée avec l'App Mobile du Technicien</div>
      <div class="step-desc">
        Dès qu'une mission est positionnée sur le Gantt, elle apparaît immédiatement sur le smartphone du technicien dans son onglet <strong>Missions</strong> et sur la carte de tournée.
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 10 : APPLICATION MOBILE TECHNICIEN PWA & CLOTURE GPS -->
<h1>8. Application Mobile Technicien PWA (4 Onglets), Clôture GPS &amp; 7 Thèmes</h1>

<p>
  L'application mobile terrain (PWA installable sur iOS et Android) accompagne le technicien de sa prise de service jusqu'à la clôture certifiée de ses interventions. Elle propose une ergonomie au pouce native structurée en <strong>4 onglets essentiels</strong> et un sélecteur interactif des <strong>7 directions artistiques</strong>.
</p>

<div class="grid-4">
  <div class="figure-box" style="padding: 4px; text-align: center;">
    <img src="${imgMobile01Missions}" alt="Missions du jour" class="figure-img" style="max-height: 180px; width: 100%; object-fit: contain; border-radius: 6px;" />
    <div class="figure-caption" style="font-size: 7pt; margin-top: 3px;">
      <strong>1. Missions :</strong> Pointage « Commencer / Finir », filtre mois, bandeau 7 jours.
    </div>
  </div>
  <div class="figure-box" style="padding: 4px; text-align: center;">
    <img src="${imgMobile02Tournee}" alt="Ma tournée" class="figure-img" style="max-height: 180px; width: 100%; object-fit: contain; border-radius: 6px;" />
    <div class="figure-caption" style="font-size: 7pt; margin-top: 3px;">
      <strong>2. Tournée :</strong> Carte interactive Leaflet (QG, arrêts 1-2-3, tracé) &amp; liste ordonnée.
    </div>
  </div>
  <div class="figure-box" style="padding: 4px; text-align: center;">
    <img src="${imgMobile03Historique}" alt="Historique des missions" class="figure-img" style="max-height: 180px; width: 100%; object-fit: contain; border-radius: 6px;" />
    <div class="figure-caption" style="font-size: 7pt; margin-top: 3px;">
      <strong>3. Historique :</strong> Chantiers clôturés, dates et archives photos.
    </div>
  </div>
  <div class="figure-box" style="padding: 4px; text-align: center;">
    <img src="${imgMobile04Profil}" alt="Profil et thèmes" class="figure-img" style="max-height: 180px; width: 100%; object-fit: contain; border-radius: 6px;" />
    <div class="figure-caption" style="font-size: 7pt; margin-top: 3px;">
      <strong>4. Profil :</strong> 4 KPI terrain, sélecteur des 7 thèmes et déconnexion.
    </div>
  </div>
</div>

<h2>Les 5 Piliers Métier de la Nouvelle Interface Mobile :</h2>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">Prise de Service &amp; Pointage Vacations (« Commencer la journée » / « Finir la journée »)</div>
      <div class="step-desc">
        Le démarrage des interventions est subordonné au pointage d'arrivée : un tap sur <strong>« Commencer la journée »</strong> horodate immédiatement la présence en base PostgreSQL (table <code>pointages_techniciens</code>) et affiche la pastille verte « Pointé à HH:MM ». En fin de tournée, le bouton <strong>« Finir la journée »</strong> enregistre l'heure de départ. Le bandeau hebdomadaire interactif (7 jours de Lun à Dim) permet de naviguer sur n'importe quel jour de la semaine et un filtre déroulant mensuel offre un accès direct à tous les mois de l'année. La barre de progression indique en temps réel l'avancement des chantiers (ex. <em>1/3 missions terminées</em>).
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Carte Interactive Leaflet &amp; Ordre Optimisé des Arrêts (Onglet Ma Tournée)</div>
      <div class="step-desc">
        L'onglet « Ma tournée » intègre désormais une véritable carte dynamique Leaflet OpenStreetMap. Elle matérialise le point de départ QG, le tracé d'itinéraire en pointillés et chaque étape numérotée (1, 2, 3) avec pastille d'état (<em>En cours</em>, <em>Suivant</em>, <em>Prévu</em>). L'affichage est stabilisé par <code>ResizeObserver</code> et invalidation dynamique de taille, garantissant un rendu fluide sans mosaïque ni distorsion lors du passage d'un onglet à l'autre.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Fiche Intervention Tactile, Photos &amp; Navigation GPS Directe</div>
      <div class="step-desc">
        En touchant une mission, le technicien accède aux tuiles métriques (créneau, montant estimé HT, durée), aux boutons rapides <strong>[Itinéraire]</strong> (guidage Waze / Google Maps) et <strong>[Appeler]</strong>, aux consignes d'accès, à la capture photo avec compression locale (&lt; 75 Ko) et au compte rendu textuel.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">4</div>
    <div class="step-content">
      <div class="step-title">Clôture Certifiée avec Localisation GPS Obligatoire &amp; Retrait de Carte</div>
      <div class="step-desc">
        La clôture (bouton <strong>« Clôturer avec GPS »</strong>) verrouille les coordonnées GPS exactes avec le rayon de précision. La mission est certifiée terminée, transmise au bureau et <strong>immédiatement retirée de la carte globale</strong> pour ne laisser que le reste à faire.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">5</div>
    <div class="step-content">
      <div class="step-title">Accès Universel Multi-Profils &amp; Sélecteur des 7 Directions Artistiques (Onglet Profil)</div>
      <div class="step-desc">
        N'importe quel profil connecté (Administrateur, Chargé d'affaires, Planificateur ou Technicien) peut afficher l'application mobile en 1 clic grâce au bouton <strong>« 📱 Version Mobile »</strong> situé dans la barre supérieure et dans le menu utilisateur. Dans l'onglet Profil, le technicien dispose en outre de ses 4 KPI terrain et du sélecteur interactif des <strong>7 directions artistiques</strong> (<em>Atlas Clarity, Craft Warmth, Signal Command, Editorial Swiss, Bento Modular, Original Clair, Original Sombre</em>).
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 11 : CARTE INTERACTIVE & PLEIN ECRAN PC -->
<h1>9. Carte Interactive, Positions vs Trajet &amp; Plein Écran</h1>

<p>
  La carte interactive permet au bureau de suivre en temps réel la progression de chaque tournée et d'afficher au choix la position actuelle des techniciens, le trajet restant, ou les deux combinés.
</p>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgDoc09CarteAvant}" alt="Carte AVANT clôture avec 3 missions actives" class="figure-img" style="max-height: 195px;" />
    <div class="figure-caption">
      <strong>Figure 9.1 :</strong> Carte AVANT clôture — 3 missions actives sur le trajet (0 terminée).
    </div>
  </div>
  <div class="figure-box">
    <img src="${imgDoc12CarteApres}" alt="Carte APRÈS clôture mobile avec 1 seule mission restante" class="figure-img" style="max-height: 195px;" />
    <div class="figure-caption">
      <strong>Figure 9.2 :</strong> Carte APRÈS clôture mobile — Les 2 missions finies sont <strong>retirées de la carte</strong> ; seul le reste à faire subsiste.
    </div>
  </div>
</div>

<h2>Fonctionnalités de la Carte Opérationnelle :</h2>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">1</div>
    <div class="step-content">
      <div class="step-title">Retrait Automatique des Interventions &amp; Bons de Devis Terminés</div>
      <div class="step-desc">
        Dès qu'un technicien clôture une mission avec son GPS sur mobile, celle-ci s'efface immédiatement de la carte. L'itinéraire est recalculé pour optimiser le temps restant.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">2</div>
    <div class="step-content">
      <div class="step-title">Choix entre « Positions Actuelles », « Trajet Restant » ou « Les Deux »</div>
      <div class="step-desc">
        Basculez en un clic pour visualiser la position transmise de chaque camionnette, uniquement les points de passage restant à visiter, ou la vue d'ensemble combinée.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">3</div>
    <div class="step-content">
      <div class="step-title">Mode Cockpit Plein Écran PC (100% de l'Écran)</div>
      <div class="step-desc">
        En cliquant sur <strong>« Plein Écran PC »</strong>, la carte s'agrandit pour couvrir tout votre moniteur avec un panneau d'avancement par technicien (taux de complétion et dernière position).
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 12 : STUDIO FACTURATION & DIAGNOSTIC RETARDS -->
<h1>10. Studio Facturation &amp; Relation Client (5 Bacs)</h1>

<p>
  Le Studio Facturation applique la règle d'or comptable : <em>« On ne facture que les chantiers achevés et validés, jamais un devis »</em>, avec arbitrage fiscal B2B / B2C et diagnostic des retards.
</p>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgDoc13FacturationKpi}" alt="Studio Facturation et les 5 Bacs de Tri" class="figure-img" style="max-height: 195px;" />
    <div class="figure-caption">
      <strong>Figure 10.1 :</strong> Studio Facturation — Cartes KPI lisibles et 5 bacs de tri de conformité.
    </div>
  </div>
  <div class="figure-box">
    <img src="${imgDoc14FacturationDiagnostic}" alt="Diagnostic 1-Clic des Retards et Réponses Clients" class="figure-img" style="max-height: 195px;" />
    <div class="figure-caption">
      <strong>Figure 10.2 :</strong> Diagnostic 1-Clic — Explication de la cause d'un retard et modèle de réponse client.
    </div>
  </div>
</div>

<h2>Organisation des 5 Bacs de Tri :</h2>

<div class="step-container">
  <div class="step-row">
    <div class="step-pin">①</div>
    <div class="step-content">
      <div class="step-title">Bac 1 · 🟢 À facturer (Prêtes)</div>
      <div class="step-desc">
        Chantiers achevés sur le terrain avec compte rendu technique certifié et photos conformes.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">②</div>
    <div class="step-content">
      <div class="step-title">Bac 2 · 🟡 À vérifier (En attente)</div>
      <div class="step-desc">
        Dossiers nécessitant une vérification complémentaire du rapport ou une levée de réserve.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">③</div>
    <div class="step-content">
      <div class="step-title">Bac 3 · ⚪ Non-Éligibles (En cours / Visites)</div>
      <div class="step-desc">
        Chantiers en cours de réalisation ou visites de devis de chiffrage (non facturables directement).
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">④</div>
    <div class="step-content">
      <div class="step-title">Bac 4 · 🔴 Diagnostic Retards &amp; Réponses Clients</div>
      <div class="step-desc">
        Détection automatique des causes de blocage et génération en 1 clic d'un courrier explicatif adapté au client.
      </div>
    </div>
  </div>

  <div class="step-row">
    <div class="step-pin">⑤</div>
    <div class="step-content">
      <div class="step-title">Bac 5 · ✅ Facturées (B2B / B2C)</div>
      <div class="step-desc">
        Historique définitif des factures émises avec distinction fiscale B2B (HT, autoliquidation) et B2C (TTC, TVA réduite).
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 13 : PROFILS CLIENTS & SUPERVISION SMTP -->
<h1>11. Profils Donneurs d'Ordre &amp; Administration SMTP</h1>

<p>
  La gestion des relations commerciales et la supervision technique des envois d'e-mails garantissent la fiabilité des communications de chaque entreprise.
</p>

<div class="grid-2">
  <div class="figure-box">
    <img src="${imgDoc16ProfilsClients}" alt="Répertoire des Profils Donneurs d'Ordre" class="figure-img" style="max-height: 175px;" />
    <div class="figure-caption">
      <strong>Figure 11.1 :</strong> Répertoire des Donneurs d'Ordre — Fiches syndics, bailleurs et clients B2B.
    </div>
  </div>
  <div class="figure-box">
    <img src="${imgDoc17FicheClient}" alt="Fiche Technique Donneur d'Ordre" class="figure-img" style="max-height: 175px;" />
    <div class="figure-caption">
      <strong>Figure 11.2 :</strong> Fiche Technique Client — SIRET, interlocuteurs, délais et grilles tarifaires.
    </div>
  </div>
</div>

<h2>Supervision des Envois d'E-mails (Station d'Administration) :</h2>

<div class="figure-box">
  <img src="${imgDoc15AdminSmtp}" alt="Station d'Administration et Diagnostic SMTP" class="figure-img" style="max-height: 185px;" />
  <div class="figure-caption">
    <strong>Figure 11.3 :</strong> Console d'Administration — Diagnostic SMTP temps réel, test d'envoi et audit des pointages.
  </div>
</div>

<div class="card" style="border-left: 4px solid #047857; background: #ecfdf5; margin-top: 10px;">
  <strong style="color: #065f46;">✓ Architecture d'Envoi Résiliente ANELEC :</strong><br>
  <span style="font-size: 8pt; color: #047857;">
    Le serveur intègre une triple sécurité d'expédition : connexion SMTP directe de production, bascule automatique sur le relais sécurisé Supabase Auth en cas d'indisponibilité, et génération d'un lien d'activation instantané affiché à l'écran en cas de filtrage antispam strict du destinataire.
  </span>
</div>

<!-- BANNIERE FINALE -->
<div class="card" style="margin-top: 15px; background: #0f172a; color: #ffffff; text-align: center; padding: 12px; border: 2px solid #047857;">
  <div style="font-size: 10pt; font-weight: 800; color: #10b981; margin-bottom: 2px;">
    ANELEC GROUPE — HOMOLOGATION OFFICIELLE DES PROCÉDURES TCE 2026
  </div>
  <div style="font-size: 7.5pt; color: #cbd5e1; max-width: 650px; margin: 0 auto;">
    Ce document constitue le manuel officiel d'exploitation du progiciel ANELEC TCE. Toutes les procédures et captures présentées sont certifiées conformes au système déployé en production.
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
