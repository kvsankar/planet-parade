import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { ObserverLocation } from '../../types'
import { findSunrise, findSunset, getAllAltAz, AltAzPosition, getStarAltAzPositions, getEclipticAltAzPositions, getMilkyWayPolygons, getMoonIllumination, isMoonWaxing, getBodyVisualMagnitude, SKY_BODIES, SkyBodyId, sunHorizonLongitude, getHORtoEQJMatrix } from '../../lib/astronomy'
import StereoSkyChart from '../alignment/StereoSkyChart'

interface SkyChartPanelProps {
  currentDate: Date
  observer: ObserverLocation
  isMobile?: boolean
  isPlaying?: boolean
  isLandscape?: boolean
}

const MS_PER_MW_STEP = 120_000 // 2 minutes — only for expensive MW computations
const MS_PER_DAY = 86_400_000
const MAX_ZOOM = 16
const BASE_MIN_ZOOM = 0.35

export default function SkyChartPanel({ currentDate, observer, isMobile, isPlaying, isLandscape }: SkyChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [mobileChart, setMobileChart] = useState<'pm' | 'am'>('pm')
  const [showTabbedDesktop, setShowTabbedDesktop] = useState(false)

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

  // --- Layer menu ---
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)

  // --- Display toggles ---
  const [showStars, setShowStars] = useState(true)
  const [showStarLabels, setShowStarLabels] = useState(true)
  const [showPlanetLabels, setShowPlanetLabels] = useState(true)
  const [showConstellationEdges, setShowConstellationEdges] = useState(true)
  const [showConstellationLabels, setShowConstellationLabels] = useState(true)
  const [showAltAzGrid, setShowAltAzGrid] = useState(true)
  const [showEcliptic, setShowEcliptic] = useState(true)
  const [showMilkyWay, setShowMilkyWay] = useState(true)
  const [showAtmosphere, setShowAtmosphere] = useState(false)
  const [showMoon, setShowMoon] = useState(true)
  const [milkyWayStyle, setMilkyWayStyle] = useState<'polygons' | 'texture'>('texture')

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

  // --- Smooth animation ---
  // Stars, planets, ecliptic, and observers update every frame (cheap).
  // MW polygons and texture use coarser quantization (expensive).
  const currentMs = currentDate.getTime()

  // Virtual observers: same latitude, longitude where Sun is on the horizon
  const morningObserver = useMemo((): ObserverLocation => {
    const lon = sunHorizonLongitude(currentDate, observer.lat, true)
    return { lat: observer.lat, lon, height: observer.height }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMs, observer.lat, observer.height])

  const eveningObserver = useMemo((): ObserverLocation => {
    const lon = sunHorizonLongitude(currentDate, observer.lat, false)
    return { lat: observer.lat, lon, height: observer.height }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMs, observer.lat, observer.height])

  // Positions computed every frame for smooth animation
  const morningPositions: AltAzPosition[] = useMemo(() => {
    return getAllAltAz(currentDate, morningObserver)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMs, morningObserver])

  const eveningPositions: AltAzPosition[] = useMemo(() => {
    return getAllAltAz(currentDate, eveningObserver)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMs, eveningObserver])

  const morningStars = useMemo(() =>
    getStarAltAzPositions(currentDate, morningObserver),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [currentMs, morningObserver])
  const eveningStars = useMemo(() =>
    getStarAltAzPositions(currentDate, eveningObserver),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [currentMs, eveningObserver])

  const morningEcliptic = useMemo(() =>
    getEclipticAltAzPositions(currentDate, morningObserver),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [currentMs, morningObserver])
  const eveningEcliptic = useMemo(() =>
    getEclipticAltAzPositions(currentDate, eveningObserver),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [currentMs, eveningObserver])

  // Coarser quantization only for expensive MW computations
  const mwStep = Math.round(currentMs / MS_PER_MW_STEP)
  const mwDate = useMemo(() => new Date(mwStep * MS_PER_MW_STEP), [mwStep])

  const morningMilkyWay = useMemo(() =>
    getMilkyWayPolygons(mwDate, morningObserver), [mwDate, morningObserver])
  const eveningMilkyWay = useMemo(() =>
    getMilkyWayPolygons(mwDate, eveningObserver), [mwDate, eveningObserver])

  // HOR→EQJ rotation matrices — updated every frame (cheap: single matrix call).
  // The worker self-throttles via seq; it always works on the latest request.
  const morningRotMatrix = useMemo(() =>
    milkyWayStyle === 'texture' ? getHORtoEQJMatrix(currentDate, morningObserver) : undefined,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [currentMs, morningObserver, milkyWayStyle])
  const eveningRotMatrix = useMemo(() =>
    milkyWayStyle === 'texture' ? getHORtoEQJMatrix(currentDate, eveningObserver) : undefined,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [currentMs, eveningObserver, milkyWayStyle])

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

  // Layout: desktop defaults to paired charts. Mobile is always tabbed,
  // and desktop can opt into tabbed mode via layer controls.
  const tabbedMode = !!isMobile || showTabbedDesktop
  const horizontal = containerSize.w > containerSize.h
  const SVG_OVERHEAD = 36 // title + time text above the chart circle (desktop only)
  const chartSize = useMemo(() => {
    const { w, h } = containerSize
    if (w === 0 || h === 0) return 0
    if (tabbedMode && !isMobile) {
      return Math.min(w - 8, h - 8 - SVG_OVERHEAD)
    }
    if (isMobile) {
      // In landscape, size by width so E-W axis fills the screen (N-S crops)
      return isLandscape ? w - 2 : Math.min(w - 2, h - 2)
    }
    return horizontal
      ? Math.min(Math.floor((w - 16) / 2), h - 8 - SVG_OVERHEAD)
      : Math.min(w - 8, Math.floor((h - 16) / 2) - SVG_OVERHEAD)
  }, [containerSize, horizontal, isMobile, isLandscape, tabbedMode])

  const minZoom = useMemo(() => {
    if (!(isMobile && isLandscape)) return BASE_MIN_ZOOM
    if (containerSize.w <= 0 || containerSize.h <= 0 || chartSize <= 0) return BASE_MIN_ZOOM
    // In landscape mobile, default sizing favors width and can crop vertically.
    // Allow zooming out far enough to fit the full circular sky in the available height.
    const fitFullCircle = containerSize.h / chartSize
    return Math.max(BASE_MIN_ZOOM, Math.min(1, fitFullCircle))
  }, [isMobile, isLandscape, containerSize.w, containerSize.h, chartSize])

  useEffect(() => {
    setZoomLevel((z) => Math.max(minZoom, Math.min(MAX_ZOOM, z)))
  }, [minZoom])

  const zoomIn = () => setZoomLevel((z) => Math.min(z * 2, MAX_ZOOM))
  const zoomOut = () => setZoomLevel((z) => Math.max(z / 2, minZoom))
  const zoomReset = () => { setZoomLevel(1); setPan({ x: 0, y: 0 }) }

  // Zoomed chart size: circle grows, but labels/dots/strokes stay at original pixel sizes
  const zoomedSize = Math.round(chartSize * zoomLevel)

  // Natural dimensions at current zoom for pan clamping.
  const singleChartHeight = isMobile ? zoomedSize : zoomedSize + SVG_OVERHEAD
  const pairW = tabbedMode ? zoomedSize : horizontal ? zoomedSize * 2 + 4 : zoomedSize
  const pairH = tabbedMode ? singleChartHeight : horizontal ? zoomedSize + SVG_OVERHEAD : (zoomedSize + SVG_OVERHEAD) * 2 + 4
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
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      setZoomLevel((z) => Math.max(minZoom, Math.min(MAX_ZOOM, z * factor)))
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
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
        e.preventDefault()
        e.stopPropagation()
        dragRef.current = null
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        pinchRef.current = { startDist: dist, startZoom: zoomRef.current }
      } else if (e.touches.length === 1) {
        if (zoomRef.current > 1) {
          e.preventDefault()
          e.stopPropagation()
        }
        dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startPan: { ...panRef.current } }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        e.stopPropagation()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const scale = dist / pinchRef.current.startDist
        setZoomLevel(Math.max(minZoom, Math.min(MAX_ZOOM, pinchRef.current.startZoom * scale)))
      } else if (e.touches.length === 1 && dragRef.current && !pinchRef.current) {
        if (zoomRef.current <= 1) return
        e.preventDefault()
        e.stopPropagation()
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
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [minZoom])

  const toggleProps = {
    showStars, showStarLabels, showPlanetLabels,
    showConstellationEdges, showConstellationLabels,
    showAltAzGrid, showEcliptic,
    showMilkyWay, showAtmosphere,
    showPlanets: true, showMoon, isPlaying,
    hideTitle: !!isMobile,
    milkyWayStyle,
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
      horToEqjMatrix={morningRotMatrix}
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
      horToEqjMatrix={eveningRotMatrix}
      {...toggleProps}
    />
  )

  return (
    <div className="skychart-panel">
      {tabbedMode && (
        <div className="skychart-ampm-tabs">
          <button
            className={`skychart-ampm-tab${mobileChart === 'pm' ? ' active' : ''}`}
            onClick={() => setMobileChart('pm')}
          >
            Evening
          </button>
          <button
            className={`skychart-ampm-tab${mobileChart === 'am' ? ' active' : ''}`}
            onClick={() => setMobileChart('am')}
          >
            Morning
          </button>
        </div>
      )}
      <div className={`skychart-chart-area${zoomLevel > 1 ? ' sky-pannable' : ''}`} ref={containerRef}>
        {chartSize > 50 && (
          <>
            {tabbedMode ? (
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
              <button className="sky-zoom-btn" onClick={zoomOut} disabled={zoomLevel <= minZoom + 1e-3}>{'\u2212'}</button>
              <button className="sky-zoom-btn" onClick={zoomReset} disabled={Math.abs(zoomLevel - 1) < 1e-3}>
                {`${zoomLevel % 1 === 0 ? zoomLevel.toFixed(0) : zoomLevel.toFixed(1)}\u00d7`}
              </button>
              <button className="sky-zoom-btn" onClick={zoomIn} disabled={zoomLevel >= MAX_ZOOM - 1e-3}>+</button>
            </div>
            <div className="skychart-layer-menu">
              <button className="skychart-layer-btn" onClick={() => setLayerMenuOpen(o => !o)} aria-label="Layers">☰</button>
              {layerMenuOpen && (
                <div className="skychart-layer-dropdown">
                  {!isMobile && (
                    <label className="skychart-toggle">
                      <input
                        type="checkbox"
                        checked={showTabbedDesktop}
                        onChange={() => {
                          setShowTabbedDesktop((v) => !v)
                          setPan({ x: 0, y: 0 })
                        }}
                      />
                      Tabbed View
                    </label>
                  )}
                  {([
                    ['Stars', showStars, setShowStars],
                    ['Milky Way', showMilkyWay, setShowMilkyWay],
                    ['Atmosphere', showAtmosphere, setShowAtmosphere],
                    ['Star Labels', showStarLabels, setShowStarLabels],
                    ['Planet Labels', showPlanetLabels, setShowPlanetLabels],
                    ['Moon', showMoon, setShowMoon],
                    ['Constellation Edges', showConstellationEdges, setShowConstellationEdges],
                    ['Constellation Labels', showConstellationLabels, setShowConstellationLabels],
                    ['Alt/Az Grid', showAltAzGrid, setShowAltAzGrid],
                    ['Ecliptic', showEcliptic, setShowEcliptic],
                  ] as [string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]).map(([label, val, setter]) => (
                    <label key={label} className="skychart-toggle">
                      <input type="checkbox" checked={val} onChange={() => setter(v => !v)} />
                      {label}
                      {label === 'Milky Way' && val && (
                        <span className="skychart-mw-pills" onClick={(e) => e.preventDefault()}>
                          <button
                            className={`skychart-mw-pill${milkyWayStyle === 'polygons' ? ' active' : ''}`}
                            onClick={(e) => { e.preventDefault(); setMilkyWayStyle('polygons') }}
                          >
                            Poly
                          </button>
                          <button
                            className={`skychart-mw-pill${milkyWayStyle === 'texture' ? ' active' : ''}`}
                            onClick={(e) => { e.preventDefault(); setMilkyWayStyle('texture') }}
                          >
                            Tex
                          </button>
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
