import { AU_TO_SCENE } from '../constants'

export const CELESTIAL_SPHERE_RADIUS = 950

const OBLIQUITY_RAD = 23.4392911 * (Math.PI / 180)
const cosObl = Math.cos(OBLIQUITY_RAD)
const sinObl = Math.sin(OBLIQUITY_RAD)

/** Rotate J2000 equatorial (EQJ) vector to ecliptic coordinates */
function eqjToEcliptic(x: number, y: number, z: number): [number, number, number] {
  const eclX = x
  const eclY = y * cosObl + z * sinObl
  const eclZ = -y * sinObl + z * cosObl
  return [eclX, eclY, eclZ]
}

/**
 * Convert ecliptic coordinates (AU) to Three.js scene coordinates.
 * Mapping: eclX → X, eclZ → Y (up), eclY → -Z
 * This gives a Y-up convention with the ecliptic plane as XZ.
 */
function eclipticToScene(eclX: number, eclY: number, eclZ: number): [number, number, number] {
  return [
    eclX * AU_TO_SCENE,
    eclZ * AU_TO_SCENE,
    -eclY * AU_TO_SCENE,
  ]
}

/** Full pipeline: EQJ vector (AU) → Three.js scene position */
export function eqjToScene(x: number, y: number, z: number): [number, number, number] {
  const [eclX, eclY, eclZ] = eqjToEcliptic(x, y, z)
  return eclipticToScene(eclX, eclY, eclZ)
}

/**
 * Convert horizontal coordinates (alt-az) to 3D scene position on celestial sphere.
 * Convention: zenith=+Y, north=−Z, east=+X
 */
export function altAzToSceneSphere(altDeg: number, azDeg: number, radius = CELESTIAL_SPHERE_RADIUS): [number, number, number] {
  const altRad = altDeg * (Math.PI / 180)
  const azRad = azDeg * (Math.PI / 180)
  const cosAlt = Math.cos(altRad)
  return [
    cosAlt * Math.sin(azRad) * radius,
    Math.sin(altRad) * radius,
    -cosAlt * Math.cos(azRad) * radius,
  ]
}

/** Convert RA/Dec (J2000) to 3D scene position on celestial sphere */
export function raDecToSceneSphere(raHours: number, decDeg: number, radius = CELESTIAL_SPHERE_RADIUS): [number, number, number] {
  const raRad = raHours * (Math.PI / 12)
  const decRad = decDeg * (Math.PI / 180)
  const cosDec = Math.cos(decRad)
  // EQJ unit vector
  const x = cosDec * Math.cos(raRad)
  const y = cosDec * Math.sin(raRad)
  const z = Math.sin(decRad)
  // Rotate to ecliptic
  const [eclX, eclY, eclZ] = eqjToEcliptic(x, y, z)
  // Map to scene axes: eclX→X, eclZ→Y(up), -eclY→Z, scaled by radius
  return [eclX * radius, eclZ * radius, -eclY * radius]
}
