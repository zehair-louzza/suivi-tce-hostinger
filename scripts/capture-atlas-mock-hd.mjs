import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ARTIFACTS_DIR = 'C:/Users/Zeh/.gemini/antigravity/brain/d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';
const DOCS_DIR = 'C:/Users/Zeh/suivi-tce-hostinger/docs/images';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  console.log('Navigating to http://localhost:3000/m/atlas/tableau-de-bord...');
  await page.goto('http://localhost:3000/m/atlas/tableau-de-bord', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // 1. Synthèse HD
  const synthPath = path.join(DOCS_DIR, 'compare-maquette-atlas-synthese-hd.png');
  await page.screenshot({ path: synthPath, fullPage: false });
  fs.copyFileSync(synthPath, path.join(ARTIFACTS_DIR, 'compare-maquette-atlas-synthese-hd.png'));
  console.log('Saved Maquette Synthèse HD');

  // 2. Opérations HD
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.m-subnav-item, button'));
    const op = btns.find(b => b.textContent && b.textContent.includes('Opérations'));
    if (op) op.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  const opsPath = path.join(DOCS_DIR, 'compare-maquette-atlas-operations-hd.png');
  await page.screenshot({ path: opsPath, fullPage: false });
  fs.copyFileSync(opsPath, path.join(ARTIFACTS_DIR, 'compare-maquette-atlas-operations-hd.png'));
  console.log('Saved Maquette Opérations HD');

  // 3. Analyse HD
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.m-subnav-item, button'));
    const ana = btns.find(b => b.textContent && b.textContent.includes('Analyse'));
    if (ana) ana.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  const anaPath = path.join(DOCS_DIR, 'compare-maquette-atlas-analyse-hd.png');
  await page.screenshot({ path: anaPath, fullPage: false });
  fs.copyFileSync(anaPath, path.join(ARTIFACTS_DIR, 'compare-maquette-atlas-analyse-hd.png'));
  console.log('Saved Maquette Analyse HD');

  await browser.close();
  console.log('Done capturing HD reference mock screenshots!');
}

run().catch(console.error);
