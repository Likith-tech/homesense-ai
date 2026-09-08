import { TARIFF } from '../data/constants'

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export const round = (n, places = 1) => {
  const f = 10 ** places
  return Math.round((Number(n) || 0) * f) / f
}

export const currency = (n, places = 0) =>
  `${TARIFF.currency}${(Number(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  })}`

export const kwh = (n, places = 2) => `${round(n, places).toFixed(places)} kWh`

export const watts = (n) => {
  const v = Math.round(Number(n) || 0)
  return v >= 1000 ? `${round(v / 1000, 2)} kW` : `${v} W`
}

export const temp = (n, places = 1) => `${round(n, places).toFixed(places)}°C`

export const pct = (n, places = 0) => `${round(n, places).toFixed(places)}%`

/** 24-hour clock from a simulated timestamp. */
export const clock = (ts) =>
  new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export const clockSeconds = (ts) =>
  new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

export const dayLabel = (ts) =>
  new Date(ts).toLocaleDateString('en-IN', { weekday: 'short' })

export const dateLabel = (ts) =>
  new Date(ts).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

/** "42 min ago" / "2 h 10 m ago" from two simulated timestamps. */
export function sinceLabel(from, now) {
  if (!from) return 'never'
  const mins = Math.max(0, Math.round((now - from) / 60000))
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 24) return m ? `${h} h ${m} m ago` : `${h} h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** "42 minutes" / "1 h 05 m" — a duration, not a relative time. */
export function durationLabel(ms) {
  const mins = Math.max(0, Math.round(ms / 60000))
  if (mins < 1) return 'under a minute'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${String(m).padStart(2, '0')} m` : `${h} hour${h === 1 ? '' : 's'}`
}

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`

/** Air-quality band for an AQI value (lower is cleaner). */
export function aqiBand(aqi) {
  if (aqi <= 50) return { label: 'Good', tone: 'emerald' }
  if (aqi <= 100) return { label: 'Moderate', tone: 'lime' }
  if (aqi <= 150) return { label: 'Unhealthy (sensitive)', tone: 'amber' }
  if (aqi <= 200) return { label: 'Unhealthy', tone: 'orange' }
  return { label: 'Very unhealthy', tone: 'rose' }
}
