import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
} from 'recharts'
import { round } from '../utils/format'

/**
 * Recharts wrappers with one shared visual language: no chartjunk, muted grid,
 * gradient fills, tabular numbers in the tooltip.
 */

const AXIS = {
  stroke: 'rgba(255,255,255,0.06)',
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
  axisLine: false,
}

function ChartTooltip({ active, payload, label, unit = '', formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs shadow-2xl">
      {label != null && <p className="mb-1 font-medium text-mist-200">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 text-mist-300">
          <span className="size-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="tabular-nums text-mist-100">
            {formatter ? formatter(p.value, p) : `${round(p.value, 2)}${unit}`}
          </span>
          <span className="text-mist-500">{p.name}</span>
        </p>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------- live power -- */

export function LivePowerChart({ data, height = 190, color = '#34d399' }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.42} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={AXIS.stroke} />
          <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={44} {...AXIS} />
          <YAxis width={52} unit="W" {...AXIS} />
          <Tooltip content={<ChartTooltip unit=" W" />} cursor={{ stroke: 'rgba(255,255,255,0.14)' }} />
          <Area
            type="monotone"
            dataKey="w"
            name="Load"
            stroke={color}
            strokeWidth={2}
            fill="url(#powerFill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* --------------------------------------------------------------- hourly -- */

export function HourlyChart({ data, height = 220, currentHour }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -20 }} barCategoryGap="22%">
          <defs>
            <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="hourNow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={AXIS.stroke} />
          <XAxis dataKey="label" interval={2} {...AXIS} />
          <YAxis width={54} unit=" kWh" {...AXIS} />
          <Tooltip content={<ChartTooltip unit=" kWh" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="kwh" name="Energy" radius={[5, 5, 2, 2]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.hour} fill={d.hour === currentHour ? 'url(#hourNow)' : 'url(#hourFill)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* --------------------------------------------------------------- weekly -- */

export function WeeklyChart({ data, height = 220 }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -20 }} barCategoryGap="26%">
          <defs>
            <linearGradient id="weekFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="weekToday" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={AXIS.stroke} />
          <XAxis dataKey="day" {...AXIS} />
          <YAxis width={54} unit=" kWh" {...AXIS} />
          <Tooltip content={<ChartTooltip unit=" kWh" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="kwh" name="Energy" radius={[6, 6, 2, 2]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.day + d.ts} fill={d.isToday ? 'url(#weekToday)' : 'url(#weekFill)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* --------------------------------------------------------- distribution -- */

export function DistributionChart({ data, height = 240, showLegend = true }) {
  if (!data.length) return null
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={
              <ChartTooltip formatter={(v, p) => `${round(p.payload.kwh, 2)} kWh · ${round(v, 1)}%`} />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="86%"
            paddingAngle={2.5}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
          </Pie>
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={34}
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-[11.5px] text-mist-400">{value}</span>}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------- eco radial */

export function EcoRadial({ score, height = 200 }) {
  const data = [{ name: 'Eco score', value: score, fill: 'url(#ecoGrad)' }]
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          innerRadius="72%"
          outerRadius="100%"
          startAngle={220}
          endAngle={-40}
          barSize={16}
        >
          <defs>
            <linearGradient id="ecoGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          {/* Without an explicit angle axis, Recharts scales the bar to the
              largest value in `data` and the ring always renders full. */}
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: 'rgba(255,255,255,0.06)' }}
            dataKey="value"
            cornerRadius={9}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  )
}
