import { useMemo, useState } from 'react'
import Icon from '../components/ui/Icon'
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatTile,
  cx,
  inputClass,
} from '../components/ui/primitives'
import DeviceCard, { DeviceRow } from '../components/DeviceCard'
import { useHome } from '../context/HomeContext'
import { CATEGORIES, DEVICE_CATALOG } from '../data/devices'
import { ROOMS, roomName } from '../data/rooms'
import { watts, kwh, currency } from '../utils/format'
import { costOf } from '../utils/energy'

export default function Devices() {
  const { state, api, power } = useHome()
  const [category, setCategory] = useState('all')
  const [room, setRoom] = useState('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')
  const [onlyOn, setOnlyOn] = useState(false)

  const filtered = useMemo(
    () =>
      DEVICE_CATALOG.filter((d) => {
        if (category !== 'all' && d.category !== category) return false
        if (room !== 'all' && d.room !== room) return false
        if (onlyOn && !state.devices[d.id]?.on) return false
        if (query.trim()) {
          const q = query.toLowerCase()
          return (
            d.name.toLowerCase().includes(q) ||
            d.type.toLowerCase().includes(q) ||
            roomName(d.room).toLowerCase().includes(q)
          )
        }
        return true
      }),
    [category, room, query, onlyOn, state.devices],
  )

  const onCount = DEVICE_CATALOG.filter((d) => state.devices[d.id]?.on).length
  const filteredW = filtered.reduce((a, d) => a + (power.byDevice[d.id] ?? 0), 0)

  const categoryCount = (id) =>
    id === 'all' ? DEVICE_CATALOG.length : DEVICE_CATALOG.filter((d) => d.category === id).length

  return (
    <div className="space-y-6 animate-float-in">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="Boxes" tone="cyan" label="Devices connected" value={DEVICE_CATALOG.length} hint="Simulated over the same interface a real gateway would expose" />
        <StatTile icon="Power" tone="emerald" label="Currently on" value={onCount} unit={`/ ${DEVICE_CATALOG.length}`} hint={`${DEVICE_CATALOG.length - onCount} idle or standby`} />
        <StatTile icon="Zap" tone="violet" label="Combined draw" value={watts(power.total)} hint={`${currency(costOf(power.total / 1000), 1)} per hour`} />
        <StatTile icon="Calendar" tone="sky" label="Energy today" value={kwh(state.energy.todayKwh)} hint={`${currency(costOf(state.energy.todayKwh))} at the current tariff`} />
      </div>

      {/* filters */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium transition-all duration-200',
                category === c.id
                  ? 'bg-emerald-400 text-ink-950 shadow-[0_8px_24px_-12px_rgba(52,211,153,0.9)]'
                  : 'bg-white/5 text-mist-300 ring-1 ring-white/10 hover:bg-white/10',
              )}
            >
              <Icon name={c.icon} size={13} />
              {c.label}
              <span className={cx('rounded-full px-1.5 text-[10px]', category === c.id ? 'bg-ink-950/15' : 'bg-white/8')}>
                {categoryCount(c.id)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Icon name="Search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
            <input
              type="search"
              className={cx(inputClass, 'pl-9')}
              placeholder="Search devices, types or rooms…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className={cx(inputClass, 'w-auto cursor-pointer')}
          >
            <option value="all" className="bg-ink-850">All rooms</option>
            {ROOMS.map((r) => (
              <option key={r.id} value={r.id} className="bg-ink-850">{r.name}</option>
            ))}
            <option value="entry" className="bg-ink-850">Entry</option>
          </select>

          <button
            type="button"
            onClick={() => setOnlyOn((v) => !v)}
            className={cx(
              'rounded-xl px-3 py-2 text-[12.5px] font-medium ring-1 transition',
              onlyOn ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' : 'bg-white/5 text-mist-400 ring-white/10 hover:text-mist-200',
            )}
          >
            On only
          </button>

          <div className="flex items-center gap-0.5 rounded-xl bg-ink-850/70 p-1 ring-1 ring-white/8">
            {[
              { id: 'grid', icon: 'LayoutGrid' },
              { id: 'list', icon: 'ListFilter' },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                aria-label={`${v.id} view`}
                onClick={() => setView(v.id)}
                className={cx(
                  'grid size-8 place-items-center rounded-lg transition',
                  view === v.id ? 'bg-white/10 text-mist-100' : 'text-mist-500 hover:text-mist-300',
                )}
              >
                <Icon name={v.icon} size={15} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-3">
          <p className="text-[11.5px] text-mist-500">
            Showing <span className="font-medium text-mist-300">{filtered.length}</span> of {DEVICE_CATALOG.length} devices ·{' '}
            {watts(filteredW)} combined draw
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon="Power"
              onClick={() =>
                api.run(
                  { type: 'DEVICES_ON', ids: filtered.filter((d) => !d.critical).map((d) => d.id) },
                  'manual',
                  `${filtered.length} devices switched on`,
                )
              }
            >
              Turn selection on
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="PowerOff"
              onClick={() =>
                api.run(
                  { type: 'DEVICES_OFF', ids: filtered.filter((d) => !d.critical && d.semantics !== 'lock').map((d) => d.id) },
                  'manual',
                  `${filtered.length} devices switched off`,
                )
              }
            >
              Turn selection off
            </Button>
          </div>
        </div>
      </Card>

      {/* devices */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="Search"
          title="No devices match those filters"
          detail="Try clearing the search box or switching back to the All category."
          action={
            <Button
              variant="ghost"
              icon="RefreshCw"
              onClick={() => {
                setCategory('all')
                setRoom('all')
                setQuery('')
                setOnlyOn(false)
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <DeviceCard key={d.id} id={d.id} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 px-3.5 text-[10.5px] font-semibold uppercase tracking-wider text-mist-500 sm:grid">
            <span className="w-9" />
            <span>Device</span>
            <span>Room</span>
            <span>Type</span>
            <span>Power · last activity</span>
            <span className="text-right">Control</span>
          </div>
          {filtered.map((d) => (
            <DeviceRow key={d.id} id={d.id} />
          ))}
        </div>
      )}

      <section>
        <SectionTitle icon="Cable" hint="how this maps to real hardware">
          Integration note
        </SectionTitle>
        <Card className="p-4">
          <p className="text-[12.5px] leading-relaxed text-mist-400">
            No physical hardware is connected. Every device above is a software actor with a rated wattage, a
            standby draw and a state machine. Each one already carries a stable id and room topic (e.g.{' '}
            <code className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[11px] text-mist-200">home/living/ac</code>),
            so replacing the simulator with an MQTT client, an ESP32 gateway or a Home Assistant bridge is a
            transport change — the control surface, automations and analytics above stay exactly as they are.
          </p>
        </Card>
      </section>
    </div>
  )
}
