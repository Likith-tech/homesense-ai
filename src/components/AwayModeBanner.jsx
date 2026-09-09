import { useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon'
import { Button, Card, StatusBadge, cx } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { DEVICE_CATALOG } from '../data/devices'
import { powerSnapshot, costOf, co2Of } from '../utils/energy'
import { watts, currency, round } from '../utils/format'
import LiveAnalysis from './LiveAnalysis'

/**
 * The signature demo moment: the house is armed Away but non-essential loads
 * are still running. This detects the mismatch, quantifies the waste from the
 * real power model, and — on approval — actually applies the eco sweep and
 * measures the before/after outcome. Nothing here is scripted; it reacts to
 * whatever the simulator's live state actually is.
 */
export default function AwayModeBanner() {
  const { state, api, power, insights } = useHome()
  const [outcome, setOutcome] = useState(null)
  const clearTimer = useRef(null)
  const matchedInsight = insights.find((i) => i.id === 'ai-away-running')

  const running = DEVICE_CATALOG.filter(
    (d) => !d.critical && d.semantics !== 'lock' && state.devices[d.id]?.on,
  )
  const wastedW = running.reduce((a, d) => a + (power.byDevice[d.id] || 0), 0)

  useEffect(() => {
    // Leaving Away Mode invalidates any outcome card being shown.
    if (state.homeMode !== 'away') {
      setOutcome(null)
      if (clearTimer.current) clearTimeout(clearTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.homeMode])

  if (state.homeMode !== 'away') return null
  if (running.length === 0 && !outcome) return null

  const optimize = () => {
    const before = powerSnapshot(state).total
    api.run({ type: 'ECO_SWEEP' }, 'ai', null)
    // The reducer applies synchronously, so the *next* render already has the
    // post-sweep state; we only need to remember what "before" looked like.
    if (clearTimer.current) clearTimeout(clearTimer.current)
    setOutcome({ before, devicesOff: running.length })
    clearTimer.current = setTimeout(() => setOutcome(null), 15000)
  }

  if (outcome) {
    const after = power.total
    const reductionW = Math.max(0, outcome.before - after)
    const savedPerHour = costOf(reductionW / 1000)
    const co2PerHour = co2Of(reductionW / 1000)
    return (
      <Card className="relative overflow-hidden p-5 ring-1 ring-emerald-400/25">
        <div className="pointer-events-none absolute -right-14 -top-16 size-56 rounded-full bg-emerald-400/12 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
            <Icon name="CheckCircle2" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-mist-100">Home optimised</h3>
              <StatusBadge tone="emerald" size="sm">
                Outcome measured
              </StatusBadge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Outcome label="Before" value={watts(outcome.before)} tone="text-mist-300" />
              <Outcome label="After" value={watts(after)} tone="text-emerald-300" />
              <Outcome label="Reduction" value={watts(reductionW)} tone="text-emerald-300" />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-mist-400">
              Turned off {outcome.devicesOff} non-essential device{outcome.devicesOff === 1 ? '' : 's'}. At this
              rate that is{' '}
              <span className="font-medium text-mist-200">{currency(savedPerHour, 2)}/hour</span> and{' '}
              <span className="font-medium text-mist-200">{round(co2PerHour * 1000, 0)} g CO₂/hour</span> avoided
              while nobody is home.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const wastePerHour = costOf(wastedW / 1000)

  return (
    <Card className="relative overflow-hidden p-5 ring-1 ring-amber-400/25">
      <div className="pointer-events-none absolute -right-14 -top-16 size-56 rounded-full bg-amber-400/12 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25">
            <Icon name="MapPin" size={18} />
            <span className="absolute inset-0 animate-pulse-ring rounded-xl ring-2 ring-amber-400/40" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-mist-100">Away Mode detected</h3>
              <StatusBadge tone="amber" size="sm" pulse>
                {running.length} device{running.length === 1 ? '' : 's'} still running
              </StatusBadge>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist-400">
              The house is armed and empty, but {running.map((d) => d.name).join(', ')} draws{' '}
              <span className="font-medium text-mist-200">{watts(wastedW)}</span> continuously — about{' '}
              <span className="font-medium text-mist-200">{currency(wastePerHour, 2)} every hour</span> of pure
              waste.
            </p>
            {matchedInsight?.signals && (
              <div className="mt-3">
                <LiveAnalysis signals={matchedInsight.signals} conclusion={`${matchedInsight.tier} priority`} />
              </div>
            )}
          </div>
        </div>
        <Button variant="ai" size="lg" icon="Zap" onClick={optimize} className="shrink-0">
          Optimise Home
        </Button>
      </div>
    </Card>
  )
}

function Outcome({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-white/4 p-2.5 ring-1 ring-white/6">
      <p className="text-[9.5px] font-medium uppercase tracking-wider text-mist-500">{label}</p>
      <p className={cx('mt-1 text-sm font-semibold tabular-nums', tone)}>{value}</p>
    </div>
  )
}
