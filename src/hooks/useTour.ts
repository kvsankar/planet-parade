import { useCallback, useEffect, useRef } from 'react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import type { MobileTab } from '../components/ui/MobileTabBar'

const STORAGE_KEY = 'solar-tour-seen'

/* ─── Step definition with optional mobile overrides ─── */

interface TourStepDef {
  element?: string
  mobileElement?: string
  mobileTab?: MobileTab
  popover: {
    title: string
    description: string
    side?: 'top' | 'bottom' | 'left' | 'right'
  }
}

function toDriverSteps(defs: TourStepDef[], isMobile: boolean): DriveStep[] {
  return defs.map((d) => ({
    element: isMobile ? (d.mobileElement ?? d.element) : d.element,
    popover: { ...d.popover, side: d.popover.side as DriveStep['popover'] extends infer P ? P extends { side?: infer S } ? S : never : never },
  })) as DriveStep[]
}

/* ─── Basic tour (7 steps — panel-level overview) ─── */

const basicDefs: TourStepDef[] = [
  {
    popover: {
      title: 'Planetary Alignment Explorer',
      description:
        'When can you step outside and see most \u2014 or all \u2014 of the planets at once, without spending hours waiting? This app finds those windows by measuring how tightly the planets cluster in the sky over any time range you choose.',
    },
  },
  {
    element: '[data-tour="controls"]',
    mobileElement: '.alignment-panel-inner',
    mobileTab: 'align',
    popover: {
      title: 'Alignments Panel',
      description:
        'Select which planets to include and set a time range to scan. The app finds the dates when they\'re grouped most tightly \u2014 the best nights to see them all in one look.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="scene"]',
    mobileElement: '.mobile-scene',
    mobileTab: 'scene',
    popover: {
      title: 'Solar System View',
      description:
        'A 3D view of the solar system showing where the planets actually are in their orbits. Scroll to zoom, drag to orbit the view, and click a planet to select it.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="chart"]',
    mobileElement: '.chart-panel-inner',
    mobileTab: 'timeline',
    popover: {
      title: 'Alignment Timeline',
      description:
        'Shows angular separation between your selected planets over time. Dips in the chart are the dates when planets cluster closest together in the sky \u2014 click a minimum to jump to that date.',
      side: 'left',
    },
  },
  {
    element: '[data-tour="skyview"]',
    mobileElement: '.sky-view',
    mobileTab: 'sky',
    popover: {
      title: 'Sky View',
      description:
        'A hemispheric projection of the sky as seen from Earth. See at a glance whether your chosen planets fit within a narrow arc of sky or are scattered wide apart.',
      side: 'left',
    },
  },
  {
    element: '[data-tour="skychart"]',
    mobileElement: '.skychart-panel',
    mobileTab: 'charts',
    popover: {
      title: 'Sky Charts',
      description:
        'Altitude and azimuth charts showing each planet\'s path across the sky throughout the day. Use these to check if the planets are above the horizon at a convenient hour \u2014 evening, morning, or both.',
      side: 'left',
    },
  },
  {
    element: '.playback-bar',
    mobileTab: 'timeline',
    popover: {
      title: 'Playback Controls',
      description:
        'Animate time forward or backward to watch the planets converge and spread apart. Use the date picker to jump to any date, or let playback run to see alignments form and dissolve.',
      side: 'top',
    },
  },
]

/* ─── Advanced tour (~20 steps — feature-level deep dive) ─── */

const advancedDefs: TourStepDef[] = [
  // --- Intro ---
  {
    popover: {
      title: 'Full Feature Tour',
      description:
        'This tour walks through every major feature across all panels. Use \u2190 \u2192 to navigate at your own pace.',
    },
  },
  // --- Alignments Panel ---
  {
    element: '.planet-chips',
    mobileTab: 'align',
    popover: {
      title: 'Planet Picker',
      description:
        'Toggle planets on/off to include them in alignment searches. At least two must be selected. Active chips are highlighted.',
      side: 'right',
    },
  },
  {
    element: '.time-range-selector',
    mobileTab: 'align',
    popover: {
      title: 'Time Range',
      description:
        'Set the start date and duration for the alignment search window. Choose a preset (1 yr, 5 yr, \u2026) or enter a custom range.',
      side: 'right',
    },
  },
  {
    element: '.series-toggle-chips',
    mobileTab: 'align',
    popover: {
      title: 'Series Toggle \u2014 All / AM / PM',
      description:
        'Filter alignments by visibility. "AM" = visible before sunrise, "PM" = after sunset, "All" = both. Colors match the chart traces.',
      side: 'right',
    },
  },
  {
    element: '.min-planets-chips',
    mobileTab: 'align',
    popover: {
      title: 'Minimum Planets',
      description:
        'Set the minimum number of planets that must be tightly grouped for an event to count as an alignment. Higher values find rarer groupings.',
      side: 'right',
    },
  },
  {
    element: '.minima-table',
    mobileTab: 'align',
    popover: {
      title: 'Minima Table',
      description:
        'Lists the best alignment events sorted by angular separation. Click any row to jump the simulation to that date. The "Kind" column shows AM or PM visibility.',
      side: 'right',
    },
  },
  // --- Solar System View ---
  {
    element: '[data-tour="scene"]',
    mobileElement: '.mobile-scene',
    mobileTab: 'scene',
    popover: {
      title: '3D Solar System',
      description:
        'Drag to orbit, scroll to zoom. Planet positions update in real-time as the simulation date changes. Colored cones from the Sun show how tightly the selected planets are clustered.',
      side: 'bottom',
    },
  },
  {
    element: '.scene-overlay',
    mobileTab: 'scene',
    popover: {
      title: 'Display Toggles & Body Selector',
      description:
        'Toggle orbit paths and labels on/off. Click a planet name to select it and see its distance. Enable "Follow" to keep the camera locked on a planet.',
      side: 'right',
    },
  },
  {
    element: '.inner-planets-inset',
    mobileTab: 'scene',
    popover: {
      title: 'Inner Planets Inset',
      description:
        'A zoomed-in view of Mercury through Mars in the bottom-right corner. Useful when the main view is zoomed out to see outer planets.',
      side: 'left',
    },
  },
  // --- Alignment Timeline ---
  {
    element: '.separation-chart',
    mobileTab: 'timeline',
    popover: {
      title: 'Separation Chart',
      description:
        'Plots angular separation over time. Lower = tighter alignment. The golden vertical line marks the current simulation date.',
      side: 'top',
    },
  },
  {
    element: '[data-tour="chart"] .sky-zoom-controls',
    mobileElement: '.chart-zoom-header .sky-zoom-controls',
    mobileTab: 'timeline',
    popover: {
      title: 'Chart Zoom & Pan',
      description:
        'Use + / \u2212 to zoom into a time period, then drag horizontally to pan. Scroll wheel also works. Double-click to reset zoom.',
      side: 'bottom',
    },
  },
  {
    element: '.chart-controls-row',
    mobileTab: 'timeline',
    popover: {
      title: 'Timeline Controls',
      description:
        'Shows the visible date range and provides series toggles and navigation buttons to step through alignment minima.',
      side: 'top',
    },
  },
  // --- Sky View ---
  {
    element: '.sky-view-chart-area',
    mobileTab: 'sky',
    popover: {
      title: 'Ecliptic Longitude Plot',
      description:
        'Shows planet positions projected onto the ecliptic. Planets near each other here appear close in the real sky. AM/PM background shading shows morning vs. evening visibility.',
      side: 'top',
    },
  },
  {
    element: '[data-tour="skyview"] .sky-view-controls',
    mobileElement: '.sky-view-controls',
    mobileTab: 'sky',
    popover: {
      title: 'Sky View Controls',
      description:
        'Zoom in to see tight groupings. The "Center" dropdown re-centers the view on a chosen planet. Cone toggles show angular-span brackets.',
      side: 'bottom',
    },
  },
  {
    element: '.sky-view-table-area',
    mobileTab: 'sky',
    popover: {
      title: 'Position Data Table',
      description:
        'Lists ecliptic longitude and positional data for each planet at the current simulation date. Drag the separator bar to resize.',
      side: 'top',
    },
  },
  // --- Sky Charts ---
  {
    element: '.skychart-pair',
    mobileTab: 'charts',
    popover: {
      title: 'Morning & Evening Sky Charts',
      description:
        'Horizon-to-zenith charts for the AM (east) and PM (west) sky. Stars are sized by brightness. The curved ecliptic line shows the Sun\'s path \u2014 planets stay near it.',
      side: 'top',
    },
  },
  {
    element: '.skychart-controls-bar',
    mobileTab: 'charts',
    popover: {
      title: 'Sky Chart Controls',
      description:
        'Toggle stars, constellation lines/labels, Milky Way, and planets. Zoom in to see finer detail and the Moon with its correct phase.',
      side: 'top',
    },
  },
  // --- Playback ---
  {
    element: '.playback-bar .play-btn',
    mobileTab: 'timeline',
    popover: {
      title: 'Play / Pause',
      description:
        'Start or stop the time animation. While playing, the simulation date advances and all views update in real-time.',
      side: 'top',
    },
  },
  {
    element: '.playback-bar .speed-select',
    mobileTab: 'timeline',
    popover: {
      title: 'Speed Selector',
      description:
        'Choose how fast time advances: from 1 day/sec for slow observation up to 365 days/sec for scanning through years.',
      side: 'top',
    },
  },
  {
    element: '.playback-bar',
    mobileTab: 'timeline',
    popover: {
      title: 'Step Navigation',
      description:
        'Use the \u00b11d and \u00b15d buttons to step through time precisely. The date picker lets you jump to any date. "Today" resets to the current date.',
      side: 'top',
    },
  },
]

/* ─── Hook ─── */

interface UseTourOptions {
  isMobile: boolean
  setMobileTab: (tab: MobileTab) => void
}

export function useTour({ isMobile, setMobileTab }: UseTourOptions) {
  const driverRef = useRef<Driver | null>(null)
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile

  const runTour = useCallback((defs: TourStepDef[]) => {
    if (driverRef.current) {
      driverRef.current.destroy()
    }

    const mobile = isMobileRef.current
    const steps = toDriverSteps(defs, mobile)

    const switchTabAndMove = (targetIndex: number, move: () => void) => {
      const def = defs[targetIndex]
      if (mobile && def?.mobileTab) {
        setMobileTab(def.mobileTab)
        // Wait for React to render the new tab content
        setTimeout(move, 80)
      } else {
        move()
      }
    }

    const d = driver({
      showProgress: true,
      smoothScroll: true,
      allowClose: true,
      disableActiveInteraction: true,
      stagePadding: 6,
      stageRadius: 8,
      overlayOpacity: 0.6,
      steps,
      onNextClick: () => {
        const nextIdx = (d.getActiveIndex() ?? 0) + 1
        if (nextIdx < steps.length) {
          switchTabAndMove(nextIdx, () => d.moveNext())
        } else {
          d.moveNext() // will close the tour
        }
      },
      onPrevClick: () => {
        const prevIdx = (d.getActiveIndex() ?? 0) - 1
        if (prevIdx >= 0) {
          switchTabAndMove(prevIdx, () => d.movePrevious())
        }
      },
      onDestroyed: () => {
        localStorage.setItem(STORAGE_KEY, '1')
      },
    })

    driverRef.current = d

    // Switch to the first step's tab before starting
    const firstDef = defs[0]
    if (mobile && firstDef?.mobileTab) {
      setMobileTab(firstDef.mobileTab)
      setTimeout(() => d.drive(), 80)
    } else {
      d.drive()
    }
  }, [setMobileTab])

  const startTour = useCallback(() => runTour(basicDefs), [runTour])
  const startAdvancedTour = useCallback(() => runTour(advancedDefs), [runTour])

  // Auto-start basic tour on first visit
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return

    const timer = setTimeout(() => {
      startTour()
    }, 800)

    return () => clearTimeout(timer)
  }, [startTour])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy()
      }
    }
  }, [])

  return { startTour, startAdvancedTour }
}
