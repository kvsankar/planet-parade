import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { planetariumStore } from '../../hooks/usePlanetariumStore'
import { simulationStore } from '../../hooks/useSimulationStore'
import { findSunrise, findSunset, getAltAz, getEclipticAltAzPositions, SKY_BODIES, SkyBodyId } from '../../lib/astronomy'
import { CelestialBodyId, ObserverLocation } from '../../types'

const MIN_FOV_DEG = 20
const MAX_FOV_DEG = 120
const DEFAULT_FOV_DEG = 100
const DEFAULT_YAW = Math.PI // face south
const DEFAULT_PITCH = 10 * (Math.PI / 180) // fallback keeps horizon in view
const DEFAULT_LAYOUT_MIN_FOV_DEG = 96
const DEFAULT_LAYOUT_MAX_FOV_DEG = 118
const DEFAULT_LAYOUT_PAD_DEG = 18
const DEFAULT_LAYOUT_MIN_PITCH_DEG = 8
const DEFAULT_LAYOUT_MAX_PITCH_DEG = 16
const ECLIPTIC_VISIBLE_EPS_DEG = 0
const ECLIPTIC_ARC_FOV_PAD_DEG = 8
const ECLIPTIC_ARC_MIN_FOV_DEG = 100
const ECLIPTIC_ARC_MAX_FOV_DEG = 118
const MS_PER_DAY = 86_400_000
const TIME_SCAN_STEP_MS = 5 * 60 * 1000 // 5 minutes
const DRAG_GAIN_MOUSE = 1.3
const DRAG_GAIN_TOUCH = 1.5
const PITCH_GAIN_RATIO = 0.45
const AXIS_LOCK_THRESHOLD_PX = 4
const AXIS_LOCK_RATIO = 1.2
const FOV_STEP = 4
const TWO_PI = Math.PI * 2
const MAX_PITCH = Math.PI / 2 - 0.01
type DragAxis = 'free' | 'horizontal' | 'vertical'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeAngleRad(angle: number): number {
  // Keep yaw bounded to avoid unbounded growth over long sessions.
  const wrapped = (angle + Math.PI) % TWO_PI
  return wrapped < 0 ? wrapped + Math.PI : wrapped - Math.PI
}

/**
 * Controls the planetarium view direction via drag/scroll.
 * Does NOT rotate the camera — instead writes yaw/pitch to planetariumStore,
 * which is read by PlanetariumViewGroup to rotate all content as a group.
 * This guarantees sky, horizon, and planets all move together.
 */
interface Props {
  observer: ObserverLocation
  currentDate: Date
  targetComboBodies?: CelestialBodyId[] | null
  onAutoDateChange?: (d: Date) => void
  onFovChange?: (fovDeg: number) => void
}

function toSkyBody(id: CelestialBodyId): SkyBodyId | null {
  return (SKY_BODIES as readonly string[]).includes(id) ? (id as SkyBodyId) : null
}

function dayStartUtc(baseDate: Date): Date {
  return new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    0, 0, 0, 0,
  ))
}

interface NightViewChoice {
  date: Date
  visibleCount: number
}

interface NightCandidate {
  dateMs: number
  visibleCount: number
  minAltitude: number
  sumAltitude: number
}

function isBetterNightCandidate(next: NightCandidate, prev: NightCandidate | null): boolean {
  if (!prev) return true
  if (next.visibleCount !== prev.visibleCount) return next.visibleCount > prev.visibleCount
  if (next.minAltitude !== prev.minAltitude) return next.minAltitude > prev.minAltitude
  if (next.sumAltitude !== prev.sumAltitude) return next.sumAltitude > prev.sumAltitude
  return next.dateMs < prev.dateMs
}

function findNightViewTime(
  baseDate: Date,
  observer: ObserverLocation,
  targets: SkyBodyId[],
): NightViewChoice | null {
  const dayStart = dayStartUtc(baseDate).getTime()
  const dayEnd = dayStart + MS_PER_DAY
  let bestPartial: NightCandidate | null = null

  for (let t = dayStart; t < dayEnd; t += TIME_SCAN_STEP_MS) {
    const dt = new Date(t)
    const sunAlt = getAltAz('Sun', dt, observer).altitude
    if (sunAlt >= 0) continue

    let visibleCount = 0
    let minAltitude = Number.POSITIVE_INFINITY
    let sumAltitude = 0

    for (const bodyId of targets) {
      const { altitude } = getAltAz(bodyId, dt, observer)
      if (altitude > 0) visibleCount++
      minAltitude = Math.min(minAltitude, altitude)
      sumAltitude += altitude
    }

    if (visibleCount === targets.length) {
      // Prefer earliest full-night solution (deterministic behavior).
      return { date: dt, visibleCount }
    }

    const candidate: NightCandidate = { dateMs: t, visibleCount, minAltitude, sumAltitude }
    if (isBetterNightCandidate(candidate, bestPartial)) {
      bestPartial = candidate
    }
  }

  return bestPartial ? { date: new Date(bestPartial.dateMs), visibleCount: bestPartial.visibleCount } : null
}

function findFirstSunOnHorizon(baseDate: Date, observer: ObserverLocation): Date | null {
  const start = dayStartUtc(baseDate)
  const dayStart = start.getTime()
  const dayEnd = dayStart + MS_PER_DAY

  const sunrise = findSunrise(start, observer)
  const sunset = findSunset(start, observer)
  const candidates = [sunrise, sunset]
    .filter((d): d is Date => d != null)
    .filter((d) => d.getTime() >= dayStart && d.getTime() < dayEnd)
    .sort((a, b) => a.getTime() - b.getTime())

  return candidates[0] ?? null
}

interface TargetSample {
  altitude: number
  azimuth: number
}

interface EclipticFrame {
  centerAzimuthDeg: number
  centerPitchDeg: number
  fovDeg: number
}

interface EclipticArcFrame {
  centerAzimuthDeg: number
  fovDeg: number
}

function computeWrappedAzimuthSpanDeg(azimuthDeg: number[]): { centerDeg: number; spanDeg: number } | null {
  if (azimuthDeg.length === 0) return null
  if (azimuthDeg.length === 1) return { centerDeg: ((azimuthDeg[0] % 360) + 360) % 360, spanDeg: 0 }

  const sorted = azimuthDeg
    .map((az) => ((az % 360) + 360) % 360)
    .sort((a, b) => a - b)

  let maxGap = -1
  let maxGapIndex = 0
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i]
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1]
    const gap = next - curr
    if (gap > maxGap) {
      maxGap = gap
      maxGapIndex = i
    }
  }

  const span = 360 - maxGap
  const start = sorted[(maxGapIndex + 1) % sorted.length]
  const center = (start + span / 2) % 360
  return { centerDeg: center, spanDeg: span }
}

function computeEclipticFrame(samples: TargetSample[]): EclipticFrame | null {
  if (samples.length === 0) return null
  const pool = samples.filter((s) => s.altitude > 0)
  const use = pool.length > 0 ? pool : samples
  const azData = computeWrappedAzimuthSpanDeg(use.map((s) => s.azimuth))
  if (!azData) return null

  const altitudes = use.map((s) => s.altitude)
  const minAlt = Math.min(...altitudes)
  const maxAlt = Math.max(...altitudes)
  const centerPitch = clamp(
    (minAlt + maxAlt) * 0.5,
    DEFAULT_LAYOUT_MIN_PITCH_DEG,
    DEFAULT_LAYOUT_MAX_PITCH_DEG,
  )
  const fov = clamp(
    azData.spanDeg + DEFAULT_LAYOUT_PAD_DEG,
    DEFAULT_LAYOUT_MIN_FOV_DEG,
    DEFAULT_LAYOUT_MAX_FOV_DEG,
  )

  return {
    centerAzimuthDeg: azData.centerDeg,
    centerPitchDeg: centerPitch,
    fovDeg: fov,
  }
}

function computeVisibleEclipticArcFrame(date: Date, observer: ObserverLocation): EclipticArcFrame | null {
  const visibleArc = getEclipticAltAzPositions(date, observer)
    .filter((p) => p.altitude >= ECLIPTIC_VISIBLE_EPS_DEG)
  if (visibleArc.length < 2) return null
  const azData = computeWrappedAzimuthSpanDeg(visibleArc.map((p) => p.azimuth))
  if (!azData) return null

  return {
    centerAzimuthDeg: azData.centerDeg,
    fovDeg: clamp(
      azData.spanDeg + ECLIPTIC_ARC_FOV_PAD_DEG,
      ECLIPTIC_ARC_MIN_FOV_DEG,
      ECLIPTIC_ARC_MAX_FOV_DEG,
    ),
  }
}

export default function PlanetariumCameraController({ observer, currentDate, targetComboBodies, onAutoDateChange, onFovChange }: Props) {
  const { camera, gl, size } = useThree()
  const mouseDragPointerId = useRef<number | null>(null)
  const mouseDragAxis = useRef<DragAxis>('free')
  const mouseDragAccum = useRef({ x: 0, y: 0 })
  const lastPointer = useRef({ x: 0, y: 0 })
  const fovDegRef = useRef(planetariumStore.fovDeg || (camera as THREE.PerspectiveCamera).fov)
  const touchIds = useRef<Map<number, { x: number; y: number }>>(new Map())
  const activeTouchDragId = useRef<number | null>(null)
  const touchDragAxis = useRef<DragAxis>('free')
  const touchDragAccum = useRef({ x: 0, y: 0 })
  const pinchDistanceRef = useRef<number | null>(null)
  const targetKey = (targetComboBodies ?? []).join(',')

  const setFovDeg = useCallback((nextFov: number) => {
    const clamped = clamp(nextFov, MIN_FOV_DEG, MAX_FOV_DEG)
    if (Math.abs(clamped - fovDegRef.current) < 1e-3) return
    fovDegRef.current = clamped
    planetariumStore.fovDeg = clamped
    onFovChange?.(clamped)
  }, [onFovChange])

  useFrame(() => {
    // Keep camera FOV in sync with interaction state (wheel/pinch zoom).
    const cam = camera as THREE.PerspectiveCamera
    if (Math.abs(cam.fov - fovDegRef.current) > 0.1) {
      cam.fov = fovDegRef.current
      cam.updateProjectionMatrix()
    }
  })

  useEffect(() => {
    planetariumStore.fovDeg = fovDegRef.current
    onFovChange?.(fovDegRef.current)
  }, [onFovChange])

  useEffect(() => {
    // Deterministic default view each time planetarium view mounts, or when
    // selected combo changes: choose a nighttime slot and frame the combo on
    // a wide ecliptic-friendly horizon-to-horizon composition.
    // Intentionally does NOT run for date-only changes from the main controls,
    // so alt/az orientation remains stable while stepping +/-1d or +/-5d.
    const cam = camera as THREE.PerspectiveCamera
    setFovDeg(DEFAULT_FOV_DEG)
    cam.fov = DEFAULT_FOV_DEG
    cam.updateProjectionMatrix()

    const targets: SkyBodyId[] = []
    for (const body of targetComboBodies ?? []) {
      const skyBody = toSkyBody(body)
      if (skyBody) targets.push(skyBody)
    }

    if (targets.length > 0) {
      const nightChoice = findNightViewTime(currentDate, observer, targets)
      const sunHorizonTime = findFirstSunOnHorizon(currentDate, observer)
      const fallbackSunHorizonTime = nightChoice && nightChoice.visibleCount > 0 ? null : sunHorizonTime
      const date = nightChoice?.date ?? fallbackSunHorizonTime ?? currentDate

      // Keep global simulation time in sync so UI and scene use the same instant.
      if (nightChoice || sunHorizonTime) {
        if (onAutoDateChange) {
          if (Math.abs(date.getTime() - currentDate.getTime()) > 500) {
            onAutoDateChange(date)
          }
        } else {
          simulationStore.date = date
        }
      }

      const targetSamples: TargetSample[] = targets.map((bodyId) => {
        const { altitude, azimuth } = getAltAz(bodyId, date, observer)
        return { altitude, azimuth }
      })

      const frame = computeEclipticFrame(targetSamples)
      const eclipticArcFrame = computeVisibleEclipticArcFrame(date, observer)
      if (!frame && !eclipticArcFrame) {
        planetariumStore.yaw = DEFAULT_YAW
        planetariumStore.pitch = DEFAULT_PITCH
        return
      }

      const frameAzimuthDeg = eclipticArcFrame?.centerAzimuthDeg ?? frame?.centerAzimuthDeg ?? 180
      const framePitchDeg = frame?.centerPitchDeg ?? (DEFAULT_PITCH * 180 / Math.PI)
      const frameFovDeg = clamp(
        Math.max(frame?.fovDeg ?? DEFAULT_FOV_DEG, eclipticArcFrame?.fovDeg ?? DEFAULT_FOV_DEG),
        DEFAULT_LAYOUT_MIN_FOV_DEG,
        DEFAULT_LAYOUT_MAX_FOV_DEG,
      )

      const az = frameAzimuthDeg * (Math.PI / 180)
      const alt = framePitchDeg * (Math.PI / 180)
      setFovDeg(frameFovDeg)
      cam.fov = frameFovDeg
      cam.updateProjectionMatrix()
      planetariumStore.yaw = normalizeAngleRad(-az)
      planetariumStore.pitch = clamp(alt, -MAX_PITCH, MAX_PITCH)
      return
    }

    // Fallback only when combo centroid is unavailable.
    const fallbackEclipticFrame = computeVisibleEclipticArcFrame(currentDate, observer)
    if (fallbackEclipticFrame) {
      const az = fallbackEclipticFrame.centerAzimuthDeg * (Math.PI / 180)
      const fov = clamp(
        Math.max(DEFAULT_FOV_DEG, fallbackEclipticFrame.fovDeg),
        DEFAULT_LAYOUT_MIN_FOV_DEG,
        DEFAULT_LAYOUT_MAX_FOV_DEG,
      )
      setFovDeg(fov)
      cam.fov = fov
      cam.updateProjectionMatrix()
      planetariumStore.yaw = normalizeAngleRad(-az)
      planetariumStore.pitch = DEFAULT_PITCH
    } else {
      planetariumStore.yaw = DEFAULT_YAW
      planetariumStore.pitch = DEFAULT_PITCH
    }
  }, [camera, observer, targetKey, setFovDeg])

  const trySetPointerCapture = useCallback((pointerId: number) => {
    try {
      gl.domElement.setPointerCapture(pointerId)
    } catch {
      // Ignore capture errors from unsupported/ended pointers.
    }
  }, [gl])

  const tryReleasePointerCapture = useCallback((pointerId: number) => {
    try {
      if (gl.domElement.hasPointerCapture(pointerId)) {
        gl.domElement.releasePointerCapture(pointerId)
      }
    } catch {
      // Ignore release errors from unsupported/ended pointers.
    }
  }, [gl])

  const getTouchDistance = useCallback((): number | null => {
    const points = Array.from(touchIds.current.values())
    if (points.length < 2) return null
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
  }, [])

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      touchIds.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (touchIds.current.size === 1) {
        activeTouchDragId.current = e.pointerId
        touchDragAxis.current = 'free'
        touchDragAccum.current = { x: 0, y: 0 }
        lastPointer.current = { x: e.clientX, y: e.clientY }
        pinchDistanceRef.current = null
      } else if (touchIds.current.size === 2) {
        activeTouchDragId.current = null
        touchDragAxis.current = 'free'
        touchDragAccum.current = { x: 0, y: 0 }
        pinchDistanceRef.current = getTouchDistance()
      }

      trySetPointerCapture(e.pointerId)
      return
    }

    if (e.button !== 0) return

    mouseDragPointerId.current = e.pointerId
    mouseDragAxis.current = 'free'
    mouseDragAccum.current = { x: 0, y: 0 }
    lastPointer.current = { x: e.clientX, y: e.clientY }
    trySetPointerCapture(e.pointerId)
  }, [getTouchDistance, trySetPointerCapture])

  const updateView = useCallback((dx: number, dy: number, gain: number, axisRef: { current: DragAxis }, accumRef: { current: { x: number; y: number } }) => {
    accumRef.current.x += dx
    accumRef.current.y += dy

    if (axisRef.current === 'free') {
      const absX = Math.abs(accumRef.current.x)
      const absY = Math.abs(accumRef.current.y)
      const dist = Math.hypot(absX, absY)
      if (dist >= AXIS_LOCK_THRESHOLD_PX) {
        if (absX >= absY * AXIS_LOCK_RATIO) {
          axisRef.current = 'horizontal'
        } else if (absY >= absX * AXIS_LOCK_RATIO) {
          axisRef.current = 'vertical'
        }
      }
    }

    let effectiveDx = dx
    let effectiveDy = dy
    if (axisRef.current === 'horizontal') {
      effectiveDy = 0
    } else if (axisRef.current === 'vertical') {
      effectiveDx = 0
    }

    // Stellarium-style stereographic sensitivity: view scale = 2*tan(fov/2)
    const fovRad = fovDegRef.current * (Math.PI / 180)
    const viewScale = 2 * Math.tan(0.5 * fovRad)
    const yawDelta = (effectiveDx / Math.max(size.width, 1)) * viewScale * gain
    const pitchDelta = (effectiveDy / Math.max(size.height, 1)) * viewScale * gain * PITCH_GAIN_RATIO
    // Grab mode: drag direction = sky motion direction
    planetariumStore.yaw = normalizeAngleRad(planetariumStore.yaw + yawDelta)
    planetariumStore.pitch = clamp(planetariumStore.pitch + pitchDelta, -MAX_PITCH, MAX_PITCH)
  }, [size.height, size.width])

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      if (!touchIds.current.has(e.pointerId)) return
      touchIds.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (touchIds.current.size >= 2) {
        const oldDist = pinchDistanceRef.current
        const newDist = getTouchDistance()
        if (oldDist != null && newDist != null && oldDist > 0) {
          const zoomFactor = oldDist / newDist
          setFovDeg(fovDegRef.current * zoomFactor)
        }
        pinchDistanceRef.current = newDist
        return
      }

      if (activeTouchDragId.current == null) {
        activeTouchDragId.current = e.pointerId
        lastPointer.current = { x: e.clientX, y: e.clientY }
      }

      if (activeTouchDragId.current === e.pointerId) {
        const dx = e.clientX - lastPointer.current.x
        const dy = e.clientY - lastPointer.current.y
        updateView(dx, dy, DRAG_GAIN_TOUCH, touchDragAxis, touchDragAccum)
        lastPointer.current = { x: e.clientX, y: e.clientY }
      }
      return
    }

    if (mouseDragPointerId.current !== e.pointerId) return
    if ((e.buttons & 1) === 0) {
      mouseDragPointerId.current = null
      return
    }

    const dx = e.clientX - lastPointer.current.x
    const dy = e.clientY - lastPointer.current.y
    updateView(dx, dy, DRAG_GAIN_MOUSE, mouseDragAxis, mouseDragAccum)
    lastPointer.current = { x: e.clientX, y: e.clientY }
  }, [getTouchDistance, updateView, setFovDeg])

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      touchIds.current.delete(e.pointerId)
      tryReleasePointerCapture(e.pointerId)

      if (touchIds.current.size === 0) {
        activeTouchDragId.current = null
        touchDragAxis.current = 'free'
        touchDragAccum.current = { x: 0, y: 0 }
        pinchDistanceRef.current = null
      } else if (touchIds.current.size === 1) {
        const [id, pt] = Array.from(touchIds.current.entries())[0]
        activeTouchDragId.current = id
        touchDragAxis.current = 'free'
        touchDragAccum.current = { x: 0, y: 0 }
        lastPointer.current = { x: pt.x, y: pt.y }
        pinchDistanceRef.current = null
      } else {
        activeTouchDragId.current = null
        touchDragAxis.current = 'free'
        touchDragAccum.current = { x: 0, y: 0 }
        pinchDistanceRef.current = getTouchDistance()
      }
      return
    }

    if (mouseDragPointerId.current === e.pointerId) {
      mouseDragPointerId.current = null
      mouseDragAxis.current = 'free'
      mouseDragAccum.current = { x: 0, y: 0 }
      tryReleasePointerCapture(e.pointerId)
    }
  }, [getTouchDistance, tryReleasePointerCapture])

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const direction = Math.sign(e.deltaY)
    if (direction === 0) return
    setFovDeg(fovDegRef.current + direction * FOV_STEP)
  }, [setFovDeg])

  useEffect(() => {
    const el = gl.domElement
    const prevTouchAction = el.style.touchAction
    el.style.touchAction = 'none'

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('lostpointercapture', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.style.touchAction = prevTouchAction
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('lostpointercapture', onPointerUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl, onPointerDown, onPointerMove, onPointerUp, onWheel])

  return null
}
