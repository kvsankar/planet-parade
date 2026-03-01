import { useMemo, memo } from 'react'
import * as THREE from 'three'
import { STAR_CATALOG } from '../../data/starCatalog'
import { CONSTELLATIONS } from '../../data/constellationLines'
import { raDecToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

// Pre-compute star positions on the celestial sphere
const starPositions = STAR_CATALOG.map((s) => raDecToSceneSphere(s.ra, s.dec, CELESTIAL_SPHERE_RADIUS))

export default memo(function ConstellationLines3D() {
  const { geometry, material } = useMemo(() => {
    // Count total segments
    let segCount = 0
    for (const c of CONSTELLATIONS) segCount += c.lines.length

    const positions = new Float32Array(segCount * 6) // 2 vertices × 3 coords per segment
    let offset = 0

    for (const constellation of CONSTELLATIONS) {
      for (const [i1, i2] of constellation.lines) {
        const p1 = starPositions[i1]
        const p2 = starPositions[i2]
        if (!p1 || !p2) continue
        positions[offset++] = p1[0]
        positions[offset++] = p1[1]
        positions[offset++] = p1[2]
        positions[offset++] = p2[0]
        positions[offset++] = p2[1]
        positions[offset++] = p2[2]
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.LineBasicMaterial({
      color: 0x334466,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    })

    return { geometry: geo, material: mat }
  }, [])

  return <lineSegments geometry={geometry} material={material} />
})
