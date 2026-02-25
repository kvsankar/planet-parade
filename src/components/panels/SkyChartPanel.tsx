import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { ObserverLocation } from '../../types'
import { findSunrise, findSunset, getAllAltAz, AltAzPosition, getStarAltAzPositions } from '../../lib/astronomy'
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

  // Chart sizing: fit two charts side by side
  const chartSize = useMemo(() => {
    const { w, h } = containerSize
    if (w === 0 || h === 0) return 0
    return Math.min(Math.floor((w - 16) / 2), h - 8)
  }, [containerSize])

  return (
    <div className="skychart-panel" ref={containerRef}>
      {chartSize > 50 && (
        <div className="skychart-pair">
          <StereoSkyChart
            positions={morningPositions}
            stars={morningStars}
            title="Morning"
            time={sunriseTime}
            size={chartSize}
          />
          <StereoSkyChart
            positions={eveningPositions}
            stars={eveningStars}
            title="Evening"
            time={sunsetTime}
            size={chartSize}
          />
        </div>
      )}
    </div>
  )
}
