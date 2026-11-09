Add-Type -AssemblyName System.Speech

$baseDir = "C:\Users\Zeh\suivi-tce-hostinger\docs\audio"

$chapters = @(
  @{
    Index = 1
    StartTime = 0.5
    Duration = 19.5
    Text = "Dans le bâtiment, chaque journée fait avancer plusieurs sujets à la fois. Des devis à suivre. Des interventions à organiser. Des informations à rapprocher. Et une activité qu'il faut garder en vue."
  },
  @{
    Index = 2
    StartTime = 20.5
    Duration = 19.5
    Text = "Quand ces informations sont dispersées, comprendre la situation demande de les remettre en perspective. Suivi té cé e propose une lecture structurée : distinguer les étapes, suivre les montants, et retrouver le fil de votre activité."
  },
  @{
    Index = 3
    StartTime = 40.5
    Duration = 24.5
    Text = "Les devis émis donnent une vue sur les propositions commerciales. Les devis acceptés indiquent les engagements retenus. Les interventions effectuées représentent l'activité réalisée. La facturation apporte une autre lecture, distincte de la réalisation et de l'encaissement."
  },
  @{
    Index = 4
    StartTime = 65.5
    Duration = 24.5
    Text = "Un total donne un repère. Une évolution raconte ce qui se passe dans le temps. En distinguant les séries, vous pouvez observer les variations, comparer les périodes et identifier les écarts qui méritent votre attention."
  },
  @{
    Index = 5
    StartTime = 90.5
    Duration = 24.5
    Text = "Le détail quotidien permet de situer une variation. Les repères hebdomadaires replacent cette variation dans une période. Une date, une semaine, une sélection : la présentation garde le même objectif, rendre les informations plus faciles à lire."
  },
  @{
    Index = 6
    StartTime = 115.5
    Duration = 24.5
    Text = "Les montants ne disent pas tout. Les volumes apportent un éclairage complémentaire. Combien d'interventions ont été effectuées ? Combien de devis ont été émis ? En regardant ces indicateurs ensemble, vous disposez d'une base plus précise pour examiner votre activité."
  },
  @{
    Index = 7
    StartTime = 140.5
    Duration = 19.5
    Text = "Une interface claire laisse la place à l'essentiel. Des couleurs constantes. Des périodes identifiables. Des indicateurs qui restent distincts. Et une présentation pensée pour passer de la vue d'ensemble au détail utile."
  },
  @{
    Index = 8
    StartTime = 160.5
    Duration = 19.5
    Text = "Votre activité ne se résume pas à un seul chiffre. Elle se construit à travers vos devis, vos interventions et leur suivi. Suivi té cé e. Du devis au suivi de votre activité. Découvrez une nouvelle façon de voir l'essentiel."
  }
)

Write-Host "Synthesizing chapter speech segments with Microsoft Paul..."
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Paul")
$synth.Rate = -1

foreach ($ch in $chapters) {
  $outWav = Join-Path $baseDir "voice_ch$($ch.Index).wav"
  $synth.SetOutputToWaveFile($outWav)
  $synth.Speak($ch.Text)
  Write-Host "Chapter $($ch.Index) synthesized: $outWav"
}
$synth.Dispose()

Write-Host "Assembling 180s master voice track with FFmpeg adelay filter..."

# Build FFmpeg complex filter to place each speech file at its exact millisecond offset
# 180s total duration at 44.1kHz stereo
$filterInputs = ""
$filterChains = ""
for ($i = 0; $i -lt $chapters.Count; $i++) {
  $ch = $chapters[$i]
  $delayMs = [int]($ch.StartTime * 1000)
  $filterInputs += "-i `"$baseDir\voice_ch$($ch.Index).wav`" "
  $filterChains += "[$i:a]adelay=$delayMs|$delayMs,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo[a$i]; "
}

$mixInputs = ""
for ($i = 0; $i -lt $chapters.Count; $i++) {
  $mixInputs += "[a$i]"
}
$filterChains += "$mixInputs amix=inputs=$($chapters.Count):dropout_transition=0:normalize=0,apad=whole_dur=180[outa]"

$cmd = "ffmpeg -y $filterInputs -filter_complex `"$filterChains`" -map `"[outa]`" -t 180 `"$baseDir\voiceover_180s_master.wav`""
Write-Host "Running FFmpeg voiceover assembly..."
Invoke-Expression $cmd

Write-Host "Master voiceover complete: $baseDir\voiceover_180s_master.wav"
