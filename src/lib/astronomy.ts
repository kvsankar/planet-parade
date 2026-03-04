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
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune'

export const SKY_BODIES: SkyBodyId[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune',
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
}

export interface AltAzPosition {
  bodyId: SkyBodyId
  altitude: number   // degrees, -90 to +90
  azimuth: number    // degrees, 0=N, 90=E, 180=S, 270=W
}

function makeObserver(loc: ObserverLocation): Astronomy.Observer {
  return new Astronomy.Observer(loc.lat, loc.lon, loc.height)
}

export interface SkyProjectionContext {
  astroTime: Astronomy.AstroTime
  observer: Astronomy.Observer
  // astronomy-engine column-major storage for EQJ->HOR rotation.
  eqjToHor: number[][]
  // Row-major HOR->EQJ matrix for shader-side vec multiplication.
  horToEqj: number[][]
}

export function prepareSkyProjectionContext(date: Date, observer: ObserverLocation): SkyProjectionContext {
  const obs = makeObserver(observer)
  const astroTime = Astronomy.MakeTime(date)
  const eqjToHor = Astronomy.Rotation_EQJ_HOR(astroTime, obs).rot

  // Inverse of EQJ->HOR is HOR->EQJ; for an orthonormal matrix this is transpose.
  // `eqjToHor` is column-major, and this yields a row-major matrix convenient for GLSL.
  const horToEqj = [
    [eqjToHor[0][0], eqjToHor[0][1], eqjToHor[0][2]],
    [eqjToHor[1][0], eqjToHor[1][1], eqjToHor[1][2]],
    [eqjToHor[2][0], eqjToHor[2][1], eqjToHor[2][2]],
  ]

  return { astroTime, observer: obs, eqjToHor, horToEqj }
}

function computeAltAzFromPrepared(
  bodyId: SkyBodyId,
  astroTime: Astronomy.AstroTime,
  observer: Astronomy.Observer,
): AltAzPosition {
  const body = SKY_BODY_MAP[bodyId]
  const eq = Astronomy.Equator(body, astroTime, observer, true, true)
  const hor = Astronomy.Horizon(astroTime, observer, eq.ra, eq.dec, 'normal')
  return {
    bodyId,
    altitude: hor.altitude,
    azimuth: hor.azimuth,
  }
}

export function getAltAz(bodyId: SkyBodyId, date: Date, observer: ObserverLocation): AltAzPosition {
  const prepared = prepareSkyProjectionContext(date, observer)
  return computeAltAzFromPrepared(bodyId, prepared.astroTime, prepared.observer)
}

export function getAllAltAzFromContext(context: SkyProjectionContext): AltAzPosition[] {
  const out = new Array<AltAzPosition>(SKY_BODIES.length)
  for (let i = 0; i < SKY_BODIES.length; i++) {
    out[i] = computeAltAzFromPrepared(SKY_BODIES[i], context.astroTime, context.observer)
  }
  return out
}

export function getAllAltAz(date: Date, observer: ObserverLocation): AltAzPosition[] {
  return getAllAltAzFromContext(prepareSkyProjectionContext(date, observer))
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
 * sits at a target altitude.
 *   rising = true  → sunrise terminator (Sun ascending, eastern sky)
 *   rising = false → sunset  terminator (Sun descending, western sky)
 * Returns longitude in degrees (−180 … +180).
 */
export function sunHorizonLongitudes(date: Date, lat: number, sunAltitudeDeg = 0): { rising: number; setting: number } {
  const t = Astronomy.MakeTime(date)
  const eq = Astronomy.Equator(Astronomy.Body.Sun, t, new Astronomy.Observer(lat, 0, 0), true, true)

  const latRad = lat * DEG_TO_RAD
  const decRad = eq.dec * DEG_TO_RAD
  const altRad = sunAltitudeDeg * DEG_TO_RAD
  const sinAlt = Math.sin(altRad)
  const sinLat = Math.sin(latRad)
  const cosLat = Math.cos(latRad)
  const sinDec = Math.sin(decRad)
  const cosDec = Math.cos(decRad)
  const denom = cosLat * cosDec

  // Near-pole edge cases where the target altitude may be unreachable.
  if (Math.abs(denom) < 1e-6) return { rising: 0, setting: 0 }

  const cosHa = (sinAlt - sinLat * sinDec) / denom

  // Target altitude does not occur for this latitude/date.
  if (cosHa < -1 || cosHa > 1) return { rising: 0, setting: 0 }

  const haHours = Math.acos(cosHa) * 12 / Math.PI   // radians → hours
  const gst = Astronomy.SiderealTime(t)               // hours
  let risingLon = (-haHours + eq.ra - gst) * 15       // hours → degrees
  let settingLon = (haHours + eq.ra - gst) * 15       // hours → degrees

  // Normalise to −180 … +180
  risingLon = ((risingLon % 360) + 540) % 360 - 180
  settingLon = ((settingLon % 360) + 540) % 360 - 180

  return { rising: risingLon, setting: settingLon }
}

export function sunHorizonLongitude(date: Date, lat: number, rising: boolean, sunAltitudeDeg = 0): number {
  const result = sunHorizonLongitudes(date, lat, sunAltitudeDeg)
  return rising ? result.rising : result.setting
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
const RAD_TO_DEG = 180 / Math.PI
const STAR_UNIT_VECTORS = STAR_CATALOG.map((star) => {
  const raRad = star.ra * 15 * DEG_TO_RAD
  const decRad = star.dec * DEG_TO_RAD
  const cosDec = Math.cos(decRad)
  return [cosDec * Math.cos(raRad), cosDec * Math.sin(raRad), Math.sin(decRad)] as const
})

function clampUnit(value: number): number {
  if (value < -1) return -1
  if (value > 1) return 1
  return value
}

function normalRefractionDegrees(altitudeDeg: number): number {
  if (altitudeDeg < -90 || altitudeDeg > 90) return 0
  let hd = altitudeDeg
  if (hd < -1) hd = -1
  let refr = 1.02 / Math.tan((hd + 10.3 / (hd + 5.11)) * DEG_TO_RAD) / 60
  if (altitudeDeg < -1) {
    refr *= (altitudeDeg + 90) / 89
  }
  return refr
}

function eqjUnitVectorToAltAz(x: number, y: number, z: number, eqjToHor: number[][]): AltAzPoint {
  // astronomy-engine rotation storage is column-major.
  const hx = eqjToHor[0][0] * x + eqjToHor[1][0] * y + eqjToHor[2][0] * z
  const hy = eqjToHor[0][1] * x + eqjToHor[1][1] * y + eqjToHor[2][1] * z
  const hz = eqjToHor[0][2] * x + eqjToHor[1][2] * y + eqjToHor[2][2] * z

  const geometricAltitude = Math.asin(clampUnit(hz)) * RAD_TO_DEG
  const altitude = geometricAltitude + normalRefractionDegrees(geometricAltitude)

  let azimuth = Math.atan2(-hy, hx) * RAD_TO_DEG
  if (azimuth < 0) azimuth += 360
  if (azimuth >= 360) azimuth -= 360

  return { altitude, azimuth }
}

export function getStarAltAzPositionsFromContext(context: SkyProjectionContext): StarAltAzPosition[] {
  const out = new Array<StarAltAzPosition>(STAR_UNIT_VECTORS.length)
  for (let i = 0; i < STAR_UNIT_VECTORS.length; i++) {
    const [x, y, z] = STAR_UNIT_VECTORS[i]
    const altAz = eqjUnitVectorToAltAz(x, y, z, context.eqjToHor)
    out[i] = {
      starIndex: i,
      altitude: altAz.altitude,
      azimuth: altAz.azimuth,
    }
  }
  return out
}

export function getStarAltAzPositions(date: Date, observer: ObserverLocation): StarAltAzPosition[] {
  return getStarAltAzPositionsFromContext(prepareSkyProjectionContext(date, observer))
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
const ECLIPTIC_UNIT_VECTORS = Array.from({ length: 360 }, (_, i) => {
  const lon = i * DEG_TO_RAD
  const cosLon = Math.cos(lon)
  const sinLon = Math.sin(lon)
  return [cosLon, sinLon * COS_OBL, sinLon * SIN_OBL] as const
})

/** Sample 360 points along the ecliptic and return their alt/az positions */
export function getEclipticAltAzPositionsFromContext(context: SkyProjectionContext): AltAzPoint[] {
  const points = new Array<AltAzPoint>(ECLIPTIC_UNIT_VECTORS.length)
  for (let i = 0; i < ECLIPTIC_UNIT_VECTORS.length; i++) {
    const [x, y, z] = ECLIPTIC_UNIT_VECTORS[i]
    points[i] = eqjUnitVectorToAltAz(x, y, z, context.eqjToHor)
  }
  return points
}

export function getEclipticAltAzPositions(date: Date, observer: ObserverLocation): AltAzPoint[] {
  return getEclipticAltAzPositionsFromContext(prepareSkyProjectionContext(date, observer))
}

// ============ HOR → EQJ rotation matrix (for texture reprojection) ============

/** Returns the 3×3 rotation matrix from horizontal (alt-az) to J2000 equatorial coordinates.
 *  Transposed from astronomy-engine's column-major storage so that standard
 *  row-major matrix×vector multiplication gives the correct result. */
export function getHORtoEQJMatrix(date: Date, observer: ObserverLocation): number[][] {
  return prepareSkyProjectionContext(date, observer).horToEqj
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

export function getMilkyWayPolygonsFromContext(context: SkyProjectionContext): MilkyWayLayer[] {
  const layers = new Array<MilkyWayLayer>(MW_LAYERS.length)

  for (let i = 0; i < MW_LAYERS.length; i++) {
    const layer = MW_LAYERS[i]
    const rings = new Array<AltAzPoint[]>(layer.rings.length)

    for (let j = 0; j < layer.rings.length; j++) {
      const ring = layer.rings[j]
      const points = new Array<AltAzPoint>(ring.length)
      for (let k = 0; k < ring.length; k++) {
        const [x, y, z] = ring[k]
        points[k] = eqjUnitVectorToAltAz(x, y, z, context.eqjToHor)
      }
      rings[j] = points
    }

    layers[i] = { id: layer.id, rings }
  }

  return layers
}

/** Transform pre-computed Milky Way polygon data to alt/az for the given date and observer */
export function getMilkyWayPolygons(date: Date, observer: ObserverLocation): MilkyWayLayer[] {
  return getMilkyWayPolygonsFromContext(prepareSkyProjectionContext(date, observer))
}
