import * as Astronomy from 'astronomy-engine'
import {
  CelestialBodyId,
  AlignmentDataPoint,
  AlignmentTabDataPoint,
  AlignmentMinimum,
  AlignmentKind,
  AlignmentResult,
} from '../types'
import { MS_PER_DAY } from '../constants'

const BODY_MAP: Record<string, Astronomy.Body> = {
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Moon: Astronomy.Body.Moon,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
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

// ─── Combination-based classification ──────────────────────────────────

/** Standard k-combination generator (yields index arrays) */
export function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k <= 0 || k > arr.length) return
  const indices = Array.from({ length: k }, (_, i) => i)
  yield indices.map((i) => arr[i])
  while (true) {
    let i = k - 1
    while (i >= 0 && indices[i] === arr.length - k + i) i--
    if (i < 0) return
    indices[i]++
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1
    yield indices.map((i) => arr[i])
  }
}

/**
 * Test whether a longitude falls inside a span arc (the short arc that
 * doesn't cross the largest gap). Arc goes from `start` to `end` in the
 * increasing-longitude direction (wrapping through 360).
 */
export function isLonInsideArc(lon: number, arc: { start: number; end: number }): boolean {
  // Normalize to [0, 360)
  const l = ((lon % 360) + 360) % 360
  if (arc.start <= arc.end) {
    // Arc doesn't wrap: simply start ≤ lon ≤ end
    return l >= arc.start && l <= arc.end
  }
  // Arc wraps through 0: lon is inside if lon >= start OR lon <= end
  return l >= arc.start || l <= arc.end
}

/**
 * Classify a combination of planets as morning, evening, or straddling.
 *
 * Each combination is classified as a whole unit:
 * - All planets same side → morning or evening
 * - Mixed sides, Sun inside the combination arc → straddling
 * - Mixed sides, Sun outside arc → closest-to-Sun planet determines AM/PM
 */
export function classifyCombination(
  planetElongations: number[],
  planetLongitudes: number[],
  sunLon: number,
): AlignmentKind {
  const allNeg = planetElongations.every((e) => e < 0)
  const allNonNeg = planetElongations.every((e) => e >= 0)

  if (allNeg) return 'morning'
  if (allNonNeg) return 'evening'

  // Mixed sides — check if Sun is inside the combination's ecliptic arc
  const arc = computeSpanArc(planetLongitudes)
  if (arc && isLonInsideArc(sunLon, arc)) {
    return 'straddling'
  }

  // Sun is outside arc (midnight cluster). Closest-to-Sun planet determines.
  let minAbsElong = Infinity
  let closestElong = 0
  for (const e of planetElongations) {
    if (Math.abs(e) < minAbsElong) {
      minAbsElong = Math.abs(e)
      closestElong = e
    }
  }
  return closestElong < 0 ? 'morning' : 'evening'
}

/** Result of finding the best k-combination for a given date */
export interface BestCombination {
  indices: number[]          // indices into the bodies array
  bodies: CelestialBodyId[]  // the actual body IDs
  longitudes: number[]       // ecliptic longitudes of the combo
  elongations: number[]      // elongations from Sun
  span: number               // ecliptic span in degrees
  kind: AlignmentKind        // classification
}

/**
 * Find the tightest k-planet combination from a set of bodies on a given date.
 * Returns the combination with the smallest span across all classifications.
 * Used by SkyView and AlignmentCones to highlight the active tab's best combo.
 */
export function findBestCombination(
  bodies: CelestialBodyId[],
  date: Date,
  k: number,
): BestCombination | null {
  const N = bodies.length
  if (k < 2 || k > N) return null

  const sunLon = getGeocentricEclipticCoords('Sun', date).lon
  const allLons: number[] = new Array(N)
  const allElongs: number[] = new Array(N)
  for (let i = 0; i < N; i++) {
    allLons[i] = getGeocentricEclipticCoords(bodies[i], date).lon
    allElongs[i] = wrap180(allLons[i] - sunLon)
  }

  // If k === N, no need to iterate combinations
  if (k === N) {
    const kind = classifyCombination(allElongs, allLons, sunLon)
    return {
      indices: Array.from({ length: N }, (_, i) => i),
      bodies: [...bodies],
      longitudes: [...allLons],
      elongations: [...allElongs],
      span: computeMaxSpan(allLons),
      kind,
    }
  }

  const bodyIndices = Array.from({ length: N }, (_, i) => i)
  let bestSpan = Infinity
  let bestCombo: number[] = []

  for (const combo of combinations(bodyIndices, k)) {
    const lons = combo.map((i) => allLons[i])
    const span = computeMaxSpan(lons)
    if (span < bestSpan) {
      bestSpan = span
      bestCombo = [...combo]
    }
  }

  if (bestCombo.length === 0) return null

  const lons = bestCombo.map((i) => allLons[i])
  const elongs = bestCombo.map((i) => allElongs[i])
  return {
    indices: bestCombo,
    bodies: bestCombo.map((i) => bodies[i]),
    longitudes: lons,
    elongations: elongs,
    span: bestSpan,
    kind: classifyCombination(elongs, lons, sunLon),
  }
}

export type BestPerKind = Record<AlignmentKind, BestCombination | null>

/**
 * Find the tightest k-planet combination per classification kind.
 * Returns one best combo for each of morning, evening, straddling.
 */
export function findBestPerKind(
  bodies: CelestialBodyId[],
  date: Date,
  k: number,
): BestPerKind {
  const result: BestPerKind = { morning: null, evening: null, straddling: null }
  const N = bodies.length
  if (k < 2 || k > N) return result

  const sunLon = getGeocentricEclipticCoords('Sun', date).lon
  const allLons: number[] = new Array(N)
  const allElongs: number[] = new Array(N)
  for (let i = 0; i < N; i++) {
    allLons[i] = getGeocentricEclipticCoords(bodies[i], date).lon
    allElongs[i] = wrap180(allLons[i] - sunLon)
  }

  const bestSpans: Record<AlignmentKind, number> = { morning: Infinity, evening: Infinity, straddling: Infinity }
  const bestCombos: Record<AlignmentKind, number[]> = { morning: [], evening: [], straddling: [] }

  const evaluate = (combo: number[]) => {
    const lons = combo.map((i) => allLons[i])
    const elongs = combo.map((i) => allElongs[i])
    const span = computeMaxSpan(lons)
    const kind = classifyCombination(elongs, lons, sunLon)
    if (span < bestSpans[kind]) {
      bestSpans[kind] = span
      bestCombos[kind] = [...combo]
    }
  }

  if (k === N) {
    const all = Array.from({ length: N }, (_, i) => i)
    evaluate(all)
  } else {
    const bodyIndices = Array.from({ length: N }, (_, i) => i)
    for (const combo of combinations(bodyIndices, k)) {
      evaluate(combo)
    }
  }

  for (const kind of ['morning', 'evening', 'straddling'] as AlignmentKind[]) {
    const combo = bestCombos[kind]
    if (combo.length === 0) continue
    const lons = combo.map((i) => allLons[i])
    const elongs = combo.map((i) => allElongs[i])
    result[kind] = {
      indices: combo,
      bodies: combo.map((i) => bodies[i]),
      longitudes: lons,
      elongations: elongs,
      span: bestSpans[kind],
      kind,
    }
  }

  return result
}

// ─── Legacy API (used by old tests, retained for backward compat) ──────

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
      morningCount: morningLons.length,
      eveningCount: eveningLons.length,
      totalCount: lons.length,
    })
  }

  return points
}

// ─── New combination-based algorithm ───────────────────────────────────

/** Pre-computed ephemeris data for a single day */
interface DayEphemeris {
  dateMs: number
  sunLon: number
  bodyLons: number[]      // parallel to the bodies array
  bodyElongs: number[]    // elongation from Sun, parallel to bodies array
}

/**
 * Compute alignment data for all tab sizes (combination-based).
 *
 * For each tab k (from N down to max(minPlanets, N-3)):
 *   For each day, iterate all N-choose-k combinations
 *   Classify each combination, keep tightest span per category
 */
export function computeAlignmentTabs(
  bodies: CelestialBodyId[],
  startDate: Date,
  durationDays: number,
  minPlanets: number,
  maxPlanets?: number,
): AlignmentResult {
  const N = bodies.length
  const minK = Math.max(2, minPlanets)
  const maxK = maxPlanets != null ? Math.min(N, maxPlanets) : N
  const lowK = Math.max(minK, maxK - 3)

  const tabs = new Map<number, AlignmentTabDataPoint[]>()
  const minima = new Map<number, AlignmentMinimum[]>()

  if (N < 2) return { tabs, minima }

  const startMs = startDate.getTime()
  const numDays = durationDays + 1

  // Phase 1: Pre-compute ephemeris for all days (O(N × days))
  const ephemeris: DayEphemeris[] = new Array(numDays)
  for (let d = 0; d < numDays; d++) {
    const dateMs = startMs + d * MS_PER_DAY
    const date = new Date(dateMs)
    const sunLon = getGeocentricEclipticCoords('Sun', date).lon
    const bodyLons: number[] = new Array(N)
    const bodyElongs: number[] = new Array(N)
    for (let b = 0; b < N; b++) {
      bodyLons[b] = getGeocentricEclipticCoords(bodies[b], date).lon
      bodyElongs[b] = wrap180(bodyLons[b] - sunLon)
    }
    ephemeris[d] = { dateMs, sunLon, bodyLons, bodyElongs }
  }

  // Phase 2: For each tab k, compute daily best spans per category
  // Use index arrays to avoid allocating new arrays per combination
  const bodyIndices = Array.from({ length: N }, (_, i) => i)

  for (let k = maxK; k >= lowK; k--) {
    const tabPoints: AlignmentTabDataPoint[] = new Array(numDays)

    for (let d = 0; d < numDays; d++) {
      const day = ephemeris[d]
      let bestMorning = Infinity
      let bestEvening = Infinity
      let bestStraddling = Infinity

      for (const combo of combinations(bodyIndices, k)) {
        const lons = combo.map((i) => day.bodyLons[i])
        const elongs = combo.map((i) => day.bodyElongs[i])
        const span = computeMaxSpan(lons)
        const kind = classifyCombination(elongs, lons, day.sunLon)

        if (kind === 'morning' && span < bestMorning) bestMorning = span
        else if (kind === 'evening' && span < bestEvening) bestEvening = span
        else if (kind === 'straddling' && span < bestStraddling) bestStraddling = span
      }

      tabPoints[d] = {
        date: day.dateMs,
        morningSep: bestMorning < Infinity ? bestMorning : null,
        eveningSep: bestEvening < Infinity ? bestEvening : null,
        straddlingSep: bestStraddling < Infinity ? bestStraddling : null,
      }
    }

    tabs.set(k, tabPoints)

    // Phase 3: Find minima for this tab + identify planets at each minimum
    const tabMinima: AlignmentMinimum[] = []
    for (const [field, kind] of [
      ['morningSep', 'morning'],
      ['eveningSep', 'evening'],
      ['straddlingSep', 'straddling'],
    ] as const) {
      const fieldMinima = findTabLocalMinima(tabPoints, field, kind, k)
      // Identify planets for each minimum
      for (const m of fieldMinima) {
        m.planets = identifyMinimumPlanets(
          bodies, bodyIndices, k, m.date, m.kind, ephemeris, startMs,
        )
      }
      tabMinima.push(...fieldMinima)
    }
    tabMinima.sort((a, b) => a.date - b.date)
    minima.set(k, tabMinima)
  }

  return { tabs, minima }
}

/**
 * Find local minima in a tab data point series for a specific field.
 * Adapted from the original findLocalMinima for AlignmentTabDataPoint.
 */
function findTabLocalMinima(
  series: AlignmentTabDataPoint[],
  key: 'morningSep' | 'eveningSep' | 'straddlingSep',
  kind: AlignmentKind,
  planetCount: number,
  threshold: number = 360,
): AlignmentMinimum[] {
  if (series.length < 3) return []

  const raw = (i: number) => series[i][key]
  const val = (i: number) => { const v = raw(i); return v == null ? Infinity : v }
  const valid = (i: number) => raw(i) != null
  const minima: AlignmentMinimum[] = []

  if (valid(0) && val(0) <= val(1) && val(0) <= threshold) {
    minima.push({ date: series[0].date, separation: val(0), kind, planetCount, planets: [] })
  }

  let i = 1
  while (i < series.length - 1) {
    if (!valid(i)) { i++; continue }
    if (val(i) <= val(i - 1)) {
      let j = i
      while (j < series.length - 1 && valid(j + 1) && val(j + 1) === val(i)) j++
      const leftHigher = val(i) < val(i - 1)
      const rightHigher = j >= series.length - 1 || val(i) < val(j + 1)
      if (leftHigher && rightHigher && val(i) <= threshold) {
        const mid = Math.floor((i + j) / 2)
        minima.push({ date: series[mid].date, separation: val(mid), kind, planetCount, planets: [] })
      }
      i = j + 1
    } else {
      i++
    }
  }

  const last = series.length - 1
  if (valid(last) && val(last) <= val(last - 1) && val(last) <= threshold) {
    minima.push({ date: series[last].date, separation: val(last), kind, planetCount, planets: [] })
  }

  return minima
}

/**
 * At a minimum date, re-evaluate combinations to find which planets form
 * the tightest cluster of the given kind.
 */
function identifyMinimumPlanets(
  bodies: CelestialBodyId[],
  bodyIndices: number[],
  k: number,
  dateMs: number,
  kind: AlignmentKind,
  ephemeris: DayEphemeris[],
  startMs: number,
): CelestialBodyId[] {
  const dayIdx = Math.round((dateMs - startMs) / MS_PER_DAY)
  if (dayIdx < 0 || dayIdx >= ephemeris.length) return []

  const day = ephemeris[dayIdx]
  let bestSpan = Infinity
  let bestCombo: number[] = []

  for (const combo of combinations(bodyIndices, k)) {
    const lons = combo.map((i) => day.bodyLons[i])
    const elongs = combo.map((i) => day.bodyElongs[i])
    const comboKind = classifyCombination(elongs, lons, day.sunLon)
    if (comboKind !== kind) continue
    const span = computeMaxSpan(lons)
    if (span < bestSpan) {
      bestSpan = span
      bestCombo = [...combo]
    }
  }

  return bestCombo.map((i) => bodies[i])
}

// ─── Legacy findLocalMinima (kept for backward compat with old tests) ──

/**
 * Find local minima in a value series extracted by `key`.
 * Handles plateaus by tracking descending runs and emitting the midpoint.
 * Also checks the series endpoints and null-bounded segment edges.
 */
export function findLocalMinima(
  series: AlignmentDataPoint[],
  key: 'separation' | 'morningSep' | 'eveningSep' = 'separation',
  kind: 'morning' | 'evening' | 'total' = 'total',
  threshold: number = 360,
): AlignmentMinimum[] {
  if (series.length < 3) return []

  const raw = (i: number) => series[i][key]
  const val = (i: number) => { const v = raw(i); return v == null ? Infinity : v }
  const valid = (i: number) => raw(i) != null
  const countAt = (i: number) => {
    const pt = series[i]
    if (kind === 'morning') return pt.morningCount
    if (kind === 'evening') return pt.eveningCount
    return pt.totalCount
  }
  const minima: AlignmentMinimum[] = []

  if (valid(0) && val(0) <= val(1) && val(0) <= threshold) {
    minima.push({ date: series[0].date, separation: val(0), kind: kind === 'total' ? 'morning' : kind, planetCount: countAt(0), planets: [] })
  }

  let i = 1
  while (i < series.length - 1) {
    if (!valid(i)) { i++; continue }
    if (val(i) <= val(i - 1)) {
      let j = i
      while (j < series.length - 1 && valid(j + 1) && val(j + 1) === val(i)) j++
      const leftHigher = val(i) < val(i - 1)
      const rightHigher = j >= series.length - 1 || val(i) < val(j + 1)
      if (leftHigher && rightHigher && val(i) <= threshold) {
        const mid = Math.floor((i + j) / 2)
        minima.push({ date: series[mid].date, separation: val(mid), kind: kind === 'total' ? 'morning' : kind, planetCount: countAt(mid), planets: [] })
      }
      i = j + 1
    } else {
      i++
    }
  }

  const last = series.length - 1
  if (valid(last) && val(last) <= val(last - 1) && val(last) <= threshold) {
    minima.push({ date: series[last].date, separation: val(last), kind: kind === 'total' ? 'morning' : kind, planetCount: countAt(last), planets: [] })
  }

  return minima
}
