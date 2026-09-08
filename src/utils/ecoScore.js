import { DEVICE_CATALOG } from '../data/devices'
import { BASELINE, CO2_PER_KWH, COMFORT } from '../data/constants'
import { powerSnapshot, groupDistribution, costOf } from './energy'
import { clamp, round } from './format'

/**
 * Eco Score — a transparent 0-100 rating of how well the home is being run.
 *
 * It is deliberately *decomposable*: every point lost is attributed to a named
 * component with a fix attached, so the number is advice rather than decoration.
 *
 *   Consumption      30   how today's run-rate compares to a baseline home
 *   Idle devices     22   things running in rooms nobody is in
 *   Climate          16   AC setpoints and cooling's share of the bill
 *   Standby          8    vampire draw from switched-off electronics
 *   Automation       12   how much of the optimisation is hands-free
 *   Load discipline  12   peak draw, and running loads in an empty house
 */

const BANDS = [
  { min: 85, label: 'Excellent', tone: 'emerald' },
  { min: 70, label: 'Good', tone: 'lime' },
  { min: 55, label: 'Fair', tone: 'amber' },
  { min: 40, label: 'Poor', tone: 'orange' },
  { min: 0, label: 'Critical', tone: 'rose' },
]

export const bandFor = (score) => BANDS.find((b) => score >= b.min) || BANDS[BANDS.length - 1]

/** Today's usage extrapolated to a full day. */
export function projectedDailyKwh(state) {
  const d = new Date(state.simTime)
  const hours = Math.max(0.5, d.getHours() + d.getMinutes() / 60)
  return (state.energy.todayKwh / hours) * 24
}

function idleDevices(state) {
  return DEVICE_CATALOG.filter((d) => {
    if (!state.devices[d.id]?.on) return false
    if (d.critical || d.semantics === 'lock') return false
    if (d.category !== 'lights' && d.category !== 'climate' && d.category !== 'entertainment') return false
    const room = state.sensors.rooms[d.room]
    if (!room || room.motion) return false
    return state.simTime - (room.lastMotionAt || 0) >= COMFORT.idleLightMinutes * 60000
  })
}

export function computeEcoScore(state) {
  const snap = powerSnapshot(state)
  const projected = projectedDailyKwh(state)
  const ratio = projected / BASELINE.dailyKwh

  /* 1 — consumption ------------------------------------------------------- */
  const consumptionMax = 30
  const consumption = round(
    consumptionMax - clamp((ratio - 0.85) * 30, 0, consumptionMax),
    1,
  )

  /* 2 — idle devices ------------------------------------------------------ */
  const idle = idleDevices(state)
  const idleMax = 22
  const idleScore = round(Math.max(0, idleMax - idle.length * 2.5), 1)

  /* 3 — climate efficiency ------------------------------------------------ */
  const climateMax = 16
  const runningAcs = DEVICE_CATALOG.filter((d) => d.type === 'AC' && state.devices[d.id]?.on)
  const setpointPenalty = runningAcs.reduce(
    (a, d) => a + Math.max(0, 24 - (state.devices[d.id].setpoint ?? 24)) * 2,
    0,
  )
  const acShare = groupDistribution(state).find((g) => g.id === 'ac')?.value ?? 0
  const sharePenalty = Math.max(0, acShare - 35) * 0.3
  const climate = round(Math.max(0, climateMax - setpointPenalty - sharePenalty), 1)

  /* 4 — standby ----------------------------------------------------------- */
  const standbyMax = 8
  const standbyW = DEVICE_CATALOG.filter((d) => !state.devices[d.id]?.on).reduce(
    (a, d) => a + (d.standbyWatts || 0),
    0,
  )
  const standby = round(Math.max(0, standbyMax - clamp(standbyW * 0.15, 0, standbyMax)), 1)

  /* 5 — automation coverage ---------------------------------------------- */
  const automationMax = 12
  const enabled = state.automations.filter((a) => a.enabled).length
  const automation = round(
    clamp((enabled / Math.max(3, state.automations.length)) * automationMax, 0, automationMax),
    1,
  )

  /* 6 — load discipline --------------------------------------------------- */
  const disciplineMax = 12
  const awayLoads =
    state.homeMode === 'away'
      ? DEVICE_CATALOG.filter(
          (d) => state.devices[d.id]?.on && !d.critical && d.semantics !== 'lock',
        ).length
      : 0
  const peakPenalty = clamp((state.energy.peakW - 2000) / 200, 0, 6)
  const discipline = round(
    Math.max(0, disciplineMax - (awayLoads > 0 ? 6 : 0) - peakPenalty),
    1,
  )

  const breakdown = [
    { id: 'consumption', label: 'Consumption', score: consumption, max: consumptionMax, hint: `${round(projected, 1)} kWh/day vs ${BASELINE.dailyKwh} baseline` },
    { id: 'idle', label: 'Idle devices', score: idleScore, max: idleMax, hint: idle.length ? `${idle.length} running in empty rooms` : 'Nothing running in empty rooms' },
    { id: 'climate', label: 'Climate efficiency', score: climate, max: climateMax, hint: `Cooling is ${round(acShare, 0)}% of today's usage` },
    { id: 'standby', label: 'Standby power', score: standby, max: standbyMax, hint: `${standbyW}W of vampire draw` },
    { id: 'automation', label: 'Automation coverage', score: automation, max: automationMax, hint: `${enabled} of ${state.automations.length} rules active` },
    { id: 'discipline', label: 'Load discipline', score: discipline, max: disciplineMax, hint: awayLoads ? `${awayLoads} loads running while away` : `Peak ${Math.round(state.energy.peakW)}W today` },
  ]

  const score = clamp(Math.round(breakdown.reduce((a, b) => a + b.score, 0)), 0, 100)

  /* --------------------------------------------------------------- carbon */
  const avoidedFromEfficiency = Math.max(0, BASELINE.dailyKwh - projected) * 30
  const avoidedFromAutomation = enabled * 0.25 * 30
  const avoidedKwh = avoidedFromEfficiency + avoidedFromAutomation
  const co2SavedKg = round(avoidedKwh * CO2_PER_KWH, 1)

  /* ------------------------------------------------------ recommendations */
  const recommendations = []

  if (idle.length) {
    recommendations.push({
      id: 'eco-idle',
      label: `Switch off ${idle.length} device${idle.length > 1 ? 's' : ''} in empty rooms`,
      detail: idle.map((d) => d.name).join(', '),
      points: Math.round(idle.length * 2.5),
      actionLabel: 'Turn them off',
      effect: { type: 'DEVICES_OFF', ids: idle.map((d) => d.id) },
      icon: 'PowerOff',
    })
  }
  if (setpointPenalty > 0) {
    recommendations.push({
      id: 'eco-setpoint',
      label: 'Raise every AC setpoint to 24°C',
      detail: 'Compressor load falls roughly 6% per degree.',
      points: Math.round(setpointPenalty),
      actionLabel: 'Set to 24°C',
      effect: { type: 'SET_SETPOINTS', ids: runningAcs.map((d) => d.id), value: 24 },
      icon: 'Snowflake',
    })
  }
  if (standby < standbyMax - 1) {
    recommendations.push({
      id: 'eco-standby',
      label: 'Cut standby draw with an automation',
      detail: `${standbyW}W leaks continuously from switched-off electronics.`,
      points: Math.round(standbyMax - standby),
      actionLabel: 'Add cut-off rule',
      effect: { type: 'ADD_STANDBY_AUTOMATION' },
      icon: 'Plug',
    })
  }
  if (automation < automationMax - 1) {
    recommendations.push({
      id: 'eco-automation',
      label: 'Enable more automation rules',
      detail: `${state.automations.length - enabled} rule${state.automations.length - enabled === 1 ? ' is' : 's are'} switched off.`,
      points: Math.round(automationMax - automation),
      actionLabel: null,
      effect: null,
      icon: 'Workflow',
    })
  }
  if (awayLoads > 0) {
    recommendations.push({
      id: 'eco-away',
      label: 'Clear loads while the house is empty',
      detail: `${awayLoads} device${awayLoads > 1 ? 's are' : ' is'} running with nobody home.`,
      points: 6,
      actionLabel: 'Run eco sweep',
      effect: { type: 'ECO_SWEEP' },
      icon: 'HomeIcon',
    })
  }
  if (consumption < consumptionMax - 4) {
    recommendations.push({
      id: 'eco-consumption',
      label: 'Bring daily usage under the baseline',
      detail: `Projected ${round(projected, 1)} kWh today — about ${Math.round(costOf(projected))} rupees.`,
      points: Math.round(consumptionMax - consumption),
      actionLabel: 'Run eco sweep',
      effect: { type: 'ECO_SWEEP' },
      icon: 'TrendingDown',
    })
  }

  return {
    score,
    band: bandFor(score),
    breakdown,
    recommendations: recommendations.sort((a, b) => b.points - a.points),
    co2SavedKg,
    avoidedKwh: round(avoidedKwh, 1),
    projectedDailyKwh: round(projected, 2),
    currentW: snap.total,
  }
}
