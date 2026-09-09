import Icon from './ui/Icon'
import { Card } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { DEVICE_CATALOG } from '../data/devices'

/**
 * A small, honest architecture summary — communicates "local, deterministic,
 * offline" without a paragraph of prose. Every line is either a static
 * architectural fact (no cloud calls exist in this codebase) or a live count
 * read straight from state.
 */
export default function SystemStatus() {
  const { state } = useHome()
  const rows = [
    { label: 'Reasoning engine', value: 'Online · local', tone: 'text-emerald-300' },
    { label: 'Cloud dependencies', value: '0', tone: 'text-emerald-300' },
    { label: 'API keys required', value: '0', tone: 'text-emerald-300' },
    { label: 'Simulated devices', value: `${DEVICE_CATALOG.length}`, tone: 'text-mist-200' },
    { label: 'Simulated rooms', value: `${Object.keys(state.sensors.rooms).length}`, tone: 'text-mist-200' },
    { label: 'Active insights', value: `${state.stats.insightsActed || 0} actions applied so far`, tone: 'text-mist-200' },
  ]

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-mist-300">HomeSense Engine</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] text-mist-500">
              <Icon name="Check" size={11} className="text-emerald-400" />
              {r.label}
            </span>
            <span className={`shrink-0 text-[11px] font-medium ${r.tone}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
