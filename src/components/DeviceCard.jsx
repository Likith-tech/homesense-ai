import Icon from './ui/Icon'
import { Toggle, StatusBadge, cx, tone } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { DEVICE_MAP, stateLabel } from '../data/devices'
import { roomName } from '../data/rooms'
import { watts, sinceLabel } from '../utils/format'

const CATEGORY_TONE = {
  lights: 'amber',
  climate: 'sky',
  entertainment: 'violet',
  appliances: 'emerald',
  security: 'rose',
}

/** Shared control logic so the grid card and the table row behave identically. */
function useDevice(id) {
  const { state, api, power } = useHome()
  const def = DEVICE_MAP[id]
  const dev = state.devices[id]
  return {
    def,
    dev,
    api,
    simTime: state.simTime,
    draw: power.byDevice[id] ?? 0,
    on: !!dev?.on,
  }
}

/* ---------------------------------------------------------------- setpoint */

function SetpointControl({ id, value, disabled }) {
  const { api } = useHome()
  return (
    <div className="mt-3 rounded-xl bg-ink-850/60 p-3 ring-1 ring-white/6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-mist-500">Setpoint</span>
        <span className={cx('text-sm font-semibold tabular-nums', value < 24 ? 'text-amber-300' : 'text-emerald-300')}>
          {value}°C
        </span>
      </div>
      <input
        type="range"
        min={16}
        max={30}
        step={1}
        value={value}
        disabled={disabled}
        aria-label="Air conditioner setpoint"
        onChange={(e) => api.setSetpoint(id, Number(e.target.value))}
        className="mt-2.5 w-full disabled:opacity-40"
      />
      <div className="mt-1 flex justify-between text-[10px] text-mist-500">
        <span>16°C</span>
        <span className={value < 24 ? 'text-amber-400' : 'text-emerald-400'}>
          {value < 24 ? 'Below efficient band' : 'Efficient'}
        </span>
        <span>30°C</span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- grid card */

export default function DeviceCard({ id, showRoom = true, compact = false }) {
  const { def, dev, api, simTime, draw, on } = useDevice(id)
  if (!def || !dev) return null

  const t = CATEGORY_TONE[def.category] || 'slate'
  const c = tone(t)
  const isLock = def.semantics === 'lock'

  return (
    <div
      className={cx(
        'glass group relative overflow-hidden rounded-2xl p-4 transition-all duration-300',
        on ? cx('ring-1', c.ring) : 'ring-1 ring-white/7',
      )}
    >
      {on && (
        <div
          className={cx('pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-2xl transition-opacity', c.bg)}
          style={{ opacity: 0.55 }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cx(
              'grid size-10 shrink-0 place-items-center rounded-xl ring-1 transition-all duration-300',
              on ? cx(c.bg, c.ring, c.text) : 'bg-white/4 text-mist-500 ring-white/8',
            )}
          >
            <Icon name={def.icon} size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-mist-100">{def.name}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-mist-500">
              {showRoom ? `${roomName(def.room)} · ` : ''}
              {def.type}
            </p>
          </div>
        </div>

        <Toggle
          checked={on}
          onChange={(next) => api.setDevice(id, next)}
          tone={isLock ? 'rose' : t}
          label={`Toggle ${def.name}`}
        />
      </div>

      <div className="relative mt-3.5 flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={on ? (isLock ? 'emerald' : t) : 'slate'} size="sm" pulse={on && !isLock}>
          {stateLabel(def, on)}
        </StatusBadge>
        <StatusBadge tone="slate" size="sm" icon="Zap">
          {watts(draw)}
        </StatusBadge>
        {def.critical && (
          <StatusBadge tone="amber" size="sm" icon="AlertTriangle">
            Critical
          </StatusBadge>
        )}
      </div>

      {!compact && (
        <p className="relative mt-2.5 text-[11px] leading-snug text-mist-500">
          {def.detail} · last activity {sinceLabel(dev.lastActivity, simTime)}
        </p>
      )}

      {def.type === 'AC' && !compact && (
        <SetpointControl id={id} value={dev.setpoint ?? 24} disabled={!on} />
      )}
    </div>
  )
}

/* --------------------------------------------------------------- row form */

export function DeviceRow({ id }) {
  const { def, dev, api, simTime, draw, on } = useDevice(id)
  if (!def || !dev) return null
  const t = CATEGORY_TONE[def.category] || 'slate'
  const c = tone(t)

  return (
    <div className="glass grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl p-3.5 sm:grid-cols-[auto_2fr_1fr_1fr_1fr_auto] sm:gap-4">
      <span
        className={cx(
          'grid size-9 place-items-center rounded-xl ring-1 transition-colors',
          on ? cx(c.bg, c.ring, c.text) : 'bg-white/4 text-mist-500 ring-white/8',
        )}
      >
        <Icon name={def.icon} size={16} />
      </span>

      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-mist-100">{def.name}</p>
        <p className="truncate text-[11px] text-mist-500 sm:hidden">
          {roomName(def.room)} · {watts(draw)} · {stateLabel(def, on)}
        </p>
        <p className="hidden truncate text-[11px] text-mist-500 sm:block">{def.detail}</p>
      </div>

      <p className="hidden text-[12px] text-mist-300 sm:block">{roomName(def.room)}</p>
      <p className="hidden text-[12px] text-mist-300 sm:block">{def.type}</p>

      <div className="hidden sm:block">
        <p className="text-[12px] font-medium tabular-nums text-mist-100">{watts(draw)}</p>
        <p className="text-[10.5px] text-mist-500">{sinceLabel(dev.lastActivity, simTime)}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Wrapped rather than passing `hidden` to StatusBadge: its base
            `inline-flex` has the same specificity and would win. */}
        <span className="hidden md:inline-flex">
          <StatusBadge tone={on ? 'emerald' : 'slate'} size="sm">
            {stateLabel(def, on)}
          </StatusBadge>
        </span>
        <Toggle checked={on} onChange={(next) => api.setDevice(id, next)} tone={t} label={`Toggle ${def.name}`} />
      </div>
    </div>
  )
}
