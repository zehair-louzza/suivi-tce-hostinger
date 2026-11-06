const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\Zeh\\.gemini\\antigravity\\brain\\d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';
const screenDir = path.join(artifactDir, 'live_production_inspection');

if (!fs.existsSync(screenDir)) fs.mkdirSync(screenDir, { recursive: true });

async function main() {
  console.log('=== INSPECTION DIRECTE DU SITE LIVE HOSTINGER : https://suivi.anelecgroupe.com ===');

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  page.on('console', (msg) => console.log(`[PROD ${msg.type().toUpperCase()}]:`, msg.text()));
  page.on('pageerror', (err) => console.error('[PROD ERROR CRITICAL]:', err.message));

  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && !url.includes('favicon')) {
      console.log(`[PROD HTTP ${res.status()}]:`, url);
    }
  });

  try {
    console.log('1. Navigation vers la page d’accueil / login...');
    await page.goto('https://suivi.anelecgroupe.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: path.join(screenDir, '01-prod-home.png') });

    const currentUrl = page.url();
    console.log('URL actuelle:', currentUrl);

    // Vérifier si sur page login
    const hasLogin = await page.$('input[type="email"], input[name="email"]');
    console.log('Champ email présent:', !!hasLogin);

    // Tenter de se connecter ou vérifier le formulaire
    if (hasLogin) {
      console.log('Tentative de connexion...');
      await page.type('input[type="email"], input[name="email"]', 'louzza.zehair@gmail.com');
      await page.type('input[type="password"], input[name="password"]', 'Anelec2026!');
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await new Promise((r) => setTimeout(r, 3000));
        await page.screenshot({ path: path.join(screenDir, '02-prod-after-login.png') });
        console.log('URL après connexion:', page.url());
      }
    }

    // Inspecter /facturation
    console.log('2. Navigation vers /facturation...');
    await page.goto('https://suivi.anelecgroupe.com/facturation', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenDir, '03-prod-facturation.png'), fullPage: true });

    // Inspecter /rentabilite
    console.log('3. Navigation vers /rentabilite...');
    await page.goto('https://suivi.anelecgroupe.com/rentabilite', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenDir, '04-prod-rentabilite.png'), fullPage: true });

    // Inspecter /referentiels
    console.log('4. Navigation vers /referentiels...');
    await page.goto('https://suivi.anelecgroupe.com/referentiels', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenDir, '05-prod-referentiels.png'), fullPage: true });

    // Inspecter /admin
    console.log('5. Navigation vers /admin...');
    await page.goto('https://suivi.anelecgroupe.com/admin', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenDir, '06-prod-admin.png'), fullPage: true });

    // Mobile viewport
    console.log('6. Test Mobile sur /admin...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenDir, '07-prod-mobile-admin.png'), fullPage: true });

  } catch (err) {
    console.error('Erreur test prod:', err);
  } finally {
    await browser.close();
    console.log('Fin du test prod.');
  }
}

main();
