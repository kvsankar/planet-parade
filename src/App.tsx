import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import SolarSystemScene from './components/scene/SolarSystemScene'
import ControlPanel from './components/ui/ControlPanel'
import AlignmentAnalyzer from './components/alignment/AlignmentAnalyzer'
import { SimulationTimeContext } from './hooks/useSimulationTime'
import { simulationStore } from './hooks/useSimulationStore'
import { MS_PER_DAY } from './constants'
import { SelectionContext } from './hooks/useSelection'
import { DisplaySettingsContext } from './hooks/useDisplaySettings'
import { usePlanetPositions } from './hooks/usePlanetPositions'
import { useOrbitPaths } from './hooks/useOrbitPaths'
import { CelestialBodyId } from './types'

type TabId = '3d' | 'alignment'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('3d')

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

  // --- Independent rAF loop for time advancement (runs on any tab) ---
  const lastFrameRef = useRef<number | null>(null)
  const throttleRef = useRef(0)
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

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

        if (activeTabRef.current === 'alignment') {
          // Alignment tab: update React state every frame for smooth animation
          setCurrentDate(simulationStore.date)
        } else {
          // 3D tab: throttle React state updates to ~10Hz (R3F reads store directly)
          if (now - throttleRef.current > 100) {
            throttleRef.current = now
            setCurrentDate(simulationStore.date)
          }
        }
      } else {
        lastFrameRef.current = null
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, []) // stable — reads from simulationStore and refs directly

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
  const toggleOrbits = useCallback(() => setShowOrbits((o) => !o), [])
  const toggleLabels = useCallback(() => setShowLabels((l) => !l), [])

  // --- Computed (throttled React state — for UI only) ---
  const positions = usePlanetPositions(currentDate)
  const orbitPaths = useOrbitPaths(currentDate)

  const simTimeValue = useMemo(() => ({
    currentDate, isPlaying, speed,
    setDate: handleSetDate, togglePlay, setSpeed: handleSetSpeed,
  }), [currentDate, isPlaying, speed, handleSetDate, togglePlay, handleSetSpeed])

  const selectionValue = useMemo(() => ({
    selectedBodyId, followMode, selectBody, toggleFollow,
  }), [selectedBodyId, followMode, selectBody, toggleFollow])

  const displayValue = useMemo(() => ({
    showOrbits, showLabels, toggleOrbits, toggleLabels,
  }), [showOrbits, showLabels, toggleOrbits, toggleLabels])

  return (
    <SimulationTimeContext.Provider value={simTimeValue}>
      <SelectionContext.Provider value={selectionValue}>
        <DisplaySettingsContext.Provider value={displayValue}>
          <div className="app">
            <div className="tab-bar">
              <button
                className={`tab-btn ${activeTab === '3d' ? 'active' : ''}`}
                onClick={() => setActiveTab('3d')}
              >
                3D View
              </button>
              <button
                className={`tab-btn ${activeTab === 'alignment' ? 'active' : ''}`}
                onClick={() => setActiveTab('alignment')}
              >
                Alignment
              </button>
            </div>

            <div className="tab-content" style={{ display: activeTab === '3d' ? 'contents' : 'none' }}>
              <SolarSystemScene
                positions={positions}
                orbitPaths={orbitPaths}
              />
              <ControlPanel selectedBodyId={selectedBodyId} positions={positions} />
            </div>
            <div className="tab-content" style={{ display: activeTab === 'alignment' ? 'contents' : 'none' }}>
              <AlignmentAnalyzer
                currentDate={currentDate}
                onDateChange={handleSetDate}
              />
            </div>
          </div>
        </DisplaySettingsContext.Provider>
      </SelectionContext.Provider>
    </SimulationTimeContext.Provider>
  )
}
