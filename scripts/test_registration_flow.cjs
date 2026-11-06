const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const repoDir = 'C:\\Users\\Zeh\\suivi-tce-hostinger';
const artifactDir = 'C:\\Users\\Zeh\\.gemini\\antigravity\\brain\\d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';
const docsImgDir = path.join(repoDir, 'docs', 'images');

async function runTest() {
  console.log('=== TEST DU FLUX DE CRÉATION DE COMPTE ENTREPRISE SUR MOBILE ===');

  console.log('1. Lancement de Vite preview sur le port 4174...');
  const preview = spawn('npx.cmd', ['vite', 'preview', '--port', '4174', '--host', '127.0.0.1'], {
    cwd: repoDir,
    shell: true,
  });

  // Attente du serveur
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4174/');
      if (res.status === 200) {
        console.log('Serveur prêt !');
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    await page.setRequestInterception(true);
    let registerApiCalled = false;

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/auth/register')) {
        registerApiCalled = true;
        console.log('  -> API /api/auth/register appelée avec succès !');
        console.log('  -> Payload reçu par le serveur:', req.postData());
        req.respond({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            message: "Demande enregistrée avec succès. Un e-mail de confirmation avec les conditions d'activation a été envoyé à test.entreprise@example.com depuis zehair@anelecgroupe.com.",
            emailSent: true,
            email: "test.entreprise@example.com",
            requiresConfirmation: true,
          }),
        });
      } else if (url.includes('/api/auth/me')) {
        req.respond({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Non authentifié' }),
        });
      } else {
        req.continue();
      }
    });

    console.log('2. Navigation vers http://127.0.0.1:4174/login sur smartphone...');
    await page.goto('http://127.0.0.1:4174/login', { waitUntil: 'networkidle0' });

    // Vérifier qu'on n'est pas bloqué sur l'écran de chargement
    const loadingEl = await page.$('text/Chargement');
    if (loadingEl) {
      console.error('ERREUR : Page bloquée sur l’écran de chargement initial !');
      process.exit(1);
    }
    console.log('  -> Page de connexion affichée directement, aucun blocage initial.');

    // Cliquer sur l'onglet "Créer un espace"
    console.log('3. Clic sur l’onglet "Créer un espace"...');
    const tabs = await page.$$('button');
    let registerTab = null;
    for (const tab of tabs) {
      const text = (await page.evaluate((el) => el.innerText, tab)).toLowerCase();
      if (text.includes('créer un espace') || text.includes('espace entreprise')) {
        registerTab = tab;
        break;
      }
    }

    if (!registerTab) {
      throw new Error('Onglet Créer un espace introuvable');
    }
    await registerTab.click();
    await new Promise((r) => setTimeout(r, 400));

    // Screenshot du formulaire d'inscription mobile
    const regFormPic = path.join(artifactDir, '01-mobile-creation-espace-form.png');
    await page.screenshot({ path: regFormPic, fullPage: false });
    fs.copyFileSync(regFormPic, path.join(docsImgDir, '01-mobile-creation-espace-form.png'));
    console.log('  -> Capture formulaire inscription sauvegardée.');

    // Remplir le formulaire
    console.log('4. Remplissage des informations d’entreprise...');
    await page.type('input[name="companyName"]', 'ANELEC EXPERT SAS');
    await page.type('input[name="siretOrSiren"]', '933 108 607 00010');
    await page.type('input[name="name"]', 'Marc Martin');
    await page.type('input[name="email"]', 'test.entreprise@example.com');
    await page.type('input[name="password"]', 'SuperSecret123!');
    await page.type('input[name="confirmPassword"]', 'SuperSecret123!');

    // Cocher la case CGU / RGPD
    const checkbox = await page.$('input[type="checkbox"]');
    if (checkbox) {
      await checkbox.click();
    }

    await new Promise((r) => setTimeout(r, 400));

    // Soumettre le formulaire
    console.log('5. Clic sur "Créer mon espace entreprise"...');
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();

    // Attendre 1.5s pour la réponse et l'affichage de l'état
    await new Promise((r) => setTimeout(r, 1500));

    // Vérifier l'état de l'écran : Est-on bloqué sur "Chargement d'ANELEC Dispatch Pro..." ?
    const bodyText = await page.evaluate(() => document.body.innerText);
    const cardHtml = await page.evaluate(() => document.querySelector('div[style*="max-width: 520px"], div[style*="maxWidth: 520px"]')?.innerHTML || 'NOT_FOUND');
    console.log('--- CARD HTML SNIPPET ---');
    console.log(cardHtml.slice(400, 1600));
    console.log('-------------------------');
    const hasStuckLoading = bodyText.includes("Chargement d'ANELEC Dispatch Pro...");

    if (hasStuckLoading) {
      console.error('ÉCHEC : L’application est restée bloquée sur "Chargement d\'ANELEC Dispatch Pro..." !');
      const failPic = path.join(artifactDir, 'reg-fail-stuck.png');
      await page.screenshot({ path: failPic });
      process.exit(1);
    }

    // Vérifier que la bannière de confirmation est visible
    const hasSuccessBanner = bodyText.includes('E-mail de confirmation envoyé à test.entreprise@example.com');
    console.log('  -> Bannière de confirmation reçue :', hasSuccessBanner ? 'OUI ✅' : 'NON ❌');

    const successPic = path.join(artifactDir, '02-mobile-creation-espace-succes.png');
    await page.screenshot({ path: successPic, fullPage: false });
    fs.copyFileSync(successPic, path.join(docsImgDir, '02-mobile-creation-espace-succes.png'));
    console.log('  -> Capture écran succès sauvegardée : 02-mobile-creation-espace-succes.png');

    console.log('\n=== RÉSULTAT DU TEST ===');
    console.log('API Register appelée :', registerApiCalled ? 'OUI ✅' : 'NON ❌');
    console.log('Écran bloqué :', hasStuckLoading ? 'OUI ❌' : 'NON (FLUIDE ET NON-BLOQUÉ) ✅');
    console.log('Bannière de confirmation affichée :', hasSuccessBanner ? 'OUI ✅' : 'NON ❌');
    console.log('====================================');
  } finally {
    await browser.close();
    preview.kill();
  }
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
