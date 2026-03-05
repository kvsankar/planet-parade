import {
  CelestialBodyId,
  AlignmentKind,
  PPIWeights,
  PPIDayPoint,
  PPIResult,
  CountDayBest,
  RankingMetric,
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

export interface ScoringOptions {
  includeStraddling?: boolean
  rankingMetric?: RankingMetric
  sampleStepMs?: number
  dayRangeStartMs?: number
  dayRangeEndMs?: number
}

interface ScoredCombo {
  date: number
  ppi: number
  span: number
  kind: AlignmentKind
  planets: CelestialBodyId[]
  planetCount: number
  brightness: number
  elongVisibility: number
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

function getGeometrySampleStepMs(durationDays: number): number {
  if (durationDays > 3650) return 6 * HOUR_MS
  if (durationDays > 365) return 3 * HOUR_MS
  return HOUR_MS
}

function buildSampleOffsets(stepMs: number): number[] {
  const offsets: number[] = []
  const safeStep = Math.max(15 * 60_000, Math.min(DAY_MS, stepMs))
  for (let t = 0; t < DAY_MS; t += safeStep) {
    offsets.push(t)
  }
  if (offsets.length === 0) offsets.push(0)
  return offsets
}

function isBetterByRanking(
  next: Pick<ScoredCombo, 'ppi' | 'span' | 'planetCount'>,
  prev: Pick<ScoredCombo, 'ppi' | 'span' | 'planetCount'> | null,
  rankingMetric: RankingMetric,
): boolean {
  if (!prev) return true

  if (rankingMetric === 'span') {
    if (next.span !== prev.span) return next.span < prev.span
    if (next.planetCount !== prev.planetCount) return next.planetCount > prev.planetCount
    return next.ppi > prev.ppi
  }

  if (next.ppi !== prev.ppi) return next.ppi > prev.ppi
  if (next.planetCount !== prev.planetCount) return next.planetCount > prev.planetCount
  return next.span < prev.span
}

/** Main PPI computation across all days and combinations */
export function computePPIResults(
  bodies: CelestialBodyId[],
  startDate: Date,
  durationDays: number,
  minPlanets: number,
  weights: PPIWeights,
  maxPlanets?: number,
  options?: ScoringOptions,
): PPIResult {
  const includeStraddling = options?.includeStraddling ?? false
  const rankingMetric = options?.rankingMetric ?? 'ppi'
  const N = bodies.length
  const highK = maxPlanets != null ? Math.min(N, maxPlanets) : N
  const lowK = Math.max(2, minPlanets)
  const numDays = durationDays + 1
  const startMs = startDate.getTime()
  const sampleStepMs = options?.sampleStepMs
    ?? (rankingMetric === 'span' ? getGeometrySampleStepMs(durationDays) : DAY_MS)
  const sampleOffsetsMs = buildSampleOffsets(sampleStepMs)

  if (N < 2) return { ppiSeries: [], ppiPeaks: [], spanMinima: [], dates: [], countBests: new Map() }

  const buildEphemerisAt = (dateMs: number): PPIDayEphemeris => {
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
    return { dateMs, sunLon, bodyLons, bodyElongs, bodyAbsElongs, bodyMags }
  }

  // Phase 2: For each day, find the best-PPI combo across all k and all kinds
  const bodyIndices = Array.from({ length: N }, (_, i) => i)

  const dayBests: (ScoredCombo | null)[] = new Array(numDays)

  // Per-count tracking
  const countBests = new Map<number, (CountDayBest | null)[]>()
  for (let k = highK; k >= lowK; k--) {
    countBests.set(k, new Array(numDays).fill(null))
  }

  const bestTimes = new Array<number>(numDays)

  for (let d = 0; d < numDays; d++) {
    const dayBaseMs = startMs + d * MS_PER_DAY
    const daySamples: PPIDayEphemeris[] = sampleOffsetsMs.map((offsetMs) => buildEphemerisAt(dayBaseMs + offsetMs))
    let best: ScoredCombo | null = null

    for (let k = highK; k >= lowK; k--) {
      let bestForK: CountDayBest | null = null

      const evaluate = (day: PPIDayEphemeris, combo: number[]) => {
        const lons = combo.map((i) => day.bodyLons[i])
        const elongs = combo.map((i) => day.bodyElongs[i])
        const absElongs = combo.map((i) => day.bodyAbsElongs[i])
        const mags = combo.map((i) => day.bodyMags[i])
        const span = computeMaxSpan(lons)
        const kind = classifyCombination(elongs, lons, day.sunLon)

        if (!includeStraddling && kind === 'straddling') return

        const result = computeComboPPI(k, N, span, mags, absElongs, weights)
        const scored: ScoredCombo = {
          date: day.dateMs,
          ppi: result.ppi,
          span,
          kind,
          planets: combo.map((i) => bodies[i]),
          planetCount: k,
          brightness: result.brightness,
          elongVisibility: result.elongVisibility,
        }

        const shouldInclude = rankingMetric === 'span' || scored.ppi > 0
        if (!shouldInclude) return

        if (isBetterByRanking(scored, best, rankingMetric)) {
          best = scored
        }
        if (isBetterByRanking(scored, bestForK ? { ...bestForK, planetCount: k } : null, rankingMetric)) {
          bestForK = {
            ppi: scored.ppi,
            span: scored.span,
            kind: scored.kind,
            planets: scored.planets,
          }
        }
      }

      if (k === N) {
        for (const sample of daySamples) {
          evaluate(sample, bodyIndices)
        }
      } else {
        for (const sample of daySamples) {
          for (const combo of combinations(bodyIndices, k)) {
            evaluate(sample, combo)
          }
        }
      }

      countBests.get(k)![d] = bestForK
    }

    dayBests[d] = best
    const bestForDay = dayBests[d]
    bestTimes[d] = bestForDay ? bestForDay.date : dayBaseMs
  }

  // Phase 3: Build ppiSeries
  const ppiSeries: { date: number; ppi: number }[] = new Array(numDays)
  for (let d = 0; d < numDays; d++) {
    ppiSeries[d] = { date: bestTimes[d], ppi: dayBests[d]?.ppi ?? 0 }
  }

  // Phase 4: Find extrema — PPI peaks and span minima from overall-best series
  const ppiPeaks = findPPIPeaks(ppiSeries, dayBests)
  const spanSeries = dayBests.map((b, d) => ({ date: bestTimes[d], span: b?.span ?? 0 }))
  const spanMinima = findSpanMinima(spanSeries, dayBests)

  // Build dates array
  const dates = [...bestTimes]

  return { ppiSeries, ppiPeaks, spanMinima, dates, countBests }
}

/** Compute ALL non-zero PPI combos for a single date */
export function computeDayCombos(
  bodies: CelestialBodyId[],
  date: Date,
  minPlanets: number,
  weights: PPIWeights,
  maxPlanets?: number,
  options?: ScoringOptions,
): PPIDayPoint[] {
  const includeStraddling = options?.includeStraddling ?? false
  const rankingMetric = options?.rankingMetric ?? 'ppi'
  const N = bodies.length
  if (N < 2) return []

  const highK = maxPlanets != null ? Math.min(N, maxPlanets) : N
  const lowK = Math.max(2, minPlanets)
  const dateMs = date.getTime()
  const dayRangeStartMs = options?.dayRangeStartMs
  const dayRangeEndMs = options?.dayRangeEndMs
  const scanStepMs = options?.sampleStepMs ?? (rankingMetric === 'span' ? 30 * 60_000 : DAY_MS)
  const sampleTimes = dayRangeStartMs != null && dayRangeEndMs != null && dayRangeEndMs > dayRangeStartMs
    ? (() => {
      const out: number[] = []
      for (let t = dayRangeStartMs; t < dayRangeEndMs; t += Math.max(15 * 60_000, scanStepMs)) out.push(t)
      if (out.length === 0) out.push(dayRangeStartMs)
      return out
    })()
    : [dateMs]

  const bodyIndices = Array.from({ length: N }, (_, i) => i)
  let bestForDay: PPIDayPoint | null = null
  let bestResultsForDay: PPIDayPoint[] = []

  for (const sampleMs of sampleTimes) {
    const sampleDate = new Date(sampleMs)
    const sunLon = getGeocentricEclipticCoords('Sun', sampleDate).lon
    const bodyLons: number[] = new Array(N)
    const bodyElongs: number[] = new Array(N)
    const bodyAbsElongs: number[] = new Array(N)
    const bodyMags: number[] = new Array(N)
    for (let b = 0; b < N; b++) {
      bodyLons[b] = getGeocentricEclipticCoords(bodies[b], sampleDate).lon
      bodyElongs[b] = wrap180(bodyLons[b] - sunLon)
      bodyAbsElongs[b] = Math.abs(bodyElongs[b])
      bodyMags[b] = getBodyVisualMagnitude(bodies[b] as SkyBodyId, sampleDate) ?? 6.5
    }

    const results: PPIDayPoint[] = []
    let bestForSample: PPIDayPoint | null = null

    for (let k = highK; k >= lowK; k--) {
      const evaluate = (combo: number[]) => {
        const lons = combo.map((i) => bodyLons[i])
        const elongs = combo.map((i) => bodyElongs[i])
        const absElongs = combo.map((i) => bodyAbsElongs[i])
        const mags = combo.map((i) => bodyMags[i])
        const span = computeMaxSpan(lons)
        const kind = classifyCombination(elongs, lons, sunLon)

        if (!includeStraddling && kind === 'straddling') return

        const result = computeComboPPI(k, N, span, mags, absElongs, weights)
        if (rankingMetric === 'ppi' && result.ppi <= 0) return

        const point: PPIDayPoint = {
          date: sampleMs,
          ppi: result.ppi,
          span,
          kind,
          planetCount: k,
          planets: combo.map((i) => bodies[i]),
          brightness: result.brightness,
          elongVisibility: result.elongVisibility,
        }

        results.push(point)
        if (isBetterByRanking(point, bestForSample, rankingMetric)) bestForSample = point
      }

      if (k === N) {
        evaluate(bodyIndices)
      } else {
        for (const combo of combinations(bodyIndices, k)) {
          evaluate(combo)
        }
      }
    }

    if (!bestForSample) continue
    if (isBetterByRanking(bestForSample, bestForDay, rankingMetric)) {
      bestForDay = bestForSample
      bestResultsForDay = results
    }
  }

  const results = bestResultsForDay
  // Sort by active ranking mode.
  if (rankingMetric === 'span') {
    results.sort((a, b) => {
      if (a.span !== b.span) return a.span - b.span
      if (a.planetCount !== b.planetCount) return b.planetCount - a.planetCount
      return b.ppi - a.ppi
    })
  } else {
    results.sort((a, b) => b.ppi - a.ppi)
  }
  return results
}

type DayDetail = PPIDayPoint | { ppi: number; span: number; kind: AlignmentKind; planets: CelestialBodyId[]; planetCount: number; brightness: number; elongVisibility: number } | null

/** Compute topographic prominence for an extremum.
 *  For a peak (mode='max') at index `idx` with value V:
 *    scan left until a higher value or series start → track min value in that direction
 *    scan right until a higher value or series end → track min value in that direction
 *    prominence = V - max(leftMin, rightMin)
 *  For a trough (mode='min') at index `idx` with value V:
 *    scan left until a lower value, a zero boundary, or series start → track max
 *    scan right until a lower value, a zero boundary, or series end → track max
 *    prominence = min(leftMax, rightMax) - V
 */
function computeProminence(values: number[], idx: number, mode: 'max' | 'min'): number {
  const v = values[idx]
  if (mode === 'max') {
    let leftMin = v
    for (let i = idx - 1; i >= 0; i--) {
      if (values[i] > v) break
      if (values[i] < leftMin) leftMin = values[i]
    }
    let rightMin = v
    for (let i = idx + 1; i < values.length; i++) {
      if (values[i] > v) break
      if (values[i] < rightMin) rightMin = values[i]
    }
    return v - Math.max(leftMin, rightMin)
  } else {
    let leftMax = v
    for (let i = idx - 1; i >= 0; i--) {
      if (values[i] < v || values[i] <= 0) break
      if (values[i] > leftMax) leftMax = values[i]
    }
    let rightMax = v
    for (let i = idx + 1; i < values.length; i++) {
      if (values[i] < v || values[i] <= 0) break
      if (values[i] > rightMax) rightMax = values[i]
    }
    return Math.min(leftMax, rightMax) - v
  }
}

/** Generic extrema finder: maxima (mode='max') or minima (mode='min') with plateau handling.
 *  Extrema with prominence below `minProminence` are discarded as noise. */
function findExtrema(
  values: number[],
  dates: number[],
  dayDetails: DayDetail[],
  mode: 'max' | 'min',
  minProminence: number = 0,
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

  const candidates: number[] = []

  // Check start
  if (values[0] > 0 && isBetterOrEq(values[0], values[1])) {
    candidates.push(0)
  }

  // Interior points with plateau handling
  let i = 1
  while (i < n - 1) {
    if (isBetterOrEq(values[i], values[i - 1])) {
      let j = i
      while (j < n - 1 && values[j + 1] === values[i]) j++
      if (isBetter(values[i], values[i - 1]) && (j >= n - 1 || isBetter(values[i], values[j + 1]))) {
        candidates.push(i)
      }
      i = j + 1
    } else {
      i++
    }
  }

  // Check end
  const last = n - 1
  if (values[last] > 0 && isBetterOrEq(values[last], values[last - 1])) {
    candidates.push(last)
  }

  // Filter by prominence and build results
  const results: PPIDayPoint[] = []
  for (const idx of candidates) {
    if (minProminence > 0 && computeProminence(values, idx, mode) < minProminence) continue
    const detail = dayDetails[idx]
    if (!detail || values[idx] <= 0) continue
    results.push({
      date: dates[idx],
      ppi: detail.ppi,
      span: detail.span,
      kind: detail.kind,
      planetCount: detail.planetCount,
      planets: detail.planets,
      brightness: detail.brightness,
      elongVisibility: detail.elongVisibility,
    })
  }

  return results
}

/** Find local maxima in the PPI time series.
 *  Default minProminence=0.5 filters noise peaks (PPI range 0–100). */
export function findPPIPeaks(
  series: { date: number; ppi: number }[],
  dayDetails: DayDetail[],
  minProminence: number = 0.5,
): PPIDayPoint[] {
  return findExtrema(series.map(s => s.ppi), series.map(s => s.date), dayDetails, 'max', minProminence)
}

/** Find local minima in the span time series (tightest clusters).
 *  Default minProminence=2.0 filters noise troughs (span range 0–360°). */
export function findSpanMinima(
  series: { date: number; span: number }[],
  dayDetails: DayDetail[],
  minProminence: number = 2.0,
): PPIDayPoint[] {
  return findExtrema(series.map(s => s.span), series.map(s => s.date), dayDetails, 'min', minProminence)
}
