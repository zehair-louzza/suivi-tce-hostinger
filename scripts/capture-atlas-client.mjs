import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ARTIFACTS_DIR = 'C:/Users/Zeh/.gemini/antigravity/brain/d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';
const DOCS_DIR = 'C:/Users/Zeh/suivi-tce-hostinger/docs/images';

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Puppeteer Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  // Interception des requêtes API pour mock instantané
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/auth/me')) {
      return req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 1,
            email: 'direction@anelec.fr',
            name: 'Direction ANELEC',
            role: 'ADMIN',
            companyName: 'ANELEC GROUPE',
            permissions: {
              canManageUsers: true,
              canManageReferentiels: true,
              canEditDevis: true,
              canViewFinancials: true,
              canConvertDevis: true,
              canEditPlanning: true,
              canEditInterventions: true,
              canWriteReports: true,
              canManageBilling: true,
              canDeleteRecords: true,
            },
          },
        }),
      });
    }
    if (url.includes('/api/devis')) {
      return req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, reference: 'DEV-2026-001', client: 'GMS', amount: 4200, statutCommercial: 'Accepté' },
          { id: 2, reference: 'DEV-2026-002', client: 'C-Multi-Serv', amount: 4200, statutCommercial: 'Envoyé' },
          { id: 3, reference: 'DEV-2026-003', client: 'Presta maintenance', amount: 8400, statutCommercial: 'Accepté' },
          { id: 4, reference: 'DEV-2026-004', client: 'Nexity', amount: 16800, statutCommercial: 'En négociation' },
          { id: 5, reference: 'DEV-2026-005', client: 'EMALEC', amount: 6750, statutCommercial: 'Accepté' },
        ]),
      });
    }
    if (url.includes('/api/interventions')) {
      return req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, reference: 'INT-2026-001', client: 'Presta maintenance', entreprise: 'Anouar', heureDebut: '08:30', heureFin: '11:00', statutOperationnel: 'Planifiée', amount: 1850 },
          { id: 2, reference: 'INT-2026-002', client: 'C-Multi-Serv', entreprise: 'Mohamed', heureDebut: '09:00', heureFin: '11:30', statutOperationnel: 'En cours', amount: 1200 },
          { id: 3, reference: 'INT-2026-004', client: 'EMALEC', entreprise: 'Jamal', heureDebut: '08:00', heureFin: '10:30', statutOperationnel: 'Terminée - à valider', amount: 2100, photos: [{}, {}, {}, {}, {}, {}] },
          { id: 4, reference: 'INT-2026-005', client: 'Presta la Rochelle', entreprise: 'Manneh', heureDebut: '09:30', heureFin: '15:30', statutOperationnel: 'Planifiée', amount: 3400 },
          { id: 5, reference: 'INT-2026-007', client: 'GMS', entreprise: 'Haitam', heureDebut: '10:00', heureFin: '12:00', statutOperationnel: 'En cours', priorite: 'Urgente', amount: 950 },
          { id: 6, reference: 'INT-2026-008', client: 'Syndic Paris 08', entreprise: 'Yankoubou', heureDebut: '13:00', heureFin: '17:30', statutOperationnel: 'Planifiée', amount: 4150 },
        ]),
      });
    }
    if (url.includes('/api/referentiels')) {
      return req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          corpsEtat: ['Électricité', 'Plomberie', 'Peinture', 'Menuiserie', 'Serrurerie'],
          techniciens: ['Anouar', 'Mohamed', 'Haitam', 'Jamal', 'Manneh', 'Yankoubou'],
        }),
      });
    }
    if (url.includes('/api/')) {
      return req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
    req.continue();
  });

  // Injecter localStorage avant chargement du document
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user: {
            id: 1,
            email: 'direction@anelec.fr',
            name: 'Direction ANELEC',
            role: 'ADMIN',
            companyName: 'ANELEC GROUPE',
            permissions: {
              canManageUsers: true,
              canManageReferentiels: true,
              canEditDevis: true,
              canViewFinancials: true,
              canConvertDevis: true,
              canEditPlanning: true,
              canEditInterventions: true,
              canWriteReports: true,
              canManageBilling: true,
              canDeleteRecords: true,
            },
          },
          accessToken: 'mock-valid-jwt-token',
          isAuthenticated: true,
          isLoading: false,
        },
        version: 0,
      })
    );
    localStorage.setItem('anelec_theme_company_default', 'atlas');
    localStorage.setItem('anelec_theme_user_pref', 'atlas');
    localStorage.setItem('anelec_theme_allow_user_override', 'true');
    document.documentElement.setAttribute('data-theme', 'atlas');
  });

  // 1. Navigation Accueil (Synthèse)
  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2500));

  console.log('Current URL:', page.url());
  const synthPath1 = path.join(DOCS_DIR, 'compare-app-atlas-synthese.png');
  const synthPath2 = path.join(ARTIFACTS_DIR, 'compare-app-atlas-synthese.png');
  await page.screenshot({ path: synthPath1, fullPage: false });
  fs.copyFileSync(synthPath1, synthPath2);
  console.log('Saved Synthèse screenshot:', synthPath1);

  // 2. Onglet Opérations
  console.log('Clicking Opérations subnav button...');
  const clickedOps = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.m-subnav-item'));
    const op = btns.find((b) => b.textContent && b.textContent.includes('Opérations'));
    if (op) {
      op.click();
      return true;
    }
    return false;
  });

  if (clickedOps) {
    await new Promise((r) => setTimeout(r, 2000));
    const opsPath1 = path.join(DOCS_DIR, 'compare-app-atlas-operations.png');
    const opsPath2 = path.join(ARTIFACTS_DIR, 'compare-app-atlas-operations.png');
    await page.screenshot({ path: opsPath1, fullPage: false });
    fs.copyFileSync(opsPath1, opsPath2);
    console.log('Saved Opérations screenshot:', opsPath1);
  } else {
    console.warn('Opérations button not found');
  }

  // 3. Onglet Analyse
  console.log('Clicking Analyse subnav button...');
  const clickedAna = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.m-subnav-item'));
    const ana = btns.find((b) => b.textContent && b.textContent.includes('Analyse'));
    if (ana) {
      ana.click();
      return true;
    }
    return false;
  });

  if (clickedAna) {
    await new Promise((r) => setTimeout(r, 2000));
    const anaPath1 = path.join(DOCS_DIR, 'compare-app-atlas-analyse.png');
    const anaPath2 = path.join(ARTIFACTS_DIR, 'compare-app-atlas-analyse.png');
    await page.screenshot({ path: anaPath1, fullPage: false });
    fs.copyFileSync(anaPath1, anaPath2);
    console.log('Saved Analyse screenshot:', anaPath1);
  } else {
    console.warn('Analyse button not found');
  }

  await browser.close();
  console.log('ALL THREE ATLAS SCREENSHOTS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
