$root = Get-Location
$output = Join-Path $root "FIRE_SOURCE_BUNDLE.md"

"# FIRE Wealth Manager - Source Bundle`n" | Set-Content $output -Encoding utf8

$files = Get-ChildItem -Recurse -File |
    Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\dist\\' -and
        $_.FullName -notmatch '\\\.git\\' -and
        $_.Name -notin @(
            '.env',
            '.env.local',
            'FIRE_SOURCE_BUNDLE.md'
        ) -and
        $_.Extension -in @(
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.sql',
            '.json',
            '.md',
            '.css',
            '.html'
        )
    } |
    Sort-Object FullName

foreach ($file in $files) {
    $relative = $file.FullName.Substring($root.Path.Length + 1)

    Add-Content $output ""
    Add-Content $output "---"
    Add-Content $output ""
    Add-Content $output "## FILE: $relative"
    Add-Content $output ""
    Add-Content $output '```'
    Get-Content $file.FullName -Raw | Add-Content $output
    Add-Content $output '```'
}

Write-Host ""
Write-Host "Bundle created successfully."
Write-Host "File: $output"
Write-Host "Source files: $($files.Count)"

Get-Item $output | Select-Object Name, Length, LastWriteTime