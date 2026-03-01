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
    maxPlanets, setMaxPlanets,
    effectiveMin, effectiveMax,
    ppiWeights, setPPIWeights,
    ppiResult, dayDetailCombos, selectedDayComboIdx, setSelectedDayComboIdx,
    currentDateMs,
    handleDateSelect,
    setActiveTab,
  } = alignment

  const handleRangeClick = (n: number) => {
    if (n >= effectiveMin && n <= effectiveMax) {
      // Click inside range (including boundaries) — collapse to single value
      setMinPlanets(n)
      setMaxPlanets(n)
    } else if (n < effectiveMin) {
      // Click below range — extend min down
      setMinPlanets(n)
    } else {
      // Click above range — extend max up
      setMaxPlanets(n)
    }
  }

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
          <label className="control-label">
            Planet count
            <span className="planet-range-label">{effectiveMin === effectiveMax ? effectiveMin : `${effectiveMin}\u2013${effectiveMax}`}</span>
          </label>
          <div className="min-planets-chips">
            {Array.from({ length: selectedBodies.length - 1 }, (_, i) => i + 2).map((n) => (
              <button
                key={n}
                className={`min-planet-chip ${n >= effectiveMin && n <= effectiveMax ? 'active' : ''}`}
                onClick={() => handleRangeClick(n)}
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
