import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { ObserverLocation } from '../../types'
import { simulationStore } from '../../hooks/useSimulationStore'
import { getAltAz, getBodyVisualMagnitude, getMoonIllumination, isMoonWaxing, SKY_BODIES, SkyBodyId } from '../../lib/astronomy'
import { altAzToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'
import { getMoonGlowVisuals } from '../../lib/moonGlow'
import { getAtmosphereAppearance } from '../../lib/atmosphereColor'
import { getNightSkyVisibility } from '../../lib/skyVisibility'
import { DEFAULT_EXTINCTION_COEFF, effectiveStarMagnitude, limitingMagnitudeFromSkyVisibility, starContrastFactor } from '../../lib/starVisibility'
import { BODY_META } from '../../constants'
import { magnitudeToPlanetMarkerScale } from '../../lib/starAppearance'

const PLANET_RADIUS = CELESTIAL_SPHERE_RADIUS * 0.98
const ABOVE_HORIZON_EPS_DEG = -0.1
const MOON_SPRITE_SIZE = 34
const SUN_GLOW_SIZE = 980
const MOON_GLOW_SIZE = 760
const MAG_CACHE_STEP_MS = 60_000

const BODY_SIZE: Partial<Record<SkyBodyId, number>> = {
  Sun: 20,
  Moon: 14,
  Venus: 10,
  Jupiter: 10,
  Mars: 8,
  Saturn: 9,
  Mercury: 7,
  Uranus: 6,
  Neptune: 6,
}

interface Props {
  observer: ObserverLocation
  showLabels?: boolean
  showMoon?: boolean
  showAtmosphere?: boolean
  magnitudeSpreadFactor?: number
}

function moonPhasePath(r: number, illumination: number, litToRight: boolean): string {
  const k = 2 * illumination - 1
  const rx = Math.max(0.001, Math.abs(k) * r)
  const semiSweep = litToRight ? 1 : 0
  const termSweep = litToRight ? (k >= 0 ? 1 : 0) : (k >= 0 ? 0 : 1)
  return `M 0 ${-r} A ${r} ${r} 0 0 ${semiSweep} 0 ${r} A ${rx} ${r} 0 0 ${termSweep} 0 ${-r} Z`
}

function drawMoonPhase(
  canvas: HTMLCanvasElement,
  illumination: number,
  litToRight: boolean,
  limbAngleRad: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const size = canvas.width
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.42

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(cx, cy)

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1a2e'
  ctx.fill()

  ctx.save()
  ctx.rotate(limbAngleRad)

  if (typeof Path2D !== 'undefined') {
    const lit = new Path2D(moonPhasePath(r, illumination, litToRight))
    ctx.fillStyle = '#c8c8c8'
    ctx.fill(lit)
  } else {
    // Fallback for environments without Path2D support.
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(200,200,200,${Math.max(0.18, illumination)})`
    ctx.fill()
  }
  ctx.restore()

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(200,200,200,0.55)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()
}

function createRadialGlowTexture(size: number, inner: string, mid: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const c = size / 2
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
    grad.addColorStop(0, inner)
    grad.addColorStop(0.35, mid)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export default function PlanetariumPlanets({
  observer,
  showLabels = true,
  showMoon = true,
  showAtmosphere = true,
  magnitudeSpreadFactor = 1,
}: Props) {
  const { camera } = useThree()
  const bodyGroupRefs = useRef<Map<SkyBodyId, THREE.Group>>(new Map())
  const bodyVisualRefs = useRef<Map<SkyBodyId, THREE.Object3D>>(new Map())
  const labelElementRefs = useRef<Map<SkyBodyId, HTMLDivElement>>(new Map())
  const sunGlowRef = useRef<THREE.Sprite>(null)
  const moonGlowRef = useRef<THREE.Sprite>(null)
  const moonPhaseSignatureRef = useRef('')
  const sunWorldRef = useRef(new THREE.Vector3())
  const moonWorldRef = useRef(new THREE.Vector3())
  const sunNdcRef = useRef(new THREE.Vector3())
  const moonNdcRef = useRef(new THREE.Vector3())
  const magnitudeCacheRef = useRef<{
    step: number
    values: Partial<Record<SkyBodyId, number | null>>
  }>({ step: -1, values: {} })

  const planetMaterials = useMemo(() => {
    const mats = new Map<SkyBodyId, THREE.MeshBasicMaterial>()
    for (const bodyId of SKY_BODIES) {
      if (bodyId === 'Moon') continue
      const color = BODY_META[bodyId as keyof typeof BODY_META]?.color ?? '#ffffff'
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      })
      mats.set(bodyId, mat)
    }
    return mats
  }, [])

  const { moonMaterial, moonTexture, sunGlowMaterial, moonGlowMaterial } = useMemo(() => {
    const moonCanvas = document.createElement('canvas')
    moonCanvas.width = 128
    moonCanvas.height = 128
    drawMoonPhase(moonCanvas, 0.5, true, 0)
    const texture = new THREE.CanvasTexture(moonCanvas)
    texture.needsUpdate = true

    const moonMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    })

    const sunGlowMap = createRadialGlowTexture(256, 'rgba(255, 255, 255, 0.30)', 'rgba(255, 255, 255, 0.12)')
    const moonGlowMap = createRadialGlowTexture(256, 'rgba(180, 200, 230, 1.0)', 'rgba(180, 200, 230, 0.45)')

    const sunGlowMat = new THREE.SpriteMaterial({
      map: sunGlowMap,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })

    const moonGlowMat = new THREE.SpriteMaterial({
      map: moonGlowMap,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      opacity: 0,
      toneMapped: false,
    })

    return {
      moonMaterial: moonMat,
      moonTexture: texture,
      sunGlowMaterial: sunGlowMat,
      moonGlowMaterial: moonGlowMat,
    }
  }, [])

  useEffect(() => {
    return () => {
      planetMaterials.forEach((mat) => mat.dispose())
      moonMaterial.map?.dispose()
      moonMaterial.dispose()
      sunGlowMaterial.map?.dispose()
      sunGlowMaterial.dispose()
      moonGlowMaterial.map?.dispose()
      moonGlowMaterial.dispose()
    }
  }, [planetMaterials, moonMaterial, sunGlowMaterial, moonGlowMaterial])

  useFrame(() => {
    const date = simulationStore.date
    const bodyDirections = new Map<SkyBodyId, THREE.Vector3>()
    const bodyAltitudes = new Map<SkyBodyId, number>()
    let sunAlt = -90
    let moonAlt = -90
    let sunPos: [number, number, number] | null = null
    let moonPos: [number, number, number] | null = null

    for (const bodyId of SKY_BODIES) {
      const altAz = getAltAz(bodyId, date, observer)
      const pos = altAzToSceneSphere(altAz.altitude, altAz.azimuth, PLANET_RADIUS)
      const isAboveHorizon = altAz.altitude >= ABOVE_HORIZON_EPS_DEG
      bodyDirections.set(bodyId, new THREE.Vector3(pos[0], pos[1], pos[2]).normalize())
      bodyAltitudes.set(bodyId, altAz.altitude)

      if (bodyId === 'Sun') {
        sunAlt = altAz.altitude
        sunPos = pos
      } else if (bodyId === 'Moon') {
        moonAlt = altAz.altitude
        moonPos = pos
      }

      const group = bodyGroupRefs.current.get(bodyId)
      const bodyVisible = isAboveHorizon && (bodyId !== 'Moon' || showMoon)
      if (group) {
        group.position.set(pos[0], pos[1], pos[2])
        group.visible = bodyVisible
      }
      const labelEl = labelElementRefs.current.get(bodyId)
      if (labelEl) {
        labelEl.style.display = showLabels && bodyVisible ? 'block' : 'none'
      }
    }

    const moonIllumination = getMoonIllumination(date)
    const moonWaxing = isMoonWaxing(date)
    let moonLimbAngleRad = 0
    let moonLitToRight = moonWaxing

    const sunGroup = bodyGroupRefs.current.get('Sun')
    const moonGroup = bodyGroupRefs.current.get('Moon')
    if (sunGroup && moonGroup) {
      sunGroup.getWorldPosition(sunWorldRef.current)
      moonGroup.getWorldPosition(moonWorldRef.current)
      sunNdcRef.current.copy(sunWorldRef.current).project(camera)
      moonNdcRef.current.copy(moonWorldRef.current).project(camera)

      const dx = sunNdcRef.current.x - moonNdcRef.current.x
      const dy = -(sunNdcRef.current.y - moonNdcRef.current.y) // y-down screen convention
      if (dx * dx + dy * dy > 1e-10) {
        moonLimbAngleRad = Math.atan2(dy, dx)
        moonLitToRight = true
      }
    }

    const phaseSig = `${moonIllumination.toFixed(3)}|${moonLitToRight ? 1 : 0}|${(moonLimbAngleRad * 180 / Math.PI).toFixed(1)}`
    if (phaseSig !== moonPhaseSignatureRef.current) {
      moonPhaseSignatureRef.current = phaseSig
      const image = moonTexture.image as HTMLCanvasElement
      drawMoonPhase(image, moonIllumination, moonLitToRight, moonLimbAngleRad)
      moonTexture.needsUpdate = true
    }

    const moonMagnitude = getBodyVisualMagnitude('Moon', date)
    const moonGlow = getMoonGlowVisuals({
      moonIllumination,
      moonAltitudeDeg: moonAlt,
      moonMagnitude,
    })
    const skyVisibility = getNightSkyVisibility({
      sunAltitudeDeg: sunAlt,
      moonGlowStrength: moonGlow.strength,
      includeSunlight: showAtmosphere,
      includeMoonlight: showAtmosphere && showMoon,
    })
    const atmosphere = getAtmosphereAppearance({
      sunAltitudeDeg: sunAlt,
      moonWash: skyVisibility.moonWash,
      enabled: showAtmosphere,
    })

    const magStep = Math.floor(date.getTime() / MAG_CACHE_STEP_MS)
    if (magnitudeCacheRef.current.step !== magStep) {
      const values: Partial<Record<SkyBodyId, number | null>> = {}
      for (const bodyId of SKY_BODIES) {
        values[bodyId] = getBodyVisualMagnitude(bodyId, date)
      }
      magnitudeCacheRef.current = { step: magStep, values }
    }
    const cachedMagnitudes = magnitudeCacheRef.current.values
    const limitingMag = limitingMagnitudeFromSkyVisibility(skyVisibility.starVisibility)
    const sunDir = bodyDirections.get('Sun') ?? null
    const moonDir = bodyDirections.get('Moon') ?? null

    for (const bodyId of SKY_BODIES) {
      const visual = bodyVisualRefs.current.get(bodyId)
      if (visual) {
        let sizeScale = 1
        if (bodyId !== 'Sun' && bodyId !== 'Moon') {
          const rawMagForSize = cachedMagnitudes[bodyId]
          if (rawMagForSize != null) {
            const altitudeForSize = bodyAltitudes.get(bodyId) ?? -90
            const effMagForSize = showAtmosphere
              ? effectiveStarMagnitude(rawMagForSize, altitudeForSize, DEFAULT_EXTINCTION_COEFF)
              : rawMagForSize
            sizeScale = magnitudeToPlanetMarkerScale(effMagForSize, magnitudeSpreadFactor)
          }
        }
        visual.scale.set(sizeScale, sizeScale, sizeScale)
      }

      if (bodyId === 'Moon') continue
      const mat = planetMaterials.get(bodyId)
      if (!mat) continue

      if (bodyId === 'Sun' || !showAtmosphere) {
        mat.opacity = 1
        continue
      }

      const altitude = bodyAltitudes.get(bodyId) ?? -90
      const dir = bodyDirections.get(bodyId)
      const rawMag = cachedMagnitudes[bodyId]
      if (!dir || rawMag == null || altitude <= ABOVE_HORIZON_EPS_DEG) {
        mat.opacity = 1
        continue
      }

      const effMag = effectiveStarMagnitude(rawMag, altitude, DEFAULT_EXTINCTION_COEFF)
      const contrast = starContrastFactor(effMag, limitingMag)
      const faintness = clamp((effMag + 2) / 8, 0, 1)
      let localVisibility = 1

      if (sunDir && skyVisibility.twilightWash > 0.001) {
        const sunDot = clamp(dir.dot(sunDir), -1, 1)
        const sunAng = Math.acos(sunDot)
        const sunKernel = Math.exp(-0.5 * (sunAng / 0.45) ** 2)
        localVisibility *= 1 - 0.58 * skyVisibility.twilightWash * (0.35 + 0.65 * faintness) * sunKernel
      }

      if (moonDir && skyVisibility.moonWash > 0.001) {
        const moonDot = clamp(dir.dot(moonDir), -1, 1)
        const moonAng = Math.acos(moonDot)
        const moonKernel = Math.exp(-0.5 * (moonAng / 0.34) ** 2)
        localVisibility *= 1 - 0.40 * skyVisibility.moonWash * (0.25 + 0.75 * faintness) * moonKernel
      }

      localVisibility = clamp(localVisibility, 0.15, 1)
      mat.opacity = clamp(0.2 + 0.8 * contrast * localVisibility, 0.08, 1)
    }

    if (sunGlowRef.current) {
      const visible = showAtmosphere
        && atmosphere.sunGlowStrength > 0.001
        && sunPos != null
        && sunAlt >= ABOVE_HORIZON_EPS_DEG
      sunGlowRef.current.visible = visible
      if (visible && sunPos) {
        sunGlowRef.current.position.set(sunPos[0], sunPos[1], sunPos[2])
        sunGlowRef.current.scale.set(SUN_GLOW_SIZE, SUN_GLOW_SIZE, 1)
        sunGlowMaterial.color.setRGB(...atmosphere.sunGlowColor)
        sunGlowMaterial.opacity = 0.24 * atmosphere.sunGlowStrength
      } else {
        sunGlowMaterial.opacity = 0
      }
    }

    if (moonGlowRef.current) {
      const visible = showAtmosphere
        && showMoon
        && moonGlow.opacity > 0.001
        && moonPos != null
        && moonAlt >= ABOVE_HORIZON_EPS_DEG
      moonGlowRef.current.visible = visible
      if (visible && moonPos) {
        moonGlowRef.current.position.set(moonPos[0], moonPos[1], moonPos[2])
        const glowSize = MOON_GLOW_SIZE * moonGlow.radiusScale
        moonGlowRef.current.scale.set(glowSize, glowSize, 1)
        moonGlowMaterial.opacity = moonGlow.opacity
      } else {
        moonGlowMaterial.opacity = 0
      }
    }
  })

  return (
    <group>
      <sprite ref={sunGlowRef} material={sunGlowMaterial} renderOrder={2} />
      <sprite ref={moonGlowRef} material={moonGlowMaterial} renderOrder={3} />

      {SKY_BODIES.map((bodyId) => {
        const size = BODY_SIZE[bodyId] ?? 5
        const labelColor = BODY_META[bodyId as keyof typeof BODY_META]?.color ?? '#ffffff'
        const isMoon = bodyId === 'Moon'
        const mat = isMoon ? undefined : planetMaterials.get(bodyId)

        return (
          <group
            key={bodyId}
            ref={(obj) => {
              if (obj) bodyGroupRefs.current.set(bodyId, obj)
              else bodyGroupRefs.current.delete(bodyId)
            }}
          >
            {isMoon ? (
              <sprite material={moonMaterial} scale={[MOON_SPRITE_SIZE, MOON_SPRITE_SIZE, 1]} renderOrder={20} />
            ) : (
              <mesh
                material={mat}
                renderOrder={20}
                ref={(obj) => {
                  if (obj) bodyVisualRefs.current.set(bodyId, obj)
                  else bodyVisualRefs.current.delete(bodyId)
                }}
              >
                <sphereGeometry args={[size, 16, 16]} />
              </mesh>
            )}

            {showLabels && (
              <Html
                position={[0, size + 14, 0]}
                center
                style={{ pointerEvents: 'none' }}
                zIndexRange={[180, 0]}
              >
                <div
                  ref={(el) => {
                    if (el) labelElementRefs.current.set(bodyId, el)
                    else labelElementRefs.current.delete(bodyId)
                  }}
                  className="planetarium-star-label"
                  style={{ color: labelColor }}
                >
                  {bodyId}
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
