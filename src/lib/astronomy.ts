import * as Astronomy from 'astronomy-engine'
import { CelestialBodyId, ObserverLocation } from '../types'
import { eqjToScene } from './coordinateConversion'
import { STAR_CATALOG } from '../data/starCatalog'
import mwData from '../data/mw.json'

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

// ============ Sun-horizon longitude ============

/**
 * For a given instant and latitude, find the longitude where the Sun
 * sits exactly on the horizon (altitude ≈ 0).
 *   rising = true  → sunrise terminator (Sun ascending, eastern sky)
 *   rising = false → sunset  terminator (Sun descending, western sky)
 * Returns longitude in degrees (−180 … +180).
 */
export function sunHorizonLongitude(date: Date, lat: number, rising: boolean): number {
  const t = Astronomy.MakeTime(date)
  const eq = Astronomy.Equator(Astronomy.Body.Sun, t, new Astronomy.Observer(lat, 0, 0), true, true)

  const latRad = lat * DEG_TO_RAD
  const decRad = eq.dec * DEG_TO_RAD
  const cosHa = -Math.tan(latRad) * Math.tan(decRad)

  // Polar day / polar night — no horizon crossing
  if (cosHa < -1 || cosHa > 1) return 0

  const haHours = Math.acos(cosHa) * 12 / Math.PI   // radians → hours
  const ha = rising ? -haHours : haHours              // east / west

  const gst = Astronomy.SiderealTime(t)               // hours
  let lon = (ha + eq.ra - gst) * 15                    // hours → degrees

  // Normalise to −180 … +180
  lon = ((lon % 360) + 540) % 360 - 180
  return lon
}

// ============ Moon illumination ============

/** Returns the Moon's illuminated fraction (0–1) at the given date */
export function getMoonIllumination(date: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction
}

/** Returns true if the Moon is waxing (phase angle 0–180°) */
export function isMoonWaxing(date: Date): boolean {
  return Astronomy.MoonPhase(date) < 180
}

/** Returns the visual magnitude of a body as seen from Earth, or null on error */
export function getBodyVisualMagnitude(bodyId: SkyBodyId, date: Date): number | null {
  const body = SKY_BODY_MAP[bodyId]
  try {
    return Astronomy.Illumination(body, date).mag
  } catch {
    return null
  }
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

// ============ Shared alt/az point type ============

export interface AltAzPoint {
  altitude: number
  azimuth: number
}

// ============ Ecliptic curve ============

// J2000 mean obliquity — precomputed trig
const OBLIQUITY_RAD = 23.4393 * DEG_TO_RAD
const COS_OBL = Math.cos(OBLIQUITY_RAD)
const SIN_OBL = Math.sin(OBLIQUITY_RAD)

/** Sample 360 points along the ecliptic and return their alt/az positions */
export function getEclipticAltAzPositions(date: Date, observer: ObserverLocation): AltAzPoint[] {
  const obs = makeObserver(observer)
  const astroTime = Astronomy.MakeTime(date)
  const rot = Astronomy.Rotation_EQJ_HOR(astroTime, obs)
  const points: AltAzPoint[] = []

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

// ============ HOR → EQJ rotation matrix (for texture reprojection) ============

/** Returns the 3×3 rotation matrix from horizontal (alt-az) to J2000 equatorial coordinates.
 *  Transposed from astronomy-engine's column-major storage so that standard
 *  row-major matrix×vector multiplication gives the correct result. */
export function getHORtoEQJMatrix(date: Date, observer: ObserverLocation): number[][] {
  const obs = makeObserver(observer)
  const astroTime = Astronomy.MakeTime(date)
  const rot = Astronomy.Rotation_HOR_EQJ(astroTime, obs)
  // astronomy-engine stores rot[col][row]; transpose to row-major
  return [
    [rot.rot[0][0], rot.rot[1][0], rot.rot[2][0]],
    [rot.rot[0][1], rot.rot[1][1], rot.rot[2][1]],
    [rot.rot[0][2], rot.rot[1][2], rot.rot[2][2]],
  ]
}

// ============ Milky Way polygons (d3-celestial data) ============

// Minimal GeoJSON types for mw.json
interface MWFeature {
  id: string
  geometry: { coordinates: number[][][][] }
}

// Pre-compute J2000 unit vectors for each ring of each layer (once at module load)
// mw.json coords are [RA_deg, Dec_deg] with RA in [-180, 180]
const MW_LAYERS = (mwData as { features: MWFeature[] }).features.map((feature) => ({
  id: feature.id,
  rings: feature.geometry.coordinates[0].map((ring) =>
    ring.map((coord) => {
      const raDeg = coord[0], decDeg = coord[1]
      const raRad = raDeg * DEG_TO_RAD
      const decRad = decDeg * DEG_TO_RAD
      const cosDec = Math.cos(decRad)
      return [cosDec * Math.cos(raRad), cosDec * Math.sin(raRad), Math.sin(decRad)] as const
    })
  ),
}))

export interface MilkyWayLayer {
  id: string
  rings: AltAzPoint[][]
}

/** Transform pre-computed Milky Way polygon data to alt/az for the given date and observer */
export function getMilkyWayPolygons(date: Date, observer: ObserverLocation): MilkyWayLayer[] {
  const obs = makeObserver(observer)
  const astroTime = Astronomy.MakeTime(date)
  const rot = Astronomy.Rotation_EQJ_HOR(astroTime, obs)

  return MW_LAYERS.map((layer) => ({
    id: layer.id,
    rings: layer.rings.map((ring) =>
      ring.map(([x, y, z]) => {
        const vec = new Astronomy.Vector(x, y, z, astroTime)
        const horVec = Astronomy.RotateVector(rot, vec)
        const sphere = Astronomy.HorizonFromVector(horVec, 'normal')
        return { altitude: sphere.lat, azimuth: sphere.lon }
      })
    ),
  }))
}
