import { useSimulationTime } from '../../hooks/useSimulationTime'
import { DATE_MIN, DATE_MAX } from '../../constants'

export default function TimeControls() {
  const { currentDate, setDate } = useSimulationTime()

  const dateStr = currentDate.toISOString().slice(0, 10)
  const sliderValue = currentDate.getTime()

  return (
    <div className="control-section">
      <label className="control-label">Date</label>
      <input
        type="date"
        value={dateStr}
        min={DATE_MIN.toISOString().slice(0, 10)}
        max={DATE_MAX.toISOString().slice(0, 10)}
        onChange={(e) => {
          const d = new Date(e.target.value + 'T00:00:00Z')
          if (!isNaN(d.getTime())) setDate(d)
        }}
        className="date-input"
      />
      <input
        type="range"
        min={DATE_MIN.getTime()}
        max={DATE_MAX.getTime()}
        value={sliderValue}
        onChange={(e) => setDate(new Date(Number(e.target.value)))}
        className="time-slider"
      />
    </div>
  )
}
