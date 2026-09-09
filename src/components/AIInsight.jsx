import { useState } from 'react'
import Icon from './ui/Icon'
import { Button, StatusBadge, cx, tone, SEVERITY_TONE } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { TIER_META } from '../utils/ai'
import { currency, round, watts } from '../utils/format'

const SEVERITY_LABEL = {
  critical: 'Critical',
  warning: 'Needs attention',
  info: 'Suggestion',
  success: 'All clear',
}

/**
 * One AI recommendation.
 *
 * The card always carries the full chain — what was observed, why it matters,
 * and the action that resolves it. The button applies a real effect through the
 * shared pipeline, so nothing here is decorative. The "AI Decision Audit"
 * toggle re-presents the exact same signals/reason/confidence data in the
 * inputs → reasoning → decision → action shape judges can inspect.
 */
export default function AIInsight({ insight, compact = false, onActed }) {
  const { api } = useHome()
  const [audit, setAudit] = useState(false)
  const t = SEVERITY_TONE[insight.severity] || 'sky'
  const c = tone(t)
  const tier = insight.tier ? TIER_META[insight.tier] : null

  const act = (effect) => {
    if (!effect) return
    api.run(effect, 'ai', `Applied: ${insight.actionLabel}`)
    onActed?.(insight)
  }

  return (
    <article
      className={cx(
        'glass relative overflow-hidden rounded-2xl p-4 transition-all duration-300 sm:p-[18px]',
        'ring-1',
        insight.severity === 'critical' ? 'ring-rose-400/30' : 'ring-white/7',
      )}
    >
      <div
        className={cx('pointer-events-none absolute -left-10 -top-10 size-28 rounded-full opacity-50 blur-2xl', c.bg)}
      />

      <div className="relative flex items-start gap-3">
        <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl ring-1', c.bg, c.ring, c.text)}>
          <Icon name={insight.icon} size={17} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[13.5px] font-semibold text-mist-100">{insight.title}</h4>
            <StatusBadge tone={t} size="sm" pulse={insight.severity === 'critical'}>
              {SEVERITY_LABEL[insight.severity]}
            </StatusBadge>
            {tier && (
              <StatusBadge tone={tier.tone} size="sm">
                {tier.label}
              </StatusBadge>
            )}
          </div>

          <p className="mt-1.5 text-[13px] leading-relaxed text-mist-200">{insight.message}</p>

          {!compact && (insight.signals?.length > 0 || insight.reason) && (
            <div className="relative mt-3 space-y-2 border-l border-dashed border-white/10 pl-3.5">
              {insight.signals?.length > 0 && (
                <div className="relative">
                  <span className="absolute -left-[19px] top-0.5 grid size-3.5 place-items-center rounded-full bg-ink-850 ring-1 ring-white/15">
                    <Icon name="Radar" size={8} className="text-sky-300" />
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-mist-500">
                    Signals correlated
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {insight.signals.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-white/5 px-2 py-1 text-[10.5px] leading-none text-mist-300 ring-1 ring-white/8"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {insight.reason && (
                <div className="relative">
                  <span className="absolute -left-[19px] top-0.5 grid size-3.5 place-items-center rounded-full bg-ink-850 ring-1 ring-white/15">
                    <Icon name="Sparkles" size={8} className="text-violet-300" />
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-mist-500">Conclusion</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-mist-400">{insight.reason}</p>
                </div>
              )}
            </div>
          )}

          {!compact && insight.whatIf && (
            <div className="mt-3 rounded-xl bg-amber-500/6 p-2.5 ring-1 ring-amber-400/15">
              <div className="flex items-center gap-1.5">
                <Icon name="Clock" size={11} className="text-amber-300" />
                <p className="text-[10px] font-medium uppercase tracking-wider text-amber-300">What-if projection</p>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <WhatIfStat label="Current draw" value={watts(insight.whatIf.currentW)} />
                <WhatIfStat
                  label={`If nothing changes (${insight.whatIf.hours}h)`}
                  value={`+${currency(insight.whatIf.cost, 2)}`}
                  hint={`+${insight.whatIf.kwh} kWh · +${round(insight.whatIf.co2Kg * 1000, 0)} g CO₂`}
                />
                <WhatIfStat
                  label="Avoidable / month"
                  value={currency(insight.whatIf.monthlyCost, 0)}
                  tone="text-emerald-300"
                  hint="if this repeats daily"
                />
              </div>
            </div>
          )}

          {!compact && (insight.signals?.length > 0 || insight.reason) && (
            <button
              type="button"
              onClick={() => setAudit((v) => !v)}
              className="mt-2.5 flex items-center gap-1 text-[10.5px] font-medium text-mist-500 transition hover:text-mist-300"
            >
              <Icon name={audit ? 'ChevronUp' : 'ChevronDown'} size={11} />
              {audit ? 'Hide' : 'Why this?'}
            </button>
          )}

          {audit && (
            <div className="mt-2.5 space-y-2.5 rounded-xl bg-ink-900/60 p-3 ring-1 ring-white/8">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-300">AI Decision Audit</p>
              <AuditRow label="Inputs">
                <ul className="space-y-0.5">
                  {(insight.signals || []).map((s, i) => (
                    <li key={i} className="text-[11px] text-mist-300">• {s}</li>
                  ))}
                </ul>
              </AuditRow>
              <AuditRow label="Reasoning">
                <p className="text-[11px] leading-relaxed text-mist-300">{insight.reason}</p>
              </AuditRow>
              <AuditRow label="Decision">
                <p className="text-[11px] leading-relaxed text-mist-300">{insight.message}</p>
              </AuditRow>
              {insight.actionLabel && (
                <AuditRow label="Action">
                  <p className="text-[11px] leading-relaxed text-mist-300">{insight.actionLabel}</p>
                </AuditRow>
              )}
              <AuditRow label="Signal corroboration confidence">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-300"
                      style={{ width: `${insight.confidence}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-mist-200">{insight.confidence}%</span>
                </div>
                <p className="mt-1 text-[9.5px] text-mist-600">
                  How many independent signals agree — not a statistical or ML probability.
                </p>
              </AuditRow>
            </div>
          )}

          {(insight.effect || insight.secondary) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {insight.effect && insight.actionLabel && (
                <Button
                  variant={insight.severity === 'critical' ? 'danger' : 'primary'}
                  size="sm"
                  icon="Check"
                  onClick={() => act(insight.extra ? [insight.effect, insight.extra].flat() : insight.effect)}
                >
                  {insight.actionLabel}
                </Button>
              )}
              {insight.secondary && (
                <Button variant="ghost" size="sm" onClick={() => act(insight.secondary.effect)}>
                  {insight.secondary.label}
                </Button>
              )}
              <Button
                variant="subtle"
                size="sm"
                onClick={() => api.dismissInsight(insight.id)}
                title="Hide this recommendation for 45 simulated minutes"
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function WhatIfStat({ label, value, hint, tone: t = 'text-mist-100' }) {
  return (
    <div>
      <p className="text-[9px] font-medium uppercase leading-tight tracking-wider text-mist-500">{label}</p>
      <p className={cx('mt-0.5 text-[13px] font-semibold tabular-nums', t)}>{value}</p>
      {hint && <p className="mt-0.5 text-[9.5px] leading-snug text-mist-500">{hint}</p>}
    </div>
  )
}

function AuditRow({ label, children }) {
  return (
    <div>
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-mist-500">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
