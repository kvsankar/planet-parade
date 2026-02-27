import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { ObserverLocation } from '../../types'
import { findSunrise, findSunset, getAllAltAz, AltAzPosition, getStarAltAzPositions, getEclipticAltAzPositions, getMilkyWayPolygons, getMoonIllumination, isMoonWaxing, getBodyVisualMagnitude, SKY_BODIES, SkyBodyId, sunHorizonLongitude } from '../../lib/astronomy'
import StereoSkyChart from '../alignment/StereoSkyChart'

interface SkyChartPanelProps {
  currentDate: Date
  observer: ObserverLocation
  isMobile?: boolean
  isPlaying?: boolean
  isLandscape?: boolean
}

const MS_PER_QUARTER_HOUR = 900_000
const MS_PER_DAY = 86_400_000

export default function SkyChartPanel({ currentDate, observer, isMobile, isPlaying, isLandscape }: SkyChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [mobileChart, setMobileChart] = useState<'pm' | 'am'>('pm')

  const measure = useCallback(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current
      setContainerSize((prev) => {
        if (prev.w === clientWidth && prev.h === clientHeight) return prev
        return { w: clientWidth, h: clientHeight }
      })
    }
  }, [])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [measure])

  // --- Display toggles ---
  const [showStars, setShowStars] = useState(true)
  const [showConstellationEdges, setShowConstellationEdges] = useState(true)
  const [showConstellationLabels, setShowConstellationLabels] = useState(true)
  const [showMilkyWay, setShowMilkyWay] = useState(true)
  const [showPlanets, setShowPlanets] = useState(true)
  const [showMoon, setShowMoon] = useState(true)

  // --- Zoom / pan ---
  const [zoomLevel, setZoomLevel] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(zoomLevel)
  zoomRef.current = zoomLevel
  const panRef = useRef(pan)
  panRef.current = pan
  const pairSizeRef = useRef({ w: 0, h: 0 })
  const containerSizeRef = useRef(containerSize)
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startPan: { x: number; y: number } } | null>(null)

  const zoomIn = () => setZoomLevel((z) => Math.min(z * 2, 16))
  const zoomOut = () => setZoomLevel((z) => Math.max(z / 2, 1))
  const zoomReset = () => { setZoomLevel(1); setPan({ x: 0, y: 0 }) }

  // --- Smoothly-animated positions (hourly quantization) ---
  // Instead of computing positions at daily sunrise/sunset (which jumps once
  // per day), we slide the observer's longitude so the Sun stays on the
  // horizon while the rest of the sky rotates continuously.
  const quantizedHour = Math.round(currentDate.getTime() / MS_PER_QUARTER_HOUR)
  const quantizedDate = useMemo(() => {
    return new Date(quantizedHour * MS_PER_QUARTER_HOUR)
  }, [quantizedHour])

  // Virtual observers: same latitude, longitude where Sun is on the horizon
  const morningObserver = useMemo((): ObserverLocation => {
    const lon = sunHorizonLongitude(quantizedDate, observer.lat, true)
    return { lat: observer.lat, lon, height: observer.height }
  }, [quantizedDate, observer.lat, observer.height])

  const eveningObserver = useMemo((): ObserverLocation => {
    const lon = sunHorizonLongitude(quantizedDate, observer.lat, false)
    return { lat: observer.lat, lon, height: observer.height }
  }, [quantizedDate, observer.lat, observer.height])

  // Positions computed at quantizedDate from the virtual observers
  const morningPositions: AltAzPosition[] = useMemo(() => {
    return getAllAltAz(quantizedDate, morningObserver)
  }, [quantizedDate, morningObserver])

  const eveningPositions: AltAzPosition[] = useMemo(() => {
    return getAllAltAz(quantizedDate, eveningObserver)
  }, [quantizedDate, eveningObserver])

  const morningStars = useMemo(() =>
    getStarAltAzPositions(quantizedDate, morningObserver), [quantizedDate, morningObserver])
  const eveningStars = useMemo(() =>
    getStarAltAzPositions(quantizedDate, eveningObserver), [quantizedDate, eveningObserver])

  const morningEcliptic = useMemo(() =>
    getEclipticAltAzPositions(quantizedDate, morningObserver), [quantizedDate, morningObserver])
  const eveningEcliptic = useMemo(() =>
    getEclipticAltAzPositions(quantizedDate, eveningObserver), [quantizedDate, eveningObserver])

  const morningMilkyWay = useMemo(() =>
    getMilkyWayPolygons(quantizedDate, morningObserver), [quantizedDate, morningObserver])
  const eveningMilkyWay = useMemo(() =>
    getMilkyWayPolygons(quantizedDate, eveningObserver), [quantizedDate, eveningObserver])

  // --- Daily quantities (labels, moon phase, magnitudes) ---
  const dayStart = useMemo(() => {
    const d = currentDate
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }, [Math.floor(currentDate.getTime() / MS_PER_DAY)])

  const sunriseTime = useMemo(() => findSunrise(dayStart, observer), [dayStart, observer])
  const sunsetTime = useMemo(() => findSunset(dayStart, observer), [dayStart, observer])

  const morningMoonIllum = useMemo(() =>
    sunriseTime ? getMoonIllumination(sunriseTime) : 0, [sunriseTime])
  const eveningMoonIllum = useMemo(() =>
    sunsetTime ? getMoonIllumination(sunsetTime) : 0, [sunsetTime])
  const morningMoonWaxing = useMemo(() =>
    sunriseTime ? isMoonWaxing(sunriseTime) : true, [sunriseTime])
  const eveningMoonWaxing = useMemo(() =>
    sunsetTime ? isMoonWaxing(sunsetTime) : true, [sunsetTime])

  const morningMagnitudes = useMemo(() => {
    if (!sunriseTime) return {} as Record<SkyBodyId, number | null>
    const m = {} as Record<SkyBodyId, number | null>
    for (const id of SKY_BODIES) m[id] = getBodyVisualMagnitude(id, sunriseTime)
    return m
  }, [sunriseTime])
  const eveningMagnitudes = useMemo(() => {
    if (!sunsetTime) return {} as Record<SkyBodyId, number | null>
    const m = {} as Record<SkyBodyId, number | null>
    for (const id of SKY_BODIES) m[id] = getBodyVisualMagnitude(id, sunsetTime)
    return m
  }, [sunsetTime])

  // Layout: side-by-side when wide, stacked when tall (desktop shows both)
  // Mobile: single chart, full width, no title overhead
  const horizontal = containerSize.w > containerSize.h
  const SVG_OVERHEAD = 36 // title + time text above the chart circle (desktop only)
  const chartSize = useMemo(() => {
    const { w, h } = containerSize
    if (w === 0 || h === 0) return 0
    if (isMobile) {
      // In landscape, size by width so E-W axis fills the screen (N-S crops)
      return isLandscape ? w - 2 : Math.min(w - 2, h - 2)
    }
    return horizontal
      ? Math.min(Math.floor((w - 16) / 2), h - 8 - SVG_OVERHEAD)
      : Math.min(w - 8, Math.floor((h - 16) / 2) - SVG_OVERHEAD)
  }, [containerSize, horizontal, isMobile, isLandscape])

  // Zoomed chart size: circle grows, but labels/dots/strokes stay at original pixel sizes
  const zoomedSize = Math.round(chartSize * zoomLevel)

  // Pair natural dimensions at current zoom for pan clamping
  const pairW = isMobile ? zoomedSize : horizontal ? zoomedSize * 2 + 4 : zoomedSize
  const pairH = isMobile ? zoomedSize : horizontal ? zoomedSize + 36 : (zoomedSize + 36) * 2 + 4
  pairSizeRef.current = { w: pairW, h: pairH }
  containerSizeRef.current = containerSize

  const maxPanX = Math.max(0, (pairW - containerSize.w) / 2)
  const maxPanY = Math.max(0, (pairH - containerSize.h) / 2)
  const cpx = Math.max(-maxPanX, Math.min(maxPanX, pan.x))
  const cpy = Math.max(-maxPanY, Math.min(maxPanY, pan.y))

  // Gesture handling: wheel zoom, pinch zoom, drag-to-pan
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const applyPan = (rawX: number, rawY: number) => {
      panRef.current = { x: rawX, y: rawY }
      setPan({ x: rawX, y: rawY })
    }

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      setZoomLevel((z) => Math.max(1, Math.min(16, z * factor)))
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPan: { ...panRef.current } }

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const dx = ev.clientX - dragRef.current.startX
        const dy = ev.clientY - dragRef.current.startY
        applyPan(dragRef.current.startPan.x + dx, dragRef.current.startPan.y + dy)
      }

      const onMouseUp = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        dragRef.current = null
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        pinchRef.current = { startDist: dist, startZoom: zoomRef.current }
      } else if (e.touches.length === 1) {
        dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startPan: { ...panRef.current } }
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
        const dy = e.touches[0].clientY - dragRef.current.startY
        applyPan(dragRef.current.startPan.x + dx, dragRef.current.startPan.y + dy)
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

  const toggleProps = {
    showStars, showConstellationEdges, showConstellationLabels,
    showMilkyWay, showPlanets, showMoon, isPlaying,
    hideTitle: !!isMobile,
  }

  const morningChart = (
    <StereoSkyChart
      positions={morningPositions}
      stars={morningStars}
      ecliptic={morningEcliptic}
      milkyWay={morningMilkyWay}
      title="Morning"
      time={sunriseTime}
      size={zoomedSize}
      moonIllumination={morningMoonIllum}
      moonWaxing={morningMoonWaxing}
      magnitudes={morningMagnitudes}
      {...toggleProps}
    />
  )

  const eveningChart = (
    <StereoSkyChart
      positions={eveningPositions}
      stars={eveningStars}
      ecliptic={eveningEcliptic}
      milkyWay={eveningMilkyWay}
      title="Evening"
      time={sunsetTime}
      size={zoomedSize}
      moonIllumination={eveningMoonIllum}
      moonWaxing={eveningMoonWaxing}
      magnitudes={eveningMagnitudes}
      {...toggleProps}
    />
  )

  return (
    <div className="skychart-panel">
      {isMobile && (
        <div className="skychart-ampm-tabs">
          <button
            className={`skychart-ampm-tab${mobileChart === 'pm' ? ' active' : ''}`}
            onClick={() => setMobileChart('pm')}
          >
            PM (Evening)
          </button>
          <button
            className={`skychart-ampm-tab${mobileChart === 'am' ? ' active' : ''}`}
            onClick={() => setMobileChart('am')}
          >
            AM (Morning)
          </button>
        </div>
      )}
      <div className={`skychart-chart-area${zoomLevel > 1 ? ' sky-pannable' : ''}`} ref={containerRef}>
        {chartSize > 50 && (
          <>
            {isMobile ? (
              <div style={zoomLevel > 1 ? { transform: `translate(${cpx}px, ${cpy}px)` } : undefined}>
                {mobileChart === 'pm' ? eveningChart : morningChart}
              </div>
            ) : (
              <div
                className={horizontal ? 'skychart-pair skychart-pair-h' : 'skychart-pair'}
                style={zoomLevel > 1 ? { transform: `translate(${cpx}px, ${cpy}px)` } : undefined}
              >
                {morningChart}
                {eveningChart}
              </div>
            )}
            <div className="skychart-zoom sky-zoom-controls">
              <button className="sky-zoom-btn" onClick={zoomOut} disabled={zoomLevel <= 1}>{'\u2212'}</button>
              <button className="sky-zoom-btn" onClick={zoomReset} disabled={zoomLevel <= 1}>
                {zoomLevel <= 1 ? '1\u00d7' : `${zoomLevel % 1 === 0 ? zoomLevel : zoomLevel.toFixed(1)}\u00d7`}
              </button>
              <button className="sky-zoom-btn" onClick={zoomIn} disabled={zoomLevel >= 16}>+</button>
            </div>
          </>
        )}
      </div>
      <div className="skychart-controls-bar">
        <div className="skychart-toggles">
          {([
            ['Stars', showStars, setShowStars],
            ['Edges', showConstellationEdges, setShowConstellationEdges],
            ['Labels', showConstellationLabels, setShowConstellationLabels],
            ['Milky Way', showMilkyWay, setShowMilkyWay],
            ['Sun & Planets', showPlanets, setShowPlanets],
            ['Moon', showMoon, setShowMoon],
          ] as [string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]).map(([label, val, setter]) => (
            <label key={label} className="skychart-toggle">
              <input type="checkbox" checked={val} onChange={() => setter((v) => !v)} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
