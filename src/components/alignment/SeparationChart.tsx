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
import { ChartMetric, AlignmentKind, CelestialBodyId } from '../../types'
import { SERIES_COLORS, COUNT_COLORS, BODY_META, MS_PER_DAY, formatDate } from '../../constants'

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(10,10,20,0.95)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  fontSize: 11,
  padding: '6px 8px',
}

const KIND_LABELS: Record<AlignmentKind, string> = {
  morning: 'AM',
  evening: 'PM',
  straddling: 'Straddle',
}

interface SeparationChartProps {
  data: Record<string, number | string | null>[]
  currentDate: number | null
  timeZone?: string | null
  onDateClick: (dateMs: number) => void
  visibleCounts: Set<number>
  visibleMetrics: Set<ChartMetric>
  simpleMode?: boolean
  focusToken?: number
}

function CustomTooltip({ active, payload, label, visibleCounts, visibleMetrics, simpleMode, timeZone }: any) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload
  if (!point) return null

  if (simpleMode) {
    const ppi = point.best_ppi
    const span = point.best_span
    const planetsStr = point.best_planets as string | null
    const planets = planetsStr ? planetsStr.split(',') as CelestialBodyId[] : []
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ marginBottom: 4, color: '#ccc' }}>{formatDate(label as number, timeZone)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {visibleMetrics.has('ppi') && ppi != null && (
            <span style={{ color: '#ddd' }}>PPI {Number(ppi).toFixed(1)}</span>
          )}
          {visibleMetrics.has('span') && span != null && (
            <span style={{ color: '#aaa' }}>{Number(span).toFixed(1)}&deg;</span>
          )}
        </div>
        {planets.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {planets.map((p) => (
              <span key={p} style={{
                fontSize: 10,
                padding: '1px 4px',
                borderRadius: 3,
                background: (BODY_META[p]?.color ?? '#888') + '30',
                color: BODY_META[p]?.color ?? '#aaa',
              }}>
                {p.slice(0, 3)}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  const counts = Array.from(visibleCounts as Set<number>).sort((a: number, b: number) => b - a)

  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ marginBottom: 4, color: '#ccc' }}>{formatDate(label as number, timeZone)}</div>
      {counts.map((k: number) => {
        const ppi = point[`ppi_${k}`]
        const span = point[`span_${k}`]
        const kind = point[`kind_${k}`] as AlignmentKind | undefined
        if (ppi == null && span == null) return null
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ color: COUNT_COLORS[k] ?? '#888', fontWeight: 600 }}>{k}p</span>
            {visibleMetrics.has('ppi') && ppi != null && (
              <span style={{ color: '#ddd' }}>PPI {Number(ppi).toFixed(1)}</span>
            )}
            {visibleMetrics.has('span') && span != null && (
              <span style={{ color: '#aaa' }}>{Number(span).toFixed(1)}&deg;</span>
            )}
            {kind && (
              <span style={{
                fontSize: 9,
                padding: '0 3px',
                borderRadius: 2,
                background: SERIES_COLORS[kind] + '40',
                color: SERIES_COLORS[kind],
              }}>
                {KIND_LABELS[kind]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The heavy Recharts chart — memoized to skip re-renders when only currentDate changes */
const ChartInner = memo(function ChartInner({
  data,
  onDateClick,
  visibleCounts,
  visibleMetrics,
  simpleMode,
  timeZone,
  xDomain,
}: Pick<SeparationChartProps, 'data' | 'onDateClick' | 'visibleCounts' | 'visibleMetrics' | 'simpleMode' | 'timeZone'> & { xDomain: [number, number] }) {
  const showPPI = visibleMetrics.has('ppi')
  const showSpan = visibleMetrics.has('span')
  const counts = Array.from(visibleCounts).sort((a, b) => b - a)

  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      minHeight={0}
      initialDimension={{ width: 1, height: 1 }}
    >
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
          tickFormatter={(v) => formatDate(v, timeZone)}
          stroke="#666"
          fontSize={10}
          minTickGap={40}
        />
        {showPPI && (
          <YAxis
            yAxisId="ppi"
            orientation="left"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            stroke="#888"
            fontSize={10}
            width={32}
            tickFormatter={(v) => `${v}`}
            label={{ value: 'PPI', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#888' } }}
          />
        )}
        {showSpan && (
          <YAxis
            yAxisId="span"
            orientation="right"
            domain={[0, 360]}
            ticks={[0, 90, 180, 270, 360]}
            stroke="#666"
            fontSize={10}
            width={35}
            tickFormatter={(v) => `${v}°`}
          />
        )}
        <Tooltip
          content={<CustomTooltip visibleCounts={visibleCounts} visibleMetrics={visibleMetrics} simpleMode={simpleMode} timeZone={timeZone} />}
        />
        {simpleMode ? (
          <>
            {showPPI && (
              <Line
                type="monotone"
                dataKey="best_ppi"
                yAxisId="ppi"
                stroke="#fff"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 3, fill: '#fff' }}
                connectNulls={false}
              />
            )}
            {showSpan && (
              <Line
                type="monotone"
                dataKey="best_span"
                yAxisId="span"
                stroke="#fff"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 2, fill: '#fff' }}
                connectNulls={false}
              />
            )}
          </>
        ) : (
          counts.flatMap((k) => {
            const color = COUNT_COLORS[k] ?? '#888'
            const lines: React.ReactElement[] = []
            if (showPPI) {
              lines.push(
                <Line
                  key={`ppi_${k}`}
                  type="monotone"
                  dataKey={`ppi_${k}`}
                  yAxisId="ppi"
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={(props: any) => {
                    const kind = props.payload?.[`kind_${k}`] as AlignmentKind | undefined
                    const dotColor = kind ? SERIES_COLORS[kind] : color
                    return <circle cx={props.cx} cy={props.cy} r={3} fill={dotColor} stroke="none" />
                  }}
                  connectNulls={false}
                />
              )
            }
            if (showSpan) {
              lines.push(
                <Line
                  key={`span_${k}`}
                  type="monotone"
                  dataKey={`span_${k}`}
                  yAxisId="span"
                  stroke={color}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 2, fill: color }}
                  connectNulls={false}
                />
              )
            }
            return lines
          })
        )}
      </LineChart>
    </ResponsiveContainer>
  )
})

// Recharts left margin (5) + YAxis width (32) + right margin (5) + right YAxis (35)
const CHART_PAD_BOTH = 77
const CHART_PAD_LEFT = 42
const CHART_PAD_RIGHT = 45

export default function SeparationChart({
  data,
  currentDate,
  timeZone,
  onDateClick,
  visibleCounts,
  visibleMetrics,
  simpleMode,
  focusToken,
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

  const showPPI = visibleMetrics.has('ppi')
  const showSpan = visibleMetrics.has('span')
  const chartPad = showPPI && showSpan ? CHART_PAD_BOTH : showPPI ? CHART_PAD_LEFT : CHART_PAD_RIGHT
  const chartPadRef = useRef(chartPad)
  chartPadRef.current = chartPad

  const zoomIn = () => setZoomLevel((z) => Math.min(z * 2, 16))
  const zoomOut = () => setZoomLevel((z) => Math.max(z / 2, 1))
  const zoomReset = () => { setZoomLevel(1); setPanOffset(0) }

  // Data time bounds
  const dataMin = data.length > 0 ? (data[0].date as number) : 0
  const dataMax = data.length > 0 ? (data[data.length - 1].date as number) : 0
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
        const plotW = (el.clientWidth || 400) - chartPadRef.current
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
        const plotW = (el.clientWidth || 400) - chartPadRef.current
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

  // Auto-pan when an explicit jump (Prev/Next/Today) lands outside the zoomed viewport
  const prevTokenRef = useRef(focusToken)
  useEffect(() => {
    if (focusToken == null || focusToken === prevTokenRef.current) return
    prevTokenRef.current = focusToken

    if (currentDate == null || zoomRef.current <= 1) return

    const fs = fullSpanRef.current
    if (fs <= 0) return
    const hs = fs / (2 * zoomRef.current)
    const dc = (dataMin + dataMax) / 2
    const lo = dc + panRef.current - hs
    const hi = dc + panRef.current + hs

    if (currentDate < lo || currentDate > hi) {
      const newPan = currentDate - dc
      const maxP = fs / 2 - hs
      const clamped = Math.max(-maxP, Math.min(maxP, newPan))
      panRef.current = clamped
      setPanOffset(clamped)
    }
  }, [focusToken, currentDate, dataMin, dataMax])

  if (data.length === 0) {
    return <div className="chart-empty">Select planets and a time range to see alignment data.</div>
  }

  // Current-date indicator within zoomed domain
  let indicatorPct: number | null = null
  let indicatorPpi: number | null = null
  let indicatorSpan: number | null = null
  let indicatorPlanets: CelestialBodyId[] = []
  if (currentDate != null && data.length >= 2) {
    const span = xDomain[1] - xDomain[0]
    if (span > 0 && currentDate >= xDomain[0] && currentDate <= xDomain[1]) {
      indicatorPct = ((currentDate - xDomain[0]) / span) * 100
      // Find closest data point by date
      const idx = Math.floor((currentDate - (data[0].date as number)) / MS_PER_DAY)
      if (idx >= 0 && idx < data.length) {
        const pt = data[idx]
        indicatorPpi = pt.best_ppi as number | null
        indicatorSpan = pt.best_span as number | null
        const ps = pt.best_planets as string | null
        if (ps) indicatorPlanets = ps.split(',') as CelestialBodyId[]
      }
    }
  }
  const indicatorFlip = indicatorPct != null && indicatorPct > 75

  // Track left/right offsets for the date indicator
  const trackLeft = showPPI ? 37 : 5
  const trackRight = showSpan ? 40 : 5

  return (
    <div className="separation-chart">
      <div className="chart-zoom-header">
        <span className="control-label">Parade Timeline</span>
        <div className="sky-zoom-controls">
          <button className="sky-zoom-btn" onClick={zoomOut} disabled={zoomLevel <= 1}>{'\u2212'}</button>
          <button className="sky-zoom-btn" onClick={zoomReset} disabled={zoomLevel <= 1}>
            {zoomLevel <= 1 ? '1\u00d7' : `${zoomLevel % 1 === 0 ? zoomLevel : zoomLevel.toFixed(1)}\u00d7`}
          </button>
          <button className="sky-zoom-btn" onClick={zoomIn} disabled={zoomLevel >= 16}>+</button>
        </div>
      </div>
      <div className={`chart-wrapper${zoomLevel > 1 ? ' sky-pannable' : ''}`} ref={chartRef}>
        <ChartInner
          data={data}
          onDateClick={onDateClick}
          visibleCounts={visibleCounts}
          visibleMetrics={visibleMetrics}
          simpleMode={simpleMode}
          timeZone={timeZone}
          xDomain={xDomain}
        />
        {indicatorPct != null && (
          <div className="chart-date-track" style={{ left: trackLeft, right: trackRight }}>
            <div
              className="chart-date-indicator"
              style={{ left: `${indicatorPct}%` }}
            >
              <div
                className="chart-date-label"
                style={indicatorFlip ? { right: 6, left: 'auto', alignItems: 'flex-end' } as const : undefined}
              >
                <span>{formatDate(currentDate!, timeZone)}</span>
                {indicatorPpi != null && (
                  <span>
                    PPI {indicatorPpi.toFixed(1)}
                    {indicatorSpan != null && <> &middot; {indicatorSpan.toFixed(1)}&deg;</>}
                  </span>
                )}
                {indicatorPlanets.length > 0 && (
                  <span className="chart-date-planets">
                    {indicatorPlanets.map((p) => (
                      <span key={p} style={{ color: BODY_META[p]?.color ?? '#aaa' }}>
                        {p.slice(0, 3)}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
