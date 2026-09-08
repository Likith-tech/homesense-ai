import { SIM } from '../data/constants'
import { uid } from './format'

/**
 * Event kinds that belong in the Security Center feed.
 * Everything else (device / automation / energy) stays in the activity feed.
 */
export const SECURITY_KINDS = ['motion', 'door', 'mode', 'alert', 'lock']

export const EVENT_ICONS = {
  motion: 'Radar',
  door: 'DoorOpen',
  lock: 'Lock',
  mode: 'Home',
  alert: 'ShieldAlert',
  device: 'Power',
  automation: 'Workflow',
  ai: 'Sparkles',
  energy: 'Zap',
  system: 'Cpu',
}

export const SEVERITY_TONE = {
  info: 'sky',
  success: 'emerald',
  warning: 'amber',
  critical: 'rose',
}

/**
 * Append an event, newest first, capped at SIM.maxEvents.
 * Pure — returns a new state object.
 */
export function pushEvent(state, event) {
  const entry = {
    id: uid('ev'),
    at: state.simTime,
    kind: 'system',
    severity: 'info',
    title: '',
    detail: '',
    room: null,
    source: 'system',
    ...event,
  }
  entry.icon = entry.icon || EVENT_ICONS[entry.kind] || 'Activity'
  return { ...state, events: [entry, ...state.events].slice(0, SIM.maxEvents) }
}

export function pushEvents(state, events) {
  return events.reduce((s, e) => pushEvent(s, e), state)
}

export const isSecurityEvent = (e) => SECURITY_KINDS.includes(e.kind)
