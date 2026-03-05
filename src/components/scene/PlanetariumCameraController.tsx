import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { planetariumStore } from '../../hooks/usePlanetariumStore'
import { simulationStore } from '../../hooks/useSimulationStore'
import { getAltAz, getEclipticAltAzPositions, SKY_BODIES, SkyBodyId } from '../../lib/astronomy'
import { findBestPlanetariumNightTime, findFirstSunOnHorizon } from '../../lib/planetariumDefaultView'
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

function normalizeAngleDeg(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360
}

function shortestSignedAngleDeg(angleDeg: number): number {
  return ((angleDeg + 540) % 360) - 180
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
  timeZone?: string | null
  autoResetToken?: number
  targetComboBodies?: CelestialBodyId[] | null
  preferNightTargets?: boolean
  onAutoDateChange?: (d: Date) => void
  onFovChange?: (fovDeg: number) => void
}

function toSkyBody(id: CelestialBodyId): SkyBodyId | null {
  return (SKY_BODIES as readonly string[]).includes(id) ? (id as SkyBodyId) : null
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

interface VisibleRun {
  start: number
  length: number
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

function findLongestVisibleRun(samples: { altitude: number }[], minAltitudeDeg: number): VisibleRun {
  const n = samples.length
  if (n === 0) return { start: 0, length: 0 }

  let bestStart = 0
  let bestLength = 0
  let runStart = 0
  let runLength = 0

  for (let i = 0; i < n * 2; i++) {
    const sample = samples[i % n]
    if (sample.altitude >= minAltitudeDeg) {
      if (runLength === 0) runStart = i
      runLength = Math.min(runLength + 1, n)
      if (runLength > bestLength) {
        bestLength = runLength
        bestStart = runStart
      }
    } else {
      runLength = 0
    }
  }

  if (bestLength < 2) return { start: 0, length: 0 }
  return {
    start: ((bestStart % n) + n) % n,
    length: bestLength,
  }
}

function computeVisibleEclipticArcFrame(date: Date, observer: ObserverLocation): EclipticArcFrame | null {
  const samples = getEclipticAltAzPositions(date, observer)
  const visibleRun = findLongestVisibleRun(samples, ECLIPTIC_VISIBLE_EPS_DEG)
  if (visibleRun.length < 2) return null

  const midIndex = (visibleRun.start + Math.floor(visibleRun.length / 2)) % samples.length
  const centerAzimuthDeg = normalizeAngleDeg(samples[midIndex].azimuth)

  let maxHalfSpanDeg = 0
  for (let i = 0; i < visibleRun.length; i++) {
    const sample = samples[(visibleRun.start + i) % samples.length]
    const offsetDeg = Math.abs(shortestSignedAngleDeg(
      normalizeAngleDeg(sample.azimuth) - centerAzimuthDeg,
    ))
    if (offsetDeg > maxHalfSpanDeg) maxHalfSpanDeg = offsetDeg
  }
  const spanDeg = Math.min(360, maxHalfSpanDeg * 2)

  return {
    centerAzimuthDeg,
    fovDeg: clamp(
      spanDeg + ECLIPTIC_ARC_FOV_PAD_DEG,
      ECLIPTIC_ARC_MIN_FOV_DEG,
      ECLIPTIC_ARC_MAX_FOV_DEG,
    ),
  }
}

export default function PlanetariumCameraController({
  observer,
  currentDate,
  timeZone,
  autoResetToken,
  targetComboBodies,
  preferNightTargets = true,
  onAutoDateChange,
  onFovChange,
}: Props) {
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
    // Deterministic default view each time planetarium view mounts, and when
    // an explicit alignment navigation event requests it. This avoids resets
    // during passive playback/date drift while still recentering for Prev/Next
    // and table date selection in the Alignments panel.
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
      const targetChoice = findBestPlanetariumNightTime(currentDate, observer, targets, timeZone, preferNightTargets)
      const sunHorizonTime = preferNightTargets ? findFirstSunOnHorizon(currentDate, observer, timeZone) : null
      const fallbackSunHorizonTime = preferNightTargets && targetChoice && targetChoice.visibleCount > 0
        ? null
        : sunHorizonTime
      const date = targetChoice?.date ?? fallbackSunHorizonTime ?? currentDate

      // Keep global simulation time in sync so UI and scene use the same instant.
      if (targetChoice || sunHorizonTime) {
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
  }, [camera, observer, autoResetToken, timeZone, onAutoDateChange, setFovDeg, preferNightTargets])

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
