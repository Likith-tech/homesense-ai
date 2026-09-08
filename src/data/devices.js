/**
 * Device catalogue.
 *
 * `watts` is the *rated* draw. Actual instantaneous draw is computed by
 * `utils/energy.js#devicePower`, which models compressor load for the AC,
 * duty cycling for the refrigerator and standby draw for everything else.
 *
 * Reference ratings used by the simulation:
 *   AC 1500W · Fan 75W · LED lamp 12W · TV 100W · Refrigerator 150W · Smart plug 50W
 *
 * Room lights are fixtures, so their rating is 12W per lamp × lamp count.
 */

export const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'LayoutGrid' },
  { id: 'lights', label: 'Lights', icon: 'Lightbulb' },
  { id: 'climate', label: 'Climate', icon: 'Wind' },
  { id: 'entertainment', label: 'Entertainment', icon: 'Tv' },
  { id: 'appliances', label: 'Appliances', icon: 'Plug' },
  { id: 'security', label: 'Security', icon: 'ShieldCheck' },
]

/** Categories used for the energy-distribution breakdown. */
export const ENERGY_GROUPS = [
  { id: 'ac', label: 'AC', color: '#38bdf8' },
  { id: 'lights', label: 'Lights', color: '#fbbf24' },
  { id: 'refrigerator', label: 'Refrigerator', color: '#34d399' },
  { id: 'tv', label: 'TV', color: '#a78bfa' },
  { id: 'fans', label: 'Fans', color: '#f472b6' },
  { id: 'other', label: 'Other', color: '#94a3b8' },
]

export const DEVICE_CATALOG = [
  /* ------------------------------------------------------------- lights -- */
  {
    id: 'living-light',
    name: 'Living Room Light',
    room: 'living',
    type: 'Light',
    category: 'lights',
    energyGroup: 'lights',
    icon: 'Lightbulb',
    watts: 72, // 6 × 12W LED
    standbyWatts: 0,
    detail: '6 × 12W LED · dimmable',
    defaultOn: true,
  },
  {
    id: 'bedroom-light',
    name: 'Bedroom Light',
    room: 'bedroom',
    type: 'Light',
    category: 'lights',
    energyGroup: 'lights',
    icon: 'Lightbulb',
    watts: 48, // 4 × 12W LED
    standbyWatts: 0,
    detail: '4 × 12W LED · warm white',
    defaultOn: false,
  },
  {
    id: 'kitchen-light',
    name: 'Kitchen Light',
    room: 'kitchen',
    type: 'Light',
    category: 'lights',
    energyGroup: 'lights',
    icon: 'Lightbulb',
    watts: 36, // 3 × 12W LED
    standbyWatts: 0,
    detail: '3 × 12W LED · task strip',
    defaultOn: false,
  },
  {
    id: 'study-light',
    name: 'Study Room Light',
    room: 'study',
    type: 'Light',
    category: 'lights',
    energyGroup: 'lights',
    icon: 'Lightbulb',
    watts: 36, // 3 × 12W LED
    standbyWatts: 0,
    detail: '3 × 12W LED · desk + ceiling',
    defaultOn: false,
  },

  /* ------------------------------------------------------------ climate -- */
  {
    id: 'living-ac',
    name: 'Living Room AC',
    room: 'living',
    type: 'AC',
    category: 'climate',
    energyGroup: 'ac',
    icon: 'AirVent',
    watts: 1500,
    standbyWatts: 4,
    detail: '1.5 ton inverter split',
    defaultOn: false,
    setpoint: 22,
  },
  {
    id: 'bedroom-ac',
    name: 'Bedroom AC',
    room: 'bedroom',
    type: 'AC',
    category: 'climate',
    energyGroup: 'ac',
    icon: 'AirVent',
    watts: 1500,
    standbyWatts: 4,
    detail: '1 ton inverter split',
    defaultOn: false,
    setpoint: 24,
  },
  {
    id: 'living-fan',
    name: 'Living Room Fan',
    room: 'living',
    type: 'Fan',
    category: 'climate',
    energyGroup: 'fans',
    icon: 'Fan',
    watts: 75,
    standbyWatts: 0,
    detail: 'BLDC ceiling fan',
    defaultOn: true,
  },
  {
    id: 'bedroom-fan',
    name: 'Bedroom Fan',
    room: 'bedroom',
    type: 'Fan',
    category: 'climate',
    energyGroup: 'fans',
    icon: 'Fan',
    watts: 75,
    standbyWatts: 0,
    detail: 'BLDC ceiling fan',
    defaultOn: false,
  },
  {
    id: 'study-fan',
    name: 'Study Room Fan',
    room: 'study',
    type: 'Fan',
    category: 'climate',
    energyGroup: 'fans',
    icon: 'Fan',
    watts: 75,
    standbyWatts: 0,
    detail: 'BLDC ceiling fan',
    defaultOn: false,
  },

  /* ------------------------------------------------------ entertainment -- */
  {
    id: 'tv',
    name: 'TV',
    room: 'living',
    type: 'Television',
    category: 'entertainment',
    energyGroup: 'tv',
    icon: 'Tv',
    watts: 100,
    standbyWatts: 8,
    detail: '55" LED · 8W standby',
    defaultOn: false,
  },

  /* --------------------------------------------------------- appliances -- */
  {
    id: 'smart-plug',
    name: 'Smart Plug',
    room: 'study',
    type: 'Smart Plug',
    category: 'appliances',
    energyGroup: 'other',
    icon: 'Plug',
    watts: 50,
    standbyWatts: 2,
    detail: 'Desk cluster · metered',
    defaultOn: true,
  },
  {
    id: 'refrigerator',
    name: 'Refrigerator',
    room: 'kitchen',
    type: 'Refrigerator',
    category: 'appliances',
    energyGroup: 'refrigerator',
    icon: 'Refrigerator',
    watts: 150,
    standbyWatts: 0,
    detail: 'Compressor duty-cycles 150W ↔ 45W',
    defaultOn: true,
    critical: true,
  },

  /* ----------------------------------------------------------- security -- */
  {
    id: 'front-door-lock',
    name: 'Front Door Lock',
    room: 'entry',
    type: 'Smart Lock',
    category: 'security',
    energyGroup: 'other',
    icon: 'DoorClosed',
    watts: 3,
    standbyWatts: 3,
    detail: 'Deadbolt · ON = locked',
    defaultOn: true,
    /** Toggling this device locks/unlocks rather than powering on/off. */
    semantics: 'lock',
  },
]

export const DEVICE_MAP = Object.fromEntries(DEVICE_CATALOG.map((d) => [d.id, d]))

export const devicesInRoom = (roomId) => DEVICE_CATALOG.filter((d) => d.room === roomId)

/** Labels for the ON / OFF state, so a lock doesn't read as "On". */
export function stateLabel(device, on) {
  if (device?.semantics === 'lock') return on ? 'Locked' : 'Unlocked'
  return on ? 'On' : 'Off'
}
