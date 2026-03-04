import { memo, useEffect, useMemo, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'
import { AtmosphereAppearance } from '../../lib/atmosphereColor'
import { PlanetariumSkyState } from './planetariumSkyState'

// Keep the atmosphere shell aligned with the visible sky dome so it does not
// appear as a separate larger cap at wide/default FoV.
const ATMOSPHERE_RADIUS = CELESTIAL_SPHERE_RADIUS * 0.965

const vertexShader = `
  varying vec3 vLocalDir;
  void main() {
    vLocalDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunCoreColor;
  uniform vec3 uSunGlowColor;
  uniform vec3 uSunDir;
  uniform float uSkyAlpha;
  uniform float uSunGlowStrength;
  varying vec3 vLocalDir;

  void main() {
    float up = clamp(vLocalDir.y, 0.0, 1.0);
    float horizon = 1.0 - up;

    vec3 base = mix(uHorizonColor, uZenithColor, pow(up, 0.58));

    float mu = clamp(dot(normalize(vLocalDir), normalize(uSunDir)), -1.0, 1.0);
    float sunAng = acos(mu);
    float sunWide = exp(-0.5 * pow(sunAng / 0.62, 2.0));
    float sunCore = exp(-0.5 * pow(sunAng / 0.16, 2.0));
    float scatter = clamp(0.78 * sunWide + 0.22 * sunCore, 0.0, 1.0);

    vec3 color = base;
    color += uSunGlowColor * scatter * (0.55 * uSunGlowStrength);
    color += uSunCoreColor * sunCore * (0.40 * uSunGlowStrength);
    color += uHorizonColor * pow(horizon, 2.3) * 0.10 * uSkyAlpha;

    float alpha = uSkyAlpha * mix(0.35, 1.0, pow(horizon, 0.65));
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
  }
`

const NO_RAYCAST: THREE.Object3D['raycast'] = () => {
  // Keep transparent atmosphere out of Html occlusion raycasts.
}

interface Props {
  appearance: AtmosphereAppearance
  sunDirectionLocal: [number, number, number]
  skyStateRef?: MutableRefObject<PlanetariumSkyState>
}

export default memo(function PlanetariumAtmosphere({
  appearance,
  sunDirectionLocal,
  skyStateRef,
}: Props) {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.SphereGeometry(
      ATMOSPHERE_RADIUS,
      96,
      48,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    )

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uZenithColor: { value: new THREE.Color().setRGB(...appearance.zenithColor) },
        uHorizonColor: { value: new THREE.Color().setRGB(...appearance.horizonColor) },
        uSunCoreColor: { value: new THREE.Color().setRGB(...appearance.sunCoreColor) },
        uSunGlowColor: { value: new THREE.Color().setRGB(...appearance.sunGlowColor) },
        uSunDir: { value: new THREE.Vector3(...sunDirectionLocal).normalize() },
        uSkyAlpha: { value: appearance.skyAlpha },
        uSunGlowStrength: { value: appearance.sunGlowStrength },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    })

    return { geometry: geo, material: mat }
  }, [])

  useEffect(() => {
    material.uniforms.uZenithColor.value.setRGB(...appearance.zenithColor)
    material.uniforms.uHorizonColor.value.setRGB(...appearance.horizonColor)
    material.uniforms.uSunCoreColor.value.setRGB(...appearance.sunCoreColor)
    material.uniforms.uSunGlowColor.value.setRGB(...appearance.sunGlowColor)
    material.uniforms.uSkyAlpha.value = appearance.skyAlpha
    material.uniforms.uSunGlowStrength.value = appearance.sunGlowStrength
  }, [appearance, material])

  useEffect(() => {
    material.uniforms.uSunDir.value.set(
      sunDirectionLocal[0],
      sunDirectionLocal[1],
      sunDirectionLocal[2],
    ).normalize()
  }, [material, sunDirectionLocal])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(() => {
    const sky = skyStateRef?.current
    if (!sky) return
    material.uniforms.uZenithColor.value.setRGB(...sky.atmosphere.zenithColor)
    material.uniforms.uHorizonColor.value.setRGB(...sky.atmosphere.horizonColor)
    material.uniforms.uSunCoreColor.value.setRGB(...sky.atmosphere.sunCoreColor)
    material.uniforms.uSunGlowColor.value.setRGB(...sky.atmosphere.sunGlowColor)
    material.uniforms.uSkyAlpha.value = sky.atmosphere.skyAlpha
    material.uniforms.uSunGlowStrength.value = sky.atmosphere.sunGlowStrength
    material.uniforms.uSunDir.value.set(
      sky.sunDirection[0],
      sky.sunDirection[1],
      sky.sunDirection[2],
    ).normalize()
  })

  return <mesh geometry={geometry} material={material} renderOrder={-20} raycast={NO_RAYCAST} />
})
