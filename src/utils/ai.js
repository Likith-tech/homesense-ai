import { DEVICE_CATALOG } from '../data/devices'
import { ROOMS, roomName } from '../data/rooms'
import { COMFORT, HOME_MODES, TARIFF } from '../data/constants'
import {
  powerSnapshot,
  groupDistribution,
  topConsumer,
  costOf,
  projectMonthlyBill,
  savingOpportunities,
  averageDailyKwh,
} from './energy'
import { computeEcoScore } from './ecoScore'
import { projectIfNothingChanges } from './whatIf'
import { detectBehavioralDeviation } from './behavioralBaseline'
import { round, durationLabel, sinceLabel, watts, temp, currency, kwh, pct, aqiBand } from './format'

/**
 * ============================================================================
 * HomeSense AI — reasoning layer
 * ============================================================================
 *
 * A deterministic, rule-based expert system over live simulated telemetry.
 * It runs entirely in the browser with no API key, which is what makes the
 * prototype demonstrable offline. Every insight it produces carries:
 *
 *    message      — what it noticed
 *    reason       — why that matters, with the numbers behind it
 *    actionLabel  — the one thing worth doing about it
 *    effect       — an executable effect, so the button genuinely works
 *
 * Swapping in an LLM later means replacing `generateInsights` with a call that
 * returns the same shape. The UI would not need to change.
 */

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2, success: 3 }

/**
 * Priority tiers shown to the user, derived from the same `priority` number
 * already used for sorting. `info`/`success` insights are always framed as
 * optimisation suggestions rather than problems.
 */
export const TIER_META = {
  CRITICAL: { label: 'Critical', tone: 'rose', rank: 0 },
  HIGH: { label: 'High', tone: 'amber', rank: 1 },
  MEDIUM: { label: 'Medium', tone: 'sky', rank: 2 },
  LOW: { label: 'Low', tone: 'slate', rank: 3 },
  OPTIMIZATION: { label: 'Optimisation', tone: 'violet', rank: 4 },
}

function deriveTier(insight) {
  if (insight.severity === 'success' || insight.severity === 'info') return 'OPTIMIZATION'
  if (insight.priority >= 95) return 'CRITICAL'
  if (insight.priority >= 70) return 'HIGH'
  if (insight.priority >= 35) return 'MEDIUM'
  return 'LOW'
}

/**
 * A deterministic "how many independent signals agree" score, not a
 * statistical or ML probability. Presented to the user with that caveat.
 */
function deriveConfidence(insight) {
  const base = 72 + (insight.signals?.length || 0) * 7
  const bump = insight.severity === 'critical' ? 10 : insight.severity === 'warning' ? 4 : 0
  return Math.min(98, base + bump)
}

/* ------------------------------------------------------------------ helpers */

const isOn = (state, id) => !!state.devices[id]?.on

function idleLights(state) {
  return DEVICE_CATALOG.filter((d) => {
    if (d.category !== 'lights' || !isOn(state, d.id)) return false
    const room = state.sensors.rooms[d.room]
    if (!room || room.motion) return false
    return state.simTime - (room.lastMotionAt || 0) >= COMFORT.idleLightMinutes * 60000
  })
}

function warmRooms(state) {
  return ROOMS.filter((r) => {
    const room = state.sensors.rooms[r.id]
    if (!room || room.temp <= state.prefs.tempMax) return false
    const ac = DEVICE_CATALOG.find((d) => d.room === r.id && d.type === 'AC')
    return !ac || !isOn(state, ac.id)
  })
}

/* ---------------------------------------------------------------- insights */

export function generateInsights(state) {
  const out = []
  const now = state.simTime
  const snap = powerSnapshot(state)
  const rooms = state.sensors.rooms
  const dist = groupDistribution(state)
  const acShare = dist.find((d) => d.id === 'ac')

  /* ---------------------------------------------------- 1. security first */
  if (state.security.status === 'alert' && !state.security.acknowledged) {
    out.push({
      id: 'ai-security-alert',
      severity: 'critical',
      icon: 'ShieldAlert',
      title: 'Security alert',
      message: `${state.security.reason || 'Unexpected activity detected'}.`,
      reason: `The house is armed in ${HOME_MODES[state.homeMode].label} Mode and a monitored sensor tripped ${sinceLabel(
        state.security.since,
        now,
      )}. I recommend checking the live sensors before dismissing this.`,
      actionLabel: 'Lock down & acknowledge',
      effect: [{ type: 'LOCK_DOOR' }, { type: 'ECO_SWEEP' }, { type: 'ACK_ALERTS' }],
      secondary: { label: 'Acknowledge only', effect: { type: 'ACK_ALERTS' } },
      priority: 100,
      signals: [
        `Home mode: ${HOME_MODES[state.homeMode].label}`,
        `Trigger: ${state.security.reason || 'sensor trip'}`,
        `Since: ${sinceLabel(state.security.since, now)}`,
      ],
    })
  }

  if (state.sensors.door.open && state.homeMode !== 'home') {
    out.push({
      id: 'ai-door-away',
      severity: 'critical',
      icon: 'DoorOpen',
      title: 'Front door activity while armed',
      message: 'Front door was opened while Away Mode was active.',
      reason: `The entry sensor reports the door open right now, and ${HOME_MODES[state.homeMode].label} Mode has been active ${sinceLabel(
        state.modeChangedAt,
        now,
      )}. Nobody is expected in the house.`,
      actionLabel: 'Secure the door',
      effect: { type: 'LOCK_DOOR' },
      priority: 99,
      signals: [
        `Home mode: ${HOME_MODES[state.homeMode].label}`,
        'Door sensor: OPEN',
        `Mode active: ${sinceLabel(state.modeChangedAt, now)}`,
      ],
    })
  }

  if (state.homeMode !== 'home' && !state.sensors.door.locked) {
    out.push({
      id: 'ai-unlocked',
      severity: 'warning',
      icon: 'Unlock',
      title: 'Door left unlocked',
      message: 'The front door is unlocked while the house is armed.',
      reason: 'Arming the house should always be paired with a locked deadbolt.',
      actionLabel: 'Lock front door',
      effect: { type: 'LOCK_DOOR' },
      priority: 90,
      signals: [
        `Home mode: ${HOME_MODES[state.homeMode].label}`,
        'Door lock: unlocked',
        'Policy: armed mode requires locked deadbolt',
      ],
    })
  }

  /* ------------------------------------------------ 2. wasted electricity */
  const idle = idleLights(state)
  if (idle.length) {
    const primary = idle[0]
    const dev = state.devices[primary.id]
    const room = rooms[primary.room]
    const onFor = dev.onSince ? durationLabel(now - dev.onSince) : 'a while'
    const wasted = idle.reduce((a, d) => a + (snap.byDevice[d.id] || 0), 0)
    out.push({
      id: 'ai-idle-lights',
      severity: 'warning',
      icon: 'Lightbulb',
      title: 'Lights on in an empty room',
      message:
        idle.length === 1
          ? `${primary.name} has been ON for ${onFor} with no motion detected.`
          : `${idle.length} lights have been ON with no motion detected — ${idle
              .map((d) => d.name)
              .join(', ')}.`,
      reason: `${roomName(primary.room)} last saw movement ${sinceLabel(
        room.lastMotionAt,
        now,
      )}. Those fixtures are drawing ${watts(wasted)}, which is about ${currency(
        costOf((wasted / 1000) * 5),
        0,
      )} a day if this repeats.`,
      actionLabel: idle.length === 1 ? 'Turn off lights' : `Turn off ${idle.length} lights`,
      effect: { type: 'DEVICES_OFF', ids: idle.map((d) => d.id) },
      priority: 80,
      signals: [
        `Motion: none in ${roomName(primary.room)} for ${sinceLabel(room.lastMotionAt, now)}`,
        `Device state: ${idle.length} light${idle.length > 1 ? 's' : ''} ON`,
        `Draw: ${watts(wasted)} continuous`,
      ],
      whatIf: projectIfNothingChanges(wasted, 6),
    })
  }

  /* ---------------------------------------------------- 3. thermal comfort */
  const warm = warmRooms(state)
  if (warm.length) {
    const r = warm[0]
    const ac = DEVICE_CATALOG.find((d) => d.room === r.id && d.type === 'AC')
    const fan = DEVICE_CATALOG.find((d) => d.room === r.id && d.type === 'Fan')
    out.push({
      id: 'ai-warm',
      severity: 'warning',
      icon: 'ThermometerSun',
      title: 'Above your comfort range',
      message: `${r.name} is ${temp(rooms[r.id].temp)} — above your comfort range. ${
        ac ? 'Consider enabling AC.' : 'Consider running the fan.'
      }`,
      reason: `Your comfort ceiling is ${state.prefs.tempMax}°C and it is ${temp(
        state.sensors.outdoorTemp,
      )} outside. ${
        ac
          ? 'Starting the AC at 24°C reaches comfort in a few minutes without the penalty of a 22°C setpoint.'
          : 'This room has no AC installed, but air movement drops the perceived temperature by about 2°C.'
      }`,
      actionLabel: ac ? `Turn on ${ac.name}` : fan ? `Turn on ${fan.name}` : 'Open ventilation',
      effect: ac
        ? { type: 'DEVICES_ON', ids: [ac.id] }
        : fan
          ? { type: 'DEVICE_ON', id: fan.id }
          : { type: 'NONE' },
      extra: ac ? { type: 'SET_SETPOINT', id: ac.id, value: 24 } : null,
      priority: 70,
      signals: [
        `Room temp: ${temp(rooms[r.id].temp)} vs ${state.prefs.tempMax}°C ceiling`,
        `Outdoor: ${temp(state.sensors.outdoorTemp)}`,
        `Cooling device: ${ac ? `${ac.name} off` : 'none installed'}`,
      ],
    })
  }

  /* --------------------------------------------------- 4. energy dominance */
  if (acShare && acShare.value >= 35) {
    out.push({
      id: 'ai-ac-share',
      severity: 'info',
      icon: 'AirVent',
      title: 'Cooling dominates your bill',
      message: `AC is responsible for ${pct(acShare.value)} of today's energy consumption.`,
      reason: `That is ${kwh(acShare.kwh)} out of ${kwh(state.energy.todayKwh)} today, roughly ${currency(
        costOf(acShare.kwh),
      )}. Raising every setpoint to 24°C typically trims 15–20% off that.`,
      actionLabel: 'Optimise AC setpoints',
      effect: {
        type: 'SET_SETPOINTS',
        ids: DEVICE_CATALOG.filter((d) => d.type === 'AC').map((d) => d.id),
        value: 24,
      },
      priority: 60,
      signals: [
        `AC share of today's energy: ${pct(acShare.value)}`,
        `AC energy: ${kwh(acShare.kwh)} of ${kwh(state.energy.todayKwh)} total`,
        `Cost so far today: ${currency(costOf(acShare.kwh))}`,
      ],
    })
  }

  if (snap.total > COMFORT.highPowerW) {
    const top = topConsumer(state)
    out.push({
      id: 'ai-high-power',
      severity: 'warning',
      icon: 'Zap',
      title: 'High energy consumption right now',
      message: `Energy consumption is currently high at ${watts(snap.total)}.${
        top ? ` ${top.name} is the largest contributor.` : ''
      }`,
      reason: `Sustained for an hour that costs ${currency(
        costOf(snap.total / 1000),
        1,
      )}. ${snap.active} devices are currently drawing power.`,
      actionLabel: 'Run eco sweep',
      effect: { type: 'ECO_SWEEP' },
      priority: 65,
      signals: [
        `Total load: ${watts(snap.total)} vs ${watts(COMFORT.highPowerW)} threshold`,
        `Active devices: ${snap.active}`,
        top ? `Largest contributor: ${top.name} (${pct(top.value)})` : 'No single dominant device',
      ],
    })
  }

  /* --------------------------------------------- 5. climate inefficiencies */
  const coldAc = DEVICE_CATALOG.find(
    (d) => d.type === 'AC' && isOn(state, d.id) && (state.devices[d.id].setpoint ?? 24) < 23,
  )
  if (coldAc) {
    const sp = state.devices[coldAc.id].setpoint
    out.push({
      id: 'ai-ac-setpoint',
      severity: 'info',
      icon: 'Snowflake',
      title: 'Setpoint below the efficient band',
      message: `${coldAc.name} is set to ${sp}°C. Moving it to 24°C saves energy without losing comfort.`,
      reason: `Compressor load drops roughly 6% per degree. From ${sp}°C to 24°C that is about ${pct(
        (24 - sp) * 6,
      )} less cooling energy — around ${currency(costOf((24 - sp) * 0.42 * 30))} a month.`,
      actionLabel: 'Set to 24°C',
      effect: { type: 'SET_SETPOINT', id: coldAc.id, value: 24 },
      priority: 50,
      signals: [
        `${coldAc.name} setpoint: ${sp}°C`,
        `Efficient band: ≥ 23°C`,
        `Projected saving: ${currency(costOf((24 - sp) * 0.42 * 30))}/month`,
      ],
    })
  }

  const acAtTarget = DEVICE_CATALOG.find((d) => {
    if (d.type !== 'AC' || !isOn(state, d.id)) return false
    const room = rooms[d.room]
    return room && room.temp <= (state.devices[d.id].setpoint ?? 24) + 0.3
  })
  if (acAtTarget) {
    out.push({
      id: 'ai-ac-reached',
      severity: 'info',
      icon: 'Fan',
      title: 'Setpoint reached — hand over to the fan',
      message: `${roomName(acAtTarget.room)} has reached its target temperature.`,
      reason:
        'A ceiling fan holds a room at temperature for 75W where an idling AC still draws around 380W. Over an evening that is a meaningful saving.',
      actionLabel: 'Switch to fan',
      effect: { type: 'SWAP_AC_FOR_FAN', ids: [acAtTarget.id] },
      priority: 45,
      signals: [
        `${roomName(acAtTarget.room)} temp: ${temp(rooms[acAtTarget.room].temp)}`,
        `AC setpoint: ${state.devices[acAtTarget.id].setpoint ?? 24}°C — reached`,
        'Idle AC ≈380W vs fan 75W',
      ],
    })
  }

  /* ------------------------------------------------- 6. presence-based waste */
  const tvIdle =
    isOn(state, 'tv') &&
    !rooms.living.motion &&
    now - (rooms.living.lastMotionAt || 0) > 15 * 60000
  if (tvIdle) {
    out.push({
      id: 'ai-tv-idle',
      severity: 'warning',
      icon: 'Tv',
      title: 'TV playing to an empty room',
      message: `The TV is on but the Living Room has been empty ${sinceLabel(rooms.living.lastMotionAt, now)}.`,
      reason: `At ${watts(snap.byDevice.tv || 100)} that is ${currency(costOf(0.1 * 3))} of viewing nobody is doing.`,
      actionLabel: 'Turn off TV',
      effect: { type: 'DEVICE_OFF', id: 'tv' },
      priority: 55,
      signals: [
        `Living room motion: none for ${sinceLabel(rooms.living.lastMotionAt, now)}`,
        'TV state: ON',
        `Draw: ${watts(snap.byDevice.tv || 100)}`,
      ],
      whatIf: projectIfNothingChanges(snap.byDevice.tv || 100, 6),
    })
  }

  if (state.homeMode === 'away') {
    const running = DEVICE_CATALOG.filter(
      (d) => isOn(state, d.id) && !d.critical && d.semantics !== 'lock',
    )
    if (running.length) {
      out.push({
        id: 'ai-away-running',
        severity: 'warning',
        icon: 'HomeIcon',
        title: 'Devices running in an empty house',
        message: `${running.length} device${running.length > 1 ? 's are' : ' is'} still on while Away Mode is active.`,
        reason: `${running.map((d) => d.name).join(', ')} — together ${watts(
          running.reduce((a, d) => a + (snap.byDevice[d.id] || 0), 0),
        )} with nobody home.`,
        actionLabel: 'Switch everything off',
        effect: { type: 'ECO_SWEEP' },
        priority: 75,
        signals: [
          `Home mode: Away since ${sinceLabel(state.modeChangedAt, now)}`,
          `Non-critical devices ON: ${running.length}`,
          `Combined draw: ${watts(running.reduce((a, d) => a + (snap.byDevice[d.id] || 0), 0))}`,
        ],
        whatIf: projectIfNothingChanges(
          running.reduce((a, d) => a + (snap.byDevice[d.id] || 0), 0),
          6,
        ),
      })
    }
  }

  /* ------------------------------------------------ 7. environment quality */
  const band = aqiBand(state.sensors.aqi)
  if (state.sensors.aqi > COMFORT.aqiWarn) {
    out.push({
      id: 'ai-aqi',
      severity: state.sensors.aqi > COMFORT.aqiAlert ? 'warning' : 'info',
      icon: 'Wind',
      title: `Air quality is ${band.label.toLowerCase()}`,
      message: `Indoor air quality index is ${state.sensors.aqi}.`,
      reason:
        'Cooking and closed windows push particulates up. Running the AC circulates air through its filter and typically pulls the index back under 100.',
      actionLabel: 'Circulate air',
      effect: { type: 'DEVICE_ON', id: 'living-fan' },
      priority: 40,
      signals: [
        `AQI: ${state.sensors.aqi} (${band.label})`,
        `Warn threshold: ${COMFORT.aqiWarn}`,
        'Circulation via AC filter typically restores <100 AQI',
      ],
    })
  }

  const humid = ROOMS.find((r) => rooms[r.id].humidity > COMFORT.humidityMax + 5)
  if (humid) {
    out.push({
      id: 'ai-humidity',
      severity: 'info',
      icon: 'Droplets',
      title: 'Humidity above comfort',
      message: `${humid.name} is at ${round(rooms[humid.id].humidity, 0)}% relative humidity.`,
      reason:
        'Above 70% RH a room feels several degrees warmer than it is. Air conditioning dehumidifies as a side effect of cooling.',
      actionLabel: 'Improve air movement',
      effect: {
        type: 'DEVICE_ON',
        id: DEVICE_CATALOG.find((d) => d.room === humid.id && d.type === 'Fan')?.id || 'living-fan',
      },
      priority: 35,
      signals: [
        `${humid.name} humidity: ${round(rooms[humid.id].humidity, 0)}%`,
        `Comfort ceiling: ${COMFORT.humidityMax}%`,
        `Temp: ${temp(rooms[humid.id].temp)}`,
      ],
    })
  }

  /* ------------------------------------------------- 7b. behavioral baseline */
  const deviation = detectBehavioralDeviation(state)
  if (deviation) {
    const { room, hour, minutesOutsidePattern, quietFrom } = deviation
    const armed = state.homeMode !== 'home'
    out.push({
      id: 'ai-baseline-deviation',
      severity: armed ? 'warning' : 'info',
      icon: 'History',
      title: 'Unusual activity pattern',
      message: `${room.name} is active at an unusual time — ${String(hour).padStart(2, '0')}:00 is outside its normal pattern.`,
      reason: quietFrom
        ? `${room.name} normally becomes inactive around ${quietFrom}:00. Current activity is roughly ${Math.round(
            minutesOutsidePattern,
          )} minutes outside the typical pattern for this hour.`
        : `${room.name} is not usually active at this hour based on its typical usage pattern.`,
      actionLabel: null,
      effect: null,
      priority: armed ? 72 : 32,
      signals: [
        `Room: ${room.name} — occupied now`,
        `Hour: ${String(hour).padStart(2, '0')}:00`,
        `Home mode: ${HOME_MODES[state.homeMode].label}`,
      ],
    })
  }

  /* ----------------------------------------------------- 8. housekeeping */
  if (!isOn(state, 'refrigerator')) {
    out.push({
      id: 'ai-fridge-off',
      severity: 'critical',
      icon: 'Refrigerator',
      title: 'Refrigerator is switched off',
      message: 'The refrigerator has been powered down.',
      reason: 'This is a critical appliance. Food safety degrades within a couple of hours.',
      actionLabel: 'Restore power',
      effect: { type: 'DEVICE_ON', id: 'refrigerator' },
      priority: 95,
      signals: ['Refrigerator state: OFF', 'Classification: critical appliance', 'Food safety risk: rising'],
    })
  }

  const enabledRules = state.automations.filter((a) => a.enabled).length
  if (enabledRules === 0) {
    out.push({
      id: 'ai-no-automations',
      severity: 'info',
      icon: 'Workflow',
      title: 'No automations are running',
      message: 'Every automation rule is currently disabled, so nothing is being optimised for you.',
      reason:
        'Automations are where the savings compound — they act in the seconds between you noticing a problem and doing something about it.',
      actionLabel: 'Add standby cut-off rule',
      effect: { type: 'ADD_STANDBY_AUTOMATION' },
      priority: 30,
      signals: [
        `Total automation rules: ${state.automations.length}`,
        'Enabled: 0',
        'Autonomous savings: not compounding',
      ],
    })
  }

  /* --------------------------------------------------- 9. all-clear state */
  if (!out.length) {
    const eco = computeEcoScore(state)
    out.push({
      id: 'ai-all-clear',
      severity: 'success',
      icon: 'ShieldCheck',
      title: 'Everything looks good',
      message: `Your home is comfortable, secure and running at ${watts(snap.total)}.`,
      reason: `Eco score ${eco.score}/100 · ${kwh(state.energy.todayKwh)} today · ${
        snap.active
      } active device${snap.active === 1 ? '' : 's'}. I'll keep monitoring and speak up when something changes.`,
      actionLabel: null,
      effect: null,
      priority: 0,
      signals: [
        `Checked: security, ${ROOMS.length} rooms, energy, air quality`,
        `Load: ${watts(snap.total)} · ${snap.active} devices active`,
        `Eco score: ${eco.score}/100`,
      ],
    })
  }

  const dismissed = state.dismissedInsights || []
  return out
    .filter((i) => !dismissed.some((d) => d.id === i.id && now < d.until))
    .map((i) => ({ ...i, tier: deriveTier(i), confidence: deriveConfidence(i) }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.priority - a.priority,
    )
}

/* --------------------------------------------------------------- chat brain */

const GREETINGS = ['hi', 'hey', 'hello', 'yo', 'good morning', 'good evening', 'namaste']

/**
 * Rule-based conversational layer. Matches the question against live state and
 * answers with real numbers — no canned strings, no external API.
 */
export function answerQuestion(state, raw) {
  const q = String(raw || '').toLowerCase().trim()
  const snap = powerSnapshot(state)
  const insights = generateInsights(state)
  const eco = computeEcoScore(state)
  const rooms = state.sensors.rooms
  const has = (...words) => words.some((w) => q.includes(w))

  const reply = (text, extra = {}) => ({ text, actions: [], bullets: [], ...extra })

  if (!q) return reply('Ask me anything about your home — temperature, energy, security or what to switch off.')

  if (GREETINGS.some((g) => q === g || q.startsWith(`${g} `))) {
    const top = insights[0]
    return reply(
      `Hello. I'm watching ${Object.keys(state.devices).length} devices across ${ROOMS.length} rooms. Right now the house is drawing ${watts(
        snap.total,
      )} and your eco score is ${eco.score}/100.`,
      {
        bullets:
          top && top.severity !== 'success'
            ? [`Most pressing: ${top.message}`]
            : ['Nothing needs your attention at the moment.'],
        actions: top?.effect ? [{ label: top.actionLabel, effect: top.effect }] : [],
      },
    )
  }

  if (has('help', 'what can you', 'commands', 'how do you work')) {
    return reply(
      "I read your sensors every few seconds and reason over them with a rule engine. Ask me things like:",
      {
        bullets: [
          '“How warm is the living room?”',
          '“Why is my bill so high?”',
          '“Is the house secure?”',
          '“What should I turn off?”',
          '“How can I improve my eco score?”',
        ],
      },
    )
  }

  /* ------------------------------------------------------------ leaving home */
  if (has("i'm leaving", 'im leaving', 'leaving home', 'leaving the house', "we're leaving", 'going out')) {
    const runningNow = DEVICE_CATALOG.filter(
      (d) => isOn(state, d.id) && !d.critical && d.semantics !== 'lock',
    )
    const wasted = runningNow.reduce((a, d) => a + (snap.byDevice[d.id] || 0), 0)
    return reply(
      state.homeMode === 'away'
        ? 'Away Mode is already active. The perimeter is armed and the front door is locked.'
        : `Got it — arming Away Mode. ${
            runningNow.length
              ? `${runningNow.length} non-essential device${runningNow.length > 1 ? 's are' : ' is'} still on, drawing ${watts(wasted)}.`
              : 'Nothing non-essential is running.'
          }`,
      {
        bullets: runningNow.map((d) => `${d.name} — ${watts(snap.byDevice[d.id] || 0)}`),
        actions:
          state.homeMode === 'away'
            ? []
            : [
                {
                  label: 'Arm Away Mode & optimise',
                  effect: [{ type: 'SET_HOME_MODE', mode: 'away' }, { type: 'ECO_SWEEP' }],
                },
              ],
      },
    )
  }

  if (has('turn off unnecessary', 'optimize home', 'optimise home', 'clear everything')) {
    const opps = savingOpportunities(state)
    return reply(
      opps.length
        ? `Optimising now. ${opps.length} saving opportunit${opps.length > 1 ? 'ies' : 'y'} found.`
        : 'Nothing unnecessary is running right now — the home is already optimised.',
      {
        bullets: opps.map((o) => o.title),
        actions: opps.length ? [{ label: 'Run eco sweep', effect: { type: 'ECO_SWEEP' } }] : [],
      },
    )
  }

  /* --------------------------------------------------------------- security */
  if (has('secure', 'security', 'safe', 'door', 'lock', 'intruder', 'alarm', 'burglar')) {
    const door = state.sensors.door
    const alerting = state.security.status === 'alert' && !state.security.acknowledged
    if (alerting) {
      return reply(
        `Security alert: ${state.security.reason}. This triggered ${sinceLabel(state.security.since, state.simTime)} while ${
          HOME_MODES[state.homeMode].label
        } Mode was active. I recommend checking the home.`,
        {
          bullets: [
            `Front door: ${door.open ? 'OPEN' : 'closed'} · ${door.locked ? 'locked' : 'unlocked'}`,
            `Motion sensors tripped: ${ROOMS.filter((r) => rooms[r.id].motion).map((r) => r.name).join(', ') || 'none'}`,
          ],
          actions: [
            { label: 'Lock front door', effect: { type: 'LOCK_DOOR' } },
            { label: 'Acknowledge alert', effect: { type: 'ACK_ALERTS' } },
          ],
        },
      )
    }
    return reply(
      `The house is ${state.security.status === 'secure' ? 'secure' : `showing a ${state.security.status}`} in ${
        HOME_MODES[state.homeMode].label
      } Mode.${state.security.reason ? ` ${state.security.reason}.` : ''}`,
      {
        bullets: [
          `Front door: ${door.open ? 'open' : 'closed'}, ${door.locked ? 'locked' : 'unlocked'} · last opened ${sinceLabel(door.lastOpenedAt, state.simTime)}`,
          `Perimeter armed: ${state.homeMode === 'home' ? 'no (Home Mode)' : 'yes'}`,
          `Alerts today: ${state.security.breaches || 0}`,
        ],
        actions:
          state.homeMode === 'home'
            ? [{ label: 'Arm Away Mode', effect: { type: 'SET_HOME_MODE', mode: 'away' } }]
            : [{ label: 'Disarm to Home Mode', effect: { type: 'SET_HOME_MODE', mode: 'home' } }],
      },
    )
  }

  /* ------------------------------------------------------------ temperature */
  if (has('temperature', 'temp', 'hot', 'cold', 'warm', 'cool', 'ac ', 'air condition', 'climate')) {
    const named = ROOMS.find((r) => q.includes(r.name.toLowerCase()) || q.includes(r.id))
    const room = named || ROOMS.reduce((a, r) => (rooms[r.id].temp > rooms[a.id].temp ? r : a), ROOMS[0])
    const t = rooms[room.id].temp
    const ac = DEVICE_CATALOG.find((d) => d.room === room.id && d.type === 'AC')
    const overComfort = t > state.prefs.tempMax

    return reply(
      overComfort
        ? `Your home is getting warm — ${room.name} is at ${temp(t)}, above your ${state.prefs.tempMax}°C comfort ceiling. I recommend turning on the AC.`
        : `${room.name} is at ${temp(t)}, comfortably inside your ${state.prefs.tempMin}–${state.prefs.tempMax}°C range.`,
      {
        bullets: [
          `Outdoor: ${temp(state.sensors.outdoorTemp)} · humidity ${round(rooms[room.id].humidity, 0)}%`,
          ac
            ? `${ac.name}: ${state.devices[ac.id].on ? `running at ${state.devices[ac.id].setpoint}°C` : 'off'}`
            : `${room.name} has no AC installed — fan only.`,
        ],
        actions:
          overComfort && ac && !state.devices[ac.id].on
            ? [
                { label: `Turn on ${ac.name}`, effect: { type: 'DEVICES_ON', ids: [ac.id] } },
                { label: 'Set 24°C', effect: { type: 'SET_SETPOINT', id: ac.id, value: 24 } },
              ]
            : [],
      },
    )
  }

  /* ----------------------------------------------------------------- energy */
  if (has('energy', 'power', 'bill', 'cost', 'electricity', 'consumption', 'kwh', 'usage', 'unit')) {
    const top = topConsumer(state)
    const bill = projectMonthlyBill(state)
    return reply(
      snap.total > COMFORT.highPowerW
        ? `Energy consumption is currently high at ${watts(snap.total)}. ${top ? `${top.name} is the largest contributor at ${pct(top.value)} of today's usage.` : ''}`
        : `You're drawing ${watts(snap.total)} right now — that's a reasonable load. ${top ? `${top.name} leads today at ${pct(top.value)}.` : ''}`,
      {
        bullets: [
          `Today: ${kwh(state.energy.todayKwh)} · ${currency(costOf(state.energy.todayKwh))}`,
          `7-day average: ${kwh(averageDailyKwh(state))} per day`,
          `Projected month-end bill: ${currency(bill.cost)} at ${TARIFF.label}`,
        ],
        actions: [
          { label: 'Run eco sweep', effect: { type: 'ECO_SWEEP' } },
          {
            label: 'Optimise AC to 24°C',
            effect: {
              type: 'SET_SETPOINTS',
              ids: DEVICE_CATALOG.filter((d) => d.type === 'AC').map((d) => d.id),
              value: 24,
            },
          },
        ],
      },
    )
  }

  /* ------------------------------------------------------------------ eco */
  if (has('eco', 'score', 'carbon', 'co2', 'green', 'efficien', 'sustainab')) {
    return reply(
      `Your eco score is ${eco.score}/100 — ${eco.band.label.toLowerCase()}. That works out to about ${round(
        eco.co2SavedKg,
        1,
      )} kg of CO₂ avoided per month against a comparable un-optimised home.`,
      {
        bullets: eco.recommendations.slice(0, 3).map((r) => `${r.label} (+${r.points} pts)`),
        actions: eco.recommendations[0]?.effect
          ? [{ label: eco.recommendations[0].actionLabel, effect: eco.recommendations[0].effect }]
          : [],
      },
    )
  }

  /* ---------------------------------------------------------- what's on / off */
  if (has('what is on', "what's on", 'which devices', 'devices on', 'turn off', 'switch off', 'save', 'waste', 'unused')) {
    const running = DEVICE_CATALOG.filter((d) => isOn(state, d.id) && d.semantics !== 'lock')
    const opps = savingOpportunities(state)
    return reply(
      `${running.length} device${running.length === 1 ? '' : 's'} ${running.length === 1 ? 'is' : 'are'} on, drawing ${watts(
        snap.total,
      )} in total.`,
      {
        bullets: running
          .map((d) => `${d.name} — ${watts(snap.byDevice[d.id] || 0)}`)
          .slice(0, 6),
        actions: opps.slice(0, 2).map((o) => ({ label: o.actionLabel, effect: o.effect })),
      },
    )
  }

  /* --------------------------------------------------------------- lights */
  if (has('light', 'lamp', 'bulb')) {
    const idle = idleLights(state)
    const on = DEVICE_CATALOG.filter((d) => d.category === 'lights' && isOn(state, d.id))
    if (idle.length) {
      const dev = state.devices[idle[0].id]
      return reply(
        `The ${idle[0].name} has been ON without detected movement${
          dev.onSince ? ` for ${durationLabel(state.simTime - dev.onSince)}` : ''
        }. Would you like me to turn it off?`,
        {
          bullets: idle.map(
            (d) => `${d.name} — ${roomName(d.room)} empty ${sinceLabel(rooms[d.room].lastMotionAt, state.simTime)}`,
          ),
          actions: [
            { label: `Turn off ${idle.length > 1 ? `${idle.length} lights` : 'the light'}`, effect: { type: 'DEVICES_OFF', ids: idle.map((d) => d.id) } },
          ],
        },
      )
    }
    return reply(
      on.length
        ? `${on.length} light${on.length === 1 ? ' is' : 's are'} on: ${on.map((d) => d.name).join(', ')}. All of them are in rooms with recent movement, so nothing looks wasted.`
        : 'Every light in the house is off.',
      {
        actions: on.length ? [{ label: 'Turn off all lights', effect: { type: 'ALL_LIGHTS_OFF' } }] : [],
      },
    )
  }

  /* ------------------------------------------------------------ automations */
  if (has('automation', 'rule', 'routine', 'schedule')) {
    const enabled = state.automations.filter((a) => a.enabled)
    return reply(
      `You have ${state.automations.length} automation rule${state.automations.length === 1 ? '' : 's'}, ${enabled.length} of them active. They've fired ${state.automations.reduce(
        (a, r) => a + (r.firedCount || 0),
        0,
      )} times so far.`,
      { bullets: enabled.slice(0, 4).map((a) => `${a.name} — ${a.description}`) },
    )
  }

  /* ------------------------------------------------------------------ air */
  if (has('air', 'aqi', 'humidity', 'quality', 'pollut')) {
    const band = aqiBand(state.sensors.aqi)
    return reply(
      `Indoor air quality index is ${state.sensors.aqi} — ${band.label.toLowerCase()}. Average humidity across the house is ${round(
        ROOMS.reduce((a, r) => a + rooms[r.id].humidity, 0) / ROOMS.length,
        0,
      )}%.`,
      {
        bullets: ROOMS.map((r) => `${r.name}: ${temp(rooms[r.id].temp)} · ${round(rooms[r.id].humidity, 0)}% RH`),
      },
    )
  }

  /* ----------------------------------------------------------------- rooms */
  const namedRoom = ROOMS.find((r) => q.includes(r.name.toLowerCase()) || q.includes(r.id))
  if (namedRoom) {
    const r = rooms[namedRoom.id]
    const devs = DEVICE_CATALOG.filter((d) => d.room === namedRoom.id)
    return reply(
      `${namedRoom.name}: ${temp(r.temp)}, ${round(r.humidity, 0)}% humidity, ${
        r.motion ? 'motion right now' : `last movement ${sinceLabel(r.lastMotionAt, state.simTime)}`
      }.`,
      {
        bullets: devs.map((d) => `${d.name} — ${isOn(state, d.id) ? 'ON' : 'off'} · ${watts(snap.byDevice[d.id] || 0)}`),
        actions: devs
          .filter((d) => isOn(state, d.id))
          .slice(0, 2)
          .map((d) => ({ label: `Turn off ${d.name}`, effect: { type: 'DEVICE_OFF', id: d.id } })),
      },
    )
  }

  /* ---------------------------------------------------------- attention */
  if (has('need attention', 'needs attention', 'what should i know', 'anything wrong', 'status report')) {
    const actionable = insights.filter((i) => i.severity !== 'success')
    return reply(
      actionable.length
        ? `${actionable.length} thing${actionable.length > 1 ? 's' : ''} worth your attention right now.`
        : 'Nothing needs your attention — every pillar is inside its normal band.',
      {
        bullets: actionable.slice(0, 5).map((i) => `[${i.tier}] ${i.message}`),
        actions: actionable[0]?.effect ? [{ label: actionable[0].actionLabel, effect: actionable[0].effect }] : [],
      },
    )
  }

  /* ------------------------------------------------------------- fallback */
  // Deliberately not a generic chatbot completion: unsupported input gets an
  // honest scope statement rather than an invented answer.
  return reply(
    "I can currently help with home status, energy, security, optimisation, and supported home actions. Try one of the suggestions below, or ask about a specific room.",
    {
      bullets: [
        `Home: ${HOME_MODES[state.homeMode].label} Mode · security ${state.security.status}`,
        `Load: ${watts(snap.total)} · today ${kwh(state.energy.todayKwh)} · ${currency(costOf(state.energy.todayKwh))}`,
        `Eco score: ${eco.score}/100`,
      ],
      actions: [],
    },
  )
}

export const SUGGESTED_PROMPTS = [
  "I'm leaving home",
  'What needs attention?',
  'Is my home secure?',
  'Why is my bill so high?',
  'What is consuming the most power?',
  'How can I improve my eco score?',
]
