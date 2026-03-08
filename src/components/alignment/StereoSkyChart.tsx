import { useEffect, useMemo, useRef } from 'react'
import { AltAzPosition, SkyBodyId, StarAltAzPosition, AltAzPoint, MilkyWayLayer } from '../../lib/astronomy'
import { BODY_META } from '../../constants'
import { CelestialBodyId } from '../../types'
import { STAR_CATALOG } from '../../data/starCatalog'
import { CONSTELLATIONS } from '../../data/constellationLines'
import { getMoonGlowVisuals } from '../../lib/moonGlow'
import { getNightSkyVisibility, type NightSkyVisibility } from '../../lib/skyVisibility'
import { effectiveStarMagnitude, limitingMagnitudeFromSkyVisibility, starContrastFactor } from '../../lib/starVisibility'
import {
  canvasRadiiFromBaseRadius,
  canvasRadiiFromEffectiveMagnitude,
  computeStarPhotometry,
  magnitudeToCanvasRadius,
  rgbToCss,
  spectralClassToRgb,
} from '../../lib/starAppearance'
import { colorToCss, getAtmosphereAppearance } from '../../lib/atmosphereColor'
import MilkyWayTextureCanvas from './MilkyWayTextureCanvas'

interface StereoSkyChartProps {
  positions: AltAzPosition[]
  stars: StarAltAzPosition[]
  ecliptic: AltAzPoint[]
  milkyWay: MilkyWayLayer[]
  title: string
  time: Date | null
  timeZone?: string | null
  size: number
  moonIllumination: number
  moonWaxing: boolean
  magnitudes: Partial<Record<SkyBodyId, number | null>>
  showStars?: boolean
  showStarLabels?: boolean
  showPlanetLabels?: boolean
  showConstellationEdges?: boolean
  showConstellationLabels?: boolean
  showAltAzGrid?: boolean
  showEcliptic?: boolean
  showMilkyWay?: boolean
  showPlanets?: boolean
  showMoon?: boolean
  showAtmosphere?: boolean
  isPlaying?: boolean
  hideTitle?: boolean
  milkyWayStyle?: 'polygons' | 'texture'
  horToEqjMatrix?: number[][]
  starBrightnessFactor?: number
  constellationEdgeBrightnessFactor?: number
}

const MOON_COLOR = '#C8C8C8'

const BODY_LABELS: Record<SkyBodyId, string> = {
  Sun: 'Sun',
  Moon: 'Moon',
  Mercury: 'Mer',
  Venus: 'Ven',
  Mars: 'Mar',
  Jupiter: 'Jup',
  Saturn: 'Sat',
  Uranus: 'Ura',
  Neptune: 'Nep',
}

function bodyColor(id: SkyBodyId): string {
  if (id === 'Moon') return MOON_COLOR
  return BODY_META[id as CelestialBodyId]?.color ?? '#888'
}

const SUN_RADIUS = 8
const MOON_RADIUS = 7

const DEG_TO_RAD = Math.PI / 180
function projectAltAz(altitude: number, azimuth: number, R: number): { x: number; y: number } {
  const r = ((90 - altitude) / 90) * R
  const azRad = azimuth * DEG_TO_RAD
  return { x: -r * Math.sin(azRad), y: -r * Math.cos(azRad) }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function rgbToRgba([r, g, b]: [number, number, number], alpha: number): string {
  const rr = Math.round(clamp(r, 0, 1) * 255)
  const gg = Math.round(clamp(g, 0, 1) * 255)
  const bb = Math.round(clamp(b, 0, 1) * 255)
  return `rgba(${rr}, ${gg}, ${bb}, ${clamp(alpha, 0, 1)})`
}

interface StarSpriteStamp {
  canvas: HTMLCanvasElement
  halfSizeCss: number
  drawSizeCss: number
}

function starSpriteKey(
  color: [number, number, number],
  baseRadius: number,
  dpr: number,
): string {
  const rr = Math.round(clamp(color[0], 0, 1) * 255)
  const gg = Math.round(clamp(color[1], 0, 1) * 255)
  const bb = Math.round(clamp(color[2], 0, 1) * 255)
  const quantRadius = Math.round(baseRadius * 20) / 20
  const quantDpr = Math.round(dpr * 100) / 100
  return `${rr}:${gg}:${bb}:${quantRadius}:${quantDpr}`
}

function createStarSpriteStamp(
  color: [number, number, number],
  baseRadius: number,
  dpr: number,
): StarSpriteStamp {
  const { coreRadius, haloRadius } = canvasRadiiFromBaseRadius(baseRadius)
  const halfSizeCss = Math.ceil(haloRadius + 1)
  const drawSizeCss = halfSizeCss * 2
  const sizePx = Math.max(2, Math.ceil(drawSizeCss * dpr))
  const canvas = document.createElement('canvas')
  canvas.width = sizePx
  canvas.height = sizePx

  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas, halfSizeCss, drawSizeCss }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cx = halfSizeCss
  const cy = halfSizeCss
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloRadius)
  gradient.addColorStop(0.0, rgbToRgba(color, 0.95))
  gradient.addColorStop(0.40, rgbToRgba(color, 0.34))
  gradient.addColorStop(1.0, rgbToRgba(color, 0))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = rgbToCss(color)
  ctx.beginPath()
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2)
  ctx.fill()

  return { canvas, halfSizeCss, drawSizeCss }
}

function getStarSpriteStamp(
  cache: Map<string, StarSpriteStamp>,
  color: [number, number, number],
  baseRadius: number,
  dpr: number,
): StarSpriteStamp {
  if (cache.size > 512) cache.clear()
  const key = starSpriteKey(color, baseRadius, dpr)
  const cached = cache.get(key)
  if (cached) return cached

  const created = createStarSpriteStamp(color, Math.round(baseRadius * 20) / 20, dpr)
  cache.set(key, created)
  return created
}

function altAzToHorDirection(altitude: number, azimuth: number): [number, number, number] {
  const altRad = altitude * DEG_TO_RAD
  const azRad = azimuth * DEG_TO_RAD
  const cosAlt = Math.cos(altRad)
  // Horizontal frame used in astronomy-engine: x=north, y=west, z=up.
  const xNorth = cosAlt * Math.cos(azRad)
  const yWest = -cosAlt * Math.sin(azRad)
  const zUp = Math.sin(altRad)
  return [xNorth, yWest, zUp]
}

const MW_OPACITIES: Record<string, number> = { ol1: 0.02, ol2: 0.03, ol3: 0.04, ol4: 0.05, ol5: 0.06 }

const CARDINALS: [string, number][] = [
  ['N', 0],
  ['E', 90],
  ['S', 180],
  ['W', 270],
]

/** SVG path for the lit portion of the Moon, centered at (0,0). */
function moonPhasePath(r: number, illum: number, litToRight: boolean): string {
  // k ranges from -1 (new) to +1 (full)
  const k = 2 * illum - 1
  const rx = Math.abs(k) * r
  // Lit side semicircle sweep: right side (sweep 1) or left side (sweep 0)
  const semiSweep = litToRight ? 1 : 0
  // Terminator sweep depends on gibbous vs crescent and lit-side orientation.
  const termSweep = litToRight ? (k >= 0 ? 1 : 0) : (k >= 0 ? 0 : 1)
  return `M 0 ${-r} A ${r} ${r} 0 0 ${semiSweep} 0 ${r} A ${rx} ${r} 0 0 ${termSweep} 0 ${-r} Z`
}

function moonLimbAngleDeg(
  moonPos: { x: number; y: number },
  sunPos: { x: number; y: number },
): number {
  const dx = sunPos.x - moonPos.x
  const dy = sunPos.y - moonPos.y
  if (dx * dx + dy * dy < 1e-8) return 0
  // SVG coordinates are y-down, so atan2 gives the correct screen-space rotation.
  return Math.atan2(dy, dx) * 180 / Math.PI
}

function formatTime(d: Date, timeZone?: string | null): string {
  if (!timeZone) {
    const h = d.getUTCHours().toString().padStart(2, '0')
    const m = d.getUTCMinutes().toString().padStart(2, '0')
    return `${h}:${m} UTC`
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
      timeZoneName: 'short',
    }).formatToParts(d)
    const byType = new Map(parts.map((part) => [part.type, part.value]))
    const h = byType.get('hour')
    const m = byType.get('minute')
    const zone = byType.get('timeZoneName') ?? timeZone
    if (h && m) return `${h}:${m} ${zone}`
  } catch {
    // Fallback to UTC below.
  }

  const h = d.getUTCHours().toString().padStart(2, '0')
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m} UTC`
}

function dist2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Build an SVG sub-path for a projected point sequence, splitting at large gaps */
function buildGapSplitPath(
  pts: { x: number; y: number }[],
  cx: number,
  cy: number,
  gapThreshold: number,
  close: boolean,
): string {
  if (pts.length < 2) return ''
  const parts: string[] = []

  for (let i = 0; i < pts.length; i++) {
    const px = cx + pts[i].x
    const py = cy + pts[i].y
    if (i === 0 || dist2d(pts[i - 1], pts[i]) > gapThreshold) {
      parts.push(`M ${px} ${py}`)
    } else {
      parts.push(`L ${px} ${py}`)
    }
  }

  if (close && pts.length > 2 && dist2d(pts[pts.length - 1], pts[0]) <= gapThreshold) {
    parts.push('Z')
  }

  return parts.join(' ')
}

interface ProjectedStarPoint {
  x: number
  y: number
  starIndex: number
  altitude: number
  direction: [number, number, number]
  name?: string
  mag: number
  spectral: string
  color: [number, number, number]
}

interface ConstellationSegmentRender {
  x1: number
  y1: number
  x2: number
  y2: number
  bothBelow: boolean
}

interface ConstellationRenderData {
  name: string
  segments: ConstellationSegmentRender[]
  centroid: { x: number; y: number } | null
}

interface StarfieldCanvasLayerProps {
  width: number
  height: number
  cx: number
  cy: number
  R: number
  projectedStars: ProjectedStarPoint[]
  constellationData: ConstellationRenderData[]
  showStars: boolean
  showStarLabels: boolean
  showConstellationEdges: boolean
  showConstellationLabels: boolean
  showAtmosphere: boolean
  limitingMagnitude: number
  skyVisibility: NightSkyVisibility
  sunDirectionHor: [number, number, number] | null
  moonDirectionHor: [number, number, number] | null
  starBrightnessFactor: number
  constellationEdgeBrightnessFactor: number
}

function StarfieldCanvasLayer({
  width,
  height,
  cx,
  cy,
  R,
  projectedStars,
  constellationData,
  showStars,
  showStarLabels,
  showConstellationEdges,
  showConstellationLabels,
  showAtmosphere,
  limitingMagnitude,
  skyVisibility,
  sunDirectionHor,
  moonDirectionHor,
  starBrightnessFactor,
  constellationEdgeBrightnessFactor,
}: StarfieldCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spriteCacheRef = useRef<Map<string, StarSpriteStamp>>(new Map())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(1.5, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    const pixelW = Math.max(1, Math.round(width * dpr))
    const pixelH = Math.max(1, Math.round(height * dpr))
    if (canvas.width !== pixelW) canvas.width = pixelW
    if (canvas.height !== pixelH) canvas.height = pixelH

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    if (!showConstellationEdges && !showConstellationLabels && !showStars) return

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.clip()

    if (showConstellationEdges) {
      ctx.lineWidth = 0.6
      const edgeAlpha = clamp(0.25 * constellationEdgeBrightnessFactor, 0, 1)
      const edgeBelowHorizonAlpha = clamp(0.025 * constellationEdgeBrightnessFactor, 0, 1)

      ctx.strokeStyle = `rgba(100, 140, 255, ${edgeAlpha})`
      ctx.beginPath()
      for (const c of constellationData) {
        for (const seg of c.segments) {
          if (seg.bothBelow) continue
          ctx.moveTo(cx + seg.x1, cy + seg.y1)
          ctx.lineTo(cx + seg.x2, cy + seg.y2)
        }
      }
      ctx.stroke()

      ctx.strokeStyle = `rgba(100, 140, 255, ${edgeBelowHorizonAlpha})`
      ctx.beginPath()
      for (const c of constellationData) {
        for (const seg of c.segments) {
          if (!seg.bothBelow) continue
          ctx.moveTo(cx + seg.x1, cy + seg.y1)
          ctx.lineTo(cx + seg.x2, cy + seg.y2)
        }
      }
      ctx.stroke()
    }

    if (showConstellationLabels) {
      ctx.fillStyle = 'rgba(136, 170, 255, 0.35)'
      ctx.font = '8px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      for (const c of constellationData) {
        if (!c.centroid) continue
        ctx.fillText(c.name, cx + c.centroid.x, cy + c.centroid.y - 6)
      }
    }

    if (showStars) {
      const starMode = showAtmosphere ? 'atmospheric' : 'space'

      for (const s of projectedStars) {
        const sx = cx + s.x
        const sy = cy + s.y
        const color = s.color
        const colorCss = rgbToCss(color)
        const photometry = computeStarPhotometry({
          mode: starMode,
          catalogMagnitude: s.mag,
          altitudeDeg: s.altitude,
          skyVisibility: skyVisibility.starVisibility,
          limitingMagnitude,
          direction: s.direction,
          sunDirection: sunDirectionHor,
          moonDirection: moonDirectionHor,
          twilightWash: skyVisibility.twilightWash,
          moonWash: skyVisibility.moonWash,
        })
        const radii = canvasRadiiFromEffectiveMagnitude(photometry.effectiveMagnitude, 1)
        const isAbove = s.altitude >= 0
        const opacity = clamp((isAbove ? 0.85 : 0.3) * photometry.visibilityFactor * starBrightnessFactor, 0, 1)

        if (opacity <= 0.001) continue
        const sprite = getStarSpriteStamp(
          spriteCacheRef.current,
          color,
          radii.baseRadius,
          dpr,
        )

        ctx.globalAlpha = Math.min(1, opacity)
        ctx.drawImage(
          sprite.canvas,
          sx - sprite.halfSizeCss,
          sy - sprite.halfSizeCss,
          sprite.drawSizeCss,
          sprite.drawSizeCss,
        )

        if (showStarLabels && s.name) {
          ctx.globalAlpha = Math.min(1, opacity * 0.7)
          ctx.fillStyle = colorCss
          ctx.font = '7px sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(s.name, sx + radii.baseRadius + 2, sy + 2.5)
        }
      }
    }

    ctx.restore()
    ctx.globalAlpha = 1
  }, [
    width,
    height,
    cx,
    cy,
    R,
    projectedStars,
    constellationData,
    showStars,
    showStarLabels,
    showConstellationEdges,
    showConstellationLabels,
    showAtmosphere,
    limitingMagnitude,
    skyVisibility,
    sunDirectionHor,
    moonDirectionHor,
    starBrightnessFactor,
    constellationEdgeBrightnessFactor,
  ])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  )
}

export default function StereoSkyChart({
  positions, stars, ecliptic, milkyWay, title, time, size,
  timeZone,
  moonIllumination, moonWaxing, magnitudes,
  showStars = true,
  showStarLabels = true,
  showPlanetLabels = true,
  showConstellationEdges = true,
  showConstellationLabels = true,
  showAltAzGrid = true,
  showEcliptic = true,
  showMilkyWay = true,
  showPlanets = true,
  showMoon = true,
  showAtmosphere = true,
  isPlaying = false,
  hideTitle = false,
  milkyWayStyle = 'polygons',
  horToEqjMatrix,
  starBrightnessFactor = 1,
  constellationEdgeBrightnessFactor = 1,
}: StereoSkyChartProps) {
  const MARGIN = hideTitle ? 18 : 28
  const TITLE_OFFSET = hideTitle ? 0 : 18
  const R = (size - MARGIN * 2) / 2
  const cx = size / 2
  const cy = size / 2 + TITLE_OFFSET

  const projected = useMemo(() => {
    return positions.map((p) => ({ ...p, ...projectAltAz(p.altitude, p.azimuth, R) }))
  }, [positions, R])

  // Derive Sun/Moon projected positions from already-memoized `projected`
  const sunProj = projected.find((p) => p.bodyId === 'Sun') ?? null
  const moonProj = projected.find((p) => p.bodyId === 'Moon') ?? null

  const moonGlow = moonProj && showMoon && showAtmosphere
    ? getMoonGlowVisuals({
      moonIllumination,
      moonAltitudeDeg: moonProj.altitude,
      moonMagnitude: magnitudes.Moon ?? null,
    })
    : { opacity: 0, radiusScale: 0, strength: 0 }

  const skyVisibility = getNightSkyVisibility({
    sunAltitudeDeg: sunProj?.altitude ?? -90,
    moonGlowStrength: moonGlow.strength,
    includeSunlight: showAtmosphere,
    includeMoonlight: showAtmosphere && showMoon,
  })

  const atmosphere = getAtmosphereAppearance({
    sunAltitudeDeg: sunProj?.altitude ?? -90,
    moonWash: skyVisibility.moonWash,
    enabled: showAtmosphere,
  })
  const limitingMagnitude = limitingMagnitudeFromSkyVisibility(skyVisibility.starVisibility)

  const sunDirectionHor = useMemo<[number, number, number]>(() => {
    if (!sunProj) return [0, 0, 1]
    return altAzToHorDirection(sunProj.altitude, sunProj.azimuth)
  }, [sunProj?.altitude, sunProj?.azimuth])

  const moonDirectionHor = useMemo<[number, number, number]>(() => {
    if (!moonProj) return [0, 0, 1]
    return altAzToHorDirection(moonProj.altitude, moonProj.azimuth)
  }, [moonProj?.altitude, moonProj?.azimuth])

  const moonLimbRotationDeg = useMemo(() => {
    if (!moonProj || !sunProj) return 0
    return moonLimbAngleDeg(
      { x: moonProj.x, y: moonProj.y },
      { x: sunProj.x, y: sunProj.y },
    )
  }, [moonProj?.x, moonProj?.y, sunProj?.x, sunProj?.y])

  const moonLitToRight = !!(moonProj && sunProj) || moonWaxing

  const projectedStars = useMemo(() => {
    return stars.map((s) => {
      const cat = STAR_CATALOG[s.starIndex]
      return {
        ...projectAltAz(s.altitude, s.azimuth, R),
        starIndex: s.starIndex,
        altitude: s.altitude,
        direction: altAzToHorDirection(s.altitude, s.azimuth),
        name: cat.name,
        mag: cat.mag,
        spectral: cat.spectral,
        color: spectralClassToRgb(cat.spectral),
      }
    })
  }, [stars, R])

  const constellationData = useMemo(() => {
    const starMap = new Map<number, { x: number; y: number; altitude: number }>()
    for (const s of projectedStars) {
      starMap.set(s.starIndex, { x: s.x, y: s.y, altitude: s.altitude })
    }
    return CONSTELLATIONS.map((c) => {
      const segments: { x1: number; y1: number; x2: number; y2: number; bothBelow: boolean }[] = []
      let sumX = 0, sumY = 0, count = 0
      const seen = new Set<number>()
      for (const [a, b] of c.lines) {
        const sa = starMap.get(a)
        const sb = starMap.get(b)
        if (!sa || !sb) continue
        segments.push({
          x1: sa.x, y1: sa.y,
          x2: sb.x, y2: sb.y,
          bothBelow: sa.altitude < 0 && sb.altitude < 0,
        })
        if (!seen.has(a)) { sumX += sa.x; sumY += sa.y; count++; seen.add(a) }
        if (!seen.has(b)) { sumX += sb.x; sumY += sb.y; count++; seen.add(b) }
      }
      return {
        name: c.name,
        segments,
        centroid: count > 0 ? { x: sumX / count, y: sumY / count } : null,
      }
    })
  }, [projectedStars])

  const eclipticPathData = useMemo(() => {
    if (ecliptic.length === 0) return null

    const pts = ecliptic.map((p) => projectAltAz(p.altitude, p.azimuth, R))
    const path = buildGapSplitPath(pts, cx, cy, R * 0.5, true)

    // Label at highest-altitude point
    let bestIdx = 0
    for (let i = 1; i < ecliptic.length; i++) {
      if (ecliptic[i].altitude > ecliptic[bestIdx].altitude) bestIdx = i
    }

    return { path, labelX: cx + pts[bestIdx].x, labelY: cy + pts[bestIdx].y }
  }, [ecliptic, R, cx, cy])

  const milkyWayPaths = useMemo(() => {
    const GAP = R * 0.5
    return milkyWay.map((layer) => {
      const ringPaths: string[] = []
      for (const ring of layer.rings) {
        const pts = ring.map((p) => projectAltAz(p.altitude, p.azimuth, R))
        const rp = buildGapSplitPath(pts, cx, cy, GAP, true)
        if (rp) ringPaths.push(rp)
      }
      return { id: layer.id, path: ringPaths.join(' ') }
    })
  }, [milkyWay, R, cx, cy])

  // --- Label overlap avoidance ---
  const LABEL_CLOSE_PX = 24
  const LABEL_EXT = 8

  const labelOffsets = useMemo(() => {
    const offsets = new Map<SkyBodyId, { lx: number; ly: number }>()
    const DEFAULT_OFFSET = { lx: 0, ly: -6 }

    // During animation, use fixed offsets so labels don't jump around.
    // Conflict resolution runs once when animation stops.
    if (isPlaying) {
      for (const p of projected) {
        offsets.set(p.bodyId, DEFAULT_OFFSET)
      }
      return offsets
    }

    for (const p of projected) {
      let rx = 0, ry = 0
      let nearbyCount = 0

      for (const q of projected) {
        if (q.bodyId === p.bodyId) continue
        const ddx = p.x - q.x
        const ddy = p.y - q.y
        const dist = Math.sqrt(ddx * ddx + ddy * ddy)

        if (dist < LABEL_CLOSE_PX) {
          nearbyCount++
          if (dist < 0.5) {
            ry += p.bodyId < q.bodyId ? -1 : 1
          } else {
            const strength = 1 - dist / LABEL_CLOSE_PX
            rx += (ddx / dist) * strength
            ry += (ddy / dist) * strength
          }
        }
      }

      if (nearbyCount > 0) {
        const len = Math.sqrt(rx * rx + ry * ry)
        if (len > 0.01) {
          offsets.set(p.bodyId, { lx: (rx / len) * LABEL_EXT, ly: (ry / len) * LABEL_EXT })
        } else {
          offsets.set(p.bodyId, DEFAULT_OFFSET)
        }
      } else {
        offsets.set(p.bodyId, DEFAULT_OFFSET)
      }
    }

    return offsets
  }, [projected, isPlaying])

  const projectedCardinals = useMemo(() => {
    const labelRadius = R + 12
    return CARDINALS.map(([label, az]) => {
      const p = projectAltAz(0, az, labelRadius)
      return { label, x: cx + p.x, y: cy + p.y }
    })
  }, [R, cx, cy])

  const projectedAltLabels = useMemo(() => {
    return [30, 60].map((alt) => {
      const labelR = ((90 - alt) / 90) * R
      return { alt, x: cx + 4, y: cy - labelR + 3 }
    })
  }, [R, cx, cy])

  const useTexture = milkyWayStyle === 'texture' && showMilkyWay && !!horToEqjMatrix

  if (size < 50) return null

  const gridColor = 'rgba(255,255,255,0.12)'
  const textColor = '#666'

  const svgHeight = hideTitle ? size : size + 36
  const clipId = `clip-${title}`
  const fgClipId = `clip-fg-${title}`

  return (
    <div style={{ position: 'relative', width: size, height: svgHeight, overflow: 'hidden' }}>
      {useTexture && horToEqjMatrix && (
        <MilkyWayTextureCanvas
          rotMatrix={horToEqjMatrix}
          cx={cx}
          cy={cy}
          R={R}
          width={size}
          height={svgHeight}
          opacity={0.45 * skyVisibility.milkyWayVisibility}
          sunDirection={sunDirectionHor}
          moonDirection={moonDirectionHor}
          twilightWash={skyVisibility.twilightWash}
          moonWash={skyVisibility.moonWash}
        />
      )}

      <svg
        width={size}
        height={svgHeight}
        style={{ display: 'block', position: 'absolute', left: 0, top: 0 }}
      >
        {/* Title + time */}
        {!hideTitle && (
          <>
            <text x={cx} y={14} textAnchor="middle" fill="#aaa" fontSize={12} fontWeight={600}>
              {title}
            </text>
            {time && (
              <text x={cx} y={26} textAnchor="middle" fill="#666" fontSize={10}>
                {formatTime(time, timeZone)}
              </text>
            )}
          </>
        )}

        {/* Clip path and glow gradients */}
        <defs>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>
          {showAtmosphere && atmosphere.skyAlpha > 0.001 && (
            <radialGradient
              id={`skybg-${title}`}
              cx={cx}
              cy={cy}
              r={R}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={colorToCss(atmosphere.zenithColor)} />
              <stop offset="70%" stopColor={colorToCss(atmosphere.horizonColor, 0.92)} />
              <stop offset="100%" stopColor={colorToCss(atmosphere.horizonColor)} />
            </radialGradient>
          )}
          {showAtmosphere && sunProj && atmosphere.sunGlowStrength > 0.001 && (
            <radialGradient
              id={`twilight-${title}`}
              cx={cx + sunProj.x}
              cy={cy + sunProj.y}
              r={R * 1.2}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={colorToCss(atmosphere.sunCoreColor, 0.30 * atmosphere.sunGlowStrength)} />
              <stop offset="35%" stopColor={colorToCss(atmosphere.sunGlowColor, 0.18 * atmosphere.sunGlowStrength)} />
              <stop offset="100%" stopColor={colorToCss(atmosphere.sunGlowColor, 0)} />
            </radialGradient>
          )}
          {moonProj && moonGlow.opacity > 0 && (
            <radialGradient
              id={`moonlight-${title}`}
              cx={cx + moonProj.x}
              cy={cy + moonProj.y}
              r={R * 0.65 * moonGlow.radiusScale}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={`rgba(180, 200, 230, ${moonGlow.opacity})`} />
              <stop offset="100%" stopColor="rgba(180, 200, 230, 0)" />
            </radialGradient>
          )}
        </defs>

        {/* Background */}
        <circle cx={cx} cy={cy} r={R} fill={useTexture ? 'transparent' : '#0a0e1a'} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

        {/* Atmosphere background tint */}
        {showAtmosphere && atmosphere.skyAlpha > 0.001 && (
          <circle cx={cx} cy={cy} r={R} fill={`url(#skybg-${title})`} opacity={atmosphere.skyAlpha} />
        )}

        {/* Twilight glow overlay */}
        {showAtmosphere && sunProj && atmosphere.sunGlowStrength > 0.001 && (
          <circle cx={cx} cy={cy} r={R} fill={`url(#twilight-${title})`} />
        )}

        {/* Moonlight glow overlay */}
        {moonProj && moonGlow.opacity > 0 && (
          <circle cx={cx} cy={cy} r={R} fill={`url(#moonlight-${title})`} />
        )}

        {/* Alt/Az grid */}
        {showAltAzGrid && (
          <>
            {/* Altitude grid rings at 30° and 60° */}
            {[30, 60].map((alt) => {
              const ringR = ((90 - alt) / 90) * R
              return (
                <circle
                  key={alt}
                  cx={cx}
                  cy={cy}
                  r={ringR}
                  fill="none"
                  stroke={gridColor}
                  strokeWidth={0.5}
                  strokeDasharray="4 3"
                />
              )
            })}

            {/* 8 azimuth lines every 45° */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((az) => {
              const azRad = az * DEG_TO_RAD
              const ex = cx + -R * Math.sin(azRad)
              const ey = cy + -R * Math.cos(azRad)
              return (
                <line
                  key={az}
                  x1={cx}
                  y1={cy}
                  x2={ex}
                  y2={ey}
                  stroke={gridColor}
                  strokeWidth={0.5}
                />
              )
            })}
          </>
        )}

        {/* Cardinal labels N/E/S/W */}
        {projectedCardinals.map(({ label, x: lx, y: ly }) => {
          return (
            <text
              key={label}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#888"
              fontSize={10}
              fontWeight={600}
            >
              {label}
            </text>
          )
        })}

        {/* Altitude labels + zenith marker */}
        {showAltAzGrid && (
          <>
            {projectedAltLabels.map(({ alt, x, y }) => (
              <text
                key={alt}
                x={x}
                y={y}
                fill={textColor}
                fontSize={8}
              >
                {alt}°
              </text>
            ))}
            <circle cx={cx} cy={cy} r={1.5} fill="rgba(255,255,255,0.3)" />
          </>
        )}

        <g clipPath={`url(#${clipId})`}>
          {/* Milky Way polygon layers (deepest background) — skip when using texture */}
          {showMilkyWay && !useTexture && milkyWayPaths.map((layer) =>
            layer.path ? (
              <path
                key={layer.id}
                d={layer.path}
                fill="#8899bb"
                fillRule="evenodd"
                opacity={(MW_OPACITIES[layer.id] ?? 0.03) * skyVisibility.milkyWayVisibility}
              />
            ) : null
          )}
          {/* Ecliptic curve + label */}
          {showEcliptic && eclipticPathData && (
            <g>
              <path
                d={eclipticPathData.path}
                stroke="rgba(200, 160, 80, 0.3)"
                strokeWidth={0.8}
                strokeDasharray="4 3"
                fill="none"
              />
              <text
                x={eclipticPathData.labelX}
                y={eclipticPathData.labelY - 5}
                textAnchor="middle"
                fill="#ccaa55"
                fontSize={7}
                opacity={0.5}
              >
                Ecliptic
              </text>
            </g>
          )}
        </g>
      </svg>

      <StarfieldCanvasLayer
        width={size}
        height={svgHeight}
        cx={cx}
        cy={cy}
        R={R}
        projectedStars={projectedStars}
        constellationData={constellationData}
        showStars={showStars}
        showStarLabels={showStarLabels}
        showConstellationEdges={showConstellationEdges}
        showConstellationLabels={showConstellationLabels}
        showAtmosphere={showAtmosphere}
        limitingMagnitude={limitingMagnitude}
        skyVisibility={skyVisibility}
        sunDirectionHor={sunProj ? sunDirectionHor : null}
        moonDirectionHor={moonProj ? moonDirectionHor : null}
        starBrightnessFactor={starBrightnessFactor}
        constellationEdgeBrightnessFactor={constellationEdgeBrightnessFactor}
      />

      <svg
        width={size}
        height={svgHeight}
        style={{ display: 'block', position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        <defs>
          <clipPath id={fgClipId}>
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${fgClipId})`}>
          {projected.map((p) => {
            const isMoon = p.bodyId === 'Moon'
            const isSun = p.bodyId === 'Sun'
            if (isMoon && !showMoon) return null
            if (!isMoon && !showPlanets) return null
            const px = cx + p.x
            const py = cy + p.y
            const color = bodyColor(p.bodyId)
            const rawMag = magnitudes[p.bodyId]
            const effMag = showAtmosphere && !isSun && !isMoon && rawMag != null
              ? effectiveStarMagnitude(rawMag, p.altitude)
              : rawMag
            const rad = isSun ? SUN_RADIUS : isMoon ? MOON_RADIUS : magnitudeToCanvasRadius(effMag ?? 2)
            const isAboveHorizon = p.altitude >= 0
            const contrast = showAtmosphere && !isSun && !isMoon && effMag != null
              ? starContrastFactor(effMag, limitingMagnitude)
              : 1
            const faintness = effMag != null ? clamp((effMag + 2) / 8, 0, 1) : 0.4
            const bodyDir = altAzToHorDirection(p.altitude, p.azimuth)
            let localVisibility = 1

            if (showAtmosphere && !isSun && !isMoon) {
              if (sunProj && skyVisibility.twilightWash > 0.001) {
                const sunDot = clamp(
                  bodyDir[0] * sunDirectionHor[0] + bodyDir[1] * sunDirectionHor[1] + bodyDir[2] * sunDirectionHor[2],
                  -1,
                  1,
                )
                const sunAng = Math.acos(sunDot)
                const sunKernel = Math.exp(-0.5 * (sunAng / 0.45) ** 2)
                localVisibility *= 1 - 0.58 * skyVisibility.twilightWash * (0.35 + 0.65 * faintness) * sunKernel
              }
              if (moonProj && skyVisibility.moonWash > 0.001) {
                const moonDot = clamp(
                  bodyDir[0] * moonDirectionHor[0] + bodyDir[1] * moonDirectionHor[1] + bodyDir[2] * moonDirectionHor[2],
                  -1,
                  1,
                )
                const moonAng = Math.acos(moonDot)
                const moonKernel = Math.exp(-0.5 * (moonAng / 0.34) ** 2)
                localVisibility *= 1 - 0.40 * skyVisibility.moonWash * (0.25 + 0.75 * faintness) * moonKernel
              }
              localVisibility = clamp(localVisibility, 0.15, 1)
            }

            const dotOpacity = (isAboveHorizon ? 1 : 0.3) * contrast * localVisibility
            const displayMag = effMag ?? rawMag

            return (
              <g key={p.bodyId} opacity={dotOpacity}>
                {isMoon ? (
                  <>
                    <circle cx={px} cy={py} r={rad} fill="#1a1a2e" />
                    <g transform={`translate(${px},${py}) rotate(${moonLimbRotationDeg})`}>
                      <path
                        d={moonPhasePath(rad, moonIllumination, moonLitToRight)}
                        fill={MOON_COLOR}
                      />
                    </g>
                    <circle cx={px} cy={py} r={rad} fill="none" stroke="rgba(200,200,200,0.4)" strokeWidth={0.5} />
                  </>
                ) : (
                  <circle cx={px} cy={py} r={rad} fill={color} />
                )}
                {showPlanetLabels && (() => {
                  const off = labelOffsets.get(p.bodyId) ?? { lx: 0, ly: -6 }
                  // Push label outward by the dot radius so it clears large bodies (Moon, Sun)
                  const offLen = Math.sqrt(off.lx * off.lx + off.ly * off.ly)
                  const radPush = offLen > 0.1 ? rad + 2 : rad + 2
                  const nx = offLen > 0.1 ? off.lx / offLen : 0
                  const ny = offLen > 0.1 ? off.ly / offLen : -1
                  // Determine text anchor based on horizontal direction of offset
                  const anchor = off.lx > 5 ? 'start' : off.lx < -5 ? 'end' : 'middle'
                  const labelX = px + off.lx + nx * radPush
                  const labelY = py + off.ly + ny * radPush
                  return (
                    <>
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor={anchor}
                        dominantBaseline={off.ly > 5 ? 'hanging' : off.ly < -5 ? 'auto' : 'central'}
                        fill={color}
                        fontSize={9}
                        fontWeight={500}
                      >
                        {BODY_LABELS[p.bodyId]}
                      </text>
                      {displayMag != null && (
                        <text
                          x={labelX}
                          y={labelY + (off.ly >= 0 ? 10 : -9)}
                          textAnchor={anchor}
                          dominantBaseline={off.ly > 5 ? 'hanging' : off.ly < -5 ? 'auto' : 'central'}
                          fill={color}
                          fontSize={7.5}
                          opacity={0.7}
                        >
                          {displayMag.toFixed(1)}
                        </text>
                      )}
                    </>
                  )
                })()}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
