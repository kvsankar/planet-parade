interface PlanetCountRangeProps {
  bodyCount: number
  effectiveMin: number
  effectiveMax: number
  setMinPlanets: (n: number) => void
  setMaxPlanets: (n: number) => void
  compact?: boolean
}

export default function PlanetCountRange({ bodyCount, effectiveMin, effectiveMax, setMinPlanets, setMaxPlanets, compact }: PlanetCountRangeProps) {
  if (bodyCount <= 2) return null

  const handleClick = (n: number) => {
    if (n >= effectiveMin && n <= effectiveMax) {
      setMinPlanets(n)
      setMaxPlanets(n)
    } else if (n < effectiveMin) {
      setMinPlanets(n)
    } else {
      setMaxPlanets(n)
    }
  }

  const chips = (
    <div className="min-planets-chips">
      {Array.from({ length: bodyCount - 1 }, (_, i) => i + 2).map((n) => (
        <button
          key={n}
          className={`min-planet-chip ${n >= effectiveMin && n <= effectiveMax ? 'active' : ''}`}
          onClick={() => handleClick(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )

  if (compact) return chips

  return (
    <div className="min-planets-control">
      <label className="control-label">
        Body Count
        <span className="planet-range-label">{effectiveMin === effectiveMax ? effectiveMin : `${effectiveMin}\u2013${effectiveMax}`}</span>
      </label>
      {chips}
    </div>
  )
}
