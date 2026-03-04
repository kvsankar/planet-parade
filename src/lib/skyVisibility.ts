function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export interface NightSkyVisibilityInput {
  sunAltitudeDeg: number
  moonGlowStrength: number
  includeSunlight?: boolean
  includeMoonlight?: boolean
}

export interface NightSkyVisibility {
  twilightWash: number
  moonWash: number
  starVisibility: number
  milkyWayVisibility: number
}

export function getTwilightFactor(sunAltitudeDeg: number): number {
  return sunAltitudeDeg >= 0 ? 1 : clamp01((sunAltitudeDeg + 18) / 18)
}

/**
 * Convert sky-lighting terms into rendering visibility factors.
 *
 * Notes:
 * - Astronomical twilight is approximated using the standard -18 deg boundary.
 * - Moon contribution should come from a physically motivated moon-glow model
 *   (phase + altitude + extinction), then mapped to an effective "wash" value.
 */
export function getNightSkyVisibility({
  sunAltitudeDeg,
  moonGlowStrength,
  includeSunlight = true,
  includeMoonlight = true,
}: NightSkyVisibilityInput): NightSkyVisibility {
  // 0 in fully dark conditions (Sun <= -18 deg), 1 at/above horizon.
  const twilightWash = includeSunlight
    ? getTwilightFactor(sunAltitudeDeg)
    : 0

  // Moon wash is bounded for visual stability.
  const moonWash = includeMoonlight ? clamp(moonGlowStrength, 0, 1.2) : 0

  // Stars survive moonlight better than diffuse Milky Way structure.
  const darknessFromSun = 1 - twilightWash
  const starVisibility = clamp01(darknessFromSun * (1 - 0.6 * moonWash))
  const milkyWayVisibility = clamp01(darknessFromSun * (1 - 0.88 * moonWash))

  return {
    twilightWash,
    moonWash,
    starVisibility,
    milkyWayVisibility,
  }
}
