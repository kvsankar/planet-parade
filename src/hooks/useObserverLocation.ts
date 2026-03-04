import { useCallback, useEffect, useState } from 'react'
import tzLookup from 'tz-lookup'
import { ObserverLocation } from '../types'
import {
  OBSERVER_LOCATION_STORAGE_KEY,
  ObserverLocationState,
  ObserverSource,
  makeDefaultObserverLocationState,
  parseObserverLocationState,
  sanitizeObserverLocationState,
  serializeObserverLocationState,
} from '../lib/observerLocation'

const GEO_PERMISSION_DENIED = 1
const GEO_UNAVAILABLE = 2
const GEO_TIMEOUT = 3

export type GeolocationRequestResult =
  | { ok: true; state: ObserverLocationState }
  | { ok: false; error: string }

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case GEO_PERMISSION_DENIED:
      return 'Browser location permission was denied.'
    case GEO_UNAVAILABLE:
      return 'Browser location is currently unavailable.'
    case GEO_TIMEOUT:
      return 'Browser location request timed out.'
    default:
      return error.message || 'Could not read browser location.'
  }
}

function inferTimeZone(observer: ObserverLocation): string | null {
  try {
    return tzLookup(observer.lat, observer.lon)
  } catch {
    return null
  }
}

function loadInitialState(): ObserverLocationState {
  if (typeof window === 'undefined') return makeDefaultObserverLocationState()
  try {
    const raw = window.localStorage.getItem(OBSERVER_LOCATION_STORAGE_KEY)
    return parseObserverLocationState(raw) ?? makeDefaultObserverLocationState()
  } catch {
    return makeDefaultObserverLocationState()
  }
}

export function useObserverLocation() {
  const [observerState, setObserverState] = useState<ObserverLocationState>(() => loadInitialState())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        OBSERVER_LOCATION_STORAGE_KEY,
        serializeObserverLocationState(observerState),
      )
    } catch {
      // Ignore localStorage write failures.
    }
  }, [observerState])

  const setLocation = useCallback((
    observer: ObserverLocation,
    source: ObserverSource,
    options?: { accuracyM?: number | null; label?: string | null; timeZone?: string | null },
  ): ObserverLocationState => {
    const timeZone = options?.timeZone ?? inferTimeZone(observer)
    const next = sanitizeObserverLocationState({
      observer,
      source,
      accuracyM: options?.accuracyM ?? null,
      timeZone,
      label: options?.label ?? null,
      updatedAt: Date.now(),
    })
    setObserverState(next)
    return next
  }, [])

  const setManualLocation = useCallback((observer: ObserverLocation) => {
    setLocation(observer, 'manual')
  }, [setLocation])

  const setOsmLocation = useCallback((observer: ObserverLocation, label: string | null) => {
    setLocation(observer, 'osm', { label })
  }, [setLocation])

  const resetToDefault = useCallback(() => {
    setObserverState(makeDefaultObserverLocationState())
  }, [])

  const requestBrowserLocation = useCallback((): Promise<GeolocationRequestResult> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve({ ok: false, error: 'Geolocation is not supported in this browser.' })
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const altitude = typeof position.coords.altitude === 'number' && Number.isFinite(position.coords.altitude)
            ? position.coords.altitude
            : 0
          const accuracyM = typeof position.coords.accuracy === 'number' && Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null
          const next = setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            height: altitude,
          }, 'browser', { accuracyM })
          resolve({ ok: true, state: next })
        },
        (error) => {
          resolve({ ok: false, error: geolocationErrorMessage(error) })
        },
        {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 120_000,
        },
      )
    })
  }, [setLocation])

  return {
    observer: observerState.observer,
    observerState,
    setManualLocation,
    setOsmLocation,
    resetToDefault,
    requestBrowserLocation,
  }
}
