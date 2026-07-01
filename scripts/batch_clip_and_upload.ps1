<#
.SYNOPSIS
    Batch-runs the single-property 3D pipeline (clip -> GLB -> S3) across
    every taxlot in highlands_matches.json.

.DESCRIPTION
    For each property:
      1. clip_parcel_textured.py  -> clipped.obj/.mtl/.jpg textures
      2. obj2gltf                 -> clipped.glb
      3. aws s3 cp                -> uploads to S3 under a per-taxlot path
    Continues past individual failures (same per-row error handling
    pattern as generateNadirAutoRun) and prints a summary at the end.
    Does ONE CloudFront invalidation at the end covering all uploaded
    paths, rather than one per property (invalidations are billed and
    rate-limited).

.PARAMETER MatchesFile
    Path to highlands_matches.json (has the taxlot list).

.PARAMETER ObjPath
    Path to the raw BlockR.obj source model.

.PARAMETER S3Bucket
    S3 bucket name (default: property-intel-tiles).

.PARAMETER S3Prefix
    S3 key prefix under which each taxlot gets its own folder
    (default: captures/plane/bend-5-21-26/parcels).

.PARAMETER CloudFrontDistId
    CloudFront distribution ID to invalidate after upload.

.EXAMPLE
    .\batch_clip_and_upload.ps1 `
        -MatchesFile "scripts\highlands_matches.json" `
        -ObjPath "C:\Users\Jonah Bourgeois\Downloads\Bend 5-21-26\models\pc\0\terra_obj\BlockR\BlockR.obj"
#>

param(
    [string]$MatchesFile = "scripts\highlands_matches.json",
    [string]$ObjPath = "C:\Users\Jonah Bourgeois\Downloads\Bend 5-21-26\models\pc\0\terra_obj\BlockR\BlockR.obj",
    [string]$ParcelsGeoJson = "data\parcels\bend-5-21-26-parcels.geojson",
    [string]$OutDir = "scripts\batch_output",
    [string]$S3Bucket = "property-intel-tiles",
    [string]$S3Prefix = "captures/plane/bend-5-21-26/parcels",
    [string]$CloudFrontDistId = "EQJBJ6X237VQF"
)

if (-not (Test-Path $MatchesFile)) {
    Write-Host "ERROR: matches file not found: $MatchesFile" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $ObjPath)) {
    Write-Host "ERROR: source OBJ not found: $ObjPath" -ForegroundColor Red
    exit 1
}

$matches = Get-Content $MatchesFile | ConvertFrom-Json
$total = $matches.Count
Write-Host "Loaded $total properties from $MatchesFile" -ForegroundColor Cyan

$succeeded = @()
$failed = @()
$i = 0

foreach ($prop in $matches) {
    $i++
    $taxlot = $prop.taxlot
    $name = $prop.name
    $propOutDir = Join-Path $OutDir $taxlot

    Write-Host "`n[$i/$total] $name ($taxlot)" -ForegroundColor Cyan

    try {
        # Step 1: clip
        Write-Host "  Clipping..." -ForegroundColor Gray
        python scripts\clip_parcel_textured.py "$ObjPath" "$ParcelsGeoJson" "$taxlot" "$propOutDir" 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) { throw "clip_parcel_textured.py exited $LASTEXITCODE" }

        $clippedObj = Join-Path $propOutDir "clipped.obj"
        if (-not (Test-Path $clippedObj)) { throw "clipped.obj was not produced" }

        # Step 2: convert to GLB
        Write-Host "  Converting to GLB..." -ForegroundColor Gray
        $clippedGlb = Join-Path $propOutDir "clipped.glb"
        obj2gltf -i "$clippedObj" -o "$clippedGlb" 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) { throw "obj2gltf exited $LASTEXITCODE" }
        if (-not (Test-Path $clippedGlb)) { throw "clipped.glb was not produced" }

        # Step 3: upload
        Write-Host "  Uploading to S3..." -ForegroundColor Gray
        $s3Key = "$S3Prefix/$taxlot/clipped.glb"
        aws s3 cp "$clippedGlb" "s3://$S3Bucket/$s3Key" 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) { throw "aws s3 cp exited $LASTEXITCODE" }

        $succeeded += [PSCustomObject]@{
            taxlot = $taxlot
            name = $name
            glb_url = "https://d3fg47bqswi0rr.cloudfront.net/$s3Key"
        }
        Write-Host "  OK" -ForegroundColor Green

    } catch {
        Write-Host "  FAILED: $_" -ForegroundColor Red
        $failed += [PSCustomObject]@{ taxlot = $taxlot; name = $name; error = "$_" }
        continue
    }
}

# One invalidation covering everything uploaded this run
if ($succeeded.Count -gt 0) {
    Write-Host "`nInvalidating CloudFront cache..." -ForegroundColor Cyan
    aws cloudfront create-invalidation --distribution-id $CloudFrontDistId --paths "/$S3Prefix/*"
}

# Write manifest of successful uploads — this feeds directly into
# capture_obliques.py's --model-url-template consumption pattern
$manifestPath = Join-Path $OutDir "glb_manifest.json"
$succeeded | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 $manifestPath

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Succeeded: $($succeeded.Count)/$total" -ForegroundColor Green
Write-Host "Failed:    $($failed.Count)/$total" -ForegroundColor $(if ($failed.Count -gt 0) { "Red" } else { "Green" })
if ($failed.Count -gt 0) {
    Write-Host "`nFailed properties:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  $($_.name) ($($_.taxlot)): $($_.error)" -ForegroundColor Red }
}
Write-Host "`nManifest written to: $manifestPath" -ForegroundColor Green
