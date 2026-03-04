import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import SolarSystemScene from './components/scene/SolarSystemScene'
import PlanetariumScene from './components/scene/PlanetariumScene'
import PlanetariumTimeControls from './components/ui/PlanetariumTimeControls'
import InnerPlanetsInset from './components/scene/InnerPlanetsInset'
import FloatingPanel from './components/panels/FloatingPanel'
import AlignmentPanel from './components/panels/AlignmentPanel'
import ChartPanel from './components/panels/ChartPanel'
import SkyViewPanel from './components/panels/SkyViewPanel'
import SkyChartPanel from './components/panels/SkyChartPanel'
import PlaybackBar from './components/ui/PlaybackBar'
import HelpButton from './components/ui/HelpButton'
import DisplayToggles from './components/ui/DisplayToggles'
import BodySelector from './components/ui/BodySelector'
import InfoDisplay from './components/ui/InfoDisplay'
import MobileTabBar, { MobileTab } from './components/ui/MobileTabBar'
import LocationPickerModal from './components/ui/LocationPickerModal'
import { SimulationTimeContext } from './hooks/useSimulationTime'
import { simulationStore } from './hooks/useSimulationStore'
import { MS_PER_DAY, BODY_META } from './constants'
import { SelectionContext } from './hooks/useSelection'
import { DisplaySettingsContext } from './hooks/useDisplaySettings'
import { usePlanetPositions } from './hooks/usePlanetPositions'
import { useOrbitPaths } from './hooks/useOrbitPaths'
import { usePanelManager, PanelId } from './hooks/usePanelManager'
import { useAlignmentState } from './hooks/useAlignmentState'
import { CelestialBodyId } from './types'
import { useTour } from './hooks/useTour'
import { useIsMobile } from './hooks/useIsMobile'
import { useIsLandscape } from './hooks/useIsLandscape'
import { useObserverLocation } from './hooks/useObserverLocation'

const MOBILE_TAB_TITLES: Record<MobileTab, string> = {
  scene: 'Space & Sky',
  align: 'Alignments',
  timeline: 'Parade Timeline',
  sky: 'Ecliptic Strip',
  charts: 'Sky Charts',
}

export default function App() {
  // --- Mobile ---
  const isMobile = useIsMobile()
  const isLandscape = useIsLandscape()
  const [mobileTab, setMobileTab] = useState<MobileTab>('align')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sceneMenuOpen, setSceneMenuOpen] = useState(false)
  const [sceneView, setSceneView] = useState<'free' | 'planetarium'>('free')
  const [forceLandscapeMobileView, setForceLandscapeMobileView] = useState(false)
  const emulateLandscapeMobile = !isMobile && forceLandscapeMobileView
  const effectiveIsMobile = isMobile || emulateLandscapeMobile
  const effectiveIsLandscape = isLandscape || emulateLandscapeMobile

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
  const [showStars, setShowStars] = useState(true)
  const [showMilkyWay, setShowMilkyWay] = useState(true)
  const [showConstellations, setShowConstellations] = useState(true)
  const [showConstellationBoundaries, setShowConstellationBoundaries] = useState(false)
  const [showCones, setShowCones] = useState(true)
  const [showPPIOverlay, setShowPPIOverlay] = useState(true)
  const toggleOrbits = useCallback(() => setShowOrbits((o) => !o), [])
  const toggleLabels = useCallback(() => setShowLabels((l) => !l), [])
  const toggleForceInner = useCallback(() => setForceInner((f) => !f), [])
  const toggleStars = useCallback(() => setShowStars((s) => !s), [])
  const toggleMilkyWay = useCallback(() => setShowMilkyWay((m) => !m), [])
  const toggleConstellations = useCallback(() => setShowConstellations((c) => !c), [])
  const toggleConstellationBoundaries = useCallback(() => setShowConstellationBoundaries((b) => !b), [])
  const toggleCones = useCallback(() => setShowCones((c) => !c), [])
  const togglePPIOverlay = useCallback(() => setShowPPIOverlay((p) => !p), [])

  // --- Computed (throttled React state — for UI only) ---
  const positions = usePlanetPositions(currentDate)
  const orbitPaths = useOrbitPaths(currentDate)

  // --- Observer location (progressive, user-triggered) ---
  const {
    observer,
    observerState,
    setManualLocation,
    setOsmLocation,
    resetToDefault,
    requestBrowserLocation,
  } = useObserverLocation()
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const openLocationPicker = useCallback(() => setLocationPickerOpen(true), [])
  const closeLocationPicker = useCallback(() => setLocationPickerOpen(false), [])
  const [planetariumViewResetToken, setPlanetariumViewResetToken] = useState(0)
  const requestPlanetariumViewReset = useCallback(() => {
    setPlanetariumViewResetToken((token) => token + 1)
  }, [])

  // --- Alignment state (shared across panels) ---
  const alignment = useAlignmentState(currentDate, handleSetDate, observerState.timeZone)

  // Best combo for current day (for scene overlay PPI display)
  const activeCombo = alignment.selectedDayComboIdx != null
    ? alignment.dayDetailCombos[alignment.selectedDayComboIdx] ?? alignment.dayDetailCombos[0]
    : alignment.dayDetailCombos[0] ?? null

  const ppiOverlay = showPPIOverlay && activeCombo ? (
    <div className="scene-ppi-info">
      <span className="scene-ppi-value">PPI {activeCombo.ppi.toFixed(1)} &middot; {activeCombo.span.toFixed(1)}&deg;</span>
      <span className="scene-ppi-planets">
        {activeCombo.planets.map((p) => (
          <span key={p} style={{ color: BODY_META[p]?.color ?? '#aaa' }}>{p.slice(0, 3)}</span>
        ))}
      </span>
    </div>
  ) : null

  // --- Panel manager ---
  const panel = usePanelManager()

  const toggleLandscapeMobileView = useCallback(() => {
    setForceLandscapeMobileView((prev) => {
      const next = !prev
      if (next) {
        setMobileTab('scene')
        setMobileMenuOpen(false)
        setSceneMenuOpen(false)
      }
      return next
    })
  }, [])

  // --- Guided tour ---
  const { startTour, startAdvancedTour } = useTour({ isMobile: effectiveIsMobile, setMobileTab })

  const simTimeValue = useMemo(() => ({
    currentDate, isPlaying, speed,
    setDate: handleSetDate, togglePlay, setSpeed: handleSetSpeed,
  }), [currentDate, isPlaying, speed, handleSetDate, togglePlay, handleSetSpeed])

  const selectionValue = useMemo(() => ({
    selectedBodyId, followMode, selectBody, toggleFollow,
  }), [selectedBodyId, followMode, selectBody, toggleFollow])

  const displayValue = useMemo(() => ({
    showOrbits, showLabels, forceInner,
    showStars, showMilkyWay, showConstellations, showConstellationBoundaries,
    showCones, showPPIOverlay,
    toggleOrbits, toggleLabels, toggleForceInner,
    toggleStars, toggleMilkyWay, toggleConstellations, toggleConstellationBoundaries,
    toggleCones, togglePPIOverlay,
  }), [showOrbits, showLabels, forceInner,
    showStars, showMilkyWay, showConstellations, showConstellationBoundaries,
    showCones, showPPIOverlay,
    toggleOrbits, toggleLabels, toggleForceInner,
    toggleStars, toggleMilkyWay, toggleConstellations, toggleConstellationBoundaries,
    toggleCones, togglePPIOverlay])

  // Shared panel props
  const fp = (id: PanelId) => ({
    id,
    layout: panel.layouts[id],
    zIndex: panel.zIndexMap[id],
    onDragStop: panel.onDragStop,
    onResizeStop: panel.onResizeStop,
    onFocus: panel.onFocus,
    onMinimize: panel.onMinimize,
    onMaximize: panel.onMaximize,
  })

  const sceneViewToggle = (
    <div className="scene-view-toggle">
      <button className={`scene-view-tab${sceneView === 'free' ? ' active' : ''}`} onClick={() => setSceneView('free')}>Solar System</button>
      <button className={`scene-view-tab${sceneView === 'planetarium' ? ' active' : ''}`} onClick={() => setSceneView('planetarium')}>Planetarium</button>
    </div>
  )
  const playbackModeToggle = !isMobile ? (
    <button
      className={`playback-mode-btn${emulateLandscapeMobile ? ' active' : ''}`}
      onClick={toggleLandscapeMobileView}
      title={emulateLandscapeMobile ? 'Return to desktop panel layout' : 'Switch to landscape mobile layout'}
    >
      {emulateLandscapeMobile ? 'Desktop View' : 'Mobile Landscape'}
    </button>
  ) : null
  const showMobilePlaybackBar = emulateLandscapeMobile || (sceneView === 'free' && mobileTab !== 'align')
  const showMobileScene = mobileTab === 'scene'

  const mobileLayout = (
    <div className={`app${emulateLandscapeMobile ? ' app-force-mobile-landscape' : ''}`}>
      <div className="mobile-scene">
        {showMobileScene && (
          <>
            {sceneViewToggle}
            {sceneView === 'free' && (
              <SolarSystemScene
                positions={positions}
                orbitPaths={orbitPaths}
                visibleSeries={alignment.visibleSeries}
                bestPerKind={alignment.bestPerKind}
              />
            )}
            {sceneView === 'planetarium' && (
              <PlanetariumScene
                observer={observer}
                currentDate={currentDate}
                timeZone={observerState.timeZone}
                autoViewResetToken={planetariumViewResetToken}
                onAutoDateChange={handleSetDate}
                targetComboBodies={activeCombo?.planets ?? null}
              />
            )}
            {sceneView === 'free' && (
              <div className="scene-overlay">
                <InfoDisplay selectedBodyId={selectedBodyId} positions={positions} />
                {ppiOverlay}
                <button
                  className="mobile-menu-btn"
                  onClick={() => setMobileMenuOpen((o) => !o)}
                  aria-label="Settings"
                >
                  ☰
                </button>
                {mobileMenuOpen && (
                  <div className="mobile-menu-dropdown">
                    <DisplayToggles />
                    <BodySelector />
                  </div>
                )}
              </div>
            )}
            {sceneView === 'free' && (
              <InnerPlanetsInset
                positions={positions}
                orbitPaths={orbitPaths}
                visibleSeries={alignment.visibleSeries}
                bestPerKind={alignment.bestPerKind}
              />
            )}
            {sceneView === 'planetarium' && (
              <PlanetariumTimeControls
                onDateChange={handleSetDate}
                observer={observer}
                currentDate={currentDate}
                timeZone={observerState.timeZone}
                onOpenLocationPicker={openLocationPicker}
              />
            )}
          </>
        )}
      </div>

      {/* Active panel sheet (overlays scene) */}
      {mobileTab !== 'scene' && (
        <div className={`mobile-sheet${showMobilePlaybackBar ? ' mobile-sheet-with-playback' : ''}`}>
          <div className="mobile-sheet-header">{MOBILE_TAB_TITLES[mobileTab]}</div>
          <div className="mobile-sheet-body">
            {mobileTab === 'align' && (
              <AlignmentPanel
                alignment={alignment}
                currentDate={currentDate}
                timeZone={observerState.timeZone}
                isLandscape={effectiveIsLandscape}
                onPlanetariumResetRequest={requestPlanetariumViewReset}
              />
            )}
            {mobileTab === 'timeline' && (
              <ChartPanel
                alignment={alignment}
                currentDate={currentDate}
                timeZone={observerState.timeZone}
                onDateChange={handleSetDate}
              />
            )}
            {mobileTab === 'sky' && (
              <SkyViewPanel alignment={alignment} currentDate={currentDate} isLandscape={effectiveIsLandscape} />
            )}
            {mobileTab === 'charts' && (
              <SkyChartPanel
                currentDate={currentDate}
                observer={observer}
                timeZone={observerState.timeZone}
                isMobile={effectiveIsMobile}
                isPlaying={isPlaying}
                isLandscape={effectiveIsLandscape}
                onOpenLocationPicker={openLocationPicker}
              />
            )}
          </div>
        </div>
      )}

      {showMobilePlaybackBar && (
        <PlaybackBar
          currentDate={currentDate}
          isPlaying={isPlaying}
          speed={speed}
          togglePlay={togglePlay}
          setSpeed={handleSetSpeed}
          onDateChange={handleSetDate}
          extraActions={emulateLandscapeMobile ? playbackModeToggle : undefined}
        />
      )}

      <div className="mobile-help-btn">
        <HelpButton onStartTour={startTour} onStartAdvancedTour={startAdvancedTour} />
      </div>

      <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
    </div>
  )

  const desktopLayout = (
    <div className="app">
      {/* Floating panels layer */}
      <div className="panels-layer">
        <FloatingPanel {...fp('scene')} title="Space & Sky" minWidth={300} minHeight={200} bodyClassName="scene-panel-body">
          <div className="scene-panel-content">
            {sceneViewToggle}
            <div className="scene-canvas-area">
              {sceneView === 'free' && (
                <SolarSystemScene
                  positions={positions}
                  orbitPaths={orbitPaths}
                  visibleSeries={alignment.visibleSeries}
                  bestPerKind={alignment.bestPerKind}
                />
              )}
              {sceneView === 'planetarium' && (
                <PlanetariumScene
                  observer={observer}
                  currentDate={currentDate}
                  timeZone={observerState.timeZone}
                  autoViewResetToken={planetariumViewResetToken}
                  onAutoDateChange={handleSetDate}
                  targetComboBodies={activeCombo?.planets ?? null}
                />
              )}
            </div>
            {sceneView === 'free' && (
              <div className="scene-overlay">
                <InfoDisplay selectedBodyId={selectedBodyId} positions={positions} />
                {ppiOverlay}
                <button
                  className="scene-menu-btn"
                  onClick={() => setSceneMenuOpen((o) => !o)}
                  aria-label="Settings"
                >
                  ☰
                </button>
                {sceneMenuOpen && (
                  <div className="scene-menu-dropdown">
                    <DisplayToggles />
                    <BodySelector />
                  </div>
                )}
              </div>
            )}
            {sceneView === 'free' && <InnerPlanetsInset positions={positions} orbitPaths={orbitPaths} visibleSeries={alignment.visibleSeries} bestPerKind={alignment.bestPerKind} />}
            {sceneView === 'planetarium' && (
              <PlanetariumTimeControls
                onDateChange={handleSetDate}
                observer={observer}
                currentDate={currentDate}
                timeZone={observerState.timeZone}
                onOpenLocationPicker={openLocationPicker}
              />
            )}
          </div>
        </FloatingPanel>

        <FloatingPanel {...fp('controls')} title="Alignments" minWidth={220} minHeight={200}>
          <AlignmentPanel
            alignment={alignment}
            currentDate={currentDate}
            timeZone={observerState.timeZone}
            isLandscape={effectiveIsLandscape}
            onPlanetariumResetRequest={requestPlanetariumViewReset}
          />
        </FloatingPanel>

        <FloatingPanel {...fp('chart')} title="Parade Timeline" minWidth={400} minHeight={160}>
          <ChartPanel
            alignment={alignment}
            currentDate={currentDate}
            timeZone={observerState.timeZone}
            onDateChange={handleSetDate}
          />
        </FloatingPanel>

        <FloatingPanel {...fp('skyview')} title="Ecliptic Strip" minWidth={300} minHeight={200}>
          <SkyViewPanel alignment={alignment} currentDate={currentDate} isLandscape={effectiveIsLandscape} />
        </FloatingPanel>

        <FloatingPanel {...fp('skychart')} title="Sky Charts" minWidth={300} minHeight={200} bodyClassName="skychart-panel-body">
          <SkyChartPanel
            currentDate={currentDate}
            observer={observer}
            timeZone={observerState.timeZone}
            isMobile={effectiveIsMobile}
            isPlaying={isPlaying}
            isLandscape={effectiveIsLandscape}
            onOpenLocationPicker={openLocationPicker}
          />
        </FloatingPanel>

        <PlaybackBar
          currentDate={currentDate}
          isPlaying={isPlaying}
          speed={speed}
          togglePlay={togglePlay}
          setSpeed={handleSetSpeed}
          onDateChange={handleSetDate}
          extraActions={
            <>
              {playbackModeToggle}
              <button className="reset-layout-btn" onClick={panel.resetLayout}>
                Reset Layout
              </button>
              <HelpButton onStartTour={startTour} onStartAdvancedTour={startAdvancedTour} />
            </>
          }
        />

      </div>
    </div>
  )

  return (
    <SimulationTimeContext.Provider value={simTimeValue}>
      <SelectionContext.Provider value={selectionValue}>
        <DisplaySettingsContext.Provider value={displayValue}>
          {effectiveIsMobile ? mobileLayout : desktopLayout}
          <LocationPickerModal
            open={locationPickerOpen}
            observerState={observerState}
            onClose={closeLocationPicker}
            onUseBrowserLocation={requestBrowserLocation}
            onApplyManualLocation={setManualLocation}
            onApplySearchLocation={setOsmLocation}
            onResetLocation={resetToDefault}
          />
        </DisplaySettingsContext.Provider>
      </SelectionContext.Provider>
    </SimulationTimeContext.Provider>
  )
}
