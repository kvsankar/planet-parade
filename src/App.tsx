import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import SolarSystemScene from './components/scene/SolarSystemScene'
import InnerPlanetsInset from './components/scene/InnerPlanetsInset'
import FloatingPanel from './components/panels/FloatingPanel'
import AlignmentPanel from './components/panels/AlignmentPanel'
import ChartPanel from './components/panels/ChartPanel'
import SkyViewPanel from './components/panels/SkyViewPanel'
import SkyChartPanel from './components/panels/SkyChartPanel'
import PlaybackBar from './components/ui/PlaybackBar'
import DisplayToggles from './components/ui/DisplayToggles'
import BodySelector from './components/ui/BodySelector'
import InfoDisplay from './components/ui/InfoDisplay'
import { SimulationTimeContext } from './hooks/useSimulationTime'
import { simulationStore } from './hooks/useSimulationStore'
import { MS_PER_DAY } from './constants'
import { SelectionContext } from './hooks/useSelection'
import { DisplaySettingsContext } from './hooks/useDisplaySettings'
import { usePlanetPositions } from './hooks/usePlanetPositions'
import { useOrbitPaths } from './hooks/useOrbitPaths'
import { usePanelManager, PanelId } from './hooks/usePanelManager'
import { useAlignmentState } from './hooks/useAlignmentState'
import { CelestialBodyId, ObserverLocation } from './types'

export default function App() {
  // --- Simulation Time ---
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(10)

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => {
      simulationStore.isPlaying = !p
      return !p
    })
  }, [])

  const handleSetDate = useCallback((d: Date) => {
    simulationStore.date = d
    setCurrentDate(d)
  }, [])

  const handleSetSpeed = useCallback((s: number) => {
    simulationStore.speed = s
    setSpeed(s)
  }, [])

  // --- rAF loop (no tabs — both views always visible) ---
  const lastFrameRef = useRef<number | null>(null)
  const throttleRef = useRef(0)

  useEffect(() => {
    let rafId: number

    const tick = (now: number) => {
      if (simulationStore.isPlaying) {
        if (lastFrameRef.current !== null) {
          const elapsedSec = (now - lastFrameRef.current) / 1000
          const capped = Math.min(elapsedSec, 0.1)
          const newMs = simulationStore.date.getTime() + simulationStore.speed * capped * MS_PER_DAY
          simulationStore.date = new Date(newMs)
        }
        lastFrameRef.current = now

        // Update React state every frame for smooth chart/slider animation
        // R3F reads simulationStore directly, this drives the React UI
        if (now - throttleRef.current > 100) {
          throttleRef.current = now
          setCurrentDate(simulationStore.date)
        }
      } else {
        lastFrameRef.current = null
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // --- Selection ---
  const [selectedBodyId, setSelectedBodyId] = useState<CelestialBodyId | null>(null)
  const [followMode, setFollowMode] = useState(false)

  const selectBody = useCallback((id: CelestialBodyId | null) => {
    setSelectedBodyId(id)
    if (!id) setFollowMode(false)
  }, [])
  const toggleFollow = useCallback(() => setFollowMode((f) => !f), [])

  // --- Display Settings ---
  const [showOrbits, setShowOrbits] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [forceInner, setForceInner] = useState(false)
  const toggleOrbits = useCallback(() => setShowOrbits((o) => !o), [])
  const toggleLabels = useCallback(() => setShowLabels((l) => !l), [])
  const toggleForceInner = useCallback(() => setForceInner((f) => !f), [])

  // --- Computed (throttled React state — for UI only) ---
  const positions = usePlanetPositions(currentDate)
  const orbitPaths = useOrbitPaths(currentDate)

  // --- Alignment state (shared across panels) ---
  const alignment = useAlignmentState(currentDate, handleSetDate)

  // --- Observer (fixed for Stage 1) ---
  const observer = useMemo<ObserverLocation>(() => ({ lat: 0, lon: 0, height: 0 }), [])

  // --- Panel manager ---
  const panel = usePanelManager()

  const simTimeValue = useMemo(() => ({
    currentDate, isPlaying, speed,
    setDate: handleSetDate, togglePlay, setSpeed: handleSetSpeed,
  }), [currentDate, isPlaying, speed, handleSetDate, togglePlay, handleSetSpeed])

  const selectionValue = useMemo(() => ({
    selectedBodyId, followMode, selectBody, toggleFollow,
  }), [selectedBodyId, followMode, selectBody, toggleFollow])

  const displayValue = useMemo(() => ({
    showOrbits, showLabels, forceInner,
    toggleOrbits, toggleLabels, toggleForceInner,
  }), [showOrbits, showLabels, forceInner, toggleOrbits, toggleLabels, toggleForceInner])

  // Shared panel props
  const fp = (id: PanelId) => ({
    id,
    layout: panel.layouts[id],
    zIndex: panel.zIndexMap[id],
    onDragStop: panel.onDragStop,
    onResizeStop: panel.onResizeStop,
    onFocus: panel.onFocus,
    onMinimize: panel.onMinimize,
  })

  return (
    <SimulationTimeContext.Provider value={simTimeValue}>
      <SelectionContext.Provider value={selectionValue}>
        <DisplaySettingsContext.Provider value={displayValue}>
          <div className="app">
            {/* Floating panels layer */}
            <div className="panels-layer">
              <FloatingPanel {...fp('scene')} title="Solar System" minWidth={300} minHeight={200} bodyClassName="scene-panel-body">
                <div className="scene-panel-content">
                  <SolarSystemScene positions={positions} orbitPaths={orbitPaths} selectedBodies={alignment.selectedBodies} visibleSeries={alignment.visibleSeries} />
                  <div className="scene-overlay">
                    <InfoDisplay selectedBodyId={selectedBodyId} positions={positions} />
                    <DisplayToggles />
                    <BodySelector />
                  </div>
                  <InnerPlanetsInset positions={positions} orbitPaths={orbitPaths} selectedBodies={alignment.selectedBodies} visibleSeries={alignment.visibleSeries} />
                </div>
              </FloatingPanel>

              <FloatingPanel {...fp('controls')} title="Alignments" minWidth={220} minHeight={200}>
                <AlignmentPanel alignment={alignment} />
              </FloatingPanel>

              <FloatingPanel {...fp('chart')} title="Alignment Timeline" minWidth={400} minHeight={160}>
                <ChartPanel
                  alignment={alignment}
                  currentDate={currentDate}
                  onDateChange={handleSetDate}
                />
              </FloatingPanel>

              <FloatingPanel {...fp('skyview')} title="Sky View" minWidth={300} minHeight={200}>
                <SkyViewPanel alignment={alignment} currentDate={currentDate} visibleSeries={alignment.visibleSeries} />
              </FloatingPanel>

              <FloatingPanel {...fp('skychart')} title="Sky Charts" minWidth={300} minHeight={200}>
                <SkyChartPanel currentDate={currentDate} observer={observer} />
              </FloatingPanel>

              <PlaybackBar
                currentDate={currentDate}
                isPlaying={isPlaying}
                speed={speed}
                togglePlay={togglePlay}
                setSpeed={handleSetSpeed}
                onDateChange={handleSetDate}
                hasPrev={alignment.hasPrev}
                hasNext={alignment.hasNext}
                jumpToMinimum={alignment.jumpToMinimum}
              />

              <button className="reset-layout-btn" onClick={panel.resetLayout}>
                Reset Layout
              </button>
            </div>
          </div>
        </DisplaySettingsContext.Provider>
      </SelectionContext.Provider>
    </SimulationTimeContext.Provider>
  )
}
