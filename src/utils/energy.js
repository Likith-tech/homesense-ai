import { DEVICE_CATALOG, ENERGY_GROUPS } from '../data/devices'
import { TARIFF, BASELINE, CO2_PER_KWH } from '../data/constants'
import { round } from './format'

/**
 * Always-on household baseline: router, modem, doorbell chime, wall clocks.
 * Real homes never read 0W, and neither should this one.
 */
export const HOUSE_BASELINE_W = 24

/**
 * Instantaneous draw of a single device, in watts.
 *
 * This is where the simulation earns its realism: an inverter AC modulates its
 * compressor against the temperature error rather than sitting at its rated
 * 1500W, and a fridge duty-cycles instead of drawing a flat 150W.
 *
 * @param {object} def     catalogue entry (static definition)
 * @param {object} dev     runtime state `{ on, setpoint }`
 * @param {object} ctx     `{ rooms, simTime }`
 */
export function devicePower(def, dev, ctx = {}) {
  if (!def) return 0
  if (!dev?.on) return def.standbyWatts || 0

  switch (def.type) {
    case 'AC': {
      const roomTemp = ctx.rooms?.[def.room]?.temp ?? 26
      const setpoint = dev.setpoint ?? 24
      const error = roomTemp - setpoint
      // Compressor idles (blower only) once the room reaches the setpoint.
      if (error <= 0.15) return 380
      return Math.round(Math.min(def.watts, 520 + error * 340))
    }
    case 'Refrigerator': {
      // ~24 simulated-minute compressor cycle, on for a bit over half of it.
      const phase = Math.floor((ctx.simTime || 0) / 60000) % 24
      return phase < 13 ? def.watts : 45
    }
    default:
      return def.watts
  }
}

/**
 * Full power snapshot for the current state.
 * @returns {{ total:number, byDevice:Object, byGroup:Object, byRoom:Object, active:number }}
 */
export function powerSnapshot(state) {
  const ctx = { rooms: state.sensors.rooms, simTime: state.simTime }
  const byDevice = {}
  const byGroup = Object.fromEntries(ENERGY_GROUPS.map((g) => [g.id, 0]))
  const byRoom = {}
  let total = HOUSE_BASELINE_W
  let active = 0

  byGroup.other += HOUSE_BASELINE_W

  for (const def of DEVICE_CATALOG) {
    const dev = state.devices[def.id]
    if (!dev) continue
    const w = devicePower(def, dev, ctx)
    byDevice[def.id] = w
    byGroup[def.energyGroup] = (byGroup[def.energyGroup] || 0) + w
    byRoom[def.room] = (byRoom[def.room] || 0) + w
    total += w
    // A permanently-powered lock isn't a "device you left running".
    if (dev.on && def.semantics !== 'lock') active += 1
  }

  return { total: Math.round(total), byDevice, byGroup, byRoom, active }
}

/** Cost of an amount of energy at the configured tariff. */
export const costOf = (kWh) => (Number(kWh) || 0) * TARIFF.ratePerKwh

/** CO₂ footprint of an amount of energy, in kg. */
export const co2Of = (kWh) => (Number(kWh) || 0) * CO2_PER_KWH

/**
 * Projected month-end bill: energy used so far today, extrapolated across the
 * remainder of today and then across a 30-day month, plus fixed charges.
 */
export function projectMonthlyBill(state) {
  const hoursElapsed = Math.max(0.4, new Date(state.simTime).getHours() + new Date(state.simTime).getMinutes() / 60)
  const projectedToday = (state.energy.todayKwh / hoursElapsed) * 24
  const weekAvg = averageDailyKwh(state)
  // Blend today's run-rate with the weekly average so early-morning views are sane.
  const dailyEstimate = projectedToday * 0.45 + weekAvg * 0.55
  const units = dailyEstimate * 30
  return {
    units,
    cost: costOf(units) + TARIFF.fixedMonthlyCharge,
    dailyEstimate,
  }
}

export function averageDailyKwh(state) {
  const days = state.energy.weekly
  if (!days?.length) return state.energy.todayKwh
  const sum = days.reduce((a, d) => a + d.kwh, 0)
  return sum / days.length
}

export function weeklyTotalKwh(state) {
  return (state.energy.weekly || []).reduce((a, d) => a + d.kwh, 0)
}

/** Energy-group distribution as chart-ready rows, largest first. */
export function groupDistribution(state) {
  const groups = state.energy.groups || {}
  const total = Object.values(groups).reduce((a, b) => a + b, 0) || 1
  return ENERGY_GROUPS.map((g) => ({
    id: g.id,
    name: g.label,
    color: g.color,
    kwh: round(groups[g.id] || 0, 2),
    value: round(((groups[g.id] || 0) / total) * 100, 1),
  }))
    .filter((r) => r.kwh > 0.001)
    .sort((a, b) => b.kwh - a.kwh)
}

/** The single largest contributor to today's consumption. */
export function topConsumer(state) {
  const rows = groupDistribution(state)
  return rows[0] || null
}

/**
 * Concrete, costed saving opportunities derived from live state.
 * Each row carries an executable `effect`, so the UI never shows advice it
 * cannot act on.
 */
export function savingOpportunities(state) {
  const out = []
  const { byDevice } = powerSnapshot(state)
  const rooms = state.sensors.rooms
  const now = state.simTime

  /* --- lights burning in empty rooms --- */
  const idleLights = DEVICE_CATALOG.filter((d) => {
    if (d.category !== 'lights') return false
    const dev = state.devices[d.id]
    if (!dev?.on) return false
    const room = rooms[d.room]
    return room && !room.motion && now - (room.lastMotionAt || 0) > 10 * 60000
  })
  if (idleLights.length) {
    const w = idleLights.reduce((a, d) => a + (byDevice[d.id] || 0), 0)
    out.push({
      id: 'idle-lights',
      title: 'Turn off unused lights',
      detail: `${idleLights.length} light${idleLights.length > 1 ? 's are' : ' is'} on in ${
        idleLights.length > 1 ? 'rooms' : 'a room'
      } with no motion — ${idleLights.map((d) => d.name).join(', ')}.`,
      savingKwhPerDay: (w / 1000) * 5, // assume ~5 wasted hours a day
      icon: 'Lightbulb',
      effect: { type: 'DEVICES_OFF', ids: idleLights.map((d) => d.id) },
      actionLabel: 'Turn off now',
    })
  }

  /* --- AC setpoint below the efficient band --- */
  const coldACs = DEVICE_CATALOG.filter((d) => {
    const dev = state.devices[d.id]
    return d.type === 'AC' && dev?.on && (dev.setpoint ?? 24) < 24
  })
  if (coldACs.length) {
    const target = 24
    const deltas = coldACs.reduce((a, d) => a + (target - (state.devices[d.id].setpoint ?? 24)), 0)
    out.push({
      id: 'ac-setpoint',
      title: `Increase AC temperature from ${Math.min(
        ...coldACs.map((d) => state.devices[d.id].setpoint ?? 24),
      )}°C to 24°C`,
      detail: 'Every degree above 22°C cuts compressor load by roughly 6%. 24°C stays comfortable.',
      savingKwhPerDay: deltas * 0.42,
      icon: 'AirVent',
      effect: { type: 'SET_SETPOINTS', ids: coldACs.map((d) => d.id), value: target },
      actionLabel: 'Set to 24°C',
    })
  }

  /* --- standby vampire draw --- */
  const standby = DEVICE_CATALOG.filter((d) => (d.standbyWatts || 0) > 0 && !state.devices[d.id]?.on)
  const standbyW = standby.reduce((a, d) => a + d.standbyWatts, 0)
  if (standbyW > 0) {
    out.push({
      id: 'standby',
      title: 'Reduce standby power',
      detail: `${standby.map((d) => d.name).join(', ')} draw ${standbyW}W around the clock while switched off.`,
      savingKwhPerDay: (standbyW / 1000) * 24 * 0.8,
      icon: 'Plug',
      effect: { type: 'ADD_STANDBY_AUTOMATION' },
      actionLabel: 'Add cut-off rule',
    })
  }

  /* --- climate running in an empty house --- */
  const climateWhileEmpty = DEVICE_CATALOG.filter((d) => {
    const dev = state.devices[d.id]
    if (!dev?.on || d.category !== 'climate') return false
    const room = rooms[d.room]
    return room && !room.motion
  })
  if (climateWhileEmpty.length) {
    const w = climateWhileEmpty.reduce((a, d) => a + (byDevice[d.id] || 0), 0)
    out.push({
      id: 'no-motion-climate',
      title: 'Turn off devices when no motion is detected',
      detail: `${climateWhileEmpty
        .map((d) => d.name)
        .join(', ')} ${climateWhileEmpty.length > 1 ? 'are' : 'is'} cooling an unoccupied room.`,
      savingKwhPerDay: (w / 1000) * 3,
      icon: 'Radar',
      effect: { type: 'DEVICES_OFF', ids: climateWhileEmpty.map((d) => d.id) },
      actionLabel: 'Turn off now',
    })
  }

  /* --- fan + AC together in the same room --- */
  const redundant = DEVICE_CATALOG.filter((d) => {
    if (d.type !== 'AC' || !state.devices[d.id]?.on) return false
    const room = state.sensors.rooms[d.room]
    return room && room.temp <= (state.devices[d.id].setpoint ?? 24) + 0.4
  })
  if (redundant.length) {
    out.push({
      id: 'ac-target-reached',
      title: 'Let the fan hold the temperature',
      detail: `${redundant
        .map((d) => d.name)
        .join(', ')} already reached its setpoint. A ceiling fan holds it for 75W instead of ~400W.`,
      savingKwhPerDay: redundant.length * 0.9,
      icon: 'Fan',
      effect: { type: 'SWAP_AC_FOR_FAN', ids: redundant.map((d) => d.id) },
      actionLabel: 'Switch to fan',
    })
  }

  return out
    .map((o) => ({
      ...o,
      savingKwhPerDay: round(o.savingKwhPerDay, 2),
      savingPerMonth: costOf(o.savingKwhPerDay * 30),
    }))
    .sort((a, b) => b.savingPerMonth - a.savingPerMonth)
}

/** Percentage better (or worse) than an un-optimised comparable home. */
export function efficiencyVsBaseline(state) {
  const avg = averageDailyKwh(state) || state.energy.todayKwh || BASELINE.dailyKwh
  const delta = ((BASELINE.dailyKwh - avg) / BASELINE.dailyKwh) * 100
  return round(delta, 0)
}
