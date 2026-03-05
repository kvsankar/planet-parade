import { useMemo, useCallback } from 'react'
import PlanetPicker from '../alignment/PlanetPicker'
import TimeRangeSelector from '../alignment/TimeRangeSelector'
import PlanetCountRange from '../alignment/PlanetCountRange'
import MinimaTable from '../alignment/MinimaTable'
import PPISliders from '../alignment/PPISliders'
import PlanetaryDataTable from '../alignment/PlanetaryDataTable'
import { AlignmentState } from '../../hooks/useAlignmentState'
import { CelestialBodyId } from '../../types'
import { ANALYZABLE_BODIES, GEOMETRY_ANALYZABLE_BODIES } from '../../constants'

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
    analysisMode, setAnalysisMode, rankingMetric,
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
      <div className="ppi-sliders">
        <span className="control-label">Ranking Mode</span>
        <div className="ppi-preset-row">
          <button
            className={`ppi-preset-btn ${analysisMode === 'visibility' ? 'active' : ''}`}
            onClick={() => setAnalysisMode('visibility')}
            title="Visibility-first scoring: excludes Sun-straddling combinations and ranks by PPI."
          >
            Visibility (PPI)
          </button>
          <button
            className={`ppi-preset-btn ${analysisMode === 'geometry' ? 'active' : ''}`}
            onClick={() => setAnalysisMode('geometry')}
            title="Pure geometry search: includes Sun-straddling combinations and ranks by smallest angular span."
          >
            Geometry (Span)
          </button>
        </div>
      </div>
      <PlanetPicker
        selected={selectedBodies}
        onChange={setSelectedBodies}
        options={analysisMode === 'geometry' ? GEOMETRY_ANALYZABLE_BODIES : ANALYZABLE_BODIES}
        label={analysisMode === 'geometry' ? 'Bodies' : 'Planets'}
      />
      <PlanetCountRange
        bodyCount={selectedBodies.length}
        effectiveMin={effectiveMin}
        effectiveMax={effectiveMax}
        setMinPlanets={setMinPlanets}
        setMaxPlanets={setMaxPlanets}
      />
      {analysisMode === 'visibility' ? (
        <PPISliders weights={ppiWeights} onChange={setPPIWeights} />
      ) : (
        <div className="chart-empty">Geometry mode ranks by span only. PPI scoring is disabled.</div>
      )}
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
        rankingMetric={rankingMetric}
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
