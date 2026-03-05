import { useState } from 'react'
import SeparationChart from '../alignment/SeparationChart'
import AlignmentTimeSlider from '../alignment/AlignmentTimeSlider'
import PlanetCountRange from '../alignment/PlanetCountRange'
import { AlignmentState } from '../../hooks/useAlignmentState'
import { ChartMetric } from '../../types'

interface ChartPanelProps {
  alignment: AlignmentState
  currentDate: Date
  timeZone?: string | null
  onDateChange: (d: Date) => void
}

export default function ChartPanel({
  alignment,
  currentDate,
  timeZone,
  onDateChange,
}: ChartPanelProps) {
  const {
    chartData,
    analysisMode,
    selectedBodies,
    startDate,
    durationDays,
    setMinPlanets, setMaxPlanets,
    effectiveMin, effectiveMax,
    visibleCounts,
    visibleMetrics, setVisibleMetrics,
    simpleMode, setSimpleMode,
    currentDateMs,
    handleDateSelect,
    hasPrev, hasNext, todayInRange, jumpToPeak,
    navMode, setNavMode,
  } = alignment
  const showPpi = analysisMode === 'visibility'

  const [focusToken, setFocusToken] = useState(0)
  const bump = () => setFocusToken((t) => t + 1)

  const toggleMetric = (m: ChartMetric) => {
    if (!showPpi && m === 'ppi') return
    const next = new Set(visibleMetrics)
    if (next.has(m)) {
      if (next.size > 1) next.delete(m)
    } else {
      next.add(m)
    }
    setVisibleMetrics(next)
  }

  return (
    <div className="chart-panel-inner">
      <div className="chart-toggles-row">
        <PlanetCountRange
          bodyCount={selectedBodies.length}
          effectiveMin={effectiveMin}
          effectiveMax={effectiveMax}
          setMinPlanets={setMinPlanets}
          setMaxPlanets={setMaxPlanets}
          compact
        />
        <div className="series-toggle-chips">
          <button
            className={`series-chip ${simpleMode ? 'active' : ''}`}
            style={{
              borderColor: '#aaa',
              ...(simpleMode ? { background: 'rgba(255,255,255,0.1)' } : {}),
            }}
            onClick={() => setSimpleMode(true)}
          >
            Simple
          </button>
          <button
            className={`series-chip ${!simpleMode ? 'active' : ''}`}
            style={{
              borderColor: '#aaa',
              ...(!simpleMode ? { background: 'rgba(255,255,255,0.1)' } : {}),
            }}
            onClick={() => setSimpleMode(false)}
          >
            Advanced
          </button>
        </div>
        {showPpi ? (
          <div className="series-toggle-chips">
            <button
              className={`series-chip ${visibleMetrics.has('ppi') ? 'active' : ''}`}
              style={{
                borderColor: '#aaa',
                ...(visibleMetrics.has('ppi') ? { background: 'rgba(255,255,255,0.1)' } : {}),
              }}
              onClick={() => toggleMetric('ppi')}
            >
              <span className="series-chip-line" style={{ borderBottom: '2px solid #aaa' }} />
              PPI
            </button>
            <button
              className={`series-chip ${visibleMetrics.has('span') ? 'active' : ''}`}
              style={{
                borderColor: '#aaa',
                ...(visibleMetrics.has('span') ? { background: 'rgba(255,255,255,0.1)' } : {}),
              }}
              onClick={() => toggleMetric('span')}
            >
              <span className="series-chip-line dashed" style={{ borderBottom: '2px dashed #aaa' }} />
              Span
            </button>
          </div>
        ) : (
          <div className="series-toggle-chips">
            <span className="series-chip active" style={{ borderColor: '#aaa', background: 'rgba(255,255,255,0.1)' }}>
              <span className="series-chip-line dashed" style={{ borderBottom: '2px dashed #aaa' }} />
              Span
            </span>
          </div>
        )}
      </div>
      <SeparationChart
        data={chartData}
        currentDate={currentDateMs}
        timeZone={timeZone}
        onDateClick={handleDateSelect}
        visibleCounts={visibleCounts}
        visibleMetrics={visibleMetrics}
        simpleMode={simpleMode}
        focusToken={focusToken}
      />
      <div className="chart-slider-row">
        <AlignmentTimeSlider
          startDate={startDate}
          durationDays={durationDays}
          currentDate={currentDate}
          onDateChange={onDateChange}
        />
      </div>
      <div className="chart-controls-row">
        {showPpi ? (
          <div className="series-toggle-chips">
            <button
              className={`series-chip ${navMode === 'ppi' ? 'active' : ''}`}
              style={{
                borderColor: '#aaa',
                ...(navMode === 'ppi' ? { background: 'rgba(255,255,255,0.1)' } : {}),
              }}
              onClick={() => setNavMode('ppi')}
              title="Navigate PPI peaks (maxima)"
            >
              PPI &#9650;
            </button>
            <button
              className={`series-chip ${navMode === 'span' ? 'active' : ''}`}
              style={{
                borderColor: '#aaa',
                ...(navMode === 'span' ? { background: 'rgba(255,255,255,0.1)' } : {}),
              }}
              onClick={() => setNavMode('span')}
              title="Navigate span minima (tightest clusters)"
            >
              Span &#9660;
            </button>
          </div>
        ) : (
          <div className="series-toggle-chips">
            <span className="series-chip active" style={{ borderColor: '#aaa', background: 'rgba(255,255,255,0.1)' }} title="Navigate span minima (tightest clusters)">
              Span &#9660;
            </span>
          </div>
        )}
        <div className="chart-nav-btns">
          <button
            className="minima-nav-btn"
            onClick={() => { onDateChange(new Date()); bump() }}
            disabled={!todayInRange}
            title="Jump to today"
          >
            Today
          </button>
          <button
            className="minima-nav-btn"
            onClick={() => { jumpToPeak('prev'); bump() }}
            disabled={!hasPrev}
            title={navMode === 'ppi' ? 'Previous PPI peak' : 'Previous span minimum'}
          >
            &#9664; Prev
          </button>
          <button
            className="minima-nav-btn"
            onClick={() => { jumpToPeak('next'); bump() }}
            disabled={!hasNext}
            title={navMode === 'ppi' ? 'Next PPI peak' : 'Next span minimum'}
          >
            Next &#9654;
          </button>
        </div>
      </div>
    </div>
  )
}
