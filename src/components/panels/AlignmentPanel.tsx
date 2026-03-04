import { useMemo, useCallback } from 'react'
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
  timeZone?: string | null
  isLandscape?: boolean
  onPlanetariumResetRequest?: () => void
}

export default function AlignmentPanel({
  alignment,
  currentDate,
  timeZone,
  isLandscape,
  onPlanetariumResetRequest,
}: AlignmentPanelProps) {
  const {
    selectedBodies, setSelectedBodies,
    startDate, setStartDate,
    durationDays, setDurationDays,
    setMinPlanets, setMaxPlanets,
    effectiveMin, effectiveMax,
    ppiWeights, setPPIWeights,
    filteredPeaks, dayDetailCombos, selectedDayComboIdx, setSelectedDayComboIdx,
    currentDateMs,
    hasPrev, hasNext,
    handleDateSelect, jumpToPeak,
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

  const handlePeakSelect = useCallback((dateMs: number) => {
    onPlanetariumResetRequest?.()
    handleDateSelect(dateMs)
  }, [handleDateSelect, onPlanetariumResetRequest])

  const handlePrevPeak = useCallback(() => {
    onPlanetariumResetRequest?.()
    jumpToPeak('prev')
  }, [jumpToPeak, onPlanetariumResetRequest])

  const handleNextPeak = useCallback(() => {
    onPlanetariumResetRequest?.()
    jumpToPeak('next')
  }, [jumpToPeak, onPlanetariumResetRequest])

  const tables = (
    <div className="alignment-tables">
      <MinimaTable
        ppiPeaks={filteredPeaks}
        currentDate={currentDateMs}
        onSelect={handlePeakSelect}
        onPrev={handlePrevPeak}
        onNext={handleNextPeak}
        hasPrev={hasPrev}
        hasNext={hasNext}
        timeZone={timeZone}
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
