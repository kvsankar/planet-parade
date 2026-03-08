import { useState } from 'react'
import { DURATION_PRESETS } from '../../constants'

type DurationUnit = 'days' | 'months' | 'years'

interface TimeRangeSelectorProps {
  startDate: Date
  durationDays: number
  onStartDateChange: (d: Date) => void
  onDurationChange: (days: number) => void
}

function unitToDays(value: number, unit: DurationUnit): number {
  switch (unit) {
    case 'days': return Math.round(value)
    case 'months': return Math.round(value * 30.44)
    case 'years': return Math.round(value * 365.25)
  }
}

function daysToUnit(days: number, unit: DurationUnit): number {
  switch (unit) {
    case 'days': return days
    case 'months': return Math.round((days / 30.44) * 10) / 10
    case 'years': return Math.round((days / 365.25) * 10) / 10
  }
}

export default function TimeRangeSelector({
  startDate,
  durationDays,
  onStartDateChange,
  onDurationChange,
}: TimeRangeSelectorProps) {
  const dateStr = startDate.toISOString().slice(0, 10)
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [unit, setUnit] = useState<DurationUnit>('days')
  const [customValue, setCustomValue] = useState(() => String(daysToUnit(durationDays, 'days')))

  const handlePresetChange = (days: number) => {
    onDurationChange(days)
    setCustomValue(String(days))
    setUnit('days')
  }

  const handleCustomValueChange = (val: string) => {
    setCustomValue(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      onDurationChange(unitToDays(num, unit))
    }
  }

  const handleUnitChange = (newUnit: DurationUnit) => {
    const num = parseFloat(customValue)
    if (!isNaN(num) && num > 0) {
      // Convert the current value to days, then to the new unit
      const days = unitToDays(num, unit)
      setUnit(newUnit)
      setCustomValue(String(daysToUnit(days, newUnit)))
    } else {
      setUnit(newUnit)
    }
  }

  return (
    <div className="time-range-selector">
      <div className="time-range-row">
        <label className="control-label">Start Date</label>
        <input
          type="date"
          className="date-input"
          value={dateStr}
          onChange={(e) => {
            const d = new Date(e.target.value + 'T00:00:00Z')
            if (!isNaN(d.getTime())) onStartDateChange(d)
          }}
        />
      </div>
      <div className="time-range-row">
        <label className="control-label">Duration</label>
        <div className="duration-mode-tabs">
          <button
            className={`duration-mode-tab ${mode === 'preset' ? 'active' : ''}`}
            onClick={() => setMode('preset')}
          >
            Preset
          </button>
          <button
            className={`duration-mode-tab ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => {
              setMode('custom')
              setCustomValue(String(daysToUnit(durationDays, unit)))
            }}
          >
            Custom
          </button>
        </div>
        {mode === 'preset' ? (
          <select
            className="speed-select"
            value={durationDays}
            onChange={(e) => handlePresetChange(Number(e.target.value))}
          >
            {DURATION_PRESETS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="duration-custom-row">
            <input
              type="number"
              className="duration-input"
              value={customValue}
              min={1}
              step={unit === 'days' ? 1 : 0.1}
              onChange={(e) => handleCustomValueChange(e.target.value)}
            />
            <select
              className="duration-unit-select"
              value={unit}
              onChange={(e) => handleUnitChange(e.target.value as DurationUnit)}
            >
              <option value="days">days</option>
              <option value="months">months</option>
              <option value="years">years</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
