// Tests de régression Lot P3 : HTML escaping emails devis, protection IPv6/SSRF & TLS rejectUnauthorized,
// caps mémoire PNG IHDR / zlib inflate / PDF JS rejection, photos terrain data-URI strict,
// CORS sans expansion HTTP en clair, CSP / trust proxy / apiLimiter / anti-source-map, schedulers sans famine + backoff,
// et vérifications client (XSS Leaflet/photos, OAuth CSRF state+nonce, SW /api insensible à la casse, logout arreterTempsReel).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { createFakeDb } from './support/fakePrisma.js';

const db = createFakeDb();
(globalThis as any).__FAKE_PRISMA__ = db;

let smtpServer: net.Server;
let smtpPort = 0;
const capturedRawEmails: string[] = [];

function startMockSmtp(): Promise<void> {
  return new Promise((resolve) => {
    smtpServer = net.createServer((socket) => {
      let buf = '';
      let inData = false;
      let body = '';
      socket.write('220 localhost ESMTP\r\n');
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        while (buf.length > 0) {
          if (inData) {
            const idx = buf.indexOf('\r\n.\r\n');
            if (idx === -1) {
              body += buf;
              buf = '';
              break;
            }
            body += buf.slice(0, idx);
            buf = buf.slice(idx + 5);
            inData = false;
            capturedRawEmails.push(body);
            body = '';
            socket.write('250 OK\r\n');
            continue;
          }
          const nl = buf.indexOf('\r\n');
          if (nl === -1) break;
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 2);
          const u = line.toUpperCase();
          if (u.startsWith('EHLO') || u.startsWith('HELO')) socket.write('250-localhost\r\n250 OK\r\n');
          else if (u === 'DATA') {
            inData = true;
            body = '';
            socket.write('354 End\r\n');
          } else if (u === 'QUIT') {
            socket.write('221 Bye\r\n');
            socket.end();
          } else {
            socket.write('250 OK\r\n');
          }
        }
      });
    });
    smtpServer.listen(0, '127.0.0.1', () => {
      smtpPort = (smtpServer.address() as net.AddressInfo).port;
      resolve();
    });
  });
}

before(async () => {
  await startMockSmtp();
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(smtpPort);
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'noreply@p3.fr';
  process.env.SMTP_PASS = 'mock-pass-p3';
});

after(() => {
  smtpServer?.close();
});

test('P3-1: config.ts n’élargit pas CORS_ORIGIN https:// vers http:// en clair et dérive socketCorsOrigin', () => {
  const out = execFileSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '-e',
      "import('./server/config.js').then(({ config }) => { console.log(JSON.stringify({ cors: config.corsOriginList, socket: config.socketCorsOrigin })); })",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'x'.repeat(64),
        CORS_ORIGIN: 'https://suivi.exemple.fr',
        SOCKET_CORS_ORIGIN: '',
      },
      encoding: 'utf8',
    }
  );
  const parsed = JSON.parse(out.trim().split('\n').pop()!);
  assert.ok(Array.isArray(parsed.cors));
  assert.ok(parsed.cors.every((o: string) => o.startsWith('https://')), 'Aucune origine http:// en clair ne doit être ajoutée');
  assert.ok(parsed.cors.includes('https://suivi.exemple.fr'));
  assert.ok(parsed.cors.includes('https://www.suivi.exemple.fr'));
  assert.ok(Array.isArray(parsed.socket) && parsed.socket.every((o: string) => o.startsWith('https://')));
});

test('P3-2: emailService échappe le HTML des propositions devis, valide TLS et durcit l’anti-SSRF IPv6', async () => {
  const { sendDevisProposalEmail, assertPublicSmtpHost } = await import('../server/services/emailService.js');

  assert.throws(() => assertPublicSmtpHost('127.0.0.1'));
  assert.throws(() => assertPublicSmtpHost('::1'));
  assert.throws(() => assertPublicSmtpHost('fe80::1'));
  assert.throws(() => assertPublicSmtpHost('internal.local'));

  db.companyMailSettings.seed([]);
  db.referentiel.seed([]);
  db.emailLog.seed([]);
  db.company.seed([{ id: 1, name: '<script>alert(1)</script> Co', active: true }]);

  const res = await sendDevisProposalEmail({
    companyId: 1,
    toEmail: 'dest@client.fr',
    customMessage: '<img src=x onerror=alert(1)>Bonjour\nCordialement',
    devis: {
      id: 99,
      referenceMetier: 'DEV-2026-099',
      client: '<b>Client XSS</b>',
      siteAdresse: '<svg onload=alert(1)>',
      objet: '<script>evil()</script>',
      corpsEtat: '<i>Élec</i>',
      amount: 1200,
    },
    senderName: '<b>Sender</b>',
    senderEmail: 'sender@p3.fr',
    companyName: '<script>Company</script>',
  });
  assert.equal(res.sent, true);
  assert.equal(capturedRawEmails.length > 0, true);
  const fullRaw = capturedRawEmails[capturedRawEmails.length - 1].replace(/=\r?\n/g, '');
  const htmlStart = fullRaw.indexOf('Content-Type: text/html');
  assert.ok(htmlStart !== -1, 'Une partie text/html doit exister dans le mail');
  const htmlSection = fullRaw.slice(htmlStart);
  assert.equal(htmlSection.includes('<script>'), false);
  assert.equal(htmlSection.includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(htmlSection.includes('<svg onload=alert(1)>'), false);
  assert.ok(htmlSection.includes('&lt;script&gt;evil()&lt;/script&gt;'));
  assert.ok(htmlSection.includes('&lt;b&gt;Client XSS&lt;/b&gt;'));

  const emailSvcSrc = fs.readFileSync(path.join(process.cwd(), 'server/services/emailService.ts'), 'utf8');
  assert.equal(emailSvcSrc.includes('rejectUnauthorized: false'), false);
  assert.equal(emailSvcSrc.includes('rejectUnauthorized: !isPlatformSender'), false);
  assert.ok(emailSvcSrc.includes('expandIpv6Words'));
  assert.ok(
    emailSvcSrc.includes('targetHost') &&
      emailSvcSrc.includes('resolvePublicAddresses') &&
      emailSvcSrc.includes('requireTLS')
  );
});

test('P3-3: PDF / PNG / photos : rejet /JavaScript PDF, blocage IHDR PNG géant, cap zlib inflateSync et data:image strict', async () => {
  const { validerPdf } = await import('../server/domain/devisClient.js');
  const { optimiserPhotoPourPdf, optimiserDocumentPdfEnPlace } = await import('../server/services/pdfCompression.js');
  const { sanitizePhotosJson } = await import('../server/lib/terrainPhotos.js');

  const evilPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /JS (app.alert(1)) >>\nendobj\n%%EOF');
  assert.equal(validerPdf('test.pdf', evilPdf.toString('base64')).ok, false);

  const evilPdf2 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /JavaScript 2 0 R >>\n%%EOF');
  assert.equal(validerPdf('test2.pdf', evilPdf2.toString('base64')).ok, false);

  const cleanPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
  assert.equal(validerPdf('clean.pdf', cleanPdf.toString('base64')).ok, true);

  // PNG IHDR falsifié 30000x30000 px (900M pixels) -> rejet immédiat sans allocation mémoire géante
  const giantPng = Buffer.alloc(32);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(giantPng, 0);
  giantPng.writeUInt32BE(13, 8);
  giantPng.write('IHDR', 12, 'ascii');
  giantPng.writeUInt32BE(30000, 16);
  giantPng.writeUInt32BE(30000, 20);
  await assert.rejects(() => optimiserPhotoPourPdf(giantPng, 'png'));

  // Bombe zlib dans un flux PDF : flux compressé décompressant à 17 Mo (> maxOutputLength 16 Mo) ignoré sans crash OOM
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bombBytes = zlib.deflateSync(Buffer.alloc(17 * 1024 * 1024, 0x41));
  const bombDict = pdf.context.obj({ Filter: 'FlateDecode' });
  const bombRef = pdf.context.register(PDFRawStream.of(bombDict, bombBytes));
  pdf.getPage(0).node.set(PDFName.of('XTestBomb'), bombRef);
  await optimiserDocumentPdfEnPlace(pdf, { optimiserImages: false });

  // sanitizePhotosJson : bloque javascript:, https:// et data:text/html
  const PNG_VALID = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const resPhotos = sanitizePhotosJson([
    { id: '1', url: 'javascript:alert(1)' },
    { id: '2', url: 'https://evil.com/tracker.png' },
    { id: '3', url: 'data:text/html;base64,PHNjcmlwdD4=' },
    { id: '4', url: PNG_VALID, caption: 'OK' },
  ]);
  assert.ok(resPhotos);
  const parsedPhotos = JSON.parse(resPhotos!);
  assert.equal(parsedPhotos.length, 1);
  assert.equal(parsedPhotos[0].id, '4');
});

test('P3-4: Planificateurs résistent au blocage inter-tenant (backoff exponentiel + disjoncteur SMTP par société + verrou atomique)', async () => {
  const { executerAutomatisationsDevis, courrier: devisCourrier } = await import('../server/services/devisClient.js');
  const { executerAutomatisationsTechnicien } = await import('../server/services/technicianAutomation.js');

  db.company.seed([
    { id: 1, name: 'Co1 Broken SMTP', active: true, autoDevisActif: true, autoTechnicienActif: true, autoTechnicienDelaiMinutes: 60, autoTechnicienAlerteMinutes: 180, autoTechnicienHeuresBureau: false },
    { id: 2, name: 'Co2 Healthy SMTP', active: true, autoDevisActif: true, autoTechnicienActif: true },
  ]);
  db.user.seed([
    { id: 1, companyId: 1, email: 'a1@co1.fr', role: 'ADMIN', active: true, name: 'A1', technicienNom: null },
    { id: 2, companyId: 2, email: 'a2@co2.fr', role: 'ADMIN', active: true, name: 'A2', technicienNom: null },
  ]);
  db.notification.seed([]);

  const envoiAt = new Date('2026-11-10T09:00:00Z');
  const nowJ4 = new Date('2026-11-14T10:00:00Z'); // J+4 (hors dimanche, 11h Paris -> relancer_j3)
  const expireAt = new Date('2026-12-10T09:00:00Z');

  const autoCo1 = { active: true, autoDevisActif: true };
  const autoCo2 = { active: true, autoDevisActif: true };
  db.devis.seed([
    { id: 801, companyId: 1, company: autoCo1, userId: 1, client: 'C1', referenceMetier: 'D1', statutCommercial: 'Envoyé au client', envoiClientLe: envoiAt, relanceClientJ3Le: null, relanceClientJ7Le: null },
    { id: 802, companyId: 1, company: autoCo1, userId: 1, client: 'C2', referenceMetier: 'D2', statutCommercial: 'Envoyé au client', envoiClientLe: envoiAt, relanceClientJ3Le: null, relanceClientJ7Le: null },
    { id: 803, companyId: 1, company: autoCo1, userId: 1, client: 'C3', referenceMetier: 'D3', statutCommercial: 'Envoyé au client', envoiClientLe: envoiAt, relanceClientJ3Le: null, relanceClientJ7Le: null },
    { id: 804, companyId: 2, company: autoCo2, userId: 2, client: 'C4', referenceMetier: 'D4', statutCommercial: 'Envoyé au client', envoiClientLe: envoiAt, relanceClientJ3Le: null, relanceClientJ7Le: null },
  ]);
  db.devisLienClient.seed([
    { id: 811, companyId: 1, devisId: 801, sel: 's1', destinataires: '["c1@x.fr"]', expireLe: expireAt, reponse: null, revoqueLe: null, createdAt: envoiAt },
    { id: 812, companyId: 1, devisId: 802, sel: 's2', destinataires: '["c2@x.fr"]', expireLe: expireAt, reponse: null, revoqueLe: null, createdAt: envoiAt },
    { id: 813, companyId: 1, devisId: 803, sel: 's3', destinataires: '["c3@x.fr"]', expireLe: expireAt, reponse: null, revoqueLe: null, createdAt: envoiAt },
    { id: 814, companyId: 2, devisId: 804, sel: 's4', destinataires: '["c4@x.fr"]', expireLe: expireAt, reponse: null, revoqueLe: null, createdAt: envoiAt },
  ]);

  const attempts: number[] = [];
  devisCourrier.envoyerLien = (async (p: any) => {
    attempts.push(p.companyId);
    if (p.companyId === 1) return { sent: false, error: 'SMTP down' };
    return { sent: true, channel: 'stub' };
  }) as any;

  const rPass1 = await executerAutomatisationsDevis(nowJ4);
  // Co1 disjoncte après 2 échecs (n'essaie pas D3) ET Co2 s'exécute sans être affamé !
  assert.deepEqual(attempts, [1, 1, 2]);
  assert.equal(rPass1.relances, 1);

  // Appel juste après (+10s) : 801 & 802 sont en backoff 5 min -> D3 uniquement tenté pour Co1
  attempts.length = 0;
  await executerAutomatisationsDevis(new Date(nowJ4.getTime() + 10_000));
  assert.deepEqual(attempts, [1]);

  // executerAutomatisationsTechnicien : relance posée de manière atomique et pas d'affamement par lignes terminées
  const autoTechCo1 = { active: true, autoTechnicienActif: true, autoTechnicienDelaiMinutes: 60, autoTechnicienAlerteMinutes: 180, autoTechnicienHeuresBureau: false };
  db.intervention.seed([
    { id: 901, companyId: 1, company: autoTechCo1, entreprise: 'Karim', statutOperationnel: 'Planifiée', reponseTechnicien: 'EN_ATTENTE', affecteLe: new Date(nowJ4.getTime() - 400_000_000), relanceTechnicienLe: envoiAt, alertePlanificateurLe: envoiAt },
    { id: 902, companyId: 1, company: autoTechCo1, entreprise: 'Karim', statutOperationnel: 'Planifiée', reponseTechnicien: 'EN_ATTENTE', affecteLe: new Date(nowJ4.getTime() - 120 * 60_000), relanceTechnicienLe: null, alertePlanificateurLe: null },
  ]);
  const rTech = await executerAutomatisationsTechnicien(nowJ4);
  assert.equal(rTech.relances, 1);
  assert.ok(db.intervention.rows.find((r) => r.id === 902).relanceTechnicienLe);
});

test('P3-5: Vérifications client & serveur P3 (SW insensible casse /api, pas de *.map, CSP/trust-proxy, XSS Leaflet/OAuth CSRF, robots.txt)', () => {
  const root = process.cwd();
  const sw = fs.readFileSync(path.join(root, 'client/public/sw.js'), 'utf8');
  assert.ok(sw.includes('.toLowerCase()'));
  assert.ok(sw.includes('CLEAR_AUTH_CACHES'));
  assert.ok(sw.includes('/devis-client/'));

  const robots = fs.readFileSync(path.join(root, 'client/public/robots.txt'), 'utf8');
  assert.equal(/User-agent:\s*GPTBot/i.test(robots), false, 'Aucune règle bot explicite ne doit contourner Disallow');
  assert.ok(robots.includes('Disallow: /api/'));

  const viteCfg = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
  assert.ok(viteCfg.includes('sourcemap: false'));

  const assetsDir = path.join(root, 'dist/client/assets');
  if (fs.existsSync(assetsDir)) {
    const maps = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.map'));
    assert.equal(maps.length, 0, 'Aucune source map .map publique ne doit être générée');
  }

  const srvIdx = fs.readFileSync(path.join(root, 'server/index.ts'), 'utf8');
  assert.equal(srvIdx.includes("app.set('trust proxy', true)"), false);
  assert.equal(srvIdx.includes('Math.max(config.rateLimitMax, 15000)'), false);
  assert.equal(srvIdx.includes('if (req.cookies?.token || req.headers.authorization) return true;'), false);
  assert.ok(srvIdx.includes('contentSecurityPolicy:'));
  assert.ok(srvIdx.includes("Cache-Control', 'no-store, private'"));

  const authStoreSrc = fs.readFileSync(path.join(root, 'client/src/stores/authStore.tsx'), 'utf8');
  assert.ok(authStoreSrc.includes('arreterTempsReel()'));
  assert.ok(authStoreSrc.includes("window.addEventListener('storage'"));

  const loginSrc = fs.readFileSync(path.join(root, 'client/src/pages/LoginPage.tsx'), 'utf8');
  assert.ok(loginSrc.includes('anelec_google_oauth_tx'));
  assert.ok(loginSrc.includes('crypto.getRandomValues'));

  const carteSrc = fs.readFileSync(path.join(root, 'client/src/components/CarteStudioView.tsx'), 'utf8');
  assert.ok(carteSrc.includes('escapeHtml(tName.slice(0, 2).toUpperCase())'));

  const mobileSrc = fs.readFileSync(path.join(root, 'client/src/components/TechnicianMobileView.tsx'), 'utf8');
  assert.equal(mobileSrc.includes('onclick="window.open('), false);
  assert.ok(mobileSrc.includes('safeImageSrc(p.url)'));

  const optSrc = fs.readFileSync(path.join(root, 'client/src/components/TourneeMapOptimizer.tsx'), 'utf8');
  assert.ok(optSrc.includes('escapeHtml(tm.statusLabel)'));
  assert.ok(optSrc.includes('safeExternalUrl(navUrls.googleMapsUrl)'));
});
