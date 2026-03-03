import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

const HORIZON_RADIUS = CELESTIAL_SPHERE_RADIUS * 0.98
const LABEL_RADIUS = CELESTIAL_SPHERE_RADIUS * 0.92

const CARDINALS: { label: string; az: number }[] = [
  { label: 'N', az: 0 },
  { label: 'E', az: 90 },
  { label: 'S', az: 180 },
  { label: 'W', az: 270 },
]

function azToPos(azDeg: number, r: number): [number, number, number] {
  const azRad = azDeg * Math.PI / 180
  return [Math.sin(azRad) * r, 0, -Math.cos(azRad) * r]
}

function HorizonRing() {
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 360; i++) {
      const [x, , z] = azToPos(i, HORIZON_RADIUS)
      pts.push(new THREE.Vector3(x, 0, z))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({ color: '#88aacc', opacity: 0.8, transparent: true, depthWrite: false, linewidth: 1 })
    return new THREE.Line(geo, mat)
  }, [])
  return <primitive object={line} />
}

interface Props {
  showCardinalLabels?: boolean
}

export default function PlanetariumHorizon({ showCardinalLabels = true }: Props) {
  const { groundGeo, groundMat } = useMemo(() => {
    const geo = new THREE.SphereGeometry(CELESTIAL_SPHERE_RADIUS * 0.97, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      color: '#0a0a0f',
      side: THREE.BackSide,
      depthWrite: true,
    })
    return { groundGeo: geo, groundMat: mat }
  }, [])

  return (
    <group>
      <mesh geometry={groundGeo} material={groundMat} />

      <HorizonRing />

      {showCardinalLabels && CARDINALS.map(({ label, az }) => {
        const [x, , z] = azToPos(az, LABEL_RADIUS)
        return (
          <Html
            key={label}
            position={[x, 8, z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="planetarium-horizon-label">{label}</div>
          </Html>
        )
      })}
    </group>
  )
}
