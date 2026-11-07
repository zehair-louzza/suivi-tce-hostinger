import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire('C:\\Users\\Zeh\\.gemini\\antigravity\\scratch\\package.json');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function generateCorporateMusic() {
  console.log('Generating high-end corporate soundtrack via Web Audio API...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const wavBase64 = await page.evaluate(async () => {
    const sampleRate = 44100;
    const duration = 44.0;
    const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    // Master bus
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, 0);
    // Smooth fade out at the end
    masterGain.gain.setValueAtTime(0.85, 41.5);
    masterGain.gain.linearRampToValueAtTime(0.001, 44.0);
    masterGain.connect(ctx.destination);

    // Compressor for polished broadcast sound
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, 0);
    compressor.knee.setValueAtTime(20, 0);
    compressor.ratio.setValueAtTime(4, 0);
    compressor.attack.setValueAtTime(0.005, 0);
    compressor.release.setValueAtTime(0.15, 0);
    compressor.connect(masterGain);

    // Tempo & timing
    const bpm = 120;
    const beatSec = 60 / bpm; // 0.5s per beat
    const barSec = beatSec * 4; // 2.0s per bar

    // Chord progression: Am9 -> Fmaj7 -> Cmaj7 -> Gsus4 (each chord 2 bars = 4.0s)
    // In terms of notes (frequencies):
    const chords = [
      // Am9: A2, E3, A3, C4, E4, B4
      [110, 164.81, 220, 261.63, 329.63, 493.88],
      // Fmaj7: F2, C3, F3, A3, C4, E4
      [87.31, 130.81, 174.61, 220, 261.63, 329.63],
      // Cmaj7: C2, G2, C3, E3, G3, B3
      [65.41, 98.00, 130.81, 164.81, 196.00, 246.94],
      // Gsus4 / G: G2, D3, G3, B3, D4, G4
      [98.00, 146.83, 196.00, 246.94, 293.66, 392.00]
    ];

    // Helper: synth pad chord
    function playPadChord(frequencies, startTime, durationSec) {
      frequencies.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc2.type = 'sine';
        osc.frequency.setValueAtTime(f, startTime);
        // Slight detune for warm chorus
        osc2.frequency.setValueAtTime(f * 1.003, startTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450 + idx * 80, startTime);
        filter.frequency.linearRampToValueAtTime(900 + idx * 100, startTime + durationSec * 0.5);
        filter.frequency.linearRampToValueAtTime(500, startTime + durationSec);

        const volume = 0.035 / Math.sqrt(frequencies.length);
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.6);
        gain.gain.setValueAtTime(volume, startTime + durationSec - 0.6);
        gain.gain.linearRampToValueAtTime(0.001, startTime + durationSec);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(compressor);

        osc.start(startTime);
        osc2.start(startTime);
        osc.stop(startTime + durationSec);
        osc2.stop(startTime + durationSec);
      });
    }

    // Play pad chords throughout the 44 seconds
    const totalBars = Math.ceil(duration / barSec);
    for (let bar = 0; bar < totalBars; bar += 2) {
      const chordIndex = (bar / 2) % chords.length;
      const t = bar * barSec;
      if (t < 40) {
        playPadChord(chords[chordIndex], t, barSec * 2);
      }
    }

    // Helper: Bass note
    function playBass(freq, startTime, dur) {
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      sub.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      sub.frequency.setValueAtTime(freq * 0.5, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);

      osc.start(startTime);
      sub.start(startTime);
      osc.stop(startTime + dur);
      sub.stop(startTime + dur);
    }

    // Play rhythmic bass (starts at bar 2 = 4.0s, ends at 40s)
    const bassRootNotes = [55, 43.65, 65.41, 49]; // A1, F1, C2, G1
    for (let t = 4.0; t < 40.0; t += beatSec) {
      const barNum = Math.floor(t / barSec);
      const chordIdx = Math.floor(barNum / 2) % bassRootNotes.length;
      const root = bassRootNotes[chordIdx];
      // 8th note rhythm pattern: hit on 0, 0.25, 0.5, 0.75
      playBass(root, t, 0.35);
      if (t + 0.25 < 40) {
        playBass(root * (t % 1 === 0 ? 1 : 1.5), t + 0.25, 0.2);
      }
    }

    // Helper: Synth Arpeggio Pluck
    function playPluck(freq, startTime) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, startTime);
      filter.frequency.exponentialRampToValueAtTime(300, startTime + 0.25);

      gain.gain.setValueAtTime(0.045, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    }

    // Arpeggio sequence (starts at 5.0s, builds corporate optimism)
    const arpPatterns = [
      [220, 329.63, 440, 523.25, 659.25, 523.25, 440, 329.63], // Am
      [174.61, 261.63, 349.23, 440, 523.25, 440, 349.23, 261.63], // F
      [196.00, 261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63], // C
      [196.00, 293.66, 392.00, 493.88, 587.33, 493.88, 392.00, 293.66] // G
    ];

    for (let t = 5.0; t < 39.5; t += 0.25) {
      const barNum = Math.floor(t / barSec);
      const chordIdx = Math.floor(barNum / 2) % arpPatterns.length;
      const step = Math.floor((t % 2.0) / 0.25);
      const freq = arpPatterns[chordIdx][step % 8];
      playPluck(freq, t);
    }

    // Helper: Punchy Kick Drum
    function playKick(startTime) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(140, startTime);
      osc.frequency.exponentialRampToValueAtTime(35, startTime + 0.08);

      gain.gain.setValueAtTime(0.65, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(compressor);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    }

    // Helper: Snare / Clap
    function playSnare(startTime) {
      // Noise buffer for snap
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);

      noise.start(startTime);
      noise.stop(startTime + 0.15);

      // Body tone
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.frequency.setValueAtTime(180, startTime);
      osc.frequency.exponentialRampToValueAtTime(80, startTime + 0.08);
      oscGain.gain.setValueAtTime(0.2, startTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);
      osc.connect(oscGain);
      oscGain.connect(compressor);
      osc.start(startTime);
      osc.stop(startTime + 0.1);
    }

    // Helper: Hi-Hat
    function playHiHat(startTime, open = false) {
      const bufferSize = ctx.sampleRate * (open ? 0.2 : 0.04);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(open ? 0.07 : 0.04, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + (open ? 0.18 : 0.035));

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);

      noise.start(startTime);
      noise.stop(startTime + (open ? 0.2 : 0.04));
    }

    // Drums timeline: starts at 5.0s, stops at 39.0s
    for (let t = 5.0; t < 39.0; t += beatSec) {
      const beatInBar = Math.round((t % barSec) / beatSec); // 0, 1, 2, 3

      // Kick on 0 and 2
      if (beatInBar === 0 || beatInBar === 2) {
        playKick(t);
      }
      // Snare on 1 and 3
      if (beatInBar === 1 || beatInBar === 3) {
        playSnare(t);
      }
      // Hi-hats every 8th note
      playHiHat(t, false);
      if (t + 0.25 < 39.0) {
        playHiHat(t + 0.25, beatInBar === 3 && (t % 1 === 0.75));
      }
    }

    // Helper: Transition Whoosh / Riser
    function playRiser(startTime, dur = 1.0) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, startTime);
      osc.frequency.exponentialRampToValueAtTime(1200, startTime + dur);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, startTime);
      filter.frequency.exponentialRampToValueAtTime(4000, startTime + dur);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.06, startTime + dur * 0.8);
      gain.gain.linearRampToValueAtTime(0.001, startTime + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);

      osc.start(startTime);
      osc.stop(startTime + dur);
    }

    // Transition risers before scene switches:
    // Scene switches at: ~5.0, 10.5, 16.0, 21.5, 27.5, 33.5, 38.5
    [4.2, 9.8, 15.2, 20.8, 26.8, 32.8, 37.8].forEach(t => playRiser(t, 0.8));

    // Grand Finale Bell / Shimmer Chime at 39.0s
    const bellFreqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    bellFreqs.forEach((bf, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(bf, 39.0 + idx * 0.08);

      gain.gain.setValueAtTime(0.08, 39.0 + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, 43.5);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(39.0 + idx * 0.08);
      osc.stop(44.0);
    });

    const renderedBuffer = await ctx.startRendering();

    // Convert AudioBuffer to WAV
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

    const wavArrayBuffer = bufferToWave(renderedBuffer, renderedBuffer.length);
    let binary = '';
    const bytes = new Uint8Array(wavArrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  });

  const buffer = Buffer.from(wavBase64, 'base64');
  const outPath = 'C:\\Users\\Zeh\\suivi-tce-hostinger\\docs\\soundtrack_anelec_tce.wav';
  fs.writeFileSync(outPath, buffer);
  console.log('Soundtrack generated successfully:', outPath, `(${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  await browser.close();
}

generateCorporateMusic().catch(console.error);
