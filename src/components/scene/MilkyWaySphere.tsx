import { useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

const OBLIQUITY_RAD = 23.4392911 * (Math.PI / 180)
const MW_SPHERE_RADIUS = 949

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D map;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(map, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * opacity);
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
export default function MilkyWaySphere() {
  const texture = useLoader(THREE.TextureLoader, `${import.meta.env.BASE_URL}starmap_4k.jpg`)

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
        opacity: { value: 0.25 },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })

    return { geometry: geo, material: mat }
  }, [texture])

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[-OBLIQUITY_RAD, 0, 0]}
      scale={[-1, 1, 1]}
    />
  )
}
