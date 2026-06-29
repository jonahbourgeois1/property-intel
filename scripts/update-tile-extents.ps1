# update-tile-extents.ps1
# Run once after uploading a new capture to S3
# Queries S3 for exact tile ranges and updates captures.json automatically

$capturesFile = "$PSScriptRoot\..\data\captures.json"
$data = Get-Content $capturesFile -Raw | ConvertFrom-Json

foreach ($cap in $data.captures) {
    Write-Host "Processing $($cap.id)..."
    $bucket = "property-intel-tiles"
    $prefix = "captures/plane/$($cap.id)/map"
    $extents = [ordered]@{}

    for ($z = $cap.tile_levels.min; $z -le $cap.tile_levels.max; $z++) {
        $xList = aws s3 ls "s3://$bucket/$prefix/$z/" | ForEach-Object {
            ($_ -split '\s+')[-1].TrimEnd('/')
        } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ } | Sort-Object

        if (-not $xList) { continue }
        $xMin = ($xList | Measure-Object -Minimum).Minimum
        $xMax = ($xList | Measure-Object -Maximum).Maximum

        $yAll = @()
        foreach ($x in $xList) {
            $yList = aws s3 ls "s3://$bucket/$prefix/$z/$x/" | ForEach-Object {
                (($_ -split '\s+')[-1]) -replace '\.png$',''
            } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ }
            $yAll += $yList
        }
        $yMin = ($yAll | Measure-Object -Minimum).Minimum
        $yMax = ($yAll | Measure-Object -Maximum).Maximum

        $extents["$z"] = [ordered]@{ x = @($xMin, $xMax); y = @($yMin, $yMax) }
        Write-Host "  z=$z  x=$xMin-$xMax  y=$yMin-$yMax"
    }

    if ($cap.PSObject.Properties['tile_extents']) {
        $cap.tile_extents = $extents
    } else {
        $cap | Add-Member -NotePropertyName tile_extents -NotePropertyValue $extents
    }
}

$data | ConvertTo-Json -Depth 10 | Set-Content $capturesFile -Encoding UTF8
Write-Host "Done - captures.json updated with exact tile extents"
