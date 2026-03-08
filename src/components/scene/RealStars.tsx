import { useMemo, memo, useEffect, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STAR_CATALOG } from '../../data/starCatalog'
import { raDecToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'
import { DEFAULT_EXTINCTION_COEFF } from '../../lib/starVisibility'
import { magnitudeToSpriteSize, spectralClassToRgb, type StarRenderMode } from '../../lib/starAppearance'
import { PlanetariumSkyState } from './planetariumSkyState'

// Vertex shader: pass size and color to fragment stage
const vertexShader = `
  attribute float aSize;
  attribute float aMag;
  attribute vec3 aColor;
  uniform float uSizeScale;
  uniform float uExtinctionCoeff;
  varying vec3 vColor;
  varying vec3 vWorldDir;
  varying float vEffMag;
  void main() {
    vColor = aColor;
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldDir = normalize(worldPos);
    float cosZ = clamp(vWorldDir.y, -1.0, 1.0);
    float X = cosZ <= 0.0 ? 40.0 : 1.0 / (cosZ + 0.025 * exp(-11.0 * cosZ));
    float deltaMag = uExtinctionCoeff * X;
    vEffMag = aMag + deltaMag;
    float sizeAtten = clamp(pow(10.0, -0.18 * deltaMag), 0.32, 1.0);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uSizeScale * sizeAtten;
    gl_Position = projectionMatrix * mvPos;
  }
`

// Fragment shader: bright core with soft halo (standard point-sprite technique)
// uHaloBoost controls the halo brightness (default 0.06, planetarium uses higher)
const fragmentShader = `
  uniform float uHaloBoost;
  uniform float uVisibility;
  uniform float uVisibilityScale;
  uniform float uTwilightWash;
  uniform float uMoonWash;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  varying vec3 vColor;
  varying vec3 vWorldDir;
  varying float vEffMag;
  void main() {
    float dist = 2.0 * distance(gl_PointCoord, vec2(0.5));
    // Sharp bright core
    float core = smoothstep(0.6, 0.2, dist);
    // Soft halo falloff
    float halo = smoothstep(1.0, 0.0, dist) * uHaloBoost;
    float k = clamp(core + halo, 0.0, 1.0);
    if (k < 0.002) discard;

    float faintness = clamp((vEffMag + 2.0) / 8.0, 0.0, 1.0);
    float localVisibility = 1.0;

    if (uTwilightWash > 0.001) {
      float sunDot = clamp(dot(normalize(vWorldDir), normalize(uSunDir)), -1.0, 1.0);
      float sunAng = acos(sunDot);
      float sunKernel = exp(-0.5 * pow(sunAng / 0.45, 2.0));
      localVisibility *= 1.0 - 0.58 * uTwilightWash * (0.35 + 0.65 * faintness) * sunKernel;
    }

    if (uMoonWash > 0.001) {
      float moonDot = clamp(dot(normalize(vWorldDir), normalize(uMoonDir)), -1.0, 1.0);
      float moonAng = acos(moonDot);
      float moonKernel = exp(-0.5 * pow(moonAng / 0.34, 2.0));
      localVisibility *= 1.0 - 0.40 * uMoonWash * (0.25 + 0.75 * faintness) * moonKernel;
    }

    localVisibility = clamp(localVisibility, 0.15, 1.0);
    float visibility = clamp(uVisibility * uVisibilityScale * localVisibility, 0.0, 1.0);
    float limMag = mix(-1.0, 6.5, visibility);
    float magContrast = 1.0 - smoothstep(limMag - 0.7, limMag + 0.5, vEffMag);

    gl_FragColor = vec4(vColor, k * visibility * magContrast);
  }
`

// Shared geometry cache keyed by spread factor; positions/colors stay static.
const sharedGeometryBySpread = new Map<number, THREE.BufferGeometry>()
function getSharedGeometry(magnitudeSpread = 1) {
  const spreadKey = Math.round(magnitudeSpread * 100) / 100
  const cached = sharedGeometryBySpread.get(spreadKey)
  if (cached) return cached

  const count = STAR_CATALOG.length
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const mags = new Float32Array(count)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const star = STAR_CATALOG[i]
    const [x, y, z] = raDecToSceneSphere(star.ra, star.dec, CELESTIAL_SPHERE_RADIUS)
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z

    sizes[i] = magnitudeToSpriteSize(star.mag, spreadKey)
    mags[i] = star.mag

    const [r, g, b] = spectralClassToRgb(star.spectral)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aMag', new THREE.BufferAttribute(mags, 1))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  if (sharedGeometryBySpread.size > 8) {
    sharedGeometryBySpread.clear()
  }
  sharedGeometryBySpread.set(spreadKey, geo)
  return geo
}

interface Props {
  mode?: StarRenderMode
  brightness?: number // 1.0 = default, >1 = brighter (larger points + stronger halo)
  magnitudeSpread?: number // 1.0 = default bright-vs-faint size spread
  visibility?: number // 0 = fully washed out, 1 = dark-sky visibility
  visibilityScale?: number // multiplier for atmospheric visibility (Planetarium parity tuning)
  twilightWash?: number
  moonWash?: number
  sunDirection?: [number, number, number]
  moonDirection?: [number, number, number]
  extinctionCoeff?: number
  skyStateRef?: MutableRefObject<PlanetariumSkyState>
}

export default memo(function RealStars({
  mode = 'atmospheric',
  brightness = 1.0,
  magnitudeSpread = 1.0,
  visibility = 1,
  visibilityScale = 1,
  twilightWash = 0,
  moonWash = 0,
  sunDirection = [0, 1, 0],
  moonDirection = [0, 1, 0],
  extinctionCoeff = DEFAULT_EXTINCTION_COEFF,
  skyStateRef,
}: Props) {
  const isSpaceMode = mode === 'space'

  const { geometry, material } = useMemo(() => {
    const geo = getSharedGeometry(magnitudeSpread)

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSizeScale: { value: brightness },
        uHaloBoost: { value: 0.06 * brightness },
        uVisibility: { value: isSpaceMode ? 1 : visibility },
        uVisibilityScale: { value: isSpaceMode ? 1 : visibilityScale },
        uTwilightWash: { value: isSpaceMode ? 0 : twilightWash },
        uMoonWash: { value: isSpaceMode ? 0 : moonWash },
        uSunDir: { value: new THREE.Vector3(...sunDirection).normalize() },
        uMoonDir: { value: new THREE.Vector3(...moonDirection).normalize() },
        uExtinctionCoeff: { value: isSpaceMode ? 0 : extinctionCoeff },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [brightness, isSpaceMode, magnitudeSpread])

  // Update uniforms if brightness changes after mount
  useEffect(() => {
    material.uniforms.uSizeScale.value = brightness
    material.uniforms.uHaloBoost.value = 0.06 * brightness
  }, [brightness, material])

  useEffect(() => {
    material.uniforms.uVisibility.value = isSpaceMode ? 1 : visibility
  }, [isSpaceMode, material, visibility])

  useEffect(() => {
    material.uniforms.uVisibilityScale.value = isSpaceMode ? 1 : visibilityScale
  }, [isSpaceMode, material, visibilityScale])

  useEffect(() => {
    material.uniforms.uTwilightWash.value = isSpaceMode ? 0 : twilightWash
  }, [isSpaceMode, material, twilightWash])

  useEffect(() => {
    material.uniforms.uMoonWash.value = isSpaceMode ? 0 : moonWash
  }, [isSpaceMode, material, moonWash])

  useEffect(() => {
    material.uniforms.uSunDir.value.set(sunDirection[0], sunDirection[1], sunDirection[2]).normalize()
  }, [material, sunDirection])

  useEffect(() => {
    material.uniforms.uMoonDir.value.set(moonDirection[0], moonDirection[1], moonDirection[2]).normalize()
  }, [material, moonDirection])

  useEffect(() => {
    material.uniforms.uExtinctionCoeff.value = isSpaceMode ? 0 : extinctionCoeff
  }, [extinctionCoeff, isSpaceMode, material])

  useFrame(() => {
    if (isSpaceMode) return
    const sky = skyStateRef?.current
    if (!sky) return
    material.uniforms.uVisibility.value = sky.starVisibility
    material.uniforms.uTwilightWash.value = sky.twilightWash
    material.uniforms.uMoonWash.value = sky.moonWash
    material.uniforms.uSunDir.value.set(
      sky.sunDirection[0],
      sky.sunDirection[1],
      sky.sunDirection[2],
    ).normalize()
    material.uniforms.uMoonDir.value.set(
      sky.moonDirection[0],
      sky.moonDirection[1],
      sky.moonDirection[2],
    ).normalize()
    material.uniforms.uExtinctionCoeff.value = sky.starExtinctionCoeff
  })

  return <points geometry={geometry} material={material} renderOrder={20} />
})
