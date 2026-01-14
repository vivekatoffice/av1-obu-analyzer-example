# AV1 Stream Capture with Togglable Overlays

This repository contains tools and documentation for capturing and analyzing AV1 video streams from Axis cameras with the togglable overlays feature.

## Overview

The togglable overlays feature in AV1 streams allows viewers to seamlessly switch between viewing a scene with or without overlays, reducing bandwidth and storage by combining both views into a single stream with multiple encoded tracks.

## Quick Start

### Prerequisites

- FFmpeg installed and available in PATH
- Access to an Axis camera with AV1 support (ARTPEC-9, Axis OS 12.7+)
- PowerShell (Windows)

### Running the Test Script

```powershell
# Basic usage with default settings
.\test_av1_capture.ps1

# Custom camera settings
.\test_av1_capture.ps1 -CameraIP "10.176.12.35" -Username "root" -Password "YourPassword" -StreamProfile "vivek" -Duration 60

# Shorter test capture (10 seconds)
.\test_av1_capture.ps1 -Duration 10
```

### Script Parameters

- **CameraIP**: IP address of the Axis camera (default: `10.176.12.35`)
- **Username**: Camera username (default: `root`)
- **Password**: Camera password (default: `pass`)
- **StreamProfile**: Stream profile name (default: `vivek`)
- **Duration**: Capture duration in seconds (default: `60`)
- **OutputDir**: Output directory for captured files (default: `temp`)

## Output Files

The script captures three different AV1 streams:

1. **`temp/av1_standard.ivf`** - Standard AV1 stream without togglable overlays
2. **`temp/av1_layers_all.ivf`** - AV1 with togglable overlays (overlays visible)
3. **`temp/av1_layers_off.ivf`** - AV1 with togglable overlays (overlays hidden)

All output files are saved in the `temp/` directory, which is excluded from Git.

## Manual Capture Commands

### Standard AV1 Stream
```bash
ffmpeg -analyzeduration 10M -probesize 10M \
  -i "http://root:Axis%40125Apass@10.176.12.35/axis-cgi/media.cgi?videocodec=av1&streamprofile=vivek" \
  -t 60 -c copy -f ivf temp/av1_standard.ivf
```

### AV1 with Togglable Overlays (All)
```bash
ffmpeg -analyzeduration 10M -probesize 10M \
  -i "http://root:Axis%40125Apass@10.176.12.35/axis-cgi/media.cgi?videocodec=av1&streamprofile=vivek&videolayers=1&overlays=all" \
  -t 60 -c copy -f ivf temp/av1_layers_all.ivf
```

### AV1 with Togglable Overlays (Off)
```bash
ffmpeg -analyzeduration 10M -probesize 10M \
  -i "http://root:Axis%40125Apass@10.176.12.35/axis-cgi/media.cgi?videocodec=av1&streamprofile=vivek&videolayers=1&overlays=off" \
  -t 60 -c copy -f ivf temp/av1_layers_off.ivf
```

## OBU Stream Structure

The togglable overlays feature uses **OBU_META_DATA** with:
- **ID**: 25 (unregistered user private data)
- **UUID**: `aaaaaaaa-aaaa-aaaa-aaaa-70661eab1e02`
- **Location**: Beginning of GOP within the Temporal Unit containing the keyframe

### GOP Structure

Each GOP in a togglable overlays stream follows this pattern:

#### First Temporal Unit
- OBU_SEQUENCE_HEADER (identifies KEY FRAME)
- OBU_META_DATA (togglable overlay metadata)
- OBU_FRAME (KEY FRAME - base layer)
- OBU_FRAME (INTER FRAME - overlay layer)

#### Subsequent Temporal Units
- OBU_FRAME (INTER FRAME - base layer, marked "not shown")
- OBU_FRAME (INTER FRAME - overlay layer, marked "not shown")
- Frame Header (determines which frame to display)

## Verifying Togglable Overlay Support

Check if your camera supports togglable overlays:

```bash
curl "http://root:Axis%40125Apass@10.176.12.35/axis-cgi/param.cgi?action=listdefinitions&listformat=xmlschema&group=Image.I0.Layers"
```

Expected response if supported:
```xml
<group name="root">
  <group name="Image">
    <group name="I0">
      <group name="Layers">
        <parameter name="Enabled" value="no" securityLevel="7744" niceName="Enabled">
          <type>
            <bool true="yes" false="no" />
          </type>
        </parameter>
      </group>
    </group>
  </group>
</group>
```

## Analysis

For detailed analysis instructions, see [AV1_OBU_Analysis_Guide.md](AV1_OBU_Analysis_Guide.md).

### Quick Verification

Check if a file contains togglable overlay metadata:

```bash
ffmpeg -i temp/av1_layers_all.ivf 2>&1 | grep -i "metadata"
```

Look for: `Unknown Metadata OBU type 25` - this indicates the presence of togglable overlay metadata.

## VAPIX Parameters

### Overlay Control Parameters

- `videocodec=av1` - Use AV1 codec
- `videolayers=1` - Enable togglable overlays (encodes both base and overlay layers)
- `overlays=all` - Show all overlays (text, image, application)
- `overlays=off` - Hide overlays (base layer only)
- `overlays=text` - Show only text overlays
- `overlays=image` - Show only image overlays
- `overlays=application` - Show only application overlays

### Stream Profile

Use `streamprofile=<name>` to specify a pre-configured stream profile on the camera.

## Limitations

- **Codec**: Only compatible with AV1 codec on ARTPEC-9 devices
- **Performance**: Increased bitrate (~2x) and decoding load compared to single stream
- **Resources**: Video processing requires 2x resources
- **Multi-view**: Not compatible with multi-view streams

## Resources

- [Axis AV1 Togglable Overlays Documentation](https://developer.axis.com/video-streaming-and-recording/av1/how-to-guides/av1-togglable-overlays/)
- [AV1 Bitstream Specification](https://aomediacodec.github.io/av1-spec/)
- [IVF Container Format](https://wiki.multimedia.cx/index.php/IVF)

## Troubleshooting

### FFmpeg not found
Ensure FFmpeg is installed and added to your system PATH.

### RTSP streams not working
Use HTTP endpoint (`media.cgi`) instead of RTSP for AV1 streams. RTSP has issues with AV1 RTP depacketization in FFmpeg.

### "Could not find codec parameters"
Increase analyzeduration and probesize:
```bash
-analyzeduration 10M -probesize 10M
```

### Camera authentication failed
Ensure the password is properly URL-encoded. Use `%40` for `@` symbol.

## License

This project is for testing and analysis purposes.
