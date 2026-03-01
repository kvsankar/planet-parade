import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { CelestialBodyId, AlignmentKind, AlignmentTabDataPoint, AlignmentMinimum, AlignmentResult, PPIWeights, PPIResult, PPIDayPoint, ChartMetric } from '../types'
import { MS_PER_DAY } from '../constants'
import { computeAlignmentTabs, getGeocentricEclipticCoords, wrap180, BestPerKind } from '../lib/alignment'
import { DEFAULT_PPI_WEIGHTS, computePPIResults, computeDayCombos } from '../lib/ppiScoring'
import { SkyViewCenter } from '../components/alignment/SkyView'

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
  minPlanets: number
  setMinPlanets: (n: number) => void
  maxPlanets: number
  setMaxPlanets: (n: number) => void
  availableTabs: number[]
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
  setVisibleCounts: (v: Set<number>) => void
  visibleMetrics: Set<ChartMetric>
  setVisibleMetrics: (v: Set<ChartMetric>) => void
  chartData: Record<string, number | string | null>[]
  // Derived from currentDate
  currentDateMs: number
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
  const [minPlanets, setMinPlanets] = useState(2)
  const [maxPlanets, setMaxPlanets] = useState(7)
  const [visibleCounts, setVisibleCounts] = useState<Set<number>>(() => new Set<number>())
  const [visibleMetrics, setVisibleMetrics] = useState<Set<ChartMetric>>(() => new Set(['ppi', 'span'] as ChartMetric[]))
  const effectiveMin = Math.max(2, Math.min(minPlanets, selectedBodies.length))
  const effectiveMax = Math.min(selectedBodies.length, Math.max(maxPlanets, effectiveMin))

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

  // Keep visibleCounts in sync with availableTabs: add new tabs, prune removed ones
  const availableTabsKey = availableTabs.join(',')
  useEffect(() => {
    if (availableTabs.length === 0) return
    const tabSet = new Set(availableTabs)
    const pruned = new Set([...visibleCounts].filter((k) => tabSet.has(k)))
    // If nothing survives pruning (or first init), default to all
    if (pruned.size === 0) {
      setVisibleCounts(tabSet)
    } else if (pruned.size !== visibleCounts.size) {
      setVisibleCounts(pruned)
    }
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
    if (selectedBodies.length < 2) return { ppiSeries: [], ppiPeaks: [], dates: [], countBests: new Map() }
    return computePPIResults(selectedBodies, startDate, durationDays, effectiveMin, ppiWeights, effectiveMax)
  }, [selectedBodies, startDate, durationDays, effectiveMin, ppiWeights, effectiveMax])

  const [selectedDayComboIdx, setSelectedDayComboIdx] = useState<number | null>(null)

  const currentDay = Math.floor(currentDate.getTime() / MS_PER_DAY)

  // Reset combo selection when day changes
  const prevDayRef = useRef(currentDay)
  useEffect(() => {
    if (prevDayRef.current !== currentDay) {
      prevDayRef.current = currentDay
      setSelectedDayComboIdx(null)
    }
  }, [currentDay])

  const chartData = useMemo(() => {
    return ppiResult.dates.map((dateMs, d) => {
      const point: Record<string, number | string | null> = { date: dateMs }
      let bestPpi = 0
      let bestSpan: number | null = null
      let bestPlanets: string[] | null = null
      for (const [k, bests] of ppiResult.countBests) {
        const b = bests[d]
        if (b) {
          point[`ppi_${k}`] = b.ppi
          point[`span_${k}`] = b.span
          point[`kind_${k}`] = b.kind
          if (b.ppi > bestPpi) { bestPpi = b.ppi; bestSpan = b.span; bestPlanets = b.planets as string[] }
        }
      }
      point.best_ppi = bestPpi > 0 ? bestPpi : null
      point.best_span = bestSpan
      point.best_planets = bestPlanets ? bestPlanets.join(',') : null
      return point
    })
  }, [ppiResult])

  const dayDetailCombos = useMemo((): PPIDayPoint[] => {
    if (selectedBodies.length < 2) return []
    const dayDate = new Date(currentDay * MS_PER_DAY)
    return computeDayCombos(selectedBodies, dayDate, effectiveMin, ppiWeights, effectiveMax)
  }, [selectedBodies, currentDay, effectiveMin, ppiWeights, effectiveMax])

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

    const dayDate = new Date(currentDay * MS_PER_DAY)
    const sunLon = getGeocentricEclipticCoords('Sun', dayDate).lon

    const combosToShow = selectedDayComboIdx !== null && selectedDayComboIdx < dayDetailCombos.length
      ? [dayDetailCombos[selectedDayComboIdx]]
      : [dayDetailCombos[0]]

    for (const combo of combosToShow) {
      const longitudes = combo.planets.map((p) => getGeocentricEclipticCoords(p, dayDate).lon)
      const elongations = combo.planets.map((p) => wrap180(getGeocentricEclipticCoords(p, dayDate).lon - sunLon))
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
  }, [dayDetailCombos, currentDay, selectedBodies, selectedDayComboIdx])

  const handleDateSelect = useCallback(
    (dateMs: number) => onDateChange(new Date(dateMs)),
    [onDateChange],
  )

  const currentDateMs = currentDate.getTime()

  const filteredPeaks = useMemo(() => {
    if (visibleCounts.size === 0) return ppiResult.ppiPeaks
    return ppiResult.ppiPeaks.filter((p) => visibleCounts.has(p.planetCount))
  }, [ppiResult.ppiPeaks, visibleCounts])

  const hasPrev = useMemo(() => filteredPeaks.some((m) => m.date < currentDateMs), [filteredPeaks, currentDateMs])
  const hasNext = useMemo(() => filteredPeaks.some((m) => m.date > currentDateMs), [filteredPeaks, currentDateMs])

  const jumpToPeak = useCallback(
    (direction: 'prev' | 'next') => {
      if (filteredPeaks.length === 0) return
      if (direction === 'next') {
        const next = filteredPeaks.find((m) => m.date > currentDateMs)
        if (next) onDateChange(new Date(next.date))
      } else {
        let prev: PPIDayPoint | null = null
        for (const m of filteredPeaks) {
          if (m.date < currentDateMs) prev = m
          else break
        }
        if (prev) onDateChange(new Date(prev.date))
      }
    },
    [filteredPeaks, currentDateMs, onDateChange],
  )

  const now = Date.now()
  const todayInRange = now >= startDate.getTime() && now <= startDate.getTime() + durationDays * MS_PER_DAY

  return {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    skyCenter, setSkyCenter,
    visibleSeries, setVisibleSeries,
    minPlanets, setMinPlanets,
    maxPlanets, setMaxPlanets,
    ppiWeights, setPPIWeights,
    ppiResult, dayDetailCombos, selectedDayComboIdx, setSelectedDayComboIdx,
    availableTabs,
    effectiveMin, effectiveMax,
    allMinima, bestPerKind,
    visibleCounts, setVisibleCounts,
    visibleMetrics, setVisibleMetrics,
    chartData,
    currentDateMs, hasPrev, hasNext, todayInRange,
    handleDateSelect, jumpToPeak,
  }
}
