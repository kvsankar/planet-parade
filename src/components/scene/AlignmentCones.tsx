import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CelestialBodyId } from '../../types'
import { SERIES_COLORS } from '../../constants'
import { getGeocentricEclipticCoords, computeSpanArc, wrap180 } from '../../lib/alignment'
import { getBodyPosition } from '../../lib/astronomy'
import { simulationStore } from '../../hooks/useSimulationStore'

const CONE_RADIUS = 500 // scene units — extends well past outer planets
const MS_PER_HOUR = 3_600_000

interface Props {
  selectedBodies: CelestialBodyId[]
}

/** Build a flat sector (pie slice) in the XZ plane from ecliptic longitude arc */
function buildSectorGeometry(longitudes: number[], radius: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()

  if (longitudes.length < 1) {
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  }

  if (longitudes.length === 1) {
    // Single planet: thin sliver ±0.5°
    const rad = longitudes[0] * Math.PI / 180
    const hw = 0.5 * Math.PI / 180
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      Math.cos(rad - hw) * radius, 0, -Math.sin(rad - hw) * radius,
      Math.cos(rad + hw) * radius, 0, -Math.sin(rad + hw) * radius,
    ], 3))
    return geo
  }

  const arc = computeSpanArc(longitudes)
  if (!arc) {
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  }

  const span = arc.start <= arc.end
    ? arc.end - arc.start
    : arc.end + 360 - arc.start
  const segments = Math.max(8, Math.ceil(span / 2))
  const vertices: number[] = []

  for (let i = 0; i < segments; i++) {
    const lon1 = ((arc.start + (i / segments) * span) % 360) * Math.PI / 180
    const lon2 = ((arc.start + ((i + 1) / segments) * span) % 360) * Math.PI / 180
    vertices.push(
      0, 0, 0,
      Math.cos(lon1) * radius, 0, -Math.sin(lon1) * radius,
      Math.cos(lon2) * radius, 0, -Math.sin(lon2) * radius,
    )
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  return geo
}

/** Build edge lines for a sector arc */
function buildEdgeGeometry(longitudes: number[], radius: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  if (longitudes.length < 2) {
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  }

  const arc = computeSpanArc(longitudes)
  if (!arc) {
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  }

  const startRad = arc.start * Math.PI / 180
  const endRad = arc.end * Math.PI / 180

  // Two radial lines from center to edge
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    Math.cos(startRad) * radius, 0, -Math.sin(startRad) * radius,
    0, 0, 0,
    Math.cos(endRad) * radius, 0, -Math.sin(endRad) * radius,
  ], 3))
  return geo
}

const emptyGeo = () => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
  return g
}

export default function AlignmentCones({ selectedBodies }: Props) {
  const groupRef = useRef<THREE.Group>(null!)
  const allMeshRef = useRef<THREE.Mesh>(null!)
  const amMeshRef = useRef<THREE.Mesh>(null!)
  const pmMeshRef = useRef<THREE.Mesh>(null!)
  const allEdgeRef = useRef<THREE.LineSegments>(null!)
  const amEdgeRef = useRef<THREE.LineSegments>(null!)
  const pmEdgeRef = useRef<THREE.LineSegments>(null!)
  const lastHourRef = useRef(-1)
  const bodiesRef = useRef(selectedBodies)
  bodiesRef.current = selectedBodies

  // Force geometry recompute when selected bodies change
  const bodiesKey = selectedBodies.join(',')
  useEffect(() => { lastHourRef.current = -1 }, [bodiesKey])

  const allMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: SERIES_COLORS.total, transparent: true, opacity: 0.06,
    side: THREE.DoubleSide, depthWrite: false,
  }), [])
  const amMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: SERIES_COLORS.morning, transparent: true, opacity: 0.10,
    side: THREE.DoubleSide, depthWrite: false,
  }), [])
  const pmMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: SERIES_COLORS.evening, transparent: true, opacity: 0.10,
    side: THREE.DoubleSide, depthWrite: false,
  }), [])
  const allLineMat = useMemo(() => new THREE.LineBasicMaterial({
    color: SERIES_COLORS.total, transparent: true, opacity: 0.15,
  }), [])
  const amLineMat = useMemo(() => new THREE.LineBasicMaterial({
    color: SERIES_COLORS.morning, transparent: true, opacity: 0.25,
  }), [])
  const pmLineMat = useMemo(() => new THREE.LineBasicMaterial({
    color: SERIES_COLORS.evening, transparent: true, opacity: 0.25,
  }), [])

  useFrame(() => {
    if (!groupRef.current) return

    // Position group at Earth every frame for smooth animation
    const earthPos = getBodyPosition('Earth', simulationStore.date)
    groupRef.current.position.set(earthPos[0], earthPos[1], earthPos[2])

    // Only recompute geometry when the hour changes
    const hour = Math.round(simulationStore.date.getTime() / MS_PER_HOUR)
    if (hour === lastHourRef.current) return
    lastHourRef.current = hour

    const bodies = bodiesRef.current
    if (bodies.length < 1) {
      for (const ref of [allMeshRef, amMeshRef, pmMeshRef]) {
        ref.current.geometry.dispose()
        ref.current.geometry = emptyGeo()
      }
      for (const ref of [allEdgeRef, amEdgeRef, pmEdgeRef]) {
        ref.current.geometry.dispose()
        ref.current.geometry = emptyGeo()
      }
      return
    }

    const date = new Date(hour * MS_PER_HOUR)
    const sunLon = getGeocentricEclipticCoords('Sun', date).lon

    const allLons: number[] = []
    const morningLons: number[] = []
    const eveningLons: number[] = []

    for (const id of bodies) {
      const ecl = getGeocentricEclipticCoords(id, date)
      allLons.push(ecl.lon)
      if (wrap180(ecl.lon - sunLon) < 0) morningLons.push(ecl.lon)
      else eveningLons.push(ecl.lon)
    }

    // Update sector fills
    allMeshRef.current.geometry.dispose()
    allMeshRef.current.geometry = buildSectorGeometry(allLons, CONE_RADIUS)
    amMeshRef.current.geometry.dispose()
    amMeshRef.current.geometry = buildSectorGeometry(morningLons, CONE_RADIUS)
    pmMeshRef.current.geometry.dispose()
    pmMeshRef.current.geometry = buildSectorGeometry(eveningLons, CONE_RADIUS)

    // Update edge lines
    allEdgeRef.current.geometry.dispose()
    allEdgeRef.current.geometry = buildEdgeGeometry(allLons, CONE_RADIUS)
    amEdgeRef.current.geometry.dispose()
    amEdgeRef.current.geometry = buildEdgeGeometry(morningLons, CONE_RADIUS)
    pmEdgeRef.current.geometry.dispose()
    pmEdgeRef.current.geometry = buildEdgeGeometry(eveningLons, CONE_RADIUS)
  })

  return (
    <group ref={groupRef}>
      <mesh ref={allMeshRef} material={allMat} />
      <mesh ref={amMeshRef} material={amMat} />
      <mesh ref={pmMeshRef} material={pmMat} />
      <lineSegments ref={allEdgeRef} material={allLineMat} />
      <lineSegments ref={amEdgeRef} material={amLineMat} />
      <lineSegments ref={pmEdgeRef} material={pmLineMat} />
    </group>
  )
}
