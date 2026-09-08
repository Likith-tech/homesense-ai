import { DEVICE_MAP, DEVICE_CATALOG, stateLabel } from '../data/devices'
import { HOME_MODES } from '../data/constants'
import { roomName } from '../data/rooms'
import { pushEvent } from './events'
import { uid } from './format'

/**
 * The single place where anything in HomeSense AI changes a device, a mode or
 * the security posture.
 *
 * The AI recommendation buttons, the automation engine, the demo script and
 * the manual toggles all funnel through `applyEffect`, which is why an action
 * taken anywhere is reflected everywhere — energy, charts, insights and the
 * event log all read from the state this function returns.
 */

/** Low-level device write. `source` shows up in the event log. */
export function setDeviceState(state, id, on, source = 'manual', options = {}) {
  const def = DEVICE_MAP[id]
  const dev = state.devices[id]
  if (!def || !dev) return state
  if (dev.on === on && options.setpoint === undefined) return state

  const next = {
    ...dev,
    on,
    lastActivity: state.simTime,
    onSince: on ? (dev.on ? dev.onSince : state.simTime) : null,
    lastChangedBy: source,
  }
  if (options.setpoint !== undefined) next.setpoint = options.setpoint

  let s = { ...state, devices: { ...state.devices, [id]: next } }

  if (dev.on !== on) {
    const isLock = def.semantics === 'lock'
    s = pushEvent(s, {
      kind: isLock ? 'lock' : 'device',
      severity: isLock && !on ? 'warning' : 'info',
      title: `${def.name} ${stateLabel(def, on).toLowerCase()}`,
      detail:
        source === 'manual'
          ? 'Changed manually from the app.'
          : source === 'automation'
            ? 'Triggered by an automation rule.'
            : source === 'ai'
              ? 'Applied from a HomeSense AI recommendation.'
              : 'Changed by the simulation engine.',
      room: def.room,
      source,
    })
    if (isLock) {
      s = {
        ...s,
        sensors: {
          ...s.sensors,
          door: { ...s.sensors.door, locked: on, lastLockChange: s.simTime },
        },
      }
    }
  }
  return s
}

function setSetpoint(state, id, value) {
  const def = DEVICE_MAP[id]
  const dev = state.devices[id]
  if (!def || !dev || def.type !== 'AC') return state
  const clamped = Math.min(30, Math.max(16, Math.round(value)))
  if (dev.setpoint === clamped) return state
  return {
    ...state,
    devices: {
      ...state.devices,
      [id]: { ...dev, setpoint: clamped, lastActivity: state.simTime },
    },
  }
}

function setHomeMode(state, mode, source = 'manual') {
  if (!HOME_MODES[mode] || state.homeMode === mode) return state
  let s = {
    ...state,
    homeMode: mode,
    modeChangedAt: state.simTime,
  }
  s = pushEvent(s, {
    kind: 'mode',
    severity: mode === 'away' ? 'warning' : 'info',
    title: `Home switched to ${HOME_MODES[mode].label} Mode`,
    detail: HOME_MODES[mode].description,
    source,
  })

  if (mode === 'away' || mode === 'night') {
    // Arming the house locks the front door — a real system would do the same.
    s = setDeviceState(s, 'front-door-lock', true, 'automation')
    s = { ...s, security: { ...s.security, armed: true } }
  } else {
    s = { ...s, security: { ...s.security, armed: false } }
  }
  return s
}

export function raiseAlert(state, { title, detail, room = null, source = 'system' }) {
  let s = pushEvent(state, {
    kind: 'alert',
    severity: 'critical',
    title,
    detail,
    room,
    source,
  })
  return {
    ...s,
    security: {
      ...s.security,
      status: 'alert',
      reason: title,
      since: s.simTime,
      alertId: uid('alert'),
      acknowledged: false,
      breaches: (s.security.breaches || 0) + 1,
    },
  }
}

/**
 * Apply one effect. Always returns a new state.
 * @param {object} effect `{ type, ... }`
 * @param {string} source 'manual' | 'automation' | 'ai' | 'demo' | 'system'
 */
export function applyEffect(state, effect, source = 'manual') {
  if (!effect?.type) return state
  let s = state

  switch (effect.type) {
    case 'DEVICE_ON':
      return setDeviceState(s, effect.id, true, source)

    case 'DEVICE_OFF':
      return setDeviceState(s, effect.id, false, source)

    case 'DEVICE_TOGGLE':
      return setDeviceState(s, effect.id, !s.devices[effect.id]?.on, source)

    case 'DEVICES_ON':
      return (effect.ids || []).reduce((acc, id) => setDeviceState(acc, id, true, source), s)

    case 'DEVICES_OFF':
      return (effect.ids || []).reduce((acc, id) => setDeviceState(acc, id, false, source), s)

    case 'SET_SETPOINT':
      return setSetpoint(s, effect.id, effect.value)

    case 'SET_SETPOINTS':
      return (effect.ids || []).reduce((acc, id) => setSetpoint(acc, id, effect.value), s)

    case 'ROOM_LIGHTS_OFF': {
      const ids = DEVICE_CATALOG.filter((d) => d.room === effect.room && d.category === 'lights').map(
        (d) => d.id,
      )
      return ids.reduce((acc, id) => setDeviceState(acc, id, false, source), s)
    }

    case 'ALL_LIGHTS_OFF': {
      const ids = DEVICE_CATALOG.filter((d) => d.category === 'lights').map((d) => d.id)
      return ids.reduce((acc, id) => setDeviceState(acc, id, false, source), s)
    }

    case 'ALL_CLIMATE_OFF': {
      const ids = DEVICE_CATALOG.filter((d) => d.category === 'climate').map((d) => d.id)
      return ids.reduce((acc, id) => setDeviceState(acc, id, false, source), s)
    }

    case 'ECO_SWEEP': {
      // Everything non-essential off: the "I'm leaving" button.
      const ids = DEVICE_CATALOG.filter(
        (d) => !d.critical && d.semantics !== 'lock' && s.devices[d.id]?.on,
      ).map((d) => d.id)
      s = ids.reduce((acc, id) => setDeviceState(acc, id, false, source), s)
      return pushEvent(s, {
        kind: 'energy',
        severity: 'success',
        title: 'Eco sweep completed',
        detail: `${ids.length} non-essential device${ids.length === 1 ? '' : 's'} switched off.`,
        source,
      })
    }

    case 'SWAP_AC_FOR_FAN': {
      // Turn the AC off and the fan in the same room on.
      for (const id of effect.ids || []) {
        const def = DEVICE_MAP[id]
        if (!def) continue
        s = setDeviceState(s, id, false, source)
        const fan = DEVICE_CATALOG.find((d) => d.room === def.room && d.type === 'Fan')
        if (fan) s = setDeviceState(s, fan.id, true, source)
      }
      return s
    }

    case 'SET_HOME_MODE':
      return setHomeMode(s, effect.mode, source)

    case 'LOCK_DOOR':
      s = setDeviceState(s, 'front-door-lock', true, source)
      return {
        ...s,
        sensors: { ...s.sensors, door: { ...s.sensors.door, open: false, locked: true } },
      }

    case 'UNLOCK_DOOR':
      return setDeviceState(s, 'front-door-lock', false, source)

    case 'SECURITY_ALERT':
      return raiseAlert(s, {
        title: effect.title || 'Security alert',
        detail: effect.detail || effect.message || 'A monitored sensor reported unexpected activity.',
        room: effect.room,
        source,
      })

    case 'ACK_ALERTS': {
      s = pushEvent(s, {
        kind: 'alert',
        severity: 'success',
        title: 'Alert acknowledged',
        detail: 'Security status returned to monitoring.',
        source,
      })
      return {
        ...s,
        security: {
          ...s.security,
          status: 'secure',
          reason: null,
          acknowledged: true,
          // Give the operator a grace window so the same open door doesn't
          // immediately re-trip the alert on the next tick.
          mutedUntil: s.simTime + 5 * 60000,
        },
      }
    }

    case 'ADD_STANDBY_AUTOMATION': {
      const exists = s.automations.some((a) => a.templateId === 'standby-cutoff')
      if (exists) return s
      const rule = {
        id: uid('auto'),
        templateId: 'standby-cutoff',
        name: 'Cut standby power when away',
        description: 'Kills vampire draw from the TV and smart plug whenever the house is empty.',
        enabled: true,
        match: 'all',
        conditions: [{ type: 'home_mode_is', mode: 'away' }],
        actions: [{ type: 'DEVICES_OFF', ids: ['tv', 'smart-plug'] }],
        lastFiredAt: null,
        firedCount: 0,
        wasTrue: false,
      }
      s = { ...s, automations: [...s.automations, rule] }
      return pushEvent(s, {
        kind: 'automation',
        severity: 'success',
        title: 'Automation created',
        detail: `"${rule.name}" is now active.`,
        source,
      })
    }

    case 'NOTIFY':
      return pushEvent(s, {
        kind: effect.kind || 'ai',
        severity: effect.severity || 'info',
        title: effect.title || 'HomeSense AI',
        detail: effect.detail || effect.message || '',
        source,
      })

    case 'NONE':
    default:
      return s
  }
}

export function applyEffects(state, effects = [], source = 'manual') {
  return effects.reduce((s, e) => applyEffect(s, e, source), state)
}

/** Human-readable summary of an effect, used by the automation cards. */
export function describeEffect(effect) {
  if (!effect?.type) return 'Do nothing'
  const name = (id) => DEVICE_MAP[id]?.name || id
  switch (effect.type) {
    case 'DEVICE_ON':
      return `Turn ON ${name(effect.id)}`
    case 'DEVICE_OFF':
      return `Turn OFF ${name(effect.id)}`
    case 'DEVICES_OFF':
      return `Turn OFF ${(effect.ids || []).map(name).join(', ')}`
    case 'DEVICES_ON':
      return `Turn ON ${(effect.ids || []).map(name).join(', ')}`
    case 'SET_SETPOINT':
      return `Set ${name(effect.id)} to ${effect.value}°C`
    case 'SET_SETPOINTS':
      return `Set ${(effect.ids || []).map(name).join(', ')} to ${effect.value}°C`
    case 'ROOM_LIGHTS_OFF':
      return `Turn OFF all lights in ${roomName(effect.room)}`
    case 'ALL_LIGHTS_OFF':
      return 'Turn OFF every light'
    case 'ALL_CLIMATE_OFF':
      return 'Turn OFF all climate devices'
    case 'ECO_SWEEP':
      return 'Switch off all non-essential devices'
    case 'SWAP_AC_FOR_FAN':
      return `Replace ${(effect.ids || []).map(name).join(', ')} with the ceiling fan`
    case 'SET_HOME_MODE':
      return `Switch home to ${HOME_MODES[effect.mode]?.label ?? effect.mode} Mode`
    case 'LOCK_DOOR':
      return 'Lock the front door'
    case 'UNLOCK_DOOR':
      return 'Unlock the front door'
    case 'SECURITY_ALERT':
      return `Raise security alert — "${effect.title || effect.message || 'Alert'}"`
    case 'NOTIFY':
      return `Send notification — "${effect.title || effect.message}"`
    default:
      return effect.type
  }
}
