import { useMemo } from 'react'
import SeparationChart from '../alignment/SeparationChart'
import AlignmentTimeSlider from '../alignment/AlignmentTimeSlider'
import SeriesToggle from '../alignment/SeriesToggle'
import { AlignmentState } from '../../hooks/useAlignmentState'
import { AlignmentDataPoint } from '../../types'
import { formatDate, SERIES_COLORS } from '../../constants'

interface ChartPanelProps {
  alignment: AlignmentState
  currentDate: Date
  onDateChange: (d: Date) => void
}

/** Find the contiguous non-null range around `dateMs` for a given field */
function findActiveRange(
  series: AlignmentDataPoint[],
  field: 'morningSep' | 'eveningSep',
  dateMs: number,
): { from: number; to: number } | null {
  // Build contiguous ranges of non-null data
  const ranges: { from: number; to: number }[] = []
  let start: number | null = null
  let end: number | null = null

  for (const d of series) {
    if (d[field] != null) {
      if (start === null) start = d.date
      end = d.date
    } else if (start !== null && end !== null) {
      ranges.push({ from: start, to: end })
      start = null
      end = null
    }
  }
  if (start !== null && end !== null) {
    ranges.push({ from: start, to: end })
  }

  // Only return the range if dateMs falls within it
  for (const r of ranges) {
    if (dateMs >= r.from && dateMs <= r.to) return r
  }
  return null
}

export default function ChartPanel({
  alignment,
  currentDate,
  onDateChange,
}: ChartPanelProps) {
  const {
    series,
    startDate,
    durationDays,
    visibleSeries, setVisibleSeries,
    currentDateMs,
    handleDateSelect,
    hasPrev, hasNext, jumpToMinimum,
  } = alignment

  // Find the active contiguous range around currentDate for AM/PM
  const activeRanges = useMemo(() => {
    const result: { label: string; from: number; to: number; color: string }[] = []
    for (const [key, field, label, color] of [
      ['morning', 'morningSep', 'AM', SERIES_COLORS.morning],
      ['evening', 'eveningSep', 'PM', SERIES_COLORS.evening],
    ] as const) {
      if (!visibleSeries.has(key)) continue
      const range = findActiveRange(series, field, currentDateMs)
      if (range) result.push({ label, ...range, color })
    }
    return result
  }, [series, visibleSeries, currentDateMs])

  return (
    <div className="chart-panel-inner">
      <SeparationChart
        data={series}
        currentDate={currentDateMs}
        onDateClick={handleDateSelect}
        visibleSeries={visibleSeries}
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
        <div className="chart-range-labels">
          {activeRanges.map((r) => (
            <span key={r.label} className="chart-date-range" style={{ color: r.color }}>
              {r.label}: {formatDate(r.from)} — {formatDate(r.to)}
            </span>
          ))}
        </div>
        <div className="chart-nav-btns">
          <SeriesToggle visible={visibleSeries} onChange={setVisibleSeries} inline />
          <button
            className="minima-nav-btn"
            onClick={() => onDateChange(new Date())}
            title="Jump to today"
          >
            Today
          </button>
          <button
            className="minima-nav-btn"
            onClick={() => jumpToMinimum('prev')}
            disabled={!hasPrev}
            title="Previous minimum"
          >
            &#9664; Prev
          </button>
          <button
            className="minima-nav-btn"
            onClick={() => jumpToMinimum('next')}
            disabled={!hasNext}
            title="Next minimum"
          >
            Next &#9654;
          </button>
        </div>
      </div>
    </div>
  )
}
