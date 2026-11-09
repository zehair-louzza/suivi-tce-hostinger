import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outDir = 'C:/Users/Zeh/suivi-tce-hostinger/docs/images';
const artifactDir = 'C:/Users/Zeh/.gemini/antigravity/brain/d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1600, height: 1100 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Screenshot of the Viewer with Atlas Tableau de bord
  console.log('Navigating to viewer...');
  await page.goto('http://localhost:3000/viewer?dir=atlas&screen=tableau-de-bord&device=desktop', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const viewerOut = path.join(outDir, 'compare-maquette-atlas-viewer.png');
  await page.screenshot({ path: viewerOut });
  fs.copyFileSync(viewerOut, path.join(artifactDir, 'compare-maquette-atlas-viewer.png'));
  console.log('Saved viewer screenshot');

  // 2. Screenshot of the direct Mock Atlas Tableau de bord (full page)
  console.log('Navigating to direct mock screen...');
  await page.goto('http://localhost:3000/m/atlas/tableau-de-bord', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const directOut = path.join(outDir, 'compare-maquette-atlas-direct.png');
  await page.screenshot({ path: directOut });
  fs.copyFileSync(directOut, path.join(artifactDir, 'compare-maquette-atlas-direct.png'));
  console.log('Saved direct mock screenshot');

  // 3. Screenshot of the actual production application Dashboard
  console.log('Navigating to production site...');
  try {
    await page.goto('https://suivi.anelecgroupe.com', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    const prodOut = path.join(outDir, 'compare-prod-actual-site.png');
    await page.screenshot({ path: prodOut });
    fs.copyFileSync(prodOut, path.join(artifactDir, 'compare-prod-actual-site.png'));
    console.log('Saved production site screenshot');
  } catch (e) {
    console.error('Prod screenshot error:', e.message);
  }

  await browser.close();
}

main().catch(console.error);
