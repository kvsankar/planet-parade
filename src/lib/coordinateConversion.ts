import { AU_TO_SCENE } from '../constants'

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
