import { useMemo } from 'react'
import { AltAzPosition, SkyBodyId, StarAltAzPosition, AltAzPoint, MilkyWayLayer } from '../../lib/astronomy'
import { BODY_META } from '../../constants'
import { CelestialBodyId } from '../../types'
import { STAR_CATALOG } from '../../data/starCatalog'
import { CONSTELLATIONS } from '../../data/constellationLines'
import MilkyWayTextureCanvas from './MilkyWayTextureCanvas'

interface StereoSkyChartProps {
  positions: AltAzPosition[]
  stars: StarAltAzPosition[]
  ecliptic: AltAzPoint[]
  milkyWay: MilkyWayLayer[]
  title: string
  time: Date | null
  size: number
  moonIllumination: number
  moonWaxing: boolean
  magnitudes: Partial<Record<SkyBodyId, number | null>>
  showStars?: boolean
  showConstellationEdges?: boolean
  showConstellationLabels?: boolean
  showMilkyWay?: boolean
  showPlanets?: boolean
  showMoon?: boolean
  isPlaying?: boolean
  hideTitle?: boolean
  milkyWayStyle?: 'polygons' | 'texture'
  horToEqjMatrix?: number[][]
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
  Pluto: 'Plu',
}

function bodyColor(id: SkyBodyId): string {
  if (id === 'Moon') return MOON_COLOR
  return BODY_META[id as CelestialBodyId]?.color ?? '#888'
}

/** Unified magnitude → dot radius. Brighter (lower mag) = larger. */
function magToRadius(mag: number): number {
  return Math.max(1.0, Math.min(6.0, 3.5 - mag * 0.55))
}

const SUN_RADIUS = 8
const MOON_RADIUS = 7

const DEG_TO_RAD = Math.PI / 180

function projectAltAz(altitude: number, azimuth: number, R: number): { x: number; y: number } {
  const r = ((90 - altitude) / 90) * R
  const azRad = azimuth * DEG_TO_RAD
  return { x: -r * Math.sin(azRad), y: -r * Math.cos(azRad) }
}

const MW_OPACITIES: Record<string, number> = { ol1: 0.02, ol2: 0.03, ol3: 0.04, ol4: 0.05, ol5: 0.06 }

const SPECTRAL_COLORS: Record<string, string> = {
  O: '#9db4ff', B: '#aabfff', A: '#cad8ff', F: '#f8f7ff',
  G: '#fff4e8', K: '#ffd2a1', M: '#ffcc6f',
}

/** SVG path for the lit portion of the Moon, centered at (0,0) */
function moonPhasePath(r: number, illum: number, waxing: boolean): string {
  // k ranges from -1 (new) to +1 (full)
  const k = 2 * illum - 1
  const rx = Math.abs(k) * r
  // Lit side semicircle sweep: waxing = right side (sweep 1), waning = left side (sweep 0)
  const semiSweep = waxing ? 1 : 0
  // Terminator sweep depends on gibbous vs crescent and waxing vs waning
  const termSweep = waxing ? (k >= 0 ? 1 : 0) : (k >= 0 ? 0 : 1)
  return `M 0 ${-r} A ${r} ${r} 0 0 ${semiSweep} 0 ${r} A ${rx} ${r} 0 0 ${termSweep} 0 ${-r} Z`
}

function formatTime(d: Date): string {
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

export default function StereoSkyChart({
  positions, stars, ecliptic, milkyWay, title, time, size,
  moonIllumination, moonWaxing, magnitudes,
  showStars = true, showConstellationEdges = true,
  showConstellationLabels = true, showMilkyWay = true, showPlanets = true, showMoon = true,
  isPlaying = false,
  hideTitle = false,
  milkyWayStyle = 'polygons',
  horToEqjMatrix,
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

  // Moon glow peak opacity: 0.12 * illumination * clamp01(sin(altitude))
  const moonGlowOpacity = showMoon && moonProj && moonProj.altitude > 0 && moonIllumination > 0.1
    ? 0.12 * moonIllumination * Math.min(1, Math.sin(moonProj.altitude * DEG_TO_RAD))
    : 0

  const projectedStars = useMemo(() => {
    return stars.map((s) => {
      const cat = STAR_CATALOG[s.starIndex]
      return {
        ...projectAltAz(s.altitude, s.azimuth, R),
        starIndex: s.starIndex,
        altitude: s.altitude,
        name: cat.name,
        mag: cat.mag,
        spectral: cat.spectral,
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

  const useTexture = milkyWayStyle === 'texture' && showMilkyWay && !!horToEqjMatrix

  if (size < 50) return null

  const gridColor = 'rgba(255,255,255,0.12)'
  const textColor = '#666'

  const svgHeight = hideTitle ? size : size + 36

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
          opacity={0.45}
        />
      )}
    <svg
      width={size}
      height={svgHeight}
      style={{ display: 'block', position: 'relative' }}
    >
        {/* Title + time */}
        {!hideTitle && (
          <>
            <text x={cx} y={14} textAnchor="middle" fill="#aaa" fontSize={12} fontWeight={600}>
              {title}
            </text>
            {time && (
              <text x={cx} y={26} textAnchor="middle" fill="#666" fontSize={10}>
                {formatTime(time)}
              </text>
            )}
          </>
        )}

        {/* Clip path and glow gradients */}
        <defs>
          <clipPath id={`clip-${title}`}>
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>
          {sunProj && (
            <radialGradient
              id={`twilight-${title}`}
              cx={cx + sunProj.x}
              cy={cy + sunProj.y}
              r={R * 1.2}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="rgba(255, 170, 60, 0.18)" />
              <stop offset="100%" stopColor="rgba(255, 170, 60, 0)" />
            </radialGradient>
          )}
          {moonProj && moonGlowOpacity > 0 && (
            <radialGradient
              id={`moonlight-${title}`}
              cx={cx + moonProj.x}
              cy={cy + moonProj.y}
              r={R * 0.8}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={`rgba(180, 200, 230, ${moonGlowOpacity})`} />
              <stop offset="100%" stopColor="rgba(180, 200, 230, 0)" />
            </radialGradient>
          )}
        </defs>

        {/* Background */}
        <circle cx={cx} cy={cy} r={R} fill={useTexture ? 'transparent' : '#0a0e1a'} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

        {/* Twilight glow overlay */}
        {sunProj && (
          <circle cx={cx} cy={cy} r={R} fill={`url(#twilight-${title})`} />
        )}

        {/* Moonlight glow overlay */}
        {moonProj && moonGlowOpacity > 0 && (
          <circle cx={cx} cy={cy} r={R} fill={`url(#moonlight-${title})`} />
        )}

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

        {/* Cardinal labels N/E/S/W */}
        {([
          ['N', 0],
          ['E', 90],
          ['S', 180],
          ['W', 270],
        ] as [string, number][]).map(([label, az]) => {
          const azRad = az * DEG_TO_RAD
          const labelR = R + 12
          const lx = cx + -labelR * Math.sin(azRad)
          const ly = cy + -labelR * Math.cos(azRad)
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

        {/* Altitude labels along north axis */}
        {[30, 60].map((alt) => {
          const labelR = ((90 - alt) / 90) * R
          return (
            <text
              key={alt}
              x={cx + 4}
              y={cy - labelR + 3}
              fill={textColor}
              fontSize={8}
            >
              {alt}°
            </text>
          )
        })}

        {/* Zenith dot */}
        <circle cx={cx} cy={cy} r={1.5} fill="rgba(255,255,255,0.3)" />

        {/* Stars + body dots + labels (clipped to circle) */}
        <g clipPath={`url(#clip-${title})`}>
          {/* Milky Way polygon layers (deepest background) — skip when using texture */}
          {showMilkyWay && !useTexture && milkyWayPaths.map((layer) =>
            layer.path ? (
              <path
                key={layer.id}
                d={layer.path}
                fill="#8899bb"
                fillRule="evenodd"
                opacity={MW_OPACITIES[layer.id] ?? 0.03}
              />
            ) : null
          )}
          {/* Ecliptic curve + label */}
          {eclipticPathData && (
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
          {/* Constellation lines + labels (behind stars) */}
          {(showConstellationEdges || showConstellationLabels) && constellationData.map((c) => (
            <g key={c.name}>
              {showConstellationEdges && c.segments.map((seg, i) => (
                <line
                  key={i}
                  x1={cx + seg.x1}
                  y1={cy + seg.y1}
                  x2={cx + seg.x2}
                  y2={cy + seg.y2}
                  stroke="rgba(100, 140, 255, 0.25)"
                  strokeWidth={0.6}
                  opacity={seg.bothBelow ? 0.1 : 1}
                />
              ))}
              {showConstellationLabels && c.centroid && (
                <text
                  x={cx + c.centroid.x}
                  y={cy + c.centroid.y - 6}
                  textAnchor="middle"
                  fill="#88aaff"
                  fontSize={8}
                  opacity={0.35}
                >
                  {c.name}
                </text>
              )}
            </g>
          ))}
          {/* Star layer (behind planets) */}
          {showStars && projectedStars.map((s) => {
            const sx = cx + s.x
            const sy = cy + s.y
            const color = SPECTRAL_COLORS[s.spectral] ?? '#ccc'
            const rad = magToRadius(s.mag)
            const isAbove = s.altitude >= 0
            let baseOpacity = isAbove ? 0.85 : 0.3

            // Proximity dimming for faint stars (mag > 2.0)
            if (s.mag > 2.0) {
              const glowRadius = R * 0.4
              if (sunProj) {
                const dSun = Math.sqrt((s.x - sunProj.x) ** 2 + (s.y - sunProj.y) ** 2)
                if (dSun < glowRadius) {
                  baseOpacity *= 0.6 + 0.4 * (dSun / glowRadius)
                }
              }
              if (moonProj && moonGlowOpacity > 0) {
                const dMoon = Math.sqrt((s.x - moonProj.x) ** 2 + (s.y - moonProj.y) ** 2)
                if (dMoon < glowRadius) {
                  baseOpacity *= 1 - moonIllumination * 0.4 * (1 - dMoon / glowRadius)
                }
              }
            }

            return (
              <g key={s.starIndex} opacity={baseOpacity}>
                <circle cx={sx} cy={sy} r={rad} fill={color} />
                {s.name && (
                  <text
                    x={sx + rad + 2}
                    y={sy + 2.5}
                    fill={color}
                    fontSize={7}
                    opacity={0.7}
                  >
                    {s.name}
                  </text>
                )}
              </g>
            )
          })}
          {/* Planet layer (on top of stars) */}
          {projected.map((p) => {
            const isMoon = p.bodyId === 'Moon'
            if (isMoon && !showMoon) return null
            if (!isMoon && !showPlanets) return null
            const px = cx + p.x
            const py = cy + p.y
            const color = bodyColor(p.bodyId)
            const mag = magnitudes[p.bodyId]
            const isSun = p.bodyId === 'Sun'
            const rad = isSun ? SUN_RADIUS : isMoon ? MOON_RADIUS : magToRadius(mag ?? 2)
            const isAboveHorizon = p.altitude >= 0

            return (
              <g key={p.bodyId} opacity={isAboveHorizon ? 1 : 0.3}>
                {isMoon ? (
                  <>
                    <circle cx={px} cy={py} r={rad} fill="#1a1a2e" />
                    <path
                      d={moonPhasePath(rad, moonIllumination, moonWaxing)}
                      transform={`translate(${px},${py})`}
                      fill={MOON_COLOR}
                    />
                    <circle cx={px} cy={py} r={rad} fill="none" stroke="rgba(200,200,200,0.4)" strokeWidth={0.5} />
                  </>
                ) : (
                  <circle cx={px} cy={py} r={rad} fill={color} />
                )}
                {(() => {
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
                      {mag != null && (
                        <text
                          x={labelX}
                          y={labelY + (off.ly >= 0 ? 10 : -9)}
                          textAnchor={anchor}
                          dominantBaseline={off.ly > 5 ? 'hanging' : off.ly < -5 ? 'auto' : 'central'}
                          fill={color}
                          fontSize={7.5}
                          opacity={0.7}
                        >
                          {mag.toFixed(1)}
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
