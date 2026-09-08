import { ROOMS, ROOM_MAP, roomName } from '../data/rooms'
import { DEVICE_CATALOG } from '../data/devices'
import { SIM, COMFORT } from '../data/constants'
import { DEFAULT_AUTOMATIONS } from './automations'
import { powerSnapshot, HOUSE_BASELINE_W } from './energy'
import { pushEvent } from './events'
import { raiseAlert } from './effects'
import { clamp, round } from './format'

/**
 * ============================================================================
 * HomeSense AI — IoT simulation engine
 * ============================================================================
 *
 * NOTHING here talks to real hardware. Every sensor reading below is generated
 * by a physical model running in the browser:
 *
 *   • Outdoor temperature follows a diurnal sine curve.
 *   • Each room is a first-order thermal mass that relaxes towards a target
 *     temperature — so readings drift smoothly instead of jumping randomly.
 *   • An air conditioner pulls its room towards its setpoint; a fan offsets it.
 *   • Occupancy is a two-state Markov chain per room, weighted by home mode.
 *   • Energy is *integrated from device power*, never invented.
 *
 * To move to real hardware, replace `advance()` with an MQTT subscriber that
 * writes the same `state.sensors` shape. Everything downstream — automations,
 * insights, charts, the eco score — keeps working untouched.
 */

/* --------------------------------------------------------------- constants */

const OUTDOOR_BASE = 30 // °C daily mean
const OUTDOOR_SWING = 4.6 // ± amplitude
const INDOOR_OFFSET = 5.4 // shading + thermal mass keep indoors below outdoors
const PASSIVE_RATE = 0.02 // °C convergence per simulated minute
const AC_RATE = 0.1
const FAN_OFFSET = 0.8 // °C of perceived + real cooling from air movement
const DEVICE_HEAT = 0.0022 // °C of target lift per watt of non-climate load

const rnd = (min, max) => min + Math.random() * (max - min)
const chance = (p) => Math.random() < p

/** Outdoor temperature at a given timestamp, plus any active heat surge. */
export function outdoorTempAt(ts, surge = 0) {
  const d = new Date(ts)
  const hours = d.getHours() + d.getMinutes() / 60
  // Peak at 15:00, trough at 03:00.
  const curve = Math.sin(((hours - 9) / 24) * Math.PI * 2)
  return round(OUTDOOR_BASE + OUTDOOR_SWING * curve + surge, 2)
}

/* ----------------------------------------------------------- initial state */

/** The simulated clock starts mid-afternoon: peak heat, a full evening ahead. */
function simulationStart() {
  const d = new Date()
  d.setHours(14, 20, 0, 0)
  return d.getTime()
}

const HOURLY_PROFILE = [
  0.3, 0.27, 0.25, 0.25, 0.28, 0.34, 0.45, 0.58, 0.65, 0.55, 0.48, 0.52, 0.7, 0.8, 0.78, 0.85,
  0.8, 0.72, 0.95, 1.1, 1.05, 0.9, 0.65, 0.42,
]

const SEED_TODAY_KWH = 6.8

/** Today's energy so far, distributed across a realistic hourly curve. */
function seedHourly(simTime) {
  const d = new Date(simTime)
  const hour = d.getHours()
  const fraction = d.getMinutes() / 60

  let raw = 0
  for (let h = 0; h < hour; h++) raw += HOURLY_PROFILE[h]
  raw += HOURLY_PROFILE[hour] * fraction
  const scale = raw > 0 ? SEED_TODAY_KWH / raw : 0

  return Array.from({ length: 24 }, (_, h) => {
    let kwh = 0
    if (h < hour) kwh = HOURLY_PROFILE[h] * scale
    else if (h === hour) kwh = HOURLY_PROFILE[h] * fraction * scale
    return { hour: h, label: `${String(h).padStart(2, '0')}:00`, kwh: round(kwh, 3) }
  })
}

function seedWeekly(simTime) {
  const history = [10.4, 9.1, 11.8, 8.6, 12.2, 9.7]
  return Array.from({ length: 7 }, (_, i) => {
    const ts = simTime - (6 - i) * 86400000
    const isToday = i === 6
    return {
      ts,
      day: new Date(ts).toLocaleDateString('en-IN', { weekday: 'short' }),
      kwh: isToday ? SEED_TODAY_KWH : history[i],
      isToday,
    }
  })
}

/** Group split that reproduces the "AC is 42% of today's usage" headline. */
const SEED_GROUPS = {
  ac: 2.86,
  lights: 0.61,
  refrigerator: 1.42,
  tv: 0.48,
  fans: 0.75,
  other: 0.68,
}

const SEED_ROOMS = {
  living: { temp: 26.5, humidity: 58, motion: false, occupied: false, motionOffset: 22 },
  bedroom: { temp: 27.2, humidity: 61, motion: false, occupied: false, motionOffset: 46 },
  kitchen: { temp: 28.4, humidity: 63, motion: false, occupied: false, motionOffset: 18 },
  study: { temp: 27.6, humidity: 57, motion: true, occupied: true, motionOffset: 0 },
}

/** Device runtimes at boot — some things have been on for a while. */
const SEED_ON_MINUTES = {
  'living-light': 42, // drives the "on for 42 minutes" insight
  'living-fan': 96,
  refrigerator: 720,
  'smart-plug': 180,
  'front-door-lock': 900,
}

export function createInitialState() {
  const simTime = simulationStart()

  const devices = {}
  for (const def of DEVICE_CATALOG) {
    const onMinutes = SEED_ON_MINUTES[def.id]
    devices[def.id] = {
      id: def.id,
      on: !!def.defaultOn,
      setpoint: def.setpoint,
      onSince: def.defaultOn ? simTime - (onMinutes ?? 15) * 60000 : null,
      lastActivity: simTime - (onMinutes ?? 35) * 60000,
      lastChangedBy: 'system',
    }
  }

  const rooms = {}
  for (const room of ROOMS) {
    const seed = SEED_ROOMS[room.id]
    rooms[room.id] = {
      id: room.id,
      temp: seed.temp,
      humidity: seed.humidity,
      motion: seed.motion,
      occupied: seed.occupied,
      lastMotionAt: simTime - seed.motionOffset * 60000,
    }
  }

  const base = {
    version: 1,
    bootedAt: Date.now(),
    simTime,
    homeMode: 'home',
    modeChangedAt: simTime - 138 * 60000,
    devices,
    sensors: {
      outdoorTemp: outdoorTempAt(simTime),
      heatSurge: 0,
      aqi: 94,
      rooms,
      door: {
        open: false,
        locked: true,
        lastOpenedAt: simTime - 95 * 60000,
        lastLockChange: simTime - 95 * 60000,
      },
    },
    energy: {
      todayKwh: SEED_TODAY_KWH,
      groups: { ...SEED_GROUPS },
      hourly: seedHourly(simTime),
      weekly: seedWeekly(simTime),
      powerHistory: [],
      peakW: 1980,
    },
    automations: DEFAULT_AUTOMATIONS.map((a) => ({ ...a })),
    events: [],
    security: {
      status: 'secure',
      reason: null,
      since: simTime,
      armed: false,
      acknowledged: true,
      mutedUntil: 0,
      breaches: 0,
    },
    chat: [],
    prefs: {
      tempMin: COMFORT.tempMin,
      tempMax: COMFORT.tempMax,
      autoRun: true,
      notifications: true,
    },
    stats: { insightsActed: 0, automationsFired: 0, demoRuns: 0 },
    dismissedInsights: [],
    demo: { running: false, step: -1, startedAt: 0, stepStartedAt: 0, log: [] },
  }

  // Warm the live power chart so the dashboard never renders an empty graph.
  const snap = powerSnapshot(base)
  base.energy.powerHistory = Array.from({ length: 24 }, (_, i) => {
    const t = simTime - (23 - i) * 60000
    const jitter = Math.sin(i / 2.4) * 60 + rnd(-25, 25)
    return { t, label: new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), w: Math.max(HOUSE_BASELINE_W, Math.round(snap.total + jitter)) }
  })

  return seedEventLog(base)
}

/** A short, plausible history so the Security Center is never empty on boot. */
function seedEventLog(state) {
  const t = state.simTime
  const seeds = [
    {
      offset: 138,
      kind: 'mode',
      severity: 'info',
      title: 'Home switched to Home Mode',
      detail: 'Occupied — comfort automations active, security relaxed.',
    },
    {
      offset: 95,
      kind: 'door',
      severity: 'info',
      title: 'Front door opened',
      detail: 'Entry sensor reported the door opening, then closing after 40 seconds.',
      room: 'entry',
    },
    {
      offset: 74,
      kind: 'motion',
      severity: 'info',
      title: 'Motion detected in Kitchen',
      detail: 'PIR sensor kitchen/motion tripped.',
      room: 'kitchen',
    },
    {
      offset: 46,
      kind: 'motion',
      severity: 'info',
      title: 'Motion detected in Bedroom',
      detail: 'PIR sensor bedroom/motion tripped.',
      room: 'bedroom',
    },
    {
      offset: 22,
      kind: 'motion',
      severity: 'info',
      title: 'Motion detected in Living Room',
      detail: 'PIR sensor living/motion tripped.',
      room: 'living',
    },
    {
      offset: 6,
      kind: 'motion',
      severity: 'info',
      title: 'Motion detected in Study Room',
      detail: 'PIR sensor study/motion tripped.',
      room: 'study',
    },
  ]

  let s = state
  // Oldest first so the newest ends up at the top of the feed.
  for (const seed of [...seeds].sort((a, b) => b.offset - a.offset)) {
    s = pushEvent({ ...s, simTime: t - seed.offset * 60000 }, seed)
  }
  return { ...s, simTime: t }
}

/* ------------------------------------------------------------------ physics */

function updateRoomClimate(state, roomId, dtMin) {
  const room = state.sensors.rooms[roomId]
  const meta = ROOM_MAP[roomId]
  const devices = DEVICE_CATALOG.filter((d) => d.room === roomId)

  const ac = devices.find((d) => d.type === 'AC')
  const fan = devices.find((d) => d.type === 'Fan')
  const acOn = ac ? state.devices[ac.id]?.on : false
  const fanOn = fan ? state.devices[fan.id]?.on : false

  // Heat contributed by everything in the room that isn't a cooling appliance.
  const load = devices
    .filter((d) => d.category !== 'climate' && state.devices[d.id]?.on)
    .reduce((a, d) => a + d.watts, 0)

  let target = state.sensors.outdoorTemp - INDOOR_OFFSET + load * DEVICE_HEAT
  // Smaller rooms swing further from the household mean.
  target += (24 - meta.area) * 0.03
  if (room.occupied) target += 0.35
  if (fanOn) target -= FAN_OFFSET

  let rate = PASSIVE_RATE
  if (acOn) {
    const setpoint = state.devices[ac.id].setpoint ?? 24
    target = Math.min(target, setpoint)
    rate = AC_RATE
  }

  const temp = room.temp + (target - room.temp) * rate * dtMin + rnd(-0.03, 0.03)

  // Humidity tracks temperature inversely; an AC actively dehumidifies.
  let humidityTarget = 68 - (temp - 26) * 2.4
  if (acOn) humidityTarget -= 9
  if (roomId === 'kitchen' && room.occupied) humidityTarget += 8
  const humidity = room.humidity + (humidityTarget - room.humidity) * 0.05 * dtMin + rnd(-0.2, 0.2)

  return {
    ...room,
    temp: round(clamp(temp, 15, 44), 2),
    humidity: round(clamp(humidity, 25, 95), 1),
  }
}

function updateOccupancy(state, roomId, dtMin) {
  const room = state.sensors.rooms[roomId]
  const meta = ROOM_MAP[roomId]
  const target = meta.occupancy[state.homeMode] ?? 0

  // Demo / simulated events can pin a room empty for a while.
  if (room.forcedEmptyUntil && state.simTime < room.forcedEmptyUntil) {
    return { ...room, occupied: false, motion: false }
  }

  let occupied = room.occupied
  const p = 0.07 * dtMin
  if (occupied && chance(p * (1 - target) * 1.4)) occupied = false
  else if (!occupied && chance(p * target)) occupied = true
  if (target === 0) occupied = false

  const motion = occupied && chance(0.72)
  return {
    ...room,
    occupied,
    motion,
    lastMotionAt: motion ? state.simTime : room.lastMotionAt,
  }
}

/* --------------------------------------------------------------- main tick */

/**
 * Advance the whole simulation by `dtMin` simulated minutes. Pure: returns a
 * brand-new state object and never mutates its input.
 */
export function advance(state, dtMin = SIM.minutesPerTick) {
  const prevDate = new Date(state.simTime)
  const simTime = state.simTime + dtMin * 60000
  const date = new Date(simTime)

  let s = { ...state, simTime }

  /* --- outdoor conditions --- */
  const heatSurge = Math.abs(s.sensors.heatSurge) < 0.02 ? 0 : s.sensors.heatSurge * 0.94
  const outdoorTemp = outdoorTempAt(simTime, heatSurge)

  /* --- occupancy, then climate (climate reads occupancy) --- */
  const roomsAfterMotion = {}
  const motionEvents = []
  for (const room of ROOMS) {
    const before = s.sensors.rooms[room.id]
    const after = updateOccupancy({ ...s, simTime }, room.id, dtMin)
    if (after.motion && !before.motion) {
      motionEvents.push({
        kind: 'motion',
        severity: s.homeMode === 'home' ? 'info' : 'warning',
        title: `Motion detected in ${room.name}`,
        detail: `PIR sensor ${room.topic}/motion tripped.`,
        room: room.id,
        source: 'sensor',
      })
    }
    roomsAfterMotion[room.id] = after
  }

  s = { ...s, sensors: { ...s.sensors, outdoorTemp, heatSurge, rooms: roomsAfterMotion } }

  const roomsAfterClimate = {}
  for (const room of ROOMS) {
    roomsAfterClimate[room.id] = updateRoomClimate(s, room.id, dtMin)
  }

  /* --- air quality: slow drift, worsened by cooking, cleaned by AC filters --- */
  const cooking = roomsAfterClimate.kitchen.occupied && s.devices['kitchen-light']?.on
  const anyAc = DEVICE_CATALOG.some((d) => d.type === 'AC' && s.devices[d.id]?.on)
  let aqiTarget = 92 + (outdoorTemp - OUTDOOR_BASE) * 3
  if (cooking) aqiTarget += 45
  if (anyAc) aqiTarget -= 14
  const aqi = round(clamp(s.sensors.aqi + (aqiTarget - s.sensors.aqi) * 0.06 * dtMin + rnd(-1, 1), 20, 320), 0)

  /* --- door auto-closes a couple of minutes after it opens --- */
  let door = s.sensors.door
  if (door.open && simTime - door.lastOpenedAt > 2 * 60000) {
    door = { ...door, open: false, lastClosedAt: simTime }
  }

  s = {
    ...s,
    sensors: { ...s.sensors, rooms: roomsAfterClimate, aqi, door },
  }

  /* --- energy integration: kWh comes from measured power, never from a RNG --- */
  const snap = powerSnapshot(s)
  const hours = dtMin / 60
  const deltaKwh = (snap.total / 1000) * hours

  const groups = { ...s.energy.groups }
  for (const [gid, w] of Object.entries(snap.byGroup)) {
    groups[gid] = round((groups[gid] || 0) + (w / 1000) * hours, 4)
  }

  const hourly = s.energy.hourly.map((h) =>
    h.hour === date.getHours() ? { ...h, kwh: round(h.kwh + deltaKwh, 4) } : h,
  )

  const powerHistory = [
    ...s.energy.powerHistory,
    {
      t: simTime,
      label: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      w: snap.total,
    },
  ].slice(-SIM.powerHistoryLength)

  const todayKwh = round(s.energy.todayKwh + deltaKwh, 4)
  const weekly = s.energy.weekly.map((d) => (d.isToday ? { ...d, kwh: todayKwh } : d))

  s = {
    ...s,
    energy: {
      ...s.energy,
      todayKwh,
      groups,
      hourly,
      weekly,
      powerHistory,
      peakW: Math.max(s.energy.peakW, snap.total),
    },
  }

  /* --- emit sensor events --- */
  for (const ev of motionEvents) s = pushEvent(s, ev)

  /* --- midnight rollover --- */
  if (date.getDate() !== prevDate.getDate()) s = rollOverDay(s)

  return s
}

function rollOverDay(state) {
  const closed = round(state.energy.todayKwh, 2)
  const weekly = [
    ...state.energy.weekly.slice(1).map((d) => ({ ...d, isToday: false })),
  ]
  weekly[weekly.length - 1] = { ...weekly[weekly.length - 1], kwh: closed, isToday: false }
  weekly.push({
    ts: state.simTime,
    day: new Date(state.simTime).toLocaleDateString('en-IN', { weekday: 'short' }),
    kwh: 0,
    isToday: true,
  })

  let s = {
    ...state,
    energy: {
      ...state.energy,
      todayKwh: 0,
      groups: { ac: 0, lights: 0, refrigerator: 0, tv: 0, fans: 0, other: 0 },
      hourly: state.energy.hourly.map((h) => ({ ...h, kwh: 0 })),
      weekly: weekly.slice(-7),
    },
  }
  return pushEvent(s, {
    kind: 'energy',
    severity: 'info',
    title: 'Daily energy summary',
    detail: `Yesterday closed at ${closed} kWh. Counters reset for the new day.`,
    source: 'system',
  })
}

/* ------------------------------------------------------- security posture */

/**
 * Derived security status. Runs after the automations so a user rule gets the
 * first chance to raise an alert; this is the safety net underneath it.
 */
export function updateSecurity(state) {
  const s = state
  const armed = s.homeMode !== 'home'
  const { door, rooms } = s.sensors

  // A raised alert stays raised until it is acknowledged.
  if (s.security.status === 'alert' && !s.security.acknowledged) return s

  const muted = s.simTime < (s.security.mutedUntil || 0)

  if (armed && door.open && !muted) {
    return raiseAlert(s, {
      title: 'Front door opened while Away Mode is active',
      detail: 'Entry sensor reported the door opening with the house armed. Verify immediately.',
      room: 'entry',
      source: 'security-core',
    })
  }

  const intruderRoom = ROOMS.find((r) => armed && rooms[r.id].motion)
  if (intruderRoom && !muted) {
    return raiseAlert(s, {
      title: `Unexpected motion in ${intruderRoom.name}`,
      detail: `Movement detected while the house is armed in ${s.homeMode === 'away' ? 'Away' : 'Night'} Mode.`,
      room: intruderRoom.id,
      source: 'security-core',
    })
  }

  let status = 'secure'
  let reason = null
  if (armed && !door.locked) {
    status = 'warning'
    reason = 'Front door is unlocked while the house is armed'
  } else if (door.open) {
    status = 'warning'
    reason = 'Front door is currently open'
  } else if (s.homeMode === 'night' && DEVICE_CATALOG.some((d) => d.category === 'lights' && s.devices[d.id]?.on && d.room !== 'bedroom')) {
    status = 'warning'
    reason = 'Lights are on outside the bedroom during Night Mode'
  }

  if (status === s.security.status && reason === s.security.reason) return s
  return { ...s, security: { ...s.security, status, reason, since: s.simTime } }
}

/* --------------------------------------------------- manual sensor events */

export const SIM_EVENTS = [
  { id: 'temp_rise', label: 'Temperature rises', icon: 'ThermometerSun', tone: 'amber' },
  { id: 'temp_drop', label: 'Temperature drops', icon: 'ThermometerSnowflake', tone: 'sky' },
  { id: 'motion_detected', label: 'Motion detected', icon: 'Radar', tone: 'emerald' },
  { id: 'motion_stop', label: 'Motion stops', icon: 'UserX', tone: 'slate' },
  { id: 'door_open', label: 'Door opened', icon: 'DoorOpen', tone: 'rose' },
  { id: 'high_energy', label: 'High energy usage', icon: 'Zap', tone: 'violet' },
  { id: 'aqi_spike', label: 'Air quality drops', icon: 'Wind', tone: 'orange' },
]

/**
 * Inject a sensor event into the running simulation. These nudge the *model* —
 * they don't paint fake numbers on the screen. A heat surge really does make
 * every room warm up through the same thermal model used every tick.
 */
export function triggerSimEvent(state, kind, payload = {}) {
  let s = state
  const room = payload.room || 'living'

  switch (kind) {
    case 'temp_rise': {
      const rooms = { ...s.sensors.rooms }
      for (const r of ROOMS) rooms[r.id] = { ...rooms[r.id], temp: round(rooms[r.id].temp + 1.6, 2) }
      s = {
        ...s,
        sensors: { ...s.sensors, heatSurge: s.sensors.heatSurge + 4.5, rooms },
      }
      return pushEvent(s, {
        kind: 'system',
        severity: 'warning',
        title: 'Heat surge simulated',
        detail: 'Outdoor temperature climbing — indoor sensors will follow through the thermal model.',
        source: 'simulator',
      })
    }

    case 'temp_drop': {
      const rooms = { ...s.sensors.rooms }
      for (const r of ROOMS) rooms[r.id] = { ...rooms[r.id], temp: round(rooms[r.id].temp - 1.4, 2) }
      s = { ...s, sensors: { ...s.sensors, heatSurge: s.sensors.heatSurge - 3.5, rooms } }
      return pushEvent(s, {
        kind: 'system',
        severity: 'info',
        title: 'Cool front simulated',
        detail: 'Outdoor temperature falling — rooms will settle to the new equilibrium.',
        source: 'simulator',
      })
    }

    case 'motion_detected': {
      s = {
        ...s,
        sensors: {
          ...s.sensors,
          rooms: {
            ...s.sensors.rooms,
            [room]: {
              ...s.sensors.rooms[room],
              motion: true,
              occupied: true,
              lastMotionAt: s.simTime,
              forcedEmptyUntil: 0,
            },
          },
        },
      }
      return pushEvent(s, {
        kind: 'motion',
        severity: s.homeMode === 'home' ? 'info' : 'warning',
        title: `Motion detected in ${roomName(room)}`,
        detail: `PIR sensor ${ROOM_MAP[room]?.topic ?? room}/motion tripped.`,
        room,
        source: 'simulator',
      })
    }

    case 'motion_stop': {
      const minutesAgo = payload.minutesAgo ?? 24
      s = {
        ...s,
        sensors: {
          ...s.sensors,
          rooms: {
            ...s.sensors.rooms,
            [room]: {
              ...s.sensors.rooms[room],
              motion: false,
              occupied: false,
              lastMotionAt: s.simTime - minutesAgo * 60000,
              forcedEmptyUntil: s.simTime + 45 * 60000,
            },
          },
        },
      }
      return pushEvent(s, {
        kind: 'motion',
        severity: 'info',
        title: `${roomName(room)} is now empty`,
        detail: `No movement on ${ROOM_MAP[room]?.topic ?? room}/motion for ${minutesAgo} minutes.`,
        room,
        source: 'simulator',
      })
    }

    case 'door_open': {
      s = {
        ...s,
        sensors: {
          ...s.sensors,
          door: { ...s.sensors.door, open: true, lastOpenedAt: s.simTime },
        },
        security: { ...s.security, mutedUntil: 0 },
      }
      return pushEvent(s, {
        kind: 'door',
        severity: s.homeMode === 'home' ? 'info' : 'critical',
        title: 'Front door opened',
        detail:
          s.homeMode === 'home'
            ? 'Entry sensor reported the door opening.'
            : `Entry sensor tripped while ${s.homeMode === 'away' ? 'Away' : 'Night'} Mode is active.`,
        room: 'entry',
        source: 'simulator',
      })
    }

    case 'door_close': {
      return {
        ...s,
        sensors: { ...s.sensors, door: { ...s.sensors.door, open: false, lastClosedAt: s.simTime } },
      }
    }

    case 'high_energy': {
      // Switch on the heavy loads — the spike is real, not drawn on a chart.
      const ids = ['living-ac', 'bedroom-ac', 'tv', 'kitchen-light']
      for (const id of ids) {
        const dev = s.devices[id]
        if (dev && !dev.on) {
          s = {
            ...s,
            devices: { ...s.devices, [id]: { ...dev, on: true, onSince: s.simTime, lastActivity: s.simTime, lastChangedBy: 'simulator' } },
          }
        }
      }
      return pushEvent(s, {
        kind: 'energy',
        severity: 'warning',
        title: 'High energy usage simulated',
        detail: 'Both air conditioners, the TV and the kitchen lights were switched on together.',
        source: 'simulator',
      })
    }

    case 'aqi_spike': {
      s = { ...s, sensors: { ...s.sensors, aqi: round(clamp(s.sensors.aqi + 70, 20, 320), 0) } }
      return pushEvent(s, {
        kind: 'system',
        severity: 'warning',
        title: 'Air quality dropped',
        detail: `Indoor AQI jumped to ${s.sensors.aqi} — ventilation recommended.`,
        source: 'simulator',
      })
    }

    default:
      return s
  }
}
