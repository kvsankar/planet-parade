import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { AlignmentDataPoint, AlignmentMinimum, AlignmentKind } from '../../types'
import { SERIES_COLORS, BODY_META, formatDate } from '../../constants'

const TOOLTIP_STYLE = {
  background: 'rgba(10,10,20,0.95)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  fontSize: 11,
}

const SERIES_LABELS: Record<string, string> = {
  separation: 'Total',
  eveningSep: 'Evening',
  morningSep: 'Morning',
}

interface SeparationChartProps {
  data: AlignmentDataPoint[]
  minima: AlignmentMinimum[]
  currentDate: number | null
  onDateClick: (dateMs: number) => void
  visibleSeries: Set<AlignmentKind>
}

export default function SeparationChart({
  data,
  minima,
  currentDate,
  onDateClick,
  visibleSeries,
}: SeparationChartProps) {
  if (data.length === 0) {
    return <div className="chart-empty">Select planets and a time range to see alignment data.</div>
  }

  const emptyKinds: string[] = []
  if (visibleSeries.has('morning') && !data.some((d) => d.morningSep != null)) {
    emptyKinds.push('AM')
  }
  if (visibleSeries.has('evening') && !data.some((d) => d.eveningSep != null)) {
    emptyKinds.push('PM')
  }

  return (
    <div className="separation-chart">
      <span className="control-label">Max Longitude Span</span>
      {emptyKinds.length > 0 && (
        <div className="chart-note">
          No time range in this window where all selected planets are visible in {emptyKinds.join(' and ')}.
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 0, left: 5 }}
          onClick={(e: any) => {
            if (e?.activePayload?.[0]) {
              onDateClick(e.activePayload[0].payload.date)
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatDate(v)}
            stroke="#666"
            fontSize={10}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 360]}
            ticks={[0, 60, 120, 180, 240, 300, 360]}
            stroke="#666"
            fontSize={10}
            width={35}
            tickFormatter={(v) => `${v}°`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(label) => formatDate(label as number)}
            formatter={(value?: number, name?: string) =>
              [`${Number(value ?? 0).toFixed(1)}°`, SERIES_LABELS[name ?? ''] || name]
            }
          />
          {visibleSeries.has('total') && (
            <Line
              type="monotone"
              dataKey="separation"
              stroke={SERIES_COLORS.total}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          )}
          {visibleSeries.has('evening') && (
            <Line
              type="monotone"
              dataKey="eveningSep"
              stroke={SERIES_COLORS.evening}
              strokeWidth={1}
              dot={false}
              activeDot={{ r: 2 }}
              strokeDasharray="4 2"
            />
          )}
          {visibleSeries.has('morning') && (
            <Line
              type="monotone"
              dataKey="morningSep"
              stroke={SERIES_COLORS.morning}
              strokeWidth={1}
              dot={false}
              activeDot={{ r: 2 }}
              strokeDasharray="4 2"
            />
          )}
          {currentDate != null && (
            <ReferenceLine x={currentDate} stroke={BODY_META.Sun.color} strokeDasharray="4 2" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
