import Icon from './ui/Icon'
import { Button, Toggle, StatusBadge, cx } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { describeAutomation, testConditions } from '../utils/automations'
import { sinceLabel } from '../utils/format'

/** One automation rule, with its live condition state and working controls. */
export default function AutomationCard({ rule, onEdit }) {
  const { state, api } = useHome()
  const { when, then } = describeAutomation(rule)
  const matching = rule.enabled && testConditions(state, rule)

  return (
    <article
      className={cx(
        'glass overflow-hidden rounded-2xl ring-1 transition-all duration-300',
        matching ? 'ring-emerald-400/35' : rule.enabled ? 'ring-white/8' : 'ring-white/5 opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cx(
              'grid size-9 shrink-0 place-items-center rounded-xl ring-1 transition-colors',
              matching
                ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30'
                : rule.enabled
                  ? 'bg-violet-500/12 text-violet-300 ring-violet-400/25'
                  : 'bg-white/4 text-mist-500 ring-white/8',
            )}
          >
            <Icon name="Workflow" size={17} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13.5px] font-semibold text-mist-100">{rule.name}</h3>
              {matching && (
                <StatusBadge tone="emerald" size="sm" pulse>
                  Condition met
                </StatusBadge>
              )}
              {!rule.enabled && (
                <StatusBadge tone="slate" size="sm">
                  Disabled
                </StatusBadge>
              )}
            </div>
            {rule.description && (
              <p className="mt-1 text-[11.5px] leading-relaxed text-mist-500">{rule.description}</p>
            )}
          </div>
        </div>
        <Toggle
          checked={rule.enabled}
          onChange={() => api.toggleAutomation(rule.id)}
          label={`Enable ${rule.name}`}
        />
      </div>

      {/* IF / THEN */}
      <div className="mx-4 mb-4 overflow-hidden rounded-xl bg-ink-850/60 ring-1 ring-white/6">
        <div className="flex gap-3 border-b border-white/6 p-3">
          <span className="mt-px shrink-0 rounded-md bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-300">
            If
          </span>
          <p className="text-[12px] leading-relaxed text-mist-200">{when}</p>
        </div>
        <div className="flex gap-3 p-3">
          <span className="mt-px shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Then
          </span>
          <p className="text-[12px] leading-relaxed text-mist-200">{then}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 px-4 py-3">
        <p className="text-[11px] text-mist-500">
          Fired {rule.firedCount || 0}×
          {rule.lastFiredAt ? ` · last ${sinceLabel(rule.lastFiredAt, state.simTime)}` : ' · never yet'}
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="subtle" size="sm" icon="Pencil" onClick={() => onEdit(rule)}>
            Edit
          </Button>
          <Button
            variant="subtle"
            size="sm"
            icon="Trash2"
            className="hover:bg-rose-500/10 hover:text-rose-300"
            onClick={() => {
              api.deleteAutomation(rule.id)
              api.toast(`Deleted "${rule.name}"`, 'info')
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </article>
  )
}
