import { useEffect, useRef, useCallback, useState } from 'react'
import { simulationStore } from '../../hooks/useSimulationStore'
import { DATE_MAX, DATE_MIN, SPEED_OPTIONS } from '../../constants'
import { ObserverLocation } from '../../types'
const BASE_BOTTOM_PX = 12
const SAFE_GAP_PX = 8

function formatLatLon(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${latDir} ${Math.abs(lon).toFixed(1)}°${lonDir}`
}

function formatDateTime(date: Date, timeZone?: string | null): string {
  if (!timeZone) {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    const h = String(date.getUTCHours()).padStart(2, '0')
    const min = String(date.getUTCMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min} UTC`
  }

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
      timeZoneName: 'short',
    }).formatToParts(date)
    const byType = new Map(parts.map((part) => [part.type, part.value]))
    const y = byType.get('year')
    const m = byType.get('month')
    const d = byType.get('day')
    const h = byType.get('hour')
    const min = byType.get('minute')
    const zone = byType.get('timeZoneName') ?? timeZone
    if (y && m && d && h && min) {
      return `${y}-${m}-${d} ${h}:${min} ${zone}`
    }
  } catch {
    // Fallback to UTC formatting below.
  }

  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min} UTC`
}

interface Props {
  onDateChange: (d: Date) => void
  isPlaying: boolean
  speed: number
  onTogglePlay: () => void
  onSetSpeed: (s: number) => void
  observer: ObserverLocation
  currentDate: Date
  timeZone?: string | null
  onOpenLocationPicker?: () => void
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export default function PlanetariumTimeControls({
  onDateChange,
  isPlaying,
  speed,
  onTogglePlay,
  onSetSpeed,
  observer,
  currentDate,
  timeZone,
  onOpenLocationPicker,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [bottomPx, setBottomPx] = useState(BASE_BOTTOM_PX)
  const bottomPxRef = useRef(BASE_BOTTOM_PX)

  useEffect(() => {
    bottomPxRef.current = bottomPx
  }, [bottomPx])

  const stepMinutes = useCallback((minutes: number) => {
    const newMs = simulationStore.date.getTime() + minutes * 60 * 1000
    simulationStore.date.setTime(newMs)
    onDateChange(new Date(newMs))
  }, [onDateChange])

  const updateBottomOffset = useCallback(() => {
    const controlsEl = rootRef.current
    if (!controlsEl) {
      setBottomPx((prev) => (prev === BASE_BOTTOM_PX ? prev : BASE_BOTTOM_PX))
      return
    }

    const controlsRect = controlsEl.getBoundingClientRect()
    const blockers = Array.from(
      document.querySelectorAll<HTMLElement>('.playback-bar, .mobile-tab-bar'),
    )
    if (blockers.length === 0) {
      setBottomPx((prev) => (prev === BASE_BOTTOM_PX ? prev : BASE_BOTTOM_PX))
      return
    }

    const deltaFromBase = bottomPxRef.current - BASE_BOTTOM_PX
    const baseBottomOnScreen = controlsRect.bottom + deltaFromBase

    let neededLiftMax = 0
    for (const blocker of blockers) {
      const blockerRect = blocker.getBoundingClientRect()
      const overlapX = Math.min(controlsRect.right, blockerRect.right) - Math.max(controlsRect.left, blockerRect.left)
      if (overlapX <= 0) continue
      const neededLift = baseBottomOnScreen - blockerRect.top + SAFE_GAP_PX
      if (neededLift > neededLiftMax) neededLiftMax = neededLift
    }
    let targetBottom = BASE_BOTTOM_PX + Math.max(0, neededLiftMax)

    const parentEl = controlsEl.offsetParent as HTMLElement | null
    if (parentEl) {
      const maxBottom = Math.max(BASE_BOTTOM_PX, parentEl.clientHeight - controlsEl.offsetHeight - 8)
      targetBottom = Math.min(targetBottom, maxBottom)
    }

    setBottomPx((prev) => (Math.abs(prev - targetBottom) > 0.5 ? targetBottom : prev))
  }, [])

  useEffect(() => {
    updateBottomOffset()

    const resizeObs = new ResizeObserver(() => updateBottomOffset())
    if (rootRef.current) resizeObs.observe(rootRef.current)
    document.querySelectorAll<HTMLElement>('.playback-bar, .mobile-tab-bar').forEach((el) => resizeObs.observe(el))

    const handlePointerUp = () => updateBottomOffset()
    window.addEventListener('resize', updateBottomOffset)
    window.addEventListener('pointerup', handlePointerUp, true)

    return () => {
      resizeObs.disconnect()
      window.removeEventListener('resize', updateBottomOffset)
      window.removeEventListener('pointerup', handlePointerUp, true)
    }
  }, [updateBottomOffset])

  return (
    <div ref={rootRef} className="planetarium-time-controls" style={{ bottom: `${bottomPx}px` }}>
      <div className="planetarium-info-row">
        <span className="planetarium-info-text">{formatDateTime(currentDate, timeZone)}</span>
        {onOpenLocationPicker ? (
          <button
            type="button"
            className="planetarium-info-location-btn"
            onClick={onOpenLocationPicker}
            title="Set observer location"
          >
            {formatLatLon(observer.lat, observer.lon)}
          </button>
        ) : (
          <span className="planetarium-info-text">{formatLatLon(observer.lat, observer.lon)}</span>
        )}
      </div>
      <div className="planetarium-jump-row">
        <input
          type="date"
          className="playback-date-input planetarium-date-input"
          value={currentDate.toISOString().slice(0, 10)}
          min={DATE_MIN.toISOString().slice(0, 10)}
          max={DATE_MAX.toISOString().slice(0, 10)}
          onChange={(e) => {
            const d = new Date(e.target.value + 'T00:00:00Z')
            if (!isNaN(d.getTime())) onDateChange(d)
          }}
        />
        <button className="planetarium-time-btn" onClick={() => onDateChange(new Date())} title="Jump to current time">
          Now
        </button>
        <button className="planetarium-time-btn" onClick={() => onDateChange(startOfUtcDay(new Date()))} title="Jump to start of today (UTC)">
          Today
        </button>
      </div>
      <div className="planetarium-time-row">
        <button className="planetarium-time-btn" onClick={() => stepMinutes(-5)} title="-5 min">-5m</button>
        <button className="planetarium-time-btn" onClick={() => stepMinutes(-1)} title="-1 min">-1m</button>
        <button className="planetarium-time-btn planetarium-play-btn" onClick={onTogglePlay}>
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button className="planetarium-time-btn" onClick={() => stepMinutes(1)} title="+1 min">+1m</button>
        <button className="planetarium-time-btn" onClick={() => stepMinutes(5)} title="+5 min">+5m</button>
      </div>
      <div className="planetarium-speed-row">
        <select
          value={speed}
          onChange={(e) => onSetSpeed(Number(e.target.value))}
          className="speed-select planetarium-speed-select"
        >
          {SPEED_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
