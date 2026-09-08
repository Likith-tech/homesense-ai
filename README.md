# HomeSense AI

> An AI that understands your home, saves energy, and keeps you safe.

A smart-home platform built for the **Smart Living** hackathon track. It monitors simulated IoT
sensors, controls connected devices, detects unusual events, optimises energy consumption, and
proactively recommends actions — with every recommendation carrying the reasoning behind it and a
button that genuinely applies it.

```bash
npm install
npm run dev
```

Then open the printed URL and press **Start Demo**.

---

## No hardware required

There is no physical IoT hardware in this project, and nothing pretends otherwise. Every sensor
reading is produced by a physical model running in the browser:

| Signal | How it is generated |
| --- | --- |
| Outdoor temperature | Diurnal sine curve, peaking at 15:00, trough at 03:00 |
| Room temperature | First-order thermal mass relaxing toward a target, driven by outdoor temperature, device heat, occupancy, fans and AC setpoint |
| Humidity | Tracks temperature inversely; AC dehumidifies, cooking adds moisture |
| Air quality | Slow drift, worsened by cooking, improved by AC filtration |
| Motion / occupancy | Two-state Markov chain per room, weighted by home mode |
| Door | Reed-switch state machine with automatic close |
| Energy | **Integrated from device power** — never randomly generated |

Temperature moves gradually rather than jumping, because it is the output of a model rather than a
random number generator.

## Ready for real IoT

Each room and device already carries a stable id and an MQTT-shaped topic (`home/living/motion`).
Connecting real hardware means replacing the tick in `src/utils/simulation.js` with an MQTT
subscriber that writes the same `state.sensors` shape — ESP32 nodes, Home Assistant, Zigbee2MQTT or
a Matter bridge. Automations, analytics, the eco score and the AI layer are untouched by that swap.

---

## Pages

| Route | What it does |
| --- | --- |
| `/` Dashboard | Home status, environment, energy, AI insights, eco score, activity feed |
| `/rooms` Rooms | Per-room climate, presence, energy and full device control + presence simulator |
| `/devices` Devices | 13 devices with filters, search, grid/list views and bulk actions |
| `/energy` Energy | Hourly, weekly and appliance-distribution analytics, costed saving opportunities |
| `/automations` Automations | Visual IF/THEN rule builder with 11 conditions and 9 actions |
| `/security` Security | Home modes, sensors, event log and a working event simulator |
| `/assistant` AI Assistant | Conversational interface over live telemetry |
| `/about` About | Problem / solution / innovation / future, architecture and model parameters |

## Architecture

```
src/
├── data/           devices.js · rooms.js · constants.js      static catalogue + tariffs
├── utils/
│   ├── simulation.js   IoT engine — thermal, occupancy, AQI, energy integration
│   ├── energy.js       per-device power, cost, projections, saving opportunities
│   ├── automations.js  condition/action schema + edge-triggered rule engine
│   ├── ai.js           rule-based reasoning → ranked, actionable insights
│   ├── ecoScore.js     decomposable 0-100 rating with attributed fixes
│   ├── effects.js      the single write path for all state changes
│   ├── events.js       append-only event log
│   ├── demo.js         the 15-step guided demo script
│   └── format.js       units, currency, relative time
├── context/HomeContext.jsx    one reducer, one source of truth, localStorage-backed
├── components/     DeviceCard · SensorCard · RoomCard · AIInsight · AutomationCard ·
│                   AutomationEditor · SecurityEvent · EnergyChart · EcoScoreCard ·
│                   DemoOverlay · ToastHost · ui/ primitives
└── pages/          the eight routes above
```

**One write path.** Manual toggles, automation actions, AI recommendation buttons and the demo
script all funnel through `applyEffect`. That is why switching on the AC anywhere immediately moves
the live power chart, the appliance distribution, the eco score, the AI insight list and the event
log at once. Derived values (power, insights, eco score) are computed from state on every render and
never stored, so they cannot drift out of sync.

## The guided demo

Press **Start Demo** anywhere in the app. Fifteen steps, roughly 70 seconds, navigating the app as
it goes. It drives the real engine throughout — step 2 injects a heat surge and then genuinely waits
for the room sensors to cross the comfort threshold; the alert at step 13 is raised by the same
Intrusion watch automation that would fire if you tripped the door sensor by hand.

## Model parameters

Electricity is priced on an Indian domestic slab: **₹8.00/kWh** plus ₹120 fixed monthly charge, with
a grid emission factor of 0.71 kg CO₂/kWh. Device ratings: AC 1500 W (inverter, modulated against
temperature error), fan 75 W, LED lamp 12 W each, TV 100 W / 8 W standby, refrigerator 150 W
duty-cycled to 45 W, smart plug 50 W, plus a 24 W always-on house baseline.

One simulation tick is 1200 ms of real time and advances the simulated clock by one minute, which
starts at 14:20 — peak afternoon heat, with a full evening ahead.

## Persistence

Device states, home mode, automations, security events, preferences and energy counters survive a
refresh via `localStorage` (`homesense-ai:state:v1`). Stored state from a previous day is discarded
so "today's usage" is never stale. The guided demo deliberately does not resume after a reload.
Reset everything from **About → Preferences → Reset simulation**.

## Tech

React 18 · Vite 6 · Tailwind CSS 4 · Recharts · Lucide React · localStorage.
No backend, no database, no authentication, no API keys — it runs entirely offline.
