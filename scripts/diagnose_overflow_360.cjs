const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const repoDir = 'C:\\Users\\Zeh\\suivi-tce-hostinger';

async function main() {
  console.log('--- RECHERCHE PRECISE DE DEBORDEMENTS SUR MOBILE 360px & 390px ---');
  const preview = spawn('npx.cmd', ['vite', 'preview', '--port', '4176', '--host', '127.0.0.1'], {
    cwd: repoDir,
    shell: true,
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4176/');
      if (res.status === 200) break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36');
  // Tester sur 360px (largeur Android standard / Samsung / Xiaomi comme sur la capture de l'utilisateur)
  await page.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/auth/me')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 1, name: 'Zehair Louzza', email: 'louzza.zehair@gmail.com', role: 'ADMIN', companyId: 1 },
        }),
      });
    } else if (url.includes('/api/referentiels')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            techniciens: ['Anouar', 'Mohamed', 'Haitam'],
            responsables: ['Zehair'],
            corps_etat: ['Électricité', 'Plomberie'],
            clients: ['Presta maintenance'],
            origines: ['Appel d’offres'],
            technicien_competences: { Anouar: ['Électricité'] },
          }
        }),
      });
    } else if (url.includes('/api/admin/users')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 1,
              name: 'Zehair Louzza',
              email: 'louzza.zehair@gmail.com',
              role: 'ADMIN',
              companyId: 1,
              permissions: { canManageUsers: true, canEditDevis: true, canEditPlanning: true, canEditInterventions: true, canWriteReports: true, canManageBilling: true }
            }
          ],
          roles: {}
        }),
      });
    } else {
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
  });

  await page.goto('http://127.0.0.1:4176/', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: { id: 1, name: 'Zehair Louzza', email: 'louzza.zehair@gmail.com', role: 'ADMIN', companyId: 1 },
        accessToken: 'valid-token',
        isAuthenticated: true,
        isLoading: false
      },
      version: 0
    }));
  });

  for (const path of ['/facturation', '/rentabilite', '/referentiels', '/admin']) {
    await page.goto(`http://127.0.0.1:4176${path}`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    const analysis = await page.evaluate((p) => {
      const winW = window.innerWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyScrollW = document.body.scrollWidth;

      // Chercher tous les éléments qui dépassent winW
      const offenders = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > winW + 1) {
          offenders.push({
            tag: el.tagName,
            cls: el.className,
            right: Math.round(r.right),
            width: Math.round(r.width),
            scrollW: el.scrollWidth,
            parentCls: el.parentElement ? el.parentElement.className : '',
            snippet: (el.innerText || '').slice(0, 40).replace(/\n/g, ' ')
          });
        }
      });

      return { path: p, winW, scrollW, bodyScrollW, overflow: scrollW > winW, count: offenders.length, offenders: offenders.slice(0, 10) };
    }, path);

    console.log(`\nResultat pour ${path} sur écran 360px:`, JSON.stringify(analysis, null, 2));
  }

  await browser.close();
  preview.kill();
}

main();
