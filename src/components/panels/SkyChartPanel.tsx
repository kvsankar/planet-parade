import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { ObserverLocation } from '../../types'
import { findSunrise, findSunset, getAllAltAz, AltAzPosition, getStarAltAzPositions, getEclipticAltAzPositions, getMilkyWayPolygons, getMoonIllumination, isMoonWaxing, getBodyVisualMagnitude, SKY_BODIES, SkyBodyId, sunHorizonLongitude } from '../../lib/astronomy'
import StereoSkyChart from '../alignment/StereoSkyChart'

interface SkyChartPanelProps {
  currentDate: Date
  observer: ObserverLocation
}

const MS_PER_QUARTER_HOUR = 900_000
const MS_PER_DAY = 86_400_000

export default function SkyChartPanel({ currentDate, observer }: SkyChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

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

  // Layout: side-by-side when wide, stacked when tall
  const horizontal = containerSize.w > containerSize.h
  const SVG_OVERHEAD = 36 // title + time text above the chart circle
  const chartSize = useMemo(() => {
    const { w, h } = containerSize
    if (w === 0 || h === 0) return 0
    return horizontal
      ? Math.min(Math.floor((w - 16) / 2), h - 8 - SVG_OVERHEAD)
      : Math.min(w - 8, Math.floor((h - 16) / 2) - SVG_OVERHEAD)
  }, [containerSize, horizontal])

  return (
    <div className="skychart-panel" ref={containerRef}>
      {chartSize > 50 && (
        <div className={horizontal ? 'skychart-pair skychart-pair-h' : 'skychart-pair'}>
          <StereoSkyChart
            positions={morningPositions}
            stars={morningStars}
            ecliptic={morningEcliptic}
            milkyWay={morningMilkyWay}
            title="Morning"
            time={sunriseTime}
            size={chartSize}
            moonIllumination={morningMoonIllum}
            moonWaxing={morningMoonWaxing}
            magnitudes={morningMagnitudes}
          />
          <StereoSkyChart
            positions={eveningPositions}
            stars={eveningStars}
            ecliptic={eveningEcliptic}
            milkyWay={eveningMilkyWay}
            title="Evening"
            time={sunsetTime}
            size={chartSize}
            moonIllumination={eveningMoonIllum}
            moonWaxing={eveningMoonWaxing}
            magnitudes={eveningMagnitudes}
          />
        </div>
      )}
    </div>
  )
}
