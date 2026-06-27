$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Speech

$outputDirectory = Join-Path $PSScriptRoot "..\outputs\demo-audio"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$segments = @(
    @{
        Name = "01-overview"
        Text = "E P C Guardian is an evidence-to-action platform for data-centre construction. The dashboard reviews five equipment scenarios: three deviations require action, while two checks correctly pass."
    },
    @{
        Name = "02-ask"
        Text = "An engineer can ask project questions in ordinary language. The answer includes the supporting document, revision, page, section, and source text. With an A I key, retrieval combines keyword and embeddings; offline evidence still works."
    },
    @{
        Name = "03-compliance"
        Text = "The compliance view puts the specification beside the vendor submittal. Here, the U P S requires at least ninety-six point five percent efficiency but the proposed unit delivers ninety-five point two percent. Deterministic rules flag the deviation."
    },
    @{
        Name = "04-ai-agent"
        Text = "The extraction agent can analyse a new pair of texts. It identifies the equipment field, operator, required value, submitted value, and unit. A I extracts structure; normal code makes the engineering comparison."
    },
    @{
        Name = "05-schedule"
        Text = "The schedule view traces the effect along the critical path. Reducing vendor response from seven days to three lowers combined exposure from seventeen days to nine days, with visible mitigation options."
    },
    @{
        Name = "06-commissioning"
        Text = "Commissioning phases are protected by prerequisites. Open U P S and C R A C deviations block their related tests, while the compliant fire-suppression phase is ready. The system can create controlled test-record templates."
    },
    @{
        Name = "07-supply-chain"
        Text = "Supply-chain intelligence compares delivery plans to required-on-site milestones. It highlights the U P S quality issue, a near-term generator delivery, and customs risk for the C R A C units."
    },
    @{
        Name = "08-evidence-library"
        Text = "Every answer is traceable to an indexed project record. The Evidence Library keeps document type, revision, index date, and readiness visible for a simple audit trail."
    },
    @{
        Name = "09-rfi"
        Text = "E P C Guardian drafts a corrective R F I with specification, submittal, and schedule evidence. It does not send it autonomously. A named engineer reviews the action and the decision enters the audit trail."
    },
    @{
        Name = "10-validation"
        Text = "The prototype is measured, not merely demonstrated. It retrieves all fourteen labelled citations correctly and has twenty-two passing automated tests across compliance, search, extraction, schedule, commissioning, supply chain, and effort."
    },
    @{
        Name = "11-openai-ready"
        Text = "The current prototype is designed to work even without external credentials, but it is also ready for a stronger A I path. When an OpenAI API key is configured, EPC Guardian can use L L M grounded answers, structured JSON extraction, and embedding retrieval while keeping the same evidence-first user workflow."
    },
    @{
        Name = "12-production-scale"
        Text = "For production deployment, the next step is integration with real project systems. Document records can come from an E D M S, schedules from Primavera P 6 or Microsoft Project, commissioning records from Q M S tools, and supply-chain status from E R P, carrier, and geospatial feeds."
    },
    @{
        Name = "13-closing"
        Text = "The important design principle remains the same at every scale: A I assists, code verifies, and humans approve. With this approach, EPC Guardian can become a controlled intelligence layer that helps project teams detect deviations early, reduce coordination effort, and protect data-centre delivery timelines."
    }
)

foreach ($segment in $segments) {
    $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synthesizer.Rate = 0
    $synthesizer.Volume = 100
    $path = Join-Path $outputDirectory "$($segment.Name).wav"
    $synthesizer.SetOutputToWaveFile($path)
    $synthesizer.Speak($segment.Text)
    $synthesizer.Dispose()
}

Write-Output $outputDirectory
