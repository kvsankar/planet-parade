import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ObserverLocation } from '../../types'
import { simulationStore } from '../../hooks/useSimulationStore'
import { getEclipticAltAzPositions } from '../../lib/astronomy'
import { altAzToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

const R = CELESTIAL_SPHERE_RADIUS * 0.99
const COLOR = new THREE.Color('#ccaa55')
const OPACITY = 0.3
const HORIZON_EPS_DEG = 0

function findLongestVisibleRun(samples: { altitude: number }[]): { start: number; length: number } {
  const n = samples.length
  if (n === 0) return { start: 0, length: 0 }

  let bestLength = 0
  let bestEnd = -1
  let run = 0

  for (let i = 0; i < n * 2; i++) {
    const sample = samples[i % n]
    if (sample.altitude >= -HORIZON_EPS_DEG) {
      run = Math.min(run + 1, n)
      if (run > bestLength) {
        bestLength = run
        bestEnd = i
      }
    } else {
      run = 0
    }
  }

  if (bestLength < 2) return { start: 0, length: 0 }
  const start = ((bestEnd - bestLength + 1) % n + n) % n
  return { start, length: bestLength }
}

interface Props {
  observer: ObserverLocation
}

export default function PlanetariumEclipticGrid({ observer }: Props) {
  const lineRef = useRef<THREE.LineSegments>(null)
  const lastKeyRef = useRef('')

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const mat = new THREE.LineDashedMaterial({
      color: COLOR,
      opacity: OPACITY,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      dashSize: 8,
      gapSize: 6,
    })
    return { geometry: geo, material: mat }
  }, [])

  useFrame(() => {
    const date = simulationStore.date
    const obsKey = `${observer.lat.toFixed(5)}|${observer.lon.toFixed(5)}|${observer.height.toFixed(1)}`
    const key = `${date.getTime()}|${obsKey}`
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key

    const samples = getEclipticAltAzPositions(date, observer)
    const { start, length } = findLongestVisibleRun(samples)
    const positions: number[] = []
    for (let i = 0; i < Math.max(0, length - 1); i++) {
      const a = samples[(start + i) % samples.length]
      const b = samples[(start + i + 1) % samples.length]
      if (a.altitude < HORIZON_EPS_DEG || b.altitude < HORIZON_EPS_DEG) continue
      const [ax, ay, az] = altAzToSceneSphere(a.altitude, a.azimuth, R)
      const [bx, by, bz] = altAzToSceneSphere(b.altitude, b.azimuth, R)
      positions.push(ax, ay, az, bx, by, bz)
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.computeBoundingSphere()
    lineRef.current?.computeLineDistances()
  })

  return <lineSegments ref={lineRef} geometry={geometry} material={material} />
}
