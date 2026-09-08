import { useEffect, useRef, useState } from 'react'
import Icon from '../components/ui/Icon'
import { Button, Card, SectionTitle, StatusBadge, cx, tone, inputClass } from '../components/ui/primitives'
import AIInsight from '../components/AIInsight'
import { useHome } from '../context/HomeContext'
import { SUGGESTED_PROMPTS } from '../utils/ai'
import { HOME_MODES } from '../data/constants'
import { ROOMS } from '../data/rooms'
import { clock, watts, kwh, currency, temp } from '../utils/format'
import { costOf } from '../utils/energy'

/* ------------------------------------------------------------------ bubble */

function Bubble({ message }) {
  const { api } = useHome()
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-emerald-400/15 px-3.5 py-2.5 text-[13px] leading-relaxed text-emerald-50 ring-1 ring-emerald-400/25">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center self-end rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 ring-1 ring-violet-400/30">
        <Icon name="Sparkles" size={15} className="text-violet-200" />
      </span>
      <div className="min-w-0 max-w-[88%] rounded-2xl rounded-bl-md bg-white/6 px-3.5 py-3 ring-1 ring-white/10">
        {message.demoStep && (
          <StatusBadge tone="violet" size="sm" className="mb-2">
            Guided demo · step {message.demoStep}
          </StatusBadge>
        )}
        <p className="text-[13px] leading-relaxed text-mist-100">{message.text}</p>

        {message.bullets?.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {message.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-mist-300">
                <Icon name="ChevronRight" size={12} className="mt-1 shrink-0 text-mist-500" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {message.actions?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((a, i) => (
              <Button
                key={i}
                variant={i === 0 ? 'primary' : 'ghost'}
                size="sm"
                icon="Check"
                onClick={() => api.run(a.effect, 'ai', `Applied: ${a.label}`)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}

        <p className="mt-2 text-[10px] text-mist-500">{clock(message.at)}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ context rail */

function ContextRail() {
  const { state, power, eco } = useHome()
  const rooms = state.sensors.rooms
  const warmest = ROOMS.reduce((a, r) => (rooms[r.id].temp > rooms[a.id].temp ? r : a), ROOMS[0])

  const rows = [
    { icon: 'House', label: 'Home mode', value: `${HOME_MODES[state.homeMode].label}`, tone: HOME_MODES[state.homeMode].tone },
    { icon: 'ShieldCheck', label: 'Security', value: state.security.status, tone: state.security.status === 'alert' ? 'rose' : state.security.status === 'warning' ? 'amber' : 'emerald' },
    { icon: 'Thermometer', label: 'Warmest room', value: `${warmest.name} ${temp(rooms[warmest.id].temp)}`, tone: 'sky' },
    { icon: 'Wind', label: 'Air quality', value: `${state.sensors.aqi} AQI`, tone: 'cyan' },
    { icon: 'Zap', label: 'Live load', value: watts(power.total), tone: 'violet' },
    { icon: 'Calendar', label: 'Energy today', value: `${kwh(state.energy.todayKwh)} · ${currency(costOf(state.energy.todayKwh))}`, tone: 'emerald' },
    { icon: 'Boxes', label: 'Active devices', value: `${power.active} of ${Object.keys(state.devices).length}`, tone: 'slate' },
    { icon: 'Leaf', label: 'Eco score', value: `${eco.score} / 100 · ${eco.band.label}`, tone: eco.band.tone },
  ]

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="Cpu" size={14} className="text-violet-300" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-mist-300">
          What the AI can see
        </h3>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const c = tone(r.tone)
          return (
            <li key={r.label} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 odd:bg-white/3">
              <Icon name={r.icon} size={13} className={c.text} />
              <span className="flex-1 truncate text-[11.5px] text-mist-400">{r.label}</span>
              <span className="shrink-0 text-[11.5px] font-medium capitalize text-mist-100">{r.value}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 border-t border-white/6 pt-2.5 text-[10.5px] leading-relaxed text-mist-500">
        Rule-based reasoning over live simulated telemetry — no API key, fully offline. The same interface
        would accept an LLM response without any UI change.
      </p>
    </Card>
  )
}

/* -------------------------------------------------------------------- page */

export default function Assistant() {
  const { state, api, insights } = useHome()
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  /* Greet on first visit so the transcript is never empty. */
  useEffect(() => {
    if (state.chat.length === 0) {
      api.pushChat({
        role: 'assistant',
        text: "I'm HomeSense AI. I read your sensors every few seconds and reason over them — climate, presence, energy and security. Ask me anything, or tap a suggestion below.",
        bullets: [
          'Every recommendation comes with its reason and a button that really applies it.',
          'I never invent numbers — everything I quote is read from live simulated telemetry.',
        ],
        actions: [],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.chat.length])

  const send = (text) => {
    const value = (text ?? input).trim()
    if (!value) return
    api.ask(value)
    setInput('')
  }

  return (
    <div className="grid gap-4 animate-float-in xl:grid-cols-[1.5fr_1fr]">
      {/* chat */}
      <Card className="flex h-[calc(100vh-190px)] min-h-[520px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/7 p-4">
          <span className="relative grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 ring-1 ring-violet-400/30">
            <Icon name="Sparkles" size={18} className="text-violet-200" />
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-ink-900" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-mist-100">HomeSense AI</h2>
            <p className="text-[11.5px] text-mist-500">
              Online · reasoning over {Object.keys(state.devices).length} devices and {ROOMS.length} rooms
            </p>
          </div>
          <Button variant="subtle" size="sm" icon="RefreshCw" onClick={api.clearChat}>
            Clear
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto p-4">
          {state.chat.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
        </div>

        <div className="border-t border-white/7 p-3.5">
          <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                className="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-[11.5px] text-mist-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-mist-100"
              >
                {p}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              type="text"
              className={cx(inputClass, 'flex-1')}
              placeholder="Ask about temperature, energy, security…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" variant="ai" icon="Send" disabled={!input.trim()}>
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </div>
      </Card>

      {/* rail */}
      <div className="space-y-4">
        <ContextRail />

        <section>
          <SectionTitle icon="Sparkles" hint={`${insights.length} live`}>
            Proactive recommendations
          </SectionTitle>
          <div className="space-y-3">
            {insights.map((insight) => (
              <AIInsight key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
