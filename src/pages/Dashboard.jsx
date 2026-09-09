import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import {
  Button,
  Card,
  SectionTitle,
  StatTile,
  StatusBadge,
  LivePulse,
  cx,
  tone,
} from '../components/ui/primitives'
import SensorCard from '../components/SensorCard'
import AIInsight from '../components/AIInsight'
import EcoScoreCard from '../components/EcoScoreCard'
import HomeSenseScoreCard from '../components/HomeSenseScoreCard'
import AwayModeBanner from '../components/AwayModeBanner'
import SecurityEvent from '../components/SecurityEvent'
import { LivePowerChart, DistributionChart } from '../components/EnergyChart'
import { useHome } from '../context/HomeContext'
import { ROOMS } from '../data/rooms'
import { HOME_MODES, SECURITY_STATUS, COMFORT, TARIFF, BASELINE } from '../data/constants'
import {
  costOf,
  co2Of,
  groupDistribution,
  efficiencyVsBaseline,
  projectMonthlyBill,
  averageDailyKwh,
} from '../utils/energy'
import {
  watts, kwh, currency, temp, round, clock, sinceLabel, aqiBand, pct,
} from '../utils/format'

/* ------------------------------------------------------------------- hero */

function Hero() {
  const { state, api, insights, power } = useHome()
  const actionable = insights.filter((i) => i.severity !== 'success')

  const avgKwh = averageDailyKwh(state) || state.energy.todayKwh || BASELINE.dailyKwh
  const savedKwhPerMonth = Math.max(0, (BASELINE.dailyKwh - avgKwh) * 30)
  const savedRupeesPerMonth = costOf(savedKwhPerMonth)
  const savedCo2PerMonth = co2Of(savedKwhPerMonth)

  return (
    <Card className="relative overflow-hidden p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-emerald-400/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-violet-500/20 ring-1 ring-violet-400/30">
              <Icon name="Sparkles" size={13} className="text-violet-300" />
            </span>
            <LivePulse label={`Monitoring · simulated clock ${clock(state.simTime)}`} />
          </div>

          <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight text-mist-100 sm:text-[27px]">
            <span className="text-gradient">HomeSense AI is actively monitoring</span>
            <br className="hidden sm:block" /> and optimising your home.
          </h1>

          <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-mist-400">
            {actionable.length > 0 ? (
              <>
                I found{' '}
                <span className="font-semibold text-mist-200">
                  {actionable.length} thing{actionable.length === 1 ? '' : 's'}
                </span>{' '}
                worth your attention right now — each one comes with the reason behind it and a button that
                actually fixes it.
              </>
            ) : (
              <>
                Everything is inside your comfort and safety envelope. I'm watching 13 simulated sensors and
                will speak up the moment that changes.
              </>
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge tone="violet" icon="Cpu">
              {state.automations.filter((a) => a.enabled).length} automations armed
            </StatusBadge>
            <StatusBadge tone="emerald" icon="Check">
              {state.stats.insightsActed} AI actions applied
            </StatusBadge>
            <StatusBadge tone="sky" icon="Zap">
              {watts(power.total)} live load
            </StatusBadge>
            <StatusBadge tone="slate" icon="ShieldCheck">
              Explainable AI · runs offline, no API keys
            </StatusBadge>
          </div>

          {savedRupeesPerMonth > 1 && (
            <div className="mt-3.5 inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl bg-emerald-400/8 px-3.5 py-2.5 ring-1 ring-emerald-400/20">
              <Icon name="TrendingDown" size={14} className="mb-0.5 text-emerald-300" />
              <span className="text-[13px] text-mist-300">Projected impact vs an un-optimised home:</span>
              <span className="text-[15px] font-semibold text-emerald-300">
                {currency(savedRupeesPerMonth, 0)}
              </span>
              <span className="text-[12px] text-mist-400">saved / month</span>
              <span className="text-mist-600">·</span>
              <span className="text-[15px] font-semibold text-emerald-300">
                {round(savedCo2PerMonth, 0)} kg
              </span>
              <span className="text-[12px] text-mist-400">CO₂ avoided / month</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2.5 lg:w-64">
          <Button
            variant="ai"
            size="lg"
            icon={state.demo.running ? 'Square' : 'Play'}
            onClick={() => (state.demo.running ? api.stopDemo() : api.startDemo())}
            className="w-full !py-4 text-[15px]"
          >
            {state.demo.running ? 'Stop guided demo' : 'Start Demo'}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-mist-500">
            A 70-second walkthrough that drives the real engine — heat, AI advice, energy, and a live
            security alert.
          </p>
        </div>
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------------- sections */

function HomeStatus() {
  const { state, power } = useHome()
  const mode = HOME_MODES[state.homeMode]
  const sec = SECURITY_STATUS[state.security.status]
  const alerting = state.security.status === 'alert' && !state.security.acknowledged

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        icon={state.homeMode === 'away' ? 'MapPin' : state.homeMode === 'night' ? 'Moon' : 'House'}
        tone={mode.tone}
        label="Home status"
        value={mode.label}
        hint={`Since ${clock(state.modeChangedAt)} · ${sinceLabel(state.modeChangedAt, state.simTime)}`}
      />
      <StatTile
        icon={alerting ? 'ShieldAlert' : 'ShieldCheck'}
        tone={sec.tone}
        label="Security"
        value={sec.label}
        hint={state.security.reason || `Perimeter ${state.homeMode === 'home' ? 'relaxed' : 'armed'}`}
      />
      <StatTile
        icon="Boxes"
        tone="cyan"
        label="Active devices"
        value={power.active}
        unit={`/ ${Object.keys(state.devices).length}`}
        hint={`${state.automations.filter((a) => a.enabled).length} automation rules running`}
      />
      <StatTile
        icon="Zap"
        tone={power.total > COMFORT.highPowerW ? 'amber' : 'emerald'}
        label="Current power"
        value={watts(power.total).replace(/ ?k?W/, '')}
        unit={power.total >= 1000 ? 'kW' : 'W'}
        hint={`${currency(costOf(power.total / 1000), 1)} per hour at this rate`}
      />
    </div>
  )
}

function Environment() {
  const { state } = useHome()
  const rooms = state.sensors.rooms
  const avgTemp = ROOMS.reduce((a, r) => a + rooms[r.id].temp, 0) / ROOMS.length
  const avgHum = ROOMS.reduce((a, r) => a + rooms[r.id].humidity, 0) / ROOMS.length
  const band = aqiBand(state.sensors.aqi)
  const activeMotion = ROOMS.filter((r) => rooms[r.id].motion)
  const door = state.sensors.door

  const warmest = ROOMS.reduce((a, r) => (rooms[r.id].temp > rooms[a.id].temp ? r : a), ROOMS[0])

  return (
    <section>
      <SectionTitle icon="Waves" hint="live sensor feed">
        Environment
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SensorCard
          icon="Thermometer"
          label="Temperature"
          value={round(avgTemp, 1)}
          unit="°C"
          tone={avgTemp > state.prefs.tempMax ? 'amber' : 'emerald'}
          live
          meter={{ value: ((avgTemp - 18) / 18) * 100, tone: avgTemp > state.prefs.tempMax ? 'amber' : 'emerald' }}
          hint={`Warmest: ${warmest.name} at ${temp(rooms[warmest.id].temp)} · outdoor ${temp(state.sensors.outdoorTemp)}`}
        />
        <SensorCard
          icon="Droplets"
          label="Humidity"
          value={round(avgHum, 0)}
          unit="%"
          tone={avgHum > COMFORT.humidityMax ? 'amber' : 'sky'}
          live
          meter={{ value: avgHum, tone: avgHum > COMFORT.humidityMax ? 'amber' : 'sky' }}
          hint={avgHum > COMFORT.humidityMax ? 'Above the comfortable band' : 'Within the comfortable band'}
        />
        <SensorCard
          icon="Wind"
          label="Air quality"
          value={state.sensors.aqi}
          unit="AQI"
          tone={band.tone}
          live
          meter={{ value: (state.sensors.aqi / 300) * 100, tone: band.tone }}
          hint={`${band.label} · lower is cleaner`}
        />
        <SensorCard
          icon="Radar"
          label="Motion"
          value={activeMotion.length ? `${activeMotion.length} room${activeMotion.length > 1 ? 's' : ''}` : 'None'}
          tone={activeMotion.length ? 'emerald' : 'slate'}
          live={activeMotion.length > 0}
          hint={
            activeMotion.length
              ? activeMotion.map((r) => r.name).join(', ')
              : 'No presence detected anywhere in the house'
          }
        />
        <SensorCard
          icon={door.open ? 'DoorOpen' : 'DoorClosed'}
          label="Front door"
          value={door.open ? 'Open' : 'Closed'}
          tone={door.open ? 'rose' : door.locked ? 'emerald' : 'amber'}
          badge={
            <StatusBadge tone={door.locked ? 'emerald' : 'amber'} size="sm" icon={door.locked ? 'Lock' : 'Unlock'}>
              {door.locked ? 'Locked' : 'Unlocked'}
            </StatusBadge>
          }
          hint={`Last opened ${sinceLabel(door.lastOpenedAt, state.simTime)}`}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </section>
  )
}

function EnergyPanel() {
  const { state, power } = useHome()
  const dist = groupDistribution(state)
  const efficiency = efficiencyVsBaseline(state)
  const bill = projectMonthlyBill(state)

  return (
    <section>
      <SectionTitle
        icon="Zap"
        hint={TARIFF.label}
        action={
          <Link
            to="/energy"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-300 transition hover:text-emerald-200"
          >
            Full analytics <Icon name="ArrowRight" size={13} />
          </Link>
        }
      >
        Energy
      </SectionTitle>

      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Mini label="Current power" value={watts(power.total)} tone="emerald" icon="Activity" />
          <Mini label="Today" value={kwh(state.energy.todayKwh)} tone="sky" icon="Calendar" />
          <Mini label="Estimated cost" value={currency(costOf(state.energy.todayKwh))} tone="violet" icon="IndianRupee" />
          <Mini
            label="Efficiency"
            value={`${efficiency >= 0 ? '+' : ''}${efficiency}%`}
            tone={efficiency >= 0 ? 'emerald' : 'rose'}
            icon={efficiency >= 0 ? 'TrendingDown' : 'TrendingUp'}
            hint="vs baseline home"
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-mist-500">
                Live household load
              </p>
              <LivePulse label={`peak ${watts(state.energy.peakW)}`} />
            </div>
            <LivePowerChart data={state.energy.powerHistory} height={186} />
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-mist-500">
              Today by appliance
            </p>
            <DistributionChart data={dist} height={186} showLegend={false} />
            <ul className="mt-2 space-y-1">
              {dist.slice(0, 3).map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-[11.5px]">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
                  <span className="flex-1 truncate text-mist-300">{d.name}</span>
                  <span className="tabular-nums text-mist-400">{pct(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 border-t border-white/6 pt-3 text-[11.5px] text-mist-500">
          Projected month-end bill{' '}
          <span className="font-semibold text-mist-200">{currency(bill.cost)}</span> · about{' '}
          {round(bill.units, 0)} units at {TARIFF.currency}
          {TARIFF.ratePerKwh.toFixed(2)} per kWh plus {currency(TARIFF.fixedMonthlyCharge)} fixed charges.
        </p>
      </Card>
    </section>
  )
}

function Mini({ label, value, tone: t, icon, hint }) {
  const c = tone(t)
  return (
    <div className="rounded-xl bg-white/4 p-3 ring-1 ring-white/6">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={12} className={c.text} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-mist-500">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums leading-none text-mist-100">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-mist-500">{hint}</p>}
    </div>
  )
}

function RoomsGlance() {
  const { state, power } = useHome()
  return (
    <section>
      <SectionTitle
        icon="Sofa"
        action={
          <Link
            to="/rooms"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-300 transition hover:text-emerald-200"
          >
            Control rooms <Icon name="ArrowRight" size={13} />
          </Link>
        }
      >
        Rooms at a glance
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ROOMS.map((room) => {
          const s = state.sensors.rooms[room.id]
          const c = tone(room.accent)
          return (
            <Link
              key={room.id}
              to="/rooms"
              className={cx(
                'glass group rounded-2xl p-3.5 transition-all duration-300 hover:-translate-y-0.5',
                s.motion ? cx('ring-1', c.ring) : 'ring-1 ring-white/7',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cx('grid size-8 place-items-center rounded-lg ring-1', c.bg, c.ring, c.text)}>
                  <Icon name={room.icon} size={15} />
                </span>
                {s.motion && <span className={cx('size-1.5 animate-breathe rounded-full', c.dot)} />}
              </div>
              <p className="mt-2.5 truncate text-[12.5px] font-semibold text-mist-100">{room.name}</p>
              <p className="mt-0.5 text-[11px] tabular-nums text-mist-400">
                {temp(s.temp)} · {round(s.humidity, 0)}%
              </p>
              <p className="mt-1 text-[10.5px] text-mist-500">{watts(power.byRoom[room.id] ?? 0)} drawing</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function InsightsPanel() {
  const { insights } = useHome()
  const top = insights.slice(0, 5)
  const critical = top.filter((i) => i.tier === 'CRITICAL' || i.tier === 'HIGH').length

  return (
    <section>
      <SectionTitle
        icon="Sparkles"
        hint={`${insights.length} active${critical ? ` · ${critical} need attention` : ''}`}
        action={
          <Link
            to="/assistant"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-300 transition hover:text-violet-200"
          >
            Ask the AI <Icon name="ArrowRight" size={13} />
          </Link>
        }
      >
        AI Insights
      </SectionTitle>
      <div className="space-y-3">
        {top.map((insight) => (
          <AIInsight key={insight.id} insight={insight} />
        ))}
      </div>
    </section>
  )
}

function ActivityFeed() {
  const { state } = useHome()
  const [filter, setFilter] = useState('all')
  const events =
    filter === 'ai'
      ? state.events.filter((e) => e.source === 'ai' || e.source === 'automation')
      : state.events

  return (
    <section>
      <SectionTitle
        icon="History"
        hint="real events from application state"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-xl bg-ink-850/70 p-1 ring-1 ring-white/8">
              {[
                { id: 'all', label: 'Home timeline' },
                { id: 'ai', label: 'AI actions' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cx(
                    'rounded-lg px-2.5 py-1 text-[11px] font-medium transition',
                    filter === f.id ? 'bg-white/10 text-mist-100' : 'text-mist-500 hover:text-mist-300',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Link
              to="/security"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-300 transition hover:text-emerald-200"
            >
              Full log <Icon name="ArrowRight" size={13} />
            </Link>
          </div>
        }
      >
        Recent activity
      </SectionTitle>
      <Card className="p-2">
        {events.length === 0 ? (
          <p className="p-4 text-center text-[12px] text-mist-500">
            No AI or automation actions recorded yet — trigger a scenario to populate this.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {events.slice(0, 7).map((e) => (
              <SecurityEvent key={e.id} event={e} now={state.simTime} />
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

/* -------------------------------------------------------------------- page */

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-float-in">
      <Hero />
      <HomeSenseScoreCard />
      <AwayModeBanner />
      <HomeStatus />

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-6">
          <Environment />
          <EnergyPanel />
          <RoomsGlance />
        </div>
        <div className="space-y-6">
          <InsightsPanel />
          <section>
            <SectionTitle icon="Leaf" hint="feeds the Energy & Carbon pillars above">
              Energy &amp; Carbon detail
            </SectionTitle>
            <EcoScoreCard />
          </section>
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
