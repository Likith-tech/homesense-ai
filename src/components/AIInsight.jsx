import Icon from './ui/Icon'
import { Button, StatusBadge, cx, tone, SEVERITY_TONE } from './ui/primitives'
import { useHome } from '../context/HomeContext'

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
 * shared pipeline, so nothing here is decorative.
 */
export default function AIInsight({ insight, compact = false, onActed }) {
  const { api } = useHome()
  const t = SEVERITY_TONE[insight.severity] || 'sky'
  const c = tone(t)

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
          </div>

          <p className="mt-1.5 text-[13px] leading-relaxed text-mist-200">{insight.message}</p>

          {!compact && insight.reason && (
            <div className="mt-2.5 flex gap-2 rounded-xl bg-ink-850/50 p-2.5 ring-1 ring-white/5">
              <Icon name="Sparkles" size={13} className="mt-0.5 shrink-0 text-violet-300" />
              <p className="text-[11.5px] leading-relaxed text-mist-400">
                <span className="font-medium text-mist-300">Why: </span>
                {insight.reason}
              </p>
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
