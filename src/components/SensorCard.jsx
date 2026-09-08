import Icon from './ui/Icon'
import { cx, tone, Meter } from './ui/primitives'

/**
 * A single telemetry reading with an optional range meter, so a number always
 * carries the context that makes it meaningful.
 */
export default function SensorCard({
  icon,
  label,
  value,
  unit,
  tone: t = 'slate',
  hint,
  meter,
  badge,
  live,
  className = '',
}) {
  const c = tone(t)
  return (
    <div className={cx('glass rounded-2xl p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={cx('grid size-8 place-items-center rounded-lg ring-1', c.bg, c.ring, c.text)}>
            <Icon name={icon} size={15} />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-mist-500">{label}</span>
        </div>
        {badge}
        {live && !badge && (
          <span className="relative flex size-1.5 shrink-0">
            <span className={cx('absolute inline-flex size-full animate-pulse-ring rounded-full', c.dot)} />
            <span className={cx('relative inline-flex size-1.5 rounded-full', c.dot)} />
          </span>
        )}
      </div>

      <p className="mt-3 flex items-baseline gap-1 font-semibold text-mist-100">
        <span className="text-[26px] leading-none tabular-nums">{value}</span>
        {unit && <span className="text-xs font-medium text-mist-400">{unit}</span>}
      </p>

      {meter && (
        <div className="mt-3">
          <Meter value={meter.value} max={meter.max ?? 100} tone={meter.tone ?? t} />
          {meter.labels && (
            <div className="mt-1 flex justify-between text-[10px] text-mist-500">
              {meter.labels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {hint && <p className="mt-2 text-[11.5px] leading-snug text-mist-500">{hint}</p>}
    </div>
  )
}
