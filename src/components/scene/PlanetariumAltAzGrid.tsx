import { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

const R = CELESTIAL_SPHERE_RADIUS * 0.96
const DEG = Math.PI / 180
const COLOR = new THREE.Color('#2a4a6a')
const OPACITY = 0.18

// Altitude circles: every 15° above the horizon.
const ALT_STEPS = [0, 15, 30, 45, 60, 75]
// Azimuth lines: every 15° above the horizon.
const AZ_STEPS = Array.from({ length: 24 }, (_, i) => i * 15)

function altAzToXYZ(altDeg: number, azDeg: number, r: number): THREE.Vector3 {
  const alt = altDeg * DEG
  const az = azDeg * DEG
  const cosAlt = Math.cos(alt)
  return new THREE.Vector3(
    cosAlt * Math.sin(az) * r,
    Math.sin(alt) * r,
    -cosAlt * Math.cos(az) * r,
  )
}

// Labels for altitude lines
const ALT_LABELS = [15, 30, 45, 60, 75].map((alt) => ({
  alt,
  label: `${alt}°`,
  pos: altAzToXYZ(alt, 180, R * 0.94), // on south meridian
}))

export default function PlanetariumAltAzGrid() {
  const lineObj = useMemo(() => {
    const pts: number[] = []

    // Altitude circles
    for (const alt of ALT_STEPS) {
      for (let az = 0; az <= 360; az += 2) {
        const v = altAzToXYZ(alt, az, R)
        pts.push(v.x, v.y, v.z)
        if (az > 0 && az < 360) {
          // duplicate point for line segments
          pts.push(v.x, v.y, v.z)
        }
      }
    }

    // Azimuth lines (from horizon to zenith only)
    for (const az of AZ_STEPS) {
      for (let alt = 0; alt <= 90; alt += 2) {
        const v = altAzToXYZ(alt, az, R)
        pts.push(v.x, v.y, v.z)
        if (alt > 0 && alt < 90) {
          pts.push(v.x, v.y, v.z)
        }
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const mat = new THREE.LineBasicMaterial({
      color: COLOR,
      opacity: OPACITY,
      transparent: true,
      depthWrite: false,
    })
    return new THREE.LineSegments(geo, mat)
  }, [])

  return (
    <group>
      <primitive object={lineObj} />
      {ALT_LABELS.map(({ alt, label, pos }) => (
        <Html key={alt} position={[pos.x, pos.y, pos.z]} center style={{ pointerEvents: 'none' }}>
          <span style={{ color: '#4a7aaa', fontSize: '9px', fontFamily: 'monospace', opacity: 0.5, textShadow: '0 0 4px #000' }}>{label}</span>
        </Html>
      ))}
    </group>
  )
}
