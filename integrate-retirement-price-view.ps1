$ErrorActionPreference = 'Stop'

$firePath = Join-Path (Get-Location) 'src\pages\Fire.tsx'
if (-not (Test-Path $firePath)) { throw "Missing file: $firePath" }

$source = [IO.File]::ReadAllText($firePath)
$backup = "$firePath.before-price-view-refinement"
[IO.File]::WriteAllText($backup, $source, (New-Object Text.UTF8Encoding($false)))

# Remove the large standalone summary and its component import.
$source = $source -replace "(?m)^import RetirementPriceSummary from '../components/RetirementPriceSummary'\r?\n", ''
$summaryPattern = '(?s)\r?\n\s*\{retirementPriceView && \(\s*<RetirementPriceSummary.*?</RetirementPriceSummary>\s*\)\}'
$source = [regex]::Replace($source, $summaryPattern, '')
$summaryPatternSelfClosing = '(?s)\r?\n\s*\{retirementPriceView && \(\s*<RetirementPriceSummary.*?/>\s*\)\}'
$source = [regex]::Replace($source, $summaryPatternSelfClosing, '')

function Add-SecondaryLine([string]$text, [string]$label, [string]$expression) {
    $pattern = '(?s)<Metric\s+label="' + [regex]::Escape($label) + '"(?<body>.*?)/>'
    $match = [regex]::Match($text, $pattern)
    if (-not $match.Success) { throw "Could not find Metric with label '$label'. Original file remains available at $backup" }
    if ($match.Value -match '\ssecondary=') { return $text }
    $replacement = $match.Value -replace '\s*/>$', "`r`n          secondary={$expression}`r`n        />"
    return $text.Substring(0, $match.Index) + $replacement + $text.Substring($match.Index + $match.Length)
}

# Add nominal values to existing KPI cards, without changing their primary real values.
$source = Add-SecondaryLine $source 'Rentový cíl' "`${retirementPriceView.fireTargetAtRetirementCzk.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč nominálně při zahájení`"
$source = Add-SecondaryLine $source 'Potřebný počáteční kapitál' "`${retirementPriceView.fireTargetAtRetirementCzk.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč nominálně při zahájení`"
$source = Add-SecondaryLine $source 'Požadovaná renta' "`${retirementPriceView.monthlyIncomeAtRetirementCzk.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč / měs. nominálně při zahájení`"

# Extend the local Metric component with a subtle second description line.
$signaturePattern = "(?s)function Metric\(\{\s*label,\s*value,\s*description,\s*\}: \{\s*label: string\s*value: string\s*description: string\s*\}\)"
if ($source -notmatch $signaturePattern) {
    throw "Could not find the expected Metric component signature. No modified Fire.tsx was written. Backup: $backup"
}
$source = [regex]::Replace($source, $signaturePattern, @'
function Metric({ label, value, description, secondary }: {
  label: string
  value: string
  description: string
  secondary?: string
})
'@, 1)

$descriptionPattern = '(?<line>\s*<div className="kpi-description">\{description\}</div>)'
if ($source -notmatch $descriptionPattern) {
    throw "Could not find Metric description rendering. No modified Fire.tsx was written. Backup: $backup"
}
$source = [regex]::Replace($source, $descriptionPattern, @'
${line}
      {secondary && (
        <div className="kpi-description" style={{ marginTop: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {secondary}
        </div>
      )}
'@, 1)

[IO.File]::WriteAllText($firePath, $source, (New-Object Text.UTF8Encoding($false)))

Write-Host ''
Write-Host 'Refinement completed.'
Write-Host "Updated: $firePath"
Write-Host "Backup:  $backup"
Write-Host ''
Write-Host 'Run:'
Write-Host '  npm run test'
Write-Host '  npm run build'
