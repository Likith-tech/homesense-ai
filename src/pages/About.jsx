import Icon from '../components/ui/Icon'
import { Button, Card, SectionTitle, StatusBadge, Toggle, cx, tone } from '../components/ui/primitives'
import { useHome } from '../context/HomeContext'
import { APP, TARIFF, SIM, CO2_PER_KWH, BASELINE } from '../data/constants'
import { DEVICE_CATALOG } from '../data/devices'
import { ROOMS } from '../data/rooms'
import { DEMO_STEPS } from '../utils/demo'
import SystemStatus from '../components/SystemStatus'

const PILLARS = [
  {
    icon: 'CircleAlert',
    title: 'Problem',
    tone: 'rose',
    body: 'Indian households lose 15–20% of their electricity bill to things nobody is watching — an AC left at 20°C, a light on in an empty room, a TV playing to nobody — and get no warning when a door opens while the house is supposed to be empty. "Smart" home apps just move the light switch onto a phone; they still need a human to notice, decide and act.',
  },
  {
    icon: 'Sparkles',
    title: 'Solution',
    tone: 'emerald',
    body: 'HomeSense AI watches the house continuously and closes the loop itself: it correlates climate, presence, energy and security into one picture, and every recommendation ships with the numeric reasoning behind it and a button that genuinely carries it out. No black-box model to trust blindly — every "why" is auditable back to a sensor reading, and it keeps working with zero internet and zero API cost.',
  },
  {
    icon: 'Rocket',
    title: 'Innovation',
    tone: 'violet',
    body: 'AI reasoning + a full IoT simulation + energy optimisation + security monitoring + a visual automation builder, in one coherent product. The intelligence layer is decoupled from the transport, so the reasoning does not care whether a reading came from a model or a radio.',
  },
  {
    icon: 'Cable',
    title: 'Future',
    tone: 'sky',
    body: 'Every device and room already carries a stable id and an MQTT-shaped topic. Connecting real sensors means swapping the simulation tick for an MQTT subscriber — ESP32 nodes, Home Assistant, Zigbee2MQTT or Matter bridges — with no change to automations, analytics or the AI layer.',
  },
]

const ARCHITECTURE = [
  {
    layer: 'Simulation engine',
    file: 'utils/simulation.js',
    icon: 'Cpu',
    detail:
      'Diurnal outdoor temperature curve, first-order thermal model per room, Markov occupancy, humidity and AQI dynamics. Advances on a fixed tick and is entirely pure.',
  },
  {
    layer: 'Energy model',
    file: 'utils/energy.js',
    icon: 'Zap',
    detail:
      'Per-device instantaneous power including inverter-AC compressor modulation and refrigerator duty cycling. kWh is integrated from watts — never generated at random.',
  },
  {
    layer: 'Automation engine',
    file: 'utils/automations.js',
    icon: 'Workflow',
    detail:
      'Ten condition types and nine action types, edge-triggered with a cooldown, evaluated against live state on every tick.',
  },
  {
    layer: 'Reasoning layer',
    file: 'utils/ai.js',
    icon: 'Sparkles',
    detail:
      'A deterministic expert system producing ranked insights, each with an observation, a justification, a priority tier, a confidence score and an executable effect. Runs offline with no API key.',
  },
  {
    layer: 'HomeSense Score',
    file: 'utils/homeSenseScore.js',
    icon: 'Gauge',
    detail:
      'Composite 0-100 rating across five pillars — Energy, Security, Comfort, Carbon, Automation — each with an attributed reason. Recomputed live; nothing is stored or hard-coded.',
  },
  {
    layer: 'What-if engine',
    file: 'utils/whatIf.js',
    icon: 'Clock',
    detail:
      'Projects a real, currently-measured wattage forward in time to answer "what happens if nothing changes" — extending a live number, never inventing one.',
  },
  {
    layer: 'Behavioral baseline',
    file: 'utils/behavioralBaseline.js',
    icon: 'History',
    detail:
      'A transparent, rule/statistical hour-of-day activity table per room — explicitly not machine learning — used to flag activity outside a room’s normal pattern.',
  },
  {
    layer: 'Effect pipeline',
    file: 'utils/effects.js',
    icon: 'Blocks',
    detail:
      'The single place any device, mode or alert changes. Manual toggles, automations, AI buttons and the demo all funnel through it, which is why one action updates everything at once.',
  },
  {
    layer: 'State container',
    file: 'context/HomeContext.jsx',
    icon: 'Server',
    detail:
      'One reducer, one source of truth, persisted to localStorage. Insights, power and eco score are derived — never stored — so they can never drift out of sync.',
  },
]

const STACK = [
  { name: 'React 18', icon: 'Blocks' },
  { name: 'Vite 6', icon: 'Zap' },
  { name: 'Tailwind CSS 4', icon: 'Layers' },
  { name: 'Recharts', icon: 'BarChart3' },
  { name: 'Lucide icons', icon: 'Gem' },
  { name: 'localStorage', icon: 'Server' },
]

function FlowNode({ children }) {
  return (
    <span className="rounded-lg bg-white/6 px-2.5 py-1.5 font-medium text-mist-200 ring-1 ring-white/10">
      {children}
    </span>
  )
}

function Settings() {
  const { state, api } = useHome()
  return (
    <Card className="p-5">
      <SectionTitle icon="SlidersHorizontal" hint="applies immediately across the app">
        Preferences
      </SectionTitle>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-mist-200">Comfort ceiling</span>
            <span className="text-[13px] font-semibold tabular-nums text-emerald-300">
              {state.prefs.tempMax}°C
            </span>
          </div>
          <input
            type="range"
            min={22}
            max={32}
            step={1}
            value={state.prefs.tempMax}
            onChange={(e) => api.setPrefs({ tempMax: Number(e.target.value) })}
            className="mt-2.5 w-full"
            aria-label="Comfort ceiling"
          />
          <p className="mt-1 text-[11px] text-mist-500">
            Above this the AI recommends cooling and the comfort automations arm.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-mist-200">Comfort floor</span>
            <span className="text-[13px] font-semibold tabular-nums text-sky-300">
              {state.prefs.tempMin}°C
            </span>
          </div>
          <input
            type="range"
            min={16}
            max={24}
            step={1}
            value={state.prefs.tempMin}
            onChange={(e) => api.setPrefs({ tempMin: Number(e.target.value) })}
            className="mt-2.5 w-full"
            aria-label="Comfort floor"
          />
          <p className="mt-1 text-[11px] text-mist-500">Below this a room is reported as too cold.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
        <div className="flex items-center gap-3">
          <Toggle
            checked={state.prefs.autoRun}
            onChange={(v) => api.setPrefs({ autoRun: v })}
            label="Run simulation"
          />
          <div>
            <p className="text-[12.5px] font-medium text-mist-200">
              Simulation {state.prefs.autoRun ? 'running' : 'paused'}
            </p>
            <p className="text-[11px] text-mist-500">
              One tick every {SIM.tickMs} ms — {SIM.minutesPerTick} simulated minute each.
            </p>
          </div>
        </div>
        <Button variant="danger" icon="RefreshCw" onClick={api.reset}>
          Reset simulation & clear storage
        </Button>
      </div>
    </Card>
  )
}

export default function About() {
  const { state } = useHome()

  return (
    <div className="space-y-6 animate-float-in">
      {/* hero */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-10 size-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400/25 to-cyan-400/10 ring-1 ring-emerald-400/30">
              <Icon name="House" size={22} className="text-emerald-300" />
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-violet-500 ring-2 ring-ink-900">
                <Icon name="Sparkles" size={11} className="text-white" />
              </span>
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-mist-100 sm:text-2xl">{APP.name}</h1>
              <p className="text-[13px] text-mist-400">{APP.tagline}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge tone="emerald" icon="Boxes">{DEVICE_CATALOG.length} simulated devices</StatusBadge>
            <StatusBadge tone="sky" icon="Sofa">{ROOMS.length} rooms</StatusBadge>
            <StatusBadge tone="violet" icon="Workflow">{state.automations.length} automation rules</StatusBadge>
            <StatusBadge tone="amber" icon="Presentation">{DEMO_STEPS.length}-step guided demo</StatusBadge>
            <StatusBadge tone="cyan" icon="Cable">Hackathon prototype · no hardware attached</StatusBadge>
          </div>
        </div>
      </Card>

      <SystemStatus />

      {/* pillars */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PILLARS.map((p) => {
          const c = tone(p.tone)
          return (
            <Card key={p.title} className="p-5">
              <div className="flex items-center gap-2.5">
                <span className={cx('grid size-9 place-items-center rounded-xl ring-1', c.bg, c.ring, c.text)}>
                  <Icon name={p.icon} size={17} />
                </span>
                <h3 className="text-sm font-semibold text-mist-100">{p.title}</h3>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-mist-400">{p.body}</p>
            </Card>
          )
        })}
      </div>

      {/* honesty note */}
      <Card className="flex flex-col gap-3 p-5 ring-1 ring-amber-400/20 sm:flex-row">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/12 text-amber-300 ring-1 ring-amber-400/25">
          <Icon name="Info" size={18} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-mist-100">No physical hardware is connected</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist-400">
            Every sensor reading in this prototype is produced by a physical model running in your browser —
            an outdoor temperature curve, a per-room thermal simulation, a presence model and an integrated
            energy meter. Nothing is pre-recorded and nothing pretends to come from a radio. The architecture
            is deliberately transport-agnostic so that swapping the simulator for real MQTT telemetry changes
            one module and leaves the other six untouched.
          </p>
        </div>
      </Card>

      {/* hardware path */}
      <Card className="p-5">
        <SectionTitle icon="Cable" hint="planned hardware path — nothing below is connected today">
          From simulator to hardware
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300">Current</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-mist-300">
              <FlowNode>Simulator</FlowNode>
              <Icon name="ArrowRight" size={13} className="text-mist-600" />
              <FlowNode>HomeSense Engine</FlowNode>
              <Icon name="ArrowRight" size={13} className="text-mist-600" />
              <FlowNode>UI</FlowNode>
            </div>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-sky-300">Planned hardware path</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-mist-300">
              <FlowNode>ESP32 sensors</FlowNode>
              <Icon name="ArrowRight" size={13} className="text-mist-600" />
              <FlowNode>MQTT</FlowNode>
              <Icon name="ArrowRight" size={13} className="text-mist-600" />
              <FlowNode>Gateway</FlowNode>
              <Icon name="ArrowRight" size={13} className="text-mist-600" />
              <FlowNode>HomeSense Engine</FlowNode>
              <Icon name="ArrowRight" size={13} className="text-mist-600" />
              <FlowNode>Device control</FlowNode>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-mist-500">
          Only the source of `state.sensors` changes — the reasoning layer, HomeSense Score, automations and
          scenario engine all read the same shape either way.
        </p>
      </Card>

      {/* architecture */}
      <section>
        <SectionTitle icon="Layers" hint="seven modules, one direction of data flow">
          Architecture
        </SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          {ARCHITECTURE.map((a) => (
            <Card key={a.layer} className="flex gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 text-mist-300 ring-1 ring-white/10">
                <Icon name={a.icon} size={16} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h4 className="text-[13px] font-semibold text-mist-100">{a.layer}</h4>
                  <code className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10.5px] text-mist-400">
                    {a.file}
                  </code>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-mist-400">{a.detail}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* model parameters */}
      <section>
        <SectionTitle icon="SlidersHorizontal" hint="every figure in the app traces back to these">
          Model parameters
        </SectionTitle>
        <Card className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Electricity tariff', `${TARIFF.currency}${TARIFF.ratePerKwh.toFixed(2)} per kWh`],
            ['Fixed monthly charge', `${TARIFF.currency}${TARIFF.fixedMonthlyCharge}`],
            ['Grid emission factor', `${CO2_PER_KWH} kg CO₂ / kWh`],
            ['Baseline comparison home', `${BASELINE.dailyKwh} kWh / day`],
            ['AC rating', '1500 W inverter, modulated by temperature error'],
            ['Fan rating', '75 W BLDC'],
            ['LED lamp rating', '12 W per lamp'],
            ['TV rating', '100 W active, 8 W standby'],
            ['Refrigerator', '150 W compressor, duty-cycled to 45 W'],
            ['Smart plug', '50 W load, 2 W standby'],
            ['House baseline', '24 W always-on (router, doorbell, clocks)'],
            ['Simulation tick', `${SIM.tickMs} ms real = ${SIM.minutesPerTick} simulated minute`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2">
              <span className="text-[11.5px] text-mist-500">{k}</span>
              <span className="shrink-0 text-right text-[12px] font-medium text-mist-200">{v}</span>
            </div>
          ))}
        </Card>
      </section>

      {/* stack */}
      <section>
        <SectionTitle icon="Blocks">Technology</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {STACK.map((s) => (
            <span
              key={s.name}
              className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] font-medium text-mist-200"
            >
              <Icon name={s.icon} size={14} className="text-emerald-300" />
              {s.name}
            </span>
          ))}
        </div>
      </section>

      <Settings />

      <p className="pb-4 text-center text-[11px] text-mist-500">
        {APP.name} v{APP.version} · built for the Smart Living track · simulated IoT, no hardware required
      </p>
    </div>
  )
}
