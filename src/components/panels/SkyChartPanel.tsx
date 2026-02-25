import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { ObserverLocation } from '../../types'
import { findSunrise, findSunset, getAllAltAz, AltAzPosition, getStarAltAzPositions, getEclipticAltAzPositions, getMoonIllumination, isMoonWaxing, getBodyVisualMagnitude, SKY_BODIES, SkyBodyId } from '../../lib/astronomy'
import StereoSkyChart from '../alignment/StereoSkyChart'

interface SkyChartPanelProps {
  currentDate: Date
  observer: ObserverLocation
}

const MS_PER_HOUR = 3_600_000

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

  // Quantize date to nearest hour to avoid recomputing every frame
  const quantizedMs = useMemo(() => {
    return Math.round(currentDate.getTime() / MS_PER_HOUR) * MS_PER_HOUR
  }, [currentDate])

  // Compute day start (UTC midnight)
  const dayStart = useMemo(() => {
    const d = new Date(quantizedMs)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }, [quantizedMs])

  // Find sunrise and sunset
  const sunriseTime = useMemo(() => findSunrise(dayStart, observer), [dayStart, observer])
  const sunsetTime = useMemo(() => findSunset(dayStart, observer), [dayStart, observer])

  // Get alt-az positions
  const morningPositions: AltAzPosition[] = useMemo(() => {
    return sunriseTime ? getAllAltAz(sunriseTime, observer) : []
  }, [sunriseTime, observer])

  const eveningPositions: AltAzPosition[] = useMemo(() => {
    return sunsetTime ? getAllAltAz(sunsetTime, observer) : []
  }, [sunsetTime, observer])

  const morningStars = useMemo(() =>
    sunriseTime ? getStarAltAzPositions(sunriseTime, observer) : [], [sunriseTime, observer])
  const eveningStars = useMemo(() =>
    sunsetTime ? getStarAltAzPositions(sunsetTime, observer) : [], [sunsetTime, observer])

  const morningEcliptic = useMemo(() =>
    sunriseTime ? getEclipticAltAzPositions(sunriseTime, observer) : [], [sunriseTime, observer])
  const eveningEcliptic = useMemo(() =>
    sunsetTime ? getEclipticAltAzPositions(sunsetTime, observer) : [], [sunsetTime, observer])

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
  const chartSize = useMemo(() => {
    const { w, h } = containerSize
    if (w === 0 || h === 0) return 0
    return horizontal
      ? Math.min(Math.floor((w - 16) / 2), h - 8)
      : Math.min(w - 8, Math.floor((h - 16) / 2))
  }, [containerSize, horizontal])

  return (
    <div className="skychart-panel" ref={containerRef}>
      {chartSize > 50 && (
        <div className={horizontal ? 'skychart-pair skychart-pair-h' : 'skychart-pair'}>
          <StereoSkyChart
            positions={morningPositions}
            stars={morningStars}
            ecliptic={morningEcliptic}
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
