import { ObserverLocation } from '../../types'
import { altAzToSceneSphere } from '../../lib/coordinateConversion'
import { getAltAz, getBodyVisualMagnitude, getMoonIllumination } from '../../lib/astronomy'
import { getMoonGlowVisuals } from '../../lib/moonGlow'
import { getNightSkyVisibility } from '../../lib/skyVisibility'
import { DEFAULT_EXTINCTION_COEFF } from '../../lib/starVisibility'
import { AtmosphereAppearance, getAtmosphereAppearance } from '../../lib/atmosphereColor'

export interface PlanetariumSkyState {
  twilightWash: number
  moonWash: number
  starVisibility: number
  milkyWayVisibility: number
  moonGlowStrength: number
  sunDirection: [number, number, number]
  moonDirection: [number, number, number]
  atmosphere: AtmosphereAppearance
  starExtinctionCoeff: number
}

export function computePlanetariumSkyState(
  currentDate: Date,
  observer: ObserverLocation,
  showAtmosphere: boolean,
  showMoon: boolean,
): PlanetariumSkyState {
  const sunAltAz = getAltAz('Sun', currentDate, observer)
  const sunAlt = sunAltAz.altitude
  const moonAltAz = getAltAz('Moon', currentDate, observer)
  const moonIllumination = getMoonIllumination(currentDate)
  const moonMagnitude = getBodyVisualMagnitude('Moon', currentDate)
  const moonGlow = getMoonGlowVisuals({
    moonIllumination,
    moonAltitudeDeg: moonAltAz.altitude,
    moonMagnitude,
  })
  const visibility = getNightSkyVisibility({
    sunAltitudeDeg: sunAlt,
    moonGlowStrength: moonGlow.strength,
    includeSunlight: showAtmosphere,
    includeMoonlight: showAtmosphere && showMoon,
  })
  const atmosphere = getAtmosphereAppearance({
    sunAltitudeDeg: sunAlt,
    moonWash: visibility.moonWash,
    enabled: showAtmosphere,
  })
  const sunDirection = altAzToSceneSphere(sunAltAz.altitude, sunAltAz.azimuth, 1)
  const moonDirection = altAzToSceneSphere(moonAltAz.altitude, moonAltAz.azimuth, 1)

  return {
    twilightWash: visibility.twilightWash,
    moonWash: visibility.moonWash,
    starVisibility: visibility.starVisibility,
    milkyWayVisibility: visibility.milkyWayVisibility,
    moonGlowStrength: showAtmosphere && showMoon ? moonGlow.strength : 0,
    sunDirection,
    moonDirection,
    atmosphere,
    starExtinctionCoeff: showAtmosphere ? DEFAULT_EXTINCTION_COEFF : 0,
  }
}
