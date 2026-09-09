import Icon from './ui/Icon'

/**
 * A visible "the engine is correlating signals right now" moment. This is not
 * a decorative loading spinner — the checklist IS the real `signals` array a
 * live insight already carries (same data `AIInsight` renders), just revealed
 * with a short stagger so a viewer can watch it happen instead of the result
 * simply appearing. Nothing here is on a timer disconnected from real data.
 */
export default function LiveAnalysis({ signals = [], conclusion }) {
  if (!signals.length) return null

  return (
    <div className="rounded-xl bg-sky-500/6 p-3 ring-1 ring-sky-400/15">
      <div className="flex items-center gap-1.5">
        <Icon name="Radar" size={11} className="animate-breathe text-sky-300" />
        <p className="text-[10px] font-medium uppercase tracking-wider text-sky-300">Analysing home…</p>
      </div>
      <ul className="mt-2 space-y-1">
        {signals.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-mist-300 animate-check-in"
            style={{ animationDelay: `${i * 140}ms` }}
          >
            <Icon name="Check" size={11} className="shrink-0 text-emerald-300" />
            {s}
          </li>
        ))}
      </ul>
      <p
        className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-300 animate-check-in"
        style={{ animationDelay: `${signals.length * 140 + 180}ms` }}
      >
        <Icon name="Sparkles" size={11} />
        Analysis complete — {signals.length} signal{signals.length === 1 ? '' : 's'} correlated
        {conclusion ? ` · ${conclusion}` : ''}
      </p>
    </div>
  )
}
