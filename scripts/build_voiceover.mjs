import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const AUDIO_DIR = 'C:\\Users\\Zeh\\suivi-tce-hostinger\\docs\\audio';

const chapters = [
  {
    idx: 1,
    start: 0.5,
    text: "Dans le bâtiment, chaque journée fait avancer plusieurs sujets à la fois. Des devis à suivre. Des interventions à organiser. Des informations à rapprocher. Et une activité qu'il faut garder en vue."
  },
  {
    idx: 2,
    start: 20.5,
    text: "Quand ces informations sont dispersées, comprendre la situation demande de les remettre en perspective. Suivi té cé e propose une lecture structurée : distinguer les étapes, suivre les montants, et retrouver le fil de votre activité."
  },
  {
    idx: 3,
    start: 40.5,
    text: "Les devis émis donnent une vue sur les propositions commerciales. Les devis acceptés indiquent les engagements retenus. Les interventions effectuées représentent l'activité réalisée. La facturation apporte une autre lecture, distincte de la réalisation et de l'encaissement."
  },
  {
    idx: 4,
    start: 65.5,
    text: "Un total donne un repère. Une évolution raconte ce qui se passe dans le temps. En distinguant les séries, vous pouvez observer les variations, comparer les périodes et identifier les écarts qui méritent votre attention."
  },
  {
    idx: 5,
    start: 90.5,
    text: "Le détail quotidien permet de situer une variation. Les repères hebdomadaires replacent cette variation dans une période. Une date, une semaine, une sélection : la présentation garde le même objectif, rendre les informations plus faciles à lire."
  },
  {
    idx: 6,
    start: 115.5,
    text: "Les montants ne disent pas tout. Les volumes apportent un éclairage complémentaire. Combien d'interventions ont été effectuées ? Combien de devis ont été émis ? En regardant ces indicateurs ensemble, vous disposez d'une base plus précise pour examiner votre activité."
  },
  {
    idx: 7,
    start: 140.5,
    text: "Une interface claire laisse la place à l'essentiel. Des couleurs constantes. Des périodes identifiables. Des indicateurs qui restent distincts. Et une présentation pensée pour passer de la vue d'ensemble au détail utile."
  },
  {
    idx: 8,
    start: 160.5,
    text: "Votre activité ne se résume pas à un seul chiffre. Elle se construit à travers vos devis, vos interventions et leur suivi. Suivi té cé e. Du devis au suivi de votre activité. Découvrez une nouvelle façon de voir l'essentiel."
  }
];

async function generateVoiceover() {
  console.log('--- [1/2] Generating chapter speech files via SAPI ---');

  for (const ch of chapters) {
    const outPath = path.join(AUDIO_DIR, `voice_ch${ch.idx}.wav`);
    // Escape text for powershell
    const safeText = ch.text.replace(/'/g, "''");
    const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -1
$v = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'fr' } | Select-Object -First 1
if ($v) { $synth.SelectVoice($v.VoiceInfo.Name) }
$synth.SetOutputToWaveFile('${outPath.replace(/\\/g, '\\\\')}')
$synth.Speak('${safeText}')
$synth.Dispose()
`;
    fs.writeFileSync(path.join(AUDIO_DIR, 'temp_speech.ps1'), psScript);
    execSync(`powershell -ExecutionPolicy Bypass -File "${path.join(AUDIO_DIR, 'temp_speech.ps1')}"`, { stdio: 'inherit' });
    console.log(`Generated: voice_ch${ch.idx}.wav`);
  }

  console.log('--- [2/2] Assembling 180s master voice track with FFmpeg ---');
  let filterInputs = '';
  let filterChains = '';
  let mixInputs = '';

  chapters.forEach((ch, i) => {
    const wavPath = path.join(AUDIO_DIR, `voice_ch${ch.idx}.wav`);
    filterInputs += `-i "${wavPath}" `;
    const delayMs = Math.round(ch.start * 1000);
    filterChains += `[${i}:a]adelay=${delayMs}|${delayMs},aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo[a${i}]; `;
    mixInputs += `[a${i}]`;
  });

  filterChains += `${mixInputs}amix=inputs=${chapters.length}:dropout_transition=0:normalize=0,apad=whole_dur=180[outa]`;

  const masterWav = path.join(AUDIO_DIR, 'voiceover_180s_master.wav');
  const ffmpegCmd = `ffmpeg -y ${filterInputs} -filter_complex "${filterChains}" -map "[outa]" -t 180 "${masterWav}"`;
  execSync(ffmpegCmd, { stdio: 'inherit' });

  console.log('SUCCESS! Master voice track generated:', masterWav);
}

generateVoiceover().catch(console.error);
