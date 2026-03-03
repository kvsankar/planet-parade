import { useMemo } from 'react'
import * as THREE from 'three'
import { CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

const R = CELESTIAL_SPHERE_RADIUS * 0.99
const DEG = Math.PI / 180
const COLOR = new THREE.Color('#ccaa55')
const OPACITY = 0.3

/**
 * Convert ecliptic (lon, lat) to the same scene coordinate system
 * used by raDecToSceneSphere (EQJ → ecliptic → scene axes).
 * Ecliptic unit vector → apply scene-axis remap (eclX→X, eclZ→Y, -eclY→Z)
 */
function eclipticToScene(lonDeg: number, latDeg: number, r: number): THREE.Vector3 {
  const lon = lonDeg * DEG
  const lat = latDeg * DEG
  const cosLat = Math.cos(lat)
  // Ecliptic cartesian
  const eclX = cosLat * Math.cos(lon)
  const eclY = cosLat * Math.sin(lon)
  const eclZ = Math.sin(lat)
  // Scene axes: eclX→X, eclZ→Y(up), -eclY→Z
  return new THREE.Vector3(eclX * r, eclZ * r, -eclY * r)
}

export default function PlanetariumEclipticGrid() {
  const lineObj = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let lon = 0; lon < 360; lon += 1) {
      pts.push(eclipticToScene(lon, 0, R))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineDashedMaterial({
      color: COLOR,
      opacity: OPACITY,
      transparent: true,
      depthWrite: false,
      dashSize: 14,
      gapSize: 10,
    })
    const line = new THREE.LineLoop(geo, mat)
    line.computeLineDistances()
    return line
  }, [])

  return <primitive object={lineObj} />
}
