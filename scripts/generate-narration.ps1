$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$inventoryNarrationRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../video'))
$inventoryNarrationOutput = Join-Path $inventoryNarrationRoot 'public/voiceover'
New-Item -ItemType Directory -Path $inventoryNarrationOutput -Force | Out-Null
$inventoryNarration = Get-Content -LiteralPath (Join-Path $inventoryNarrationRoot 'narration.json') -Raw -Encoding utf8 | ConvertFrom-Json
$inventorySpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $inventorySpeaker.SelectVoice('Microsoft Pattara')
  $inventorySpeaker.Rate = 0
  foreach ($inventoryScene in $inventoryNarration) {
    $inventoryAudioPath = Join-Path $inventoryNarrationOutput ('scene-' + $inventoryScene.step + '.wav')
    $inventorySpeaker.SetOutputToWaveFile($inventoryAudioPath)
    $inventorySpeaker.Speak($inventoryScene.text)
    $inventorySpeaker.SetOutputToNull()
    Write-Output $inventoryAudioPath
  }
} finally { $inventorySpeaker.Dispose() }
