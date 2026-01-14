# AV1 Stream Capture Test Script
# This script captures AV1 video streams from Axis camera with togglable overlays feature

param(
    [string]$CameraIP = "10.176.12.35",
    [string]$Username = "root",
    [string]$Password = "pass",
    [string]$StreamProfile = "vivek",
    [int]$Duration = 60,
    [string]$OutputDir = "temp"
)

# Color output functions
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Create temp directory if it doesn't exist
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Success "✓ Created output directory: $OutputDir"
}

# URL encode the password
$EncodedPassword = [System.Web.HttpUtility]::UrlEncode($Password)

# Test if ffmpeg is available
try {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Success "✓ FFmpeg found: $ffmpegVersion"
} catch {
    Write-Error "✗ FFmpeg not found. Please install FFmpeg and add it to PATH."
    exit 1
}

Write-Info "`n========================================="
Write-Info "AV1 Stream Capture Test"
Write-Info "========================================="
Write-Info "Camera IP: $CameraIP"
Write-Info "Stream Profile: $StreamProfile"
Write-Info "Duration: $Duration seconds"
Write-Info "Output Directory: $OutputDir"
Write-Info "=========================================`n"

# Define capture configurations
$captures = @(
    @{
        Name = "Standard AV1 (No Overlays)"
        Params = "videocodec=av1&streamprofile=$StreamProfile"
        Output = "$OutputDir/av1_standard.ivf"
        Description = "Baseline AV1 stream without togglable overlays"
    },
    @{
        Name = "AV1 with Togglable Overlays (All)"
        Params = "videocodec=av1&streamprofile=$StreamProfile&videolayers=1&overlays=all"
        Output = "$OutputDir/av1_layers_all.ivf"
        Description = "AV1 stream with both base and overlay layers (overlays visible)"
    },
    @{
        Name = "AV1 with Togglable Overlays (Off)"
        Params = "videocodec=av1&streamprofile=$StreamProfile&videolayers=1&overlays=off"
        Output = "$OutputDir/av1_layers_off.ivf"
        Description = "AV1 stream with both layers (overlays hidden)"
    }
)

# Capture each stream
$results = @()
foreach ($capture in $captures) {
    Write-Info "`n📹 Capturing: $($capture.Name)"
    Write-Info "   $($capture.Description)"
    
    $url = "http://${Username}:${EncodedPassword}@${CameraIP}/axis-cgi/media.cgi?$($capture.Params)"
    $startTime = Get-Date
    
    # Run FFmpeg capture
    $ffmpegArgs = @(
        "-analyzeduration", "10M",
        "-probesize", "10M",
        "-i", $url,
        "-t", $Duration,
        "-c", "copy",
        "-f", "ivf",
        $capture.Output
    )
    
    try {
        $process = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru
        $endTime = Get-Date
        $elapsed = ($endTime - $startTime).TotalSeconds
        
        if ($process.ExitCode -eq 0) {
            $fileInfo = Get-Item $capture.Output
            $fileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
            
            Write-Success "   ✓ Capture completed successfully"
            Write-Info "   File: $($capture.Output)"
            Write-Info "   Size: $fileSizeMB MB"
            Write-Info "   Time: $([math]::Round($elapsed, 1)) seconds"
            
            # Verify the file with ffmpeg
            $verifyOutput = ffmpeg -i $capture.Output 2>&1 | Out-String
            if ($verifyOutput -match "Stream #0:0: Video: av1.*?(\d+x\d+).*?(\d+) fps") {
                $resolution = $matches[1]
                $fps = $matches[2]
                Write-Info "   Resolution: $resolution @ $fps fps"
                
                # Check for togglable overlay metadata
                if ($verifyOutput -match "Unknown Metadata OBU type 25") {
                    Write-Success "   ✓ Togglable overlay metadata detected (OBU type 25)"
                }
            }
            
            $results += @{
                Name = $capture.Name
                Success = $true
                File = $capture.Output
                Size = $fileSizeMB
                Time = $elapsed
            }
        } else {
            Write-Error "   ✗ Capture failed with exit code: $($process.ExitCode)"
            $results += @{
                Name = $capture.Name
                Success = $false
                Error = "FFmpeg exit code: $($process.ExitCode)"
            }
        }
    } catch {
        Write-Error "   ✗ Error: $_"
        $results += @{
            Name = $capture.Name
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Summary
Write-Info "`n========================================="
Write-Info "Capture Summary"
Write-Info "=========================================`n"

$successCount = ($results | Where-Object { $_.Success }).Count
$totalCount = $results.Count

foreach ($result in $results) {
    if ($result.Success) {
        Write-Success "✓ $($result.Name)"
        Write-Info "  File: $($result.File) ($($result.Size) MB)"
    } else {
        Write-Error "✗ $($result.Name)"
        Write-Error "  Error: $($result.Error)"
    }
}

Write-Info "`n========================================="
if ($successCount -eq $totalCount) {
    Write-Success "All captures completed successfully! ($successCount/$totalCount)"
} else {
    Write-Warning "Some captures failed. ($successCount/$totalCount succeeded)"
}
Write-Info "=========================================`n"

# Display next steps
if ($successCount -gt 0) {
    Write-Info "Next Steps:"
    Write-Info "1. Analyze OBU structure using hex editor or AV1 analysis tools"
    Write-Info "2. Look for UUID: aaaaaaaa-aaaa-aaaa-aaaa-70661eab1e02 in metadata"
    Write-Info "3. Compare GOP structures between standard and togglable overlay streams"
    Write-Info "4. See AV1_OBU_Analysis_Guide.md for detailed analysis instructions`n"
}

exit ($successCount -eq $totalCount ? 0 : 1)
