import { useState, useMemo, useCallback } from 'react'
import { CelestialBodyId, AlignmentKind, AlignmentDataPoint, AlignmentMinimum } from '../types'
import { computeAlignmentSeries, findLocalMinima } from '../lib/alignment'
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
  // Computed
  effectiveMin: number
  series: AlignmentDataPoint[]
  allMinima: AlignmentMinimum[]
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
    () => new Set(['total', 'morning', 'evening']),
  )
  const [minPlanets, setMinPlanets] = useState(6)

  const effectiveMin = Math.max(2, Math.min(minPlanets, selectedBodies.length))

  const series = useMemo(() => {
    if (selectedBodies.length < 2) return []
    return computeAlignmentSeries(selectedBodies, startDate, durationDays, effectiveMin)
  }, [selectedBodies, startDate, durationDays, effectiveMin])

  const allMinima = useMemo(() => {
    const result: AlignmentMinimum[] = []
    if (visibleSeries.has('total')) {
      result.push(...findLocalMinima(series, 'separation', 'total'))
    }
    if (visibleSeries.has('morning')) {
      result.push(...findLocalMinima(series, 'morningSep', 'morning'))
    }
    if (visibleSeries.has('evening')) {
      result.push(...findLocalMinima(series, 'eveningSep', 'evening'))
    }
    return result.sort((a, b) => a.date - b.date)
  }, [series, visibleSeries])

  const handleDateSelect = useCallback(
    (dateMs: number) => onDateChange(new Date(dateMs)),
    [onDateChange],
  )

  const currentDateMs = currentDate.getTime()

  const hasPrev = useMemo(() => allMinima.some((m) => m.date < currentDateMs), [allMinima, currentDateMs])
  const hasNext = useMemo(() => allMinima.some((m) => m.date > currentDateMs), [allMinima, currentDateMs])

  const jumpToMinimum = useCallback(
    (direction: 'prev' | 'next') => {
      if (allMinima.length === 0) return
      if (direction === 'next') {
        const next = allMinima.find((m) => m.date > currentDateMs)
        if (next) onDateChange(new Date(next.date))
      } else {
        let prev: AlignmentMinimum | null = null
        for (const m of allMinima) {
          if (m.date < currentDateMs) prev = m
          else break
        }
        if (prev) onDateChange(new Date(prev.date))
      }
    },
    [allMinima, currentDateMs, onDateChange],
  )

  return {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    skyCenter, setSkyCenter,
    visibleSeries, setVisibleSeries,
    minPlanets, setMinPlanets,
    effectiveMin,
    series, allMinima,
    currentDateMs, hasPrev, hasNext,
    handleDateSelect, jumpToMinimum,
  }
}
