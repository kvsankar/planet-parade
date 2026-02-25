import { useMemo, useRef, useState, useEffect, useCallback, useId } from 'react'
import { CelestialBodyId, AlignmentKind } from '../../types'
import { BODY_META, formatDate, SERIES_COLORS } from '../../constants'
import { getGeocentricEclipticCoords, computeSpanArc, computeMaxSpan, wrap180 } from '../../lib/alignment'

export type SkyViewCenter = 'lon0' | 'sun'

interface SkyViewProps {
  bodies: CelestialBodyId[]
  date: Date
  center: SkyViewCenter
  onCenterChange: (c: SkyViewCenter) => void
  visibleSeries: Set<AlignmentKind>
}

interface BodyPlotData {
  id: CelestialBodyId
  absLon: number
  lat: number
  plotLon: number
  color: string
  elongation: number // positive = east/evening, negative = west/morning
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

const LON_TICKS: number[] = []
for (let v = -180; v <= 180; v += 30) LON_TICKS.push(v)

const MS_PER_HOUR = 3_600_000
const HEADER_H = 28
const SEP_H = 26

export default function SkyView({ bodies, date, center, onCenterChange, visibleSeries }: SkyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clipId = useId()
  const [cW, setCW] = useState(400)
  const [cH, setCH] = useState(300)
  const [showTable, setShowTable] = useState(false)
  const [splitRatio, setSplitRatio] = useState(0.65)

  // Quantize date to nearest hour for ephemeris cache efficiency during animation
  const quantizedDate = useMemo(() => {
    const ms = date.getTime()
    return new Date(Math.round(ms / MS_PER_HOUR) * MS_PER_HOUR)
  }, [Math.round(date.getTime() / MS_PER_HOUR)])

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

  const sunLon = useMemo(() => {
    return getGeocentricEclipticCoords('Sun', quantizedDate).lon
  }, [quantizedDate])

  const refLon = center === 'sun' ? sunLon : 0

  // Compute body positions + elongation
  const plotData = useMemo((): BodyPlotData[] => {
    if (bodies.length === 0) return []

    const items = bodies.map((id) => {
      const ecl = getGeocentricEclipticCoords(id, quantizedDate)
      return { id, absLon: ecl.lon, lat: ecl.lat, color: BODY_META[id].color, elongation: wrap180(ecl.lon - sunLon) }
    })

    const sunEcl = getGeocentricEclipticCoords('Sun', quantizedDate)
    items.push({ id: 'Sun' as CelestialBodyId, absLon: sunEcl.lon, lat: sunEcl.lat, color: BODY_META.Sun.color, elongation: 0 })

    return items.map((c) => ({
      ...c,
      plotLon: wrap180(c.absLon - refLon),
    }))
  }, [bodies, quantizedDate, refLon, sunLon])

  // Split planets into morning/evening once, compute spans and shading rects together
  const { spanInfos, allRects, morningRects, eveningRects } = useMemo(() => {
    const planets = plotData.filter((b) => b.id !== 'Sun')
    const mPlanets = planets.filter((b) => b.elongation < 0)
    const ePlanets = planets.filter((b) => b.elongation >= 0)

    // Shading rects (include single-planet thin bands)
    const buildShadeRects = (group: BodyPlotData[]): { left: number; right: number }[] => {
      if (group.length < 2) {
        if (group.length === 1) {
          const p = group[0].plotLon
          return [{ left: p - 1, right: p + 1 }]
        }
        return []
      }
      const arc = computeSpanArc(group.map((b) => b.absLon))
      return arc ? arcToRects(arc, refLon) : []
    }

    // Span annotations
    const spans: SpanInfo[] = []
    if (planets.length >= 2) {
      const allLons = planets.map((b) => b.absLon)
      const allArc = computeSpanArc(allLons)
      if (allArc) {
        spans.push({ label: 'All', span: computeMaxSpan(allLons), rects: arcToRects(allArc, refLon), color: SERIES_COLORS.total })
      }
    }
    for (const [group, label, color] of [
      [mPlanets, 'AM', SERIES_COLORS.morning],
      [ePlanets, 'PM', SERIES_COLORS.evening],
    ] as const) {
      if (group.length >= 2) {
        const lons = group.map((b) => b.absLon)
        const arc = computeSpanArc(lons)
        if (arc) {
          spans.push({ label, span: computeMaxSpan(lons), rects: arcToRects(arc, refLon), color })
        }
      }
    }

    return {
      spanInfos: spans,
      allRects: buildShadeRects(planets),
      morningRects: buildShadeRects(mPlanets),
      eveningRects: buildShadeRects(ePlanets),
    }
  }, [plotData, refLon])

  // Separator: click toggles table, drag resizes split
  const handleSepMouseDown = useCallback((e: React.MouseEvent) => {
    if (!showTable) {
      setShowTable(true)
      return
    }
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const startY = e.clientY
    let moved = false

    const onMouseMove = (ev: MouseEvent) => {
      if (!moved && Math.abs(ev.clientY - startY) > 3) moved = true
      if (!moved) return
      const y = ev.clientY - rect.top - HEADER_H
      const availH = rect.height - HEADER_H - SEP_H
      if (availH > 0) {
        const ratio = Math.max(0.2, Math.min(0.8, y / availH))
        setSplitRatio(ratio)
      }
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (!moved) setShowTable((v) => !v)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [showTable])

  // Compute explicit section heights from container
  const availH = cH - HEADER_H - SEP_H
  const chartH = showTable ? Math.floor(availH * splitRatio) : availH
  const tableH = showTable ? availH - chartH : 0

  // SVG layout
  const width = cW
  const spanRowCount = spanInfos.length
  const SPAN_ROW_H = 18
  const SPAN_TOP_PAD = 10
  const spanAreaH = spanRowCount > 0 ? SPAN_TOP_PAD + spanRowCount * SPAN_ROW_H + 4 : 0
  const MARGIN = { top: 20, right: 16, bottom: 30 + spanAreaH, left: 50 }
  const plotW = Math.max(10, width - MARGIN.left - MARGIN.right)
  const height = Math.max(chartH, 120)
  const plotH = Math.max(10, height - MARGIN.top - MARGIN.bottom)

  // Latitude range: ±10° for all planets, ±20° if Pluto is selected
  const hasPluto = bodies.includes('Pluto')
  const halfLat = hasPluto ? 20 : 10
  const range = { lonMin: -180, lonMax: 180, latMin: -halfLat, latMax: halfLat }

  const xSpan = 360
  const ySpan = range.latMax - range.latMin
  const xOf = (plotLon: number) => MARGIN.left + ((plotLon - range.lonMin) / xSpan) * plotW
  const yOf = (lat: number) => MARGIN.top + ((range.latMax - lat) / ySpan) * plotH

  const lonTicks = LON_TICKS

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
        <span className="control-label">Sky View</span>
        <div className="chart-empty">Select planets to see their positions in the sky.</div>
      </div>
    )
  }

  // Table data sorted by ascending longitude
  const tableData = useMemo(() =>
    [...plotData].sort((a, b) => a.absLon - b.absLon),
    [plotData],
  )

  const dotR = 5
  const sunR = 7

  // Y position where span annotation rows start (below X axis labels)
  const spanBaseY = MARGIN.top + plotH + 24 + SPAN_TOP_PAD

  return (
    <div className="sky-view" ref={containerRef}>
      <div className="sky-view-header">
        <span className="control-label">Sky View — {formatDate(date)}</span>
        <div className="sky-view-controls">
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

      {/* Chart section — explicit height */}
      <div className="sky-view-chart-area" style={{ height: chartH }}>
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
          </defs>

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

          {/* Shading bands gated by visibleSeries */}
          <g clipPath={`url(#${clipId})`}>
            {visibleSeries.has('total') && allRects.map((r, i) => {
              const rx = xOf(r.left)
              const rw = xOf(r.right) - rx
              return (
                <rect key={`all${i}`} x={rx} y={MARGIN.top} width={rw} height={plotH}
                  fill={hexToRgba(SERIES_COLORS.total, 0.06)} />
              )
            })}
            {visibleSeries.has('morning') && morningRects.map((r, i) => {
              const rx = xOf(r.left)
              const rw = xOf(r.right) - rx
              return (
                <g key={`am${i}`}>
                  <rect x={rx} y={MARGIN.top} width={rw} height={plotH}
                    fill={hexToRgba(SERIES_COLORS.morning, 0.10)} />
                  <text x={rx + rw / 2} y={MARGIN.top + 12} textAnchor="middle"
                    fill={hexToRgba(SERIES_COLORS.morning, 0.5)} fontSize={10} fontFamily="sans-serif" fontWeight={600}>
                    AM
                  </text>
                </g>
              )
            })}
            {visibleSeries.has('evening') && eveningRects.map((r, i) => {
              const rx = xOf(r.left)
              const rw = xOf(r.right) - rx
              return (
                <g key={`pm${i}`}>
                  <rect x={rx} y={MARGIN.top} width={rw} height={plotH}
                    fill={hexToRgba(SERIES_COLORS.evening, 0.10)} />
                  <text x={rx + rw / 2} y={MARGIN.top + 12} textAnchor="middle"
                    fill={hexToRgba(SERIES_COLORS.evening, 0.5)} fontSize={10} fontFamily="sans-serif" fontWeight={600}>
                    PM
                  </text>
                </g>
              )
            })}
          </g>

          {/* Bodies */}
          <g clipPath={`url(#${clipId})`}>
            {plotData.map((b) => {
              const isSun = b.id === 'Sun'
              const cx = xOf(b.plotLon)
              const cy = yOf(b.lat)
              const r = isSun ? sunR : dotR
              return (
                <g key={b.id}>
                  <circle cx={cx} cy={cy} r={r} fill={b.color} opacity={isSun ? 0.7 : 1} />
                  <text x={cx} y={cy - r - 3} textAnchor="middle" fill={b.color} fontSize={10} fontFamily="sans-serif">
                    {b.id}
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

      {/* Draggable separator / table toggle */}
      <div
        className="sky-view-separator"
        onMouseDown={handleSepMouseDown}
      >
        <span className="control-label">Planetary Data</span>
      </div>

      {/* Table section — explicit height, scrollable */}
      {showTable && (
        <div className="sky-view-table-area" style={{ height: tableH }}>
          <table className="skyview-table">
            <thead>
              <tr>
                <th>Body</th>
                <th>Lon</th>
                <th>Lat</th>
                <th>Elong</th>
                <th>Sky</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((b) => {
                const isSun = b.id === 'Sun'
                const skyLabel = isSun ? '\u2014' : (b.elongation >= 0 ? 'PM' : 'AM')
                const skyColor = isSun ? '#666' : (b.elongation >= 0 ? SERIES_COLORS.evening : SERIES_COLORS.morning)
                return (
                  <tr key={b.id}>
                    <td style={{ color: b.color }}>{b.id}</td>
                    <td>{b.absLon.toFixed(1)}°</td>
                    <td>{b.lat >= 0 ? '+' : ''}{b.lat.toFixed(1)}°</td>
                    <td>{isSun ? '\u2014' : `${b.elongation >= 0 ? '+' : ''}${b.elongation.toFixed(1)}°`}</td>
                    <td style={{ color: skyColor }}>{skyLabel}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
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
