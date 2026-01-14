# AV1 OBU Stream Structure Analysis Guide

## Overview
This guide documents the AV1 video streams captured from Axis camera (10.176.12.35) with togglable overlays feature for analyzing the OBU (Open Bitstream Unit) structure.

## Captured Files

### 1. **outputvivek.ivf** (7.90 MB)
- **Description**: Standard AV1 stream without togglable overlays
- **Parameters**: `videocodec=av1&streamprofile=vivek`
- **Duration**: 60 seconds
- **Resolution**: 3840x2160 (4K)
- **Frame Rate**: 25 fps
- **Bitrate**: ~1105 kbits/s
- **Use Case**: Baseline AV1 stream for comparison

### 2. **outputvivek_layers_all.ivf** (14.72 MB)
- **Description**: AV1 stream with togglable overlays enabled (all overlays visible)
- **Parameters**: `videocodec=av1&streamprofile=vivek&videolayers=1&overlays=all`
- **Duration**: 60 seconds
- **Resolution**: 3840x2160 (4K)
- **Frame Rate**: 25 fps
- **Bitrate**: ~2057 kbits/s
- **Use Case**: Analyze OBU structure with overlay layer included
- **Key Features**:
  - Contains both base layer and overlay layer
  - Includes OBU_META_DATA with UUID: `aaaaaaaa-aaaa-aaaa-aaaa-70661eab1e02`
  - Each GOP starts with KEY FRAME + INTER FRAME structure
  - Subsequent TUs contain two INTER FRAMEs marked as "not shown"

### 3. **outputvivek_layers_off.ivf** (9.96 MB)
- **Description**: AV1 stream with togglable overlays enabled (overlays hidden)
- **Parameters**: `videocodec=av1&streamprofile=vivek&videolayers=1&overlays=off`
- **Duration**: 60 seconds
- **Resolution**: 3840x2160 (4K)
- **Frame Rate**: 25 fps
- **Bitrate**: ~1392 kbits/s
- **Use Case**: Analyze base layer only with togglable overlay metadata

## OBU Stream Structure (Togglable Overlays)

### Metadata OBU Identification
The togglable overlays feature uses **OBU_META_DATA** (OBU Type 5) with:
- **Metadata Type**: 25 (Unregistered user private data)
- **UUID**: `aaaaaaaa-aaaa-aaaa-aaaa-70661eab1e02`
- **Location**: Beginning of GOP within the Temporal Unit containing the keyframe

**Observed Structure in `av1_layers_all.ivf`:**
- **OBU Header**: Type 5 (Metadata)
- **Metadata Type**: 25
- **Payload**:
  - **Byte 0**: `0x80` (128) - *Prefix/Flag*
  - **Bytes 1-16**: `0xAA 0xAA ... 0x70 0x66 0x1E 0xAB 0x1E 0x02`
    - This matches the UUID: `aaaaaaaa-aaaa-aaaa-aaaa-70661eab1e02`
  - **Bytes 17+**: Overlay configuration data

### GOP Structure
Each GOP in a togglable overlays stream follows this pattern (observed in trace):

#### First Temporal Unit (TU 0)
1. **OBU_SEQUENCE_HEADER**
2. **OBU_META_DATA** (Type 25, containing the UUID)
3. **OBU_FRAME** (Base Layer)
   - Frame Type: `KEY FRAME` (0)
   - `show_frame`: 1 (Displayed)
4. **OBU_FRAME** (Overlay Layer)
   - Frame Type: `INTER FRAME` (1)
   - `show_frame`: 0 (Hidden)
   - `showable_frame`: 1

#### Subsequent Temporal Units (e.g., TU 1)
1. **OBU_FRAME** (Base Layer)
   - Frame Type: `INTER FRAME` (1)
   - `show_frame`: 0 (Hidden)
   - `showable_frame`: 1
2. **OBU_FRAME** (Overlay Layer)
   - Frame Type: `INTER FRAME` (1)
   - `show_frame`: 0 (Hidden)
   - `showable_frame`: 1
3. **OBU_FRAME** (Frame Header / Show Existing)
   - `show_existing_frame`: 1
   - `frame_to_show_map_idx`: Determines which frame to display (Base or Overlay)

### Comparison with Standard AV1 Stream
For reference, the standard AV1 stream (`av1_standard.ivf`) has a simpler structure:

**Standard GOP Structure (TU 0):**
1. **OBU_SEQUENCE_HEADER**
2. **OBU_FRAME** (Base Layer)
   - Frame Type: `KEY FRAME` (0)
   - `show_frame`: 1 (Displayed)
   - *Note: No OBU_METADATA and no hidden overlay frames.*

**Standard Subsequent TUs:**
1. **OBU_FRAME** (Base Layer)
   - Frame Type: `INTER FRAME` (1)
   - `show_frame`: 1 (Displayed)

## How to Modify the Stream

### To Show Base Layer Only
1. Identify KEY FRAME via `OBU_SEQUENCE_HEADER`
2. Identify `OBU_META_DATA` with togglable overlay UUID
3. Drop the `OBU_META_DATA` in first TU of GOP
4. Drop the first `OBU_FRAME` in each TU of GOP
5. Drop all subsequent `OBU_FRAMEs` in same GOP (or maintain counter and drop when count > 1)

### To Show Overlay Layer Only
1. Identify KEY FRAME via `OBU_SEQUENCE_HEADER`
2. Identify `OBU_META_DATA` with togglable overlay UUID
3. Drop the `OBU_META_DATA` in first TU of GOP
4. Keep only the overlay layer frames

## Analysis Tools

### Using FFmpeg to Inspect OBUs
```bash
# Show detailed frame information
ffmpeg -i outputvivek_layers_all.ivf -vf showinfo -f null -

# Extract raw OBU data
ffmpeg -i outputvivek_layers_all.ivf -c copy -bsf:v trace_headers -f null - 2>&1 | grep -i obu
```

### Using aomdec (AV1 reference decoder)
```bash
# Decode and show frame details
aomdec --summary outputvivek_layers_all.ivf -o /dev/null
```

### Using av1-grain (AV1 analysis tool)
```bash
# Analyze OBU structure
av1-grain outputvivek_layers_all.ivf
```

## Key Observations

### Bitrate Comparison
- **Standard AV1**: ~1105 kbits/s
- **Layers OFF**: ~1392 kbits/s (+26%)
- **Layers ALL**: ~2057 kbits/s (+86%)

The increased bitrate with `videolayers=1` confirms that both layers are being encoded and transmitted, even when `overlays=off` is set (the metadata is still present).

### File Size Comparison
- **Standard**: 7.90 MB
- **Layers OFF**: 9.96 MB (+26%)
- **Layers ALL**: 14.72 MB (+86%)

## VAPIX Commands Used

### Capture Standard AV1
```bash
ffmpeg -analyzeduration 10M -probesize 10M \
  -i "http://root:Axis%40125Apass@10.176.12.35/axis-cgi/media.cgi?videocodec=av1&streamprofile=vivek" \
  -t 60 -c copy -f ivf outputvivek.ivf
```

### Capture with Togglable Overlays (All)
```bash
ffmpeg -analyzeduration 10M -probesize 10M \
  -i "http://root:Axis%40125Apass@10.176.12.35/axis-cgi/media.cgi?videocodec=av1&streamprofile=vivek&videolayers=1&overlays=all" \
  -t 60 -c copy -f ivf outputvivek_layers_all.ivf
```

### Capture with Togglable Overlays (Off)
```bash
ffmpeg -analyzeduration 10M -probesize 10M \
  -i "http://root:Axis%40125Apass@10.176.12.35/axis-cgi/media.cgi?videocodec=av1&streamprofile=vivek&videolayers=1&overlays=off" \
  -t 60 -c copy -f ivf outputvivek_layers_off.ivf
```

## References
- [Axis AV1 Togglable Overlays Documentation](https://developer.axis.com/video-streaming-and-recording/av1/how-to-guides/av1-togglable-overlays/)
- [AV1 Bitstream Specification](https://aomediacodec.github.io/av1-spec/)
- [IVF Container Format](https://wiki.multimedia.cx/index.php/IVF)

## Next Steps for Analysis
1. Use a hex editor to examine the raw OBU structure
2. Look for the UUID `aaaaaaaa-aaaa-aaaa-aaaa-70661eab1e02` in the metadata
3. Count OBU_FRAME occurrences per Temporal Unit
4. Verify the "show_frame" flags in frame headers
5. Compare GOP structures between standard and togglable overlay streams
