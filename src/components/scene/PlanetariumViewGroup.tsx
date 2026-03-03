import { useRef, ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { planetariumStore } from '../../hooks/usePlanetariumStore'

const _yAxis = new THREE.Vector3(0, 1, 0)
const _xAxis = new THREE.Vector3(1, 0, 0)
const _yawQuat = new THREE.Quaternion()
const _pitchQuat = new THREE.Quaternion()
const _camQuat = new THREE.Quaternion()
const _worldQuat = new THREE.Quaternion()

/**
 * Wraps all planetarium content in a group that applies the view rotation.
 *
 * Instead of rotating the camera, we keep the camera at identity and
 * rotate ALL content by the inverse view direction.
 * This guarantees sky, horizon, planets, and labels all move together.
 */
export default function PlanetariumViewGroup({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!ref.current) return
    const yaw = planetariumStore.yaw
    const pitch = planetariumStore.pitch

    // Deterministic no-roll camera orientation from yaw+pitch.
    _yawQuat.setFromAxisAngle(_yAxis, yaw)
    _pitchQuat.setFromAxisAngle(_xAxis, pitch)
    _camQuat.copy(_yawQuat).multiply(_pitchQuat)
    _worldQuat.copy(_camQuat).invert()
    ref.current.quaternion.copy(_worldQuat)
  })

  return <group ref={ref}>{children}</group>
}
