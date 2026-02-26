import { memo, useState, useRef, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { AlignmentDataPoint, AlignmentKind } from '../../types'
import { SERIES_COLORS, formatDate } from '../../constants'

const TOOLTIP_STYLE = {
  background: 'rgba(10,10,20,0.95)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  fontSize: 11,
}

const SERIES_LABELS: Record<string, string> = {
  separation: 'Total',
  eveningSep: 'Evening',
  morningSep: 'Morning',
}

interface SeparationChartProps {
  data: AlignmentDataPoint[]
  currentDate: number | null
  onDateClick: (dateMs: number) => void
  visibleSeries: Set<AlignmentKind>
}

/** The heavy Recharts chart — memoized to skip re-renders when only currentDate changes */
const ChartInner = memo(function ChartInner({
  data,
  onDateClick,
  visibleSeries,
  xDomain,
}: Pick<SeparationChartProps, 'data' | 'onDateClick' | 'visibleSeries'> & { xDomain: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 5, bottom: 0, left: 5 }}
        onClick={(e: any) => {
          if (e?.activePayload?.[0]) {
            onDateClick(e.activePayload[0].payload.date)
          }
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis
          dataKey="date"
          type="number"
          domain={xDomain}
          allowDataOverflow
          tickFormatter={(v) => formatDate(v)}
          stroke="#666"
          fontSize={10}
          minTickGap={40}
        />
        <YAxis
          domain={[0, 360]}
          ticks={[0, 60, 120, 180, 240, 300, 360]}
          stroke="#666"
          fontSize={10}
          width={35}
          tickFormatter={(v) => `${v}°`}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(label) => formatDate(label as number)}
          formatter={(value?: number, name?: string) =>
            [`${Number(value ?? 0).toFixed(1)}°`, SERIES_LABELS[name ?? ''] || name]
          }
        />
        {visibleSeries.has('total') && (
          <Line
            type="monotone"
            dataKey="separation"
            stroke={SERIES_COLORS.total}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
        )}
        {visibleSeries.has('evening') && (
          <Line
            type="monotone"
            dataKey="eveningSep"
            stroke={SERIES_COLORS.evening}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 2 }}
            strokeDasharray="4 2"
          />
        )}
        {visibleSeries.has('morning') && (
          <Line
            type="monotone"
            dataKey="morningSep"
            stroke={SERIES_COLORS.morning}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 2 }}
            strokeDasharray="4 2"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
})

// Recharts left margin (5) + YAxis width (35) + right margin (5)
const CHART_PAD = 45

export default function SeparationChart({
  data,
  currentDate,
  onDateClick,
  visibleSeries,
}: SeparationChartProps) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState(0)
  const chartRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoomLevel)
  zoomRef.current = zoomLevel
  const panRef = useRef(0)
  panRef.current = panOffset
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)
  const dragRef = useRef<{ startX: number; startPan: number; moved: boolean } | null>(null)
  const wasDragging = useRef(false)
  const fullSpanRef = useRef(0)
  const xSpanRef = useRef(0)

  const zoomIn = () => setZoomLevel((z) => Math.min(z * 2, 16))
  const zoomOut = () => setZoomLevel((z) => Math.max(z / 2, 1))
  const zoomReset = () => { setZoomLevel(1); setPanOffset(0) }

  // Data time bounds
  const dataMin = data.length > 0 ? data[0].date : 0
  const dataMax = data.length > 0 ? data[data.length - 1].date : 0
  const fullSpan = dataMax - dataMin
  fullSpanRef.current = fullSpan

  // Reset zoom when data range changes
  useEffect(() => {
    setZoomLevel(1)
    setPanOffset(0)
  }, [dataMin, dataMax])

  // Compute zoomed X domain
  const halfSpan = fullSpan / (2 * zoomLevel)
  const center = (dataMin + dataMax) / 2
  const maxPan = fullSpan / 2 - halfSpan
  const clampedPan = Math.max(-maxPan, Math.min(maxPan, panOffset))

  const xDomain = useMemo((): [number, number] => [
    center + clampedPan - halfSpan,
    center + clampedPan + halfSpan,
  ], [center, clampedPan, halfSpan])

  xSpanRef.current = xDomain[1] - xDomain[0]

  // Gesture handling: zoom (wheel + pinch) + drag-to-pan (mouse + touch)
  useEffect(() => {
    const el = chartRef.current
    if (!el) return

    const applyPan = (raw: number) => {
      const fs = fullSpanRef.current
      const hs = fs / (2 * zoomRef.current)
      const max = fs / 2 - hs
      const clamped = Math.max(-max, Math.min(max, raw))
      panRef.current = clamped
      setPanOffset(clamped)
    }

    // Desktop trackpad pinch (ctrl+wheel)
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      setZoomLevel((z) => Math.max(1, Math.min(16, z * factor)))
    }

    // Mouse drag to pan
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      dragRef.current = { startX: e.clientX, startPan: panRef.current, moved: false }

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        if (!dragRef.current.moved && Math.abs(ev.clientX - dragRef.current.startX) < 3) return
        dragRef.current.moved = true
        const plotW = (el.clientWidth || 400) - CHART_PAD
        const msPerPx = xSpanRef.current / plotW
        applyPan(dragRef.current.startPan - (ev.clientX - dragRef.current.startX) * msPerPx)
      }

      const onMouseUp = () => {
        if (dragRef.current?.moved) wasDragging.current = true
        dragRef.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    // Capture-phase click handler to block Recharts onClick after a drag
    const onClick = (e: MouseEvent) => {
      if (wasDragging.current) {
        e.stopPropagation()
        wasDragging.current = false
      }
    }

    // Touch: single-finger drag, two-finger pinch
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        dragRef.current = null
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        pinchRef.current = { startDist: dist, startZoom: zoomRef.current }
      } else if (e.touches.length === 1) {
        dragRef.current = { startX: e.touches[0].clientX, startPan: panRef.current, moved: false }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const scale = dist / pinchRef.current.startDist
        setZoomLevel(Math.max(1, Math.min(16, pinchRef.current.startZoom * scale)))
      } else if (e.touches.length === 1 && dragRef.current && !pinchRef.current) {
        if (!dragRef.current.moved && Math.abs(e.touches[0].clientX - dragRef.current.startX) < 3) return
        e.preventDefault()
        dragRef.current.moved = true
        const plotW = (el.clientWidth || 400) - CHART_PAD
        const msPerPx = xSpanRef.current / plotW
        applyPan(dragRef.current.startPan - (e.touches[0].clientX - dragRef.current.startX) * msPerPx)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null
      if (e.touches.length === 0) {
        if (dragRef.current?.moved) wasDragging.current = true
        dragRef.current = null
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('click', onClick, true)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  if (data.length === 0) {
    return <div className="chart-empty">Select planets and a time range to see alignment data.</div>
  }

  const emptyKinds: string[] = []
  if (visibleSeries.has('morning') && !data.some((d) => d.morningSep != null)) {
    emptyKinds.push('AM')
  }
  if (visibleSeries.has('evening') && !data.some((d) => d.eveningSep != null)) {
    emptyKinds.push('PM')
  }

  // Current-date indicator within zoomed domain
  let indicatorPct: number | null = null
  if (currentDate != null && data.length >= 2) {
    const span = xDomain[1] - xDomain[0]
    if (span > 0 && currentDate >= xDomain[0] && currentDate <= xDomain[1]) {
      indicatorPct = ((currentDate - xDomain[0]) / span) * 100
    }
  }

  return (
    <div className="separation-chart">
      <div className="chart-zoom-header">
        <span className="control-label">Max Longitude Span</span>
        <div className="sky-zoom-controls">
          <button className="sky-zoom-btn" onClick={zoomOut} disabled={zoomLevel <= 1}>{'\u2212'}</button>
          <button className="sky-zoom-btn" onClick={zoomReset} disabled={zoomLevel <= 1}>
            {zoomLevel <= 1 ? '1\u00d7' : `${zoomLevel % 1 === 0 ? zoomLevel : zoomLevel.toFixed(1)}\u00d7`}
          </button>
          <button className="sky-zoom-btn" onClick={zoomIn} disabled={zoomLevel >= 16}>+</button>
        </div>
      </div>
      {emptyKinds.length > 0 && (
        <div className="chart-note">
          No time range in this window where all selected planets are visible in {emptyKinds.join(' and ')}.
        </div>
      )}
      <div className={`chart-wrapper${zoomLevel > 1 ? ' sky-pannable' : ''}`} ref={chartRef}>
        <ChartInner data={data} onDateClick={onDateClick} visibleSeries={visibleSeries} xDomain={xDomain} />
        {indicatorPct != null && (
          <div className="chart-date-track">
            <div
              className="chart-date-indicator"
              style={{ left: `${indicatorPct}%` }}
            >
              <span
                className="chart-date-label"
                style={indicatorPct > 75 ? { right: 6, left: 'auto' } : undefined}
              >
                {formatDate(currentDate!)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
