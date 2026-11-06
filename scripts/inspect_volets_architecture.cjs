const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const repoDir = 'C:\\Users\\Zeh\\suivi-tce-hostinger';

async function main() {
  console.log('1. Démarrage de Vite preview...');
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
          techniciens: ['Anouar', 'Mohamed', 'Haitam'],
          corpsEtat: ['Électricité', 'Plomberie', 'Serrurerie'],
          clients: ['Presta maintenance', 'C-Multi-Serv'],
          origines: ['Appel d’offres'],
          technicien_competences: { Anouar: ['Électricité'] },
        }),
      });
    } else if (url.includes('/api/devis')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 1,
              reference: 'DEV-2026-001',
              client: 'Presta maintenance',
              site: 'Paris 08',
              objet: 'Rénovation TGBT & distribution',
              corpsEtat: 'Électricité',
              amount: 8400,
              statutCommercial: 'Accepté',
              dateCreated: '2026-11-01',
              interventionsCount: 1,
            },
          ],
        }),
      });
    } else if (url.includes('/api/interventions')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 101,
              reference: 'INT-2026-001',
              client: 'Presta maintenance',
              chantier: '8 rue de Penthièvre, 75008 Paris',
              objet: 'Dépannage TGBT',
              corpsEtat: 'Électricité',
              entreprise: 'Anouar',
              statutOperationnel: 'En cours',
              datePlanifiee: '2026-11-06',
              heureDebut: '08:30',
              heureFin: '11:00',
              amount: 1450,
              statutFacture: 'Non facturée',
            },
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
          user: { id: 1, name: 'Zehair Louzza', role: 'ADMIN', companyName: 'ANELEC GROUPE' },
          isAuthenticated: true,
          accessToken: 'mock-token',
        },
        version: 0,
      })
    );
  });

  const extractVoletStyles = async (pageUrl, recordSelector, drawerSelector, label) => {
    await page.goto(pageUrl);
    await new Promise((r) => setTimeout(r, 1000));
    // Click record to open drawer
    await page.evaluate((sel) => {
      const rec = document.querySelector(sel);
      if (rec) rec.click();
    }, recordSelector);
    await new Promise((r) => setTimeout(r, 800));

    return await page.evaluate((dSel, lbl) => {
      const drawer = document.querySelector(dSel);
      if (!drawer) return { label: lbl, error: 'Drawer non trouvé' };

      const getStyle = (el) => {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          border: cs.border,
          borderRadius: cs.borderRadius,
          boxShadow: cs.boxShadow,
          padding: cs.padding,
          margin: cs.margin,
        };
      };

      // Header info
      const headerTitle = drawer.querySelector('.font-mono, h2, h3, [style*="color: rgb(37, 99, 235)"], [style*="color: #2563eb"]');
      const badges = Array.from(drawer.querySelectorAll('.badge, .status-pill, [style*="borderRadius: 999px"], [style*="border-radius: 999px"], [style*="border-radius: 99px"]')).map(el => ({
        text: el.innerText.trim(),
        style: getStyle(el)
      }));
      const alerts = Array.from(drawer.querySelectorAll('[style*="background: rgb(255, 251, 235)"], [style*="background: #fffbeb"], [style*="warning"]')).map(el => ({
        text: el.innerText.trim(),
        style: getStyle(el)
      }));
      const tabs = Array.from(drawer.querySelectorAll('.segmented-btn, [style*="borderRadius: 7px"], [style*="border-radius: 7px"], [style*="border-radius: 8px"]')).map(el => ({
        text: el.innerText.trim(),
        style: getStyle(el)
      }));
      const firstLabel = drawer.querySelector('label');
      const firstInput = drawer.querySelector('input, select');
      const footerBtns = Array.from(drawer.querySelectorAll('button')).slice(-2).map(el => ({
        text: el.innerText.trim(),
        style: getStyle(el)
      }));

      // Direct children of drawer
      const directSections = Array.from(drawer.children).map(c => ({
        tagName: c.tagName,
        className: c.className,
        style: getStyle(c)
      }));

      return {
        label: lbl,
        drawerStyle: getStyle(drawer),
        headerTitle: {
          text: headerTitle ? headerTitle.innerText.trim() : null,
          style: getStyle(headerTitle)
        },
        badges,
        alerts,
        tabs: tabs.slice(0, 4),
        firstLabel: {
          text: firstLabel ? firstLabel.innerText.trim() : null,
          style: getStyle(firstLabel)
        },
        firstInput: {
          tagName: firstInput ? firstInput.tagName : null,
          style: getStyle(firstInput)
        },
        footerBtns,
        directSectionsCount: directSections.length
      };
    }, drawerSelector, label);
  };

  console.log('2. Extraction Volet 1 (Tiroir Devis)...');
  const volet1 = await extractVoletStyles('http://127.0.0.1:4173/devis', '.mobile-record-card', '.inspector-drawer', 'Volet 1 - Tiroir Devis');

  console.log('3. Extraction Volet 2 (Tiroir Intervention)...');
  const volet2 = await extractVoletStyles('http://127.0.0.1:4173/interventions', '.mobile-record-card', '.inspector-drawer', 'Volet 2 - Tiroir Intervention');

  console.log('\n=== RÉSULTATS COMPARATIFS DÉTAILLÉS ===');
  console.log(JSON.stringify({ volet1, volet2 }, null, 2));

  await browser.close();
  preview.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
