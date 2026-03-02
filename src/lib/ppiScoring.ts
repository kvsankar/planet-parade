import {
  CelestialBodyId,
  AlignmentKind,
  PPIWeights,
  PPIDayPoint,
  PPIResult,
  CountDayBest,
} from '../types'
import { MS_PER_DAY } from '../constants'
import {
  getGeocentricEclipticCoords,
  computeMaxSpan,
  wrap180,
  classifyCombination,
  combinations,
} from './alignment'
import { getBodyVisualMagnitude, SkyBodyId } from './astronomy'

/** Visibility preset: tight bright clusters, mild visibility gate.
 *  Derived from parameter sweep + manual audit of top-50 peaks (2000–2026).
 *  γ=0.25 penalises dim planets (Uranus/Neptune) without eliminating them
 *  from genuinely compelling geometric groupings. */
export const DEFAULT_PPI_WEIGHTS: PPIWeights = { alpha: 1.0, beta: 2.0, gamma: 0.25, delta: 0.25, spanScale: 180 }

/** Media preset: best match to public "planet parade" dates.
 *  Derived from count-aware parameter sweep (960 combos × 10 known events).
 *  α=2.0 favours count; β=0.25 tolerates wide spans (media parades often
 *  cover 90–175°); γ=0.25 mild brightness penalty; δ=0.75 strong
 *  visibility gate. Achieves 9/9 planet-count matches, 5/9 within ±5d. */
export const MEDIA_PPI_WEIGHTS: PPIWeights = { alpha: 2.0, beta: 0.25, gamma: 0.25, delta: 0.75, spanScale: 180 }

/** Per-planet brightness weight: maps visual magnitude to [0.01, 1.0] */
export function brightnessWeight(mag: number): number {
  return Math.max(0.01, Math.min(1.0, (6.5 - mag) / 6.5))
}

/** Per-planet elongation visibility gate (smoothstep 5°–30°) */
export function elongationWeight(absElong: number): number {
  if (absElong <= 5) return 0
  if (absElong >= 30) return 1
  const t = (absElong - 5) / 25
  return t * t * (3 - 2 * t)
}

export interface ComboPPIResult {
  ppi: number
  brightness: number
  elongVisibility: number
}

/** Compute PPI for a single combination */
export function computeComboPPI(
  k: number,
  N: number,
  span: number,
  mags: number[],
  absElongs: number[],
  weights: PPIWeights,
): ComboPPIResult {
  // Geometric mean of brightness weights
  let logBright = 0
  for (let i = 0; i < k; i++) {
    logBright += Math.log(brightnessWeight(mags[i]))
  }
  const brightness = Math.exp(logBright / k)

  // Minimum elongation weight — the least-visible planet is the bottleneck
  // delta=1: full gate (default). delta=0: no gate (pure geometry).
  // Effective weight = lerp(1, rawWeight, delta) = 1 - delta*(1 - rawWeight)
  const d = weights.delta
  let elongVisibility = Infinity
  for (let i = 0; i < k; i++) {
    const raw = elongationWeight(absElongs[i])
    const ew = 1 - d * (1 - raw)
    if (ew < elongVisibility) elongVisibility = ew
  }

  const countFactor = Math.pow(k / N, weights.alpha)
  const compactFactor = Math.pow(Math.exp(-span / weights.spanScale), weights.beta)
  const brightFactor = Math.pow(brightness, weights.gamma)

  const ppi = countFactor * compactFactor * brightFactor * elongVisibility * 100

  return { ppi, brightness, elongVisibility }
}

/** Pre-computed ephemeris for PPI computation */
interface PPIDayEphemeris {
  dateMs: number
  sunLon: number
  bodyLons: number[]
  bodyElongs: number[]     // signed elongation from Sun
  bodyAbsElongs: number[]  // absolute elongation
  bodyMags: number[]       // visual magnitudes
}

/** Main PPI computation across all days and combinations */
export function computePPIResults(
  bodies: CelestialBodyId[],
  startDate: Date,
  durationDays: number,
  minPlanets: number,
  weights: PPIWeights,
  maxPlanets?: number,
): PPIResult {
  const N = bodies.length
  const highK = maxPlanets != null ? Math.min(N, maxPlanets) : N
  const lowK = Math.max(2, minPlanets)
  const numDays = durationDays + 1
  const startMs = startDate.getTime()

  if (N < 2) return { ppiSeries: [], ppiPeaks: [], spanMinima: [], dates: [], countBests: new Map() }

  // Phase 1: Pre-compute ephemeris for all days
  const ephemeris: PPIDayEphemeris[] = new Array(numDays)
  for (let d = 0; d < numDays; d++) {
    const dateMs = startMs + d * MS_PER_DAY
    const date = new Date(dateMs)
    const sunLon = getGeocentricEclipticCoords('Sun', date).lon
    const bodyLons: number[] = new Array(N)
    const bodyElongs: number[] = new Array(N)
    const bodyAbsElongs: number[] = new Array(N)
    const bodyMags: number[] = new Array(N)
    for (let b = 0; b < N; b++) {
      bodyLons[b] = getGeocentricEclipticCoords(bodies[b], date).lon
      bodyElongs[b] = wrap180(bodyLons[b] - sunLon)
      bodyAbsElongs[b] = Math.abs(bodyElongs[b])
      bodyMags[b] = getBodyVisualMagnitude(bodies[b] as SkyBodyId, date) ?? 6.5
    }
    ephemeris[d] = { dateMs, sunLon, bodyLons, bodyElongs, bodyAbsElongs, bodyMags }
  }

  // Phase 2: For each day, find the best-PPI combo across all k and all kinds
  const bodyIndices = Array.from({ length: N }, (_, i) => i)

  interface DayBest {
    ppi: number
    span: number
    kind: AlignmentKind
    planets: CelestialBodyId[]
    planetCount: number
    brightness: number
    elongVisibility: number
  }

  const dayBests: (DayBest | null)[] = new Array(numDays)

  // Per-count tracking
  const countBests = new Map<number, (CountDayBest | null)[]>()
  for (let k = highK; k >= lowK; k--) {
    countBests.set(k, new Array(numDays).fill(null))
  }

  for (let d = 0; d < numDays; d++) {
    const day = ephemeris[d]
    let best: DayBest | null = null

    for (let k = highK; k >= lowK; k--) {
      let bestForK: CountDayBest | null = null

      const evaluate = (combo: number[]) => {
        const lons = combo.map((i) => day.bodyLons[i])
        const elongs = combo.map((i) => day.bodyElongs[i])
        const absElongs = combo.map((i) => day.bodyAbsElongs[i])
        const mags = combo.map((i) => day.bodyMags[i])
        const span = computeMaxSpan(lons)
        const kind = classifyCombination(elongs, lons, day.sunLon)

        if (kind === 'straddling') return

        const result = computeComboPPI(k, N, span, mags, absElongs, weights)
        if (result.ppi > (best?.ppi ?? 0)) {
          best = {
            ppi: result.ppi,
            span,
            kind,
            planets: combo.map((i) => bodies[i]),
            planetCount: k,
            brightness: result.brightness,
            elongVisibility: result.elongVisibility,
          }
        }
        if (result.ppi > (bestForK?.ppi ?? 0)) {
          bestForK = {
            ppi: result.ppi,
            span,
            kind,
            planets: combo.map((i) => bodies[i]),
          }
        }
      }

      if (k === N) {
        evaluate(bodyIndices)
      } else {
        for (const combo of combinations(bodyIndices, k)) {
          evaluate(combo)
        }
      }

      countBests.get(k)![d] = bestForK
    }

    dayBests[d] = best
  }

  // Phase 3: Build ppiSeries
  const ppiSeries: { date: number; ppi: number }[] = new Array(numDays)
  for (let d = 0; d < numDays; d++) {
    ppiSeries[d] = { date: ephemeris[d].dateMs, ppi: dayBests[d]?.ppi ?? 0 }
  }

  // Phase 4: Find extrema — PPI peaks and span minima from overall-best series
  const ppiPeaks = findPPIPeaks(ppiSeries, dayBests)
  const spanSeries = dayBests.map((b, d) => ({ date: ephemeris[d].dateMs, span: b?.span ?? 0 }))
  const spanMinima = findSpanMinima(spanSeries, dayBests)

  // Build dates array
  const dates = ephemeris.map((e) => e.dateMs)

  return { ppiSeries, ppiPeaks, spanMinima, dates, countBests }
}

/** Compute ALL non-zero PPI combos for a single date */
export function computeDayCombos(
  bodies: CelestialBodyId[],
  date: Date,
  minPlanets: number,
  weights: PPIWeights,
  maxPlanets?: number,
): PPIDayPoint[] {
  const N = bodies.length
  if (N < 2) return []

  const highK = maxPlanets != null ? Math.min(N, maxPlanets) : N
  const lowK = Math.max(2, minPlanets)
  const dateMs = date.getTime()

  // Pre-compute ephemeris for this single day
  const sunLon = getGeocentricEclipticCoords('Sun', date).lon
  const bodyLons: number[] = new Array(N)
  const bodyElongs: number[] = new Array(N)
  const bodyAbsElongs: number[] = new Array(N)
  const bodyMags: number[] = new Array(N)
  for (let b = 0; b < N; b++) {
    bodyLons[b] = getGeocentricEclipticCoords(bodies[b], date).lon
    bodyElongs[b] = wrap180(bodyLons[b] - sunLon)
    bodyAbsElongs[b] = Math.abs(bodyElongs[b])
    bodyMags[b] = getBodyVisualMagnitude(bodies[b] as SkyBodyId, date) ?? 6.5
  }

  const results: PPIDayPoint[] = []
  const bodyIndices = Array.from({ length: N }, (_, i) => i)

  for (let k = highK; k >= lowK; k--) {
    const evaluate = (combo: number[]) => {
      const lons = combo.map((i) => bodyLons[i])
      const elongs = combo.map((i) => bodyElongs[i])
      const absElongs = combo.map((i) => bodyAbsElongs[i])
      const mags = combo.map((i) => bodyMags[i])
      const span = computeMaxSpan(lons)
      const kind = classifyCombination(elongs, lons, sunLon)

      if (kind === 'straddling') return

      const result = computeComboPPI(k, N, span, mags, absElongs, weights)
      if (result.ppi > 0) {
        results.push({
          date: dateMs,
          ppi: result.ppi,
          span,
          kind,
          planetCount: k,
          planets: combo.map((i) => bodies[i]),
          brightness: result.brightness,
          elongVisibility: result.elongVisibility,
        })
      }
    }

    if (k === N) {
      evaluate(bodyIndices)
    } else {
      for (const combo of combinations(bodyIndices, k)) {
        evaluate(combo)
      }
    }
  }

  // Sort by PPI descending
  results.sort((a, b) => b.ppi - a.ppi)
  return results
}

type DayDetail = PPIDayPoint | { ppi: number; span: number; kind: AlignmentKind; planets: CelestialBodyId[]; planetCount: number; brightness: number; elongVisibility: number } | null

/** Generic extrema finder: maxima (mode='max') or minima (mode='min') with plateau handling */
function findExtrema(
  values: number[],
  dates: number[],
  dayDetails: DayDetail[],
  mode: 'max' | 'min',
): PPIDayPoint[] {
  const n = values.length
  if (n < 3) return []

  // For maxima: a > b / a >= b (natural — positive always beats zero)
  // For minima: treat zero/negative neighbors as segment boundaries so
  // edge values of non-zero segments are detected as candidates
  const isBetter = mode === 'max'
    ? (a: number, b: number) => a > b
    : (a: number, b: number) => a < b || b <= 0
  const isBetterOrEq = mode === 'max'
    ? (a: number, b: number) => a >= b
    : (a: number, b: number) => a <= b || b <= 0

  const results: PPIDayPoint[] = []

  const add = (i: number) => {
    const detail = dayDetails[i]
    if (!detail || values[i] <= 0) return
    results.push({
      date: dates[i],
      ppi: detail.ppi,
      span: detail.span,
      kind: detail.kind,
      planetCount: detail.planetCount,
      planets: detail.planets,
      brightness: detail.brightness,
      elongVisibility: detail.elongVisibility,
    })
  }

  // Check start
  if (values[0] > 0 && isBetterOrEq(values[0], values[1])) {
    add(0)
  }

  // Interior points with plateau handling
  let i = 1
  while (i < n - 1) {
    if (isBetterOrEq(values[i], values[i - 1])) {
      let j = i
      while (j < n - 1 && values[j + 1] === values[i]) j++
      if (isBetter(values[i], values[i - 1]) && (j >= n - 1 || isBetter(values[i], values[j + 1]))) {
        add(i)
      }
      i = j + 1
    } else {
      i++
    }
  }

  // Check end
  const last = n - 1
  if (values[last] > 0 && isBetterOrEq(values[last], values[last - 1])) {
    add(last)
  }

  return results
}

/** Find local maxima in the PPI time series */
export function findPPIPeaks(
  series: { date: number; ppi: number }[],
  dayDetails: DayDetail[],
): PPIDayPoint[] {
  return findExtrema(series.map(s => s.ppi), series.map(s => s.date), dayDetails, 'max')
}

/** Find local minima in the span time series (tightest clusters) */
export function findSpanMinima(
  series: { date: number; span: number }[],
  dayDetails: DayDetail[],
): PPIDayPoint[] {
  return findExtrema(series.map(s => s.span), series.map(s => s.date), dayDetails, 'min')
}
