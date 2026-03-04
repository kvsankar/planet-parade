import { useEffect, useRef, useCallback, useState } from 'react'
import { simulationStore } from '../../hooks/useSimulationStore'
import { MS_PER_DAY } from '../../constants'
import { ObserverLocation } from '../../types'

const SPEED_OPTIONS = [
  { label: '1 min/s', value: 1 / 1440 },
  { label: '5 min/s', value: 5 / 1440 },
  { label: '15 min/s', value: 15 / 1440 },
  { label: '1 hr/s', value: 1 / 24 },
]
const BASE_BOTTOM_PX = 12
const SAFE_GAP_PX = 8

function formatLatLon(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${latDir} ${Math.abs(lon).toFixed(1)}°${lonDir}`
}

function formatDateTime(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min} UTC`
}

interface Props {
  onDateChange: (d: Date) => void
  observer: ObserverLocation
  currentDate: Date
}

export default function PlanetariumTimeControls({ onDateChange, observer, currentDate }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(SPEED_OPTIONS[0].value)
  const rootRef = useRef<HTMLDivElement>(null)
  const [bottomPx, setBottomPx] = useState(BASE_BOTTOM_PX)
  const bottomPxRef = useRef(BASE_BOTTOM_PX)
  const lastFrameRef = useRef<number | null>(null)
  const uiUpdateRef = useRef(0)

  useEffect(() => {
    bottomPxRef.current = bottomPx
  }, [bottomPx])

  useEffect(() => {
    return () => {
      lastFrameRef.current = null
    }
  }, [])

  const stepMinutes = useCallback((minutes: number) => {
    const newMs = simulationStore.date.getTime() + minutes * 60 * 1000
    const newDate = new Date(newMs)
    simulationStore.date = newDate
    onDateChange(newDate)
  }, [onDateChange])

  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null
      return
    }

    let rafId = 0
    const tick = (now: number) => {
      if (lastFrameRef.current !== null) {
        const elapsedSec = (now - lastFrameRef.current) / 1000
        const capped = Math.min(elapsedSec, 0.1)
        const newMs = simulationStore.date.getTime() + speed * capped * MS_PER_DAY
        const newDate = new Date(newMs)
        simulationStore.date = newDate

        // Keep UI updates lightweight while playing.
        if (now - uiUpdateRef.current > 100) {
          uiUpdateRef.current = now
          onDateChange(newDate)
        }
      }
      lastFrameRef.current = now
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, speed, onDateChange])

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

    const intervalId = window.setInterval(updateBottomOffset, 250)
    window.addEventListener('resize', updateBottomOffset)

    return () => {
      resizeObs.disconnect()
      window.clearInterval(intervalId)
      window.removeEventListener('resize', updateBottomOffset)
    }
  }, [updateBottomOffset])

  // Find current speed in options for highlighting
  const currentSpeedIdx = SPEED_OPTIONS.findIndex((o) => Math.abs(o.value - speed) < 1e-8)

  return (
    <div ref={rootRef} className="planetarium-time-controls" style={{ bottom: `${bottomPx}px` }}>
      <div className="planetarium-info-row">
        <span className="planetarium-info-text">{formatDateTime(currentDate)}</span>
        <span className="planetarium-info-text">{formatLatLon(observer.lat, observer.lon)}</span>
      </div>
      <div className="planetarium-time-row">
        <button className="planetarium-time-btn" onClick={() => stepMinutes(-5)} title="-5 min">-5m</button>
        <button className="planetarium-time-btn" onClick={() => stepMinutes(-1)} title="-1 min">-1m</button>
        <button className="planetarium-time-btn planetarium-play-btn" onClick={() => setIsPlaying((v) => !v)}>
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button className="planetarium-time-btn" onClick={() => stepMinutes(1)} title="+1 min">+1m</button>
        <button className="planetarium-time-btn" onClick={() => stepMinutes(5)} title="+5 min">+5m</button>
      </div>
      <div className="planetarium-speed-row">
        {SPEED_OPTIONS.map((opt, i) => (
          <button
            key={opt.label}
            className={`planetarium-speed-btn${i === currentSpeedIdx ? ' active' : ''}`}
            onClick={() => setSpeed(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
