import { FormEvent, useCallback, useEffect, useState } from 'react'
import { ObserverLocation } from '../../types'
import {
  ObserverLocationState,
  ObserverSource,
  formatObserverLatLon,
} from '../../lib/observerLocation'
import { GeolocationRequestResult } from '../../hooks/useObserverLocation'
import OsmMiniMap from './OsmMiniMap'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface Coordinates {
  lat: number
  lon: number
}

interface Props {
  open: boolean
  observerState: ObserverLocationState
  onClose: () => void
  onUseBrowserLocation: () => Promise<GeolocationRequestResult>
  onApplyManualLocation: (observer: ObserverLocation) => void
  onApplySearchLocation: (observer: ObserverLocation, label: string | null) => void
  onResetLocation: () => void
}

const SOURCE_LABEL: Record<ObserverSource, string> = {
  default: 'Default',
  browser: 'Browser',
  osm: 'OpenStreetMap',
  manual: 'Manual',
}

function toFiniteNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default function LocationPickerModal({
  open,
  observerState,
  onClose,
  onUseBrowserLocation,
  onApplyManualLocation,
  onApplySearchLocation,
  onResetLocation,
}: Props) {
  const [query, setQuery] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualLat, setManualLat] = useState('0')
  const [manualLon, setManualLon] = useState('0')
  const [manualHeight, setManualHeight] = useState('0')
  const [mapCenter, setMapCenter] = useState<Coordinates>({ lat: 0, lon: 0 })
  const [mapPick, setMapPick] = useState<Coordinates | null>(null)

  useEffect(() => {
    if (!open) return
    setGeoError(null)
    setSearchError(null)
    setManualError(null)
    setSearchResults([])
    setManualLat(observerState.observer.lat.toFixed(5))
    setManualLon(observerState.observer.lon.toFixed(5))
    setManualHeight(observerState.observer.height.toFixed(1))
    setMapCenter({
      lat: observerState.observer.lat,
      lon: observerState.observer.lon,
    })
    setMapPick({
      lat: observerState.observer.lat,
      lon: observerState.observer.lon,
    })
  }, [open, observerState.observer.height, observerState.observer.lat, observerState.observer.lon])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const handleMapPick = useCallback((lat: number, lon: number) => {
    setMapPick({ lat, lon })
  }, [])

  if (!open) return null

  const handleSearch = async (event?: FormEvent) => {
    event?.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSearchError('Enter at least 2 characters to search.')
      setSearchResults([])
      return
    }

    setSearchBusy(true)
    setSearchError(null)
    try {
      const endpoint = new URL('https://nominatim.openstreetmap.org/search')
      endpoint.searchParams.set('q', trimmed)
      endpoint.searchParams.set('format', 'jsonv2')
      endpoint.searchParams.set('limit', '8')
      endpoint.searchParams.set('addressdetails', '1')
      endpoint.searchParams.set('dedupe', '1')

      const response = await fetch(endpoint.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error(`Search failed (${response.status})`)
      }
      const parsed = await response.json() as NominatimResult[]
      const cleaned = parsed.filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)))
      setSearchResults(cleaned)
      if (cleaned.length === 0) {
        setSearchError('No matching places found.')
      }
    } catch (error) {
      setSearchResults([])
      setSearchError(error instanceof Error ? error.message : 'Could not fetch OpenStreetMap search results.')
    } finally {
      setSearchBusy(false)
    }
  }

  const handleBrowserLocation = async () => {
    setGeoBusy(true)
    setGeoError(null)
    const result = await onUseBrowserLocation()
    setGeoBusy(false)
    if (!result.ok) {
      setGeoError(result.error)
      return
    }
    onClose()
  }

  const handleManualApply = () => {
    setManualError(null)
    const lat = toFiniteNumber(manualLat)
    const lon = toFiniteNumber(manualLon)
    const height = toFiniteNumber(manualHeight)

    if (lat === null || lon === null) {
      setManualError('Latitude and longitude must be valid numbers.')
      return
    }
    if (lat < -90 || lat > 90) {
      setManualError('Latitude must be between -90 and +90.')
      return
    }

    onApplyManualLocation({
      lat,
      lon,
      height: height ?? 0,
    })
    onClose()
  }

  const handleSearchSelect = (result: NominatimResult) => {
    const lat = Number(result.lat)
    const lon = Number(result.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
    setMapPick({ lat, lon })
    onApplySearchLocation({
      lat,
      lon,
      height: observerState.observer.height,
    }, result.display_name)
    onClose()
  }

  const handleMapApply = () => {
    if (!mapPick) return
    onApplySearchLocation(
      {
        lat: mapPick.lat,
        lon: mapPick.lon,
        height: observerState.observer.height,
      },
      `Map pick (${mapPick.lat.toFixed(4)}, ${mapPick.lon.toFixed(4)})`,
    )
    onClose()
  }

  const handleReset = () => {
    onResetLocation()
    onClose()
  }

  return (
    <div className="location-picker-backdrop" role="presentation" onClick={onClose}>
      <div
        className="location-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Observer Location"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="location-picker-header">
          <h2 className="location-picker-title">Observer Location</h2>
          <button type="button" className="location-picker-close" onClick={onClose} aria-label="Close location picker">
            ×
          </button>
        </div>

        <div className="location-picker-status">
          <div>{`Current: ${formatObserverLatLon(observerState.observer, 3)}`}</div>
          <div>{`Source: ${SOURCE_LABEL[observerState.source]}`}</div>
          {observerState.timeZone && (
            <div>{`Time Zone: ${observerState.timeZone}`}</div>
          )}
          {observerState.accuracyM != null && (
            <div>{`Accuracy: ±${Math.round(observerState.accuracyM)} m`}</div>
          )}
          {observerState.label && (
            <div className="location-picker-label" title={observerState.label}>{observerState.label}</div>
          )}
        </div>

        <div className="location-picker-actions">
          <button
            type="button"
            className="location-picker-btn"
            onClick={handleBrowserLocation}
            disabled={geoBusy}
          >
            {geoBusy ? 'Locating…' : 'Use Browser Location'}
          </button>
          <button
            type="button"
            className="location-picker-btn location-picker-btn-muted"
            onClick={handleReset}
          >
            Reset to Default
          </button>
        </div>
        {geoError && <div className="location-picker-error">{geoError}</div>}

        <div className="location-picker-section">
          <div className="location-picker-section-title">Map Picker (OpenStreetMap)</div>
          <OsmMiniMap
            initialCenter={mapCenter}
            selected={mapPick}
            onPick={handleMapPick}
          />
          {mapPick && (
            <div className="location-picker-map-coords">
              {`Selected: ${mapPick.lat.toFixed(5)}, ${mapPick.lon.toFixed(5)}`}
            </div>
          )}
          <div className="location-picker-actions">
            <button type="button" className="location-picker-btn" onClick={handleMapApply} disabled={!mapPick}>
              Use Map Point
            </button>
          </div>
        </div>

        <div className="location-picker-section">
          <div className="location-picker-section-title">Search (OpenStreetMap)</div>
          <form className="location-picker-search-row" onSubmit={handleSearch}>
            <input
              type="text"
              className="location-picker-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="City, address, landmark..."
            />
            <button type="submit" className="location-picker-btn" disabled={searchBusy}>
              {searchBusy ? 'Searching…' : 'Search'}
            </button>
          </form>
          {searchError && <div className="location-picker-error">{searchError}</div>}
          {searchResults.length > 0 && (
            <div className="location-picker-results">
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  type="button"
                  className="location-picker-result"
                  onClick={() => handleSearchSelect(result)}
                >
                  <span className="location-picker-result-name">{result.display_name}</span>
                  <span className="location-picker-result-coords">
                    {`${Number(result.lat).toFixed(4)}, ${Number(result.lon).toFixed(4)}`}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="location-picker-attribution">
            Search data © OpenStreetMap contributors via Nominatim.
          </div>
        </div>

        <div className="location-picker-section">
          <div className="location-picker-section-title">Manual Coordinates</div>
          <div className="location-picker-manual-grid">
            <label className="location-picker-field">
              <span>Latitude</span>
              <input
                type="number"
                className="location-picker-input"
                value={manualLat}
                onChange={(event) => setManualLat(event.target.value)}
                step="0.0001"
                min="-90"
                max="90"
              />
            </label>
            <label className="location-picker-field">
              <span>Longitude</span>
              <input
                type="number"
                className="location-picker-input"
                value={manualLon}
                onChange={(event) => setManualLon(event.target.value)}
                step="0.0001"
              />
            </label>
            <label className="location-picker-field">
              <span>Height (m)</span>
              <input
                type="number"
                className="location-picker-input"
                value={manualHeight}
                onChange={(event) => setManualHeight(event.target.value)}
                step="1"
              />
            </label>
          </div>
          <div className="location-picker-actions">
            <button type="button" className="location-picker-btn" onClick={handleManualApply}>
              Apply Manual Location
            </button>
          </div>
          {manualError && <div className="location-picker-error">{manualError}</div>}
        </div>
      </div>
    </div>
  )
}
