import Icon from './ui/Icon'
import { Toggle, StatusBadge, cx, tone } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { devicesInRoom } from '../data/devices'
import { COMFORT } from '../data/constants'
import { temp, watts, round, sinceLabel, kwh, currency } from '../utils/format'
import { costOf } from '../utils/energy'

const TYPE_ORDER = { Light: 0, Fan: 1, AC: 2, Television: 3, 'Smart Plug': 4, Refrigerator: 5 }

/**
 * A room, end to end: its climate, its presence sensor, its share of the load,
 * and working controls for every device installed in it.
 */
export default function RoomCard({ room, expanded = true }) {
  const { state, api, power } = useHome()
  const sensor = state.sensors.rooms[room.id]
  const devices = devicesInRoom(room.id).sort(
    (a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9),
  )
  const roomW = power.byRoom[room.id] ?? 0
  const c = tone(room.accent)

  const tooWarm = sensor.temp > state.prefs.tempMax
  const tooCold = sensor.temp < state.prefs.tempMin
  const tempTone = tooWarm ? 'amber' : tooCold ? 'sky' : 'emerald'

  // Share of the day's energy, apportioned by this room's live draw.
  const roomShare = power.total ? roomW / power.total : 0
  const roomKwhToday = state.energy.todayKwh * roomShare

  return (
    <section className={cx('glass overflow-hidden rounded-2xl ring-1', sensor.motion ? c.ring : 'ring-white/7')}>
      {/* header */}
      <div className="relative flex items-start justify-between gap-3 border-b border-white/6 p-4">
        <div
          className={cx('pointer-events-none absolute -right-6 -top-10 size-28 rounded-full opacity-40 blur-2xl', c.bg)}
        />
        <div className="relative flex items-center gap-3">
          <span className={cx('grid size-10 place-items-center rounded-xl ring-1', c.bg, c.ring, c.text)}>
            <Icon name={room.icon} size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-mist-100">{room.name}</h3>
            <p className="mt-0.5 text-[11px] text-mist-500">
              {devices.length} devices · {room.area} m² · {room.topic}
            </p>
          </div>
        </div>
        <StatusBadge tone={sensor.motion ? 'emerald' : 'slate'} size="sm" pulse={sensor.motion}>
          {sensor.motion ? 'Occupied' : 'Empty'}
        </StatusBadge>
      </div>

      {/* telemetry */}
      <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
        <Metric
          icon="Thermometer"
          label="Temperature"
          value={temp(sensor.temp)}
          tone={tempTone}
          note={tooWarm ? 'Above comfort' : tooCold ? 'Below comfort' : 'Comfortable'}
        />
        <Metric
          icon="Droplets"
          label="Humidity"
          value={`${round(sensor.humidity, 0)}%`}
          tone={sensor.humidity > COMFORT.humidityMax ? 'amber' : 'sky'}
          note={sensor.humidity > COMFORT.humidityMax ? 'Humid' : 'Normal'}
        />
        <Metric
          icon="Radar"
          label="Motion"
          value={sensor.motion ? 'Detected' : 'None'}
          tone={sensor.motion ? 'emerald' : 'slate'}
          note={sensor.motion ? 'Live' : sinceLabel(sensor.lastMotionAt, state.simTime)}
        />
        <Metric
          icon="Zap"
          label="Energy"
          value={watts(roomW)}
          tone={roomW > 800 ? 'amber' : 'violet'}
          note={`${kwh(roomKwhToday, 1)} · ${currency(costOf(roomKwhToday))} today`}
        />
      </div>

      {/* device controls */}
      {expanded && (
        <div className="space-y-1.5 p-3.5">
          {devices.map((def) => {
            const dev = state.devices[def.id]
            const on = !!dev?.on
            return (
              <div
                key={def.id}
                className={cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition-colors',
                  on ? 'bg-white/6 ring-white/10' : 'bg-white/2 ring-white/5',
                )}
              >
                <Icon
                  name={def.icon}
                  size={16}
                  className={on ? c.text : 'text-mist-500'}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-mist-100">{def.type}</p>
                  <p className="truncate text-[10.5px] text-mist-500">
                    {def.name} · {watts(power.byDevice[def.id] ?? 0)}
                    {def.type === 'AC' && on ? ` · ${dev.setpoint}°C` : ''}
                  </p>
                </div>
                {def.type === 'AC' && on && (
                  <div className="hidden items-center gap-1 sm:flex">
                    <button
                      type="button"
                      aria-label="Lower setpoint"
                      onClick={() => api.setSetpoint(def.id, (dev.setpoint ?? 24) - 1)}
                      className="grid size-6 place-items-center rounded-md bg-white/6 text-mist-300 transition hover:bg-white/12"
                    >
                      <Icon name="Minus" size={12} />
                    </button>
                    <span className="w-9 text-center text-[12px] font-semibold tabular-nums text-mist-100">
                      {dev.setpoint}°
                    </span>
                    <button
                      type="button"
                      aria-label="Raise setpoint"
                      onClick={() => api.setSetpoint(def.id, (dev.setpoint ?? 24) + 1)}
                      className="grid size-6 place-items-center rounded-md bg-white/6 text-mist-300 transition hover:bg-white/12"
                    >
                      <Icon name="Plus" size={12} />
                    </button>
                  </div>
                )}
                <Toggle
                  size="sm"
                  checked={on}
                  onChange={(next) => api.setDevice(def.id, next)}
                  tone={room.accent}
                  label={`Toggle ${def.name}`}
                />
              </div>
            )
          })}

          {!devices.some((d) => d.type === 'AC') && (
            <p className="px-3 pt-1 text-[11px] text-mist-500">
              <Icon name="Info" size={11} className="mr-1 inline align-[-1px]" />
              No air conditioner installed in this room — fan-only climate control.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function Metric({ icon, label, value, note, tone: t }) {
  const c = tone(t)
  return (
    <div className="bg-ink-900/40 p-3.5">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={12} className={c.text} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-mist-500">{label}</span>
      </div>
      <p className="mt-1.5 text-[17px] font-semibold tabular-nums leading-none text-mist-100">{value}</p>
      <p className={cx('mt-1 truncate text-[10.5px]', c.text)}>{note}</p>
    </div>
  )
}
