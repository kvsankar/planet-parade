import { useMemo, useEffect, useRef, memo } from 'react'
import * as THREE from 'three'
import { CONSTELLATION_BOUNDARIES } from '../../data/constellationBoundaries'
import { raDecToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

export default memo(function ConstellationBoundaries3D() {
  const ref = useRef<THREE.LineSegments>(null)

  const { geometry, material } = useMemo(() => {
    const count = CONSTELLATION_BOUNDARIES.length
    const positions = new Float32Array(count * 6)

    for (let i = 0; i < count; i++) {
      const seg = CONSTELLATION_BOUNDARIES[i]
      const [x1, y1, z1] = raDecToSceneSphere(seg.ra1, seg.dec1, CELESTIAL_SPHERE_RADIUS)
      const [x2, y2, z2] = raDecToSceneSphere(seg.ra2, seg.dec2, CELESTIAL_SPHERE_RADIUS)
      positions[i * 6] = x1
      positions[i * 6 + 1] = y1
      positions[i * 6 + 2] = z1
      positions[i * 6 + 3] = x2
      positions[i * 6 + 4] = y2
      positions[i * 6 + 5] = z2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.LineDashedMaterial({
      color: 0x334466,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      dashSize: 3,
      gapSize: 3,
    })

    return { geometry: geo, material: mat }
  }, [])

  // computeLineDistances must be called on the LineSegments object, not geometry
  useEffect(() => {
    if (ref.current) ref.current.computeLineDistances()
  }, [geometry])

  return <lineSegments ref={ref} geometry={geometry} material={material} />
})
