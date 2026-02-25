import { useState, useMemo, useCallback } from 'react'
import { CelestialBodyId, AlignmentKind } from '../../types'
import { computeAlignmentSeries, findLocalMinima } from '../../lib/alignment'
import { formatDate } from '../../constants'
import { useSimulationTime } from '../../hooks/useSimulationTime'
import PlanetPicker from './PlanetPicker'
import TimeRangeSelector from './TimeRangeSelector'
import AlignmentTimeSlider from './AlignmentTimeSlider'
import SeparationChart from './SeparationChart'
import SeriesToggle from './SeriesToggle'
import MinimaTable from './MinimaTable'
import SkyView, { SkyViewCenter } from './SkyView'
import PlaybackControls from '../ui/PlaybackControls'

interface AlignmentAnalyzerProps {
  currentDate: Date
  onDateChange: (d: Date) => void
}

export default function AlignmentAnalyzer({ currentDate, onDateChange }: AlignmentAnalyzerProps) {
  const { isPlaying, speed, togglePlay, setSpeed } = useSimulationTime()

  const [selectedBodies, setSelectedBodies] = useState<CelestialBodyId[]>([
    'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  ])
  const [startDate, setStartDate] = useState(() => new Date('2020-01-01T00:00:00Z'))
  const [durationDays, setDurationDays] = useState(7305)
  const [skyCenter, setSkyCenter] = useState<SkyViewCenter>('lon0')
  const [visibleSeries, setVisibleSeries] = useState<Set<AlignmentKind>>(
    () => new Set(['total', 'morning', 'evening']),
  )
  const [minPlanets, setMinPlanets] = useState(5) // default matches initial 5 selected

  // Clamp minPlanets when selection changes
  const effectiveMin = Math.max(2, Math.min(minPlanets, selectedBodies.length))

  const series = useMemo(() => {
    if (selectedBodies.length < 2) return []
    return computeAlignmentSeries(selectedBodies, startDate, durationDays, effectiveMin)
  }, [selectedBodies, startDate, durationDays, effectiveMin])

  const allMinima = useMemo(() => {
    const result = []
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
    (dateMs: number) => {
      onDateChange(new Date(dateMs))
    },
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
        // Find last minimum before current date
        let prev = null
        for (const m of allMinima) {
          if (m.date < currentDateMs) prev = m
          else break
        }
        if (prev) onDateChange(new Date(prev.date))
      }
    },
    [allMinima, currentDateMs, onDateChange],
  )

  return (
    <div className="alignment-analyzer">
      <div className="alignment-sidebar">
        <PlanetPicker selected={selectedBodies} onChange={setSelectedBodies} />
        <TimeRangeSelector
          startDate={startDate}
          durationDays={durationDays}
          onStartDateChange={setStartDate}
          onDurationChange={setDurationDays}
        />
        <SeriesToggle visible={visibleSeries} onChange={setVisibleSeries} />
        {selectedBodies.length > 2 && (
          <div className="min-planets-control">
            <label className="control-label">Min planets for AM/PM</label>
            <div className="min-planets-chips">
              {Array.from({ length: selectedBodies.length - 1 }, (_, i) => i + 2).map((n) => (
                <button
                  key={n}
                  className={`min-planet-chip ${effectiveMin === n ? 'active' : ''}`}
                  onClick={() => setMinPlanets(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        <MinimaTable
          minima={allMinima}
          currentDate={currentDateMs}
          onSelect={handleDateSelect}
        />
      </div>
      <div className="alignment-main">
        <SeparationChart
          data={series}
          currentDate={currentDateMs}
          onDateClick={handleDateSelect}
          visibleSeries={visibleSeries}
        />
        <AlignmentTimeSlider
          startDate={startDate}
          durationDays={durationDays}
          currentDate={currentDate}
          onDateChange={onDateChange}
        />
        <div className="alignment-playback-row">
          <span className="alignment-current-date">{formatDate(currentDate)}</span>
          <button
            className="minima-nav-btn"
            onClick={() => onDateChange(new Date())}
            title="Jump to today"
          >
            Today
          </button>
          <PlaybackControls
            isPlaying={isPlaying}
            speed={speed}
            onTogglePlay={togglePlay}
            onSetSpeed={setSpeed}
          />
          <div className="minima-nav">
            <button
              className="minima-nav-btn"
              onClick={() => jumpToMinimum('prev')}
              disabled={!hasPrev}
              title="Previous minimum"
            >
              ◀ Prev
            </button>
            <button
              className="minima-nav-btn"
              onClick={() => jumpToMinimum('next')}
              disabled={!hasNext}
              title="Next minimum"
            >
              Next ▶
            </button>
          </div>
          <SeriesToggle visible={visibleSeries} onChange={setVisibleSeries} inline />
        </div>
        <SkyView
          bodies={selectedBodies}
          date={currentDate}
          center={skyCenter}
          onCenterChange={setSkyCenter}
        />
      </div>
    </div>
  )
}
