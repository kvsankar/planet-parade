import { memo } from 'react'
import { Html } from '@react-three/drei'
import { STAR_CATALOG } from '../../data/starCatalog'
import { CONSTELLATIONS } from '../../data/constellationLines'
import { raDecToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

const STAR_LABEL_RADIUS = CELESTIAL_SPHERE_RADIUS * 0.995
const CONSTELLATION_LABEL_RADIUS = CELESTIAL_SPHERE_RADIUS * 0.985
const STAR_LABEL_MAX_MAG = 2.8

type LabelPos = [number, number, number]

const STAR_LABELS: { key: string; name: string; pos: LabelPos }[] = STAR_CATALOG
  .map((star, idx) => {
    if (!star.name || star.mag > STAR_LABEL_MAX_MAG) return null
    const pos = raDecToSceneSphere(star.ra, star.dec, STAR_LABEL_RADIUS)
    return {
      key: `${star.name}-${idx}`,
      name: star.name,
      pos,
    }
  })
  .filter((entry): entry is { key: string; name: string; pos: LabelPos } => entry !== null)

const STAR_POSITIONS = STAR_CATALOG.map((star) => raDecToSceneSphere(star.ra, star.dec, CELESTIAL_SPHERE_RADIUS))

const CONSTELLATION_LABELS: { key: string; name: string; pos: LabelPos }[] = CONSTELLATIONS
  .map((constellation) => {
    // Keep labels to true constellations only; skip helper asterisms.
    if (constellation.name.includes('△')) return null

    const indices = new Set<number>()
    for (const [a, b] of constellation.lines) {
      indices.add(a)
      indices.add(b)
    }

    let sx = 0
    let sy = 0
    let sz = 0
    let count = 0

    for (const idx of indices) {
      const p = STAR_POSITIONS[idx]
      if (!p) continue
      sx += p[0]
      sy += p[1]
      sz += p[2]
      count++
    }

    if (count === 0) return null
    const len = Math.hypot(sx, sy, sz)
    if (len < 1e-6) return null

    const k = CONSTELLATION_LABEL_RADIUS / len
    return {
      key: constellation.name,
      name: constellation.name,
      pos: [sx * k, sy * k, sz * k] as LabelPos,
    }
  })
  .filter((entry): entry is { key: string; name: string; pos: LabelPos } => entry !== null)

export const PlanetariumStarLabels = memo(function PlanetariumStarLabels() {
  return (
    <group>
      {STAR_LABELS.map((star) => (
        <Html key={star.key} position={star.pos} center occlude style={{ pointerEvents: 'none' }}>
          <div className="planetarium-star-label">{star.name}</div>
        </Html>
      ))}
    </group>
  )
})

export const PlanetariumConstellationLabels = memo(function PlanetariumConstellationLabels() {
  return (
    <group>
      {CONSTELLATION_LABELS.map((constellation) => (
        <Html key={constellation.key} position={constellation.pos} center occlude style={{ pointerEvents: 'none' }}>
          <div className="planetarium-constellation-label">{constellation.name}</div>
        </Html>
      ))}
    </group>
  )
})
