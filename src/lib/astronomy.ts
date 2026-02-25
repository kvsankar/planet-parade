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
  Moon: Astronomy.Body.Moon,
}

/** Get heliocentric position of a planet in Three.js scene coords */
export function getBodyPosition(bodyId: CelestialBodyId, date: Date): [number, number, number] {
  if (bodyId === 'Sun') return [0, 0, 0]
  if (bodyId === 'Moon') return getMoonPosition(date)

  const body = BODY_MAP[bodyId]
  if (!body) return [0, 0, 0]

  const vec = Astronomy.HelioVector(body, date)
  return eqjToScene(vec.x, vec.y, vec.z)
}

/** Moon: geocentric EQJ → ecliptic → add to Earth's heliocentric position */
function getMoonPosition(date: Date): [number, number, number] {
  const earthPos = getBodyPosition('Earth', date)
  const geoVec = Astronomy.GeoVector(Astronomy.Body.Moon, date, true)
  const moonOffset = eqjToScene(geoVec.x, geoVec.y, geoVec.z)
  return [
    earthPos[0] + moonOffset[0],
    earthPos[1] + moonOffset[1],
    earthPos[2] + moonOffset[2],
  ]
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
