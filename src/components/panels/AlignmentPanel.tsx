import PlanetPicker from '../alignment/PlanetPicker'
import TimeRangeSelector from '../alignment/TimeRangeSelector'
import SeriesToggle from '../alignment/SeriesToggle'
import MinimaTable from '../alignment/MinimaTable'
import { AlignmentState } from '../../hooks/useAlignmentState'

interface AlignmentPanelProps {
  alignment: AlignmentState
}

export default function AlignmentPanel({ alignment }: AlignmentPanelProps) {
  const {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    visibleSeries, setVisibleSeries,
    minPlanets, setMinPlanets,
    effectiveMin,
    allMinima,
    currentDateMs,
    handleDateSelect,
  } = alignment

  return (
    <div className="alignment-panel-inner">
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
  )
}
