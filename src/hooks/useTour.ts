import { useCallback, useEffect, useRef } from 'react'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const STORAGE_KEY = 'solar-tour-seen'

const steps = [
  {
    popover: {
      title: 'Planetary Alignment Explorer',
      description:
        'When can you step outside and see most \u2014 or all \u2014 of the planets at once, without spending hours waiting? This app finds those windows by measuring how tightly the planets cluster in the sky over any time range you choose.',
    },
  },
  {
    element: '[data-tour="controls"]',
    popover: {
      title: 'Alignments Panel',
      description:
        'Select which planets to include and set a time range to scan. The app measures how spread out they are in the sky and finds the dates when they\u2019re grouped most tightly \u2014 the best nights to see them all in one look.',
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
        'Shows angular separation between your selected planets over time. Dips in the chart are the dates when planets cluster closest together in the sky \u2014 click a minimum to jump to that date.',
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
        'Altitude and azimuth charts showing each planet\u2019s path across the sky throughout the day. Use these to check if the planets are above the horizon at a convenient hour \u2014 evening, morning, or both.',
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

export function useTour() {
  const driverRef = useRef<Driver | null>(null)

  const startTour = useCallback(() => {
    // Destroy any existing instance
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

  // Auto-start on first visit
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

  return { startTour }
}
