# Milky Way Background Texture

## Source

**NASA Deep Star Maps 2020**
- Page: https://svs.gsfc.nasa.gov/4851/
- Data: Gaia DR2 (ESA/Gaia/DPAC) — 1.7 billion stars
- Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio

The NASA SVS provides the star map in several layers and resolutions:

| File | Resolution | Contents |
|------|-----------|----------|
| `starmap_2020_4k.exr` | 4096x2048 | Combined stars + Milky Way glow |
| `milkyway_2020_4k.exr` | 4096x2048 | Diffuse Milky Way glow only (no bright point stars) |
| `hiptyc_2020_4k.exr` | 4096x2048 | Bright star foreground only |
| `starmap_2020_4k_print.jpg` | 1024x512 | Pre-tonemapped combined (NASA's own rendering) |
| `milkyway_2020_4k_print.jpg` | 1024x512 | Pre-tonemapped MW-only |

All files are equirectangular projections in J2000 equatorial coordinates (ICRF), centered at RA=0h. 8K and 16K EXR versions are also available. Galactic-coordinate variants exist with a `_gal` suffix.

Download URLs follow the pattern:
```
https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/<filename>
```

We use `starmap_2020_4k.exr` (the combined version) as the source — it includes both the diffuse Milky Way glow and individual bright stars, giving the richest background.

## EXR-to-JPEG Conversion

The EXR files are HDR linear-light data unsuitable for direct display. Converting them to a web-ready JPEG requires tone mapping — compressing the dynamic range into 8-bit sRGB while preserving visual detail.

### HDR characteristics of the source

```
Format:    OpenEXR, 4096x2048, linear light
Max value: 1.0
Mean:      0.016 (most of the sky is very dark)
Median:    0.008
```

### Approaches tried and rejected

1. **`-level 0,5% -gamma 0.8`** — Linear stretch with input white point at 5%. Produces vibrant colors but clips the galactic center to pure white (255). In the Three.js scene, reducing material opacity cannot fix clipped whites — semi-transparent white is still the brightest thing in the scene. The galactic core becomes a blown-out blob.

2. **`-evaluate log 2 -normalize -gamma 1.6`** — Logarithmic compression. Produces a reasonable image but `-normalize` re-stretches to full 0-255 range, reintroducing clipping at the bright end. The galactic center still clips.

3. **`-gamma 0.3`** (and 0.25, 0.35) — Simple gamma on the raw EXR. The data mean is only 1.6%, so even aggressive gamma curves leave the image near-black.

4. **`-evaluate Pow 0.25`** — Fourth root. Mean becomes 0.31 — far too bright, washes out the sky.

5. **`-evaluate log 2 -normalize -evaluate multiply 0.78`** — Log stretch with highlight cap. Fixes pure-white clipping but the log curve shifts colors brownish and loses dust-lane contrast.

6. **NASA print JPEG used directly** — The `starmap_2020_4k_print.jpg` (1024x512) has perfect tone mapping by NASA, but at 1024x512 the galactic core appears smudged when mapped onto a large sphere. Upscaling with sharpening does not recover the lost detail.

### Final conversion (what we ship)

```bash
magick starmap_2020_4k.exr -evaluate Pow 0.55 -evaluate multiply 0.93 -quality 92 starmap_4k.jpg
```

- **`-evaluate Pow 0.55`** — Power curve (roughly a square root). This is a standard astronomical stretch that boosts faint nebulosity while keeping bright regions below clipping. It maps the mean from 0.016 to ~0.10, closely matching NASA's own print rendering (mean=0.10).
- **`-evaluate multiply 0.93`** — Scales peak brightness to ~93% of full range, matching the NASA print's max of 0.93 (238/255). Prevents any pixel from reaching pure white.

Result statistics:
```
Resolution: 4096x2048
Max:        ~0.93 (no white clipping)
Mean:       ~0.08
File size:  ~340 KB (JPEG quality 92)
```

Compared to the NASA 1024x512 print, this preserves 4x the spatial resolution — dust lanes, dark nebulae, and individual stars in the galactic core are clearly resolved.

## Three.js Rendering Pipeline

### The color management problem

Three.js / React Three Fiber applies two color transforms by default:

1. **Input linearization** — When `texture.colorSpace = SRGBColorSpace`, the sRGB JPEG is converted to linear light for rendering.
2. **Tone mapping** — The renderer applies ACES Filmic tone mapping (the default), which shifts color balance (orange cast), compresses highlights, and boosts midtones.
3. **Output encoding** — Linear rendering result is converted back to sRGB.

For a JPEG that is already properly tonemapped for display, this pipeline applies unwanted transformations — the image appears brownish, washed out, with lifted blacks.

### Solution: custom ShaderMaterial

`MilkyWaySphere.tsx` uses a custom `ShaderMaterial` that samples the texture and outputs it directly, bypassing all Three.js color management:

```glsl
// Fragment shader — raw texture passthrough
uniform sampler2D map;
uniform float opacity;
varying vec2 vUv;
void main() {
    vec4 tex = texture2D(map, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * opacity);
}
```

`ShaderMaterial` does not participate in Three.js tone mapping or output encoding by default, so the sRGB JPEG bytes pass through to the screen exactly as authored.

The texture `colorSpace` is intentionally left unset (defaults to `NoColorSpace`) so Three.js does not attempt linearization.

### Coordinate alignment

The texture is in J2000 equatorial coordinates. The scene uses ecliptic coordinates. The sphere is:

- Rotated by `-obliquity` (23.44 deg) around X to tilt the equatorial pole to the ecliptic pole
- Scaled by `[-1, 1, 1]` to correct the RA direction (RA increases eastward, but Three.js SphereGeometry phi increases in the opposite sense when viewed from inside with `BackSide`)

Material opacity is set to 0.25 for a subtle background effect.

## Regenerating the texture

If you need to regenerate `public/starmap_4k.jpg` from the source EXR:

```bash
# Download the 4K EXR (35 MB)
curl -o starmap_2020_4k.exr \
  https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr

# Convert to JPEG with power-curve tone mapping
magick starmap_2020_4k.exr \
  -evaluate Pow 0.55 \
  -evaluate multiply 0.93 \
  -quality 92 \
  public/starmap_4k.jpg
```

For a higher-resolution version (e.g. 8K for retina displays):
```bash
curl -o starmap_2020_8k.exr \
  https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_8k.exr

magick starmap_2020_8k.exr \
  -evaluate Pow 0.55 \
  -evaluate multiply 0.93 \
  -quality 92 \
  public/starmap_8k.jpg
```

Requires ImageMagick 7 with OpenEXR delegate (`magick` command, not `convert`).
