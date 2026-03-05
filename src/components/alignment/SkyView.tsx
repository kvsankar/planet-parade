import { useMemo, useRef, useState, useEffect, useId } from 'react'
import { CelestialBodyId, AlignmentKind } from '../../types'
import { BODY_META, formatDate, SERIES_COLORS } from '../../constants'
import { getGeocentricEclipticCoords, computeSpanArc, wrap180, BestPerKind } from '../../lib/alignment'
import { getBodyVisualMagnitude, SkyBodyId } from '../../lib/astronomy'

export type SkyViewCenter = 'lon0' | 'sun'

interface SkyViewProps {
  bodies: CelestialBodyId[]
  date: Date
  center: SkyViewCenter
  onCenterChange: (c: SkyViewCenter) => void
  visibleSeries: Set<AlignmentKind>
  bestPerKind: BestPerKind
  isLandscape?: boolean
}

interface BodyPlotData {
  id: CelestialBodyId
  absLon: number
  lat: number
  plotLon: number
  color: string
  elongation: number // positive = east/evening, negative = west/morning
  magnitude: number | null
}

/** Convert an arc { start, end } in absolute longitude to plotLon rects, handling ±180 wrap */
function arcToRects(arc: { start: number; end: number }, refLon: number): { left: number; right: number }[] {
  const pStart = wrap180(arc.start - refLon)
  const pEnd = wrap180(arc.end - refLon)
  if (pStart <= pEnd) {
    return [{ left: pStart, right: pEnd }]
  }
  return [
    { left: -180, right: pEnd },
    { left: pStart, right: 180 },
  ]
}

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface SpanInfo {
  label: string
  span: number
  rects: { left: number; right: number }[]
  color: string
}

const MS_PER_HOUR = 3_600_000
const HEADER_H = 28

export default function SkyView({ bodies, date, center, onCenterChange, visibleSeries, bestPerKind, isLandscape }: SkyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clipId = useId()
  const [cW, setCW] = useState(400)
  const [cH, setCH] = useState(300)
  const [zoomLevel, setZoomLevel] = useState(1)
  const zoomIn = () => setZoomLevel((z) => Math.min(z * 2, 16))
  const zoomOut = () => setZoomLevel((z) => Math.max(z / 2, 1))
  const zoomReset = () => { setZoomLevel(1); setPanOffset(0) }
  const chartRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoomLevel)
  zoomRef.current = zoomLevel
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)
  const [panOffset, setPanOffset] = useState(0)
  const panRef = useRef(0)
  panRef.current = panOffset
  const dragRef = useRef<{ startX: number; startPan: number } | null>(null)
  const plotWRef = useRef(10)
  const xSpanRef = useRef(360)

  // Quantize date to nearest hour for ephemeris cache efficiency during animation
  const quantizedHour = Math.round(date.getTime() / MS_PER_HOUR)
  const quantizedDate = useMemo(() => {
    return new Date(quantizedHour * MS_PER_HOUR)
  }, [quantizedHour])

  // Observe container dimensions
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setCW(Math.max(200, Math.floor(entry.contentRect.width)))
        setCH(Math.max(100, Math.floor(entry.contentRect.height)))
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Gesture handling: zoom (wheel + pinch) + drag-to-pan (mouse + touch)
  useEffect(() => {
    const el = chartRef.current
    if (!el) return

    const applyPan = (raw: number) => {
      const curHalfLon = 180 / zoomRef.current
      const max = 180 - curHalfLon
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
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startPan: panRef.current }

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const dx = ev.clientX - dragRef.current.startX
        const degPerPx = xSpanRef.current / plotWRef.current
        applyPan(dragRef.current.startPan - dx * degPerPx)
      }

      const onMouseUp = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
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
        dragRef.current = { startX: e.touches[0].clientX, startPan: panRef.current }
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
        e.preventDefault()
        const dx = e.touches[0].clientX - dragRef.current.startX
        const degPerPx = xSpanRef.current / plotWRef.current
        applyPan(dragRef.current.startPan - dx * degPerPx)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null
      if (e.touches.length === 0) dragRef.current = null
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const sunLon = useMemo(() => {
    return getGeocentricEclipticCoords('Sun', quantizedDate).lon
  }, [quantizedDate])

  const refLon = center === 'sun' ? sunLon : 0

  // Compute body positions + elongation
  const plotData = useMemo((): BodyPlotData[] => {
    if (bodies.length === 0) return []

    const items = bodies.map((id) => {
      const ecl = getGeocentricEclipticCoords(id, quantizedDate)
      const mag = getBodyVisualMagnitude(id as SkyBodyId, quantizedDate)
      return { id, absLon: ecl.lon, lat: ecl.lat, color: BODY_META[id].color, elongation: wrap180(ecl.lon - sunLon), magnitude: mag }
    })

    if (!items.some((item) => item.id === 'Sun')) {
      const sunEcl = getGeocentricEclipticCoords('Sun', quantizedDate)
      items.push({ id: 'Sun' as CelestialBodyId, absLon: sunEcl.lon, lat: sunEcl.lat, color: BODY_META.Sun.color, elongation: 0, magnitude: null })
    }

    return items.map((c) => ({
      ...c,
      plotLon: wrap180(c.absLon - refLon),
    }))
  }, [bodies, quantizedDate, refLon, sunLon])

  // Derive shading/span annotations from the lifted bestPerKind
  const { spanInfos, shadingBands, comboSet } = useMemo(() => {
    const planets = plotData.filter((b) => b.id !== 'Sun')
    if (planets.length < 2) {
      return { spanInfos: [] as SpanInfo[], shadingBands: [] as { kind: AlignmentKind; rects: { left: number; right: number }[] }[], comboSet: new Set<string>() }
    }

    const spans: SpanInfo[] = []
    const bands: { kind: AlignmentKind; rects: { left: number; right: number }[] }[] = []

    // Collect all planets that appear in any visible best combo (for dimming non-combo planets)
    const allComboIds = new Set<string>()

    for (const kind of ['morning', 'evening', 'straddling'] as AlignmentKind[]) {
      const best = bestPerKind[kind]
      if (!best) continue
      for (const id of best.bodies) allComboIds.add(id)

      if (best.longitudes.length >= 2) {
        const arc = computeSpanArc(best.longitudes)
        if (arc) {
          const rects = arcToRects(arc, refLon)
          bands.push({ kind, rects })
          const kindLabel = kind === 'straddling' ? 'Straddle' : kind === 'morning' ? 'AM' : 'PM'
          spans.push({ label: `${kindLabel} (${best.bodies.length})`, span: best.span, rects, color: SERIES_COLORS[kind] })
        }
      }
    }

    return { spanInfos: spans, shadingBands: bands, comboSet: allComboIds }
  }, [plotData, refLon, bestPerKind])

  // Observe chart area dimensions for accurate SVG sizing in landscape
  const [chartAreaW, setChartAreaW] = useState(0)
  const [chartAreaH, setChartAreaH] = useState(0)
  useEffect(() => {
    if (!isLandscape) return
    const el = chartRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setChartAreaW(Math.max(200, Math.floor(entry.contentRect.width)))
        setChartAreaH(Math.max(100, Math.floor(entry.contentRect.height)))
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [isLandscape])

  const chartH = cH - HEADER_H

  // SVG layout — in landscape, use observed chart area dimensions
  const width = isLandscape && chartAreaW > 0 ? chartAreaW : cW
  const spanRowCount = spanInfos.length
  const SPAN_ROW_H = 18
  const SPAN_TOP_PAD = 10
  const spanAreaH = spanRowCount > 0 ? SPAN_TOP_PAD + spanRowCount * SPAN_ROW_H + 4 : 0
  const MARGIN = { top: 20, right: 16, bottom: 30 + spanAreaH, left: 50 }
  const plotW = Math.max(10, width - MARGIN.left - MARGIN.right)
  const height = Math.max(isLandscape && chartAreaH > 0 ? chartAreaH : chartH, 120)
  const plotH = Math.max(10, height - MARGIN.top - MARGIN.bottom)

  const halfLat = 7
  const halfLon = 180 / zoomLevel
  const maxPan = 180 - halfLon
  const clampedPan = Math.max(-maxPan, Math.min(maxPan, panOffset))
  const range = { lonMin: -halfLon + clampedPan, lonMax: halfLon + clampedPan, latMin: -halfLat, latMax: halfLat }

  const xSpan = halfLon * 2
  const ySpan = halfLat * 2
  plotWRef.current = plotW
  xSpanRef.current = xSpan
  const xOf = (plotLon: number) => MARGIN.left + ((plotLon - range.lonMin) / xSpan) * plotW
  const yOf = (lat: number) => MARGIN.top + ((range.latMax - lat) / ySpan) * plotH

  const lonTicks = useMemo(() => {
    const step = niceStep(xSpan, Math.min(12, Math.floor(plotW / 50)))
    const ticks: number[] = []
    const start = Math.ceil(range.lonMin / step) * step
    for (let v = start; v <= range.lonMax; v += step) ticks.push(v)
    return ticks
  }, [range.lonMin, range.lonMax, xSpan, plotW])

  const latTicks = useMemo(() => {
    const step = niceStep(ySpan, 4)
    const ticks: number[] = []
    const start = Math.ceil(range.latMin / step) * step
    for (let v = start; v <= range.latMax; v += step) ticks.push(v)
    return ticks
  }, [range.latMin, range.latMax, ySpan])

  if (bodies.length === 0) {
    return (
      <div className="sky-view" ref={containerRef}>
        <span className="control-label">Ecliptic Strip</span>
        <div className="chart-empty">Select planets to see their positions in the sky.</div>
      </div>
    )
  }

  const dotR = 5
  const sunR = 7
  const sunPlotLon = wrap180(sunLon - refLon)
  const twilightId = clipId + '-tw'

  // Y position where span annotation rows start (below X axis labels)
  const spanBaseY = MARGIN.top + plotH + 24 + SPAN_TOP_PAD

  const chartSection = (
    <div className={`sky-view-chart-area${zoomLevel > 1 ? ' sky-pannable' : ''}`} ref={chartRef} style={isLandscape ? undefined : { height: chartH }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="sky-svg"
      >
        <rect width={width} height={height} fill="#0a0a1a" rx={4} />

        <defs>
          <clipPath id={clipId}>
            <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} />
          </clipPath>
          <linearGradient id={twilightId + 'L'} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#f8a020" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f8a020" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={twilightId + 'R'} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f8a020" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f8a020" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Twilight glow — 30° on each side of the Sun, matching elongation visibility gate */}
        <g clipPath={`url(#${clipId})`}>
          {(() => {
            const sunCx = xOf(sunPlotLon)
            const edgeX = xOf(sunPlotLon + 30) - xOf(sunPlotLon)
            return (
              <>
                <rect x={sunCx - edgeX} y={MARGIN.top} width={edgeX} height={plotH} fill={`url(#${twilightId}L)`} />
                <rect x={sunCx} y={MARGIN.top} width={edgeX} height={plotH} fill={`url(#${twilightId}R)`} />
              </>
            )
          })()}
        </g>

        {/* Grid lines */}
        {lonTicks.map((v) => (
          <line key={`gv${v}`} x1={xOf(v)} y1={MARGIN.top} x2={xOf(v)} y2={MARGIN.top + plotH}
            stroke={v === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={v === 0 ? 1 : 0.5}
            strokeDasharray={v === 0 ? '2 3' : undefined} />
        ))}
        {latTicks.map((v) => (
          <line key={`gh${v}`} x1={MARGIN.left} y1={yOf(v)} x2={MARGIN.left + plotW} y2={yOf(v)}
            stroke={v === 0 ? 'rgba(100,200,100,0.25)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={v === 0 ? 1 : 0.5}
            strokeDasharray={v === 0 ? '4 3' : undefined} />
        ))}

        {/* Shading bands — one per visible kind */}
        <g clipPath={`url(#${clipId})`}>
          {shadingBands.map((band) => {
            if (!visibleSeries.has(band.kind)) return null
            const bandColor = SERIES_COLORS[band.kind]
            const bandLabel = band.kind === 'straddling' ? 'Straddle' : band.kind === 'morning' ? 'AM' : 'PM'
            return band.rects.map((r, i) => {
              const rx = xOf(r.left)
              const rw = xOf(r.right) - rx
              return (
                <g key={`${band.kind}-${i}`}>
                  <rect x={rx} y={MARGIN.top} width={rw} height={plotH}
                    fill={hexToRgba(bandColor, 0.10)} />
                  <text x={rx + rw / 2} y={MARGIN.top + 12} textAnchor="middle"
                    fill={hexToRgba(bandColor, 0.5)} fontSize={10} fontFamily="sans-serif" fontWeight={600}>
                    {bandLabel}
                  </text>
                </g>
              )
            })
          })}
        </g>

        {/* Bodies with leader lines */}
        <g clipPath={`url(#${clipId})`}>
          {plotData.map((b, idx) => {
            const isSun = b.id === 'Sun'
            const inCombo = isSun || comboSet.size === 0 || comboSet.has(b.id)
            const cx = xOf(b.plotLon)
            const cy = yOf(b.lat)
            const r = isSun ? sunR : dotR
            const opacity = isSun ? 0.7 : inCombo ? 1 : 0.3
            if (isSun) {
              return (
                <g key={b.id}>
                  <circle cx={cx} cy={cy} r={r} fill={b.color} opacity={opacity} />
                  <text x={cx} y={cy - r - 4} textAnchor="middle" fill={b.color} fontSize={12} fontFamily="sans-serif" opacity={opacity}>
                    Sun
                  </text>
                </g>
              )
            }
            // Alternate leader lines up/down by body index to reduce overlap
            const down = idx % 2 === 0
            const lineLen = 22
            const ly = down ? cy + r + lineLen : cy - r - lineLen
            const magStr = b.magnitude != null ? `${b.magnitude >= 0 ? '+' : ''}${b.magnitude.toFixed(1)}` : ''
            const elongStr = `${Math.abs(b.elongation).toFixed(0)}°${b.elongation >= 0 ? 'E' : 'W'}`
            const nameY = down ? ly + 12 : ly - 15
            const detailY = nameY + 12
            return (
              <g key={b.id}>
                <circle cx={cx} cy={cy} r={r} fill={b.color} opacity={opacity} />
                <line x1={cx} y1={down ? cy + r : cy - r} x2={cx} y2={ly}
                  stroke={b.color} strokeWidth={0.7} opacity={opacity * 0.5} />
                <text x={cx} y={nameY} textAnchor="middle"
                  fill={b.color} fontSize={11} fontFamily="sans-serif" fontWeight={600} opacity={opacity}>
                  {b.id}
                </text>
                <text x={cx} y={detailY} textAnchor="middle"
                  fill={b.color} fontSize={10} fontFamily="monospace" opacity={opacity * 0.8}>
                  {magStr} {elongStr}
                </text>
              </g>
            )
          })}
        </g>

        {/* X axis */}
        {lonTicks.map((v) => {
          const x = xOf(v)
          const absV = ((refLon + v) % 360 + 360) % 360
          return (
            <g key={`xt${v}`}>
              <line x1={x} y1={MARGIN.top + plotH} x2={x} y2={MARGIN.top + plotH + 4} stroke="#555" />
              <text x={x} y={MARGIN.top + plotH + 16} textAnchor="middle" fill="#888" fontSize={9} fontFamily="monospace">
                {absV.toFixed(0)}°
              </text>
            </g>
          )
        })}

        {/* Y axis */}
        {latTicks.map((v) => {
          const y = yOf(v)
          return (
            <g key={`yt${v}`}>
              <line x1={MARGIN.left - 4} y1={y} x2={MARGIN.left} y2={y} stroke="#555" />
              <text x={MARGIN.left - 7} y={y + 3} textAnchor="end" fill="#888" fontSize={9} fontFamily="monospace">
                {v >= 0 ? '+' : ''}{v.toFixed(0)}°
              </text>
            </g>
          )
        })}

        {/* Plot border */}
        <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

        {/* Span annotation rows below X axis */}
        {spanInfos.map((info, row) => {
          const cy = spanBaseY + row * SPAN_ROW_H
          const tickH = 4
          // Find the widest rect to place the label
          const widestIdx = info.rects.reduce((best, r, i, arr) =>
            (r.right - r.left) > (arr[best].right - arr[best].left) ? i : best, 0)

          return (
            <g key={`span-${info.label}`}>
              {/* Label at left edge */}
              <text x={MARGIN.left - 7} y={cy + 1} textAnchor="end" fill={info.color}
                fontSize={9} fontFamily="sans-serif" fontWeight={600} dominantBaseline="middle">
                {info.label}
              </text>
              {/* Bracket segments */}
              {info.rects.map((r, i) => {
                const x1 = xOf(r.left)
                const x2 = xOf(r.right)
                return (
                  <g key={i}>
                    {/* Horizontal bar */}
                    <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={info.color} strokeWidth={1} opacity={0.6} />
                    {/* End ticks */}
                    <line x1={x1} y1={cy - tickH / 2} x2={x1} y2={cy + tickH / 2} stroke={info.color} strokeWidth={1} opacity={0.6} />
                    <line x1={x2} y1={cy - tickH / 2} x2={x2} y2={cy + tickH / 2} stroke={info.color} strokeWidth={1} opacity={0.6} />
                    {/* Degree label above the line, on the widest segment */}
                    {i === widestIdx && (
                      <text x={(x1 + x2) / 2} y={cy - 5} textAnchor="middle"
                        fill={info.color} fontSize={9} fontFamily="monospace" fontWeight={600}>
                        {info.span.toFixed(1)}°
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

      </svg>
    </div>
  )

  return (
    <div className={`sky-view${isLandscape ? ' sky-view-landscape' : ''}`} ref={containerRef}>
      <div className="sky-view-header">
        <span className="control-label">Ecliptic Strip — {formatDate(date)}</span>
        <div className="sky-view-controls">
          <div className="sky-zoom-controls">
            <button className="sky-zoom-btn" onClick={zoomOut} disabled={zoomLevel <= 1}>{'\u2212'}</button>
            <button className="sky-zoom-btn" onClick={zoomReset} disabled={zoomLevel <= 1}>
              {zoomLevel <= 1 ? '1\u00d7' : `${zoomLevel % 1 === 0 ? zoomLevel : zoomLevel.toFixed(1)}\u00d7`}
            </button>
            <button className="sky-zoom-btn" onClick={zoomIn} disabled={zoomLevel >= 16}>+</button>
          </div>
          <select
            className="sky-center-select"
            value={center}
            onChange={(e) => onCenterChange(e.target.value as SkyViewCenter)}
          >
            <option value="lon0">Lon 0° center</option>
            <option value="sun">Sun center</option>
          </select>
        </div>
      </div>

      {chartSection}
    </div>
  )
}

function niceStep(range: number, targetTicks: number): number {
  if (range <= 0) return 1
  const rough = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / mag
  let nice: number
  if (residual <= 1.5) nice = 1
  else if (residual <= 3.5) nice = 2
  else if (residual <= 7.5) nice = 5
  else nice = 10
  return nice * mag
}
