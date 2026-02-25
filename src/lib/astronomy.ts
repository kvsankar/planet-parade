import * as Astronomy from 'astronomy-engine'
import { CelestialBodyId } from '../types'
import { eqjToScene } from './coordinateConversion'

const BODY_MAP: Record<string, Astronomy.Body> = {
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Earth: Astronomy.Body.Earth,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto,
}

/** Get heliocentric position of a planet in Three.js scene coords */
export function getBodyPosition(bodyId: CelestialBodyId, date: Date): [number, number, number] {
  if (bodyId === 'Sun') return [0, 0, 0]

  const body = BODY_MAP[bodyId]
  if (!body) return [0, 0, 0]

  const vec = Astronomy.HelioVector(body, date)
  return eqjToScene(vec.x, vec.y, vec.z)
}

/** Get all body positions for a given date */
export function getAllPositions(date: Date): Record<CelestialBodyId, [number, number, number]> {
  const result = {} as Record<CelestialBodyId, [number, number, number]>
  result.Sun = [0, 0, 0]
  for (const id of Object.keys(BODY_MAP) as CelestialBodyId[]) {
    result[id] = getBodyPosition(id, date)
  }
  return result
}
