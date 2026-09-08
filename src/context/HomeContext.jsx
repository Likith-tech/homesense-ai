import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useCallback,
} from 'react'
import { useNavigate } from 'react-router-dom'

import {
  SIM,
  STORAGE_KEY,
  STATE_VERSION,
  MAX_CHAT_MESSAGES,
  HOME_MODES,
} from '../data/constants'
import { DEVICE_CATALOG } from '../data/devices'
import { ROOMS } from '../data/rooms'
import { createInitialState, advance, updateSecurity, triggerSimEvent } from '../utils/simulation'
import { evaluateAutomations } from '../utils/automations'
import { applyEffects } from '../utils/effects'
import { powerSnapshot } from '../utils/energy'
import { generateInsights, answerQuestion } from '../utils/ai'
import { computeEcoScore } from '../utils/ecoScore'
import { pushEvent } from '../utils/events'
import { DEMO_STEPS, resolveNarration, resolveChat } from '../utils/demo'
import { uid } from '../utils/format'

const HomeContext = createContext(null)

/* ------------------------------------------------------------- persistence */

/** Fields worth surviving a refresh. Derived data is always recomputed. */
const IDLE_DEMO = { running: false, step: -1, startedAt: 0, stepStartedAt: 0, log: [] }

function serialise(state) {
  // A half-finished guided demo must never be restored on reload.
  return JSON.stringify({ ...state, demo: IDLE_DEMO })
}

/* -------------------------------------------------------------- validation */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const asObj = (v, fallback) => (isObj(v) ? v : fallback)
const asArr = (v, fallback) => (Array.isArray(v) ? v : fallback)
const asNum = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const asBool = (v, fallback) => (typeof v === 'boolean' ? v : fallback)

/** A rule is only usable if the engine can actually evaluate it. */
const isUsableRule = (a) =>
  isObj(a) && typeof a.id === 'string' && Array.isArray(a.conditions) && Array.isArray(a.actions)

/**
 * Rebuild a trustworthy state tree from whatever is in localStorage.
 *
 * Persisted data is untrusted input: it may come from an older build, a
 * half-written record, or a hand-edited devtools session. Rather than spreading
 * it over the defaults and hoping, every branch the UI reads is validated
 * against a freshly-generated state and repaired field by field. Anything
 * unrecognised is dropped instead of being allowed to reach a render.
 *
 * @returns {object|null} a usable state, or null to start fresh
 */
function hydrate(parsed) {
  if (!isObj(parsed) || parsed.version !== STATE_VERSION) return null

  const simTime = asNum(parsed.simTime, NaN)
  if (!Number.isFinite(simTime)) return null

  const fresh = createInitialState()
  // A simulated clock from another day would poison "today's" energy figures.
  if (new Date(simTime).toDateString() !== new Date(fresh.simTime).toDateString()) return null

  /* --- devices: catalogue is the authority; unknown ids are discarded --- */
  const devices = {}
  for (const def of DEVICE_CATALOG) {
    const base = fresh.devices[def.id]
    const stored = asObj(parsed.devices?.[def.id], null)
    devices[def.id] = stored
      ? {
          ...base,
          ...stored,
          id: def.id,
          on: asBool(stored.on, base.on),
          setpoint: def.type === 'AC' ? asNum(stored.setpoint, base.setpoint) : base.setpoint,
          onSince: asNum(stored.onSince, null),
          lastActivity: asNum(stored.lastActivity, base.lastActivity),
        }
      : base
  }

  /* --- rooms: every room in the topology must exist and hold real numbers --- */
  const rooms = {}
  for (const room of ROOMS) {
    const base = fresh.sensors.rooms[room.id]
    const stored = asObj(parsed.sensors?.rooms?.[room.id], null)
    rooms[room.id] = stored
      ? {
          ...base,
          ...stored,
          id: room.id,
          temp: asNum(stored.temp, base.temp),
          humidity: asNum(stored.humidity, base.humidity),
          motion: asBool(stored.motion, base.motion),
          occupied: asBool(stored.occupied, base.occupied),
          lastMotionAt: asNum(stored.lastMotionAt, base.lastMotionAt),
        }
      : base
  }

  const storedSensors = asObj(parsed.sensors, {})
  const sensors = {
    ...fresh.sensors,
    ...storedSensors,
    rooms,
    outdoorTemp: asNum(storedSensors.outdoorTemp, fresh.sensors.outdoorTemp),
    heatSurge: asNum(storedSensors.heatSurge, 0),
    aqi: asNum(storedSensors.aqi, fresh.sensors.aqi),
    door: { ...fresh.sensors.door, ...asObj(storedSensors.door, {}) },
  }

  /* --- energy: the charts index these arrays directly, so shape matters --- */
  const storedEnergy = asObj(parsed.energy, {})
  const hourly = asArr(storedEnergy.hourly, null)
  const weekly = asArr(storedEnergy.weekly, null)
  const energy = {
    ...fresh.energy,
    ...storedEnergy,
    todayKwh: asNum(storedEnergy.todayKwh, fresh.energy.todayKwh),
    peakW: asNum(storedEnergy.peakW, fresh.energy.peakW),
    groups: { ...fresh.energy.groups, ...asObj(storedEnergy.groups, {}) },
    hourly: hourly?.length === 24 ? hourly : fresh.energy.hourly,
    weekly: weekly?.length === 7 ? weekly : fresh.energy.weekly,
    powerHistory: asArr(storedEnergy.powerHistory, []).filter(
      (p) => isObj(p) && Number.isFinite(p.w),
    ),
  }

  /* --- collections: keep only entries the UI can render --- */
  const automations = asArr(parsed.automations, null)?.filter(isUsableRule) ?? fresh.automations
  const events = asArr(parsed.events, []).filter((e) => isObj(e) && typeof e.id === 'string')
  const chat = asArr(parsed.chat, []).filter((m) => isObj(m) && typeof m.text === 'string')

  return {
    ...fresh,
    ...parsed,
    version: STATE_VERSION,
    simTime,
    homeMode: HOME_MODES[parsed.homeMode] ? parsed.homeMode : fresh.homeMode,
    modeChangedAt: asNum(parsed.modeChangedAt, fresh.modeChangedAt),
    devices,
    sensors,
    energy,
    automations,
    events,
    chat: chat.slice(-MAX_CHAT_MESSAGES),
    dismissedInsights: asArr(parsed.dismissedInsights, []).filter((d) => isObj(d) && d.id),
    security: { ...fresh.security, ...asObj(parsed.security, {}) },
    prefs: { ...fresh.prefs, ...asObj(parsed.prefs, {}) },
    stats: { ...fresh.stats, ...asObj(parsed.stats, {}) },
    demo: IDLE_DEMO,
  }
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? hydrate(JSON.parse(raw)) : null
  } catch {
    // Corrupt, truncated or inaccessible storage: start from a clean sim.
    return null
  }
}

/* ------------------------------------------------------------------ reducer */

function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      let s = advance(state, action.dtMin ?? SIM.minutesPerTick)
      s = evaluateAutomations(s)
      s = updateSecurity(s)
      return s
    }

    case 'EFFECT': {
      const list = Array.isArray(action.effect) ? action.effect : [action.effect]
      let s = applyEffects(state, list, action.source || 'manual')
      s = updateSecurity(s)
      if (action.source === 'ai') {
        s = { ...s, stats: { ...s.stats, insightsActed: (s.stats.insightsActed || 0) + 1 } }
      }
      return s
    }

    case 'SIM_EVENT': {
      let s = triggerSimEvent(state, action.kind, action.payload)
      s = evaluateAutomations(s)
      s = updateSecurity(s)
      return s
    }

    case 'SET_PREFS':
      return { ...state, prefs: { ...state.prefs, ...action.patch } }

    /* ------------------------------------------------------- automations -- */
    case 'AUTOMATION_SAVE': {
      const exists = state.automations.some((a) => a.id === action.rule.id)
      const automations = exists
        ? state.automations.map((a) => (a.id === action.rule.id ? { ...a, ...action.rule } : a))
        : [...state.automations, action.rule]
      return pushEvent(
        { ...state, automations },
        {
          kind: 'automation',
          severity: 'success',
          title: exists ? 'Automation updated' : 'Automation created',
          detail: `"${action.rule.name}" ${exists ? 'was saved' : 'is now active'}.`,
          source: 'manual',
        },
      )
    }

    case 'AUTOMATION_DELETE': {
      const rule = state.automations.find((a) => a.id === action.id)
      return pushEvent(
        { ...state, automations: state.automations.filter((a) => a.id !== action.id) },
        {
          kind: 'automation',
          severity: 'info',
          title: 'Automation deleted',
          detail: `"${rule?.name ?? action.id}" was removed.`,
          source: 'manual',
        },
      )
    }

    case 'AUTOMATION_TOGGLE':
      return {
        ...state,
        automations: state.automations.map((a) =>
          a.id === action.id ? { ...a, enabled: !a.enabled, wasTrue: false } : a,
        ),
      }

    case 'AUTOMATION_SET_ENABLED':
      return {
        ...state,
        automations: state.automations.map((a) =>
          action.ids.includes(a.id) ? { ...a, enabled: action.enabled, wasTrue: false } : a,
        ),
      }

    /* -------------------------------------------------------------- chat -- */
    case 'CHAT_PUSH':
      return {
        ...state,
        chat: [...state.chat, { id: uid('msg'), at: state.simTime, ...action.message }].slice(
          -MAX_CHAT_MESSAGES,
        ),
      }

    case 'CHAT_CLEAR':
      return { ...state, chat: [] }

    /* ---------------------------------------------------------- insights -- */
    case 'DISMISS_INSIGHT':
      return {
        ...state,
        dismissedInsights: [
          ...(state.dismissedInsights || []).filter((d) => d.id !== action.id),
          { id: action.id, until: state.simTime + 45 * 60000 },
        ],
      }

    /* ------------------------------------------------------------ events -- */
    case 'CLEAR_EVENTS':
      return { ...state, events: [] }

    /* -------------------------------------------------------------- demo -- */
    case 'DEMO_START':
      return {
        ...state,
        demo: { running: true, step: 0, startedAt: Date.now(), stepStartedAt: Date.now(), log: [] },
        stats: { ...state.stats, demoRuns: (state.stats.demoRuns || 0) + 1 },
      }

    case 'DEMO_STEP':
      return {
        ...state,
        demo: {
          ...state.demo,
          step: action.index,
          stepStartedAt: Date.now(),
          log: [...state.demo.log, action.entry].filter(Boolean),
        },
      }

    case 'DEMO_STOP':
      return { ...state, demo: { ...state.demo, running: false, step: -1 } }

    case 'RESET':
      return createInitialState()

    case 'HYDRATE':
      return action.state

    default:
      return state
  }
}

/* ---------------------------------------------------------------- provider */

export function HomeProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => loadPersisted() || createInitialState())
  const [toasts, setToasts] = useState([])
  const navigate = useNavigate()

  /**
   * Latest-state escape hatch for callbacks that outlive the render that
   * created them — the persistence timer, the demo poller and `api.ask`.
   *
   * It is synchronised in an effect rather than during render: writing to a ref
   * while rendering is unsafe under concurrent rendering, where React may
   * render a tree it later throws away. This effect is declared first, so the
   * ref is already current by the time the effects below it run.
   */
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  /* ---------------------------------------------------------- simulation -- */
  useEffect(() => {
    if (!state.prefs.autoRun) return undefined
    const id = setInterval(() => dispatch({ type: 'TICK' }), SIM.tickMs)
    return () => clearInterval(id)
  }, [state.prefs.autoRun])

  /* --------------------------------------------------------- persistence -- */
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, serialise(stateRef.current))
      } catch {
        /* quota or private mode — the app keeps working in memory */
      }
    }, 800)
    return () => clearTimeout(id)
  }, [state])

  /* -------------------------------------------------------------- toasts -- */
  const toast = useCallback((message, tone = 'info') => {
    const id = uid('toast')
    setToasts((t) => [...t.slice(-3), { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  /* ----------------------------------------------------------------- api -- */
  const api = useMemo(
    () => ({
      run: (effect, source = 'manual', message) => {
        if (!effect) return
        dispatch({ type: 'EFFECT', effect, source })
        if (message) toast(message, source === 'ai' ? 'ai' : 'success')
      },
      toggleDevice: (id) => dispatch({ type: 'EFFECT', effect: { type: 'DEVICE_TOGGLE', id }, source: 'manual' }),
      setDevice: (id, on) =>
        dispatch({ type: 'EFFECT', effect: { type: on ? 'DEVICE_ON' : 'DEVICE_OFF', id }, source: 'manual' }),
      setSetpoint: (id, value) =>
        dispatch({ type: 'EFFECT', effect: { type: 'SET_SETPOINT', id, value }, source: 'manual' }),
      setHomeMode: (mode) =>
        dispatch({ type: 'EFFECT', effect: { type: 'SET_HOME_MODE', mode }, source: 'manual' }),
      simulate: (kind, payload) => dispatch({ type: 'SIM_EVENT', kind, payload }),
      setPrefs: (patch) => dispatch({ type: 'SET_PREFS', patch }),
      saveAutomation: (rule) => dispatch({ type: 'AUTOMATION_SAVE', rule }),
      deleteAutomation: (id) => dispatch({ type: 'AUTOMATION_DELETE', id }),
      toggleAutomation: (id) => dispatch({ type: 'AUTOMATION_TOGGLE', id }),
      dismissInsight: (id) => dispatch({ type: 'DISMISS_INSIGHT', id }),
      clearEvents: () => dispatch({ type: 'CLEAR_EVENTS' }),
      clearChat: () => dispatch({ type: 'CHAT_CLEAR' }),
      pushChat: (message) => dispatch({ type: 'CHAT_PUSH', message }),
      ask: (text) => {
        dispatch({ type: 'CHAT_PUSH', message: { role: 'user', text } })
        const reply = answerQuestion(stateRef.current, text)
        dispatch({ type: 'CHAT_PUSH', message: { role: 'assistant', ...reply } })
      },
      reset: () => {
        localStorage.removeItem(STORAGE_KEY)
        dispatch({ type: 'RESET' })
        toast('Simulation reset to its initial state', 'info')
      },
      startDemo: () => dispatch({ type: 'DEMO_START' }),
      stopDemo: () => dispatch({ type: 'DEMO_STOP' }),
      toast,
      dismissToast,
    }),
    [toast, dismissToast],
  )

  /* ---------------------------------------------------------- demo driver -- */
  const demoRef = useRef({ appliedStep: -1 })

  useEffect(() => {
    if (!state.demo.running) {
      demoRef.current.appliedStep = -1
      return undefined
    }

    const index = state.demo.step
    const step = DEMO_STEPS[index]
    if (!step) {
      dispatch({ type: 'DEMO_STOP' })
      return undefined
    }

    /* Apply the step's side effects exactly once as it opens. */
    if (demoRef.current.appliedStep !== index) {
      demoRef.current.appliedStep = index
      if (step.page) navigate(step.page)
      if (step.automations?.disable?.length)
        dispatch({ type: 'AUTOMATION_SET_ENABLED', ids: step.automations.disable, enabled: false })
      if (step.automations?.enable?.length)
        dispatch({ type: 'AUTOMATION_SET_ENABLED', ids: step.automations.enable, enabled: true })
      if (step.effects?.length)
        step.effects.forEach((effect) => dispatch({ type: 'EFFECT', effect, source: 'demo' }))
      if (step.sim?.length)
        step.sim.forEach((s) => dispatch({ type: 'SIM_EVENT', kind: s.kind, payload: s.payload }))

      const chat = resolveChat(step, stateRef.current)
      if (chat) {
        dispatch({
          type: 'CHAT_PUSH',
          message: { role: 'assistant', text: chat, demoStep: step.id, bullets: [], actions: [] },
        })
      }
      dispatch({
        type: 'EFFECT',
        effect: {
          type: 'NOTIFY',
          kind: 'system',
          severity: 'info',
          title: `Demo step ${step.id} — ${step.title}`,
          detail: resolveNarration(step, stateRef.current),
        },
        source: 'demo',
      })
    }

    /* Advance when the floor time has elapsed and the world agrees. */
    const startedAt = state.demo.stepStartedAt
    const poll = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const min = step.minMs ?? 4000
      const max = step.maxMs ?? min
      const ready = elapsed >= min && (!step.waitFor || step.waitFor(stateRef.current))
      const timedOut = elapsed >= Math.max(min, max)
      if (ready || timedOut) {
        clearInterval(poll)
        if (index + 1 >= DEMO_STEPS.length) {
          dispatch({ type: 'DEMO_STOP' })
          toast('Demo complete — every change you saw is live state', 'success')
        } else {
          dispatch({ type: 'DEMO_STEP', index: index + 1 })
        }
      }
    }, 250)

    return () => clearInterval(poll)
  }, [state.demo.running, state.demo.step, state.demo.stepStartedAt, navigate, toast])

  /* ------------------------------------------------------------- derived -- */
  const derived = useMemo(() => {
    const power = powerSnapshot(state)
    return {
      power,
      insights: generateInsights(state),
      eco: computeEcoScore(state),
    }
  }, [state])

  const value = useMemo(
    () => ({ state, dispatch, api, toasts, ...derived }),
    [state, api, toasts, derived],
  )

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>
}

export function useHome() {
  const ctx = useContext(HomeContext)
  if (!ctx) throw new Error('useHome must be used inside <HomeProvider>')
  return ctx
}
