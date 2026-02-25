import * as Astronomy from 'astronomy-engine'
import { CelestialBodyId, AlignmentDataPoint, AlignmentMinimum, AlignmentKind } from '../types'
import { MS_PER_DAY } from '../constants'

const BODY_MAP: Record<string, Astronomy.Body> = {
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto,
  Sun: Astronomy.Body.Sun,
}

export interface EclipticCoords {
  lon: number // degrees [0, 360)
  lat: number // degrees
}

/** FIFO cache for ephemeris lookups, keyed by "bodyId:dateMs" */
const ephemerisCache = new Map<string, EclipticCoords>()
const CACHE_MAX = 200_000 // ~20 years × 9 bodies with headroom

/** Get geocentric ecliptic coordinates for a body as seen from Earth (cached) */
export function getGeocentricEclipticCoords(bodyId: CelestialBodyId, date: Date): EclipticCoords {
  const body = BODY_MAP[bodyId]
  if (!body) return { lon: 0, lat: 0 }

  const key = `${bodyId}:${date.getTime()}`
  const cached = ephemerisCache.get(key)
  if (cached) return cached

  const geo = Astronomy.GeoVector(body, date, true)
  const ecl = Astronomy.Ecliptic(geo)
  const coords: EclipticCoords = { lon: ecl.elon, lat: ecl.elat }

  if (ephemerisCache.size >= CACHE_MAX) {
    ephemerisCache.clear()
  }
  ephemerisCache.set(key, coords)
  return coords
}

/**
 * Compute the max ecliptic longitude span of a set of longitudes.
 * Handles the 0°/360° wraparound correctly.
 *
 * Algorithm: sort longitudes, find the largest gap between consecutive values
 * (including wrap gap). The span = 360° - largest gap.
 */
export function computeMaxSpan(longitudes: number[]): number {
  if (longitudes.length < 2) return 0
  const sorted = [...longitudes].sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 1; i < sorted.length; i++) {
    maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1])
  }
  // Wrap gap: from last to first + 360
  const wrapGap = sorted[0] + 360 - sorted[sorted.length - 1]
  maxGap = Math.max(maxGap, wrapGap)
  return 360 - maxGap
}

/**
 * Compute the occupied arc of longitudes (start and end in [0, 360)).
 * The arc goes clockwise from `start` to `end` (i.e., the short way around
 * that doesn't cross the largest gap).
 * Returns null if fewer than 2 bodies.
 */
export function computeSpanArc(longitudes: number[]): { start: number; end: number } | null {
  if (longitudes.length < 2) return null
  const sorted = [...longitudes].sort((a, b) => a - b)

  let maxGap = -1
  let maxGapIdx = -1 // index of the element *before* the gap

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1]
    if (gap > maxGap) { maxGap = gap; maxGapIdx = i - 1 }
  }
  // Check wrap gap
  const wrapGap = sorted[0] + 360 - sorted[sorted.length - 1]
  if (wrapGap > maxGap) {
    // Largest gap is the wrap gap: arc starts at sorted[0], ends at sorted[last]
    return { start: sorted[0], end: sorted[sorted.length - 1] }
  }
  // Largest gap is between sorted[maxGapIdx] and sorted[maxGapIdx+1]
  // Arc starts after the gap and ends before it
  return { start: sorted[maxGapIdx + 1], end: sorted[maxGapIdx] }
}

/** Normalize an angle to [-180, +180] */
export function wrap180(d: number): number {
  return ((d % 360) + 540) % 360 - 180
}

/**
 * Compute alignment separation series at daily intervals, including morning/evening splits.
 * `minPlanets` controls how many of the selected planets must be in the AM/PM window
 * for that sub-range to be computed (default: all of them).
 */
export function computeAlignmentSeries(
  bodies: CelestialBodyId[],
  startDate: Date,
  durationDays: number,
  minPlanets: number = bodies.length,
): AlignmentDataPoint[] {
  const points: AlignmentDataPoint[] = []
  const startMs = startDate.getTime()
  const threshold = Math.max(2, minPlanets)

  for (let d = 0; d <= durationDays; d++) {
    const dateMs = startMs + d * MS_PER_DAY
    const date = new Date(dateMs)

    const sunLon = getGeocentricEclipticCoords('Sun', date).lon
    const lons = bodies.map((b) => getGeocentricEclipticCoords(b, date).lon)

    // Classify planets by elongation from Sun
    const morningLons: number[] = [] // west of Sun
    const eveningLons: number[] = [] // east of Sun
    for (const lon of lons) {
      const elong = wrap180(lon - sunLon)
      if (elong >= 0) eveningLons.push(lon)
      else morningLons.push(lon)
    }

    // AM/PM spans require at least `threshold` planets in that window
    points.push({
      date: dateMs,
      separation: computeMaxSpan(lons),
      morningSep: morningLons.length >= threshold ? computeMaxSpan(morningLons) : null,
      eveningSep: eveningLons.length >= threshold ? computeMaxSpan(eveningLons) : null,
    })
  }

  return points
}

/**
 * Find local minima in a value series extracted by `key`.
 * Handles plateaus by tracking descending runs and emitting the midpoint.
 * Also checks the series endpoints and null-bounded segment edges.
 */
export function findLocalMinima(
  series: AlignmentDataPoint[],
  key: 'separation' | 'morningSep' | 'eveningSep' = 'separation',
  kind: AlignmentKind = 'total',
  threshold: number = 360,
): AlignmentMinimum[] {
  if (series.length < 3) return []

  const raw = (i: number) => series[i][key]
  // Treat null as Infinity so boundaries act like endpoints
  const val = (i: number) => { const v = raw(i); return v == null ? Infinity : v }
  const valid = (i: number) => raw(i) != null
  const minima: AlignmentMinimum[] = []

  // Check if the first valid point is a local minimum (series start or null boundary)
  if (valid(0) && val(0) <= val(1) && val(0) <= threshold) {
    minima.push({ date: series[0].date, separation: val(0), kind })
  }

  let i = 1
  while (i < series.length - 1) {
    if (!valid(i)) { i++; continue }
    if (val(i) <= val(i - 1)) {
      let j = i
      while (j < series.length - 1 && valid(j + 1) && val(j + 1) === val(i)) j++
      const leftHigher = val(i) < val(i - 1) // true if left is null (Infinity) or genuinely higher
      const rightHigher = j >= series.length - 1 || val(i) < val(j + 1) // treat series end as wall
      if (leftHigher && rightHigher && val(i) <= threshold) {
        const mid = Math.floor((i + j) / 2)
        minima.push({ date: series[mid].date, separation: val(mid), kind })
      }
      i = j + 1
    } else {
      i++
    }
  }

  const last = series.length - 1
  if (valid(last) && val(last) <= val(last - 1) && val(last) <= threshold) {
    minima.push({ date: series[last].date, separation: val(last), kind })
  }

  return minima
}
