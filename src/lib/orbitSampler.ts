import { CelestialBodyId } from '../types'
import { BODY_META, MS_PER_DAY } from '../constants'
import { getBodyPosition } from './astronomy'

/**
 * Sample positions over one orbital period to create an orbit path.
 * For Moon, the orbit is sampled relative to Earth and then offset.
 */
export function sampleOrbit(
  bodyId: CelestialBodyId,
  centerDate: Date,
): [number, number, number][] {
  if (bodyId === 'Sun') return []

  const meta = BODY_META[bodyId]
  const samples = meta.orbitSamples
  const periodDays = meta.orbitalPeriodDays
  const points: [number, number, number][] = []

  const startMs = centerDate.getTime() - (periodDays / 2) * MS_PER_DAY

  for (let i = 0; i <= samples; i++) {
    const t = startMs + (i / samples) * periodDays * MS_PER_DAY
    const d = new Date(t)
    const pos = getBodyPosition(bodyId, d)
    points.push(pos)
  }

  return points
}
