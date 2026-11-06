import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'C:\\Users\\Zeh\\suivi-tce-hostinger\\docs\\images';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--disable-gpu',
  '--no-first-run',
  '--window-size=1440,900',
  '--user-data-dir=C:\\Users\\Zeh\\AppData\\Local\\Temp\\chrome-inspect-all-profile'
]);

await new Promise(r => setTimeout(r, 1500));

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
  }
  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function capture(cdp, fileName, width = 1440, height = 900) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await new Promise(r => setTimeout(r, 1500));
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log(`[OK] Capture ${fileName} (${fs.statSync(outPath).size} octets)`);
}

try {
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await listRes.json();
  const page = pages.find(p => p.type === 'page');

  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // 1. Capture Login
  console.log('1. Navigating to Login...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/login' });
  await new Promise(r => setTimeout(r, 2500));
  await capture(cdp, '01-connexion-espace-securise.png');

  // Login
  console.log('Logging in as Admin...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (async () => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');
        if (!emailInput || !passInput || !submitBtn) return;
        const setVal = (el, val) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setVal(emailInput, 'audit.bot@anelecgroupe.com');
        setVal(passInput, 'AuditSecure2026!Anelec');
        submitBtn.click();
      })()
    `,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3500));

  // 2. Centre de Pilotage
  console.log('2. Capture Centre de Pilotage...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/' });
  await new Promise(r => setTimeout(r, 2500));
  await capture(cdp, '02-centre-de-pilotage-kpi-barometre.png');

  // 3. Dispatch & Planning Gantt Pro
  console.log('3. Capture Planning Gantt Pro...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/planning' });
  await new Promise(r => setTimeout(r, 3000));
  await capture(cdp, '03-dispatch-planning-gantt-pro.png');

  // 4. Pipeline Devis
  console.log('4. Capture Pipeline Devis...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/devis' });
  await new Promise(r => setTimeout(r, 2500));
  await capture(cdp, '04-pipeline-devis-commercial.png');

  // 5. Interventions TCE
  console.log('5. Capture Interventions TCE...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/interventions' });
  await new Promise(r => setTimeout(r, 2500));
  await capture(cdp, '05-interventions-tce-synthese.png');

  // 6. Facturation & Clients
  console.log('6. Capture Facturation & Clients...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/facturation' });
  await new Promise(r => setTimeout(r, 2500));
  await capture(cdp, '06-facturation-bacs-tri-b2b-b2c.png');

  // 7. Rentabilité & Équipes
  console.log('7. Capture Rentabilité & Équipes...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/rentabilite' });
  await new Promise(r => setTimeout(r, 2500));
  await capture(cdp, '07-rentabilite-marges-equipes.png');

  // 8. Workstation Admin
  console.log('8. Capture Workstation Admin...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/workstation' });
  await new Promise(r => setTimeout(r, 2500));
  await capture(cdp, '08-workstation-admin-pointages.png');

  // 9. Application Mobile Technicien (Format Smartphone iPhone 390x844)
  console.log('9. Capture Application Mobile...');
  await cdp.send('Page.navigate', { url: 'https://suivi.anelecgroupe.com/mobile' });
  await new Promise(r => setTimeout(r, 2500));
  await capture(cdp, '09-application-mobile-technicien.png', 390, 844);

} catch (e) {
  console.error('Erreur lors de la capture :', e);
} finally {
  chrome.kill();
  console.log('Processus Chrome arrêté.');
}
