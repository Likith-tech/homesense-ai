import { ROOMS, roomName } from '../data/rooms'
import { DEVICE_CATALOG, DEVICE_MAP } from '../data/devices'
import { HOME_MODES } from '../data/constants'
import { applyEffects, describeEffect } from './effects'
import { pushEvent } from './events'
import { powerSnapshot } from './energy'
import { uid, watts } from './format'

/** Minimum simulated minutes between two firings of the same rule. */
const COOLDOWN_MIN = 4

/* ------------------------------------------------------------------ schema */

const roomField = { key: 'room', kind: 'room', label: 'Room', default: 'living' }

export const CONDITION_TYPES = [
  {
    id: 'temp_above',
    label: 'Temperature is above',
    group: 'Climate',
    fields: [roomField, { key: 'value', kind: 'number', label: '°C', min: 15, max: 40, step: 0.5, default: 27 }],
    test: (s, c) => (s.sensors.rooms[c.room]?.temp ?? 0) > Number(c.value),
    describe: (c) => `${roomName(c.room)} temperature > ${c.value}°C`,
  },
  {
    id: 'temp_below',
    label: 'Temperature is below',
    group: 'Climate',
    fields: [roomField, { key: 'value', kind: 'number', label: '°C', min: 15, max: 40, step: 0.5, default: 21 }],
    test: (s, c) => (s.sensors.rooms[c.room]?.temp ?? 99) < Number(c.value),
    describe: (c) => `${roomName(c.room)} temperature < ${c.value}°C`,
  },
  {
    id: 'humidity_above',
    label: 'Humidity is above',
    group: 'Climate',
    fields: [roomField, { key: 'value', kind: 'number', label: '%', min: 20, max: 95, step: 1, default: 70 }],
    test: (s, c) => (s.sensors.rooms[c.room]?.humidity ?? 0) > Number(c.value),
    describe: (c) => `${roomName(c.room)} humidity > ${c.value}%`,
  },
  {
    id: 'aqi_above',
    label: 'Air quality index is above',
    group: 'Climate',
    fields: [{ key: 'value', kind: 'number', label: 'AQI', min: 40, max: 300, step: 5, default: 130 }],
    test: (s, c) => s.sensors.aqi > Number(c.value),
    describe: (c) => `Air quality index > ${c.value}`,
  },
  {
    id: 'no_motion_for',
    label: 'No motion for',
    group: 'Presence',
    fields: [roomField, { key: 'minutes', kind: 'number', label: 'minutes', min: 1, max: 240, step: 1, default: 30 }],
    test: (s, c) => {
      const room = s.sensors.rooms[c.room]
      if (!room || room.motion) return false
      return s.simTime - (room.lastMotionAt || 0) >= Number(c.minutes) * 60000
    },
    describe: (c) => `No motion in ${roomName(c.room)} for ${c.minutes} min`,
  },
  {
    id: 'motion_detected',
    label: 'Motion is detected',
    group: 'Presence',
    fields: [roomField],
    test: (s, c) => !!s.sensors.rooms[c.room]?.motion,
    describe: (c) => `Motion detected in ${roomName(c.room)}`,
  },
  {
    id: 'door_opened',
    label: 'Front door is open',
    group: 'Security',
    fields: [],
    test: (s) => !!s.sensors.door.open,
    describe: () => 'Front door opens',
  },
  {
    id: 'door_unlocked',
    label: 'Front door is unlocked',
    group: 'Security',
    fields: [],
    test: (s) => !s.sensors.door.locked,
    describe: () => 'Front door is unlocked',
  },
  {
    id: 'home_mode_is',
    label: 'Home mode is',
    group: 'Security',
    fields: [{ key: 'mode', kind: 'mode', label: 'Mode', default: 'away' }],
    test: (s, c) => s.homeMode === c.mode,
    describe: (c) => `${HOME_MODES[c.mode]?.label ?? c.mode} Mode is active`,
  },
  {
    id: 'power_above',
    label: 'Total power draw is above',
    group: 'Energy',
    fields: [{ key: 'value', kind: 'number', label: 'W', min: 100, max: 5000, step: 50, default: 2200 }],
    test: (s, c) => powerSnapshot(s).total > Number(c.value),
    describe: (c) => `Household draw > ${watts(c.value)}`,
  },
  {
    id: 'device_on',
    label: 'Device is ON',
    group: 'Devices',
    fields: [{ key: 'id', kind: 'device', label: 'Device', default: 'living-light' }],
    test: (s, c) => !!s.devices[c.id]?.on,
    describe: (c) => `${DEVICE_MAP[c.id]?.name ?? c.id} is ON`,
  },
]

export const CONDITION_MAP = Object.fromEntries(CONDITION_TYPES.map((c) => [c.id, c]))

export const ACTION_TYPES = [
  {
    id: 'DEVICE_ON',
    label: 'Turn a device ON',
    fields: [{ key: 'id', kind: 'device', label: 'Device', default: 'living-ac' }],
  },
  {
    id: 'DEVICE_OFF',
    label: 'Turn a device OFF',
    fields: [{ key: 'id', kind: 'device', label: 'Device', default: 'living-light' }],
  },
  {
    id: 'ROOM_LIGHTS_OFF',
    label: 'Turn all lights in a room OFF',
    fields: [roomField],
  },
  {
    id: 'SET_SETPOINT',
    label: 'Set an AC temperature',
    fields: [
      { key: 'id', kind: 'ac', label: 'Air conditioner', default: 'living-ac' },
      { key: 'value', kind: 'number', label: '°C', min: 16, max: 30, step: 1, default: 24 },
    ],
  },
  {
    id: 'ECO_SWEEP',
    label: 'Switch off all non-essential devices',
    fields: [],
  },
  {
    id: 'SET_HOME_MODE',
    label: 'Change home mode',
    fields: [{ key: 'mode', kind: 'mode', label: 'Mode', default: 'away' }],
  },
  {
    id: 'LOCK_DOOR',
    label: 'Lock the front door',
    fields: [],
  },
  {
    id: 'SECURITY_ALERT',
    label: 'Create a security alert',
    fields: [{ key: 'title', kind: 'text', label: 'Alert message', default: 'Unexpected activity detected' }],
  },
  {
    id: 'NOTIFY',
    label: 'Send a notification',
    fields: [{ key: 'title', kind: 'text', label: 'Message', default: 'Heads up from HomeSense AI' }],
  },
]

export const ACTION_MAP = Object.fromEntries(ACTION_TYPES.map((a) => [a.id, a]))

/* -------------------------------------------------------------- describing */

export function describeCondition(c) {
  const def = CONDITION_MAP[c?.type]
  return def ? def.describe(c) : (c?.type ?? 'Unknown condition')
}

export function describeAutomation(rule) {
  const join = rule.match === 'any' ? ' OR ' : ' AND '
  return {
    when: rule.conditions.map(describeCondition).join(join) || 'Always',
    then: rule.actions.map(describeEffect).join(' · ') || 'Do nothing',
  }
}


/* -------------------------------------------------------------- evaluation */

export function testConditions(state, rule) {
  if (!rule.conditions?.length) return false
  const results = rule.conditions.map((c) => {
    const def = CONDITION_MAP[c.type]
    try {
      return def ? !!def.test(state, c) : false
    } catch {
      return false
    }
  })
  return rule.match === 'any' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * Run every enabled rule against the current state.
 *
 * Rules are **edge triggered**: a rule fires on the transition from false to
 * true, then stays quiet until its condition clears — so "temperature above
 * 27°C" turns the AC on once, not sixty times a minute.
 */
export function evaluateAutomations(state) {
  let s = state
  const nextRules = []
  let firedAny = false

  for (const rule of s.automations) {
    if (!rule.enabled) {
      nextRules.push({ ...rule, wasTrue: false })
      continue
    }

    const isTrue = testConditions(s, rule)
    const cooledDown =
      !rule.lastFiredAt || s.simTime - rule.lastFiredAt >= COOLDOWN_MIN * 60000

    if (isTrue && !rule.wasTrue && cooledDown) {
      const { when, then } = describeAutomation(rule)
      s = applyEffects(s, rule.actions, 'automation')
      s = pushEvent(s, {
        kind: 'automation',
        severity: 'success',
        title: `Automation ran — ${rule.name}`,
        detail: `${when} → ${then}`,
        source: 'automation',
      })
      firedAny = true
      nextRules.push({
        ...rule,
        wasTrue: true,
        lastFiredAt: s.simTime,
        firedCount: (rule.firedCount || 0) + 1,
      })
    } else {
      nextRules.push({ ...rule, wasTrue: isTrue })
    }
  }

  s = { ...s, automations: nextRules }
  if (firedAny) {
    s = { ...s, stats: { ...s.stats, automationsFired: (s.stats.automationsFired || 0) + 1 } }
  }
  return s
}

/* ---------------------------------------------------------------- creation */

export function blankAutomation() {
  return {
    id: uid('auto'),
    name: '',
    description: '',
    enabled: true,
    match: 'all',
    conditions: [defaultCondition('temp_above')],
    actions: [defaultAction('DEVICE_ON')],
    lastFiredAt: null,
    firedCount: 0,
    wasTrue: false,
  }
}

export function defaultCondition(typeId) {
  const def = CONDITION_MAP[typeId] || CONDITION_TYPES[0]
  const c = { type: def.id }
  def.fields.forEach((f) => {
    c[f.key] = f.default
  })
  return c
}

export function defaultAction(typeId) {
  const def = ACTION_MAP[typeId] || ACTION_TYPES[0]
  const a = { type: def.id }
  def.fields.forEach((f) => {
    a[f.key] = f.default
  })
  return a
}

/** Device choices for the editor's device pickers. */
export const DEVICE_OPTIONS = DEVICE_CATALOG.map((d) => ({ value: d.id, label: d.name }))
export const AC_OPTIONS = DEVICE_CATALOG.filter((d) => d.type === 'AC').map((d) => ({
  value: d.id,
  label: d.name,
}))
export const ROOM_OPTIONS = ROOMS.map((r) => ({ value: r.id, label: r.name }))
export const MODE_OPTIONS = Object.values(HOME_MODES).map((m) => ({
  value: m.id,
  label: `${m.label} Mode`,
}))

/* ------------------------------------------------------------- seed rules */

export const DEFAULT_AUTOMATIONS = [
  {
    id: 'auto_cool_living',
    name: 'Auto-cool the living room',
    description: 'Starts the AC as soon as the living room drifts out of the comfort band.',
    enabled: true,
    match: 'all',
    conditions: [{ type: 'temp_above', room: 'living', value: 27 }],
    actions: [
      { type: 'DEVICE_ON', id: 'living-ac' },
      { type: 'SET_SETPOINT', id: 'living-ac', value: 24 },
    ],
    lastFiredAt: null,
    firedCount: 0,
    wasTrue: false,
  },
  {
    id: 'auto_lights_empty',
    name: 'Lights off in empty rooms',
    description: 'Cuts the living room lights after half an hour with no movement.',
    enabled: true,
    match: 'all',
    conditions: [{ type: 'no_motion_for', room: 'living', minutes: 30 }],
    actions: [{ type: 'DEVICE_OFF', id: 'living-light' }],
    lastFiredAt: null,
    firedCount: 0,
    wasTrue: false,
  },
  {
    id: 'auto_intrusion',
    name: 'Intrusion watch',
    description: 'Raises a critical alert if the front door opens while nobody is home.',
    enabled: true,
    match: 'all',
    conditions: [
      { type: 'door_opened' },
      { type: 'home_mode_is', mode: 'away' },
    ],
    actions: [
      {
        type: 'SECURITY_ALERT',
        title: 'Front door opened while Away Mode is active',
        detail: 'The entry sensor reported the front door opening with the house armed.',
      },
    ],
    lastFiredAt: null,
    firedCount: 0,
    wasTrue: false,
  },
  {
    id: 'auto_away_saver',
    name: 'Away energy saver',
    description: 'Shuts down every non-essential load the moment the house is empty.',
    enabled: true,
    match: 'all',
    conditions: [{ type: 'home_mode_is', mode: 'away' }],
    actions: [{ type: 'ECO_SWEEP' }],
    lastFiredAt: null,
    firedCount: 0,
    wasTrue: false,
  },
  {
    id: 'auto_peak_guard',
    name: 'Peak load guard',
    description: 'Warns you before the household draw pushes you into a higher tariff slab.',
    enabled: false,
    match: 'all',
    conditions: [{ type: 'power_above', value: 2200 }],
    actions: [
      {
        type: 'NOTIFY',
        title: 'Peak load warning',
        detail: 'Household draw crossed 2.2 kW — consider staggering heavy appliances.',
      },
    ],
    lastFiredAt: null,
    firedCount: 0,
    wasTrue: false,
  },
]
