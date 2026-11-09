import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outDir = 'C:/Users/Zeh/suivi-tce-hostinger/docs/images';
const artifactDir = 'C:/Users/Zeh/.gemini/antigravity/brain/d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function takeScreenshot(url, filename) {
  const outPath = path.join(outDir, filename);
  const artifactPath = path.join(artifactDir, filename);
  const cmd = `"${chrome}" --headless=new --disable-gpu --hide-scrollbars --window-size=1600,1200 --screenshot="${outPath}" "${url}"`;
  console.log(`Taking screenshot of ${url} -> ${filename}...`);
  execSync(cmd);
  if (fs.existsSync(outPath)) {
    fs.copyFileSync(outPath, artifactPath);
    console.log(`Saved ${filename} (${fs.statSync(outPath).size} bytes)`);
  }
}

takeScreenshot('http://localhost:3000/viewer?dir=atlas&screen=tableau-de-bord&device=desktop', 'compare-maquette-atlas-dashboard.png');
takeScreenshot('http://localhost:3000/viewer?dir=atlas&screen=tableau-de-bord&device=desktop&tab=operations', 'compare-maquette-atlas-operations.png');
takeScreenshot('http://localhost:3000/viewer?dir=atlas&screen=tableau-de-bord&device=desktop&tab=analyse', 'compare-maquette-atlas-analyse.png');
