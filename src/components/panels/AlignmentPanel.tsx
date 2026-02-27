import PlanetPicker from '../alignment/PlanetPicker'
import TimeRangeSelector from '../alignment/TimeRangeSelector'
import SeriesToggle from '../alignment/SeriesToggle'
import MinimaTable from '../alignment/MinimaTable'
import { AlignmentState } from '../../hooks/useAlignmentState'

interface AlignmentPanelProps {
  alignment: AlignmentState
  isLandscape?: boolean
}

export default function AlignmentPanel({ alignment, isLandscape }: AlignmentPanelProps) {
  const {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    visibleSeries, setVisibleSeries,
    minPlanets, setMinPlanets,
    effectiveMin,
    allMinima,
    availableTabs,
    currentDateMs,
    handleDateSelect,
    setActiveTab,
  } = alignment

  const controls = (
    <>
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
          <label className="control-label">Min planets</label>
          <div className="min-planets-chips">
            {Array.from({ length: selectedBodies.length - 1 }, (_, i) => i + 2).map((n) => {
              const disabled = n < selectedBodies.length - 3
              return (
                <button
                  key={n}
                  className={`min-planet-chip ${effectiveMin === n ? 'active' : ''}`}
                  disabled={disabled}
                  onClick={() => setMinPlanets(n)}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )

  const minimaTable = (
    <MinimaTable
      minima={allMinima}
      availableTabs={availableTabs}
      currentDate={currentDateMs}
      onSelect={handleDateSelect}
      onTabChange={setActiveTab}
    />
  )

  if (isLandscape) {
    return (
      <div className="alignment-panel-inner alignment-panel-landscape">
        <div className="alignment-landscape-left">{controls}</div>
        <div className="alignment-landscape-right">{minimaTable}</div>
      </div>
    )
  }

  return (
    <div className="alignment-panel-inner">
      {controls}
      {minimaTable}
    </div>
  )
}
