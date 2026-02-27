import { useCallback, useEffect, useRef } from 'react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const STORAGE_KEY = 'solar-tour-seen'

/* ─── Basic tour (7 steps — panel-level overview) ─── */

const basicSteps: DriveStep[] = [
  {
    popover: {
      title: 'Planetary Alignment Explorer',
      description:
        'When can you step outside and see most — or all — of the planets at once, without spending hours waiting? This app finds those windows by measuring how tightly the planets cluster in the sky over any time range you choose.',
    },
  },
  {
    element: '[data-tour="controls"]',
    popover: {
      title: 'Alignments Panel',
      description:
        'Select which planets to include and set a time range to scan. The app measures how spread out they are in the sky and finds the dates when they\'re grouped most tightly \u2014 the best nights to see them all in one look.',
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="scene"]',
    popover: {
      title: 'Solar System View',
      description:
        'A 3D view of the solar system showing where the planets actually are in their orbits. Scroll to zoom, drag to orbit the view, and click a planet to select it.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="chart"]',
    popover: {
      title: 'Alignment Timeline',
      description:
        'Shows angular separation between your selected planets over time. Dips in the chart are the dates when planets cluster closest together in the sky — click a minimum to jump to that date.',
      side: 'left' as const,
    },
  },
  {
    element: '[data-tour="skyview"]',
    popover: {
      title: 'Sky View',
      description:
        'A hemispheric projection of the sky as seen from Earth. See at a glance whether your chosen planets fit within a narrow arc of sky or are scattered wide apart.',
      side: 'left' as const,
    },
  },
  {
    element: '[data-tour="skychart"]',
    popover: {
      title: 'Sky Charts',
      description:
        'Altitude and azimuth charts showing each planet\'s path across the sky throughout the day. Use these to check if the planets are above the horizon at a convenient hour \u2014 evening, morning, or both.',
      side: 'left' as const,
    },
  },
  {
    element: '.playback-bar',
    popover: {
      title: 'Playback Controls',
      description:
        'Animate time forward or backward to watch the planets converge and spread apart. Use the date picker to jump to any date, or let playback run to see alignments form and dissolve.',
      side: 'top' as const,
    },
  },
]

/* ─── Advanced tour (~20 steps — feature-level deep dive) ─── */

const advancedSteps: DriveStep[] = [
  // --- Alignments Panel ---
  {
    popover: {
      title: 'Full Feature Tour',
      description:
        'This tour walks through every major feature across all panels. Use ← → to navigate at your own pace.',
    },
  },
  {
    element: '.planet-chips',
    popover: {
      title: 'Planet Picker',
      description:
        'Toggle planets on/off to include them in alignment searches. At least two must be selected. Active chips are highlighted.',
      side: 'right' as const,
    },
  },
  {
    element: '.time-range-selector',
    popover: {
      title: 'Time Range',
      description:
        'Set the start date and duration for the alignment search window. Choose a preset (1 yr, 5 yr, …) or enter a custom range.',
      side: 'right' as const,
    },
  },
  {
    element: '.series-toggle-chips',
    popover: {
      title: 'Series Toggle — All / AM / PM',
      description:
        'Filter alignments by visibility. "AM" = visible before sunrise, "PM" = after sunset, "All" = both. Colors match the chart traces.',
      side: 'right' as const,
    },
  },
  {
    element: '.min-planets-chips',
    popover: {
      title: 'Minimum Planets',
      description:
        'Set the minimum number of planets that must be tightly grouped for an event to count as an alignment. Higher values find rarer groupings.',
      side: 'right' as const,
    },
  },
  {
    element: '.minima-table',
    popover: {
      title: 'Minima Table',
      description:
        'Lists the best alignment events sorted by angular separation. Click any row to jump the simulation to that date. The "Kind" column shows AM or PM visibility.',
      side: 'right' as const,
    },
  },
  // --- Solar System View ---
  {
    element: '[data-tour="scene"]',
    popover: {
      title: '3D Solar System',
      description:
        'Drag to orbit, scroll to zoom. Planet positions update in real-time as the simulation date changes. Colored cones from the Sun show how tightly the selected planets are clustered.',
      side: 'bottom' as const,
    },
  },
  {
    element: '.scene-overlay',
    popover: {
      title: 'Display Toggles & Body Selector',
      description:
        'Toggle orbit paths and labels on/off. Click a planet name to select it and see its distance. Enable "Follow" to keep the camera locked on a planet.',
      side: 'right' as const,
    },
  },
  {
    element: '.inner-planets-inset',
    popover: {
      title: 'Inner Planets Inset',
      description:
        'A zoomed-in view of Mercury through Mars in the bottom-right corner. Useful when the main view is zoomed out to see outer planets.',
      side: 'left' as const,
    },
  },
  // --- Alignment Timeline ---
  {
    element: '.separation-chart',
    popover: {
      title: 'Separation Chart',
      description:
        'Plots angular separation over time. Lower = tighter alignment. The golden vertical line marks the current simulation date.',
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="chart"] .sky-zoom-controls',
    popover: {
      title: 'Chart Zoom & Pan',
      description:
        'Use + / − to zoom into a time period, then drag horizontally to pan. Scroll wheel also works. Double-click to reset zoom.',
      side: 'bottom' as const,
    },
  },
  {
    element: '.chart-controls-row',
    popover: {
      title: 'Timeline Controls',
      description:
        'Shows the visible date range and provides series toggles and navigation buttons to step through alignment minima.',
      side: 'top' as const,
    },
  },
  // --- Sky View ---
  {
    element: '.sky-view-chart-area',
    popover: {
      title: 'Ecliptic Longitude Plot',
      description:
        'Shows planet positions projected onto the ecliptic. Planets near each other here appear close in the real sky. AM/PM background shading shows morning vs. evening visibility.',
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="skyview"] .sky-view-controls',
    popover: {
      title: 'Sky View Controls',
      description:
        'Zoom in to see tight groupings. The "Center" dropdown re-centers the view on a chosen planet. Cone toggles show angular-span brackets.',
      side: 'bottom' as const,
    },
  },
  {
    element: '.sky-view-table-area',
    popover: {
      title: 'Position Data Table',
      description:
        'Lists ecliptic longitude and positional data for each planet at the current simulation date. Drag the separator bar to resize.',
      side: 'top' as const,
    },
  },
  // --- Sky Charts ---
  {
    element: '.skychart-pair',
    popover: {
      title: 'Morning & Evening Sky Charts',
      description:
        'Horizon-to-zenith charts for the AM (east) and PM (west) sky. Stars are sized by brightness. The curved ecliptic line shows the Sun\'s path — planets stay near it.',
      side: 'top' as const,
    },
  },
  {
    element: '.skychart-zoom',
    popover: {
      title: 'Sky Chart Zoom',
      description:
        'Zoom in to see finer star detail, constellation lines, the Milky Way band, and the Moon drawn with its correct phase.',
      side: 'left' as const,
    },
  },
  // --- Playback ---
  {
    element: '.playback-bar .play-btn',
    popover: {
      title: 'Play / Pause',
      description:
        'Start or stop the time animation. While playing, the simulation date advances and all views update in real-time.',
      side: 'top' as const,
    },
  },
  {
    element: '.playback-bar .speed-select',
    popover: {
      title: 'Speed Selector',
      description:
        'Choose how fast time advances: from 1 day/sec for slow observation up to 365 days/sec for scanning through years.',
      side: 'top' as const,
    },
  },
  {
    element: '.playback-bar',
    popover: {
      title: 'Step Navigation',
      description:
        'Use the ±1d and ±5d buttons to step through time precisely. The date picker lets you jump to any date. "Today" resets to the current date.',
      side: 'top' as const,
    },
  },
]

/* ─── Hook ─── */

export function useTour() {
  const driverRef = useRef<Driver | null>(null)

  const runTour = useCallback((steps: DriveStep[]) => {
    if (driverRef.current) {
      driverRef.current.destroy()
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
      onDestroyed: () => {
        localStorage.setItem(STORAGE_KEY, '1')
      },
    })

    driverRef.current = d
    d.drive()
  }, [])

  const startTour = useCallback(() => runTour(basicSteps), [runTour])
  const startAdvancedTour = useCallback(() => runTour(advancedSteps), [runTour])

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
