import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { PPIWeights } from '../../types'
import { DEFAULT_PPI_WEIGHTS } from '../../lib/ppiScoring'

interface PPISlidersProps {
  weights: PPIWeights
  onChange: (w: PPIWeights) => void
}

export default memo(function PPISliders({ weights, onChange }: PPISlidersProps) {
  const [localAlpha, setLocalAlpha] = useState(weights.alpha)
  const [localGamma, setLocalGamma] = useState(weights.gamma)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state when weights change externally
  useEffect(() => {
    setLocalAlpha(weights.alpha)
    setLocalGamma(weights.gamma)
  }, [weights.alpha, weights.gamma])

  const debounceEmit = useCallback((alpha: number, gamma: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange({ alpha, beta: 2.4 - alpha, gamma, spanScale: weights.spanScale })
    }, 300)
  }, [onChange])

  const handleAlpha = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setLocalAlpha(v)
    debounceEmit(v, localGamma)
  }, [debounceEmit, localGamma])

  const handleGamma = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setLocalGamma(v)
    debounceEmit(localAlpha, v)
  }, [debounceEmit, localAlpha])

  const isModified = localAlpha !== DEFAULT_PPI_WEIGHTS.alpha || localGamma !== DEFAULT_PPI_WEIGHTS.gamma

  const handleReset = useCallback(() => {
    setLocalAlpha(DEFAULT_PPI_WEIGHTS.alpha)
    setLocalGamma(DEFAULT_PPI_WEIGHTS.gamma)
    if (timerRef.current) clearTimeout(timerRef.current)
    onChange({ ...DEFAULT_PPI_WEIGHTS })
  }, [onChange])

  return (
    <div className="ppi-sliders">
      <span className="control-label">
        Parade Scoring
        {isModified && (
          <button className="ppi-reset-btn" onClick={handleReset} title="Reset to defaults">
            Reset
          </button>
        )}
      </span>
      <div className="ppi-slider-row">
        <span className="ppi-slider-label">Count</span>
        <input
          type="range"
          className="ppi-slider"
          min={0.4}
          max={2.0}
          step={0.4}
          value={localAlpha}
          onChange={handleAlpha}
        />
        <span className="ppi-slider-label">Tightness</span>
      </div>
      <div className="ppi-slider-row">
        <span className="ppi-slider-label">All equal</span>
        <input
          type="range"
          className="ppi-slider"
          min={0}
          max={2}
          step={0.5}
          value={localGamma}
          onChange={handleGamma}
        />
        <span className="ppi-slider-label">Bright</span>
      </div>
    </div>
  )
})
