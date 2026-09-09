import { useState } from 'react'
import Icon from './ui/Icon'
import { Button, Card, StatusBadge, cx, tone } from './ui/primitives'
import { useHome } from '../context/HomeContext'

/**
 * Scenario Center — one click sets up a whole situation by composing the same
 * effects and sim events used everywhere else in the app (manual toggles, the
 * guided demo, the low-level sensor simulator below this section). Nothing is
 * painted on screen; every scenario actually mutates the running simulator,
 * so HomeSense re-reasons over genuinely different telemetry afterwards.
 *
 * Deterministic and repeatable: the same click always applies the same
 * effects regardless of what state the simulator happened to be in before —
 * "Reset scenario" below returns to a known baseline so a judge can re-run
 * any scenario cleanly as many times as they like.
 */
const SCENARIOS = [
  {
    id: 'normal',
    label: 'Normal Day',
    icon: 'Sun',
    tone: 'emerald',
    description: 'Baseline household — nothing unusual.',
    changes: ['Home Mode → Home', 'Alerts → acknowledged', 'Front door → closed'],
    detection: 'No anomaly — HomeSense stays quiet.',
    action: 'None needed.',
    run: (api) => {
      api.setHomeMode('home')
      api.run({ type: 'ACK_ALERTS' })
      api.simulate('door_close')
    },
  },
  {
    id: 'family-leaves',
    label: 'Family Leaves',
    icon: 'MapPin',
    tone: 'amber',
    description: 'The hero scenario — occupancy drops but loads stay on.',
    changes: ['Occupancy → 0', 'Home Mode → Away', 'AC / Lights / TV → left ON'],
    detection: 'Energy vs. occupancy mismatch while armed.',
    action: 'Recommend Optimise Home (manual approval).',
    // Pauses the default away-saver automation for this scenario only, so the
    // mismatch is visible long enough to click "Optimise Home" yourself rather
    // than being cleared by the automation within the next tick.
    run: (api, state) => {
      const auto = state.automations.find((a) => a.id === 'auto_away_saver')
      if (auto?.enabled) api.toggleAutomation('auto_away_saver')
      api.setHomeMode('away')
    },
  },
  {
    id: 'extreme-heat',
    label: 'Extreme Heat',
    icon: 'ThermometerSun',
    tone: 'orange',
    description: 'Injects a strong outdoor heat surge into the thermal model.',
    changes: ['Outdoor temp → +9°C surge', 'All rooms drift warmer over time'],
    detection: 'Room temperature crosses the comfort ceiling.',
    action: 'Recommend cooling (AC or fan).',
    run: (api) => {
      api.simulate('temp_rise')
      api.simulate('temp_rise')
    },
  },
  {
    id: 'energy-spike',
    label: 'Energy Spike',
    icon: 'Zap',
    tone: 'violet',
    description: 'Both ACs, the TV and kitchen lights switch on together.',
    changes: ['Living AC → ON', 'Bedroom AC → ON', 'TV → ON', 'Kitchen light → ON'],
    detection: 'Total household draw crosses the high-power threshold.',
    action: 'Recommend an eco sweep / setpoint optimisation.',
    run: (api) => api.simulate('high_energy'),
  },
  {
    id: 'security-anomaly',
    label: 'Security Anomaly',
    icon: 'ShieldAlert',
    tone: 'rose',
    description: 'Arms the house, then opens the front door.',
    changes: ['Home Mode → Away', 'Front door → OPEN'],
    detection: 'Door opened while armed — highest-priority signal.',
    action: 'Raise a CRITICAL alert, recommend lock-down.',
    run: (api) => {
      api.setHomeMode('away')
      setTimeout(() => api.simulate('door_open'), 350)
    },
  },
  {
    id: 'night-mode',
    label: 'Night Mode',
    icon: 'Moon',
    tone: 'indigo',
    description: 'Arms for sleep — quiet climate, lights expected off.',
    changes: ['Home Mode → Night', 'Front door → locked'],
    detection: 'Any light left on outside the bedroom.',
    action: 'Flag it as a Night Mode exception.',
    run: (api) => api.setHomeMode('night'),
  },
  {
    id: 'guest-arrives',
    label: 'Guest Arrives',
    icon: 'UserPlus',
    tone: 'sky',
    description: 'Motion detected in the Living Room, Home Mode stays relaxed.',
    changes: ['Living Room motion → detected', 'Occupancy → 1'],
    detection: 'Routine presence — no security escalation in Home Mode.',
    action: 'None — this is expected behaviour.',
    run: (api) => {
      api.setHomeMode('home')
      api.simulate('motion_detected', { room: 'living' })
    },
  },
  {
    id: 'appliance-left',
    label: 'Appliance Left Running',
    icon: 'Tv',
    tone: 'cyan',
    description: 'TV switched on, then the room goes quiet for 20 minutes.',
    changes: ['TV → ON', 'Living Room motion → none for 20 min'],
    detection: 'Device active with no correlated presence.',
    action: 'Recommend turning the TV off.',
    run: (api) => {
      api.setDevice('tv', true)
      api.simulate('motion_stop', { room: 'living', minutesAgo: 20 })
    },
  },
]

export default function ScenarioCenter() {
  const { api, state } = useHome()
  const [active, setActive] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const resetScenario = () => {
    api.setHomeMode('home')
    api.run({ type: 'ACK_ALERTS' })
    api.simulate('door_close')
    // Clear anything a scenario may have switched on...
    api.run({ type: 'DEVICES_OFF', ids: ['living-ac', 'bedroom-ac', 'tv', 'kitchen-light'] })
    // ...and restore the baseline devices a fresh boot starts with, so
    // "Family Leaves" has something to detect again on a second run.
    api.run({ type: 'DEVICES_ON', ids: ['living-light', 'living-fan', 'smart-plug'] })
    api.simulate('temp_drop')
    api.simulate('temp_drop')
    const auto = state.automations.find((a) => a.id === 'auto_away_saver')
    if (auto && !auto.enabled) api.toggleAutomation('auto_away_saver')
    setActive(null)
    api.toast('Scenario reset — home returned to a normal baseline', 'info')
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {active ? (
            <StatusBadge tone="amber" size="sm" pulse>
              Scenario active: {SCENARIOS.find((s) => s.id === active)?.label}
            </StatusBadge>
          ) : (
            <span className="text-[11.5px] text-mist-500">No scenario active — click one to run it live.</span>
          )}
        </div>
        <Button variant="subtle" size="sm" icon="RefreshCw" onClick={resetScenario}>
          Reset scenario
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SCENARIOS.map((sc) => {
          const c = tone(sc.tone)
          const isExpanded = expanded === sc.id
          const isActive = active === sc.id
          return (
            <div
              key={sc.id}
              className={cx(
                'flex flex-col gap-2 rounded-xl bg-white/4 p-3 ring-1 transition',
                isActive ? cx('ring-1', c.ring) : 'ring-white/8',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  sc.run(api, state)
                  setActive(sc.id)
                  api.toast(`Scenario: ${sc.label} — HomeSense is re-analysing`, 'info')
                }}
                className="flex flex-1 flex-col items-start gap-2 text-left"
              >
                <span className={cx('grid size-8 place-items-center rounded-lg ring-1', c.bg, c.ring, c.text)}>
                  <Icon name={sc.icon} size={15} />
                </span>
                <div>
                  <p className="text-[12px] font-semibold text-mist-100">{sc.label}</p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-mist-500">{sc.description}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : sc.id)}
                className="flex items-center gap-1 text-[10px] font-medium text-mist-500 transition hover:text-mist-300"
              >
                <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={10} />
                {isExpanded ? 'Hide' : 'Details'}
              </button>
              {isExpanded && (
                <div className="space-y-1.5 border-t border-white/8 pt-2 text-[10.5px] leading-snug text-mist-400">
                  <p>
                    <span className="font-medium text-mist-300">Sensors affected: </span>
                    {sc.changes.join(' · ')}
                  </p>
                  <p>
                    <span className="font-medium text-mist-300">Expected detection: </span>
                    {sc.detection}
                  </p>
                  <p>
                    <span className="font-medium text-mist-300">Expected action: </span>
                    {sc.action}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
