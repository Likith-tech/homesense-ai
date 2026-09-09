import { ROOMS } from '../data/rooms'

/**
 * Behavioral baseline — a lightweight, transparent statistical model, NOT
 * machine learning. Each room carries a static table of the hours it is
 * normally active, seeded with plausible household patterns (kitchen busy
 * around meals, bedroom active overnight, living room busy in the evening,
 * study active during the day). Real usage would replace these with an
 * hour-of-day histogram learned from the room's own history; the detection
 * logic below does not care which one is behind it.
 */
export const TYPICAL_ACTIVE_HOURS = {
  living: [16, 17, 18, 19, 20, 21, 22],
  bedroom: [21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7],
  kitchen: [6, 7, 8, 12, 13, 14, 19, 20, 21],
  study: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
}

/**
 * Rooms whose "quiet hour" — the point past which continued activity is
 * unusual — is used to phrase the deviation in the same terms a person would
 * use ("normally quiet by 10:30 PM").
 */
export const QUIET_FROM_HOUR = {
  living: 23,
  bedroom: null,
  kitchen: 22,
  study: 21,
}

/**
 * Compares current occupancy against the baseline table for the current
 * simulated hour. Returns the room whose deviation is most significant, or
 * null. Deterministic and explainable — every field traces back to the table
 * above plus the live `state.sensors.rooms[...].occupied` reading.
 */
export function detectBehavioralDeviation(state) {
  const d = new Date(state.simTime)
  const hour = d.getHours()

  let best = null
  for (const room of ROOMS) {
    const typical = TYPICAL_ACTIVE_HOURS[room.id] || []
    const roomState = state.sensors.rooms[room.id]
    if (!roomState?.occupied || typical.includes(hour)) continue

    // Distance (in hours, wrapping around midnight) to the nearest typical hour.
    const distance = Math.min(
      ...typical.map((h) => Math.min(Math.abs(h - hour), 24 - Math.abs(h - hour))),
    )
    if (distance < 2) continue // near enough to a normal window to not be worth flagging

    const quietFrom = QUIET_FROM_HOUR[room.id]
    const candidate = {
      room,
      hour,
      distance,
      quietFrom,
      minutesOutsidePattern: distance * 60,
    }
    if (!best || candidate.distance > best.distance) best = candidate
  }
  return best
}
