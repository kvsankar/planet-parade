import { useMemo } from 'react'
import { CelestialBodyId } from '../types'
import { BODY_LIST } from '../constants'
import { sampleOrbit } from '../lib/orbitSampler'

/**
 * Compute orbit paths for all bodies. Memoized by coarsened date
 * (year for planets, month for Moon) to avoid expensive recomputation.
 */
export function useOrbitPaths(date: Date): Record<CelestialBodyId, [number, number, number][]> {
  const year = date.getFullYear()
  const month = date.getMonth()

  // Planets: recompute when year changes (use midyear as stable center date)
  const planetPaths = useMemo(() => {
    const midYear = new Date(Date.UTC(year, 6, 1))
    const paths = {} as Record<CelestialBodyId, [number, number, number][]>
    for (const id of BODY_LIST) {
      if (id === 'Moon') continue
      paths[id] = sampleOrbit(id, midYear)
    }
    return paths
  }, [year])

  // Moon: recompute more frequently (month)
  const moonPath = useMemo(() => {
    const midMonth = new Date(Date.UTC(year, month, 15))
    return sampleOrbit('Moon', midMonth)
  }, [year, month])

  return useMemo(() => ({
    ...planetPaths,
    Moon: moonPath,
    Sun: [],
  }), [planetPaths, moonPath])
}
