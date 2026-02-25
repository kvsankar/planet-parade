import { MS_PER_DAY } from '../../constants'

interface AlignmentTimeSliderProps {
  startDate: Date
  durationDays: number
  currentDate: Date
  onDateChange: (d: Date) => void
}

export default function AlignmentTimeSlider({
  startDate,
  durationDays,
  currentDate,
  onDateChange,
}: AlignmentTimeSliderProps) {
  const startMs = startDate.getTime()
  const endMs = startMs + durationDays * MS_PER_DAY
  const currentMs = currentDate.getTime()
  const clampedMs = Math.max(startMs, Math.min(endMs, currentMs))

  return (
    <div className="alignment-time-slider">
      <input
        type="range"
        className="time-slider"
        min={startMs}
        max={endMs}
        step={MS_PER_DAY}
        value={clampedMs}
        onChange={(e) => onDateChange(new Date(Number(e.target.value)))}
      />
    </div>
  )
}
