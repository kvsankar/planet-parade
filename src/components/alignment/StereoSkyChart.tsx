import { useMemo } from 'react'
import { AltAzPosition, SkyBodyId, StarAltAzPosition, EclipticPoint } from '../../lib/astronomy'
import { BODY_META } from '../../constants'
import { CelestialBodyId } from '../../types'
import { STAR_CATALOG } from '../../data/starCatalog'
import { CONSTELLATIONS } from '../../data/constellationLines'

interface StereoSkyChartProps {
  positions: AltAzPosition[]
  stars: StarAltAzPosition[]
  ecliptic: EclipticPoint[]
  title: string
  time: Date | null
  size: number
  moonIllumination: number
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

function bodyRadius(id: SkyBodyId): number {
  if (id === 'Sun') return 6
  if (id === 'Moon') return 5
  return 3.5
}

const DEG_TO_RAD = Math.PI / 180

function projectAltAz(altitude: number, azimuth: number, R: number): { x: number; y: number } {
  const r = ((90 - altitude) / 90) * R
  const azRad = azimuth * DEG_TO_RAD
  return { x: -r * Math.sin(azRad), y: -r * Math.cos(azRad) }
}

function starRadius(mag: number): number {
  return Math.max(0.8, Math.min(2.5, 2.5 - (mag + 1.5) / 3))
}

const SPECTRAL_COLORS: Record<string, string> = {
  O: '#9db4ff', B: '#aabfff', A: '#cad8ff', F: '#f8f7ff',
  G: '#fff4e8', K: '#ffd2a1', M: '#ffcc6f',
}

function formatTime(d: Date): string {
  const h = d.getUTCHours().toString().padStart(2, '0')
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m} UTC`
}

export default function StereoSkyChart({ positions, stars, ecliptic, title, time, size, moonIllumination }: StereoSkyChartProps) {
  const MARGIN = 28
  const R = (size - MARGIN * 2) / 2
  const cx = size / 2
  const cy = size / 2 + 18 // shift down to clear title + time text

  const projected = useMemo(() => {
    return positions.map((p) => ({ ...p, ...projectAltAz(p.altitude, p.azimuth, R) }))
  }, [positions, R])

  // Derive Sun/Moon projected positions from already-memoized `projected`
  const sunProj = projected.find((p) => p.bodyId === 'Sun') ?? null
  const moonProj = projected.find((p) => p.bodyId === 'Moon') ?? null

  // Moon glow peak opacity: 0.12 * illumination * clamp01(sin(altitude))
  const moonGlowOpacity = moonProj && moonProj.altitude > 0 && moonIllumination > 0.1
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
    const parts: string[] = []
    let prevX = 0, prevY = 0

    for (let i = 0; i < pts.length; i++) {
      const px = cx + pts[i].x
      const py = cy + pts[i].y
      if (i === 0) {
        parts.push(`M ${px} ${py}`)
      } else {
        const dx = px - prevX
        const dy = py - prevY
        if (Math.sqrt(dx * dx + dy * dy) > R * 0.5) {
          parts.push(`M ${px} ${py}`)
        } else {
          parts.push(`L ${px} ${py}`)
        }
      }
      prevX = px
      prevY = py
    }

    // Close back to first point if no discontinuity
    const firstX = cx + pts[0].x
    const firstY = cy + pts[0].y
    if (Math.sqrt((firstX - prevX) ** 2 + (firstY - prevY) ** 2) < R * 0.5) {
      parts.push('Z')
    }

    // Label at highest-altitude point
    let bestIdx = 0
    for (let i = 1; i < ecliptic.length; i++) {
      if (ecliptic[i].altitude > ecliptic[bestIdx].altitude) bestIdx = i
    }

    return {
      path: parts.join(' '),
      labelX: cx + pts[bestIdx].x,
      labelY: cy + pts[bestIdx].y,
    }
  }, [ecliptic, R, cx, cy])

  if (size < 50) return null

  const gridColor = 'rgba(255,255,255,0.12)'
  const textColor = '#666'

  return (
    <svg width={size} height={size + 36} style={{ display: 'block' }}>
      {/* Title + time */}
      <text x={cx} y={14} textAnchor="middle" fill="#aaa" fontSize={12} fontWeight={600}>
        {title}
      </text>
      {time && (
        <text x={cx} y={26} textAnchor="middle" fill="#666" fontSize={10}>
          {formatTime(time)}
        </text>
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
      <circle cx={cx} cy={cy} r={R} fill="#0a0e1a" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

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
        {constellationData.map((c) => (
          <g key={c.name}>
            {c.segments.map((seg, i) => (
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
            {c.centroid && (
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
        {projectedStars.map((s) => {
          const sx = cx + s.x
          const sy = cy + s.y
          const color = SPECTRAL_COLORS[s.spectral] ?? '#ccc'
          const rad = starRadius(s.mag)
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
          const px = cx + p.x
          const py = cy + p.y
          const color = bodyColor(p.bodyId)
          const rad = bodyRadius(p.bodyId)
          const isAboveHorizon = p.altitude >= 0

          return (
            <g key={p.bodyId} opacity={isAboveHorizon ? 1 : 0.3}>
              <circle cx={px} cy={py} r={rad} fill={color} />
              <text
                x={px}
                y={py - rad - 3}
                textAnchor="middle"
                fill={color}
                fontSize={8}
                fontWeight={500}
              >
                {BODY_LABELS[p.bodyId]}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
