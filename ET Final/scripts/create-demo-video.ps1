$ErrorActionPreference = "Stop"

$ffmpeg = "C:\Program Files\BlueStacks_nxt\ffmpeg.exe"
$root = Split-Path -Parent $PSScriptRoot
$frames = Join-Path $root "outputs\demo-frames"
$captionFrames = Join-Path $root "outputs\demo-caption-frames"
$audio = Join-Path $root "outputs\demo-audio"
$segments = Join-Path $root "outputs\demo-segments"
$output = Join-Path $root "outputs\epc-guardian-demo.mp4"

New-Item -ItemType Directory -Force -Path $segments | Out-Null
New-Item -ItemType Directory -Force -Path $captionFrames | Out-Null

Add-Type -AssemblyName System.Drawing

function New-CaptionFrame {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$CaptionPath,
        [Parameter(Mandatory = $true)][string]$Caption
    )

    $source = [System.Drawing.Image]::FromFile($SourcePath)
    $canvas = [System.Drawing.Bitmap]::new(1280, 720)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $scale = [Math]::Min(1280.0 / $source.Width, 720.0 / $source.Height)
    $width = [int][Math]::Round($source.Width * $scale)
    $height = [int][Math]::Round($source.Height * $scale)
    $x = [int][Math]::Round((1280 - $width) / 2.0)
    $y = [int][Math]::Round((720 - $height) / 2.0)
    $graphics.DrawImage($source, [System.Drawing.Rectangle]::new($x, $y, $width, $height))

    $captionHeight = 148
    $captionTop = 720 - $captionHeight
    $background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(238, 14, 30, 40))
    $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 35, 177, 159))
    $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $font = [System.Drawing.Font]::new("Segoe UI", 25, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Near
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $format.Trimming = [System.Drawing.StringTrimming]::Word

    $graphics.FillRectangle($background, 0, $captionTop, 1280, $captionHeight)
    $graphics.FillRectangle($accent, 0, $captionTop, 10, $captionHeight)
    $textBounds = [System.Drawing.RectangleF]::new(62, $captionTop + 12, 1152, $captionHeight - 24)
    $graphics.DrawString($Caption, $font, $textBrush, $textBounds, $format)
    $canvas.Save($CaptionPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)

    $format.Dispose()
    $font.Dispose()
    $textBrush.Dispose()
    $accent.Dispose()
    $background.Dispose()
    $graphics.Dispose()
    $canvas.Dispose()
    $source.Dispose()
}

$scenes = @(
    @{
        Name = "01-overview"
        Caption = "EPC Guardian is an evidence-to-action platform for data-centre construction. It reviews five equipment scenarios: three deviations require action, while two checks pass."
    },
    @{
        Name = "02-ask"
        Caption = "Engineers ask ordinary-language project questions. Answers show the supporting document, revision, page, section, and source text; hybrid retrieval uses keywords and embeddings."
    },
    @{
        Name = "03-compliance"
        Caption = "The UPS needs at least 96.5% efficiency, but the vendor proposes 95.2%. Deterministic engineering rules flag the deviation."
    },
    @{
        Name = "04-ai-agent"
        Caption = "The extraction agent identifies equipment, operator, required value, submitted value, and unit. AI structures fresh text; deterministic code makes the comparison."
    },
    @{
        Name = "05-schedule"
        Caption = "Reducing vendor response from seven days to three cuts combined critical-path exposure from 17 days to 9 days, with clear mitigation options."
    },
    @{
        Name = "06-commissioning"
        Caption = "Open UPS and CRAC deviations block related commissioning tests, while the compliant fire-suppression phase is ready. Controlled test records can be generated."
    },
    @{
        Name = "07-supply-chain"
        Caption = "Supply-chain intelligence compares delivery plans with required-on-site milestones, highlighting a UPS quality issue, generator delivery, and CRAC customs risk."
    },
    @{
        Name = "08-evidence-library"
        Caption = "The Evidence Library keeps document type, revision, index date, and readiness visible, creating a simple audit trail for every cited record."
    },
    @{
        Name = "09-rfi"
        Caption = "EPC Guardian drafts a cited corrective RFI but never sends it autonomously. A named engineer must review and approve the action."
    },
    @{
        Name = "10-validation"
        Caption = "The prototype has 14 of 14 correct citations and 22 passing automated tests across compliance, retrieval, extraction, schedule, commissioning, supply chain, and effort."
    },
    @{
        Name = "11-openai-ready"
        Caption = "Future scope: with an OpenAI API key, EPC Guardian can add LLM-grounded answers, structured JSON extraction, and embedding retrieval while keeping the evidence-first workflow."
    },
    @{
        Name = "12-production-scale"
        Caption = "Production rollout can connect EDMS document stores, Primavera P6 or MS Project schedules, QMS test packs, ERP logistics feeds, and geospatial delivery tracking."
    },
    @{
        Name = "13-closing"
        Caption = "At scale, every recommendation remains human-approved, citation-backed, and audit-logged. EPC Guardian becomes a controlled intelligence layer for EPC delivery."
    }
)

foreach ($scene in $scenes) {
    $name = $scene.Name
    $sourcePath = Join-Path $frames "$name.png"
    $imagePath = Join-Path $captionFrames "$name.jpg"
    $audioPath = Join-Path $audio "$name.wav"
    $segmentPath = Join-Path $segments "$name.mp4"

    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Missing screenshot for $name."
    }

    New-CaptionFrame -SourcePath $sourcePath -CaptionPath $imagePath -Caption $scene.Caption

    & $ffmpeg -y `
        -loop 1 -framerate 30 -i $imagePath `
        -i $audioPath `
        -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p" `
        -c:v libopenh264 -b:v 2500k `
        -c:a aac -b:a 160k `
        -shortest -movflags +faststart `
        $segmentPath

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create video segment $name."
    }
}

$names = $scenes | ForEach-Object { $_.Name }
$concatFile = Join-Path $segments "concat.txt"
$concatLines = $names | ForEach-Object {
    $segmentPath = (Join-Path $segments "$_.mp4").Replace("\", "/")
    "file '$segmentPath'"
}
Set-Content -LiteralPath $concatFile -Value $concatLines -Encoding Ascii

& $ffmpeg -y -f concat -safe 0 -i $concatFile -c copy -movflags +faststart $output

if ($LASTEXITCODE -ne 0) {
    throw "Failed to concatenate the demo video."
}

Write-Output $output
