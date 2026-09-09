import { useState } from 'react'
import Icon from '../components/ui/Icon'
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatTile,
  StatusBadge,
  cx,
  tone,
} from '../components/ui/primitives'
import SecurityEvent from '../components/SecurityEvent'
import AIInsight from '../components/AIInsight'
import ScenarioCenter from '../components/ScenarioCenter'
import AwayModeBanner from '../components/AwayModeBanner'
import { useHome } from '../context/HomeContext'
import { HOME_MODES, SECURITY_STATUS } from '../data/constants'
import { ROOMS } from '../data/rooms'
import { isSecurityEvent } from '../utils/events'
import { SIM_EVENTS } from '../utils/simulation'
import { clock, sinceLabel } from '../utils/format'

const MODE_ICONS = { home: 'House', away: 'MapPin', night: 'Moon' }

/* ------------------------------------------------------------- mode picker */

function ModeCards() {
  const { state, api } = useHome()
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Object.values(HOME_MODES).map((m) => {
        const active = state.homeMode === m.id
        const c = tone(m.tone)
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => api.setHomeMode(m.id)}
            className={cx(
              'glass group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300',
              active ? cx('ring-1', c.ring) : 'ring-1 ring-white/7 hover:ring-white/15',
            )}
          >
            {active && (
              <div className={cx('pointer-events-none absolute -right-8 -top-10 size-28 rounded-full opacity-60 blur-2xl', c.bg)} />
            )}
            <div className="relative flex items-center justify-between">
              <span className={cx('grid size-10 place-items-center rounded-xl ring-1', active ? cx(c.bg, c.ring, c.text) : 'bg-white/4 text-mist-500 ring-white/8')}>
                <Icon name={MODE_ICONS[m.id]} size={18} />
              </span>
              {active && (
                <StatusBadge tone={m.tone} size="sm" pulse>
                  Active
                </StatusBadge>
              )}
            </div>
            <p className={cx('relative mt-3 text-sm font-semibold', active ? 'text-mist-100' : 'text-mist-300')}>
              {m.label} Mode
            </p>
            <p className="relative mt-1 text-[11.5px] leading-relaxed text-mist-500">{m.description}</p>
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------- status banner */

function StatusBanner() {
  const { state, api } = useHome()
  const sec = SECURITY_STATUS[state.security.status]
  const c = tone(sec.tone)
  const alerting = state.security.status === 'alert' && !state.security.acknowledged

  return (
    <Card
      className={cx('relative overflow-hidden p-5', alerting && 'ring-1 ring-rose-400/40')}
      glow={alerting ? 'rose' : undefined}
    >
      <div className={cx('pointer-events-none absolute -left-10 -top-16 size-56 rounded-full opacity-50 blur-3xl', c.bg)} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className={cx('relative grid size-12 shrink-0 place-items-center rounded-2xl ring-1', c.bg, c.ring, c.text)}>
            <Icon name={alerting ? 'ShieldAlert' : state.security.status === 'warning' ? 'Shield' : 'ShieldCheck'} size={22} />
            {alerting && <span className="absolute inset-0 animate-pulse-ring rounded-2xl ring-2 ring-rose-400/50" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cx('text-lg font-semibold', c.text)}>{sec.label}</h2>
              <StatusBadge tone={HOME_MODES[state.homeMode].tone} size="sm" icon={MODE_ICONS[state.homeMode]}>
                {HOME_MODES[state.homeMode].label} Mode
              </StatusBadge>
            </div>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-mist-400">
              {state.security.reason
                ? state.security.reason
                : state.homeMode === 'home'
                  ? 'Perimeter monitoring is relaxed while somebody is home. All sensors still report.'
                  : 'Perimeter armed. Any door or motion event will escalate to a critical alert.'}
              {state.security.since ? ` · since ${clock(state.security.since)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {alerting && (
            <Button
              variant="danger"
              icon="Check"
              onClick={() => api.run([{ type: 'LOCK_DOOR' }, { type: 'ACK_ALERTS' }], 'manual', 'Alert acknowledged, door locked')}
            >
              Acknowledge & lock
            </Button>
          )}
          <Button
            variant="ghost"
            icon={state.sensors.door.locked ? 'Unlock' : 'Lock'}
            onClick={() =>
              api.run(
                { type: state.sensors.door.locked ? 'UNLOCK_DOOR' : 'LOCK_DOOR' },
                'manual',
                state.sensors.door.locked ? 'Front door unlocked' : 'Front door locked',
              )
            }
          >
            {state.sensors.door.locked ? 'Unlock door' : 'Lock door'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ----------------------------------------------------------------- sensors */

function SensorGrid() {
  const { state } = useHome()
  const door = state.sensors.door

  const sensors = [
    {
      id: 'front-door',
      name: 'Front Door',
      topic: 'home/entry/door',
      icon: door.open ? 'DoorOpen' : 'DoorClosed',
      value: door.open ? 'Open' : 'Closed',
      tone: door.open ? 'rose' : 'emerald',
      detail: `${door.locked ? 'Deadbolt engaged' : 'Unlocked'} · last opened ${sinceLabel(door.lastOpenedAt, state.simTime)}`,
      triggered: door.open,
    },
    ...ROOMS.map((r) => {
      const s = state.sensors.rooms[r.id]
      return {
        id: `${r.id}-motion`,
        name: `${r.name} Motion`,
        topic: `${r.topic}/motion`,
        icon: 'Radar',
        value: s.motion ? 'Motion' : 'Clear',
        tone: s.motion ? (state.homeMode === 'home' ? 'emerald' : 'rose') : 'slate',
        detail: s.motion ? 'Presence detected right now' : `Last trip ${sinceLabel(s.lastMotionAt, state.simTime)}`,
        triggered: s.motion,
      }
    }),
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sensors.map((s) => {
        const c = tone(s.tone)
        return (
          <div
            key={s.id}
            className={cx('glass rounded-2xl p-4 ring-1 transition-colors duration-300', s.triggered ? c.ring : 'ring-white/7')}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={cx('grid size-9 place-items-center rounded-xl ring-1', c.bg, c.ring, c.text)}>
                  <Icon name={s.icon} size={16} />
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold text-mist-100">{s.name}</p>
                  <p className="font-mono text-[10px] text-mist-500">{s.topic}</p>
                </div>
              </div>
              <StatusBadge tone={s.tone} size="sm" pulse={s.triggered}>
                {s.value}
              </StatusBadge>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-snug text-mist-500">{s.detail}</p>
          </div>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------- page */

export default function Security() {
  const { state, api, insights } = useHome()
  const [filter, setFilter] = useState('security')

  const securityInsights = insights.filter((i) =>
    ['ai-security-alert', 'ai-door-away', 'ai-unlocked', 'ai-away-running'].includes(i.id),
  )

  const events = state.events.filter((e) => (filter === 'security' ? isSecurityEvent(e) : true))
  const alerting = state.security.status === 'alert' && !state.security.acknowledged
  const motionCount = ROOMS.filter((r) => state.sensors.rooms[r.id].motion).length

  return (
    <div className="space-y-6 animate-float-in">
      <StatusBanner />
      <AwayModeBanner />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="Shield" tone={alerting ? 'rose' : 'emerald'} label="Alerts raised" value={state.security.breaches || 0} hint={alerting ? 'One alert is awaiting acknowledgement' : 'Nothing outstanding'} />
        <StatTile icon="Radar" tone={motionCount ? 'emerald' : 'slate'} label="Sensors tripped" value={motionCount} unit={`/ ${ROOMS.length}`} hint="Passive infrared motion detectors" />
        <StatTile icon={state.sensors.door.locked ? 'Lock' : 'Unlock'} tone={state.sensors.door.locked ? 'emerald' : 'amber'} label="Front door" value={state.sensors.door.locked ? 'Locked' : 'Unlocked'} hint={state.sensors.door.open ? 'Currently OPEN' : 'Closed'} />
        <StatTile icon="History" tone="sky" label="Events logged" value={state.events.length} hint={`Newest ${state.events[0] ? clock(state.events[0].at) : '—'}`} />
      </div>

      <section>
        <SectionTitle icon="House" hint="changes arming behaviour and automation rules">
          Home mode
        </SectionTitle>
        <ModeCards />
      </section>

      {securityInsights.length > 0 && (
        <section>
          <SectionTitle icon="Sparkles" hint="from live sensor correlation">
            AI security recommendations
          </SectionTitle>
          <div className="space-y-3">
            {securityInsights.map((i) => (
              <AIInsight key={i.id} insight={i} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle icon="Radio" hint="simulated PIR + reed sensors">
          Sensors
        </SectionTitle>
        <SensorGrid />
      </section>

      {/* scenario center */}
      <section>
        <SectionTitle icon="Layers" hint="one click sets up a whole situation, live in the simulator">
          Scenario Center
        </SectionTitle>
        <ScenarioCenter />
      </section>

      {/* simulator */}
      <section>
        <SectionTitle icon="Cpu" hint="inject a single sensor event into the running model">
          Simulate a single event
        </SectionTitle>
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="danger"
              icon="ShieldAlert"
              onClick={() => {
                api.simulate('door_open')
                api.toast(
                  state.homeMode === 'home'
                    ? 'Door opened — logged as a routine entry in Home Mode'
                    : 'Door opened while armed — alert escalating',
                  state.homeMode === 'home' ? 'info' : 'error',
                )
              }}
            >
              Simulate Security Event
            </Button>
            <span className="text-[11.5px] text-mist-500">
              Opens the front door sensor. With Away or Night Mode active this escalates to a critical alert
              through the Intrusion watch rule.
            </span>
          </div>

          <div className="mt-4 grid gap-2 border-t border-white/6 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {SIM_EVENTS.map((ev) => {
              const c = tone(ev.tone)
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    api.simulate(ev.id, { room: 'living' })
                    api.toast(`Simulated: ${ev.label}`, 'info')
                  }}
                  className="flex items-center gap-2.5 rounded-xl bg-white/4 px-3 py-2.5 text-left ring-1 ring-white/8 transition hover:bg-white/8"
                >
                  <span className={cx('grid size-7 shrink-0 place-items-center rounded-lg', c.bg, c.text)}>
                    <Icon name={ev.icon} size={14} />
                  </span>
                  <span className="text-[12px] font-medium text-mist-200">{ev.label}</span>
                </button>
              )
            })}
          </div>
        </Card>
      </section>

      {/* event log */}
      <section>
        <SectionTitle
          icon="History"
          hint={`${events.length} entries`}
          action={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-xl bg-ink-850/70 p-1 ring-1 ring-white/8">
                {[
                  { id: 'security', label: 'Security' },
                  { id: 'all', label: 'All activity' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cx(
                      'rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition',
                      filter === f.id ? 'bg-white/10 text-mist-100' : 'text-mist-500 hover:text-mist-300',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <Button
                variant="subtle"
                size="sm"
                icon="Trash2"
                onClick={() => {
                  api.clearEvents()
                  api.toast('Event log cleared', 'info')
                }}
              >
                Clear
              </Button>
            </div>
          }
        >
          Recent events
        </SectionTitle>

        {events.length === 0 ? (
          <EmptyState
            icon="History"
            title="No events recorded yet"
            detail="Trigger a sensor above, change the home mode, or run the guided demo to populate the log."
          />
        ) : (
          <Card className="p-2">
            <ul className="max-h-[520px] space-y-0.5 overflow-y-auto pr-1">
              {events.map((e) => (
                <SecurityEvent key={e.id} event={e} now={state.simTime} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
