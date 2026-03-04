import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'
import { planetariumStore } from '../../hooks/usePlanetariumStore'

const GROUND_RADIUS = CELESTIAL_SPHERE_RADIUS * 0.97
const HORIZON_RADIUS = GROUND_RADIUS * 0.995
const LABEL_RADIUS = HORIZON_RADIUS
const HORIZON_ARC_DEG = 180
const HORIZON_ARC_SEGMENTS = 180
const RAD_TO_DEG = 180 / Math.PI

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

function normalizeAzimuthDeg(value: number): number {
  return ((value % 360) + 360) % 360
}

function HorizonRing() {
  const positions = useMemo(
    () => new Float32Array((HORIZON_ARC_SEGMENTS + 1) * 3),
    [],
  )
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setDrawRange(0, HORIZON_ARC_SEGMENTS + 1)
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), HORIZON_RADIUS + 1)
    return geo
  }, [positions])
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#647487', opacity: 0.8, transparent: true, depthWrite: false, linewidth: 1 }),
    [],
  )
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material])

  useFrame(() => {
    const centerAz = normalizeAzimuthDeg(-planetariumStore.yaw * RAD_TO_DEG)
    const startAz = centerAz - HORIZON_ARC_DEG / 2
    const stepAz = HORIZON_ARC_DEG / HORIZON_ARC_SEGMENTS
    for (let i = 0; i <= HORIZON_ARC_SEGMENTS; i++) {
      const az = startAz + i * stepAz
      const [x, y, z] = azToPos(az, HORIZON_RADIUS)
      const k = i * 3
      positions[k] = x
      positions[k + 1] = y
      positions[k + 2] = z
    }
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
  })

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return <primitive object={line} />
}

interface Props {
  showCardinalLabels?: boolean
}

export default function PlanetariumHorizon({ showCardinalLabels = true }: Props) {
  const groundRef = useRef<THREE.Mesh>(null)
  const { groundGeo, groundMat } = useMemo(() => {
    const geo = new THREE.SphereGeometry(GROUND_RADIUS, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      color: '#0a0a0f',
      side: THREE.BackSide,
      depthWrite: true,
    })
    return { groundGeo: geo, groundMat: mat }
  }, [])

  return (
    <group>
      <mesh ref={groundRef} geometry={groundGeo} material={groundMat} />

      <HorizonRing />

      {showCardinalLabels && CARDINALS.map(({ label, az }) => {
        const [x, , z] = azToPos(az, LABEL_RADIUS)
        return (
          <Html
            key={label}
            position={[x, 0, z]}
            center
            occlude={[groundRef]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="planetarium-horizon-label">{label}</div>
          </Html>
        )
      })}
    </group>
  )
}
