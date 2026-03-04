function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
  ]
}

function addScaledColor(
  base: [number, number, number],
  lift: [number, number, number],
  scale: number,
): [number, number, number] {
  return [
    clamp(base[0] + lift[0] * scale, 0, 1),
    clamp(base[1] + lift[1] * scale, 0, 1),
    clamp(base[2] + lift[2] * scale, 0, 1),
  ]
}

export interface AtmosphereAppearance {
  dayFactor: number
  twilightFactor: number
  nightFactor: number
  moonlightFactor: number
  skyAlpha: number
  sunGlowStrength: number
  zenithColor: [number, number, number]
  horizonColor: [number, number, number]
  sunCoreColor: [number, number, number]
  sunGlowColor: [number, number, number]
}

interface AtmosphereAppearanceInput {
  sunAltitudeDeg: number
  moonWash: number
  enabled?: boolean
}

const NIGHT_ZENITH: [number, number, number] = [0.03, 0.05, 0.10]
const NIGHT_HORIZON: [number, number, number] = [0.06, 0.07, 0.11]
const TWILIGHT_ZENITH: [number, number, number] = [0.12, 0.20, 0.40]
const TWILIGHT_HORIZON: [number, number, number] = [0.95, 0.46, 0.20]
const DAY_ZENITH: [number, number, number] = [0.23, 0.53, 0.95]
const DAY_HORIZON: [number, number, number] = [0.72, 0.84, 0.98]
const MOON_TINT: [number, number, number] = [0.30, 0.36, 0.50]

/**
 * Shared chromatic atmosphere model used by Planetarium and Sky Charts.
 *
 * - Daylight contribution is driven by Sun altitude.
 * - Twilight contribution peaks around the horizon and fades in day/night.
 * - Moonlight slightly lifts the night-sky blue when Sun is low.
 */
export function getAtmosphereAppearance({
  sunAltitudeDeg,
  moonWash,
  enabled = true,
}: AtmosphereAppearanceInput): AtmosphereAppearance {
  if (!enabled) {
    return {
      dayFactor: 0,
      twilightFactor: 0,
      nightFactor: 1,
      moonlightFactor: 0,
      skyAlpha: 0,
      sunGlowStrength: 0,
      zenithColor: NIGHT_ZENITH,
      horizonColor: NIGHT_HORIZON,
      sunCoreColor: [1, 0.72, 0.42],
      sunGlowColor: [1, 0.56, 0.24],
    }
  }

  const daylight = smoothstep(-6, 14, sunAltitudeDeg)
  const twilightBase = smoothstep(-18, 2, sunAltitudeDeg) * (1 - smoothstep(4, 16, sunAltitudeDeg))
  const sunsetBand = Math.exp(-0.5 * (sunAltitudeDeg / 4.5) ** 2)
  const twilight = clamp(Math.max(twilightBase, 0.65 * sunsetBand), 0, 1)
  const night = clamp(1 - Math.max(daylight, twilight * 0.9), 0, 1)
  const moon = clamp(moonWash, 0, 1)

  let zenith = mixColor(NIGHT_ZENITH, TWILIGHT_ZENITH, twilight)
  zenith = mixColor(zenith, DAY_ZENITH, daylight)

  let horizon = mixColor(NIGHT_HORIZON, TWILIGHT_HORIZON, twilight)
  horizon = mixColor(horizon, DAY_HORIZON, daylight)

  const moonLift = moon * night
  zenith = addScaledColor(zenith, MOON_TINT, 0.16 * moonLift)
  horizon = addScaledColor(horizon, MOON_TINT, 0.10 * moonLift)

  const sunWarmth = clamp(1 - daylight * 0.75, 0, 1)
  const sunCoreColor = mixColor([1.0, 0.96, 0.82], [1.0, 0.62, 0.30], sunWarmth)
  const sunGlowColor = mixColor([1.0, 0.88, 0.62], [1.0, 0.52, 0.18], sunWarmth)

  return {
    dayFactor: daylight,
    twilightFactor: twilight,
    nightFactor: night,
    moonlightFactor: moon,
    skyAlpha: clamp(0.90 * daylight + 0.72 * twilight + 0.15 * moonLift, 0, 0.95),
    sunGlowStrength: clamp(0.25 * daylight + 0.95 * twilight, 0, 1),
    zenithColor: zenith,
    horizonColor: horizon,
    sunCoreColor,
    sunGlowColor,
  }
}

export function colorToCss(color: [number, number, number], alpha = 1): string {
  const r = Math.round(clamp(color[0], 0, 1) * 255)
  const g = Math.round(clamp(color[1], 0, 1) * 255)
  const b = Math.round(clamp(color[2], 0, 1) * 255)
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}
