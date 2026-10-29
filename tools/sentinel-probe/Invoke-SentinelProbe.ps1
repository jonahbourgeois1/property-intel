# Invoke-SentinelProbe.ps1
# Local stand-in for the call chekt-viewer-gateway will make to Sentinel.
# The partner key stays in this process. Later it stays in the Lambda
# environment, the same way the CHEKT dealer key does. The browser never
# sees it. Do not put the key in this file, in git, or in a Pages JSON.
#
# Paste the key into YOUR shell, then run a step:
#
#   $env:SENTINEL_PARTNER_KEY = '<paste>'
#   .\tools\sentinel-probe\Invoke-SentinelProbe.ps1 -Step sites
#   .\tools\sentinel-probe\Invoke-SentinelProbe.ps1 -Step bridges -SiteId <32 hex>
#   .\tools\sentinel-probe\Invoke-SentinelProbe.ps1 -Step cameras -SiteId <32 hex>
#   .\tools\sentinel-probe\Invoke-SentinelProbe.ps1 -Step snapshot -CameraId <32 hex>
#   .\tools\sentinel-probe\Invoke-SentinelProbe.ps1 -Step live -SiteId <32 hex> -CameraId <32 hex> -SaveJpeg
#
# sites, bridges, and cameras do not start a camera upload.
# snapshot does not start one either. A miss means no fresh frame is buffered.
# live opens ONE camera, then DELETEs the session before exit. Opening that
# session still makes the bridge upload every camera configured on it.
# If the live POST times out, do not run it again. A session may already exist.
# Demand dies 150 seconds after the last touch.
#
# Optional: $env:SENTINEL_BASE_URL (default https://sentinel.vyanet.com)
# -ShowUrls prints bearer media URLs to this console only. Do not paste them
# into chat, tickets, or git. -WaitSeconds holds the session so a player can
# open one. The script still deletes the session when the wait ends.
#
# Lists are written under _scratch\sentinel-probe\ with the url fields left
# out. That folder is gitignored. A JPEG from -SaveJpeg lands there too.

[CmdletBinding()]
param(
    [ValidateSet("sites", "bridges", "cameras", "snapshot", "live")]
    [string]$Step = "sites",

    [string]$SiteId = "",

    [string]$CameraId = "",

    [ValidateRange(1, 200)]
    [int]$Limit = 100,

    [switch]$ShowUrls,

    [switch]$SaveJpeg,

    [ValidateRange(0, 140)]
    [int]$WaitSeconds = 0
)

$ErrorActionPreference = "Stop"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$Base = if ($env:SENTINEL_BASE_URL) { $env:SENTINEL_BASE_URL.Trim().TrimEnd("/") } else { "https://sentinel.vyanet.com" }
$Key = if ($env:SENTINEL_PARTNER_KEY) { $env:SENTINEL_PARTNER_KEY.Trim() } else { "" }
if (-not $Key) {
    throw "SENTINEL_PARTNER_KEY is empty. In this shell: `$env:SENTINEL_PARTNER_KEY = '<paste>'"
}
if ($Key -notmatch "^spk_") {
    throw "SENTINEL_PARTNER_KEY does not start with spk_. The partner key is a bearer token, not a passcode."
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$OutRoot = Join-Path $repo "_scratch\sentinel-probe"
New-Item -ItemType Directory -Force -Path $OutRoot | Out-Null
$Ua = "property-intel-sentinel-probe/1"

function Test-OpaqueId([string]$Value, [string]$Label) {
    if ($Value -notmatch "^[a-f0-9]{32}$") {
        throw ($Label + " must be 32 lowercase hex characters. Got length " + $Value.Length + ".")
    }
}

function Get-Header([System.Net.WebResponse]$Response, [string]$Name) {
    if (-not $Response) { return "" }
    $value = $Response.Headers[$Name]
    if ($null -eq $value) { return "" }
    return [string]$value
}

function Invoke-Sentinel {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("GET", "POST", "DELETE")]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Path,

        [string]$JsonBody = "",

        [string]$Accept = "application/json",

        [int]$TimeoutSec = 20
    )

    $uri = $Base + $Path
    $req = [System.Net.HttpWebRequest]::Create($uri)
    $req.Method = $Method
    $req.UserAgent = $Ua
    $req.Accept = $Accept
    $req.Timeout = $TimeoutSec * 1000
    $req.ReadWriteTimeout = $TimeoutSec * 1000
    $req.AllowAutoRedirect = $true
    $req.Headers.Add([System.Net.HttpRequestHeader]::Authorization, "Bearer " + $Key)

    if ($JsonBody -ne "") {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($JsonBody)
        $req.ContentType = "application/json"
        $req.ContentLength = $bytes.Length
        $stream = $req.GetRequestStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Close()
    }

    $resp = $null
    $threw = $false
    try {
        $resp = $req.GetResponse()
    } catch [System.Net.WebException] {
        $threw = $true
        $resp = $_.Exception.Response
        if (-not $resp) {
            if ($_.Exception.Status -eq [System.Net.WebExceptionStatus]::Timeout -and $Method -eq "POST" -and $Path -match "live-sessions") {
                throw "Live session POST timed out. Do not run -Step live again. A session may already be open. Demand dies 150 seconds after the last touch."
            }
            throw
        }
    }

    $code = [int]$resp.StatusCode
    $ms = New-Object System.IO.MemoryStream
    $bodyStream = $resp.GetResponseStream()
    if ($bodyStream) { $bodyStream.CopyTo($ms) }
    $raw = $ms.ToArray()
    $contentType = ""
    try { $contentType = [string]$resp.ContentType } catch { }
    $version = Get-Header $resp "X-Sentinel-Version"
    $requestId = Get-Header $resp "X-Request-Id"
    $retryAfter = Get-Header $resp "Retry-After"
    $capturedAt = Get-Header $resp "X-Snapshot-Captured-At"
    $mediaAge = Get-Header $resp "X-Media-Age-Seconds"
    $resp.Close()

    $json = $null
    $text = ""
    if ($raw.Length -gt 0 -and $contentType -match "json") {
        $text = [System.Text.Encoding]::UTF8.GetString($raw)
        try { $json = $text | ConvertFrom-Json } catch { $json = $null }
    }

    return @{
        Status = $code
        Bytes = $raw
        Json = $json
        Text = $text
        ContentType = $contentType
        Version = $version
        RequestId = $requestId
        RetryAfter = $retryAfter
        CapturedAt = $capturedAt
        MediaAge = $mediaAge
        Threw = $threw
    }
}

function Write-CallLine([hashtable]$Result, [string]$What) {
    $ver = if ($Result.Version) { $Result.Version } else { "?" }
    $rid = if ($Result.RequestId) { $Result.RequestId } else { "-" }
    Write-Host ($What + "  HTTP " + $Result.Status + "  Sentinel " + $ver + "  request " + $rid)
}

function Get-ErrorText([hashtable]$Result) {
    if ($Result.Json -and $Result.Json.error) {
        $err = $Result.Json.error
        $line = [string]$err.code + ": " + [string]$err.message
        if ($Result.RetryAfter) { $line += "  Retry-After " + $Result.RetryAfter }
        return $line
    }
    if ($Result.RetryAfter) { return "HTTP " + $Result.Status + "  Retry-After " + $Result.RetryAfter }
    return "HTTP " + $Result.Status
}

function Assert-Ok([hashtable]$Result, [int[]]$Ok) {
    Write-CallLine $Result "sentinel"
    if ($Ok -contains $Result.Status) { return }
    $detail = Get-ErrorText $Result
    if ($Result.Status -eq 401) { throw ("Key rejected. " + $detail) }
    if ($Result.Status -eq 403) { throw ("Forbidden. A 403 can be a missing scope OR pi_update_required. " + $detail) }
    if ($Result.Status -eq 404) { throw ("Not found. An unknown site and a site this key was not granted look the same. " + $detail) }
    if ($Result.Status -eq 429) { throw ("Rate limited. Do not retry a live-session POST. " + $detail) }
    throw $detail
}

function Get-AllPages([string]$Path, [string]$ListKey) {
    $cursor = ""
    $items = New-Object System.Collections.Generic.List[object]
    $last = $null
    for ($page = 1; $page -le 50; $page++) {
        $q = "?limit=" + $Limit
        if ($cursor) { $q += "&cursor=" + [Uri]::EscapeDataString($cursor) }
        $result = Invoke-Sentinel -Method GET -Path ($Path + $q)
        Assert-Ok $result @(200)
        $last = $result
        $chunk = @()
        if ($result.Json -and $result.Json.PSObject.Properties.Name -contains $ListKey) {
            $chunk = @($result.Json.$ListKey)
        }
        foreach ($row in $chunk) { if ($null -ne $row) { $items.Add($row) } }
        $cursor = ""
        if ($result.Json -and $result.Json.next_cursor) { $cursor = [string]$result.Json.next_cursor }
        if (-not $cursor) { break }
    }
    if ($cursor) { throw "Stopped after 50 pages. next_cursor was still set." }
    return @{ Items = $items; Last = $last }
}

function Save-Json([string]$Name, $Object) {
    $path = Join-Path $OutRoot $Name
    $json = ConvertTo-Json -InputObject $Object -Depth 8
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($path, $json, $utf8)
    Write-Host ("Wrote " + $path)
}

function Get-VideoText($Camera) {
    if (-not $Camera.video) { return "" }
    $v = $Camera.video
    $parts = @()
    if ($v.codec) { $parts += [string]$v.codec }
    if ($v.width -and $v.height) { $parts += ([string]$v.width + "x" + [string]$v.height) }
    if ($v.fps) { $parts += ([string]$v.fps + "fps") }
    return ($parts -join " ")
}

if ($Step -eq "sites") {
    $page = Get-AllPages -Path "/partner/v1/sites" -ListKey "sites"
    $rows = @($page.Items | ForEach-Object {
        [pscustomobject]@{
            site_id = $_.site_id
            name = $_.name
            account_number = $_.account_number
            cameras = ([string]$_.cameras_online + "/" + [string]$_.cameras_total)
            bridges = ([string]$_.bridges_online + "/" + [string]$_.bridges_total)
        }
    })
    if ($rows.Count -eq 0) {
        Write-Host "No sites. The key authenticated, and it has no site grants."
    } else {
        $rows | Format-Table -AutoSize | Out-String | Write-Host
    }
    $save = @($page.Items | ForEach-Object {
        [pscustomobject]@{
            site_id = $_.site_id
            name = $_.name
            account_number = $_.account_number
            cameras_total = $_.cameras_total
            cameras_online = $_.cameras_online
            bridges_total = $_.bridges_total
            bridges_online = $_.bridges_online
        }
    })
    Save-Json "sites.json" $save
    return
}

if ($Step -eq "bridges") {
    Test-OpaqueId $SiteId "SiteId"
    $page = Get-AllPages -Path ("/partner/v1/sites/" + $SiteId + "/bridges") -ListKey "bridges"
    $evaluated = ""
    $offlineAfter = ""
    if ($page.Last -and $page.Last.Json) {
        $evaluated = [string]$page.Last.Json.evaluated_at
        $offlineAfter = [string]$page.Last.Json.offline_after_seconds
    }
    Write-Host ("evaluated_at " + $evaluated + "  offline_after_seconds " + $offlineAfter)
    $rows = @($page.Items | ForEach-Object {
        [pscustomobject]@{
            bridge_id = $_.bridge_id
            name = $_.name
            connection = $_.connection_status
            age_s = $_.heartbeat_age_seconds
            eligibility = $_.video_eligibility
            reason = $_.video_eligibility_reason
        }
    })
    if ($rows.Count -eq 0) { Write-Host "No bridges on this site." } else { $rows | Format-Table -AutoSize | Out-String | Write-Host }
    Write-Host "eligibility is heartbeat and Pi-version policy. It does not mean a picture is buffered."
    $save = @($page.Items | ForEach-Object {
        [pscustomobject]@{
            bridge_id = $_.bridge_id
            name = $_.name
            connection_status = $_.connection_status
            last_seen = $_.last_seen
            heartbeat_age_seconds = $_.heartbeat_age_seconds
            video_eligibility = $_.video_eligibility
            video_eligibility_reason = $_.video_eligibility_reason
        }
    })
    Save-Json "bridges-$SiteId.json" ([pscustomobject]@{
        site_id = $SiteId
        evaluated_at = $evaluated
        offline_after_seconds = $offlineAfter
        bridges = $save
    })
    return
}

if ($Step -eq "cameras") {
    Test-OpaqueId $SiteId "SiteId"
    $result = Invoke-Sentinel -Method GET -Path ("/partner/v1/sites/" + $SiteId + "/cameras")
    Assert-Ok $result @(200)
    $cams = @()
    if ($result.Json -and $result.Json.cameras) { $cams = @($result.Json.cameras) }
    $rows = @($cams | ForEach-Object {
        [pscustomobject]@{
            camera_id = $_.camera_id
            name = $_.name
            status = $_.status
            stream_state = $_.stream_state
            bridge_id = $_.bridge_id
            slot = $_.slot
            revision = $_.source_revision
            video = (Get-VideoText $_)
        }
    })
    if ($rows.Count -eq 0) { Write-Host "No cameras on this site." } else { $rows | Format-Table -AutoSize | Out-String | Write-Host }
    Write-Host "This list has no playable URL. Video starts at -Step live."
    $save = @($cams | ForEach-Object {
        [pscustomobject]@{
            camera_id = $_.camera_id
            name = $_.name
            bridge_id = $_.bridge_id
            slot = $_.slot
            source_revision = $_.source_revision
            status = $_.status
            stream_state = $_.stream_state
            bridge_online = $_.bridge_online
            observed_at = $_.observed_at
            media_age_seconds = $_.media_age_seconds
            video = (Get-VideoText $_)
        }
    })
    Save-Json "cameras-$SiteId.json" ([pscustomobject]@{ site_id = $SiteId; cameras = $save })
    return
}

if ($Step -eq "snapshot") {
    Test-OpaqueId $CameraId "CameraId"
    $result = Invoke-Sentinel -Method GET -Path ("/partner/v1/cameras/" + $CameraId + "/snapshot") -Accept "image/jpeg" -TimeoutSec 15
    Write-CallLine $result "snapshot"
    if ($result.Status -eq 200 -and $result.ContentType -match "jpeg") {
        $path = Join-Path $OutRoot ($CameraId + ".jpg")
        [System.IO.File]::WriteAllBytes($path, $result.Bytes)
        Write-Host ("JPEG " + $result.Bytes.Length + " bytes  captured " + $result.CapturedAt + "  age " + $result.MediaAge + "s")
        Write-Host ("Wrote " + $path)
        Save-Json ($CameraId + ".snapshot.json") ([pscustomobject]@{
            camera_id = $CameraId
            http_status = 200
            bytes = $result.Bytes.Length
            captured_at = $result.CapturedAt
            media_age_seconds = $result.MediaAge
        })
        return
    }
    Write-Host ("No JPEG. " + (Get-ErrorText $result))
    Write-Host "A snapshot does not wake the camera. Open -Step live -SaveJpeg if nothing is buffered."
    return
}

if ($Step -eq "live") {
    Test-OpaqueId $SiteId "SiteId"
    Test-OpaqueId $CameraId "CameraId"
    $hold = $WaitSeconds
    if ($SaveJpeg -and $hold -lt 8) { $hold = 8 }

    $body = '{"camera_ids":["' + $CameraId + '"]}'
    $opened = Invoke-Sentinel -Method POST -Path ("/partner/v1/sites/" + $SiteId + "/live-sessions") -JsonBody $body -TimeoutSec 25
    Assert-Ok $opened @(201)
    $session = $opened.Json
    if (-not $session -or -not $session.session_id) { throw "Session response had no session_id. Not retrying." }
    $sessionId = [string]$session.session_id
    if ($sessionId -notmatch "^[a-f0-9]{32}$") {
        throw "Session id was not 32 hex. Not closing and not retrying. Wait 150 seconds before another live open."
    }
    Write-Host ("session_id " + $sessionId)
    Write-Host ("expires_at " + [string]$session.expires_at + "  idle_timeout_seconds " + [string]$session.idle_timeout_seconds + "  media_engine " + [string]$session.media_engine)
    if ($session.capabilities) {
        $cap = $session.capabilities
        Write-Host ("capabilities recording=" + [string]$cap.recording + " events=" + [string]$cap.events + " webhooks=" + [string]$cap.webhooks + " pre_event=" + [string]$cap.pre_event)
    }

    $streams = @()
    if ($session.streams) { $streams = @($session.streams) }
    foreach ($stream in $streams) {
        Write-Host ("stream camera " + [string]$stream.camera_id + "  state " + [string]$stream.state + "  revision " + [string]$stream.source_revision + "  hls " + [bool]$stream.hls_url + "  snapshot " + [bool]$stream.snapshot_url)
    }
    if ($ShowUrls) {
        Write-Host "WARNING: bearer media URLs follow. Do not paste them into chat, tickets, or git."
        foreach ($stream in $streams) {
            Write-Host ("hls_url " + [string]$stream.hls_url)
            if ($stream.snapshot_url) { Write-Host ("snapshot_url " + [string]$stream.snapshot_url) }
        }
    }

    try {
        $touch = [string]$session.touch_url
        $touchUri = $null
        $baseUri = [Uri]$Base
        try { $touchUri = [Uri]$touch } catch { $touchUri = $null }
        $touchOk = $touchUri -and $touchUri.Scheme -eq "https" -and $touchUri.Host -eq $baseUri.Host
        if ($hold -gt 0 -and -not $touchOk) {
            Write-Host "No touch URL on the Sentinel host. Closing without waiting."
            $hold = 0
        }
        $deadline = (Get-Date).AddSeconds($hold)
        $nextTouch = Get-Date
        while ((Get-Date) -lt $deadline) {
            if ((Get-Date) -ge $nextTouch) {
                $touchReq = [System.Net.HttpWebRequest]::Create($touchUri)
                $touchReq.Method = "POST"
                $touchReq.UserAgent = $Ua
                $touchReq.ContentLength = 0
                $touchReq.Timeout = 15000
                $touchReq.ReadWriteTimeout = 15000
                try {
                    $touchResp = $touchReq.GetResponse()
                    $touchCode = [int]$touchResp.StatusCode
                    $touchResp.Close()
                    Write-Host ("touch HTTP " + $touchCode)
                } catch [System.Net.WebException] {
                    $touchResp = $_.Exception.Response
                    if ($touchResp) {
                        $touchCode = [int]$touchResp.StatusCode
                        $retry = Get-Header $touchResp "Retry-After"
                        $touchResp.Close()
                        $retryText = ""
                        if ($retry) { $retryText = "  Retry-After " + $retry }
                        Write-Host ("touch HTTP " + $touchCode + $retryText)
                    } else {
                        Write-Host "touch failed. The URL was not logged."
                    }
                }
                $nextTouch = (Get-Date).AddSeconds(20)
            }
            Start-Sleep -Seconds 1
        }

        if ($SaveJpeg) {
            $shot = Invoke-Sentinel -Method GET -Path ("/partner/v1/cameras/" + $CameraId + "/snapshot") -Accept "image/jpeg" -TimeoutSec 15
            Write-CallLine $shot "snapshot"
            if ($shot.Status -eq 200 -and $shot.ContentType -match "jpeg") {
                $path = Join-Path $OutRoot ($CameraId + ".jpg")
                [System.IO.File]::WriteAllBytes($path, $shot.Bytes)
                Write-Host ("JPEG " + $shot.Bytes.Length + " bytes  captured " + $shot.CapturedAt + "  age " + $shot.MediaAge + "s")
                Write-Host ("Wrote " + $path)
            } else {
                Write-Host ("No JPEG. " + (Get-ErrorText $shot))
            }
        }
    } finally {
        $closed = Invoke-Sentinel -Method DELETE -Path ("/partner/v1/live-sessions/" + $sessionId) -TimeoutSec 20
        Write-CallLine $closed "close"
        if ($closed.Status -ne 204) {
            throw ("Session " + $sessionId + " did not close. " + (Get-ErrorText $closed))
        }
        Write-Host "Session closed."
    }
    return
}
