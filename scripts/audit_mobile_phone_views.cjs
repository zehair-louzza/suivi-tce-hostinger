const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const repoDir = 'C:\\Users\\Zeh\\suivi-tce-hostinger';
const artifactDir = 'C:\\Users\\Zeh\\.gemini\\antigravity\\brain\\d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';
const auditDir = path.join(artifactDir, 'mobile_audit');

if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });

async function main() {
  console.log('=== AUDIT EXPERT ERGONOMIE MOBILE SMARTPHONE (390x844) ===');

  console.log('1. Lancement serveur preview...');
  const preview = spawn('npx.cmd', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
    cwd: repoDir,
    shell: true,
  });

  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4173/');
      if (res.status === 200) break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/auth/me')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 1,
            name: 'Zehair Louzza',
            email: 'louzza.zehair@gmail.com',
            role: 'ADMIN',
            companyName: 'ANELEC GROUPE',
            technicienNom: 'Anouar',
            permissions: { canManageUsers: true, canWriteReports: true },
          },
        }),
      });
    } else if (url.includes('/api/referentiels')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          techniciens: ['Anouar', 'Mohamed', 'Haitam', 'Jamal', 'Manneh', 'Yankoubou'],
          corpsEtat: ['Électricité', 'Plomberie', 'Serrurerie', 'Peinture', 'Menuiserie', 'Tous corps d’état'],
          clients: ['Presta maintenance', 'Presta la rochelle', 'C-Multi-Serv', 'GMS', 'EMALEC'],
          origines: ['Appel d’offres', 'Contrat cadre', 'Demande directe'],
          technicien_competences: {
            Anouar: ['Électricité', 'Plomberie', 'Serrurerie'],
            Mohamed: ['Plomberie'],
            Haitam: ['Serrurerie'],
            Jamal: ['Peinture'],
            Manneh: ['Menuiserie'],
            Yankoubou: ['Électricité'],
          },
        }),
      });
    } else if (url.includes('/api/devis')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 1, reference: 'DEV-2026-001', client: 'Presta maintenance', site: 'Paris 08', objet: 'Rénovation TGBT & distribution', corpsEtat: 'Électricité', amount: 8400, statutCommercial: 'Accepté', dateCreated: '2026-11-01', interventionsCount: 1 },
            { id: 2, reference: 'DEV-2026-002', client: 'C-Multi-Serv', site: 'Neuilly-sur-Seine', objet: 'Remplacement colonnes montantes', corpsEtat: 'Plomberie', amount: 4200, statutCommercial: 'Envoyé au client', dateCreated: '2026-11-02' },
          ],
        }),
      });
    } else if (url.includes('/api/interventions')) {
      const todayStr = '2026-11-06';
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 101, reference: 'INT-2026-001', client: 'Presta maintenance', chantier: '8 rue de Penthièvre, 75008 Paris', objet: 'Dépannage TGBT', corpsEtat: 'Électricité', entreprise: 'Anouar', statutOperationnel: 'En cours', datePlanifiee: todayStr, heureDebut: '08:30', heureFin: '11:00', amount: 1450, statutFacture: 'Non facturée' },
            { id: 102, reference: 'INT-2026-002', client: 'C-Multi-Serv', chantier: '22 av. Charles de Gaulle, 92200 Neuilly', objet: 'Recherche de fuite', corpsEtat: 'Plomberie', entreprise: 'Mohamed', statutOperationnel: 'Planifiée', datePlanifiee: todayStr, heureDebut: '11:30', heureFin: '13:30', amount: 890, statutFacture: 'Non facturée' },
          ],
        }),
      });
    } else if (url.includes('/api/admin/users')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 1, name: 'Zehair Louzza', email: 'louzza.zehair@gmail.com', role: 'ADMIN', technicienNom: 'Anouar' },
            { id: 2, name: 'Anouar', email: 'anouar@anelecgroupe.com', role: 'TECHNICIEN', technicienNom: 'Anouar' },
          ],
        }),
      });
    } else if (url.includes('/api/admin/pointages')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { technicien: 'Anouar', dateJour: '2026-11-06', statutMatin: 'Pointé', heureMatin: '07:55', statutSoir: 'En cours', totalHeures: 4.5 },
          ],
        }),
      });
    } else {
      req.continue();
    }
  });

  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user: {
            id: 1,
            name: 'Zehair Louzza',
            role: 'ADMIN',
            companyName: 'ANELEC GROUPE',
            technicienNom: 'Anouar',
          },
          isAuthenticated: true,
          accessToken: 'mock-token',
        },
        version: 0,
      })
    );
  });

  const analyzeCurrentView = async (viewName) => {
    console.log(`\n--- Analyse de ${viewName} ---`);
    const metrics = await page.evaluate(() => {
      const issues = [];
      const bodyWidth = document.body.scrollWidth;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      if (bodyWidth > windowWidth) {
        issues.push(`⚠️ DÉBORDEMENT GLOBAL : scrollWidth=${bodyWidth}px > windowWidth=${windowWidth}px (+${bodyWidth - windowWidth}px)`);
      }

      // Check all elements for overflow > 390px
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > windowWidth + 2 && !['HTML', 'BODY'].includes(el.tagName)) {
          const className = el.className || el.tagName;
          issues.push(`Débordement élément: <${el.tagName.toLowerCase()} class="${className}"> width=${Math.round(rect.width)}px`);
        }
      });

      // Check bottom nav overlap
      const bottomNav = document.querySelector('.mobile-bottom-nav');
      const bottomNavRect = bottomNav ? bottomNav.getBoundingClientRect() : null;

      // Check fixed/sticky elements
      const fixedEls = allElements.filter((el) => {
        const style = window.getComputedStyle(el);
        return style.position === 'fixed' || style.position === 'sticky';
      });

      return {
        bodyWidth,
        issues: Array.from(new Set(issues)).slice(0, 10),
        fixedCount: fixedEls.length,
        bottomNavVisible: Boolean(bottomNavRect && bottomNavRect.height > 0),
        bottomNavTop: bottomNavRect ? Math.round(bottomNavRect.top) : null,
      };
    });

    console.log(`  Issues détectées (${metrics.issues.length}):`);
    metrics.issues.forEach((i) => console.log(`   - ${i}`));
    console.log(`  Barre inférieure: ${metrics.bottomNavVisible ? `Visible à y=${metrics.bottomNavTop}px` : 'Non visible'}`);

    // Capture screenshot
    const shotPath = path.join(auditDir, `${viewName}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`  Screenshot sauvé : ${shotPath}`);
  };

  // Test 1 : Devis List & Drawer
  await page.goto('http://127.0.0.1:4173/devis');
  await new Promise((r) => setTimeout(r, 1200));
  await analyzeCurrentView('01-mobile-devis-list');

  // Ouvrir le volet tiroir Devis
  console.log('Ouverture du tiroir Devis...');
  await page.evaluate(() => {
    const card = document.querySelector('.mobile-record-card');
    if (card) card.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await analyzeCurrentView('02-mobile-devis-drawer-open');

  // Fermer le tiroir
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.inspector-drawer button');
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Test 2 : Interventions List & Drawer
  await page.goto('http://127.0.0.1:4173/interventions');
  await new Promise((r) => setTimeout(r, 1200));
  await analyzeCurrentView('03-mobile-interventions-list');

  console.log('Ouverture du tiroir Intervention...');
  await page.evaluate(() => {
    const card = document.querySelector('.mobile-record-card');
    if (card) card.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await analyzeCurrentView('04-mobile-intervention-drawer-open');

  // Test 3 : Facturation
  await page.goto('http://127.0.0.1:4173/facturation');
  await new Promise((r) => setTimeout(r, 1200));
  await analyzeCurrentView('05-mobile-facturation');

  // Test 4 : Planning
  await page.goto('http://127.0.0.1:4173/planning');
  await new Promise((r) => setTimeout(r, 1200));
  await analyzeCurrentView('06-mobile-planning');

  // Test 5 : Rentabilité
  await page.goto('http://127.0.0.1:4173/rentabilite');
  await new Promise((r) => setTimeout(r, 1200));
  await analyzeCurrentView('07-mobile-rentabilite');

  // Test 6 : Référentiels
  await page.goto('http://127.0.0.1:4173/referentiels');
  await new Promise((r) => setTimeout(r, 1200));
  await analyzeCurrentView('08-mobile-referentiels');

  // Test 7 : Admin
  await page.goto('http://127.0.0.1:4173/admin');
  await new Promise((r) => setTimeout(r, 1200));
  await analyzeCurrentView('09-mobile-admin');

  // Test 8 : Hamburger Menu Drawer
  await page.goto('http://127.0.0.1:4173/');
  await new Promise((r) => setTimeout(r, 1000));
  console.log('Ouverture du menu Hamburger mobile...');
  await page.evaluate(() => {
    const burger = document.querySelector('header .btn-secondary');
    if (burger) burger.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await analyzeCurrentView('10-mobile-menu-burger-open');

  await browser.close();
  preview.kill();
  console.log('AUDIT TERMINÉ !');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
