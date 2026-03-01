import { useCallback, useEffect, useRef } from 'react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import type { MobileTab } from '../components/ui/MobileTabBar'

const STORAGE_KEY = 'planet-parade-tour-seen'

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
      title: 'Planet Parade',
      description:
        'When can you step outside and see most \u2014 or all \u2014 of the planets at once? This app finds those windows by computing the tightest planet clusters for every combination size across any time range you choose.',
    },
  },
  {
    element: '[data-tour="controls"]',
    mobileElement: '.alignment-panel-inner',
    mobileTab: 'align',
    popover: {
      title: 'Alignments Panel',
      description:
        'Pick planets, set a time range, and choose the minimum group size. The app evaluates every combination and finds the dates with the tightest clusters \u2014 classified as AM (pre-dawn), PM (post-sunset), or Straddling (spanning the Sun).',
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
        'A 3D view of the solar system showing where the planets actually are in their orbits. Colored cones show the best cluster for each visibility category. Scroll to zoom, drag to orbit.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="chart"]',
    mobileElement: '.chart-panel-inner',
    mobileTab: 'timeline',
    popover: {
      title: 'Parade Timeline',
      description:
        'Plots PPI and angular span over time. Toggle Simple/Advanced to see overall or per-count lines. Click a dip to jump to that date.',
      side: 'left',
    },
  },
  {
    element: '[data-tour="skyview"]',
    mobileElement: '.sky-view',
    mobileTab: 'sky',
    popover: {
      title: 'Ecliptic Strip',
      description:
        'An ecliptic projection of the sky as seen from Earth. Shaded bands show the best cluster for each category at the current date. Planets not in the active combination are dimmed.',
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
        'Animate time forward or backward to watch clusters form and dissolve. Use the date picker to jump to any date, or step through alignment minima with Prev/Next.',
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
        'Toggle planets on/off to include them in alignment searches. At least two must be selected. The app evaluates every combination of the selected planets.',
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
      title: 'Series Toggle \u2014 AM / PM / Straddle',
      description:
        'Filter alignments by visibility category. "AM" = visible before sunrise, "PM" = after sunset, "Straddle" = planets span both sides of the Sun. Colors match the chart lines and shading.',
      side: 'right',
    },
  },
  {
    element: '.min-planets-chips',
    mobileTab: 'align',
    popover: {
      title: 'Minimum Planets',
      description:
        'Set the minimum combination size. With 7 planets selected and min 5, the app computes tabs for 7-, 6-, and 5-planet combinations. Greyed-out values exceed the computation limit.',
      side: 'right',
    },
  },
  {
    element: '.minima-table',
    mobileTab: 'align',
    popover: {
      title: 'Closest Alignments Table',
      description:
        'Lists the tightest alignment events across all combination sizes. The # column shows planet count, Planets shows which ones (hover for names). Click a row to jump to that date and switch to its tab. Use the filter chips to show/hide specific counts. Sort by date, span, or count.',
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
        'Drag to orbit, scroll to zoom. Colored cones from Earth show the best cluster for each visibility category (AM/PM/Straddle). The cones update as the combination tab changes.',
      side: 'bottom',
    },
  },
  {
    element: '.scene-overlay',
    mobileTab: 'scene',
    popover: {
      title: 'Display Toggles & Body Selector',
      description:
        'Open the \u2630 menu to toggle orbits, labels, stars, constellations, and alignment cones. Click a planet name to select it and see its distance.',
      side: 'right',
    },
  },
  {
    element: '.inner-planets-inset',
    mobileTab: 'scene',
    popover: {
      title: 'Inner Planets Inset',
      description:
        'A zoomed-in view of Mercury through Mars. Shows alignment cones in the same colors as the main view. Useful when the main camera is zoomed out to see outer planets.',
      side: 'left',
    },
  },
  // --- Parade Timeline ---
  {
    element: '.separation-chart',
    mobileTab: 'timeline',
    popover: {
      title: 'Separation Chart',
      description:
        'Plots the tightest angular span over time for each category: AM (orange), PM (blue), Straddle (red). Lower = tighter cluster. The golden line marks the current date. Click a point to jump to it.',
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
        'Use + / \u2212 to zoom into a time period, then drag to pan. Ctrl+scroll also works. Click the multiplier button to reset zoom.',
      side: 'bottom',
    },
  },
  {
    element: '.chart-controls-row',
    mobileTab: 'timeline',
    popover: {
      title: 'Timeline Controls',
      description:
        'Shows the active date range for each visible series. Use Prev/Next to step through minima within the current tab. The series toggles filter AM/PM/Straddle lines.',
      side: 'top',
    },
  },
  // --- Ecliptic Strip ---
  {
    element: '.sky-view-chart-area',
    mobileTab: 'sky',
    popover: {
      title: 'Ecliptic Longitude Plot',
      description:
        'Shows planet positions on the ecliptic as seen from Earth. Shaded bands highlight the best cluster for each visible category (AM/PM/Straddle). Planets outside the active combination are dimmed. Span annotations below the axis show arc widths.',
      side: 'top',
    },
  },
  {
    element: '[data-tour="skyview"] .sky-view-controls',
    mobileElement: '.sky-view-controls',
    mobileTab: 'sky',
    popover: {
      title: 'Ecliptic Strip Controls',
      description:
        'Use zoom +/\u2212 to focus on tight groupings. The Center dropdown re-centers the plot on 0\u00b0 longitude or on the Sun.',
      side: 'bottom',
    },
  },
  {
    element: '.sky-view-table-area',
    mobileTab: 'sky',
    popover: {
      title: 'Position Data Table',
      description:
        'Lists each planet\'s ecliptic longitude, latitude, elongation from the Sun, visual magnitude, and AM/PM status. Drag the separator bar to resize the chart vs. table split.',
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
        'Stereographic charts for the AM (east) and PM (west) sky. Stars are sized by brightness. The curved ecliptic line shows the Sun\'s path \u2014 planets stay near it.',
      side: 'top',
    },
  },
  {
    element: '.skychart-controls-bar',
    mobileTab: 'charts',
    popover: {
      title: 'Sky Chart Controls',
      description:
        'Toggle stars, constellation lines/labels, Milky Way texture, and planet markers. Zoom in to see finer detail and the Moon with its correct phase.',
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
        'Start or stop the time animation. While playing, all panels update in sync \u2014 watch clusters form and dissolve in the 3D view, timeline, and sky view simultaneously.',
      side: 'top',
    },
  },
  {
    element: '.playback-bar .speed-select',
    mobileTab: 'timeline',
    popover: {
      title: 'Speed Selector',
      description:
        'Choose how fast time advances: from 1 day/sec for careful observation up to 3650 days/sec (10 yr/sec) for scanning across decades.',
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
