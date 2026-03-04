const DEG_TO_RAD = Math.PI / 180

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

/**
 * Typical V-band visual extinction in mag/airmass for decent lowland sites.
 * Stellarium docs suggest ~0.2 for good lowland, ~0.35 humid/poor conditions.
 */
export const DEFAULT_EXTINCTION_COEFF = 0.22

export function airmassFromAltitude(altitudeDeg: number): number {
  const cosZ = Math.sin(altitudeDeg * DEG_TO_RAD) // cos(zenith) == sin(alt)
  if (cosZ <= 0) return 40
  return 1 / (cosZ + 0.025 * Math.exp(-11 * cosZ))
}

export function effectiveStarMagnitude(
  catalogMagnitude: number,
  altitudeDeg: number,
  extinctionCoeff = DEFAULT_EXTINCTION_COEFF,
): number {
  return catalogMagnitude + extinctionCoeff * airmassFromAltitude(altitudeDeg)
}

export function limitingMagnitudeFromSkyVisibility(skyVisibility: number): number {
  // Approx. naked-eye limit mapping from bright washed-out sky to dark site.
  const v = clamp01(skyVisibility)
  return -1 + 7.5 * v // [-1, 6.5]
}

export function starContrastFactor(
  effectiveMagnitudeValue: number,
  limitingMagnitude: number,
): number {
  // Smooth transition around limiting magnitude.
  const edge0 = limitingMagnitude - 0.7
  const edge1 = limitingMagnitude + 0.5
  const t = clamp01((effectiveMagnitudeValue - edge0) / Math.max(1e-6, edge1 - edge0))
  return 1 - t * t * (3 - 2 * t)
}
