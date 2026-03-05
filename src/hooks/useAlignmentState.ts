import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { CelestialBodyId, AlignmentKind, AlignmentTabDataPoint, AlignmentMinimum, AlignmentResult, PPIWeights, PPIResult, PPIDayPoint, ChartMetric, NavMode, AnalysisMode, RankingMetric } from '../types'
import { MS_PER_DAY, ANALYZABLE_BODIES, GEOMETRY_ANALYZABLE_BODIES } from '../constants'
import { computeAlignmentTabs, getGeocentricEclipticCoords, wrap180, BestPerKind } from '../lib/alignment'
import { DEFAULT_PPI_WEIGHTS, computePPIResults, computeDayCombos, findPPIPeaks, findSpanMinima } from '../lib/ppiScoring'
import { SkyViewCenter } from '../components/alignment/SkyView'
import { getTimeZoneDayKey, getTimeZoneDayRange } from '../lib/timeZoneDay'

export interface AlignmentState {
  // State
  selectedBodies: CelestialBodyId[]
  setSelectedBodies: (bodies: CelestialBodyId[]) => void
  startDate: Date
  setStartDate: (d: Date) => void
  durationDays: number
  setDurationDays: (days: number) => void
  skyCenter: SkyViewCenter
  setSkyCenter: (c: SkyViewCenter) => void
  visibleSeries: Set<AlignmentKind>
  setVisibleSeries: (v: Set<AlignmentKind>) => void
  analysisMode: AnalysisMode
  setAnalysisMode: (m: AnalysisMode) => void
  rankingMetric: RankingMetric
  setMinPlanets: (n: number) => void
  setMaxPlanets: (n: number) => void
  // Computed
  effectiveMin: number
  effectiveMax: number
  allMinima: AlignmentMinimum[]
  bestPerKind: BestPerKind
  // PPI
  ppiWeights: PPIWeights
  setPPIWeights: (w: PPIWeights) => void
  ppiResult: PPIResult
  dayDetailCombos: PPIDayPoint[]
  selectedDayComboIdx: number | null
  setSelectedDayComboIdx: (idx: number | null) => void
  // Chart controls
  visibleCounts: Set<number>
  visibleMetrics: Set<ChartMetric>
  setVisibleMetrics: (v: Set<ChartMetric>) => void
  simpleMode: boolean
  setSimpleMode: (v: boolean) => void
  navMode: NavMode
  setNavMode: (m: NavMode) => void
  chartData: Record<string, number | string | null>[]
  // Derived from currentDate
  currentDateMs: number
  filteredPeaks: PPIDayPoint[]
  hasPrev: boolean
  hasNext: boolean
  todayInRange: boolean
  // Callbacks
  handleDateSelect: (dateMs: number) => void
  jumpToPeak: (direction: 'prev' | 'next') => void
}

export function useAlignmentState(
  currentDate: Date,
  onDateChange: (d: Date) => void,
  timeZone?: string | null,
): AlignmentState {
  const [selectedBodies, setSelectedBodies] = useState<CelestialBodyId[]>([
    'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
  ])
  const [startDate, setStartDate] = useState(() => new Date('2026-01-01T00:00:00Z'))
  const [durationDays, setDurationDays] = useState(365)
  const [skyCenter, setSkyCenter] = useState<SkyViewCenter>('lon0')
  const [visibleSeries, setVisibleSeries] = useState<Set<AlignmentKind>>(
    () => new Set(['morning', 'evening', 'straddling']),
  )
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('visibility')
  const [minPlanets, setMinPlanets] = useState(2)
  const [maxPlanets, setMaxPlanets] = useState(7)
  const [visibleCounts, setVisibleCounts] = useState<Set<number>>(() => new Set<number>())
  const [visibleMetrics, setVisibleMetrics] = useState<Set<ChartMetric>>(() => new Set(['ppi', 'span'] as ChartMetric[]))
  const [simpleMode, setSimpleMode] = useState(true)
  const [navMode, setNavMode] = useState<NavMode>('ppi')
  const rankingMetric: RankingMetric = analysisMode === 'geometry' ? 'span' : 'ppi'
  const includeStraddling = analysisMode === 'geometry'
  const effectiveMin = Math.max(2, Math.min(minPlanets, selectedBodies.length))
  const effectiveMax = Math.min(selectedBodies.length, Math.max(maxPlanets, effectiveMin))

  useEffect(() => {
    const allowed = new Set(analysisMode === 'geometry' ? GEOMETRY_ANALYZABLE_BODIES : ANALYZABLE_BODIES)
    setSelectedBodies((prev) => {
      const filtered = prev.filter((id) => allowed.has(id))
      if (filtered.length >= 2) return filtered
      const fallback = [...allowed].filter((id) => !filtered.includes(id))
      return [...filtered, ...fallback].slice(0, Math.min(2, allowed.size))
    })

    if (analysisMode === 'geometry') {
      setVisibleMetrics(new Set(['span']))
      setNavMode('span')
      setSimpleMode(true)
    } else {
      setVisibleMetrics(new Set(['ppi', 'span']))
      setNavMode('ppi')
    }
  }, [analysisMode])

  // Available tabs: effectiveMax down to effectiveMin
  const availableTabs = useMemo(() => {
    const N = selectedBodies.length
    if (N < 2) return []
    const tabs: number[] = []
    for (let k = effectiveMax; k >= effectiveMin; k--) tabs.push(k)
    return tabs
  }, [selectedBodies.length, effectiveMin, effectiveMax])

  // Reset maxPlanets when selectedBodies changes
  const bodiesKey = selectedBodies.join(',')
  useEffect(() => {
    setMaxPlanets(selectedBodies.length)
  }, [bodiesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // visibleCounts always matches the planet count range (no per-count toggles)
  const availableTabsKey = availableTabs.join(',')
  useEffect(() => {
    if (availableTabs.length === 0) return
    setVisibleCounts(new Set(availableTabs))
  }, [availableTabsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const [ppiWeights, setPPIWeights] = useState<PPIWeights>(() => ({ ...DEFAULT_PPI_WEIGHTS }))

  const alignmentResult = useMemo((): AlignmentResult => {
    if (selectedBodies.length < 2) {
      return {
        tabs: new Map<number, AlignmentTabDataPoint[]>(),
        minima: new Map<number, AlignmentMinimum[]>(),
      }
    }
    return computeAlignmentTabs(selectedBodies, startDate, durationDays, effectiveMin, effectiveMax)
  }, [selectedBodies, startDate, durationDays, effectiveMin, effectiveMax])

  const ppiResult = useMemo((): PPIResult => {
    if (selectedBodies.length < 2) return { ppiSeries: [], ppiPeaks: [], spanMinima: [], dates: [], countBests: new Map() }
    return computePPIResults(
      selectedBodies,
      startDate,
      durationDays,
      effectiveMin,
      ppiWeights,
      effectiveMax,
      {
        includeStraddling,
        rankingMetric,
        sampleStepMs: analysisMode === 'geometry' ? undefined : 24 * 60 * 60 * 1000,
      },
    )
  }, [selectedBodies, startDate, durationDays, effectiveMin, ppiWeights, effectiveMax, includeStraddling, rankingMetric, analysisMode])

  const [selectedDayComboIdx, setSelectedDayComboIdx] = useState<number | null>(null)

  const currentDayKey = useMemo(
    () => getTimeZoneDayKey(currentDate, timeZone),
    [currentDate, timeZone],
  )
  const currentDayRange = useMemo(
    () => getTimeZoneDayRange(currentDate, timeZone),
    [currentDayKey, timeZone],
  )

  // Reset combo selection when day changes
  const prevDayRef = useRef(currentDayKey)
  useEffect(() => {
    if (prevDayRef.current !== currentDayKey) {
      prevDayRef.current = currentDayKey
      setSelectedDayComboIdx(null)
    }
  }, [currentDayKey])

  const chartData = useMemo(() => {
    return ppiResult.dates.map((dateMs, d) => {
      const point: Record<string, number | string | null> = { date: dateMs }
      let bestPpi: number | null = null
      let bestSpan: number | null = null
      let bestPlanets: string[] | null = null
      for (const [k, bests] of ppiResult.countBests) {
        const b = bests[d]
        if (b) {
          point[`ppi_${k}`] = b.ppi
          point[`span_${k}`] = b.span
          point[`kind_${k}`] = b.kind
          if (rankingMetric === 'span') {
            const shouldPick = bestSpan == null
              || b.span < bestSpan
              || (b.span === bestSpan && (bestPlanets == null || k > bestPlanets.length))
            if (shouldPick) {
              bestPpi = b.ppi
              bestSpan = b.span
              bestPlanets = b.planets as string[]
            }
          } else {
            const shouldPick = bestPpi == null
              || b.ppi > bestPpi
              || (b.ppi === bestPpi && (bestSpan == null || b.span < bestSpan))
            if (shouldPick) {
              bestPpi = b.ppi
              bestSpan = b.span
              bestPlanets = b.planets as string[]
            }
          }
        }
      }
      point.best_ppi = bestPpi
      point.best_span = bestSpan
      point.best_planets = bestPlanets ? bestPlanets.join(',') : null
      return point
    })
  }, [ppiResult, rankingMetric])

  const dayDetailCombos = useMemo((): PPIDayPoint[] => {
    if (selectedBodies.length < 2) return []
    const dayDate = new Date(currentDayRange.startMs)
    return computeDayCombos(
      selectedBodies,
      dayDate,
      effectiveMin,
      ppiWeights,
      effectiveMax,
      {
        includeStraddling,
        rankingMetric,
        dayRangeStartMs: analysisMode === 'geometry' ? currentDayRange.startMs : undefined,
        dayRangeEndMs: analysisMode === 'geometry' ? currentDayRange.endMs : undefined,
        sampleStepMs: analysisMode === 'geometry' ? 30 * 60 * 1000 : undefined,
      },
    )
  }, [selectedBodies, currentDayRange.startMs, currentDayRange.endMs, effectiveMin, ppiWeights, effectiveMax, includeStraddling, rankingMetric, analysisMode])

  const allMinima = useMemo(() => {
    const result: AlignmentMinimum[] = []
    for (const [, tabMinima] of alignmentResult.minima) {
      for (const m of tabMinima) {
        if (visibleSeries.has(m.kind)) result.push(m)
      }
    }
    return result.sort((a, b) => a.date - b.date)
  }, [alignmentResult, visibleSeries])

  // Best combo per kind for the current day — derived from dayDetailCombos (tab-independent)
  // When a specific combo is selected, show only that combo
  const bestPerKind = useMemo((): BestPerKind => {
    const result: BestPerKind = { morning: null, evening: null, straddling: null }
    if (dayDetailCombos.length === 0) return result

    const combosToShow = selectedDayComboIdx !== null && selectedDayComboIdx < dayDetailCombos.length
      ? [dayDetailCombos[selectedDayComboIdx]]
      : [dayDetailCombos[0]]

    for (const combo of combosToShow) {
      const comboDate = new Date(combo.date)
      const sunLon = getGeocentricEclipticCoords('Sun', comboDate).lon
      const longitudes = combo.planets.map((p) => getGeocentricEclipticCoords(p, comboDate).lon)
      const elongations = combo.planets.map((p) => wrap180(getGeocentricEclipticCoords(p, comboDate).lon - sunLon))
      result[combo.kind] = {
        indices: combo.planets.map((p) => selectedBodies.indexOf(p)),
        bodies: combo.planets,
        longitudes,
        elongations,
        span: combo.span,
        kind: combo.kind,
      }
    }

    return result
  }, [dayDetailCombos, currentDayRange.startMs, selectedBodies, selectedDayComboIdx])

  const handleDateSelect = useCallback(
    (dateMs: number) => onDateChange(new Date(dateMs)),
    [onDateChange],
  )

  const currentDateMs = currentDate.getTime()

  const filteredPeaks = useMemo(() => {
    const pickBestPerDay = (points: PPIDayPoint[]): PPIDayPoint[] => {
      const byDay = new Map<string, PPIDayPoint>()
      for (const p of points) {
        const day = getTimeZoneDayKey(new Date(p.date), timeZone)
        const prev = byDay.get(day)
        if (!prev) {
          byDay.set(day, p)
          continue
        }
        if (navMode === 'span') {
          const better = p.span < prev.span
            || (p.span === prev.span && p.planetCount > prev.planetCount)
            || (p.span === prev.span && p.planetCount === prev.planetCount && p.ppi > prev.ppi)
          if (better) byDay.set(day, p)
        } else {
          const better = p.ppi > prev.ppi
            || (p.ppi === prev.ppi && p.planetCount > prev.planetCount)
            || (p.ppi === prev.ppi && p.planetCount === prev.planetCount && p.span < prev.span)
          if (better) byDay.set(day, p)
        }
      }
      return [...byDay.values()].sort((a, b) => a.date - b.date)
    }

    // Simple chart uses overall-best series only.
    if (simpleMode || visibleCounts.size === 0) {
      return pickBestPerDay(navMode === 'span' ? ppiResult.spanMinima : ppiResult.ppiPeaks)
    }
    // Advanced chart shows per-count lines, so navigation uses extrema from
    // each visible count series.
    const dates = ppiResult.dates
    const points: PPIDayPoint[] = []
    for (const k of visibleCounts) {
      const bests = ppiResult.countBests.get(k)
      if (!bests) continue
      const details = bests.map(b => b ? {
        ppi: b.ppi, span: b.span, kind: b.kind,
        planets: b.planets as CelestialBodyId[],
        planetCount: k, brightness: 0, elongVisibility: 0,
      } : null)
      if (navMode === 'span') {
        points.push(...findSpanMinima(
          dates.map((d, i) => ({ date: d, span: bests[i]?.span ?? 0 })),
          details,
        ))
      } else {
        points.push(...findPPIPeaks(
          dates.map((d, i) => ({ date: d, ppi: bests[i]?.ppi ?? 0 })),
          details,
        ))
      }
    }
    return pickBestPerDay(points)
  }, [ppiResult, visibleCounts, navMode, simpleMode, timeZone])

  const hasPrev = useMemo(
    () => filteredPeaks.some((m) => getTimeZoneDayKey(new Date(m.date), timeZone) < currentDayKey),
    [filteredPeaks, timeZone, currentDayKey],
  )
  const hasNext = useMemo(
    () => filteredPeaks.some((m) => getTimeZoneDayKey(new Date(m.date), timeZone) > currentDayKey),
    [filteredPeaks, timeZone, currentDayKey],
  )

  const jumpToPeak = useCallback(
    (direction: 'prev' | 'next') => {
      if (filteredPeaks.length === 0) return
      if (direction === 'next') {
        const next = filteredPeaks.find((m) => getTimeZoneDayKey(new Date(m.date), timeZone) > currentDayKey)
        if (next) onDateChange(new Date(next.date))
      } else {
        let prev: PPIDayPoint | null = null
        for (const m of filteredPeaks) {
          if (getTimeZoneDayKey(new Date(m.date), timeZone) < currentDayKey) prev = m
        }
        if (prev) onDateChange(new Date(prev.date))
      }
    },
    [filteredPeaks, currentDayKey, onDateChange, timeZone],
  )

  const now = Date.now()
  const todayInRange = now >= startDate.getTime() && now <= startDate.getTime() + durationDays * MS_PER_DAY

  return {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    skyCenter, setSkyCenter,
    visibleSeries, setVisibleSeries,
    analysisMode, setAnalysisMode,
    rankingMetric,
    setMinPlanets, setMaxPlanets,
    ppiWeights, setPPIWeights,
    ppiResult, dayDetailCombos, selectedDayComboIdx, setSelectedDayComboIdx,
    effectiveMin, effectiveMax,
    allMinima, bestPerKind,
    visibleCounts,
    visibleMetrics, setVisibleMetrics,
    simpleMode, setSimpleMode,
    navMode, setNavMode,
    chartData,
    currentDateMs, filteredPeaks, hasPrev, hasNext, todayInRange,
    handleDateSelect, jumpToPeak,
  }
}
