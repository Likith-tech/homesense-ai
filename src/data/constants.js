/**
 * HomeSense AI — global constants.
 *
 * Every number here is a simulation parameter. When real hardware is wired in
 * later (MQTT / ESP32 / Home Assistant), the sensor values stop coming from
 * `utils/simulation.js` and start arriving on a transport, but the units,
 * thresholds and tariff maths below stay exactly the same.
 */

export const APP = {
  name: 'HomeSense AI',
  tagline: 'An AI that understands your home, saves energy, and keeps you safe.',
  version: '1.0.0',
}

/* ---------------------------------------------------------------- tariff -- */
/** Indian domestic slab-average used for the prototype. */
export const TARIFF = {
  currency: '₹',
  ratePerKwh: 8.0,
  fixedMonthlyCharge: 120,
  label: '₹8.00 / kWh · domestic slab',
}

/** Indian grid emission factor (kg CO₂ per kWh). */
export const CO2_PER_KWH = 0.71

/* ------------------------------------------------------------ simulation -- */
export const SIM = {
  /** Real milliseconds between engine ticks. */
  tickMs: 1200,
  /** Simulated minutes advanced per tick (1200ms real ≈ 1 simulated minute). */
  minutesPerTick: 1,
  /** Samples kept for the live power chart. */
  powerHistoryLength: 90,
  /** Max security / system events retained. */
  maxEvents: 120,
}

/* -------------------------------------------------------------- comfort --- */
export const COMFORT = {
  tempMin: 21,
  tempMax: 27,
  humidityMin: 35,
  humidityMax: 65,
  /** AQI above this is flagged. Lower AQI = cleaner air. */
  aqiWarn: 100,
  aqiAlert: 150,
  /** Total household draw (W) above which the AI raises a load warning. */
  highPowerW: 1800,
  /** Minutes a light may stay on with no motion before it is "wasted". */
  idleLightMinutes: 20,
}

/** A typical un-optimised home of this size, used as the eco-score baseline. */
export const BASELINE = {
  dailyKwh: 11.5,
  avgPowerW: 480,
}

export const HOME_MODES = {
  home: {
    id: 'home',
    label: 'Home',
    description: 'Occupied — comfort automations active, security relaxed.',
    tone: 'emerald',
  },
  away: {
    id: 'away',
    label: 'Away',
    description: 'Nobody home — full perimeter monitoring, energy saving on.',
    tone: 'amber',
  },
  night: {
    id: 'night',
    label: 'Night',
    description: 'Sleeping — doors armed, quiet climate, lights dimmed.',
    tone: 'indigo',
  },
}

export const SECURITY_STATUS = {
  secure: { id: 'secure', label: 'Secure', tone: 'emerald' },
  warning: { id: 'warning', label: 'Warning', tone: 'amber' },
  alert: { id: 'alert', label: 'Alert', tone: 'rose' },
}

export const STORAGE_KEY = 'homesense-ai:state:v1'

/**
 * Shape version of the persisted state. Bump this whenever the state tree
 * changes incompatibly — anything stored under an older version is discarded
 * rather than half-migrated.
 */
export const STATE_VERSION = 1

/** Upper bound on retained assistant messages, so storage can't grow forever. */
export const MAX_CHAT_MESSAGES = 60
