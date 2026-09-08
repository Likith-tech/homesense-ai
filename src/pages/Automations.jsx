import { useState } from 'react'
import Icon from '../components/ui/Icon'
import { Button, Card, EmptyState, SectionTitle, StatTile } from '../components/ui/primitives'
import AutomationCard from '../components/AutomationCard'
import AutomationEditor from '../components/AutomationEditor'
import { useHome } from '../context/HomeContext'
import { testConditions, DEFAULT_AUTOMATIONS } from '../utils/automations'
import { uid, sinceLabel } from '../utils/format'

/** One-tap starting points, so the builder is never a blank page. */
const TEMPLATES = [
  {
    id: 'tpl-comfort',
    name: 'Cool the bedroom automatically',
    description: 'Runs the bedroom AC at 24°C when the room passes 28°C.',
    icon: 'AirVent',
    conditions: [{ type: 'temp_above', room: 'bedroom', value: 28 }],
    actions: [
      { type: 'DEVICE_ON', id: 'bedroom-ac' },
      { type: 'SET_SETPOINT', id: 'bedroom-ac', value: 24 },
    ],
  },
  {
    id: 'tpl-kitchen',
    name: 'Kitchen lights follow presence',
    description: 'Turns the kitchen lights off 15 minutes after the room empties.',
    icon: 'Lightbulb',
    conditions: [{ type: 'no_motion_for', room: 'kitchen', minutes: 15 }],
    actions: [{ type: 'ROOM_LIGHTS_OFF', room: 'kitchen' }],
  },
  {
    id: 'tpl-air',
    name: 'Ventilate on poor air quality',
    description: 'Starts the living room fan when the indoor AQI climbs past 140.',
    icon: 'Wind',
    conditions: [{ type: 'aqi_above', value: 140 }],
    actions: [{ type: 'DEVICE_ON', id: 'living-fan' }],
  },
  {
    id: 'tpl-night',
    name: 'Night wind-down',
    description: 'Clears the living room lights and TV once Night Mode starts.',
    icon: 'Moon',
    conditions: [{ type: 'home_mode_is', mode: 'night' }],
    actions: [{ type: 'DEVICES_OFF', ids: ['living-light', 'tv', 'kitchen-light'] }],
  },
]

export default function Automations() {
  const { state, api } = useHome()
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)

  const enabled = state.automations.filter((a) => a.enabled)
  const matching = state.automations.filter((a) => a.enabled && testConditions(state, a))
  const totalFired = state.automations.reduce((a, r) => a + (r.firedCount || 0), 0)
  const lastFired = state.automations
    .filter((a) => a.lastFiredAt)
    .sort((a, b) => b.lastFiredAt - a.lastFiredAt)[0]

  const openEditor = (rule = null) => {
    setEditing(rule)
    setOpen(true)
  }

  const addTemplate = (tpl) => {
    api.saveAutomation({
      id: uid('auto'),
      name: tpl.name,
      description: tpl.description,
      enabled: true,
      match: 'all',
      conditions: tpl.conditions,
      actions: tpl.actions,
      lastFiredAt: null,
      firedCount: 0,
      wasTrue: false,
    })
    api.toast(`"${tpl.name}" added and armed`, 'success')
  }

  const restoreDefaults = () => {
    DEFAULT_AUTOMATIONS.forEach((rule) => {
      if (!state.automations.some((a) => a.id === rule.id)) api.saveAutomation({ ...rule })
    })
    api.toast('Default automation rules restored', 'info')
  }

  return (
    <div className="space-y-6 animate-float-in">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="Workflow" tone="violet" label="Rules created" value={state.automations.length} hint={`${enabled.length} armed, ${state.automations.length - enabled.length} paused`} />
        <StatTile icon="Target" tone={matching.length ? 'emerald' : 'slate'} label="Conditions met now" value={matching.length} hint={matching.length ? matching.map((m) => m.name).join(', ') : 'No rule is currently triggered'} />
        <StatTile icon="Zap" tone="amber" label="Total activations" value={totalFired} hint={lastFired ? `Last: ${lastFired.name}` : 'Nothing has fired yet this session'} />
        <StatTile icon="Clock" tone="sky" label="Last activation" value={lastFired ? sinceLabel(lastFired.lastFiredAt, state.simTime) : '—'} hint="Rules are edge-triggered with a 4-minute cooldown" />
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-violet-300 ring-1 ring-violet-400/25">
          <Icon name="Cpu" size={17} />
        </span>
        <p className="mr-auto max-w-xl text-[12px] leading-relaxed text-mist-400">
          Automations evaluate against live sensor state on every simulation tick. They fire on the{' '}
          <span className="text-mist-200">transition</span> into a matching condition — so "temperature above
          27°C" starts the AC once, not sixty times a minute — and then cool down for four simulated minutes.
        </p>
        <Button variant="subtle" size="sm" icon="RefreshCw" onClick={restoreDefaults}>
          Restore defaults
        </Button>
        <Button variant="primary" icon="Plus" onClick={() => openEditor(null)}>
          New automation
        </Button>
      </Card>

      {state.automations.length === 0 ? (
        <EmptyState
          icon="Workflow"
          title="No automation rules yet"
          detail="Automations are where the savings compound — they act in the seconds between something going wrong and you noticing it."
          action={
            <Button variant="primary" icon="Plus" onClick={() => openEditor(null)}>
              Create your first rule
            </Button>
          }
        />
      ) : (
        <section>
          <SectionTitle icon="Workflow" hint={`${enabled.length} of ${state.automations.length} armed`}>
            Your rules
          </SectionTitle>
          <div className="grid gap-3 xl:grid-cols-2">
            {state.automations.map((rule) => (
              <AutomationCard key={rule.id} rule={rule} onEdit={openEditor} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle icon="Blocks" hint="one tap to add and arm">
          Templates
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TEMPLATES.map((tpl) => {
            const already = state.automations.some((a) => a.name === tpl.name)
            return (
              <Card key={tpl.id} className="flex flex-col p-4">
                <span className="grid size-9 place-items-center rounded-xl bg-white/5 text-mist-300 ring-1 ring-white/10">
                  <Icon name={tpl.icon} size={16} />
                </span>
                <h4 className="mt-3 text-[12.5px] font-semibold leading-snug text-mist-100">{tpl.name}</h4>
                <p className="mt-1 flex-1 text-[11.5px] leading-relaxed text-mist-500">{tpl.description}</p>
                <Button
                  variant={already ? 'subtle' : 'ghost'}
                  size="sm"
                  icon={already ? 'Check' : 'Plus'}
                  disabled={already}
                  className="mt-3 w-full"
                  onClick={() => addTemplate(tpl)}
                >
                  {already ? 'Already added' : 'Add rule'}
                </Button>
              </Card>
            )
          })}
        </div>
      </section>

      {open && (
        <AutomationEditor
          key={editing?.id ?? 'new'}
          rule={editing}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
