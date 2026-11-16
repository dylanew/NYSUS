import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BufferingIncident } from '../../services/diagnostics/buffering'
import { formatClock } from '../../services/playback/metrics'
import { THEME } from '../../theme/tokens'
import { SERIES, type ChartPoint } from './chartData'

const GRID = THEME.grid
const AXIS = THEME.axis
const tooltipStyle = { background: THEME.surfaceRaised, border: `1px solid ${GRID}`, borderRadius: 8, fontSize: 12, color: THEME.text }
const tick = { fill: AXIS, fontSize: 11 }

function stallAreas(incidents: BufferingIncident[], lastT: number) {
  return incidents.map((i) => (
    <ReferenceArea
      key={i.startEventId}
      x1={i.startMs / 1000}
      x2={i.durationMs === null ? lastT : (i.startMs + i.durationMs) / 1000}
      fill={THEME.accent}
      fillOpacity={0.14}
      stroke="none"
      ifOverflow="extendDomain"
    />
  ))
}

export function ThroughputChart({ points, incidents }: { points: ChartPoint[]; incidents: BufferingIncident[] }) {
  const lastT = points.at(-1)?.t ?? 0
  return (
    <figure aria-label="Throughput and bitrate over time" className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} tickFormatter={(s: number) => formatClock(s * 1000)} tick={tick} stroke={GRID} />
          <YAxis tick={tick} stroke={GRID} unit=" Mbps" width={72} />
          {stallAreas(incidents, lastT)}
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(s) => `at ${formatClock(Number(s) * 1000)}`}
            formatter={(v, name) => [`${Number(v).toFixed(2)} Mbps`, name]}
            cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: THEME.textMuted }} />
          <Line type="monotone" dataKey="throughput" name="Throughput (network)" stroke={SERIES.throughput} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="bitrate" name="Bitrate (video)" stroke={SERIES.bitrate} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function BufferChart({ points, incidents }: { points: ChartPoint[]; incidents: BufferingIncident[] }) {
  const lastT = points.at(-1)?.t ?? 0
  return (
    <figure aria-label="Buffer level over time" className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} tickFormatter={(s: number) => formatClock(s * 1000)} tick={tick} stroke={GRID} />
          <YAxis tick={tick} stroke={GRID} unit=" s" width={56} />
          {stallAreas(incidents, lastT)}
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(s) => `at ${formatClock(Number(s) * 1000)}`} formatter={(v) => [`${Number(v).toFixed(1)} s`, 'Buffered video']} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="buffer" name="Buffered video" stroke={SERIES.buffer} fill={SERIES.buffer} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  )
}
