import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const require = createRequire('C:\\Users\\Zeh\\.gemini\\antigravity\\scratch\\package.json');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ffmpegPath = 'ffmpeg'; // available in PATH

const BASE_DIR = 'C:\\Users\\Zeh\\suivi-tce-hostinger';
const IMAGES_DIR = path.join(BASE_DIR, 'docs', 'images');
const DOCS_DIR = path.join(BASE_DIR, 'docs');
const ARTIFACT_DIR = 'C:\\Users\\Zeh\\.gemini\\antigravity\\brain\\d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';

function fileToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

async function generatePromoVideo() {
  console.log('=== [1/4] Preparing Assets & Screenshots ===');
  const assetMap = {
    logo: fileToDataUrl(path.join(IMAGES_DIR, '01-logo-anelec-groupe.png')),
    cockpit: fileToDataUrl(path.join(IMAGES_DIR, 'doc-04-dashboard-sky-ice-ca.png')),
    devis: fileToDataUrl(path.join(IMAGES_DIR, 'doc-07-devis-pipeline.png')),
    devisModal: fileToDataUrl(path.join(IMAGES_DIR, '04b-grille-reconversion-modal.png')),
    gantt: fileToDataUrl(path.join(IMAGES_DIR, '03-dispatch-planning-gantt-pro.png')),
    mapBefore: fileToDataUrl(path.join(IMAGES_DIR, 'doc-09-carte-avant-cloture.png')),
    mapAfter: fileToDataUrl(path.join(IMAGES_DIR, 'doc-12-carte-apres-retrait-missions-finies.png')),
    mobileModal: fileToDataUrl(path.join(IMAGES_DIR, 'doc-10-mobile-cloture-gps-modal.png')),
    mobileToast: fileToDataUrl(path.join(IMAGES_DIR, 'doc-11-mobile-missions-cloturees-toast.png')),
    facturationBacs: fileToDataUrl(path.join(IMAGES_DIR, 'doc-13-facturation-5-bacs-kpi.png')),
    facturationRetards: fileToDataUrl(path.join(IMAGES_DIR, 'doc-14-facturation-diagnostic-retards.png')),
    registerGoogle: fileToDataUrl(path.join(IMAGES_DIR, 'doc-01-creation-compte-google-entreprise.png')),
  };
  console.log('Assets loaded into memory (Data URLs created).');

  console.log('=== [2/4] Launching Headless Chrome Canvas Recorder ===');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  // Pass assets into page and execute the canvas render loop
  const webmBase64 = await page.evaluate(async (assets) => {
    // 1. Create Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });

    // 2. Preload all Image objects
    const imgObj = {};
    const loadPromises = Object.entries(assets).map(([key, dataUrl]) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          imgObj[key] = img;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
    });
    await Promise.all(loadPromises);

    // 3. Setup MediaRecorder with 12 Mbps bitrate for crystal-clear 1080p
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 12000000,
    });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const finishedPromise = new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      };
    });

    recorder.start();

    // 4. ANIMATION & DRAWING ENGINE
    const TOTAL_DURATION = 44.0; // 44 seconds
    const startTime = performance.now();

    // Utility: Easing
    function easeInOutCubic(x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
    function easeOutQuad(x) {
      return 1 - (1 - x) * (1 - x);
    }
    function clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    }

    // Helper: Draw animated dark tech background with glowing grid & particles
    function drawBackground(t) {
      // Base deep slate gradient
      const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
      grad.addColorStop(0, '#040914');
      grad.addColorStop(0.5, '#071324');
      grad.addColorStop(1, '#020611');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1920, 1080);

      // Ambient glowing orbs
      const orb1X = 350 + Math.sin(t * 0.4) * 120;
      const orb1Y = 300 + Math.cos(t * 0.3) * 80;
      const radGrad1 = ctx.createRadialGradient(orb1X, orb1Y, 10, orb1X, orb1Y, 600);
      radGrad1.addColorStop(0, 'rgba(16, 185, 129, 0.16)'); // Emerald glow
      radGrad1.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.fillStyle = radGrad1;
      ctx.fillRect(0, 0, 1920, 1080);

      const orb2X = 1550 + Math.cos(t * 0.5) * 100;
      const orb2Y = 700 + Math.sin(t * 0.4) * 90;
      const radGrad2 = ctx.createRadialGradient(orb2X, orb2Y, 10, orb2X, orb2Y, 650);
      radGrad2.addColorStop(0, 'rgba(14, 165, 233, 0.14)'); // Sky blue glow
      radGrad2.addColorStop(1, 'rgba(14, 165, 233, 0.0)');
      ctx.fillStyle = radGrad2;
      ctx.fillRect(0, 0, 1920, 1080);

      // Subtle tech perspective grid
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      const gridSpacing = 60;
      const offsetX = (t * 20) % gridSpacing;
      for (let x = -gridSpacing + offsetX; x < 1920 + gridSpacing; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1080);
        ctx.stroke();
      }
      const offsetY = (t * 15) % gridSpacing;
      for (let y = -gridSpacing + offsetY; y < 1080 + gridSpacing; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1920, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Helper: Rounded Rectangle
    function roundRect(ctx, x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // Helper: Draw Window Browser Frame for Screenshots
    function drawBrowserWindow(img, x, y, w, h, title, zoomScale = 1.0, glowColor = 'rgba(16, 185, 129, 0.3)') {
      ctx.save();
      // Drop Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 15;

      // Outer Card Box
      ctx.fillStyle = '#0f172a';
      roundRect(ctx, x, y, w, h, 14);
      ctx.fill();

      // Border glow
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 14);
      ctx.stroke();
      ctx.restore();

      // Window Header Bar
      ctx.save();
      roundRect(ctx, x, y, w, 42, 14);
      ctx.clip();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x, y, w, 42);

      // Traffic light dots
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(x + 22, y + 21, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(x + 40, y + 21, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10b981';
      ctx.beginPath(); ctx.arc(x + 58, y + 21, 6, 0, Math.PI * 2); ctx.fill();

      // Browser URL bar
      ctx.fillStyle = '#0f172a';
      roundRect(ctx, x + 85, y + 8, w - 170, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText(title || 'https://suivi.anelecgroupe.com', x + 100, y + 25);
      ctx.restore();

      // Screenshot Content area
      const contentY = y + 42;
      const contentH = h - 42;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 1, contentY, w - 2, contentH - 1);
      ctx.clip();

      if (img) {
        // Subtle Ken Burns zoom
        const dw = (w - 2) * zoomScale;
        const dh = contentH * zoomScale;
        const dx = x + 1 - (dw - (w - 2)) / 2;
        const dy = contentY - (dh - contentH) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
      }
      ctx.restore();
    }

    // Helper: Draw Smartphone Mockup (for Scene 6)
    function drawPhoneMockup(img, x, y, w, h, zoom = 1.0) {
      ctx.save();
      // Drop Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 20;

      // Titanium Chassis
      ctx.fillStyle = '#1e293b';
      roundRect(ctx, x, y, w, h, 36);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 36);
      ctx.stroke();
      ctx.restore();

      // Screen Glass
      const pad = 12;
      ctx.save();
      roundRect(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, 28);
      ctx.clip();

      if (img) {
        const sw = (w - pad * 2) * zoom;
        const sh = (h - pad * 2) * zoom;
        const sx = x + pad - (sw - (w - pad * 2)) / 2;
        const sy = y + pad - (sh - (h - pad * 2)) / 2;
        ctx.drawImage(img, sx, sy, sw, sh);
      }

      // Dynamic Island / Notch
      ctx.fillStyle = '#0f172a';
      roundRect(ctx, x + w / 2 - 50, y + pad + 6, 100, 20, 10);
      ctx.fill();
      ctx.restore();
    }

    // Helper: Draw Pill Badge
    function drawPillBadge(text, x, y, bg = 'rgba(16, 185, 129, 0.2)', border = '#10b981', textColor = '#34d399') {
      ctx.save();
      ctx.font = 'bold 15px sans-serif';
      const textW = ctx.measureText(text).width;
      const pillW = textW + 36;
      const pillH = 32;

      ctx.fillStyle = bg;
      roundRect(ctx, x, y, pillW, pillH, 16);
      ctx.fill();

      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, pillW, pillH, 16);
      ctx.stroke();

      // Glowing dot
      ctx.fillStyle = border;
      ctx.beginPath();
      ctx.arc(x + 16, y + pillH / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.fillText(text, x + 27, y + 21);
      ctx.restore();
      return pillW;
    }

    // Helper: Draw Kinetic Callout Cards (Left or Right column)
    function drawFeatureBox(x, y, w, h, icon, title, desc, progress = 1.0) {
      if (progress <= 0) return;
      const curX = x + (1 - progress) * 60;
      const alpha = clamp(progress, 0, 1);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Card Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      roundRect(ctx, curX, y, w, h, 12);
      ctx.fill();

      // Neon left accent bar
      ctx.fillStyle = '#10b981';
      roundRect(ctx, curX, y, 6, h, 3);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      roundRect(ctx, curX, y, w, h, 12);
      ctx.stroke();

      // Icon badge
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      roundRect(ctx, curX + 18, y + (h - 40) / 2, 40, 40, 8);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(icon, curX + 30, y + (h + 12) / 2);

      // Texts
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(title, curX + 72, y + 28);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText(desc, curX + 72, y + 50);

      ctx.restore();
    }

    // Helper: Draw Header Branding Bar at Top
    function drawHeaderBar(currentModuleName) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(0, 0, 1920, 60);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.lineTo(1920, 60);
      ctx.stroke();

      // Mini logo & brand name
      if (imgObj.logo) {
        ctx.drawImage(imgObj.logo, 50, 10, 40, 40);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('ANELEC GROUPE TCE', 105, 36);

      ctx.fillStyle = '#64748b';
      ctx.font = '16px sans-serif';
      ctx.fillText('/', 320, 36);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(currentModuleName.toUpperCase(), 340, 36);

      // Live status pill at right
      drawPillBadge('LIVE PRODUCTION 2026', 1620, 14, 'rgba(16, 185, 129, 0.15)', '#10b981', '#34d399');
      ctx.restore();
    }

    // SCENE TIMINGS
    // Total 44s
    // S1: 0.0 - 5.0 (Intro & Brand)
    // S2: 5.0 - 10.5 (Cockpit & Pilotage Financier)
    // S3: 10.5 - 16.0 (Pipeline Devis 22 colonnes & Visites Devis)
    // S4: 16.0 - 21.5 (Gantt Multi-Ressources 60 FPS)
    // S5: 21.5 - 27.5 (Carte Interactive & TSP Tournées)
    // S6: 27.5 - 33.5 (Application Mobile PWA Technicien)
    // S7: 33.5 - 38.5 (Studio Facturation 5 Bacs & Diagnostic Retards)
    // S8: 38.5 - 44.0 (Inscription Rapide Google & Call To Action)

    function renderFrame(t) {
      drawBackground(t);

      // ==========================================
      // SCENE 1 : INTRO BRANDING & HOOK (0.0s - 5.0s)
      // ==========================================
      if (t < 5.0) {
        const p = t / 5.0;
        const fadeIn = clamp(t / 0.8, 0, 1);
        const fadeOut = clamp((5.0 - t) / 0.6, 0, 1);
        const alpha = Math.min(fadeIn, fadeOut);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Big Glowing Center Logo
        if (imgObj.logo) {
          const logoScale = 1.0 + easeOutQuad(p) * 0.08;
          const logoW = 180 * logoScale;
          const logoH = 180 * logoScale;
          const logoX = 960 - logoW / 2;
          const logoY = 220 - logoH / 2;

          // Glowing aura behind logo
          const aura = ctx.createRadialGradient(960, 220, 20, 960, 220, 220);
          aura.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
          aura.addColorStop(0.5, 'rgba(14, 165, 233, 0.2)');
          aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = aura;
          ctx.fillRect(960 - 250, 220 - 250, 500, 500);

          ctx.drawImage(imgObj.logo, logoX, logoY, logoW, logoH);
        }

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText('ANELEC GROUPE TCE', 960, 380);

        // Gradient Subtitle
        const subGrad = ctx.createLinearGradient(600, 420, 1320, 420);
        subGrad.addColorStop(0, '#38bdf8');
        subGrad.addColorStop(0.5, '#34d399');
        subGrad.addColorStop(1, '#a7f3d0');
        ctx.fillStyle = subGrad;
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('La Plateforme SaaS Nouvelle Génération BTP & Second Œuvre', 960, 440);

        // Core Pitch
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '24px sans-serif';
        ctx.fillText("Pilotez 100% de vos chantiers, tournées, devis et factures en temps réel.", 960, 505);

        // 4 Tech Badges below
        const badgeY = 570;
        const b1 = 'POSTGRESQL 17 MULTI-TENANT';
        const b2 = 'DISPATCH GANTT 60 FPS';
        const b3 = 'GÉOLOCALISATION TSP';
        const b4 = 'PWA MOBILE INVIOLABLE';

        ctx.textAlign = 'left';
        let startX = 260;
        startX += drawPillBadge(b1, startX, badgeY, 'rgba(30, 41, 59, 0.8)', '#38bdf8', '#7dd3fc') + 25;
        startX += drawPillBadge(b2, startX, badgeY, 'rgba(30, 41, 59, 0.8)', '#10b981', '#6ee7b7') + 25;
        startX += drawPillBadge(b3, startX, badgeY, 'rgba(30, 41, 59, 0.8)', '#f59e0b', '#fcd34d') + 25;
        drawPillBadge(b4, startX, badgeY, 'rgba(30, 41, 59, 0.8)', '#8b5cf6', '#c4b5fd');

        // Progress bar at bottom of scene
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(560, 680, 800, 4);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(560, 680, 800 * p, 4);

        ctx.restore();
      }

      // ==========================================
      // SCENE 2 : COCKPIT & PILOTAGE FINANCIER (5.0s - 10.5s)
      // ==========================================
      else if (t >= 5.0 && t < 10.5) {
        const st = t - 5.0; // 0 to 5.5
        const p = st / 5.5;
        const alpha = Math.min(clamp(st / 0.5, 0, 1), clamp((5.5 - st) / 0.5, 0, 1));

        ctx.save();
        ctx.globalAlpha = alpha;
        drawHeaderBar('Centre de Pilotage & KPIs');

        // Left Side: Texts & Features
        ctx.textAlign = 'left';
        drawPillBadge('COCKPIT OPÉRATIONNEL & FINANCIER', 70, 95);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px sans-serif';
        ctx.fillText("Pilotage Stratégique", 70, 170);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText("en Temps Réel", 70, 215);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px sans-serif';
        ctx.fillText("Suivi instantané de vos marges, de vos volumes et de vos équipes.", 70, 255);

        const fProgress1 = clamp((st - 0.4) / 0.4, 0, 1);
        const fProgress2 = clamp((st - 0.9) / 0.4, 0, 1);
        const fProgress3 = clamp((st - 1.4) / 0.4, 0, 1);
        const fProgress4 = clamp((st - 1.9) / 0.4, 0, 1);

        drawFeatureBox(70, 290, 560, 72, '€', "Chiffre d'Affaires & Marges Réelles", "Calcul automatisé HT & TTC et baromètre de rentabilité", fProgress1);
        drawFeatureBox(70, 375, 560, 72, '📊', "Ventilation Donneurs d'Ordre", "Part de volume B2B / B2C et alertes d'impayés", fProgress2);
        drawFeatureBox(70, 460, 560, 72, '⚡', "Compteurs d'Urgences & Blocages", "Missions critiques identifiées en direct sur le cockpit", fProgress3);
        drawFeatureBox(70, 545, 560, 72, '📑', "Export Situation Travaux Excel", "Génération automatique bordereaux et situations mensuelles", fProgress4);

        // Right Side: Screenshot Card with Ken Burns Zoom
        const zoom = 1.0 + p * 0.05;
        drawBrowserWindow(imgObj.cockpit, 670, 110, 1180, 890, 'https://suivi.anelecgroupe.com/app/pilotage', zoom, 'rgba(16, 185, 129, 0.4)');

        ctx.restore();
      }

      // ==========================================
      // SCENE 3 : PIPELINE DEVIS & RECONVERSION (10.5s - 16.0s)
      // ==========================================
      else if (t >= 10.5 && t < 16.0) {
        const st = t - 10.5; // 0 to 5.5
        const p = st / 5.5;
        const alpha = Math.min(clamp(st / 0.5, 0, 1), clamp((5.5 - st) / 0.5, 0, 1));

        ctx.save();
        ctx.globalAlpha = alpha;
        drawHeaderBar('Pipeline Commercial & Chiffrage Devis');

        // Left Side: Screenshot Card
        const zoom = 1.0 + p * 0.04;
        drawBrowserWindow(imgObj.devis, 70, 110, 1140, 890, 'https://suivi.anelecgroupe.com/app/devis', zoom, 'rgba(56, 189, 248, 0.4)');

        // Right Side: Feature Details & Pop-up Modal Preview
        ctx.textAlign = 'left';
        drawPillBadge('CYCLE COMMERCIAL COMPLET', 1250, 95, 'rgba(56, 189, 248, 0.2)', '#38bdf8', '#7dd3fc');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px sans-serif';
        ctx.fillText("Pipeline Devis 22 Colonnes", 1250, 170);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px sans-serif';
        ctx.fillText("Du premier contact jusqu'à la signature finale.", 1250, 210);

        const fProgress1 = clamp((st - 0.4) / 0.4, 0, 1);
        const fProgress2 = clamp((st - 1.0) / 0.4, 0, 1);

        drawFeatureBox(1250, 245, 600, 72, '🔍', "Visites Devis Préalables (VIS-DEV)", "Relevés techniques directement intégrés aux tournées techniciens", fProgress1);
        drawFeatureBox(1250, 330, 600, 72, '📐', "Grille de Reconversion Immédiate", "Basculez un devis signé en intervention travaux en 1 clic", fProgress2);

        // Floating Modal Card (Reconversion Modal preview)
        if (imgObj.devisModal && st > 1.6) {
          const modalP = clamp((st - 1.6) / 0.5, 0, 1);
          const modalY = 430 + (1 - easeOutQuad(modalP)) * 40;
          ctx.save();
          ctx.globalAlpha = alpha * modalP;
          drawBrowserWindow(imgObj.devisModal, 1250, modalY, 600, 480, 'Reconversion Devis -> Travaux', 1.0, 'rgba(16, 185, 129, 0.5)');
          ctx.restore();
        }

        ctx.restore();
      }

      // ==========================================
      // SCENE 4 : DISPATCHING GANTT 60 FPS (16.0s - 21.5s)
      // ==========================================
      else if (t >= 16.0 && t < 21.5) {
        const st = t - 16.0; // 0 to 5.5
        const p = st / 5.5;
        const alpha = Math.min(clamp(st / 0.5, 0, 1), clamp((5.5 - st) / 0.5, 0, 1));

        ctx.save();
        ctx.globalAlpha = alpha;
        drawHeaderBar('Dispatching Multi-Ressources & Planning Gantt');

        // Left Side texts
        ctx.textAlign = 'left';
        drawPillBadge('PERFORMANCE & RÉACTIVITÉ 60 FPS', 70, 95, 'rgba(16, 185, 129, 0.2)', '#10b981', '#34d399');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText("Planning Gantt Ultra-Fluide", 70, 180);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '20px sans-serif';
        ctx.fillText("Planifiez vos équipes sans latence avec détection des conflits.", 70, 220);

        const fProgress1 = clamp((st - 0.4) / 0.5, 0, 1);
        const fProgress2 = clamp((st - 1.1) / 0.5, 0, 1);
        const fProgress3 = clamp((st - 1.8) / 0.5, 0, 1);
        const fProgress4 = clamp((st - 2.5) / 0.5, 0, 1);

        drawFeatureBox(70, 260, 560, 75, '📅', "Glisser-Déposer Instantané", "Fluidité native 60 images/seconde sur tout le planning", fProgress1);
        drawFeatureBox(70, 350, 560, 75, '⚡', "Bourse de Dispatch Rapide", "Affectez les urgences aux techniciens disponibles en un éclair", fProgress2);
        drawFeatureBox(70, 440, 560, 75, '🛡️', "Contrôle Anti-Chevauchement", "Alertes visuelles en cas de double réservation d'un technicien", fProgress3);
        drawFeatureBox(70, 530, 560, 75, '👥', "Gestion Sous-Traitants & Équipes", "Affectation par compétence métier (Électricité, Plomberie, Peinture)", fProgress4);

        // Right Side: Gantt Screenshot Window
        const zoom = 1.0 + p * 0.04;
        drawBrowserWindow(imgObj.gantt, 680, 110, 1170, 890, 'https://suivi.anelecgroupe.com/app/dispatch', zoom, 'rgba(16, 185, 129, 0.4)');

        ctx.restore();
      }

      // ==========================================
      // SCENE 5 : CARTE INTERACTIVE & OPTIMISEUR TSP (21.5s - 27.5s)
      // ==========================================
      else if (t >= 21.5 && t < 27.5) {
        const st = t - 21.5; // 0 to 6.0
        const p = st / 6.0;
        const alpha = Math.min(clamp(st / 0.5, 0, 1), clamp((6.0 - st) / 0.5, 0, 1));

        ctx.save();
        ctx.globalAlpha = alpha;
        drawHeaderBar('Cartographie Interactive & Optimisation TSP');

        // Right Side texts
        ctx.textAlign = 'left';
        drawPillBadge('ALGORITHME TSP & TEMPS RÉEL', 1250, 95, 'rgba(245, 158, 11, 0.2)', '#f59e0b', '#fcd34d');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px sans-serif';
        ctx.fillText("Tournées Intelligentes TSP", 1250, 180);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '19px sans-serif';
        ctx.fillText("Optimisation kilométrique et suppression temps réel.", 1250, 220);

        const fProgress1 = clamp((st - 0.4) / 0.5, 0, 1);
        const fProgress2 = clamp((st - 1.2) / 0.5, 0, 1);
        const fProgress3 = clamp((st - 2.0) / 0.5, 0, 1);

        drawFeatureBox(1250, 260, 600, 75, '📍', "Départ Siège Social & Trajets", "Calcul d'itinéraire TSP optimal minimisant le temps de trajet", fProgress1);
        drawFeatureBox(1250, 350, 600, 75, '🚀', "Retrait Automatique en Direct", "Les missions clôturées sur mobile disparaissent instantanément", fProgress2);
        drawFeatureBox(1250, 440, 600, 75, '🖥️', "Mode Cockpit Plein Écran PC", "Bascule plein écran pour projection grand écran au bureau", fProgress3);

        // Before / After Transition on Left:
        // From 0 to 3s: mapBefore. From 3s to 6s: smoothly crossfading to mapAfter!
        const crossfadeP = clamp((st - 2.6) / 0.8, 0, 1);
        const zoom = 1.0 + p * 0.04;

        // Draw Map Window
        ctx.save();
        drawBrowserWindow(imgObj.mapBefore, 70, 110, 1140, 890, 'Carte des Tournées (Départ Siège & Chantiers En Cours)', zoom, 'rgba(245, 158, 11, 0.4)');
        if (imgObj.mapAfter && crossfadeP > 0) {
          ctx.globalAlpha = alpha * crossfadeP;
          drawBrowserWindow(imgObj.mapAfter, 70, 110, 1140, 890, 'Mise à Jour : Retrait Automatique des Chantiers Finis !', zoom, 'rgba(16, 185, 129, 0.6)');
        }
        ctx.restore();

        // Banner Badge over map indicating real-time removal
        if (st > 2.8) {
          const bannerP = clamp((st - 2.8) / 0.4, 0, 1);
          ctx.save();
          ctx.globalAlpha = alpha * bannerP;
          ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
          roundRect(ctx, 120, 180, 520, 50, 10);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText('✓ Mission validée sur mobile : Retirée de la carte !', 140, 212);
          ctx.restore();
        }

        ctx.restore();
      }

      // ==========================================
      // SCENE 6 : APPLICATION MOBILE TECHNICIEN PWA (27.5s - 33.5s)
      // ==========================================
      else if (t >= 27.5 && t < 33.5) {
        const st = t - 27.5; // 0 to 6.0
        const p = st / 6.0;
        const alpha = Math.min(clamp(st / 0.5, 0, 1), clamp((6.0 - st) / 0.5, 0, 1));

        ctx.save();
        ctx.globalAlpha = alpha;
        drawHeaderBar('Application Mobile Technicien PWA');

        // Left Side: Smartphone 1 (Modal Clôture GPS) & Smartphone 2 (Missions + Toast blanc opaque)
        const phoneZoom = 1.0 + p * 0.03;
        drawPhoneMockup(imgObj.mobileModal, 110, 100, 440, 890, phoneZoom);
        drawPhoneMockup(imgObj.mobileToast, 600, 100, 440, 890, phoneZoom);

        // Right Side texts
        ctx.textAlign = 'left';
        drawPillBadge('APPLICATION TERRAIN PWA SÉCURISÉE', 1100, 95, 'rgba(139, 92, 246, 0.2)', '#8b5cf6', '#c4b5fd');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText("L'Application Mobile Technicien", 1100, 180);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '20px sans-serif';
        ctx.fillText("Fiabilité juridique, horodatage certifié et zéro saisie inutile.", 1100, 220);

        const fProgress1 = clamp((st - 0.4) / 0.5, 0, 1);
        const fProgress2 = clamp((st - 1.1) / 0.5, 0, 1);
        const fProgress3 = clamp((st - 1.8) / 0.5, 0, 1);
        const fProgress4 = clamp((st - 2.5) / 0.5, 0, 1);

        drawFeatureBox(1100, 260, 750, 75, '⏰', "Pointage Matin Biométrique / Horodaté", "Heure d'embauche inviolable et suivi de présence en temps réel", fProgress1);
        drawFeatureBox(1100, 350, 750, 75, '📍', "Clôture avec Position GPS Obligatoire", "Transmission immédiate des coordonnées GPS précises au bureau", fProgress2);
        drawFeatureBox(1100, 440, 750, 75, '📸', "Photos Avant / Après & Signature Client", "Génération automatique du rapport PDF prêt pour facturation", fProgress3);
        drawFeatureBox(1100, 530, 750, 75, '✨', "Messages Éphémères Professionnels", "Toasts blancs opaques élégants sans aucun chevauchement", fProgress4);

        ctx.restore();
      }

      // ==========================================
      // SCENE 7 : STUDIO FACTURATION & DIAGNOSTIC RETARDS (33.5s - 38.5s)
      // ==========================================
      else if (t >= 33.5 && t < 38.5) {
        const st = t - 33.5; // 0 to 5.0
        const p = st / 5.0;
        const alpha = Math.min(clamp(st / 0.5, 0, 1), clamp((5.0 - st) / 0.5, 0, 1));

        ctx.save();
        ctx.globalAlpha = alpha;
        drawHeaderBar('Facturation & Diagnostic des Retards');

        // Left Side: 2 stacked screenshot cards (5 Bacs KPI + Diagnostic Retards)
        const zoom = 1.0 + p * 0.04;
        drawBrowserWindow(imgObj.facturationBacs, 70, 95, 1140, 440, 'Studio Facturation : Tri Automatique en 5 Bacs Comptables', zoom, 'rgba(16, 185, 129, 0.4)');
        drawBrowserWindow(imgObj.facturationRetards, 70, 560, 1140, 455, 'Diagnostic 1-Clic : Causes des Retards & Courriers Prêts', zoom, 'rgba(239, 68, 68, 0.4)');

        // Right Side texts
        ctx.textAlign = 'left';
        drawPillBadge('FINANCE & RELATION CLIENT', 1250, 95, 'rgba(16, 185, 129, 0.2)', '#10b981', '#34d399');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px sans-serif';
        ctx.fillText("Studio Facturation 5 Bacs", 1250, 170);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px sans-serif';
        ctx.fillText("Accélérez vos encaissements et désamorcez les litiges.", 1250, 210);

        const fProgress1 = clamp((st - 0.3) / 0.4, 0, 1);
        const fProgress2 = clamp((st - 0.7) / 0.4, 0, 1);
        const fProgress3 = clamp((st - 1.1) / 0.4, 0, 1);
        const fProgress4 = clamp((st - 1.5) / 0.4, 0, 1);

        drawFeatureBox(1250, 250, 600, 72, '⚖️', "Arbitrage Automatique B2B / B2C", "Gestion différenciée des règles fiscales HT et TTC", fProgress1);
        drawFeatureBox(1250, 335, 600, 72, '⚡', "Diagnostic 1-Clic des Retards", "Identification instantanée de la cause exacte du retard", fProgress2);
        drawFeatureBox(1250, 420, 600, 72, '✉️', "Courriers Clients Prêts à l'Envoi", "Réponses types pré-remplies selon l'historique chantier", fProgress3);
        drawFeatureBox(1250, 505, 600, 72, '📊', "Contrôle Rigoureux des Cartes KPI", "Titres nets, traits alignés et zéro icône masquée", fProgress4);

        ctx.restore();
      }

      // ==========================================
      // SCENE 8 : CRÉATION DE COMPTE & CALL TO ACTION (38.5s - 44.0s)
      // ==========================================
      else {
        const st = t - 38.5; // 0 to 5.5
        const p = st / 5.5;
        const fadeIn = clamp(st / 0.6, 0, 1);
        const fadeOut = clamp((5.5 - st) / 0.4, 0, 1);
        const alpha = Math.min(fadeIn, fadeOut);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Big Centered Closing Frame
        // Left: Google 1-Click register screenshot
        const zoom = 1.0 + p * 0.04;
        drawBrowserWindow(imgObj.registerGoogle, 90, 180, 840, 760, 'https://suivi.anelecgroupe.com/auth/login (Google 1-Clic)', zoom, 'rgba(16, 185, 129, 0.4)');

        // Right: Punchy CTA & Official Brand Finish
        ctx.textAlign = 'left';
        drawPillBadge('DÉPLOIEMENT INSTANTANÉ', 990, 180);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 50px sans-serif';
        ctx.fillText("Démarrez en Moins de 30s", 990, 265);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '22px sans-serif';
        ctx.fillText("Créez votre espace entreprise avec votre compte Google.", 990, 315);

        const fProgress1 = clamp((st - 0.4) / 0.5, 0, 1);
        const fProgress2 = clamp((st - 0.9) / 0.5, 0, 1);
        const fProgress3 = clamp((st - 1.4) / 0.5, 0, 1);

        drawFeatureBox(990, 360, 840, 75, '🚀', "Connexion Google 1-Clic", "Vos identifiants entreprise pré-remplis automatiquement", fProgress1);
        drawFeatureBox(990, 455, 840, 75, '🔒', "Base Dédiée Supabase PostgreSQL 17", "Isolation stricte des données et sauvegardes automatisées", fProgress2);
        drawFeatureBox(990, 550, 840, 75, '📱', "Accessible sur Ordinateur & Smartphone", "PWA installable sans passer par les stores", fProgress3);

        // Giant Glowing CTA Button
        const ctaP = clamp((st - 1.8) / 0.6, 0, 1);
        if (ctaP > 0) {
          const btnX = 990;
          const btnY = 660;
          const btnW = 840;
          const btnH = 100;

          ctx.save();
          ctx.globalAlpha = alpha * ctaP;
          ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
          ctx.shadowBlur = 30;

          const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
          btnGrad.addColorStop(0, '#059669');
          btnGrad.addColorStop(1, '#10b981');
          ctx.fillStyle = btnGrad;
          roundRect(ctx, btnX, btnY, btnW, btnH, 18);
          ctx.fill();

          ctx.strokeStyle = '#6ee7b7';
          ctx.lineWidth = 2;
          roundRect(ctx, btnX, btnY, btnW, btnH, 18);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Rejoignez la Plateforme : suivi.anelecgroupe.com', btnX + btnW / 2, btnY + 62);
          ctx.restore();
        }

        // Small Footer note
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '16px sans-serif';
        ctx.fillText('ANELEC GROUPE TCE • Tous droits réservés © 2026 • Logiciel de Gestion Tous Corps d\'État', 960, 1030);

        ctx.restore();
      }
    }

    // 5. RUN ANIMATION LOOP
    return new Promise((resolve) => {
      function tick(now) {
        const elapsed = (now - startTime) / 1000;
        if (elapsed >= TOTAL_DURATION) {
          console.log('Finished capturing 44s animation.');
          recorder.stop();
          return;
        }

        renderFrame(elapsed);
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      finishedPromise.then(resolve);
    });
  }, assetMap);

  console.log('=== [3/4] Saving Raw WebM Stream ===');
  const webmPath = path.join(DOCS_DIR, 'promo_video_temp.webm');
  fs.writeFileSync(webmPath, Buffer.from(webmBase64, 'base64'));
  console.log('Raw WebM written to:', webmPath, `(${(fs.statSync(webmPath).size / 1024 / 1024).toFixed(2)} MB)`);

  await browser.close();

  console.log('=== [4/4] Encoding Final High Definition MP4 with FFmpeg ===');
  const audioPath = path.join(DOCS_DIR, 'soundtrack_anelec_tce.wav');
  const outputMp4Path = path.join(DOCS_DIR, 'video_publicitaire_anelec_tce.mp4');
  const artifactMp4Path = path.join(ARTIFACT_DIR, 'video_publicitaire_anelec_tce.mp4');

  // Mux video + audio into pristine 1080p H.264 MP4
  const ffmpegCmd = `ffmpeg -y -i "${webmPath}" -i "${audioPath}" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${outputMp4Path}"`;
  console.log('Running:', ffmpegCmd);
  execSync(ffmpegCmd, { stdio: 'inherit' });

  console.log('Final MP4 generated:', outputMp4Path, `(${(fs.statSync(outputMp4Path).size / 1024 / 1024).toFixed(2)} MB)`);

  // Copy to Artifact directory
  fs.copyFileSync(outputMp4Path, artifactMp4Path);
  console.log('Copied to artifact:', artifactMp4Path);

  // Clean up temporary webm file
  try {
    fs.unlinkSync(webmPath);
  } catch (e) {}

  console.log('SUCCESS! Video generation complete.');
}

generatePromoVideo().catch((err) => {
  console.error('Fatal error during video generation:', err);
  process.exit(1);
});
