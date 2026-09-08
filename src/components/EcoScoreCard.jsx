import Icon from './ui/Icon'
import { Button, ProgressRing, Meter, StatusBadge, cx, tone } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { round } from '../utils/format'

/**
 * Eco Score, 0-100. Decomposed so the number is actionable: every component
 * shows what it cost and, where possible, offers the fix.
 */
export default function EcoScoreCard({ detailed = false }) {
  const { eco, api } = useHome()
  const c = tone(eco.band.tone)

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        <ProgressRing value={eco.score} tone={eco.band.tone} size={124} stroke={9}>
          <div>
            <p className="text-3xl font-semibold leading-none tabular-nums text-mist-100">{eco.score}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-mist-500">Eco score</p>
          </div>
        </ProgressRing>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h3 className="text-sm font-semibold text-mist-100">Energy Efficiency</h3>
            <StatusBadge tone={eco.band.tone} size="sm" icon="Leaf">
              {eco.band.label}
            </StatusBadge>
          </div>

          <p className="mt-2 text-[12.5px] leading-relaxed text-mist-400">
            Projected {eco.projectedDailyKwh} kWh today. Your optimisations avoid about{' '}
            <span className={cx('font-semibold', c.text)}>{round(eco.co2SavedKg, 1)} kg of CO₂</span> a month
            versus a comparable un-optimised home.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-left">
            <div className="rounded-xl bg-white/4 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-mist-500">CO₂ avoided</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-mist-100">
                {round(eco.co2SavedKg, 1)} <span className="text-[11px] font-normal text-mist-500">kg / mo</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/4 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-mist-500">Energy avoided</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-mist-100">
                {eco.avoidedKwh} <span className="text-[11px] font-normal text-mist-500">kWh / mo</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {detailed && (
        <div className="border-t border-white/6 p-5">
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-mist-400">
            Score breakdown
          </h4>
          <div className="space-y-2.5">
            {eco.breakdown.map((b) => {
              const ratio = (b.score / b.max) * 100
              return (
                <div key={b.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] font-medium text-mist-200">{b.label}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-mist-400">
                      {round(b.score, 1)} / {b.max}
                    </span>
                  </div>
                  <Meter
                    value={ratio}
                    tone={ratio > 80 ? 'emerald' : ratio > 50 ? 'amber' : 'rose'}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[10.5px] text-mist-500">{b.hint}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {eco.recommendations.length > 0 && (
        <div className="border-t border-white/6 p-4">
          <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-mist-400">
            Improve your score
          </h4>
          <ul className="space-y-2">
            {eco.recommendations.slice(0, detailed ? 6 : 3).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white/4 px-3 py-2.5"
              >
                <Icon name={r.icon} size={14} className="shrink-0 text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium leading-snug text-mist-100">{r.label}</p>
                  {r.detail && <p className="mt-0.5 text-[10.5px] leading-snug text-mist-500">{r.detail}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                  +{r.points}
                </span>
                {r.effect && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => api.run(r.effect, 'ai', `Applied: ${r.actionLabel}`)}
                  >
                    {r.actionLabel}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
