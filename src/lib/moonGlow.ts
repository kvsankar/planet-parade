const DEG_TO_RAD = Math.PI / 180
const FULL_MOON_MAG = -12.73
const V_BAND_EXTINCTION = 0.172

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function airmassFromAltitude(altitudeDeg: number): number {
  const zenithDeg = clamp(90 - altitudeDeg, 0, 89.9)
  const z = zenithDeg * DEG_TO_RAD
  const sinZ = Math.sin(z)
  const term = Math.max(1e-6, 1 - 0.96 * sinZ * sinZ)
  return 1 / Math.sqrt(term)
}

function phaseAngleFromIllumination(illumination: number): number {
  // Convert illuminated fraction to phase angle in degrees.
  const clamped = clamp(illumination, 0, 1)
  const cosArg = clamp(2 * clamped - 1, -1, 1)
  return Math.acos(cosArg) / DEG_TO_RAD
}

function phaseMagnitudeKs91(phaseAngleDeg: number): number {
  // Krisciunas & Schaefer 1991 (eq. 9)
  return FULL_MOON_MAG + 0.026 * phaseAngleDeg + 4e-9 * phaseAngleDeg ** 4
}

function illuminanceKs91(phaseMag: number): number {
  // Krisciunas & Schaefer 1991 (eq. 8), in relative foot-candle units.
  return 10 ** (-0.4 * (phaseMag + 16.57))
}

export interface MoonGlowVisuals {
  opacity: number
  radiusScale: number
  strength: number
}

interface MoonGlowInputs {
  moonIllumination: number
  moonAltitudeDeg: number
  moonMagnitude: number | null
}

export function getMoonGlowVisuals({
  moonIllumination,
  moonAltitudeDeg,
  moonMagnitude,
}: MoonGlowInputs): MoonGlowVisuals {
  if (moonAltitudeDeg <= 0 || moonIllumination <= 0) {
    return { opacity: 0, radiusScale: 0, strength: 0 }
  }

  const phaseAngleDeg = phaseAngleFromIllumination(moonIllumination)
  const phaseMag = phaseMagnitudeKs91(phaseAngleDeg)
  const phaseIlluminance = illuminanceKs91(phaseMag)
  const fullMoonIlluminance = illuminanceKs91(FULL_MOON_MAG)
  const phaseStrength = phaseIlluminance / fullMoonIlluminance

  // Include actual computed moon magnitude to capture distance effects.
  const magnitudeScale = moonMagnitude != null
    ? 10 ** (-0.4 * (moonMagnitude - phaseMag))
    : 1

  const airmass = airmassFromAltitude(moonAltitudeDeg)
  const atmosphericTransmission = 10 ** (-0.4 * V_BAND_EXTINCTION * airmass)
  const altitudeGate = clamp01(Math.sin(moonAltitudeDeg * DEG_TO_RAD))

  const strength = Math.max(0, phaseStrength * magnitudeScale * atmosphericTransmission * altitudeGate)

  // Map physical strength to UI-friendly halo parameters.
  const opacity = clamp(0.34 * strength ** 0.6, 0, 0.45)
  const radiusScale = clamp(0.55 + 0.95 * strength ** 0.35, 0.55, 1.6)

  return { opacity, radiusScale, strength }
}
