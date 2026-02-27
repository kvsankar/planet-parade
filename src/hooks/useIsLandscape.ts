import { useState, useEffect } from 'react'

const LANDSCAPE_QUERY = '(max-height: 767.98px) and (orientation: landscape) and (pointer: coarse)'

export function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(
    () => window.matchMedia(LANDSCAPE_QUERY).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(LANDSCAPE_QUERY)
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isLandscape
}
