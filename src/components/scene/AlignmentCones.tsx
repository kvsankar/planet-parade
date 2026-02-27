import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AlignmentKind } from '../../types'
import { SERIES_COLORS } from '../../constants'
import { computeSpanArc, BestPerKind, BestCombination } from '../../lib/alignment'
import { getBodyPosition } from '../../lib/astronomy'
import { simulationStore } from '../../hooks/useSimulationStore'

const CONE_RADIUS = 500 // scene units — extends well past outer planets

interface Props {
  bestPerKind: BestPerKind
  visibleSeries?: Set<AlignmentKind>
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

const EMPTY_GEO = new THREE.BufferGeometry()
EMPTY_GEO.setAttribute('position', new THREE.Float32BufferAttribute([], 3))

/** Dispose geometry only if it's not the shared empty instance */
function disposeIfNotEmpty(geo: THREE.BufferGeometry) {
  if (geo !== EMPTY_GEO) geo.dispose()
}

function buildGeoForCombo(best: BestCombination | null): { sector: THREE.BufferGeometry; edge: THREE.BufferGeometry } {
  if (!best || best.longitudes.length < 2) {
    return { sector: EMPTY_GEO, edge: EMPTY_GEO }
  }
  return {
    sector: buildSectorGeometry(best.longitudes, CONE_RADIUS),
    edge: buildEdgeGeometry(best.longitudes, CONE_RADIUS),
  }
}

const DEFAULT_VISIBLE = new Set<AlignmentKind>(['morning', 'evening', 'straddling'])

export default function AlignmentCones({ bestPerKind, visibleSeries = DEFAULT_VISIBLE }: Props) {
  const groupRef = useRef<THREE.Group>(null!)
  const straddlingMeshRef = useRef<THREE.Mesh>(null!)
  const amMeshRef = useRef<THREE.Mesh>(null!)
  const pmMeshRef = useRef<THREE.Mesh>(null!)
  const straddlingEdgeRef = useRef<THREE.LineSegments>(null!)
  const amEdgeRef = useRef<THREE.LineSegments>(null!)
  const pmEdgeRef = useRef<THREE.LineSegments>(null!)

  // Rebuild geometry when bestPerKind changes
  const bestRef = useRef(bestPerKind)
  bestRef.current = bestPerKind

  useEffect(() => {
    const refs = [
      { mesh: straddlingMeshRef, edge: straddlingEdgeRef, kind: 'straddling' as AlignmentKind },
      { mesh: amMeshRef, edge: amEdgeRef, kind: 'morning' as AlignmentKind },
      { mesh: pmMeshRef, edge: pmEdgeRef, kind: 'evening' as AlignmentKind },
    ]
    for (const { mesh, edge, kind } of refs) {
      disposeIfNotEmpty(mesh.current.geometry)
      disposeIfNotEmpty(edge.current.geometry)
      const geo = buildGeoForCombo(bestPerKind[kind])
      mesh.current.geometry = geo.sector
      edge.current.geometry = geo.edge
    }
  }, [bestPerKind])

  const straddlingMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: SERIES_COLORS.straddling, transparent: true, opacity: 0.06,
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
  const straddlingLineMat = useMemo(() => new THREE.LineBasicMaterial({
    color: SERIES_COLORS.straddling, transparent: true, opacity: 0.15,
  }), [])
  const amLineMat = useMemo(() => new THREE.LineBasicMaterial({
    color: SERIES_COLORS.morning, transparent: true, opacity: 0.25,
  }), [])
  const pmLineMat = useMemo(() => new THREE.LineBasicMaterial({
    color: SERIES_COLORS.evening, transparent: true, opacity: 0.25,
  }), [])

  // Position group at Earth every frame for smooth animation
  useFrame(() => {
    if (!groupRef.current) return
    const earthPos = getBodyPosition('Earth', simulationStore.date)
    groupRef.current.position.set(earthPos[0], earthPos[1], earthPos[2])
  })

  return (
    <group ref={groupRef}>
      <mesh ref={straddlingMeshRef} material={straddlingMat} visible={visibleSeries.has('straddling')} />
      <mesh ref={amMeshRef} material={amMat} visible={visibleSeries.has('morning')} />
      <mesh ref={pmMeshRef} material={pmMat} visible={visibleSeries.has('evening')} />
      <lineSegments ref={straddlingEdgeRef} material={straddlingLineMat} visible={visibleSeries.has('straddling')} />
      <lineSegments ref={amEdgeRef} material={amLineMat} visible={visibleSeries.has('morning')} />
      <lineSegments ref={pmEdgeRef} material={pmLineMat} visible={visibleSeries.has('evening')} />
    </group>
  )
}
