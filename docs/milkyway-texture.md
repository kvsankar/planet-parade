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

We use `milkyway_2020_4k.exr` (the diffuse Milky Way-only layer) as the source to avoid duplicating stars that are already rendered by the app's star pipeline.

## Why this choice

- The app already renders stars explicitly (`RealStars` / sky-chart star pipeline), with mode-aware photometry and atmosphere handling.
- Using NASA's combined `starmap_2020_4k.exr` adds a second star field in the background texture, which makes stars look doubled or noisy in dark regions.
- Using NASA's `milkyway_2020_4k.exr` keeps the diffuse galactic structure while leaving point stars to the app's dedicated star renderer.
- `public/starmap_4k.jpg` is intentionally kept in the repo for A/B comparison and quick rollback, but it is no longer the active runtime texture.

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

6. **NASA print JPEG used directly** — The `milkyway_2020_4k_print.jpg` (1024x512) has NASA-authored tone mapping, but at 1024x512 the galactic structure appears soft when mapped onto a large sphere. Upscaling with sharpening does not recover the lost detail.

### Final conversion (what we ship)

```bash
magick milkyway_2020_4k.exr -evaluate Pow 0.55 -evaluate multiply 0.68 -quality 92 milkyway_4k.jpg
```

- **`-evaluate Pow 0.55`** — Power curve (roughly a square root). This is a standard astronomical stretch that boosts faint nebulosity while keeping core detail intact.
- **`-evaluate multiply 0.68`** — Keeps the Milky Way layer subtle and close to the prior in-app background luminance, while avoiding bright-star doubling.

Result statistics:
```
Resolution: 4096x2048
Max:        ~0.75
Mean:       ~0.078
File size:  ~2.0 MB (JPEG quality 92)
```

Compared to the NASA 1024x512 print, this preserves 4x the spatial resolution — dust lanes and diffuse galactic structure remain crisp, while foreground stars come from the app's own star renderer.

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

- Created with `phiStart=π` — this rotates the geometry seam to RA=12h, so that after the X-flip `uv.x=0.5` (texture center, RA=0h) aligns with the scene +X direction
- Scaled by `[-1, 1, 1]` to correct the RA direction (RA increases eastward, but Three.js SphereGeometry phi increases in the opposite sense when viewed from inside with `BackSide`)
- Rotated by `-obliquity` (23.44°) around X to tilt the equatorial pole to the ecliptic pole

Base material opacity is `0.25` for a subtle background effect, then modulated at runtime by shared sky-visibility factors.

### Atmospheric attenuation in Planetarium

In Planetarium, the Milky Way shader applies directional attenuation from:

- **Twilight wash** (Sun altitude driven) with wide + core scattering kernels around the Sun direction.
- **Moon wash** (phase/altitude/magnitude driven) with a narrower kernel around the Moon direction.

The final local visibility is clamped and multiplied into both RGB and alpha, so Milky Way contrast fades naturally in twilight/moonlight.

### Asset path

The texture is loaded via `import.meta.env.BASE_URL` (Vite replaces this with the configured `base` path at build time). This ensures the URL resolves correctly regardless of the deployment subdirectory. Do not use absolute paths like `/milkyway_4k.jpg` — the app's `base` is `./` (relative).

## Sky Chart Texture Reprojection

The same `milkyway_4k.jpg` texture is also used in the sky charts (`StereoSkyChart.tsx`) as a toggleable alternative to the SVG polygon Milky Way.
Sky chart timestamps (and therefore atmosphere attenuation timing inputs) are evaluated against observer-local day windows when timezone is set, with UTC fallback.

### How it works

`MilkyWayTextureCanvas.tsx` reprojects the equirectangular NASA texture into the sky chart's azimuthal equidistant projection in a WebGL fragment shader:

1. **Reverse projection** — For each fragment in the circular chart area, compute altitude from radius (`alt = 90° × (1 - r/R)`) and derive horizontal vector components from screen-space direction.
2. **Horizontal → J2000** — Multiply by the per-frame HOR→EQJ rotation matrix from astronomy-engine.
3. **J2000 → texture UV** — `u = 0.5 - ra/(2π)`, `v = (π/2 + dec)/π`. The `+dec` term is intentional because the shipped `milkyway_4k.jpg` orientation is vertically flipped relative to the default +Dec-at-top convention.
4. **Texture sample + attenuation** — Sample the texture and apply twilight/moon directional attenuation in-shader so sky charts match Planetarium visibility behavior.

The canvas is clipped to the chart circle in CSS, and opacity is modulated by the same sky-visibility model used by other chart layers.

### Architecture

- **Per-chart WebGL shell** — Each texture chart instance owns a tiny orthographic WebGL renderer and a full-screen quad shader.
- **Shared texture cache** — The NASA JPEG is loaded once (`THREE.TextureLoader`) and reused by all chart instances.
- **Internal render scale** — Texture rendering uses an internal scale factor (currently `0.75`) to lower fill-rate cost while preserving visual quality.
- **Uniform-driven updates** — Rotation matrix, geometry parameters, and attenuation inputs are updated via uniforms on each chart render tick.
- **Single playback clock for Poly/Tex** — `SkyChartPanel` drives both polygon Milky Way (`Poly`) and texture Milky Way (`Tex`) from the same render clock/context path, preventing lag/catch-up desynchronization when animating.

### UI toggle

The sky chart layer menu shows `[Poly | Tex]` pills when the Milky Way layer is enabled, allowing instant switching between the polygon and texture rendering modes.

## Regenerating the texture

If you need to regenerate `public/milkyway_4k.jpg` from the source EXR:

```bash
# Download the 4K EXR (35 MB)
curl -o milkyway_2020_4k.exr \
  https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_4k.exr

# Convert to JPEG with power-curve tone mapping
magick milkyway_2020_4k.exr \
  -evaluate Pow 0.55 \
  -evaluate multiply 0.68 \
  -quality 92 \
  public/milkyway_4k.jpg
```

For a higher-resolution version (e.g. 8K for retina displays):
```bash
curl -o milkyway_2020_8k.exr \
  https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_8k.exr

magick milkyway_2020_8k.exr \
  -evaluate Pow 0.55 \
  -evaluate multiply 0.68 \
  -quality 92 \
  public/milkyway_8k.jpg
```

Requires ImageMagick 7 with OpenEXR delegate (`magick` command, not `convert`).

## See Also

- [Product Specification](specs.md) — Full feature requirements including sky chart and 3D scene rendering
