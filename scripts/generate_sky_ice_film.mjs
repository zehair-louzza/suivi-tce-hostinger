import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const require = createRequire('C:\\Users\\Zeh\\.gemini\\antigravity\\scratch\\package.json');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_DIR = 'C:\\Users\\Zeh\\suivi-tce-hostinger';
const DOCS_DIR = path.join(BASE_DIR, 'docs');
const CLIPS_DIR = path.join(DOCS_DIR, 'clips');
const AUDIO_DIR = path.join(DOCS_DIR, 'audio');
const IMAGES_DIR = path.join(DOCS_DIR, 'images');
const ARTIFACT_DIR = 'C:\\Users\\Zeh\\.gemini\\antigravity\\brain\\d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';

function fileToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

async function generateSkyIceFilm() {
  console.log('=== [1/5] Loading Real Assets for Sky & Ice Presentation ===');
  const assets = {
    dashboardSkyIce: fileToDataUrl(path.join(IMAGES_DIR, 'doc-04-dashboard-sky-ice-ca.png')),
    dashboardVolumes: fileToDataUrl(path.join(IMAGES_DIR, 'doc-05-dashboard-volume-donneurs-ordre.png')),
    dashboardSynthese: fileToDataUrl(path.join(IMAGES_DIR, '02-dashboard-synthese-pc.png')),
    logo: fileToDataUrl(path.join(IMAGES_DIR, '01-logo-anelec-groupe.png')),
  };

  console.log('=== [2/5] Launching Chrome Headless Canvas Engine (1920x1080 @ 30fps) ===');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    protocolTimeout: 0,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);
  await page.setViewport({ width: 1920, height: 1080 });

  const webmBase64 = await page.evaluate(async (imgAssets) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });

    // Preload images
    const imgs = {};
    await Promise.all(
      Object.entries(imgAssets).map(([k, src]) => {
        return new Promise((resolve) => {
          const im = new Image();
          im.onload = () => { imgs[k] = im; resolve(); };
          im.onerror = () => resolve();
          im.src = src;
        });
      })
    );

    // Setup MediaRecorder
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 10000000,
    });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const finishedPromise = new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      };
    });

    recorder.start();

    const TOTAL_SEC = 180.0;
    const t0 = performance.now();

    function clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    }
    function roundRect(ctx, x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y + x, y, r);
      ctx.closePath();
    }

    // Sky & Ice Color Palette
    const COLOR_BG = '#F3F7FA'; // Blanc glacier
    const COLOR_CARD = '#FFFFFF';
    const COLOR_BORDER = '#DFE8EF';
    const COLOR_TEXT_MAIN = '#183247'; // Bleu nuit
    const COLOR_TEXT_MUTED = '#526779';
    const COLOR_SERIES_CA = '#2378B5'; // CA facturé HT
    const COLOR_SERIES_INT = '#238675'; // Interventions effectuées HT
    const COLOR_SERIES_DEV_EMIS = '#8064B1'; // Devis émis HT
    const COLOR_SERIES_DEV_ACC = '#AC782D'; // Devis acceptés HT

    // Helper: draw base Sky & Ice Background
    function drawSkyIceBase() {
      ctx.fillStyle = COLOR_BG;
      ctx.fillRect(0, 0, 1920, 1080);

      // Discrète trame de fond satinée
      ctx.save();
      ctx.strokeStyle = 'rgba(223, 232, 239, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 1920; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke();
      }
      for (let y = 0; y < 1080; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1920, y); ctx.stroke();
      }
      ctx.restore();
    }

    // Helper: Draw header bar
    function drawHeader(chapterTitle) {
      ctx.save();
      ctx.fillStyle = COLOR_CARD;
      ctx.fillRect(0, 0, 1920, 68);
      ctx.strokeStyle = COLOR_BORDER;
      ctx.beginPath(); ctx.moveTo(0, 68); ctx.lineTo(1920, 68); ctx.stroke();

      // Brand
      ctx.fillStyle = COLOR_TEXT_MAIN;
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
      ctx.fillText('Suivi TCE', 60, 42);

      ctx.fillStyle = COLOR_TEXT_MUTED;
      ctx.font = '16px sans-serif';
      ctx.fillText('/', 185, 42);

      ctx.fillStyle = COLOR_SERIES_CA;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(chapterTitle.toUpperCase(), 205, 42);

      // Pill: Solution Suivi TCE
      ctx.fillStyle = '#EBF3F8';
      roundRect(ctx, 1660, 16, 200, 36, 18);
      ctx.fill();
      ctx.strokeStyle = '#CFDEE8';
      roundRect(ctx, 1660, 16, 200, 36, 18);
      ctx.stroke();

      ctx.fillStyle = COLOR_TEXT_MAIN;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('DU DEVIS AU SUIVI', 1700, 39);
      ctx.restore();
    }

    // Helper: Mandatory disclaimer at bottom left
    function drawDisclaimer() {
      ctx.save();
      ctx.fillStyle = 'rgba(82, 103, 121, 0.85)';
      ctx.font = '13px sans-serif';
      ctx.fillText('Interface illustrative — données fictives', 60, 1050);
      ctx.restore();
    }

    // Helper: Subtitle banner at bottom center
    function drawSubtitleBanner(subtitleText) {
      if (!subtitleText) return;
      ctx.save();
      ctx.font = '500 21px sans-serif';
      const w = ctx.measureText(subtitleText).width + 48;
      const x = (1920 - w) / 2;
      const y = 960;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      roundRect(ctx, x, y, w, 48, 24);
      ctx.fill();

      ctx.strokeStyle = COLOR_BORDER;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, 48, 24);
      ctx.stroke();

      ctx.shadowColor = 'rgba(24, 50, 71, 0.08)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = COLOR_TEXT_MAIN;
      ctx.textAlign = 'center';
      ctx.fillText(subtitleText, 1920 / 2, y + 31);
      ctx.restore();
    }

    // Helper: Draw 4 KPI cards row
    function drawKPICards(x, y, w, h, activeCardIdx = -1) {
      const cards = [
        { label: 'CA facturé HT', val: '25 670 €', col: COLOR_SERIES_CA },
        { label: 'Interventions effectuées HT', val: '50 135 €', col: COLOR_SERIES_INT },
        { label: 'Devis émis HT', val: '62 300 €', col: COLOR_SERIES_DEV_EMIS },
        { label: 'Devis acceptés HT', val: '20 320 €', col: COLOR_SERIES_DEV_ACC },
      ];

      const gap = 24;
      const cardW = (w - gap * 3) / 4;

      cards.forEach((c, i) => {
        const cx = x + i * (cardW + gap);
        ctx.save();
        ctx.fillStyle = COLOR_CARD;
        ctx.shadowColor = 'rgba(24, 50, 71, 0.06)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        roundRect(ctx, cx, y, cardW, h, 12);
        ctx.fill();

        ctx.strokeStyle = activeCardIdx === i ? c.col : COLOR_BORDER;
        ctx.lineWidth = activeCardIdx === i ? 2.5 : 1.5;
        roundRect(ctx, cx, y, cardW, h, 12);
        ctx.stroke();

        // Accent top bar
        ctx.fillStyle = c.col;
        roundRect(ctx, cx, y, cardW, 4, 2);
        ctx.fill();

        // Label
        ctx.fillStyle = COLOR_TEXT_MUTED;
        ctx.font = '600 14px sans-serif';
        ctx.fillText(c.label, cx + 20, y + 34);

        // Value
        ctx.fillStyle = COLOR_TEXT_MAIN;
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText(c.val, cx + 20, y + 78);

        // Subtle decorative mini trend line
        ctx.strokeStyle = c.col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 20, y + 105);
        ctx.lineTo(cx + 80, y + 102);
        ctx.lineTo(cx + 140, y + 95);
        ctx.lineTo(cx + cardW - 20, y + 98);
        ctx.stroke();

        ctx.restore();
      });
    }

    // Helper: Draw Line Chart with elevated soft drop shadow
    function drawSkyIceChart(x, y, w, h, drawProgress = 1.0, highlightWeek = false) {
      ctx.save();
      // Card Container
      ctx.fillStyle = COLOR_CARD;
      ctx.shadowColor = 'rgba(24, 50, 71, 0.06)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      roundRect(ctx, x, y, w, h, 14);
      ctx.fill();

      ctx.strokeStyle = COLOR_BORDER;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 14);
      ctx.stroke();
      ctx.restore();

      // Title & Y-axis label
      ctx.fillStyle = COLOR_TEXT_MAIN;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Montants par jour (€ HT)', x + 30, y + 36);

      // Legend in top right
      const legX = x + w - 580;
      const series = [
        { label: 'CA facturé HT', col: COLOR_SERIES_CA },
        { label: 'Interventions effectuées HT', col: COLOR_SERIES_INT },
        { label: 'Devis émis HT', col: COLOR_SERIES_DEV_EMIS },
        { label: 'Devis acceptés HT', col: COLOR_SERIES_DEV_ACC },
      ];
      let curLegX = legX;
      series.forEach((s) => {
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(curLegX, y + 30, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLOR_TEXT_MUTED;
        ctx.font = '500 12.5px sans-serif';
        ctx.fillText(s.label, curLegX + 10, y + 34);
        curLegX += ctx.measureText(s.label).width + 24;
      });

      // Chart plotting area
      const padL = 80;
      const padR = 40;
      const padT = 70;
      const padB = 60;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const plotX = x + padL;
      const plotY = y + padT;

      // Y-axis grid lines (€ HT)
      const yTicks = [
        { val: '4,5 k€', yRel: 0.05 },
        { val: '3 k€', yRel: 0.35 },
        { val: '1,5 k€', yRel: 0.65 },
        { val: '0 €', yRel: 0.95 },
      ];

      ctx.save();
      ctx.strokeStyle = 'rgba(223, 232, 239, 0.7)';
      ctx.lineWidth = 1;
      ctx.fillStyle = COLOR_TEXT_MUTED;
      ctx.font = '12px sans-serif';

      yTicks.forEach((yt) => {
        const lineY = plotY + yt.yRel * plotH;
        ctx.beginPath(); ctx.moveTo(plotX, lineY); ctx.lineTo(plotX + plotW, lineY); ctx.stroke();
        ctx.fillText(yt.val, x + 25, lineY + 4);
      });

      // X-axis days (21 days across 3 weeks)
      const days = [
        'Di 18', 'Lu 19', 'Ma 20', 'Me 21', 'Je 22', 'Ve 23', 'Sa 24',
        'Di 25', 'Lu 26', 'Ma 27', 'Me 28', 'Je 29', 'Ve 30', 'Sa 31',
        'Di 01', 'Lu 02', 'Ma 03', 'Me 04', 'Je 05', 'Ve 06', 'Sa 07'
      ];

      const stepX = plotW / (days.length - 1);
      days.forEach((d, i) => {
        const dx = plotX + i * stepX;
        ctx.fillText(d, dx - 14, plotY + plotH + 24);
        // Subtle vertical ticks
        ctx.beginPath(); ctx.moveTo(dx, plotY + plotH); ctx.lineTo(dx, plotY + plotH + 6); ctx.stroke();
      });

      // ISO week groups
      const weekStarts = [0, 7, 14];
      const weekLabels = ['S42 • 18 oct. - 24 oct.', 'S43 • 25 oct. - 31 oct.', 'S44 • 01 nov. - 07 nov.'];
      weekStarts.forEach((ws, i) => {
        const wx = plotX + ws * stepX;
        const wEnd = plotX + Math.min(days.length - 1, ws + 6) * stepX;
        ctx.fillStyle = COLOR_TEXT_MUTED;
        ctx.font = '600 12px sans-serif';
        ctx.fillText(weekLabels[i], (wx + wEnd) / 2 - 60, plotY + plotH + 46);
      });

      // Highlight week band if requested (e.g. Chapter 6)
      if (highlightWeek) {
        const hx1 = plotX + 14 * stepX;
        const hw = 6 * stepX;
        ctx.fillStyle = 'rgba(35, 120, 181, 0.08)';
        ctx.fillRect(hx1 - 10, plotY, hw + 20, plotH);
        ctx.strokeStyle = 'rgba(35, 120, 181, 0.35)';
        ctx.strokeRect(hx1 - 10, plotY, hw + 20, plotH);
      }

      // Realistic business fluctuation data points (normalized 0 to 1)
      const dataSeries = [
        // CA Facturé (bleu #2378B5)
        {
          color: COLOR_SERIES_CA,
          pts: [0.35, 0.42, 0.58, 0.72, 0.82, 0.64, 0.40, 0.45, 0.55, 0.68, 0.76, 0.62, 0.48, 0.38, 0.50, 0.60, 0.70, 0.78, 0.65, 0.52, 0.42],
        },
        // Interventions (vert #238675)
        {
          color: COLOR_SERIES_INT,
          pts: [0.28, 0.38, 0.65, 0.85, 0.90, 0.72, 0.48, 0.52, 0.62, 0.74, 0.84, 0.70, 0.54, 0.44, 0.58, 0.68, 0.80, 0.86, 0.72, 0.58, 0.46],
        },
        // Devis émis (violet #8064B1)
        {
          color: COLOR_SERIES_DEV_EMIS,
          pts: [0.20, 0.30, 0.48, 0.60, 0.68, 0.55, 0.35, 0.38, 0.46, 0.58, 0.65, 0.52, 0.40, 0.32, 0.42, 0.52, 0.60, 0.66, 0.55, 0.44, 0.36],
        },
        // Devis acceptés (ocre #AC782D)
        {
          color: COLOR_SERIES_DEV_ACC,
          pts: [0.15, 0.22, 0.35, 0.48, 0.54, 0.42, 0.26, 0.30, 0.36, 0.44, 0.50, 0.40, 0.32, 0.24, 0.32, 0.40, 0.46, 0.52, 0.42, 0.34, 0.28],
        },
      ];

      // RENDER CURVES WITH THE REQUIRED ELEVATED DROP SHADOW (+3px down, +2px right)
      dataSeries.forEach((s) => {
        const totalPts = s.pts.length;
        const visiblePtsCount = Math.floor(totalPts * drawProgress);
        if (visiblePtsCount < 2) return;

        // 1. Draw the elevated soft drop shadow first
        ctx.save();
        ctx.strokeStyle = 'rgba(24, 50, 71, 0.16)'; // Ombre douce
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i <= visiblePtsCount; i++) {
          const ptIdx = Math.min(i, totalPts - 1);
          const px = plotX + ptIdx * stepX + 2; // +2px décalé à droite
          const py = plotY + (1 - s.pts[ptIdx]) * (plotH - 20) + 3; // +3px décalé vers le bas
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // 2. Draw the actual crisp colored line on top
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.8;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i <= visiblePtsCount; i++) {
          const ptIdx = Math.min(i, totalPts - 1);
          const px = plotX + ptIdx * stepX;
          const py = plotY + (1 - s.pts[ptIdx]) * (plotH - 20);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // 3. Draw circular white nodes with colored borders
        for (let i = 0; i <= visiblePtsCount; i++) {
          const ptIdx = Math.min(i, totalPts - 1);
          const px = plotX + ptIdx * stepX;
          const py = plotY + (1 - s.pts[ptIdx]) * (plotH - 20);
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      });

      ctx.restore();
    }

    // Helper: Draw Volumes chart (for Chapter 6)
    function drawVolumesChart(x, y, w, h, highlightWeek = false) {
      ctx.save();
      ctx.fillStyle = COLOR_CARD;
      ctx.shadowColor = 'rgba(24, 50, 71, 0.06)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      roundRect(ctx, x, y, w, h, 14);
      ctx.fill();

      ctx.strokeStyle = COLOR_BORDER;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 14);
      ctx.stroke();

      ctx.fillStyle = COLOR_TEXT_MAIN;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText("Nombre d'interventions et de devis par jour", x + 30, y + 32);

      // Y-axis label: "Nombre" (distinct from € HT)
      ctx.fillStyle = COLOR_TEXT_MUTED;
      ctx.font = '12px sans-serif';
      ctx.fillText('Nombre 4', x + 25, y + 65);
      ctx.fillText('3', x + 65, y + 95);
      ctx.fillText('2', x + 65, y + 125);
      ctx.fillText('1', x + 65, y + 155);

      const padL = 80;
      const padR = 40;
      const plotW = w - padL - padR;
      const plotH = h - 90;
      const plotX = x + padL;
      const plotY = y + 55;

      const numDays = 21;
      const stepX = plotW / (numDays - 1);

      if (highlightWeek) {
        const hx1 = plotX + 14 * stepX;
        const hw = 6 * stepX;
        ctx.fillStyle = 'rgba(35, 120, 181, 0.08)';
        ctx.fillRect(hx1 - 10, plotY, hw + 20, plotH);
        ctx.strokeStyle = 'rgba(35, 120, 181, 0.35)';
        ctx.strokeRect(hx1 - 10, plotY, hw + 20, plotH);
      }

      // Draw volume series: interventions (vert) and devis (violet)
      const vInt = [1, 2, 3, 4, 3, 2, 1, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 4, 3, 2, 1];
      const vDev = [1, 1, 2, 3, 2, 1, 1, 1, 2, 2, 3, 2, 1, 1, 1, 2, 3, 3, 2, 1, 1];

      function plotVolLine(arr, col) {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        arr.forEach((val, i) => {
          const vx = plotX + i * stepX;
          const vy = plotY + (1 - val / 4.5) * plotH;
          if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
        });
        ctx.stroke();

        arr.forEach((val, i) => {
          const vx = plotX + i * stepX;
          const vy = plotY + (1 - val / 4.5) * plotH;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath(); ctx.arc(vx, vy, 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.arc(vx, vy, 3, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.restore();
      }

      plotVolLine(vInt, COLOR_SERIES_INT);
      plotVolLine(vDev, COLOR_SERIES_DEV_EMIS);

      ctx.restore();
    }

    // ============================================================
    // MAIN FRAME RENDERER (180 SECONDS = 8 CHAPTERS)
    // ============================================================
    function renderFrame(sec) {
      drawSkyIceBase();

      // ------------------------------------------------------------
      // CHAPITRE 1 : LE QUOTIDIEN DISPERSÉ (00:00 - 00:20 | Clips 1 & 2)
      // ------------------------------------------------------------
      if (sec < 20.0) {
        drawHeader('1. Le Quotidien du Bâtiment');
        drawDisclaimer();

        // Bureau d'entreprise crédible & fiches d'activité
        const zoom = 1.0 + (sec / 20.0) * 0.05;
        ctx.save();
        ctx.translate(960, 480);
        ctx.scale(zoom, zoom);
        ctx.translate(-960, -480);

        // Panneau bureau central sobre
        ctx.fillStyle = COLOR_CARD;
        ctx.shadowColor = 'rgba(24, 50, 71, 0.08)';
        ctx.shadowBlur = 24;
        roundRect(ctx, 360, 160, 1200, 680, 16);
        ctx.fill();
        ctx.strokeStyle = COLOR_BORDER;
        ctx.lineWidth = 1.5;
        roundRect(ctx, 360, 160, 1200, 680, 16);
        ctx.stroke();

        // Plans & documents sur le bureau
        ctx.fillStyle = '#EBF2F7';
        roundRect(ctx, 420, 220, 400, 540, 10);
        ctx.fill();
        ctx.strokeStyle = '#D1DFEA';
        roundRect(ctx, 420, 220, 400, 540, 10);
        ctx.stroke();
        ctx.fillStyle = COLOR_TEXT_MUTED;
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('PLAN D’EXÉCUTION & CHANTIER', 450, 260);
        // Lignes du plan
        ctx.strokeStyle = '#9EB7C9';
        ctx.beginPath();
        ctx.moveTo(450, 300); ctx.lineTo(770, 300);
        ctx.moveTo(450, 380); ctx.lineTo(650, 380);
        ctx.moveTo(650, 380); ctx.lineTo(650, 600);
        ctx.moveTo(450, 600); ctx.lineTo(770, 600);
        ctx.stroke();

        // Classeur Devis à droite
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, 860, 220, 640, 540, 10);
        ctx.fill();
        ctx.strokeStyle = COLOR_BORDER;
        roundRect(ctx, 860, 220, 640, 540, 10);
        ctx.stroke();
        ctx.fillStyle = COLOR_TEXT_MAIN;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('DOSSIERS EN COURS • SUIVI D’EXPLOITATION', 900, 270);

        const items = [
          'Devis DEV-2026-001 — Rénovation Électrique (En attente retour client)',
          'Intervention INT-2026-008 — Remplacement TGBT (Planifiée ce jour)',
          'Devis DEV-2026-002 — Réfection Façade (Visite technique à organiser)',
          'Intervention INT-2026-007 — Dépannage CVC (Rapport validé)',
        ];
        items.forEach((it, idx) => {
          ctx.fillStyle = '#F8FAFC';
          roundRect(ctx, 900, 310 + idx * 95, 560, 75, 8);
          ctx.fill();
          ctx.strokeStyle = COLOR_BORDER;
          roundRect(ctx, 900, 310 + idx * 95, 560, 75, 8);
          ctx.stroke();
          ctx.fillStyle = COLOR_TEXT_MAIN;
          ctx.font = '500 14px sans-serif';
          ctx.fillText(it, 925, 355 + idx * 95);
        });

        ctx.restore();

        const sub = sec < 10.0
          ? 'Une activité. Plusieurs informations.'
          : 'Devis • Interventions • Suivi';
        drawSubtitleBanner(sub);
      }

      // ------------------------------------------------------------
      // CHAPITRE 2 : LA TRANSITION VERS LA CLARTÉ (00:20 - 00:40 | Clips 3 & 4)
      // ------------------------------------------------------------
      else if (sec >= 20.0 && sec < 40.0) {
        const cSec = sec - 20.0;
        drawHeader('2. La Transition vers la Clarté');
        drawDisclaimer();

        // 3 cartes qui s'alignent avec fluidité puis fondent dans le dashboard
        const pAlign = clamp(cSec / 5.0, 0, 1);
        const pMorph = clamp((cSec - 8.0) / 6.0, 0, 1);

        if (pMorph < 1.0) {
          ctx.save();
          ctx.globalAlpha = 1.0 - pMorph * 0.9;
          const cardData = [
            { title: 'Devis', sub: 'Chiffrages & Engagements', col: COLOR_SERIES_DEV_EMIS, x0: 200, y0: 300, x1: 300, y1: 340 },
            { title: 'Interventions', sub: 'Missions & Équipes Réalisées', col: COLOR_SERIES_INT, x0: 800, y0: 420, x1: 760, y1: 340 },
            { title: 'Facturation', sub: 'Suivi Financier & Encaissements', col: COLOR_SERIES_CA, x0: 1400, y0: 280, x1: 1220, y1: 340 },
          ];

          cardData.forEach((cd) => {
            const cx = cd.x0 + (cd.x1 - cd.x0) * pAlign;
            const cy = cd.y0 + (cd.y1 - cd.y0) * pAlign;
            ctx.fillStyle = COLOR_CARD;
            ctx.shadowColor = 'rgba(24, 50, 71, 0.1)';
            ctx.shadowBlur = 20;
            roundRect(ctx, cx, cy, 400, 240, 16);
            ctx.fill();

            ctx.strokeStyle = cd.col;
            ctx.lineWidth = 2;
            roundRect(ctx, cx, cy, 400, 240, 16);
            ctx.stroke();

            ctx.fillStyle = cd.col;
            roundRect(ctx, cx, cy, 400, 8, 4);
            ctx.fill();

            ctx.fillStyle = COLOR_TEXT_MAIN;
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText(cd.title, cx + 36, cy + 80);

            ctx.fillStyle = COLOR_TEXT_MUTED;
            ctx.font = '16px sans-serif';
            ctx.fillText(cd.sub, cx + 36, cy + 125);
          });
          ctx.restore();
        }

        // Dashboard apparaissant avec pureté
        if (pMorph > 0.1) {
          ctx.save();
          ctx.globalAlpha = pMorph;
          drawKPICards(160, 110, 1600, 120);
          drawSkyIceChart(160, 260, 1600, 660, 0.4);
          ctx.restore();
        }

        const sub = cSec < 10.0
          ? 'Remettre les informations en perspective'
          : 'Une lecture plus claire.';
        drawSubtitleBanner(sub);
      }

      // ------------------------------------------------------------
      // CHAPITRE 3 : LES QUATRE REPÈRES (00:40 - 01:05 | Clips 5, 6 & 7)
      // ------------------------------------------------------------
      else if (sec >= 40.0 && sec < 65.0) {
        const cSec = sec - 40.0;
        drawHeader('3. Les Quatre Repères Métier');
        drawDisclaimer();

        let activeCard = -1;
        if (cSec < 7.0) activeCard = 0; // CA facturé
        else if (cSec < 14.0) activeCard = 1; // Interventions
        else if (cSec < 19.0) activeCard = 2; // Devis émis
        else if (cSec < 24.0) activeCard = 3; // Devis acceptés

        drawKPICards(160, 130, 1600, 130, activeCard);
        drawSkyIceChart(160, 290, 1600, 640, 0.15);

        const sub = cSec < 12.0
          ? 'CA facturé • Interventions effectuées'
          : cSec < 20.0
          ? 'Devis émis • Devis acceptés'
          : 'Devis. Réalisation. Facturation.';
        drawSubtitleBanner(sub);
      }

      // ------------------------------------------------------------
      // CHAPITRE 4 : COMPRENDRE LES ÉVOLUTIONS (01:05 - 01:30 | Clips 8, 9 & 10)
      // ------------------------------------------------------------
      else if (sec >= 65.0 && sec < 90.0) {
        const cSec = sec - 65.0;
        drawHeader('4. Comprendre les Évolutions');
        drawDisclaimer();

        drawKPICards(160, 110, 1600, 120);

        // Graphique se traçant progressivement de gauche à droite
        const progress = clamp(cSec / 15.0, 0.2, 1.0);
        drawSkyIceChart(160, 260, 1600, 660, progress);

        const sub = cSec < 10.0
          ? 'Voir les évolutions, pas seulement les totaux.'
          : cSec < 19.0
          ? 'Observer les variations dans le temps'
          : 'Comparer les périodes';
        drawSubtitleBanner(sub);
      }

      // ------------------------------------------------------------
      // CHAPITRE 5 : LA PRÉCISION DES JOURS ET DES SEMAINES (01:30 - 01:55 | Clips 11 & 12)
      // ------------------------------------------------------------
      else if (sec >= 90.0 && sec < 115.0) {
        const cSec = sec - 90.0;
        drawHeader('5. La Précision des Jours et des Semaines');
        drawDisclaimer();

        drawKPICards(160, 110, 1600, 120);
        drawSkyIceChart(160, 260, 1600, 660, 1.0);

        // Infobulle précise sur Jeudi 22 (Clip 12)
        if (cSec > 8.0) {
          const tooltipX = 160 + 80 + 4 * (1480 / 20); // Je 22
          const tooltipY = 260 + 70 + (1 - 0.90) * (530 - 20);

          ctx.save();
          // Ligne guide verticale
          ctx.strokeStyle = COLOR_SERIES_INT;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(tooltipX, 260 + 70);
          ctx.lineTo(tooltipX, 260 + 70 + 530);
          ctx.stroke();

          // Bulle blanche satinée
          ctx.setLineDash([]);
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(24, 50, 71, 0.15)';
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 4;
          roundRect(ctx, tooltipX - 110, tooltipY - 75, 220, 60, 10);
          ctx.fill();

          ctx.strokeStyle = COLOR_SERIES_INT;
          ctx.lineWidth = 1.5;
          roundRect(ctx, tooltipX - 110, tooltipY - 75, 220, 60, 10);
          ctx.stroke();

          ctx.fillStyle = COLOR_TEXT_MUTED;
          ctx.font = '12px sans-serif';
          ctx.fillText('Jeudi 22 octobre 2026', tooltipX - 95, tooltipY - 54);

          ctx.fillStyle = COLOR_SERIES_INT;
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('Interventions : 4 250 € HT', tooltipX - 95, tooltipY - 30);
          ctx.restore();
        }

        const sub = cSec < 12.0
          ? 'Du jour à la semaine.'
          : 'Repères quotidiens & hebdomadaires';
        drawSubtitleBanner(sub);
      }

      // ------------------------------------------------------------
      // CHAPITRE 6 : LES MONTANTS ET LES VOLUMES (01:55 - 02:20 | Clips 13, 14 & 15)
      // ------------------------------------------------------------
      else if (sec >= 115.0 && sec < 140.0) {
        const cSec = sec - 115.0;
        drawHeader('6. Les Montants et les Volumes');
        drawDisclaimer();

        const highlightWeek = cSec > 6.0;

        // Double graphique empilé : Montants en haut, Volumes en bas
        drawSkyIceChart(160, 100, 1600, 480, 1.0, highlightWeek);
        drawVolumesChart(160, 610, 1600, 310, highlightWeek);

        const sub = cSec < 10.0
          ? 'Les montants et les volumes.'
          : cSec < 19.0
          ? 'Deux lectures complémentaires.'
          : 'Une base d’analyse précise';
        drawSubtitleBanner(sub);
      }

      // ------------------------------------------------------------
      // CHAPITRE 7 : UNE INTERFACE QUI LAISSE PLACE À L'ESSENTIEL (02:20 - 02:40 | Clips 16 & 17)
      // ------------------------------------------------------------
      else if (sec >= 140.0 && sec < 160.0) {
        const cSec = sec - 140.0;
        drawHeader('7. Une Interface Épurée');
        drawDisclaimer();

        // Vue d'ensemble avec zoom arrière et adaptation responsive fluide
        const pResp = clamp((cSec - 9.0) / 6.0, 0, 1);

        if (pResp === 0) {
          drawKPICards(160, 110, 1600, 120);
          drawSkyIceChart(160, 260, 1600, 660, 1.0);
        } else {
          // Tablette sobre
          const tabW = 1280 - pResp * 100;
          const tabH = 820 - pResp * 60;
          const tabX = (1920 - tabW) / 2;
          const tabY = 120;

          ctx.save();
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(24, 50, 71, 0.12)';
          ctx.shadowBlur = 30;
          roundRect(ctx, tabX, tabY, tabW, tabH, 24);
          ctx.fill();
          ctx.strokeStyle = COLOR_BORDER;
          ctx.lineWidth = 2;
          roundRect(ctx, tabX, tabY, tabW, tabH, 24);
          ctx.stroke();

          // Header de la tablette
          ctx.fillStyle = '#F8FAFC';
          roundRect(ctx, tabX + 8, tabY + 8, tabW - 16, 50, 16);
          ctx.fill();
          ctx.fillStyle = COLOR_TEXT_MAIN;
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('Suivi TCE • Vue Responsive Tablette', tabX + 30, tabY + 40);

          // Intérieur
          drawKPICards(tabX + 24, tabY + 75, tabW - 48, 100);
          drawSkyIceChart(tabX + 24, tabY + 200, tabW - 48, 560, 1.0);
          ctx.restore();
        }

        const sub = cSec < 10.0
          ? 'Clair. Structuré. Lisible.'
          : 'De la vue d’ensemble au détail utile.';
        drawSubtitleBanner(sub);
      }

      // ------------------------------------------------------------
      // CHAPITRE 8 : CONCLUSION ET SIGNATURE (02:40 - 03:00 | Clip 18)
      // ------------------------------------------------------------
      else {
        const cSec = sec - 160.0;
        drawSkyIceBase();

        // Carton final sobre, calme et pérenne
        ctx.save();
        ctx.textAlign = 'center';

        // Logo
        if (imgs.logo) {
          ctx.drawImage(imgs.logo, 960 - 65, 260, 130, 130);
        }

        // Titre Principal
        ctx.fillStyle = COLOR_TEXT_MAIN;
        ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
        ctx.fillText('Suivi TCE', 960, 470);

        // Signature Officielle
        ctx.fillStyle = COLOR_SERIES_CA;
        ctx.font = '600 32px sans-serif';
        ctx.fillText('Du devis au suivi de votre activité.', 960, 540);

        // Appel à l'action
        if (cSec > 3.0) {
          ctx.fillStyle = COLOR_TEXT_MUTED;
          ctx.font = '500 24px sans-serif';
          ctx.fillText('Découvrez la solution', 960, 620);
        }

        ctx.restore();

        drawSubtitleBanner('Suivi TCE. Du devis au suivi de votre activité.');
      }
    }

    return new Promise((resolve) => {
      function frame(now) {
        const elapsed = (now - t0) / 1000;
        if (elapsed >= TOTAL_SEC) {
          recorder.stop();
          return;
        }
        renderFrame(elapsed);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      finishedPromise.then(resolve);
    });
  }, assets);

  console.log('=== [3/5] Saving Raw WebM Master Video ===');
  const tempWebm = path.join(DOCS_DIR, 'raw_film_180s.webm');
  fs.writeFileSync(tempWebm, Buffer.from(webmBase64, 'base64'));
  console.log('Raw WebM written:', tempWebm, `(${(fs.statSync(tempWebm).size / 1024 / 1024).toFixed(2)} MB)`);

  await browser.close();

  console.log('=== [4/5] Assembling Master Film (180s Full HD 1080p + Audio Mix) ===');
  const audioMixWav = path.join(AUDIO_DIR, 'audio_master_mix_180s.wav');
  const masterMp4 = path.join(DOCS_DIR, 'film_suivi_tce_180s.mp4');
  const artifactMp4 = path.join(ARTIFACT_DIR, 'film_suivi_tce_180s.mp4');

  const ffmpegMasterCmd = `ffmpeg -y -i "${tempWebm}" -i "${audioMixWav}" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -t 180 "${masterMp4}"`;
  execSync(ffmpegMasterCmd, { stdio: 'inherit' });
  console.log('Master film encoded:', masterMp4, `(${(fs.statSync(masterMp4).size / 1024 / 1024).toFixed(2)} MB)`);

  // Copy to Artifact directory
  fs.copyFileSync(masterMp4, artifactMp4);
  console.log('Copied to artifact:', artifactMp4);

  // Copy to User Desktop & Downloads for direct access
  const userDesktop = 'C:\\Users\\Zeh\\OneDrive - office\\Bureau\\film_suivi_tce_180s.mp4';
  const userDownloads = 'C:\\Users\\Zeh\\Downloads\\film_suivi_tce_180s.mp4';
  try {
    fs.copyFileSync(masterMp4, userDesktop);
    console.log('Copied to Desktop:', userDesktop);
  } catch (e) {}
  try {
    fs.copyFileSync(masterMp4, userDownloads);
    console.log('Copied to Downloads:', userDownloads);
  } catch (e) {}

  console.log('=== [5/5] Extracting the 18 Autonomous Clips (10s each) ===');
  for (let c = 1; c <= 18; c++) {
    const startSec = (c - 1) * 10;
    const clipName = `clip_${String(c).padStart(2, '0')}.mp4`;
    const clipPath = path.join(CLIPS_DIR, clipName);
    const clipCmd = `ffmpeg -y -ss ${startSec} -t 10 -i "${masterMp4}" -c copy "${clipPath}"`;
    execSync(clipCmd, { stdio: 'ignore' });
    console.log(`Generated: ${clipName} (${startSec}s -> ${startSec + 10}s)`);
  }

  // Cleanup temp webm
  try { fs.unlinkSync(tempWebm); } catch (e) {}

  console.log('COMPLETE! Master 180s film and all 18 autonomous clips generated successfully.');
}

generateSkyIceFilm().catch(console.error);
