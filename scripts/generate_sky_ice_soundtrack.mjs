import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire('C:\\Users\\Zeh\\.gemini\\antigravity\\scratch\\package.json');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const AUDIO_DIR = 'C:\\Users\\Zeh\\suivi-tce-hostinger\\docs\\audio';

async function generateSkyIceSoundtrack() {
  console.log('Generating 180s Sky & Ice soft corporate soundtrack via Web Audio API...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const wavBase64 = await page.evaluate(async () => {
    const sampleRate = 44100;
    const duration = 180.0; // 3 minutes
    const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    // Master bus with gentle fade out at the very end
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, 0);
    masterGain.gain.setValueAtTime(0.7, 175.0);
    masterGain.gain.linearRampToValueAtTime(0.001, 180.0);
    masterGain.connect(ctx.destination);

    // Smooth compressor for broadcast polish
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, 0);
    comp.knee.setValueAtTime(24, 0);
    comp.ratio.setValueAtTime(3.5, 0);
    comp.attack.setValueAtTime(0.01, 0);
    comp.release.setValueAtTime(0.2, 0);
    comp.connect(masterGain);

    // BPM & timing: 110 BPM (soft, calm, elegant)
    const bpm = 110;
    const beatSec = 60 / bpm; // ~0.545s
    const barSec = beatSec * 4; // ~2.18s

    // Chords: Dmaj7 -> Bm9 -> Gmaj7 -> Asus4/A (delicate, elegant, Sky & Ice mood)
    const chords = [
      // Dmaj7: D3 (146.83), A3 (220.00), C#4 (277.18), F#4 (369.99), A4 (440.00)
      [146.83, 220.00, 277.18, 369.99, 440.00],
      // Bm9: B2 (123.47), F#3 (185.00), B3 (246.94), D4 (293.66), C#5 (554.37)
      [123.47, 185.00, 246.94, 293.66, 554.37],
      // Gmaj7: G2 (98.00), D3 (146.83), G3 (196.00), B3 (246.94), F#4 (369.99)
      [98.00, 146.83, 196.00, 246.94, 369.99],
      // A: A2 (110.00), E3 (164.81), A3 (220.00), C#4 (277.18), E4 (329.63)
      [110.00, 164.81, 220.00, 277.18, 329.63]
    ];

    // Helper: Soft Warm Pad
    function playWarmPad(freqs, t, dur) {
      freqs.forEach((f, i) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(f, t);
        osc2.frequency.setValueAtTime(f * 1.002, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320 + i * 40, t);
        filter.frequency.linearRampToValueAtTime(550, t + dur * 0.5);
        filter.frequency.linearRampToValueAtTime(350, t + dur);

        const vol = 0.025 / Math.sqrt(freqs.length);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(vol, t + 1.0);
        gain.gain.setValueAtTime(vol, t + dur - 1.0);
        gain.gain.linearRampToValueAtTime(0.001, t + dur);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(comp);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + dur);
        osc2.stop(t + dur);
      });
    }

    // Helper: Rhodes / Piano Tone
    function playRhodesTone(freq, t) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(200, t + 1.2);

      gain.gain.setValueAtTime(0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(comp);

      osc.start(t);
      osc.stop(t + 1.2);
    }

    // Helper: Soft Kick
    function playSoftKick(t) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(95, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.1);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(comp);

      osc.start(t);
      osc.stop(t + 0.25);
    }

    // Helper: Soft Shaker
    function playShaker(t) {
      const bufSize = ctx.sampleRate * 0.04;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(6000, t);
      filter.Q.setValueAtTime(2, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(comp);

      noise.start(t);
      noise.stop(t + 0.04);
    }

    // Sequence Pad Chords (every 2 bars = 4.36s)
    const totalBars = Math.ceil(duration / barSec);
    for (let bar = 0; bar < totalBars; bar += 2) {
      const chordIdx = (bar / 2) % chords.length;
      const t = bar * barSec;
      if (t < 174) {
        playWarmPad(chords[chordIdx], t, barSec * 2);
      }
    }

    // Sequence Rhodes / Pluck notes (delicate melodic arpeggio)
    const arpNotes = [
      [293.66, 369.99, 440.00, 554.37],
      [246.94, 293.66, 369.99, 440.00],
      [196.00, 246.94, 293.66, 369.99],
      [220.00, 277.18, 329.63, 440.00]
    ];
    for (let t = 4.0; t < 172.0; t += beatSec) {
      const barNum = Math.floor(t / barSec);
      const chordIdx = Math.floor(barNum / 2) % arpNotes.length;
      const beatInBar = Math.floor((t % barSec) / beatSec);
      const note = arpNotes[chordIdx][beatInBar % 4];
      playRhodesTone(note, t);
    }

    // Sequence gentle percussion (starts gently at 10s, stops at 170s)
    for (let t = 10.0; t < 170.0; t += beatSec) {
      const beatInBar = Math.round((t % barSec) / beatSec);
      // Soft kick on 1 and 3
      if (beatInBar === 0 || beatInBar === 2) {
        playSoftKick(t);
      }
      // Gentle shaker every 8th note
      playShaker(t);
      if (t + beatSec / 2 < 170.0) {
        playShaker(t + beatSec / 2);
      }
    }

    // Final Harmonic Chime at 174s (Chapter 8 Conclusion)
    const finaleBell = [587.33, 739.99, 880.00, 1174.66];
    finaleBell.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, 174.0 + idx * 0.1);
      gain.gain.setValueAtTime(0.06, 174.0 + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, 179.5);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(174.0 + idx * 0.1);
      osc.stop(180.0);
    });

    const rendered = await ctx.startRendering();

    // Convert to 16-bit WAV
    function bufferToWave(abuffer, len) {
      let numOfChan = abuffer.numberOfChannels,
          length = len * numOfChan * 2 + 44,
          out = new DataView(new ArrayBuffer(length)),
          channels = [], i, sample,
          offset = 0,
          pos = 0;

      function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
      function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

      setUint32(0x46464952); // "RIFF"
      setUint32(length - 8);
      setUint32(0x45564157); // "WAVE"
      setUint32(0x20746d66); // "fmt "
      setUint32(16);
      setUint16(1); // PCM
      setUint16(numOfChan);
      setUint32(abuffer.sampleRate);
      setUint32(abuffer.sampleRate * 2 * numOfChan);
      setUint16(numOfChan * 2);
      setUint16(16);
      setUint32(0x61746164); // "data"
      setUint32(length - pos - 4);

      for(i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

      while(pos < length) {
        for(i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
          out.setInt16(pos, sample, true);
          pos += 2;
        }
        offset++;
      }
      return out.buffer;
    }

    const wavBuf = bufferToWave(rendered, rendered.length);
    let binary = '';
    const bytes = new Uint8Array(wavBuf);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  });

  const buffer = Buffer.from(wavBase64, 'base64');
  const outPath = path.join(AUDIO_DIR, 'soundtrack_sky_ice_180s.wav');
  fs.writeFileSync(outPath, buffer);
  console.log('SUCCESS! 180s Sky & Ice soundtrack generated:', outPath, `(${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  await browser.close();
}

generateSkyIceSoundtrack().catch(console.error);
