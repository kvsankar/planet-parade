import {
  DEFAULT_EXTINCTION_COEFF,
  effectiveStarMagnitude,
  starContrastFactor,
} from './starVisibility'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

const MAG_BRIGHT_REFERENCE = -4
const MAG_FAINT_REFERENCE = 6.5
const MAG_BRIGHT_FLUX = Math.pow(10, -0.4 * MAG_BRIGHT_REFERENCE)
const MAG_FAINT_FLUX = Math.pow(10, -0.4 * MAG_FAINT_REFERENCE)

interface MagnitudeSizeCurveParams {
  minSize: number
  maxSize: number
  baseGamma: number
  relativeSpread?: number
}

function relativeFluxFromMagnitude(magnitude: number): number {
  const clampedMagnitude = clamp(magnitude, MAG_BRIGHT_REFERENCE, MAG_FAINT_REFERENCE)
  const flux = Math.pow(10, -0.4 * clampedMagnitude)
  return clamp01((flux - MAG_FAINT_FLUX) / (MAG_BRIGHT_FLUX - MAG_FAINT_FLUX))
}

function sizeFromMagnitudeCurve(
  magnitude: number,
  { minSize, maxSize, baseGamma, relativeSpread = 1 }: MagnitudeSizeCurveParams,
): number {
  const normalizedFlux = relativeFluxFromMagnitude(magnitude)
  const spread = clamp(relativeSpread, 0.6, 1.7)
  const gamma = clamp(baseGamma / spread, 0.2, 0.75)
  const size = minSize + (maxSize - minSize) * Math.pow(normalizedFlux, gamma)
  return clamp(size, minSize, maxSize)
}

const SPECTRAL_BV: Record<string, number> = {
  O: -0.33,
  B: -0.17,
  A: 0.0,
  F: 0.42,
  G: 0.65,
  K: 1.15,
  M: 1.60,
}

export function spectralClassToBv(spectralClass: string): number {
  return SPECTRAL_BV[spectralClass] ?? 0
}

/**
 * Convert B-V color index to RGB using a blackbody approximation.
 * B-V -> effective temperature (Ballesteros 2012) -> approximate sRGB.
 */
export function bvToRgb(bv: number): [number, number, number] {
  const clampedBv = clamp(bv, -0.4, 2.0)
  const t = 4600 * (1 / (0.92 * clampedBv + 1.7) + 1 / (0.92 * clampedBv + 0.62))
  const temp = t / 100

  let r: number
  let g: number
  let b: number

  if (temp <= 66) {
    r = 1
  } else {
    r = 1.292936 * (temp - 60) ** -0.1332047592
  }

  if (temp <= 66) {
    g = 0.3900815 * Math.log(temp) - 0.6318414
  } else {
    g = 1.129891 * (temp - 60) ** -0.0755148492
  }

  if (temp >= 66) {
    b = 1
  } else if (temp <= 19) {
    b = 0
  } else {
    b = 0.5432068 * Math.log(temp - 10) - 1.19625408
  }

  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)]
}

export function spectralClassToRgb(spectralClass: string): [number, number, number] {
  return bvToRgb(spectralClassToBv(spectralClass))
}

export function rgbToCss([r, g, b]: [number, number, number]): string {
  const rr = Math.round(clamp(r, 0, 1) * 255)
  const gg = Math.round(clamp(g, 0, 1) * 255)
  const bb = Math.round(clamp(b, 0, 1) * 255)
  return `rgb(${rr}, ${gg}, ${bb})`
}

export type StarRenderMode = 'atmospheric' | 'space'

/**
 * Core size law used by GPU point sprites (`gl_PointSize`) in 3D views.
 * Other renderers should derive from this to keep magnitude spread aligned.
 */
export function magnitudeToSpriteSize(magnitude: number, relativeSpread = 1): number {
  return sizeFromMagnitudeCurve(magnitude, {
    minSize: 0.9,
    maxSize: 6.6,
    baseGamma: 0.35,
    relativeSpread,
  })
}

/** Legacy dot sizing used by non-star markers in 2D charts. */
export function magnitudeToCanvasRadius(magnitude: number, relativeSpread = 1): number {
  return sizeFromMagnitudeCurve(magnitude, {
    minSize: 0.9,
    maxSize: 7.8,
    baseGamma: 0.3,
    relativeSpread,
  })
}

/** Per-body marker scale for 3D planet dots in Planetarium. */
export function magnitudeToPlanetMarkerScale(magnitude: number, relativeSpread = 1): number {
  return sizeFromMagnitudeCurve(magnitude, {
    minSize: 0.7,
    maxSize: 1.7,
    baseGamma: 0.36,
    relativeSpread,
  })
}

export function magnitudeToFaintness(effectiveMagnitude: number): number {
  return clamp((effectiveMagnitude + 2) / 8, 0, 1)
}

export const STAR_CANVAS_STYLE = {
  minRadius: 0.5,
  maxRadius: 3.2,
  coreRadiusFactor: 0.43,
  haloRadiusFactor: 1.95,
  minCoreRadius: 0.55,
} as const

/**
 * Convert shared sprite size law into a 2D chart radius with a mild
 * non-linear adapter to preserve bright/faint hierarchy on canvas.
 */
export function canvasBaseRadiusFromEffectiveMagnitude(
  effectiveMagnitude: number,
  adapterScale = 1,
  relativeSpread = 1,
): number {
  const baseSize = magnitudeToSpriteSize(effectiveMagnitude, relativeSpread)
  const curved = 0.34 + 0.40 * Math.pow(baseSize, 1.35)
  return clamp(
    curved * adapterScale,
    STAR_CANVAS_STYLE.minRadius,
    STAR_CANVAS_STYLE.maxRadius,
  )
}

export interface CanvasStarRadii {
  baseRadius: number
  coreRadius: number
  haloRadius: number
}

export function canvasRadiiFromBaseRadius(baseRadius: number): CanvasStarRadii {
  const clamped = clamp(baseRadius, STAR_CANVAS_STYLE.minRadius, STAR_CANVAS_STYLE.maxRadius)
  return {
    baseRadius: clamped,
    coreRadius: Math.max(STAR_CANVAS_STYLE.minCoreRadius, clamped * STAR_CANVAS_STYLE.coreRadiusFactor),
    haloRadius: clamped * STAR_CANVAS_STYLE.haloRadiusFactor,
  }
}

export function canvasRadiiFromEffectiveMagnitude(
  effectiveMagnitude: number,
  adapterScale = 1,
  relativeSpread = 1,
): CanvasStarRadii {
  return canvasRadiiFromBaseRadius(
    canvasBaseRadiusFromEffectiveMagnitude(effectiveMagnitude, adapterScale, relativeSpread),
  )
}

export interface LocalSkyWashVisibilityInput {
  direction: [number, number, number]
  sunDirection: [number, number, number] | null
  moonDirection: [number, number, number] | null
  twilightWash: number
  moonWash: number
  faintness: number
}

/**
 * Local visibility modulation from solar twilight and moon-glow scattering.
 * Shared for stars and non-luminous bodies so dimming behaves consistently.
 */
export function computeLocalSkyWashVisibility({
  direction,
  sunDirection,
  moonDirection,
  twilightWash,
  moonWash,
  faintness,
}: LocalSkyWashVisibilityInput): number {
  let localVisibility = 1

  if (sunDirection && twilightWash > 0.001) {
    const sunDot = clamp(
      direction[0] * sunDirection[0] + direction[1] * sunDirection[1] + direction[2] * sunDirection[2],
      -1,
      1,
    )
    const sunAng = Math.acos(sunDot)
    const sunKernel = Math.exp(-0.5 * (sunAng / 0.45) ** 2)
    localVisibility *= 1 - 0.58 * twilightWash * (0.35 + 0.65 * faintness) * sunKernel
  }

  if (moonDirection && moonWash > 0.001) {
    const moonDot = clamp(
      direction[0] * moonDirection[0] + direction[1] * moonDirection[1] + direction[2] * moonDirection[2],
      -1,
      1,
    )
    const moonAng = Math.acos(moonDot)
    const moonKernel = Math.exp(-0.5 * (moonAng / 0.34) ** 2)
    localVisibility *= 1 - 0.40 * moonWash * (0.25 + 0.75 * faintness) * moonKernel
  }

  return clamp(localVisibility, 0.15, 1)
}

export interface StarPhotometryInput {
  mode: StarRenderMode
  catalogMagnitude: number
  altitudeDeg: number
  skyVisibility: number
  limitingMagnitude: number
  direction?: [number, number, number]
  sunDirection?: [number, number, number] | null
  moonDirection?: [number, number, number] | null
  twilightWash?: number
  moonWash?: number
  extinctionCoeff?: number
}

export interface StarPhotometryResult {
  effectiveMagnitude: number
  contrast: number
  faintness: number
  localVisibility: number
  visibilityFactor: number
}

/**
 * Shared star visibility pipeline used by renderers:
 * - Atmospheric mode applies extinction + limiting-magnitude contrast + local wash.
 * - Space mode uses catalog magnitude directly and skips atmosphere terms.
 */
export function computeStarPhotometry({
  mode,
  catalogMagnitude,
  altitudeDeg,
  skyVisibility,
  limitingMagnitude,
  direction,
  sunDirection = null,
  moonDirection = null,
  twilightWash = 0,
  moonWash = 0,
  extinctionCoeff = DEFAULT_EXTINCTION_COEFF,
}: StarPhotometryInput): StarPhotometryResult {
  if (mode === 'space') {
    return {
      effectiveMagnitude: catalogMagnitude,
      contrast: 1,
      faintness: magnitudeToFaintness(catalogMagnitude),
      localVisibility: 1,
      visibilityFactor: 1,
    }
  }

  const effectiveMagnitude = effectiveStarMagnitude(catalogMagnitude, altitudeDeg, extinctionCoeff)
  const contrast = starContrastFactor(effectiveMagnitude, limitingMagnitude)
  const faintness = magnitudeToFaintness(effectiveMagnitude)
  const localVisibility = direction
    ? computeLocalSkyWashVisibility({
      direction,
      sunDirection,
      moonDirection,
      twilightWash,
      moonWash,
      faintness,
    })
    : 1
  const visibilityFactor = clamp01(skyVisibility) * contrast * localVisibility

  return {
    effectiveMagnitude,
    contrast,
    faintness,
    localVisibility,
    visibilityFactor: clamp01(visibilityFactor),
  }
}
