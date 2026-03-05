import { useMemo, memo, useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useLoader, useFrame } from '@react-three/fiber'
import { PlanetariumSkyState } from './planetariumSkyState'

const OBLIQUITY_RAD = 23.4392911 * (Math.PI / 180)
const MW_SPHERE_RADIUS = 949

// Stable prop references to avoid re-creating tuples every render
const MW_ROTATION: [number, number, number] = [-OBLIQUITY_RAD, 0, 0]
const MW_SCALE: [number, number, number] = [-1, 1, 1]

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldDir;
  void main() {
    vUv = uv;
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldDir = normalize(worldPos);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D map;
  uniform float opacity;
  uniform vec3 sunDirWorld;
  uniform vec3 moonDirWorld;
  uniform float twilightWash;
  uniform float moonWash;
  varying vec2 vUv;
  varying vec3 vWorldDir;
  void main() {
    vec4 tex = texture2D(map, vUv);

    float localVisibility = 1.0;

    if (twilightWash > 0.0001) {
      float sunDot = clamp(dot(normalize(vWorldDir), normalize(sunDirWorld)), -1.0, 1.0);
      float sunAng = acos(sunDot);
      float sunWide = exp(-0.5 * pow(sunAng / 0.85, 2.0));
      float sunCore = exp(-0.5 * pow(sunAng / 0.22, 2.0));
      float sunScatter = clamp(0.65 * sunWide + 0.35 * sunCore, 0.0, 1.0);
      localVisibility -= 0.85 * twilightWash * sunScatter;
    }

    if (moonWash > 0.0001) {
      float moonDot = clamp(dot(normalize(vWorldDir), normalize(moonDirWorld)), -1.0, 1.0);
      float moonAng = acos(moonDot);
      float moonKernel = exp(-0.5 * pow(moonAng / 0.33, 2.0));
      localVisibility -= 0.75 * moonWash * moonKernel;
    }

    localVisibility = clamp(localVisibility, 0.05, 1.0);
    gl_FragColor = vec4(tex.rgb * localVisibility, tex.a * opacity * localVisibility);
  }
`

/**
 * Renders the NASA Deep Star Maps 2020 (Gaia DR2, 1.7 billion stars) as a
 * background skybox sphere. The texture is an equirectangular projection in
 * J2000 equatorial coordinates (ICRF), centered at RA=0h.
 *
 * Uses a custom ShaderMaterial to bypass Three.js color management and tone
 * mapping — the NASA JPEG is already properly tonemapped for display.
 *
 * Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio.
 * Data: Gaia DR2 (ESA/Gaia/DPAC).
 */
interface Props {
  visibility?: number
  baseOpacity?: number
  sunDirectionLocal?: [number, number, number]
  moonDirectionLocal?: [number, number, number]
  twilightWash?: number
  moonWash?: number
  skyStateRef?: MutableRefObject<PlanetariumSkyState>
}

const NO_RAYCAST: THREE.Object3D['raycast'] = () => {
  // Prevent transparent Milky Way mesh from occluding Html labels.
}

const _localSun = new THREE.Vector3()
const _localMoon = new THREE.Vector3()
const _worldSun = new THREE.Vector3()
const _worldMoon = new THREE.Vector3()

export default memo(function MilkyWaySphere({
  visibility = 1,
  baseOpacity = 0.25,
  sunDirectionLocal = [0, 1, 0],
  moonDirectionLocal = [0, 1, 0],
  twilightWash = 0,
  moonWash = 0,
  skyStateRef,
}: Props) {
  const texture = useLoader(THREE.TextureLoader, `${import.meta.env.BASE_URL}starmap_4k.jpg`)
  const meshRef = useRef<THREE.Mesh>(null)

  const { geometry, material } = useMemo(() => {
    // Don't set colorSpace — we want raw sRGB bytes passed through as-is
    // phiStart=π rotates the geometry seam to RA=12h, aligning uv.x=0.5
    // with the +X scene direction (RA=0h) after the scale=[-1,1,1] flip.
    const geo = new THREE.SphereGeometry(MW_SPHERE_RADIUS, 64, 32, Math.PI)

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        map: { value: texture },
        opacity: { value: baseOpacity },
        sunDirWorld: { value: new THREE.Vector3(0, 1, 0) },
        moonDirWorld: { value: new THREE.Vector3(0, 1, 0) },
        twilightWash: { value: 0 },
        moonWash: { value: 0 },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })

    return { geometry: geo, material: mat }
  }, [texture, baseOpacity])

  useEffect(() => {
    material.uniforms.opacity.value = baseOpacity * visibility
  }, [material, baseOpacity, visibility])

  useEffect(() => {
    material.uniforms.twilightWash.value = twilightWash
  }, [material, twilightWash])

  useEffect(() => {
    material.uniforms.moonWash.value = moonWash
  }, [material, moonWash])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const viewGroup = mesh.parent?.parent
    if (!viewGroup) return

    const sky = skyStateRef?.current
    const activeSun = sky?.sunDirection ?? sunDirectionLocal
    const activeMoon = sky?.moonDirection ?? moonDirectionLocal
    const activeTwilightWash = sky?.twilightWash ?? twilightWash
    const activeMoonWash = sky?.moonWash ?? moonWash
    const activeVisibility = sky?.milkyWayVisibility ?? visibility

    material.uniforms.opacity.value = baseOpacity * activeVisibility
    material.uniforms.twilightWash.value = activeTwilightWash
    material.uniforms.moonWash.value = activeMoonWash

    _localSun.set(activeSun[0], activeSun[1], activeSun[2]).normalize()
    _localMoon.set(activeMoon[0], activeMoon[1], activeMoon[2]).normalize()

    _worldSun.copy(_localSun).transformDirection(viewGroup.matrixWorld).normalize()
    _worldMoon.copy(_localMoon).transformDirection(viewGroup.matrixWorld).normalize()

    material.uniforms.sunDirWorld.value.copy(_worldSun)
    material.uniforms.moonDirWorld.value.copy(_worldMoon)
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      renderOrder={-50}
      rotation={MW_ROTATION}
      scale={MW_SCALE}
      raycast={NO_RAYCAST}
    />
  )
})
