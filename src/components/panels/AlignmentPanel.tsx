import { useMemo } from 'react'
import PlanetPicker from '../alignment/PlanetPicker'
import TimeRangeSelector from '../alignment/TimeRangeSelector'
import PlanetCountRange from '../alignment/PlanetCountRange'
import MinimaTable from '../alignment/MinimaTable'
import PPISliders from '../alignment/PPISliders'
import PlanetaryDataTable from '../alignment/PlanetaryDataTable'
import { AlignmentState } from '../../hooks/useAlignmentState'
import { CelestialBodyId } from '../../types'

interface AlignmentPanelProps {
  alignment: AlignmentState
  currentDate: Date
  isLandscape?: boolean
}

export default function AlignmentPanel({ alignment, currentDate, isLandscape }: AlignmentPanelProps) {
  const {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    setMinPlanets, setMaxPlanets,
    effectiveMin, effectiveMax,
    ppiWeights, setPPIWeights,
    ppiResult, dayDetailCombos, selectedDayComboIdx, setSelectedDayComboIdx,
    currentDateMs,
    handleDateSelect,
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
      <PlanetCountRange
        bodyCount={selectedBodies.length}
        effectiveMin={effectiveMin}
        effectiveMax={effectiveMax}
        setMinPlanets={setMinPlanets}
        setMaxPlanets={setMaxPlanets}
      />
      <PPISliders weights={ppiWeights} onChange={setPPIWeights} />
    </>
  )

  const activeCombo = dayDetailCombos.length > 0
    ? dayDetailCombos[selectedDayComboIdx ?? 0]
    : null
  const highlightedPlanets = useMemo(
    () => activeCombo ? new Set<CelestialBodyId>(activeCombo.planets) : undefined,
    [activeCombo],
  )

  const tables = (
    <div className="alignment-tables">
      <MinimaTable
        ppiPeaks={ppiResult.ppiPeaks}
        currentDate={currentDateMs}
        onSelect={handleDateSelect}
        dayDetailCombos={dayDetailCombos}
        selectedDayComboIdx={selectedDayComboIdx}
        onDayComboSelect={setSelectedDayComboIdx}
      />
      <PlanetaryDataTable bodies={selectedBodies} date={currentDate} highlightedPlanets={highlightedPlanets} />
    </div>
  )

  if (isLandscape) {
    return (
      <div className="alignment-panel-inner alignment-panel-landscape">
        <div className="alignment-landscape-left">{controls}</div>
        <div className="alignment-landscape-right">{tables}</div>
      </div>
    )
  }

  return (
    <div className="alignment-panel-inner">
      {controls}
      {tables}
    </div>
  )
}
