import Icon from './ui/Icon'
import { cx, tone } from './ui/primitives'
import { SEVERITY_TONE } from '../utils/events'
import { clock, sinceLabel } from '../utils/format'
import { roomName } from '../data/rooms'

/** One row in the event log. */
export default function SecurityEvent({ event, now, showDate = false }) {
  const t = SEVERITY_TONE[event.severity] || 'sky'
  const c = tone(t)

  return (
    <li
      className={cx(
        'relative flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/4',
        event.severity === 'critical' && 'bg-rose-500/6 ring-1 ring-rose-400/20',
      )}
    >
      <div className="flex flex-col items-center">
        <span className={cx('grid size-7 shrink-0 place-items-center rounded-lg ring-1', c.bg, c.ring, c.text)}>
          <Icon name={event.icon} size={13} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[11.5px] tabular-nums text-mist-400">{clock(event.at)}</span>
          <span className="text-[12.5px] font-medium leading-snug text-mist-100">{event.title}</span>
        </div>
        {event.detail && <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist-500">{event.detail}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-mist-500">
          {event.room && <span className="rounded bg-white/5 px-1.5 py-0.5">{roomName(event.room)}</span>}
          <span className="rounded bg-white/5 px-1.5 py-0.5 capitalize">{event.source}</span>
          {now && <span>{sinceLabel(event.at, now)}</span>}
          {showDate && <span>{new Date(event.at).toLocaleDateString('en-IN')}</span>}
        </div>
      </div>
    </li>
  )
}
