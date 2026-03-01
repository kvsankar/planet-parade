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
  // Tab state
  activeTab: number
  setActiveTab: (tab: number) => void
  availableTabs: number[]
  // Computed
  effectiveMin: number
  activeTabData: AlignmentTabDataPoint[]
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
  const [visibleCounts, setVisibleCounts] = useState<Set<number>>(() => new Set<number>())
  const [visibleMetrics, setVisibleMetrics] = useState<Set<ChartMetric>>(() => new Set(['ppi', 'span'] as ChartMetric[]))
  const [activeTab, setActiveTabRaw] = useState(() => selectedBodies.length)

  const effectiveMin = Math.max(2, Math.min(minPlanets, selectedBodies.length))

  // Available tabs: N down to max(effectiveMin, N-3)
  const availableTabs = useMemo(() => {
    const N = selectedBodies.length
    if (N < 2) return []
    const lowK = Math.max(effectiveMin, N - 3)
    const tabs: number[] = []
    for (let k = N; k >= lowK; k--) tabs.push(k)
    return tabs
  }, [selectedBodies.length, effectiveMin])

  // Set active tab — clamp to available range
  const setActiveTab = useCallback((tab: number) => {
    setActiveTabRaw(tab)
  }, [])

  // Ensure activeTab is valid
  const validActiveTab = useMemo(() => {
    if (availableTabs.length === 0) return 0
    if (availableTabs.includes(activeTab)) return activeTab
    return availableTabs[0]
  }, [availableTabs, activeTab])

  // Reset tab when selectedBodies changes
  const bodiesKey = selectedBodies.join(',')
  useEffect(() => {
    setActiveTabRaw(selectedBodies.length)
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
    return computeAlignmentTabs(selectedBodies, startDate, durationDays, effectiveMin)
  }, [selectedBodies, startDate, durationDays, effectiveMin])

  const ppiResult = useMemo((): PPIResult => {
    if (selectedBodies.length < 2) return { ppiSeries: [], ppiPeaks: [], dates: [], countBests: new Map() }
    return computePPIResults(selectedBodies, startDate, durationDays, effectiveMin, ppiWeights)
  }, [selectedBodies, startDate, durationDays, effectiveMin, ppiWeights])

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
      for (const [k, bests] of ppiResult.countBests) {
        const b = bests[d]
        if (b) {
          point[`ppi_${k}`] = b.ppi
          point[`span_${k}`] = b.span
          point[`kind_${k}`] = b.kind
        }
      }
      return point
    })
  }, [ppiResult])

  const dayDetailCombos = useMemo((): PPIDayPoint[] => {
    if (selectedBodies.length < 2) return []
    const dayDate = new Date(currentDay * MS_PER_DAY)
    return computeDayCombos(selectedBodies, dayDate, effectiveMin, ppiWeights)
  }, [selectedBodies, currentDay, effectiveMin, ppiWeights])

  const activeTabData = useMemo(() => {
    return alignmentResult.tabs.get(validActiveTab) ?? []
  }, [alignmentResult, validActiveTab])

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
      : dayDetailCombos

    for (const combo of combosToShow) {
      if (result[combo.kind]) continue
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

  const ppiPeaks = ppiResult.ppiPeaks

  const hasPrev = useMemo(() => ppiPeaks.some((m) => m.date < currentDateMs), [ppiPeaks, currentDateMs])
  const hasNext = useMemo(() => ppiPeaks.some((m) => m.date > currentDateMs), [ppiPeaks, currentDateMs])

  const jumpToPeak = useCallback(
    (direction: 'prev' | 'next') => {
      if (ppiPeaks.length === 0) return
      if (direction === 'next') {
        const next = ppiPeaks.find((m) => m.date > currentDateMs)
        if (next) onDateChange(new Date(next.date))
      } else {
        let prev: PPIDayPoint | null = null
        for (const m of ppiPeaks) {
          if (m.date < currentDateMs) prev = m
          else break
        }
        if (prev) onDateChange(new Date(prev.date))
      }
    },
    [ppiPeaks, currentDateMs, onDateChange],
  )

  return {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    skyCenter, setSkyCenter,
    visibleSeries, setVisibleSeries,
    minPlanets, setMinPlanets,
    ppiWeights, setPPIWeights,
    ppiResult, dayDetailCombos, selectedDayComboIdx, setSelectedDayComboIdx,
    activeTab: validActiveTab, setActiveTab,
    availableTabs,
    effectiveMin,
    activeTabData, allMinima, bestPerKind,
    visibleCounts, setVisibleCounts,
    visibleMetrics, setVisibleMetrics,
    chartData,
    currentDateMs, hasPrev, hasNext,
    handleDateSelect, jumpToPeak,
  }
}
