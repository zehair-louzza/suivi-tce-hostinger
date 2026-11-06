const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const repoDir = 'C:\\Users\\Zeh\\suivi-tce-hostinger';
const artifactDir = 'C:\\Users\\Zeh\\.gemini\\antigravity\\brain\\d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';
const screenDir = path.join(artifactDir, 'browser_inspection');

if (!fs.existsSync(screenDir)) fs.mkdirSync(screenDir, { recursive: true });

async function main() {
  console.log('=== INSPECTION DIRECTE EN BROWSER (CHROME HEADLESS) ===');

  console.log('1. Lancement du serveur preview local...');
  const preview = spawn('npx.cmd', ['vite', 'preview', '--port', '4175', '--host', '127.0.0.1'], {
    cwd: repoDir,
    shell: true,
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4175/');
      if (res.status === 200) {
        console.log('Serveur preview prêt sur http://127.0.0.1:4175');
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const mockInterventions = [
    {
      id: 101,
      reference: 'INT-2026-001',
      client: 'Presta maintenance',
      chantier: 'Site A - Paris',
      entreprise: 'Anouar',
      corpsEtat: 'Électricité',
      statutOperationnel: 'Clôturée',
      statutFacture: 'Non facturée',
      statutRapport: 'Validé & Clôturé',
      datePlanifiee: '2026-11-04',
      dateReelle: '2026-11-04',
      heureDebut: '08:00',
      heureFin: '12:00',
      heureDebutReelle: '08:00',
      heureFinReelle: '12:30',
      amount: 450,
      photos: [{ id: 1, url: 'test.jpg' }],
      actionsRealisees: ['Remplacement disjoncteur'],
    },
    {
      id: 102,
      reference: 'INT-2026-002',
      client: 'Particulier Dupont',
      chantier: 'Appartement 4B',
      entreprise: 'Mohamed',
      corpsEtat: 'Plomberie',
      statutOperationnel: 'Terminée - à valider',
      statutFacture: 'Non facturée',
      statutRapport: 'Déclaré par technicien',
      datePlanifiee: '2026-11-05',
      dateReelle: '2026-11-05',
      heureDebut: '14:00',
      heureFin: '16:00',
      amount: 280,
      photos: [{ id: 2, url: 'test2.jpg' }],
      actionsRealisees: ['Recherche de fuite'],
    },
    {
      id: 103,
      reference: 'INT-2025-089',
      client: 'C-Multi-Serv',
      chantier: 'Boutique Lyon',
      entreprise: 'Anouar',
      corpsEtat: 'Électricité',
      statutOperationnel: 'Clôturée',
      statutFacture: 'Facturée',
      numeroFacture: 'FAC-2025-089',
      datePlanifiee: '2025-10-15',
      dateReelle: '2025-10-15',
      amount: 890,
      photos: [],
      actionsRealisees: ['Câblage tableau'],
    }
  ];

  const mockUsers = [
    {
      id: 1,
      name: 'Zehair Louzza',
      email: 'louzza.zehair@gmail.com',
      role: 'ADMIN',
      companyId: 1,
      active: true,
      technicienNom: 'Anouar',
      permissions: { canManageUsers: true, canEditDevis: true, canEditPlanning: true, canEditInterventions: true, canWriteReports: true, canManageBilling: true },
    },
    {
      id: 2,
      name: 'Mohamed Plombier',
      email: 'mohamed@tech.fr',
      role: 'CONDUCTEUR_TRAVAUX',
      companyId: 1,
      active: true,
      technicienNom: 'Mohamed',
      permissions: { canEditInterventions: true, canWriteReports: true, mobileOnly: true },
    }
  ];

  let currentRefs = {
    techniciens: ['Anouar', 'Mohamed', 'Haitam', 'Jamal'],
    responsables: ['Zehair', 'Directeur Technique'],
    corps_etat: ['Électricité', 'Plomberie', 'Serrurerie', 'Peinture'],
    clients: ['Presta maintenance', 'C-Multi-Serv', 'GMS'],
    origines: ['Appel d’offres', 'Contrat cadre', 'Demande directe'],
    technicien_competences: {
      Anouar: ['Électricité', 'Plomberie'],
      Mohamed: ['Plomberie'],
      Haitam: ['Serrurerie'],
      Jamal: ['Peinture'],
    },
    equipes_journalieres: [],
  };

  const setupPageInterceptions = async (page) => {
    await page.setRequestInterception(true);
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || type === 'warn' || text.includes('error') || text.includes('Error')) {
        console.log(`[PAGE ${type.toUpperCase()}]:`, text);
      }
    });

    page.on('pageerror', (err) => console.error('[PAGE ERROR CRITICAL]:', err.message));

    page.on('request', (req) => {
      const url = req.url();
      const method = req.method();

      if (url.includes('/api/auth/me')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: mockUsers[0],
          }),
        });
      } else if (url.includes('/api/referentiels') && method === 'GET') {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: currentRefs }),
        });
      } else if (url.includes('/api/referentiels') && method === 'PUT') {
        const postData = JSON.parse(req.postData() || '{}');
        console.log('API PUT /referentiels called with:', postData);
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: postData, message: 'Mis à jour' }),
        });
      } else if (url.includes('/api/admin/users') && method === 'GET') {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockUsers, roles: {} }),
        });
      } else if (url.includes('/api/admin/users') && method === 'PUT') {
        const postData = JSON.parse(req.postData() || '{}');
        console.log('API PUT /admin/users called with:', postData);
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...mockUsers[0], ...postData }, message: 'Droits mis à jour' }),
        });
      } else if (url.includes('/api/interventions')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockInterventions }),
        });
      } else if (url.includes('/api/devis')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      } else if (url.includes('/api/admin/pointages')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      } else {
        req.continue();
      }
    });
  };

  // Helper pour vérifier le débordement horizontal
  const checkOverflow = async (page, pageName) => {
    return await page.evaluate((name) => {
      const docWidth = document.documentElement.offsetWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const isOverflowing = scrollWidth > winWidth + 1;

      const overflowingEls = [];
      if (isOverflowing) {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const rect = el.getBoundingClientRect();
          if (rect.right > winWidth + 2) {
            overflowingEls.push({
              tag: el.tagName,
              className: el.className,
              id: el.id,
              right: rect.right,
              width: rect.width,
              text: el.innerText ? el.innerText.slice(0, 30) : ''
            });
          }
        }
      }

      return {
        name,
        docWidth,
        scrollWidth,
        winWidth,
        isOverflowing,
        overflowCount: overflowingEls.length,
        topOverflowing: overflowingEls.slice(0, 5),
      };
    }, pageName);
  };

  try {
    // -----------------------------------------------------------------
    // TEST 1: MOBILE (390x844) - VERIFICATION COMPLETE
    // -----------------------------------------------------------------
    console.log('\n--- TEST SUR VUE MOBILE (390x844) ---');
    const pageMobile = await browser.newPage();
    await pageMobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await setupPageInterceptions(pageMobile);

    // Initialisation Auth
    await pageMobile.goto('http://127.0.0.1:4175/', { waitUntil: 'networkidle2' });
    await pageMobile.evaluate(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: { id: 1, name: 'Zehair Louzza', email: 'louzza.zehair@gmail.com', role: 'ADMIN', companyId: 1 },
          accessToken: 'mock-valid-token-for-preview',
          isAuthenticated: true,
          isLoading: false
        },
        version: 0
      }));
    });
    await pageMobile.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // A. Page Facturation
    console.log('\n--> Inspection de /facturation (Mobile)...');
    await pageMobile.goto('http://127.0.0.1:4175/facturation', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));
    const ofFactMobile = await checkOverflow(pageMobile, 'Facturation Mobile');
    console.log('Débordement Facturation Mobile:', ofFactMobile);
    await pageMobile.screenshot({ path: path.join(screenDir, '01-mobile-facturation.png'), fullPage: true });

    // B. Page Rentabilité
    console.log('\n--> Inspection de /rentabilite (Mobile)...');
    await pageMobile.goto('http://127.0.0.1:4175/rentabilite', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));
    const ofRentMobile = await checkOverflow(pageMobile, 'Rentabilite Mobile');
    console.log('Débordement Rentabilité Mobile:', ofRentMobile);
    await pageMobile.screenshot({ path: path.join(screenDir, '02-mobile-rentabilite.png'), fullPage: true });

    // C. Page Paramètres Métier (Référentiels)
    console.log('\n--> Inspection de /referentiels (Mobile)...');
    await pageMobile.goto('http://127.0.0.1:4175/referentiels', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));
    const ofRefMobile = await checkOverflow(pageMobile, 'Referentiels Mobile');
    console.log('Débordement Paramètres Métier Mobile:', ofRefMobile);
    await pageMobile.screenshot({ path: path.join(screenDir, '03-mobile-referentiels.png'), fullPage: true });

    // D. Page Administration (Workstation Admin & Utilisateurs)
    console.log('\n--> Inspection de /admin (Mobile)...');
    await pageMobile.goto('http://127.0.0.1:4175/admin', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));
    const ofAdminMobile = await checkOverflow(pageMobile, 'Admin Mobile');
    console.log('Débordement Admin Mobile:', ofAdminMobile);
    await pageMobile.screenshot({ path: path.join(screenDir, '04-mobile-admin.png'), fullPage: true });

    // Test d'ouverture modale modification droits utilisateur sur mobile
    console.log('Test clic sur bouton Droits utilisateur...');
    const droitsBtn = await pageMobile.$('button.btn-secondary');
    if (droitsBtn) {
      console.log('Bouton trouvé, simulation clic...');
      await pageMobile.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.innerText.includes('Modifier Droits') || b.innerText.includes('Droits'));
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 600));
      const ofModalMobile = await checkOverflow(pageMobile, 'Admin Modal Mobile');
      console.log('Débordement Modale Modification Droits Mobile:', ofModalMobile);
      await pageMobile.screenshot({ path: path.join(screenDir, '05-mobile-admin-modal-edit.png'), fullPage: true });
    }

    // -----------------------------------------------------------------
    // TEST 2: DESKTOP (1280x800) - INSPECTION COMPLETE
    // -----------------------------------------------------------------
    console.log('\n--- TEST SUR VUE DESKTOP (1280x800) ---');
    const pageDesktop = await browser.newPage();
    await pageDesktop.setViewport({ width: 1280, height: 800 });
    await setupPageInterceptions(pageDesktop);

    await pageDesktop.goto('http://127.0.0.1:4175/', { waitUntil: 'networkidle2' });
    await pageDesktop.evaluate(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: { id: 1, name: 'Zehair Louzza', email: 'louzza.zehair@gmail.com', role: 'ADMIN', companyId: 1 },
          accessToken: 'mock-valid-token-for-preview',
          isAuthenticated: true,
          isLoading: false
        },
        version: 0
      }));
    });
    await pageDesktop.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    // A. Desktop Facturation
    console.log('--> Desktop /facturation...');
    await pageDesktop.goto('http://127.0.0.1:4175/facturation', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));
    const ofFactDesk = await checkOverflow(pageDesktop, 'Facturation Desktop');
    console.log('Débordement Facturation Desktop:', ofFactDesk);
    await pageDesktop.screenshot({ path: path.join(screenDir, '06-desktop-facturation.png'), fullPage: true });

    // B. Desktop Rentabilité
    console.log('--> Desktop /rentabilite...');
    await pageDesktop.goto('http://127.0.0.1:4175/rentabilite', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));
    const ofRentDesk = await checkOverflow(pageDesktop, 'Rentabilite Desktop');
    console.log('Débordement Rentabilité Desktop:', ofRentDesk);
    await pageDesktop.screenshot({ path: path.join(screenDir, '07-desktop-rentabilite.png'), fullPage: true });

    // C. Desktop Référentiels
    console.log('--> Desktop /referentiels...');
    await pageDesktop.goto('http://127.0.0.1:4175/referentiels', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));
    const ofRefDesk = await checkOverflow(pageDesktop, 'Referentiels Desktop');
    console.log('Débordement Référentiels Desktop:', ofRefDesk);
    await pageDesktop.screenshot({ path: path.join(screenDir, '08-desktop-referentiels.png'), fullPage: true });

    // D. Desktop Admin
    console.log('--> Desktop /admin...');
    await pageDesktop.goto('http://127.0.0.1:4175/admin', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));
    const ofAdminDesk = await checkOverflow(pageDesktop, 'Admin Desktop');
    console.log('Débordement Admin Desktop:', ofAdminDesk);
    await pageDesktop.screenshot({ path: path.join(screenDir, '09-desktop-admin.png'), fullPage: true });

    console.log('\n=== AUDIT TERMINE SANS ERREUR CRITIQUE ===');
  } catch (err) {
    console.error('Erreur durant audit browser:', err);
  } finally {
    await browser.close();
    preview.kill();
    process.exit(0);
  }
}

main();
