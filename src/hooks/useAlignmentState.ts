import { useState, useMemo, useCallback, useEffect } from 'react'
import { CelestialBodyId, AlignmentKind, AlignmentTabDataPoint, AlignmentMinimum, AlignmentResult } from '../types'
import { computeAlignmentTabs, findBestPerKind, BestPerKind } from '../lib/alignment'
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
  // Derived from currentDate
  currentDateMs: number
  hasPrev: boolean
  hasNext: boolean
  // Callbacks
  handleDateSelect: (dateMs: number) => void
  jumpToMinimum: (direction: 'prev' | 'next') => void
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
  const [minPlanets, setMinPlanets] = useState(6)
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

  const alignmentResult = useMemo((): AlignmentResult => {
    if (selectedBodies.length < 2) {
      return {
        tabs: new Map<number, AlignmentTabDataPoint[]>(),
        minima: new Map<number, AlignmentMinimum[]>(),
      }
    }
    return computeAlignmentTabs(selectedBodies, startDate, durationDays, effectiveMin)
  }, [selectedBodies, startDate, durationDays, effectiveMin])

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

  // Minima for the active tab only — used for prev/next navigation
  const activeTabMinima = useMemo(() => {
    const tabMinima = alignmentResult.minima.get(validActiveTab) ?? []
    return tabMinima.filter((m) => visibleSeries.has(m.kind)).sort((a, b) => a.date - b.date)
  }, [alignmentResult, validActiveTab, visibleSeries])

  // Best combo per kind for the active tab at the current date — shared by SkyView + AlignmentCones
  const MS_PER_HOUR = 3_600_000
  const currentHour = Math.round(currentDate.getTime() / MS_PER_HOUR)
  const bestPerKind = useMemo((): BestPerKind => {
    if (selectedBodies.length < 2 || validActiveTab < 2) {
      return { morning: null, evening: null, straddling: null }
    }
    const quantized = new Date(currentHour * MS_PER_HOUR)
    return findBestPerKind(selectedBodies, quantized, Math.min(validActiveTab, selectedBodies.length))
  }, [selectedBodies, validActiveTab, currentHour])

  const handleDateSelect = useCallback(
    (dateMs: number) => onDateChange(new Date(dateMs)),
    [onDateChange],
  )

  const currentDateMs = currentDate.getTime()

  const hasPrev = useMemo(() => activeTabMinima.some((m) => m.date < currentDateMs), [activeTabMinima, currentDateMs])
  const hasNext = useMemo(() => activeTabMinima.some((m) => m.date > currentDateMs), [activeTabMinima, currentDateMs])

  const jumpToMinimum = useCallback(
    (direction: 'prev' | 'next') => {
      if (activeTabMinima.length === 0) return
      if (direction === 'next') {
        const next = activeTabMinima.find((m) => m.date > currentDateMs)
        if (next) onDateChange(new Date(next.date))
      } else {
        let prev: AlignmentMinimum | null = null
        for (const m of activeTabMinima) {
          if (m.date < currentDateMs) prev = m
          else break
        }
        if (prev) onDateChange(new Date(prev.date))
      }
    },
    [activeTabMinima, currentDateMs, onDateChange],
  )

  return {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    skyCenter, setSkyCenter,
    visibleSeries, setVisibleSeries,
    minPlanets, setMinPlanets,
    activeTab: validActiveTab, setActiveTab,
    availableTabs,
    effectiveMin,
    activeTabData, allMinima, bestPerKind,
    currentDateMs, hasPrev, hasNext,
    handleDateSelect, jumpToMinimum,
  }
}
