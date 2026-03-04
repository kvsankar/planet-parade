import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { CircleMarker, LeafletMouseEvent, Map } from 'leaflet'

interface Coordinates {
  lat: number
  lon: number
}

interface Props {
  initialCenter: Coordinates
  selected: Coordinates | null
  onPick: (lat: number, lon: number) => void
}

export default function OsmMiniMap({ initialCenter, selected, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const markerRef = useRef<CircleMarker | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false

    const setupMap = async () => {
      if (!containerRef.current || mapRef.current) return

      try {
        const L = await import('leaflet')
        if (canceled || !containerRef.current) return
        leafletRef.current = L

        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          worldCopyJump: true,
        })
        map.setView([initialCenter.lat, initialCenter.lon], 4)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)

        map.on('click', (event: LeafletMouseEvent) => {
          onPick(event.latlng.lat, event.latlng.lng)
        })

        mapRef.current = map
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setLoadError(`Could not load map widget (${message}).`)
      }
    }

    setupMap()

    return () => {
      canceled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      markerRef.current = null
      leafletRef.current = null
    }
  }, [initialCenter.lat, initialCenter.lon, onPick])

  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !selected) return

    const latLng: [number, number] = [selected.lat, selected.lon]
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latLng, {
        radius: 7,
        color: '#8cb3ff',
        weight: 2,
        fillColor: '#8cb3ff',
        fillOpacity: 0.3,
      }).addTo(map)
    } else {
      markerRef.current.setLatLng(latLng)
    }
  }, [selected])

  return (
    <div className="location-picker-map-wrap">
      <div ref={containerRef} className="location-picker-map" />
      {loadError && <div className="location-picker-error">{loadError}</div>}
      <div className="location-picker-map-hint">Click anywhere on the map to pick coordinates.</div>
    </div>
  )
}
