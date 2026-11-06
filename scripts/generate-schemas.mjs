import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'C:\\Users\\Zeh\\suivi-tce-hostinger\\docs\\images';

// 1. Schema Cycle Complet TCE
const svg1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="100%" height="100%" style="background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <defs>
    <linearGradient id="gradDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f1d"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.1"/>
    </filter>
  </defs>

  <rect width="1000" height="320" fill="#f8fafc" rx="12"/>
  <rect x="15" y="15" width="970" height="290" fill="#ffffff" rx="8" stroke="#e2e8f0" stroke-width="1.5" filter="url(#shadow)"/>

  <!-- Title -->
  <text x="35" y="45" font-size="16" font-weight="800" fill="#0a0f1d">CYCLE COMPLET DES TRAVAUX TCE — ANELEC GROUPE</text>
  <text x="35" y="65" font-size="11" fill="#64748b">Architecture intégrée de bout-en-bout : de l'estimation commerciale à la clôture et rentabilité financière</text>

  <!-- Step 1: Demande & Devis -->
  <g transform="translate(35, 90)">
    <rect width="165" height="185" rx="8" fill="#f8fafc" stroke="#ffcc00" stroke-width="2"/>
    <rect width="165" height="32" rx="8" fill="#ffcc00"/>
    <text x="82" y="21" font-size="11" font-weight="800" fill="#0a0f1d" text-anchor="middle">1. PIPELINE DEVIS</text>
    <text x="15" y="55" font-size="11" font-weight="700" fill="#0a0f1d">• Demande Client</text>
    <text x="25" y="73" font-size="9.5" fill="#64748b">Syndic, Bailleur, B2B, B2C</text>
    <text x="15" y="98" font-size="11" font-weight="700" fill="#0a0f1d">• Chiffrage Devis</text>
    <text x="25" y="116" font-size="9.5" fill="#64748b">22 colonnes analytiques</text>
    <rect x="12" y="130" width="141" height="36" rx="4" fill="#fef9c3" stroke="#ca8a04"/>
    <text x="82" y="146" font-size="9" font-weight="700" fill="#854d0e" text-anchor="middle">Visite Prise de Cotes</text>
    <text x="82" y="158" font-size="8.5" fill="#a16207" text-anchor="middle">(Créneau VIS • DEV)</text>
  </g>

  <!-- Arrow 1 -> 2 -->
  <path d="M 205 180 L 230 180" stroke="#00bf63" stroke-width="3" fill="none" marker-end="url(#arrow)"/>
  <polygon points="230,175 240,180 230,185" fill="#00bf63"/>

  <!-- Step 2: Dispatch & Gantt -->
  <g transform="translate(245, 90)">
    <rect width="165" height="185" rx="8" fill="#f8fafc" stroke="#00bf63" stroke-width="2"/>
    <rect width="165" height="32" rx="8" fill="#00bf63"/>
    <text x="82" y="21" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">2. DISPATCH & GANTT</text>
    <text x="15" y="55" font-size="11" font-weight="700" fill="#0a0f1d">• Timeline 60 fps</text>
    <text x="25" y="73" font-size="9.5" fill="#64748b">Glisser-déposer fluide</text>
    <text x="15" y="98" font-size="11" font-weight="700" fill="#0a0f1d">• Auto-Planification</text>
    <text x="25" y="116" font-size="9.5" fill="#64748b">Moindre compétence</text>
    <rect x="12" y="130" width="141" height="36" rx="4" fill="#dcfce7" stroke="#16a34a"/>
    <text x="82" y="146" font-size="9" font-weight="700" fill="#15803d" text-anchor="middle">Créneau Unifié</text>
    <text x="82" y="158" font-size="8.5" fill="#166534" text-anchor="middle">0 doublon de planning</text>
  </g>

  <!-- Arrow 2 -> 3 -->
  <polygon points="415,175 425,180 415,185" fill="#00bf63"/>

  <!-- Step 3: Application Mobile -->
  <g transform="translate(430, 90)">
    <rect width="165" height="185" rx="8" fill="#f8fafc" stroke="#0a0f1d" stroke-width="2"/>
    <rect width="165" height="32" rx="8" fill="#0a0f1d"/>
    <text x="82" y="21" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">3. APP MOBILE TERRAIN</text>
    <text x="15" y="55" font-size="11" font-weight="700" fill="#0a0f1d">• Pointage Certifié</text>
    <text x="25" y="73" font-size="9.5" fill="#64748b">Matin obligatoire</text>
    <text x="15" y="98" font-size="11" font-weight="700" fill="#0a0f1d">• Exécution & Photos</text>
    <text x="25" y="116" font-size="9.5" fill="#64748b">Compression &lt; 75 Ko</text>
    <rect x="12" y="130" width="141" height="36" rx="4" fill="#e2e8f0" stroke="#475569"/>
    <text x="82" y="146" font-size="9" font-weight="700" fill="#0f172a" text-anchor="middle">Clôture Liée Auto</text>
    <text x="82" y="158" font-size="8.5" fill="#334155" text-anchor="middle">Devis + Travaux</text>
  </g>

  <!-- Arrow 3 -> 4 -->
  <polygon points="600,175 610,180 600,185" fill="#00bf63"/>

  <!-- Step 4: Facturation -->
  <g transform="translate(615, 90)">
    <rect width="165" height="185" rx="8" fill="#f8fafc" stroke="#00bf63" stroke-width="2"/>
    <rect width="165" height="32" rx="8" fill="#00bf63"/>
    <text x="82" y="21" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">4. FACTURATION TCE</text>
    <text x="15" y="55" font-size="11" font-weight="700" fill="#0a0f1d">• Règle Fondamentale</text>
    <text x="25" y="73" font-size="9.5" fill="#15803d">Interventions uniquement</text>
    <text x="15" y="98" font-size="11" font-weight="700" fill="#0a0f1d">• 5 Bacs de Tri</text>
    <text x="25" y="116" font-size="9.5" fill="#64748b">À facturer vs Attente</text>
    <rect x="12" y="130" width="141" height="36" rx="4" fill="#dbeafe" stroke="#2563eb"/>
    <text x="82" y="146" font-size="9" font-weight="700" fill="#1d4ed8" text-anchor="middle">Arbitrage Fiscal</text>
    <text x="82" y="158" font-size="8.5" fill="#1e40af" text-anchor="middle">B2B (HT) / B2C (TTC)</text>
  </g>

  <!-- Arrow 4 -> 5 -->
  <polygon points="785,175 795,180 785,185" fill="#00bf63"/>

  <!-- Step 5: Rentabilité -->
  <g transform="translate(800, 90)">
    <rect width="165" height="185" rx="8" fill="#f8fafc" stroke="#ff0000" stroke-width="2"/>
    <rect width="165" height="32" rx="8" fill="#ff0000"/>
    <text x="82" y="21" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">5. RENTABILITÉ</text>
    <text x="15" y="55" font-size="11" font-weight="700" fill="#0a0f1d">• CA Réalisé HT</text>
    <text x="25" y="73" font-size="9.5" fill="#64748b">Total chantiers clos</text>
    <text x="15" y="98" font-size="11" font-weight="700" fill="#0a0f1d">• Rentabilité / h</text>
    <text x="25" y="116" font-size="9.5" fill="#64748b">CA / heures pointées</text>
    <rect x="12" y="130" width="141" height="36" rx="4" fill="#fee2e2" stroke="#dc2626"/>
    <text x="82" y="146" font-size="9" font-weight="700" fill="#b91c1c" text-anchor="middle">Marge Brute Équipes</text>
    <text x="82" y="158" font-size="8.5" fill="#991b1b" text-anchor="middle">Coût horaire chargé</text>
  </g>
</svg>`;

// 2. Schema Workflow Technicien Mobile
const svg2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 380" width="100%" height="100%" style="background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <rect width="1000" height="380" fill="#f8fafc" rx="12"/>
  <rect x="15" y="15" width="970" height="350" fill="#ffffff" rx="8" stroke="#e2e8f0" stroke-width="1.5"/>

  <text x="35" y="45" font-size="16" font-weight="800" fill="#0a0f1d">WORKFLOW QUOTIDIEN TERRAIN DU TECHNICIEN (APPLICATION MOBILE PWA)</text>
  <text x="35" y="65" font-size="11" fill="#64748b">Règles de sécurité, horodatage certifié serveur, déclarations terrain et synchronisation automatique</text>

  <!-- Actors -->
  <g transform="translate(140, 80)">
    <rect width="150" height="36" rx="18" fill="#00bf63"/>
    <text x="75" y="23" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">👷 Technicien Terrain</text>
    <line x1="75" y1="36" x2="75" y2="280" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>
  </g>

  <g transform="translate(425, 80)">
    <rect width="150" height="36" rx="18" fill="#0a0f1d"/>
    <text x="75" y="23" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">📱 App Mobile ANELEC</text>
    <line x1="75" y1="36" x2="75" y2="280" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>
  </g>

  <g transform="translate(710, 80)">
    <rect width="150" height="36" rx="18" fill="#334155"/>
    <text x="75" y="23" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">🏢 Serveur & Direction</text>
    <line x1="75" y1="36" x2="75" y2="280" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>
  </g>

  <!-- Step 1: Matin -->
  <line x1="215" y1="140" x2="495" y2="140" stroke="#00bf63" stroke-width="2"/>
  <polygon points="495,137 500,140 495,143" fill="#00bf63"/>
  <rect x="250" y="125" width="220" height="22" rx="4" fill="#dcfce7"/>
  <text x="360" y="140" font-size="10" font-weight="700" fill="#15803d" text-anchor="middle">1. Clic "Pointer mon arrivée au bureau"</text>

  <line x1="505" y1="160" x2="780" y2="160" stroke="#0a0f1d" stroke-width="2"/>
  <polygon points="780,157 785,160 780,163" fill="#0a0f1d"/>
  <text x="645" y="155" font-size="9.5" fill="#475569" text-anchor="middle">Horodatage serveur certifié (ex: 07:45)</text>

  <rect x="445" y="172" width="400" height="20" rx="4" fill="#fef9c3" stroke="#ca8a04"/>
  <text x="645" y="186" font-size="9" font-weight="700" fill="#854d0e" text-anchor="middle">Journée déverrouillée • Interventions accessibles</text>

  <!-- Step 2: Chantier -->
  <line x1="215" y1="215" x2="495" y2="215" stroke="#2563eb" stroke-width="2"/>
  <polygon points="495,212 500,215 495,218" fill="#2563eb"/>
  <rect x="260" y="202" width="200" height="22" rx="4" fill="#dbeafe"/>
  <text x="360" y="217" font-size="10" font-weight="700" fill="#1d4ed8" text-anchor="middle">2. Actions & Photos (&lt; 75 Ko)</text>

  <!-- Step 3: Cloture -->
  <line x1="215" y1="250" x2="495" y2="250" stroke="#00bf63" stroke-width="2"/>
  <polygon points="495,247 500,250 495,253" fill="#00bf63"/>
  <rect x="270" y="238" width="180" height="22" rx="4" fill="#dcfce7"/>
  <text x="360" y="253" font-size="10" font-weight="700" fill="#166534" text-anchor="middle">3. "Clôturer l'intervention"</text>

  <line x1="505" y1="265" x2="780" y2="265" stroke="#00bf63" stroke-width="2"/>
  <polygon points="780,262 785,265 780,268" fill="#00bf63"/>
  <text x="645" y="260" font-size="9.5" font-weight="700" fill="#15803d" text-anchor="middle">Clôture auto Devis + Intervention rattachée</text>

  <!-- Step 4: Soir -->
  <line x1="215" y1="305" x2="495" y2="305" stroke="#0a0f1d" stroke-width="2"/>
  <polygon points="495,302 500,305 495,308" fill="#0a0f1d"/>
  <rect x="250" y="293" width="220" height="22" rx="4" fill="#f1f5f9"/>
  <text x="360" y="308" font-size="10" font-weight="700" fill="#0f172a" text-anchor="middle">4. Clic "Pointer ma fin de journée"</text>

  <line x1="505" y1="325" x2="780" y2="325" stroke="#0a0f1d" stroke-width="2"/>
  <polygon points="780,322 785,325 780,328" fill="#0a0f1d"/>
  <text x="645" y="320" font-size="9.5" fill="#475569" text-anchor="middle">Vérification zéro chantier en cours &amp; clôture journée</text>
</svg>`;

// 3. Schema Grille de Reconversion Devis
const svg3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="100%" height="100%" style="background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <rect width="1000" height="320" fill="#f8fafc" rx="12"/>
  <rect x="15" y="15" width="970" height="290" fill="#ffffff" rx="8" stroke="#e2e8f0" stroke-width="1.5"/>

  <text x="35" y="45" font-size="16" font-weight="800" fill="#0a0f1d">GRILLE DE DÉCISION DE RECONVERSION DEVIS</text>
  <text x="35" y="65" font-size="11" fill="#64748b">Sécurité anti-doublon lors d'une seconde conversion d'un devis déjà traité</text>

  <!-- Trigger Box -->
  <g transform="translate(35, 100)">
    <rect width="210" height="150" rx="8" fill="#0a0f1d"/>
    <text x="105" y="30" font-size="12" font-weight="800" fill="#ffcc00" text-anchor="middle">Devis Déjà Traité</text>
    <text x="105" y="50" font-size="9.5" fill="#94a3b8" text-anchor="middle">(interventionsCount &gt; 0)</text>
    <line x1="20" y1="65" x2="190" y2="65" stroke="#334155"/>
    <text x="105" y="90" font-size="10" fill="#ffffff" text-anchor="middle">L'utilisateur clique sur</text>
    <rect x="25" y="102" width="160" height="30" rx="4" fill="#00bf63"/>
    <text x="105" y="121" font-size="10" font-weight="800" fill="#ffffff" text-anchor="middle">"Convertir en intervention"</text>
  </g>

  <!-- Branching Arrows -->
  <path d="M 245 175 L 300 175" stroke="#00bf63" stroke-width="3" fill="none"/>
  <polygon points="300,170 310,175 300,180" fill="#00bf63"/>

  <!-- Decision Grid 4 Choices -->
  <g transform="translate(320, 90)">
    <!-- Option 1 -->
    <rect x="0" y="0" width="310" height="78" rx="6" fill="#fef2f2" stroke="#ff0000" stroke-width="1.5"/>
    <text x="15" y="24" font-size="11" font-weight="800" fill="#991b1b">🛠️ SAV (Garantie / Réserve)</text>
    <text x="15" y="42" font-size="9" fill="#7f1d1d">• Non refacturé • Couvert par garantie</text>
    <text x="15" y="60" font-size="8.5" font-family="monospace" fill="#b91c1c">Génère : [SAV] + Type SAV</text>

    <!-- Option 2 -->
    <rect x="330" y="0" width="310" height="78" rx="6" fill="#fefce8" stroke="#ca8a04" stroke-width="1.5"/>
    <text x="345" y="24" font-size="11" font-weight="800" fill="#854d0e">🔁 Reprise de Travaux / Refaire</text>
    <text x="345" y="42" font-size="9" fill="#713f12">• Malfaçon ou inachevé sur site</text>
    <text x="345" y="60" font-size="8.5" font-family="monospace" fill="#a16207">Génère : [REPRISE] + Type Reprise</text>

    <!-- Option 3 -->
    <rect x="0" y="92" width="310" height="78" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
    <text x="15" y="116" font-size="11" font-weight="800" fill="#1e40af">➕ Travaux Supp. / Avenant</text>
    <text x="15" y="134" font-size="9" fill="#1e3a8a">• Demande client additionnelle (Facturable)</text>
    <text x="15" y="152" font-size="8.5" font-family="monospace" fill="#1d4ed8">Génère : [AVENANT] + Type Avenant</text>

    <!-- Option 4 -->
    <rect x="330" y="92" width="310" height="78" rx="6" fill="#faf5ff" stroke="#7c3aed" stroke-width="1.5"/>
    <text x="345" y="116" font-size="11" font-weight="800" fill="#5b21b6">📅 2ème Phase de Chantier</text>
    <text x="345" y="134" font-size="9" fill="#4c1d95">• Multi-étapes (Séchage, 2nd corps d'état)</text>
    <text x="345" y="152" font-size="8.5" font-family="monospace" fill="#6d28d9">Génère : [PHASE 2] + Type 2ème Phase</text>
  </g>
</svg>`;

// 4. Schema Facturation & Arbitrage
const svg4 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="100%" height="100%" style="background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <rect width="1000" height="320" fill="#f8fafc" rx="12"/>
  <rect x="15" y="15" width="970" height="290" fill="#ffffff" rx="8" stroke="#e2e8f0" stroke-width="1.5"/>

  <text x="35" y="45" font-size="16" font-weight="800" fill="#0a0f1d">FACTURATION INTELLIGENTE & ARBITRAGE FISCAL (B2B vs B2C)</text>
  <text x="35" y="65" font-size="11" fill="#64748b">Règle standard ANELEC : on ne facture que les chantiers achevés, pas les devis</text>

  <!-- 5 Bacs -->
  <g transform="translate(35, 90)">
    <rect x="0" y="0" width="175" height="85" rx="6" fill="#dcfce7" stroke="#00bf63" stroke-width="2"/>
    <text x="12" y="24" font-size="11" font-weight="800" fill="#15803d">🟢 À facturer (Prêtes)</text>
    <text x="12" y="42" font-size="9" fill="#166534">Travaux clôturés</text>
    <text x="12" y="58" font-size="9" fill="#166534">Rapports &amp; photos OK</text>
    <text x="12" y="74" font-size="8.5" font-weight="700" fill="#047857">&rarr; Émission immédiate</text>

    <rect x="195" y="0" width="175" height="85" rx="6" fill="#fef9c3" stroke="#ca8a04" stroke-width="2"/>
    <text x="207" y="24" font-size="11" font-weight="800" fill="#854d0e">🟡 À vérifier</text>
    <text x="207" y="42" font-size="9" fill="#713f12">Travaux terminés</text>
    <text x="207" y="58" font-size="9" fill="#713f12">En attente de validation</text>
    <text x="207" y="74" font-size="8.5" font-weight="700" fill="#a16207">&rarr; Contrôle métré/heures</text>

    <rect x="390" y="0" width="175" height="85" rx="6" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
    <text x="402" y="24" font-size="11" font-weight="800" fill="#991b1b">🔴 Ne pas facturer</text>
    <text x="402" y="42" font-size="9" fill="#7f1d1d">Visites devis, SAV</text>
    <text x="402" y="58" font-size="9" fill="#7f1d1d">Missions en cours</text>
    <text x="402" y="74" font-size="8.5" font-weight="700" fill="#b91c1c">&rarr; Non éligible</text>

    <rect x="585" y="0" width="175" height="85" rx="6" fill="#fef2f2" stroke="#b91c1c" stroke-width="2"/>
    <text x="597" y="24" font-size="11" font-weight="800" fill="#991b1b">⚠️ Retards Clients</text>
    <text x="597" y="42" font-size="9" fill="#7f1d1d">Échéance dépassée</text>
    <text x="597" y="58" font-size="9" fill="#7f1d1d">J+30 ou J+45</text>
    <text x="597" y="74" font-size="8.5" font-weight="700" fill="#991b1b">&rarr; Relance Niveau 1/2</text>

    <rect x="780" y="0" width="150" height="85" rx="6" fill="#f1f5f9" stroke="#0a0f1d" stroke-width="2"/>
    <text x="792" y="24" font-size="11" font-weight="800" fill="#0f172a">✅ Facturées</text>
    <text x="792" y="42" font-size="9" fill="#334155">Factures transmises</text>
    <text x="792" y="58" font-size="9" fill="#334155">Comptabilité &amp; payées</text>
    <text x="792" y="74" font-size="8.5" font-weight="700" fill="#0a0f1d">&rarr; Archivage clos</text>
  </g>

  <!-- Arbitrage Section -->
  <g transform="translate(35, 195)">
    <rect width="450" height="85" rx="6" fill="#f8fafc" stroke="#00bf63" stroke-width="1.5"/>
    <text x="15" y="24" font-size="12" font-weight="800" fill="#00bf63">🏢 Arbitrage Régime B2B (Professionnel / Syndic)</text>
    <text x="15" y="45" font-size="9.5" fill="#1e293b">• Saisie prioritaire en Montant HT</text>
    <text x="15" y="62" font-size="9.5" fill="#1e293b">• Autoliquidation 0% (Sous-traitance BTP) ou TVA 20%</text>
    <text x="15" y="78" font-size="9.5" fill="#64748b">• Réf. Bon de Commande &amp; Échéance 30/45 jours</text>

    <rect x="500" y="0" width="450" height="85" rx="6" fill="#f8fafc" stroke="#2563eb" stroke-width="1.5"/>
    <text x="515" y="24" font-size="12" font-weight="800" fill="#2563eb">🏠 Arbitrage Régime B2C (Particulier / Occupant)</text>
    <text x="515" y="45" font-size="9.5" fill="#1e293b">• Saisie prioritaire en Montant TTC</text>
    <text x="515" y="62" font-size="9.5" fill="#1e293b">• TVA réduite 10% (Rénovation &gt;2 ans) ou 5,5% (Énergétique)</text>
    <text x="515" y="78" font-size="9.5" fill="#64748b">• Règlement direct au comptant à la clôture</text>
  </g>
</svg>`;

fs.writeFileSync(path.join(OUT_DIR, 'schema-01-cycle-tce.svg'), svg1);
fs.writeFileSync(path.join(OUT_DIR, 'schema-02-workflow-technicien-mobile.svg'), svg2);
fs.writeFileSync(path.join(OUT_DIR, 'schema-03-grille-reconversion-devis.svg'), svg3);
fs.writeFileSync(path.join(OUT_DIR, 'schema-04-tri-facturation-arbitrage.svg'), svg4);

console.log('4 Schémas SVG générés avec succès dans', OUT_DIR);
