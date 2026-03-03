import { useMemo, memo, useEffect } from 'react'
import * as THREE from 'three'
import { STAR_CATALOG } from '../../data/starCatalog'
import { raDecToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

// Approximate B-V color index for each spectral class (main sequence averages)
const SPECTRAL_BV: Record<string, number> = {
  O: -0.33, B: -0.17, A: 0.0, F: 0.42, G: 0.65, K: 1.15, M: 1.60,
}

/**
 * Convert B-V color index to RGB using Planck blackbody approximation.
 * B-V → effective temperature → sRGB via CIE chromaticity.
 * Based on Ballesteros (2012) formula for T_eff and Hernandez-Andres (2001)
 * correlated color temperature to chromaticity conversion.
 */
function bvToRgb(bv: number): [number, number, number] {
  // Clamp B-V to valid range
  bv = Math.max(-0.4, Math.min(2.0, bv))

  // Ballesteros (2012): T = 4600 * (1/(0.92*BV + 1.7) + 1/(0.92*BV + 0.62))
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))

  // Approximate sRGB from color temperature using polynomial fit
  // (Tanner Helland / CIE-based approximation, widely used in open-source)
  let r: number, g: number, b: number
  const temp = t / 100

  // Red channel
  if (temp <= 66) {
    r = 1.0
  } else {
    r = 1.292936 * Math.pow(temp - 60, -0.1332047592)
  }

  // Green channel
  if (temp <= 66) {
    g = 0.3900815 * Math.log(temp) - 0.6318414
  } else {
    g = 1.129891 * Math.pow(temp - 60, -0.0755148492)
  }

  // Blue channel
  if (temp >= 66) {
    b = 1.0
  } else if (temp <= 19) {
    b = 0.0
  } else {
    b = 0.5432068 * Math.log(temp - 10) - 1.19625408
  }

  return [
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b)),
  ]
}

// Vertex shader: pass size and color to fragment stage
const vertexShader = `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uSizeScale;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uSizeScale;
    gl_Position = projectionMatrix * mvPos;
  }
`

// Fragment shader: bright core with soft halo (standard point-sprite technique)
// uHaloBoost controls the halo brightness (default 0.06, planetarium uses higher)
const fragmentShader = `
  uniform float uHaloBoost;
  varying vec3 vColor;
  void main() {
    float dist = 2.0 * distance(gl_PointCoord, vec2(0.5));
    // Sharp bright core
    float core = smoothstep(0.6, 0.2, dist);
    // Soft halo falloff
    float halo = smoothstep(1.0, 0.0, dist) * uHaloBoost;
    float k = clamp(core + halo, 0.0, 1.0);
    if (k < 0.002) discard;
    gl_FragColor = vec4(vColor, k);
  }
`

// Shared geometry — positions and colors never change, computed once
let sharedGeo: THREE.BufferGeometry | null = null
function getSharedGeometry() {
  if (sharedGeo) return sharedGeo

  const count = STAR_CATALOG.length
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const star = STAR_CATALOG[i]
    const [x, y, z] = raDecToSceneSphere(star.ra, star.dec, CELESTIAL_SPHERE_RADIUS)
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z

    // Magnitude → point size in pixels.
    // Range: Sirius (mag -1.46) → ~5px, faintest (mag ~4.5) → ~1px
    sizes[i] = Math.max(1.0, Math.min(5.0, 3.0 - star.mag * 0.5))

    const bv = SPECTRAL_BV[star.spectral] ?? 0.0
    const [r, g, b] = bvToRgb(bv)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  sharedGeo = geo
  return geo
}

interface Props {
  brightness?: number // 1.0 = default, >1 = brighter (larger points + stronger halo)
}

export default memo(function RealStars({ brightness = 1.0 }: Props) {
  const { geometry, material } = useMemo(() => {
    const geo = getSharedGeometry()

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSizeScale: { value: brightness },
        uHaloBoost: { value: 0.06 * brightness },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [brightness])

  // Update uniforms if brightness changes after mount
  useEffect(() => {
    material.uniforms.uSizeScale.value = brightness
    material.uniforms.uHaloBoost.value = 0.06 * brightness
  }, [brightness, material])

  return <points geometry={geometry} material={material} />
})
