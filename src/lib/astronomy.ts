import * as Astronomy from 'astronomy-engine'
import { CelestialBodyId, ObserverLocation } from '../types'
import { eqjToScene } from './coordinateConversion'
import { STAR_CATALOG } from '../data/starCatalog'

const BODY_MAP: Record<string, Astronomy.Body> = {
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Earth: Astronomy.Body.Earth,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto,
}

/** Get heliocentric position of a planet in Three.js scene coords */
export function getBodyPosition(bodyId: CelestialBodyId, date: Date): [number, number, number] {
  if (bodyId === 'Sun') return [0, 0, 0]

  const body = BODY_MAP[bodyId]
  if (!body) return [0, 0, 0]

  const vec = Astronomy.HelioVector(body, date)
  return eqjToScene(vec.x, vec.y, vec.z)
}

/** Get all body positions for a given date */
export function getAllPositions(date: Date): Record<CelestialBodyId, [number, number, number]> {
  const result = {} as Record<CelestialBodyId, [number, number, number]>
  result.Sun = [0, 0, 0]
  for (const id of Object.keys(BODY_MAP) as CelestialBodyId[]) {
    result[id] = getBodyPosition(id, date)
  }
  return result
}

// ============ Sky Chart (alt-az) functions ============

export type SkyBodyId = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'

export const SKY_BODIES: SkyBodyId[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]

const SKY_BODY_MAP: Record<SkyBodyId, Astronomy.Body> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto,
}

export interface AltAzPosition {
  bodyId: SkyBodyId
  altitude: number   // degrees, -90 to +90
  azimuth: number    // degrees, 0=N, 90=E, 180=S, 270=W
}

function makeObserver(loc: ObserverLocation): Astronomy.Observer {
  return new Astronomy.Observer(loc.lat, loc.lon, loc.height)
}

export function getAltAz(bodyId: SkyBodyId, date: Date, observer: ObserverLocation): AltAzPosition {
  const obs = makeObserver(observer)
  const body = SKY_BODY_MAP[bodyId]
  const eq = Astronomy.Equator(body, date, obs, true, true)
  const hor = Astronomy.Horizon(date, obs, eq.ra, eq.dec, 'normal')
  return {
    bodyId,
    altitude: hor.altitude,
    azimuth: hor.azimuth,
  }
}

export function getAllAltAz(date: Date, observer: ObserverLocation): AltAzPosition[] {
  return SKY_BODIES.map((id) => getAltAz(id, date, observer))
}

export function findSunrise(startDate: Date, observer: ObserverLocation): Date | null {
  const obs = makeObserver(observer)
  const result = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, +1, startDate, 1)
  return result ? result.date : null
}

export function findSunset(startDate: Date, observer: ObserverLocation): Date | null {
  const obs = makeObserver(observer)
  const result = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, -1, startDate, 1)
  return result ? result.date : null
}

// ============ Moon illumination ============

/** Returns the Moon's illuminated fraction (0–1) at the given date */
export function getMoonIllumination(date: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction
}

// ============ Star positions (batch transform) ============

export interface StarAltAzPosition {
  starIndex: number   // index into STAR_CATALOG
  altitude: number    // degrees
  azimuth: number     // degrees, 0=N clockwise
}

// Pre-compute J2000 unit vectors from static RA/Dec (computed once at module load)
const DEG_TO_RAD = Math.PI / 180
const STAR_UNIT_VECTORS = STAR_CATALOG.map((star) => {
  const raRad = star.ra * 15 * DEG_TO_RAD
  const decRad = star.dec * DEG_TO_RAD
  const cosDec = Math.cos(decRad)
  return [cosDec * Math.cos(raRad), cosDec * Math.sin(raRad), Math.sin(decRad)] as const
})

export function getStarAltAzPositions(date: Date, observer: ObserverLocation): StarAltAzPosition[] {
  const obs = makeObserver(observer)
  const astroTime = Astronomy.MakeTime(date)
  const rot = Astronomy.Rotation_EQJ_HOR(astroTime, obs)

  return STAR_UNIT_VECTORS.map(([x, y, z], i) => {
    const vec = new Astronomy.Vector(x, y, z, astroTime)
    const horVec = Astronomy.RotateVector(rot, vec)
    const sphere = Astronomy.HorizonFromVector(horVec, 'normal')
    return {
      starIndex: i,
      altitude: sphere.lat,
      azimuth: sphere.lon,
    }
  })
}

// ============ Ecliptic curve ============

export interface EclipticPoint {
  altitude: number
  azimuth: number
}

// J2000 mean obliquity — precomputed trig
const OBLIQUITY_RAD = 23.4393 * DEG_TO_RAD
const COS_OBL = Math.cos(OBLIQUITY_RAD)
const SIN_OBL = Math.sin(OBLIQUITY_RAD)

/** Sample 360 points along the ecliptic and return their alt/az positions */
export function getEclipticAltAzPositions(date: Date, observer: ObserverLocation): EclipticPoint[] {
  const obs = makeObserver(observer)
  const astroTime = Astronomy.MakeTime(date)
  const rot = Astronomy.Rotation_EQJ_HOR(astroTime, obs)
  const points: EclipticPoint[] = []

  for (let i = 0; i < 360; i++) {
    const lon = i * DEG_TO_RAD
    const cosLon = Math.cos(lon)
    const sinLon = Math.sin(lon)

    // Ecliptic (λ, β=0) → equatorial J2000 unit vector
    const vec = new Astronomy.Vector(cosLon, sinLon * COS_OBL, sinLon * SIN_OBL, astroTime)
    const horVec = Astronomy.RotateVector(rot, vec)
    const sphere = Astronomy.HorizonFromVector(horVec, 'normal')

    points.push({ altitude: sphere.lat, azimuth: sphere.lon })
  }

  return points
}
