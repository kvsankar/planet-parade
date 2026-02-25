import { useMemo } from 'react'
import { CelestialBodyId } from '../types'
import { BODY_LIST } from '../constants'
import { sampleOrbit } from '../lib/orbitSampler'

/**
 * Compute orbit paths for all bodies. Memoized by year to avoid expensive recomputation.
 */
export function useOrbitPaths(date: Date): Record<CelestialBodyId, [number, number, number][]> {
  const year = date.getFullYear()

  return useMemo(() => {
    const midYear = new Date(Date.UTC(year, 6, 1))
    const paths = {} as Record<CelestialBodyId, [number, number, number][]>
    for (const id of BODY_LIST) {
      paths[id] = sampleOrbit(id, midYear)
    }
    paths.Sun = []
    return paths
  }, [year])
}
