import PlanetPicker from '../alignment/PlanetPicker'
import TimeRangeSelector from '../alignment/TimeRangeSelector'
import MinimaTable from '../alignment/MinimaTable'
import PPISliders from '../alignment/PPISliders'
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
    minPlanets, setMinPlanets,
    effectiveMin,
    ppiWeights, setPPIWeights,
    ppiResult, dayDetailCombos, selectedDayComboIdx, setSelectedDayComboIdx,
    currentDateMs,
    handleDateSelect,
    setActiveTab,
  } = alignment

  const controls = (
    <>
      <TimeRangeSelector
        startDate={startDate}
        durationDays={durationDays}
        onStartDateChange={setStartDate}
        onDurationChange={setDurationDays}
      />
      <PlanetPicker selected={selectedBodies} onChange={setSelectedBodies} />
      {selectedBodies.length > 2 && (
        <div className="min-planets-control">
          <label className="control-label">Min planets</label>
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
      <PPISliders weights={ppiWeights} onChange={setPPIWeights} />
    </>
  )

  const minimaTable = (
    <MinimaTable
      ppiPeaks={ppiResult.ppiPeaks}
      currentDate={currentDateMs}
      onSelect={handleDateSelect}
      onTabChange={setActiveTab}
      dayDetailCombos={dayDetailCombos}
      selectedDayComboIdx={selectedDayComboIdx}
      onDayComboSelect={setSelectedDayComboIdx}
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
