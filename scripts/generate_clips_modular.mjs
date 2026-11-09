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

async function runModularGenerator() {
  console.log('=== Step 1: Loading Assets ===');
  const assets = {
    logo: fileToDataUrl(path.join(IMAGES_DIR, '01-logo-anelec-groupe.png')),
  };

  console.log('=== Step 2: Launching Chrome for 18 Modular Clips ===');
  fs.mkdirSync(CLIPS_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    protocolTimeout: 180000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Load the canvas animation environment once
  await page.evaluate(async (imgAssets) => {
    window.canvas = document.createElement('canvas');
    window.canvas.width = 1920;
    window.canvas.height = 1080;
    document.body.appendChild(window.canvas);
    window.ctx = window.canvas.getContext('2d', { alpha: false });

    // Load logo
    window.imgs = {};
    await new Promise((resolve) => {
      const im = new Image();
      im.onload = () => { window.imgs.logo = im; resolve(); };
      im.onerror = () => resolve();
      im.src = imgAssets.logo;
    });

    // Helper functions
    function roundRect(ctx, x, y, w, h, r) {
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        return;
      }
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
    window.roundRect = roundRect;

    window.COLOR_BG = '#F3F7FA'; // Blanc glacier
    window.COLOR_CARD = '#FFFFFF';
    window.COLOR_BORDER = '#DFE8EF';
    window.COLOR_TEXT_MAIN = '#183247'; // Bleu nuit
    window.COLOR_TEXT_MUTED = '#526779';
    window.COLOR_SERIES_CA = '#2378B5';
    window.COLOR_SERIES_INT = '#238675';
    window.COLOR_SERIES_DEV_EMIS = '#8064B1';
    window.COLOR_SERIES_DEV_ACC = '#AC782D';

    window.drawSkyIceBase = () => {
      const ctx = window.ctx;
      ctx.fillStyle = window.COLOR_BG;
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.save();
      ctx.strokeStyle = 'rgba(223, 232, 239, 0.45)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 1920; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke();
      }
      for (let y = 0; y < 1080; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1920, y); ctx.stroke();
      }
      ctx.restore();
    };

    window.drawHeader = (chapterTitle) => {
      const ctx = window.ctx;
      ctx.save();
      ctx.fillStyle = window.COLOR_CARD;
      ctx.fillRect(0, 0, 1920, 68);
      ctx.strokeStyle = window.COLOR_BORDER;
      ctx.beginPath(); ctx.moveTo(0, 68); ctx.lineTo(1920, 68); ctx.stroke();

      ctx.fillStyle = window.COLOR_TEXT_MAIN;
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
      ctx.fillText('Suivi TCE', 60, 42);

      ctx.fillStyle = window.COLOR_TEXT_MUTED;
      ctx.font = '16px sans-serif';
      ctx.fillText('/', 185, 42);

      ctx.fillStyle = window.COLOR_SERIES_CA;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(chapterTitle.toUpperCase(), 205, 42);

      ctx.fillStyle = '#EBF3F8';
      roundRect(ctx, 1660, 16, 200, 36, 18);
      ctx.fill();
      ctx.strokeStyle = '#CFDEE8';
      roundRect(ctx, 1660, 16, 200, 36, 18);
      ctx.stroke();

      ctx.fillStyle = window.COLOR_TEXT_MAIN;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('DU DEVIS AU SUIVI', 1700, 39);
      ctx.restore();
    };

    window.drawDisclaimer = () => {
      const ctx = window.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(82, 103, 121, 0.85)';
      ctx.font = '13px sans-serif';
      ctx.fillText('Interface illustrative — données fictives', 60, 1050);
      ctx.restore();
    };

    window.drawSubtitleBanner = (text) => {
      if (!text) return;
      const ctx = window.ctx;
      ctx.save();
      ctx.font = '500 21px sans-serif';
      const w = ctx.measureText(text).width + 48;
      const x = (1920 - w) / 2;
      const y = 960;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      roundRect(ctx, x, y, w, 48, 24);
      ctx.fill();
      ctx.strokeStyle = window.COLOR_BORDER;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, 48, 24);
      ctx.stroke();

      ctx.fillStyle = window.COLOR_TEXT_MAIN;
      ctx.textAlign = 'center';
      ctx.fillText(text, 1920 / 2, y + 31);
      ctx.restore();
    };

    window.drawKPICards = (x, y, w, h, activeIdx = -1) => {
      const ctx = window.ctx;
      const cards = [
        { label: 'CA facturé HT', val: '25 670 €', col: window.COLOR_SERIES_CA },
        { label: 'Interventions effectuées HT', val: '50 135 €', col: window.COLOR_SERIES_INT },
        { label: 'Devis émis HT', val: '62 300 €', col: window.COLOR_SERIES_DEV_EMIS },
        { label: 'Devis acceptés HT', val: '20 320 €', col: window.COLOR_SERIES_DEV_ACC },
      ];
      const gap = 24;
      const cardW = (w - gap * 3) / 4;
      cards.forEach((c, i) => {
        const cx = x + i * (cardW + gap);
        ctx.save();
        ctx.fillStyle = window.COLOR_CARD;
        ctx.shadowColor = 'rgba(24, 50, 71, 0.06)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        roundRect(ctx, cx, y, cardW, h, 12);
        ctx.fill();

        ctx.strokeStyle = activeIdx === i ? c.col : window.COLOR_BORDER;
        ctx.lineWidth = activeIdx === i ? 2.5 : 1.5;
        roundRect(ctx, cx, y, cardW, h, 12);
        ctx.stroke();

        ctx.fillStyle = c.col;
        roundRect(ctx, cx, y, cardW, 4, 2);
        ctx.fill();

        ctx.fillStyle = window.COLOR_TEXT_MUTED;
        ctx.font = '600 14px sans-serif';
        ctx.fillText(c.label, cx + 20, y + 34);

        ctx.fillStyle = window.COLOR_TEXT_MAIN;
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText(c.val, cx + 20, y + 78);

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
    };

    window.drawSkyIceChart = (x, y, w, h, progress = 1.0, highlightWeek = false) => {
      const ctx = window.ctx;
      ctx.save();
      ctx.fillStyle = window.COLOR_CARD;
      ctx.shadowColor = 'rgba(24, 50, 71, 0.06)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      roundRect(ctx, x, y, w, h, 14);
      ctx.fill();
      ctx.strokeStyle = window.COLOR_BORDER;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 14);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = window.COLOR_TEXT_MAIN;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Montants par jour (€ HT)', x + 30, y + 36);

      const legX = x + w - 580;
      const series = [
        { label: 'CA facturé HT', col: window.COLOR_SERIES_CA },
        { label: 'Interventions effectuées HT', col: window.COLOR_SERIES_INT },
        { label: 'Devis émis HT', col: window.COLOR_SERIES_DEV_EMIS },
        { label: 'Devis acceptés HT', col: window.COLOR_SERIES_DEV_ACC },
      ];
      let curLegX = legX;
      series.forEach((s) => {
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(curLegX, y + 30, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = window.COLOR_TEXT_MUTED;
        ctx.font = '500 12.5px sans-serif';
        ctx.fillText(s.label, curLegX + 10, y + 34);
        curLegX += ctx.measureText(s.label).width + 24;
      });

      const padL = 80;
      const padR = 40;
      const padT = 70;
      const padB = 60;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const plotX = x + padL;
      const plotY = y + padT;

      const yTicks = [
        { val: '4,5 k€', yRel: 0.05 },
        { val: '3 k€', yRel: 0.35 },
        { val: '1,5 k€', yRel: 0.65 },
        { val: '0 €', yRel: 0.95 },
      ];

      ctx.save();
      ctx.strokeStyle = 'rgba(223, 232, 239, 0.7)';
      ctx.lineWidth = 1;
      ctx.fillStyle = window.COLOR_TEXT_MUTED;
      ctx.font = '12px sans-serif';

      yTicks.forEach((yt) => {
        const lineY = plotY + yt.yRel * plotH;
        ctx.beginPath(); ctx.moveTo(plotX, lineY); ctx.lineTo(plotX + plotW, lineY); ctx.stroke();
        ctx.fillText(yt.val, x + 25, lineY + 4);
      });

      const days = [
        'Di 18', 'Lu 19', 'Ma 20', 'Me 21', 'Je 22', 'Ve 23', 'Sa 24',
        'Di 25', 'Lu 26', 'Ma 27', 'Me 28', 'Je 29', 'Ve 30', 'Sa 31',
        'Di 01', 'Lu 02', 'Ma 03', 'Me 04', 'Je 05', 'Ve 06', 'Sa 07'
      ];
      const stepX = plotW / (days.length - 1);
      days.forEach((d, i) => {
        const dx = plotX + i * stepX;
        ctx.fillText(d, dx - 14, plotY + plotH + 24);
        ctx.beginPath(); ctx.moveTo(dx, plotY + plotH); ctx.lineTo(dx, plotY + plotH + 6); ctx.stroke();
      });

      const weekStarts = [0, 7, 14];
      const weekLabels = ['S42 • 18 oct. - 24 oct.', 'S43 • 25 oct. - 31 oct.', 'S44 • 01 nov. - 07 nov.'];
      weekStarts.forEach((ws, i) => {
        const wx = plotX + ws * stepX;
        const wEnd = plotX + Math.min(days.length - 1, ws + 6) * stepX;
        ctx.fillStyle = window.COLOR_TEXT_MUTED;
        ctx.font = '600 12px sans-serif';
        ctx.fillText(weekLabels[i], (wx + wEnd) / 2 - 60, plotY + plotH + 46);
      });

      if (highlightWeek) {
        const hx1 = plotX + 14 * stepX;
        const hw = 6 * stepX;
        ctx.fillStyle = 'rgba(35, 120, 181, 0.08)';
        ctx.fillRect(hx1 - 10, plotY, hw + 20, plotH);
        ctx.strokeStyle = 'rgba(35, 120, 181, 0.35)';
        ctx.strokeRect(hx1 - 10, plotY, hw + 20, plotH);
      }

      const dataSeries = [
        { color: window.COLOR_SERIES_CA, pts: [0.35, 0.42, 0.58, 0.72, 0.82, 0.64, 0.40, 0.45, 0.55, 0.68, 0.76, 0.62, 0.48, 0.38, 0.50, 0.60, 0.70, 0.78, 0.65, 0.52, 0.42] },
        { color: window.COLOR_SERIES_INT, pts: [0.28, 0.38, 0.65, 0.85, 0.90, 0.72, 0.48, 0.52, 0.62, 0.74, 0.84, 0.70, 0.54, 0.44, 0.58, 0.68, 0.80, 0.86, 0.72, 0.58, 0.46] },
        { color: window.COLOR_SERIES_DEV_EMIS, pts: [0.20, 0.30, 0.48, 0.60, 0.68, 0.55, 0.35, 0.38, 0.46, 0.58, 0.65, 0.52, 0.40, 0.32, 0.42, 0.52, 0.60, 0.66, 0.55, 0.44, 0.36] },
        { color: window.COLOR_SERIES_DEV_ACC, pts: [0.15, 0.22, 0.35, 0.48, 0.54, 0.42, 0.26, 0.30, 0.36, 0.44, 0.50, 0.40, 0.32, 0.24, 0.32, 0.40, 0.46, 0.52, 0.42, 0.34, 0.28] },
      ];

      dataSeries.forEach((s) => {
        const totalPts = s.pts.length;
        const visiblePtsCount = Math.floor(totalPts * progress);
        if (visiblePtsCount < 2) return;

        // Elevated drop shadow (+3px down, +2px right)
        ctx.save();
        ctx.strokeStyle = 'rgba(24, 50, 71, 0.16)';
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i <= visiblePtsCount; i++) {
          const ptIdx = Math.min(i, totalPts - 1);
          const px = plotX + ptIdx * stepX + 2;
          const py = plotY + (1 - s.pts[ptIdx]) * (plotH - 20) + 3;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // Crisp colored line
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.8;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i <= visiblePtsCount; i++) {
          const ptIdx = Math.min(i, totalPts - 1);
          const px = plotX + ptIdx * stepX;
          const py = plotY + (1 - s.pts[ptIdx]) * (plotH - 20);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

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
    };

    window.drawVolumesChart = (x, y, w, h, highlightWeek = false) => {
      const ctx = window.ctx;
      ctx.save();
      ctx.fillStyle = window.COLOR_CARD;
      ctx.shadowColor = 'rgba(24, 50, 71, 0.06)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      roundRect(ctx, x, y, w, h, 14);
      ctx.fill();
      ctx.strokeStyle = window.COLOR_BORDER;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 14);
      ctx.stroke();

      ctx.fillStyle = window.COLOR_TEXT_MAIN;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText("Nombre d'interventions et de devis par jour", x + 30, y + 32);

      ctx.fillStyle = window.COLOR_TEXT_MUTED;
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

      plotVolLine(vInt, window.COLOR_SERIES_INT);
      plotVolLine(vDev, window.COLOR_SERIES_DEV_EMIS);
      ctx.restore();
    };
  }, assets);

  // Now render each clip 1 to 18 (10 seconds each)
  const clipFiles = [];
  console.log('=== Step 3: Generating 18 Clips Sequentially ===');

  for (let c = 1; c <= 18; c++) {
    const clipName = `clip_${String(c).padStart(2, '0')}.mp4`;
    const clipMp4 = path.join(CLIPS_DIR, clipName);

    if (fs.existsSync(clipMp4) && fs.statSync(clipMp4).size > 100000) {
      console.log(`Clip ${c}/18 already exists (${(fs.statSync(clipMp4).size / 1024 / 1024).toFixed(2)} MB), skipping generation.`);
      clipFiles.push(clipMp4);
      continue;
    }

    console.log(`Rendering Clip ${c}/18 (10s)...`);
    const clipWebmB64 = await page.evaluate(async (clipIdx) => {
      const canvas = window.canvas;
      const ctx = window.ctx;
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 8000000 });
      const chunks = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const finished = new Promise(resolve => {
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        };
      });

      rec.start(250);
      const t0 = performance.now();
      const CLIP_DURATION = 10.0;
      const baseSec = (clipIdx - 1) * 10.0;

      function renderFrameAt(totalSec) {
        window.drawSkyIceBase();

        // ---------------- Clip 1 (0-10s) : Bureau & plans
        if (clipIdx === 1) {
          window.drawHeader('1. Le Quotidien du Bâtiment');
          window.drawDisclaimer();
          ctx.fillStyle = window.COLOR_CARD;
          window.roundRect(ctx, 360, 160, 1200, 680, 16);
          ctx.fill();
          ctx.strokeStyle = window.COLOR_BORDER;
          window.roundRect(ctx, 360, 160, 1200, 680, 16);
          ctx.stroke();

          ctx.fillStyle = '#EBF2F7';
          window.roundRect(ctx, 420, 220, 400, 540, 10);
          ctx.fill();
          ctx.fillStyle = window.COLOR_TEXT_MUTED;
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText('PLAN D’EXÉCUTION & CHANTIER', 450, 260);

          ctx.fillStyle = '#FFFFFF';
          window.roundRect(ctx, 860, 220, 640, 540, 10);
          ctx.fill();
          ctx.fillStyle = window.COLOR_TEXT_MAIN;
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText('DOSSIERS EN COURS • SUIVI D’EXPLOITATION', 900, 270);
          window.drawSubtitleBanner('Une activité. Plusieurs informations.');
        }

        // ---------------- Clip 2 (10-20s) : Planning & écran
        else if (clipIdx === 2) {
          window.drawHeader('1. Le Quotidien du Bâtiment');
          window.drawDisclaimer();
          ctx.fillStyle = window.COLOR_CARD;
          window.roundRect(ctx, 360, 160, 1200, 680, 16);
          ctx.fill();
          ctx.strokeStyle = window.COLOR_BORDER;
          window.roundRect(ctx, 360, 160, 1200, 680, 16);
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          window.roundRect(ctx, 420, 220, 1080, 540, 10);
          ctx.fill();
          ctx.fillStyle = window.COLOR_TEXT_MAIN;
          ctx.font = 'bold 22px sans-serif';
          ctx.fillText('PLANNING D’EXPLOITATION HEBDOMADAIRE (S42)', 460, 280);

          const days = ['Lundi 19', 'Mardi 20', 'Mercredi 21', 'Jeudi 22', 'Vendredi 23'];
          days.forEach((d, i) => {
            ctx.fillStyle = '#F8FAFC';
            window.roundRect(ctx, 460 + i * 200, 320, 185, 380, 8);
            ctx.fill();
            ctx.fillStyle = window.COLOR_SERIES_CA;
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(d, 475 + i * 200, 350);
          });
          window.drawSubtitleBanner('Devis • Interventions • Suivi');
        }

        // ---------------- Clip 3 (20-30s) : 3 fiches s'alignent
        else if (clipIdx === 3) {
          window.drawHeader('2. La Transition vers la Clarté');
          window.drawDisclaimer();
          const cardData = [
            { title: 'Devis', sub: 'Chiffrages & Engagements', col: window.COLOR_SERIES_DEV_EMIS, x: 300, y: 340 },
            { title: 'Interventions', sub: 'Missions Réalisées', col: window.COLOR_SERIES_INT, x: 760, y: 340 },
            { title: 'Facturation', sub: 'Suivi Financier', col: window.COLOR_SERIES_CA, x: 1220, y: 340 },
          ];
          cardData.forEach((cd) => {
            ctx.fillStyle = window.COLOR_CARD;
            window.roundRect(ctx, cd.x, cd.y, 400, 240, 16);
            ctx.fill();
            ctx.strokeStyle = cd.col;
            ctx.lineWidth = 2;
            window.roundRect(ctx, cd.x, cd.y, 400, 240, 16);
            ctx.stroke();
            ctx.fillStyle = cd.col;
            window.roundRect(ctx, cd.x, cd.y, 400, 8, 4);
            ctx.fill();
            ctx.fillStyle = window.COLOR_TEXT_MAIN;
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText(cd.title, cd.x + 36, cd.y + 80);
            ctx.fillStyle = window.COLOR_TEXT_MUTED;
            ctx.font = '16px sans-serif';
            ctx.fillText(cd.sub, cd.x + 36, cd.y + 125);
          });
          window.drawSubtitleBanner('Remettre les informations en perspective');
        }

        // ---------------- Clip 4 (30-40s) : Morph vers Suivi TCE
        else if (clipIdx === 4) {
          window.drawHeader('2. La Transition vers la Clarté');
          window.drawDisclaimer();
          window.drawKPICards(160, 110, 1600, 120);
          window.drawSkyIceChart(160, 260, 1600, 660, 0.4);
          window.drawSubtitleBanner('Une lecture plus claire.');
        }

        // ---------------- Clip 5 (40-50s) : KPI 1 & 2
        else if (clipIdx === 5) {
          window.drawHeader('3. Les Quatre Repères Métier');
          window.drawDisclaimer();
          window.drawKPICards(160, 130, 1600, 130, 0);
          window.drawSkyIceChart(160, 290, 1600, 640, 0.2);
          window.drawSubtitleBanner('CA facturé • Interventions effectuées');
        }

        // ---------------- Clip 6 (50-60s) : KPI 3 & 4
        else if (clipIdx === 6) {
          window.drawHeader('3. Les Quatre Repères Métier');
          window.drawDisclaimer();
          window.drawKPICards(160, 130, 1600, 130, 2);
          window.drawSkyIceChart(160, 290, 1600, 640, 0.2);
          window.drawSubtitleBanner('Devis émis • Devis acceptés');
        }

        // ---------------- Clip 7 (60-65s -> 70s) : 4 cartes stables
        else if (clipIdx === 7) {
          window.drawHeader('3. Les Quatre Repères Métier');
          window.drawDisclaimer();
          window.drawKPICards(160, 130, 1600, 130, -1);
          window.drawSkyIceChart(160, 290, 1600, 640, 0.25);
          window.drawSubtitleBanner('Devis. Réalisation. Facturation.');
        }

        // ---------------- Clip 8 (70-80s) : Tracé 4 courbes
        else if (clipIdx === 8) {
          window.drawHeader('4. Comprendre les Évolutions');
          window.drawDisclaimer();
          window.drawKPICards(160, 110, 1600, 120);
          const prog = 0.3 + (totalSec % 10.0) / 10.0 * 0.4;
          window.drawSkyIceChart(160, 260, 1600, 660, prog);
          window.drawSubtitleBanner('Voir les évolutions, pas seulement les totaux.');
        }

        // ---------------- Clip 9 (80-90s) : Variations réalistes
        else if (clipIdx === 9) {
          window.drawHeader('4. Comprendre les Évolutions');
          window.drawDisclaimer();
          window.drawKPICards(160, 110, 1600, 120);
          window.drawSkyIceChart(160, 260, 1600, 660, 0.85);
          window.drawSubtitleBanner('Observer les variations dans le temps');
        }

        // ---------------- Clip 10 (90-100s) : Comparer les périodes
        else if (clipIdx === 10) {
          window.drawHeader('4. Comprendre les Évolutions');
          window.drawDisclaimer();
          window.drawKPICards(160, 110, 1600, 120);
          window.drawSkyIceChart(160, 260, 1600, 660, 1.0);
          window.drawSubtitleBanner('Comparer les périodes');
        }

        // ---------------- Clip 11 (100-110s) : Jours & Semaines
        else if (clipIdx === 11) {
          window.drawHeader('5. La Précision des Jours et des Semaines');
          window.drawDisclaimer();
          window.drawKPICards(160, 110, 1600, 120);
          window.drawSkyIceChart(160, 260, 1600, 660, 1.0);
          window.drawSubtitleBanner('Du jour à la semaine.');
        }

        // ---------------- Clip 12 (110-120s) : Infobulle Jeudi 22
        else if (clipIdx === 12) {
          window.drawHeader('5. La Précision des Jours et des Semaines');
          window.drawDisclaimer();
          window.drawKPICards(160, 110, 1600, 120);
          window.drawSkyIceChart(160, 260, 1600, 660, 1.0);

          const tooltipX = 160 + 80 + 4 * (1480 / 20);
          const tooltipY = 260 + 70 + (1 - 0.90) * (530 - 20);
          ctx.save();
          ctx.strokeStyle = window.COLOR_SERIES_INT;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(tooltipX, 330); ctx.lineTo(tooltipX, 860); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#FFFFFF';
          window.roundRect(ctx, tooltipX - 110, tooltipY - 75, 220, 60, 10);
          ctx.fill();
          ctx.strokeStyle = window.COLOR_SERIES_INT;
          window.roundRect(ctx, tooltipX - 110, tooltipY - 75, 220, 60, 10);
          ctx.stroke();
          ctx.fillStyle = window.COLOR_TEXT_MUTED;
          ctx.font = '12px sans-serif';
          ctx.fillText('Jeudi 22 octobre 2026', tooltipX - 95, tooltipY - 54);
          ctx.fillStyle = window.COLOR_SERIES_INT;
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('Interventions : 4 250 € HT', tooltipX - 95, tooltipY - 30);
          ctx.restore();

          window.drawSubtitleBanner('Repères quotidiens & hebdomadaires');
        }

        // ---------------- Clip 13 (120-130s) : Montants & Volumes
        else if (clipIdx === 13) {
          window.drawHeader('6. Les Montants et les Volumes');
          window.drawDisclaimer();
          window.drawSkyIceChart(160, 100, 1600, 480, 1.0);
          window.drawVolumesChart(160, 610, 1600, 310);
          window.drawSubtitleBanner('Les montants et les volumes.');
        }

        // ---------------- Clip 14 (130-140s) : Sélection synchronisée
        else if (clipIdx === 14) {
          window.drawHeader('6. Les Montants et les Volumes');
          window.drawDisclaimer();
          window.drawSkyIceChart(160, 100, 1600, 480, 1.0, true);
          window.drawVolumesChart(160, 610, 1600, 310, true);
          window.drawSubtitleBanner('Deux lectures complémentaires.');
        }

        // ---------------- Clip 15 (140-150s) : Base précise
        else if (clipIdx === 15) {
          window.drawHeader('6. Les Montants et les Volumes');
          window.drawDisclaimer();
          window.drawSkyIceChart(160, 100, 1600, 480, 1.0);
          window.drawVolumesChart(160, 610, 1600, 310);
          window.drawSubtitleBanner('Une base d’analyse précise');
        }

        // ---------------- Clip 16 (150-160s) : Interface & Relief
        else if (clipIdx === 16) {
          window.drawHeader('7. Une Interface Épurée');
          window.drawDisclaimer();
          window.drawKPICards(160, 110, 1600, 120);
          window.drawSkyIceChart(160, 260, 1600, 660, 1.0);
          window.drawSubtitleBanner('Clair. Structuré. Lisible.');
        }

        // ---------------- Clip 17 (160-170s) : Vue Tablette
        else if (clipIdx === 17) {
          window.drawHeader('7. Une Interface Épurée');
          window.drawDisclaimer();
          const tabW = 1200;
          const tabH = 780;
          const tabX = (1920 - tabW) / 2;
          const tabY = 120;
          ctx.save();
          ctx.fillStyle = '#FFFFFF';
          window.roundRect(ctx, tabX, tabY, tabW, tabH, 20);
          ctx.fill();
          ctx.strokeStyle = window.COLOR_BORDER;
          window.roundRect(ctx, tabX, tabY, tabW, tabH, 20);
          ctx.stroke();

          ctx.fillStyle = '#F8FAFC';
          window.roundRect(ctx, tabX + 8, tabY + 8, tabW - 16, 44, 14);
          ctx.fill();
          ctx.fillStyle = window.COLOR_TEXT_MAIN;
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText('Suivi TCE • Vue Responsive Tablette', tabX + 30, tabY + 36);

          window.drawKPICards(tabX + 24, tabY + 70, tabW - 48, 95);
          window.drawSkyIceChart(tabX + 24, tabY + 185, tabW - 48, 550, 1.0);
          ctx.restore();
          window.drawSubtitleBanner('De la vue d’ensemble au détail utile.');
        }

        // ---------------- Clip 18 (170-180s) : Signature Suivi TCE
        else {
          window.drawSkyIceBase();
          ctx.save();
          ctx.textAlign = 'center';
          if (window.imgs.logo) {
            ctx.drawImage(window.imgs.logo, 960 - 65, 260, 130, 130);
          }
          ctx.fillStyle = window.COLOR_TEXT_MAIN;
          ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
          ctx.fillText('Suivi TCE', 960, 470);

          ctx.fillStyle = window.COLOR_SERIES_CA;
          ctx.font = '600 32px sans-serif';
          ctx.fillText('Du devis au suivi de votre activité.', 960, 540);

          ctx.fillStyle = window.COLOR_TEXT_MUTED;
          ctx.font = '500 24px sans-serif';
          ctx.fillText('Découvrez la solution', 960, 620);
          ctx.restore();

          window.drawSubtitleBanner('Suivi TCE. Du devis au suivi de votre activité.');
        }
      }

      return new Promise(resolve => {
        function tick(now) {
          const el = (now - t0) / 1000;
          if (el >= CLIP_DURATION) {
            rec.stop();
            return;
          }
          renderFrameAt(baseSec + el);
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        finished.then(resolve);
      });
    }, c);

    const tempWebm = path.join(CLIPS_DIR, `temp_${c}.webm`);

    fs.writeFileSync(tempWebm, Buffer.from(clipWebmB64, 'base64'));

    // Convert webm to pristine 1080p MP4
    execSync(`ffmpeg -y -i "${tempWebm}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p "${clipMp4}"`, { stdio: 'ignore' });
    try { fs.unlinkSync(tempWebm); } catch (e) {}

    clipFiles.push(clipMp4);
    console.log(`Saved: ${clipName} (${(fs.statSync(clipMp4).size / 1024 / 1024).toFixed(2)} MB)`);
  }

  await browser.close();

  console.log('=== Step 4: Concatenating 18 Clips with FFmpeg ===');
  const concatList = path.join(DOCS_DIR, 'concat_list.txt');
  const lines = clipFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatList, lines);

  const rawMasterMp4 = path.join(DOCS_DIR, 'raw_master_180s.mp4');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${rawMasterMp4}"`, { stdio: 'ignore' });
  console.log('Concatenated video created:', rawMasterMp4);

  console.log('=== Step 5: Muxing Master Audio (Voiceover + Sky & Ice Music) ===');
  const audioMasterMix = path.join(AUDIO_DIR, 'audio_master_mix_180s.wav');
  const finalFilm = path.join(DOCS_DIR, 'film_suivi_tce_180s.mp4');
  const artifactFilm = path.join(ARTIFACT_DIR, 'film_suivi_tce_180s.mp4');

  execSync(`ffmpeg -y -i "${rawMasterMp4}" -i "${audioMasterMix}" -c:v copy -c:a aac -b:a 192k -t 180.0 "${finalFilm}"`, { stdio: 'ignore' });
  console.log('FINAL FILM COMPLETE:', finalFilm, `(${(fs.statSync(finalFilm).size / 1024 / 1024).toFixed(2)} MB)`);

  // Copy to Artifact directory
  fs.copyFileSync(finalFilm, artifactFilm);
  console.log('Copied to artifact:', artifactFilm);

  // Copy to User Desktop & Downloads
  const userDesktop = 'C:\\Users\\Zeh\\OneDrive - office\\Bureau\\film_suivi_tce_180s.mp4';
  const userDownloads = 'C:\\Users\\Zeh\\Downloads\\film_suivi_tce_180s.mp4';
  try {
    fs.copyFileSync(finalFilm, userDesktop);
    console.log('Copied to Desktop:', userDesktop);
  } catch (e) {}
  try {
    fs.copyFileSync(finalFilm, userDownloads);
    console.log('Copied to Downloads:', userDownloads);
  } catch (e) {}

  // Reveal in Windows Explorer
  try {
    execSync(`explorer.exe /select,"${userDesktop}"`, { stdio: 'ignore' });
  } catch (e) {}

  // Cleanup concat files
  try { fs.unlinkSync(concatList); fs.unlinkSync(rawMasterMp4); } catch (e) {}

  console.log('ALL DONE! 18 individual clips + 180s master film ready on Desktop.');
}

runModularGenerator().catch(console.error);
