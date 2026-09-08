import { temp, watts, round } from './format'
import { powerSnapshot } from './energy'

/**
 * ============================================================================
 * Guided demo — the 70-second story of HomeSense AI
 * ============================================================================
 *
 * Every step drives the *real* engine. The demo never paints a fake number on
 * the screen: when it says "temperature rises" it injects a heat surge into the
 * thermal model and then genuinely waits for the room sensors to cross the
 * comfort threshold. When the alert fires at step 13, it is the same automation
 * and security core that would fire if you triggered the door sensor by hand.
 *
 * Step contract:
 *   page        route to navigate to as the step opens
 *   effects[]   effects applied through the normal effect pipeline
 *   sim[]       sensor events injected into the simulation
 *   automations temporarily disable rules that would pre-empt the narration
 *   chat        message pushed into the AI Assistant transcript
 *   minMs/maxMs floor and ceiling on the step's duration
 *   waitFor     advance early once the simulation actually reaches this state
 */

export const DEMO_STEPS = [
  {
    id: 1,
    title: 'Home Mode active',
    narration:
      'We start with the family at home. HomeSense AI is watching 13 simulated sensors across four rooms.',
    page: '/',
    minMs: 4200,
    effects: [{ type: 'SET_HOME_MODE', mode: 'home' }],
    // These two rules would act before the AI gets to make its case.
    automations: { disable: ['auto_cool_living', 'auto_lights_empty'] },
    spotlight: 'status',
  },
  {
    id: 2,
    title: 'Temperature gradually increases',
    narration:
      'An afternoon heat surge is injected into the outdoor model. Room temperatures now climb through the same thermal simulation used on every tick.',
    page: '/',
    minMs: 3000,
    maxMs: 14000,
    sim: [{ kind: 'temp_rise' }],
    waitFor: (s) => s.sensors.rooms.living.temp > 27.4,
    spotlight: 'environment',
  },
  {
    id: 3,
    title: 'AI detects elevated temperature',
    narration: (s) =>
      `AI detected elevated temperature. Living Room is at ${temp(
        s.sensors.rooms.living.temp,
      )} — above the ${s.prefs.tempMax}°C comfort ceiling.`,
    page: '/',
    minMs: 4200,
    spotlight: 'insights',
  },
  {
    id: 4,
    title: 'Recommendation issued',
    narration: (s) =>
      `Temperature is ${temp(s.sensors.rooms.living.temp, 0)}. Would you like to turn on AC? The recommendation carries its reason and a working action button.`,
    page: '/assistant',
    minMs: 5000,
    chat: (s) =>
      `Your home is getting warm — the Living Room is at ${temp(
        s.sensors.rooms.living.temp,
      )}. I recommend turning on the AC at 24°C, which reaches comfort without the compressor penalty of a 22°C setpoint.`,
    spotlight: 'insights',
  },
  {
    id: 5,
    title: 'AC switched on',
    narration:
      'The action is applied through the same effect pipeline a user tap would use — the AC is now genuinely running at 24°C.',
    page: '/rooms',
    minMs: 4200,
    effects: [
      { type: 'DEVICE_ON', id: 'living-ac' },
      { type: 'SET_SETPOINT', id: 'living-ac', value: 24 },
    ],
    spotlight: 'devices',
  },
  {
    id: 6,
    title: 'Energy consumption increases',
    narration:
      'Household draw jumps as the compressor spins up. Every kWh on this page is integrated from device power — nothing is hard-coded.',
    page: '/energy',
    minMs: 3200,
    maxMs: 11000,
    // Keyed to the compressor rather than the household total: once the room
    // reaches its setpoint the AC throttles back, so a total-load threshold
    // would pass or fail depending on how long the previous step ran.
    waitFor: (s) => powerSnapshot(s).byGroup.ac > 350,
    spotlight: 'energy',
  },
  {
    id: 7,
    title: 'AI detects high energy consumption',
    narration: (s) =>
      `AC is currently responsible for most of your energy usage — the house is drawing ${watts(
        powerSnapshot(s).total,
      )}.`,
    page: '/energy',
    minMs: 5000,
    chat: (s) =>
      `Energy consumption is currently high at ${watts(
        powerSnapshot(s).total,
      )}. The air conditioner is the largest contributor at ${round(
        (powerSnapshot(s).byGroup.ac / powerSnapshot(s).total) * 100,
        0,
      )}% of the live load.`,
    spotlight: 'energy',
  },
  {
    id: 8,
    title: 'Living Room goes quiet',
    narration:
      'Someone leaves the light on and walks out. The PIR sensor stops reporting movement and the room is marked empty.',
    page: '/rooms',
    minMs: 4500,
    effects: [{ type: 'DEVICE_ON', id: 'living-light' }],
    sim: [{ kind: 'motion_stop', payload: { room: 'living', minutesAgo: 24 } }],
    spotlight: 'motion',
  },
  {
    id: 9,
    title: 'AI detects unnecessary light usage',
    narration:
      'No motion detected. Turn off Living Room lights? The AI correlates light state against presence, not just a timer.',
    page: '/',
    minMs: 5000,
    chat: 'The Living Room light has been ON without detected movement for 24 minutes. Would you like me to turn it off?',
    spotlight: 'insights',
  },
  {
    id: 10,
    title: 'Lights turned off',
    narration:
      'Applied. Watch the live power chart drop and the eco score recover — one action, reflected everywhere at once.',
    page: '/',
    minMs: 4200,
    effects: [{ type: 'DEVICE_OFF', id: 'living-light' }],
    spotlight: 'energy',
  },
  {
    id: 11,
    title: 'Switching to Away Mode',
    narration:
      'The family leaves. Away Mode arms the perimeter, locks the door, and the "Away energy saver" rule clears every non-essential load automatically.',
    page: '/security',
    minMs: 5000,
    effects: [{ type: 'SET_HOME_MODE', mode: 'away' }],
    spotlight: 'mode',
  },
  {
    id: 12,
    title: 'Front door opens',
    narration:
      'The entry sensor reports the front door opening. Nobody should be home.',
    page: '/security',
    minMs: 3000,
    maxMs: 8000,
    sim: [{ kind: 'door_open' }],
    spotlight: 'sensors',
  },
  {
    id: 13,
    title: 'Security alert raised',
    narration:
      'ALERT: Front door opened while Away Mode is active. The "Intrusion watch" automation matched both conditions and escalated on its own.',
    page: '/security',
    minMs: 4500,
    maxMs: 9000,
    waitFor: (s) => s.security.status === 'alert',
    spotlight: 'alert',
  },
  {
    id: 14,
    title: 'Event written to the log',
    narration:
      'The alert is timestamped into the security event log alongside the motion and mode events that preceded it — a full audit trail.',
    page: '/security',
    minMs: 4500,
    spotlight: 'events',
  },
  {
    id: 15,
    title: 'AI recommends checking the home',
    narration:
      'HomeSense AI closes the loop: it explains what happened, why it matters, and offers the action that resolves it.',
    page: '/assistant',
    minMs: 6500,
    chat: 'Security alert: front door activity detected while Away Mode is enabled. I have kept the deadbolt engaged and every non-essential load switched off. I recommend checking the home — tap below to lock down and acknowledge.',
    automations: { enable: ['auto_cool_living', 'auto_lights_empty'] },
    spotlight: 'assistant',
  },
]

export const DEMO_TOTAL_MS = DEMO_STEPS.reduce((a, s) => a + (s.minMs || 4000), 0)

export const resolveNarration = (step, state) =>
  typeof step.narration === 'function' ? step.narration(state) : step.narration

export const resolveChat = (step, state) =>
  typeof step.chat === 'function' ? step.chat(state) : step.chat
