import { DEVICE_CATALOG } from '../data/devices'
import { ROOMS } from '../data/rooms'
import { COMFORT, BASELINE, CO2_PER_KWH } from '../data/constants'
import { efficiencyVsBaseline } from './energy'
import { projectedDailyKwh } from './ecoScore'
import { clamp, round } from './format'

/**
 * ============================================================================
 * HomeSense Score — a single 0-100 number that fuses five pillars
 * ============================================================================
 *
 * Unlike the Eco Score (which only grades energy behaviour), this is the
 * whole-home composite: Energy, Security, Comfort, Carbon and Automation.
 * Every pillar is a plain formula over live state — nothing here is random or
 * hard-coded, and every point lost traces back to a `reason` string built from
 * real numbers, so the score is always explainable on demand.
 */

const WEIGHTS = { energy: 0.25, security: 0.25, comfort: 0.2, carbon: 0.15, automation: 0.15 }

/* --------------------------------------------------------------- pillars -- */

function energyPillar(state) {
  const eff = efficiencyVsBaseline(state) // % better(+) / worse(-) than baseline
  const score = clamp(Math.round(60 + eff * 1.15), 0, 100)
  const reason =
    eff >= 0
      ? `Running ${eff}% below a comparable baseline home.`
      : `Running ${Math.abs(eff)}% above a comparable baseline home.`
  return { id: 'energy', label: 'Energy', score, reason }
}

function securityPillar(state) {
  let score = 100
  const reasons = []
  const alerting = state.security.status === 'alert' && !state.security.acknowledged
  const armed = state.homeMode !== 'home'

  if (alerting) {
    score -= 55
    reasons.push(state.security.reason || 'An unacknowledged security alert is active')
  } else if (state.security.status === 'warning') {
    score -= 20
    reasons.push(state.security.reason || 'Security posture needs attention')
  }
  if (armed && !state.sensors.door.locked) {
    score -= 15
    reasons.push('Front door is unlocked while the house is armed')
  }
  const breaches = state.security.breaches || 0
  if (breaches > 0) {
    const penalty = Math.min(20, breaches * 4)
    score -= penalty
    reasons.push(`${breaches} alert${breaches > 1 ? 's' : ''} raised today`)
  }

  score = clamp(Math.round(score), 0, 100)
  return {
    id: 'security',
    label: 'Security',
    score,
    reason: reasons[0] || `Perimeter ${armed ? 'armed' : 'relaxed'}, nothing outstanding.`,
  }
}

function comfortPillar(state) {
  const rooms = state.sensors.rooms
  let penalty = 0
  const offenders = []
  for (const r of ROOMS) {
    const room = rooms[r.id]
    if (room.temp > state.prefs.tempMax) {
      penalty += Math.min(10, (room.temp - state.prefs.tempMax) * 4)
      offenders.push(`${r.name} at ${round(room.temp, 1)}°C`)
    } else if (room.temp < state.prefs.tempMin) {
      penalty += Math.min(10, (state.prefs.tempMin - room.temp) * 4)
      offenders.push(`${r.name} at ${round(room.temp, 1)}°C`)
    }
    if (room.humidity > COMFORT.humidityMax) {
      penalty += Math.min(6, (room.humidity - COMFORT.humidityMax) * 0.5)
    }
  }
  if (state.sensors.aqi > COMFORT.aqiAlert) penalty += 15
  else if (state.sensors.aqi > COMFORT.aqiWarn) penalty += 7

  const score = clamp(Math.round(100 - penalty), 0, 100)
  const reason = offenders.length
    ? `${offenders[0]} is outside the ${state.prefs.tempMin}–${state.prefs.tempMax}°C comfort band.`
    : state.sensors.aqi > COMFORT.aqiWarn
      ? `Air quality index is ${state.sensors.aqi}, above the comfortable range.`
      : 'Every room is inside the comfort band.'
  return { id: 'comfort', label: 'Comfort', score, reason }
}

function carbonPillar(state) {
  const projected = projectedDailyKwh(state)
  const baselineCo2 = BASELINE.dailyKwh * CO2_PER_KWH
  const projectedCo2 = projected * CO2_PER_KWH
  const ratio = baselineCo2 > 0 ? projectedCo2 / baselineCo2 : 1
  const score = clamp(Math.round(100 - (ratio - 1) * 90), 0, 100)
  const delta = round(baselineCo2 - projectedCo2, 2)
  const reason =
    delta >= 0
      ? `Avoiding about ${delta} kg CO₂/day versus the baseline home.`
      : `Emitting about ${Math.abs(delta)} kg CO₂/day more than the baseline home.`
  return { id: 'carbon', label: 'Carbon', score, reason }
}

function automationPillar(state) {
  const total = state.automations.length
  const enabled = state.automations.filter((a) => a.enabled).length
  const coverage = total > 0 ? enabled / total : 0
  const acted = Math.min(10, state.stats.insightsActed || 0)
  const score = clamp(Math.round(coverage * 88 + acted * 1.2), 0, 100)
  const reason =
    total === 0
      ? 'No automation rules exist yet.'
      : `${enabled} of ${total} automation rules are active, ${state.stats.insightsActed || 0} AI actions applied so far.`
  return { id: 'automation', label: 'Automation', score, reason }
}

/* ----------------------------------------------------------------- public */

export function computeHomeSenseScore(state) {
  const pillars = [
    energyPillar(state),
    securityPillar(state),
    comfortPillar(state),
    carbonPillar(state),
    automationPillar(state),
  ]

  const overall = clamp(
    Math.round(pillars.reduce((a, p) => a + p.score * WEIGHTS[p.id], 0)),
    0,
    100,
  )

  const weakest = [...pillars].sort((a, b) => a.score - b.score)[0]

  return { overall, pillars, weakest }
}

export const SCORE_BANDS = [
  { min: 85, label: 'Excellent', tone: 'emerald' },
  { min: 70, label: 'Good', tone: 'lime' },
  { min: 55, label: 'Fair', tone: 'amber' },
  { min: 40, label: 'Poor', tone: 'orange' },
  { min: 0, label: 'Critical', tone: 'rose' },
]

export const bandForScore = (score) => SCORE_BANDS.find((b) => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1]
