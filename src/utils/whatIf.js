import { costOf, co2Of } from './energy'
import { round } from './format'

/**
 * "If nothing changes" projection engine.
 *
 * Takes a real wattage figure already read from the power model and projects
 * it forward — it never invents a number, it only extends one that already
 * came from `devicePower`/`powerSnapshot`.
 */
export function projectIfNothingChanges(wattageW, hours = 6) {
  const kwh = (wattageW / 1000) * hours
  const cost = round(costOf(kwh), 2)
  return {
    currentW: round(wattageW, 0),
    hours,
    kwh: round(kwh, 2),
    cost,
    co2Kg: round(co2Of(kwh), 3),
    // Same waste, recurring once a day for 30 days.
    monthlyCost: round(cost * 30, 0),
    // What acting now actually avoids — identical basis to `cost`, framed as
    // the savings side of the same number rather than a separate estimate.
    avoidableCost: cost,
  }
}
