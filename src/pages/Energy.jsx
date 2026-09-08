import Icon from '../components/ui/Icon'
import { Button, Card, SectionTitle, StatTile, StatusBadge, LivePulse } from '../components/ui/primitives'
import { HourlyChart, WeeklyChart, DistributionChart, LivePowerChart } from '../components/EnergyChart'
import EcoScoreCard from '../components/EcoScoreCard'
import { useHome } from '../context/HomeContext'
import { TARIFF } from '../data/constants'
import {
  costOf,
  groupDistribution,
  projectMonthlyBill,
  weeklyTotalKwh,
  averageDailyKwh,
  savingOpportunities,
  efficiencyVsBaseline,
} from '../utils/energy'
import { watts, kwh, currency, round, pct } from '../utils/format'

export default function Energy() {
  const { state, api, power } = useHome()
  const dist = groupDistribution(state)
  const bill = projectMonthlyBill(state)
  const weekTotal = weeklyTotalKwh(state)
  const avgDaily = averageDailyKwh(state)
  const opportunities = savingOpportunities(state)
  const efficiency = efficiencyVsBaseline(state)
  const currentHour = new Date(state.simTime).getHours()

  const totalMonthlySaving = opportunities.reduce((a, o) => a + o.savingPerMonth, 0)

  return (
    <div className="space-y-6 animate-float-in">
      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon="Calendar"
          tone="emerald"
          label="Today's usage"
          value={round(state.energy.todayKwh, 2)}
          unit="kWh"
          hint={`${currency(costOf(state.energy.todayKwh))} at ${TARIFF.currency}${TARIFF.ratePerKwh.toFixed(2)}/kWh`}
          trend={{
            dir: state.energy.todayKwh > avgDaily ? 'up' : 'down',
            label: `${Math.abs(round(((state.energy.todayKwh - avgDaily) / (avgDaily || 1)) * 100, 0))}% vs avg`,
          }}
        />
        <StatTile
          icon="BarChart3"
          tone="violet"
          label="This week"
          value={round(weekTotal, 1)}
          unit="kWh"
          hint={`${round(avgDaily, 1)} kWh average per day`}
        />
        <StatTile
          icon="IndianRupee"
          tone="amber"
          label="Estimated monthly bill"
          value={currency(bill.cost)}
          hint={`≈ ${round(bill.units, 0)} units + ${currency(TARIFF.fixedMonthlyCharge)} fixed`}
        />
        <StatTile
          icon="Activity"
          tone={power.total > 1800 ? 'rose' : 'sky'}
          label="Current consumption"
          value={watts(power.total)}
          hint={`${power.active} devices active · peak ${watts(state.energy.peakW)}`}
        />
      </div>

      {/* live load */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-mist-100">Live household load</h3>
            <p className="mt-0.5 text-[11.5px] text-mist-500">
              Integrated from device power every simulated minute — never a random walk.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LivePulse label={`${watts(power.total)} now`} />
            <StatusBadge tone={efficiency >= 0 ? 'emerald' : 'rose'} size="sm" icon={efficiency >= 0 ? 'TrendingDown' : 'TrendingUp'}>
              {efficiency >= 0 ? `${efficiency}% below baseline` : `${Math.abs(efficiency)}% above baseline`}
            </StatusBadge>
          </div>
        </div>
        <LivePowerChart data={state.energy.powerHistory} height={200} />
      </Card>

      {/* hourly + weekly */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <SectionTitle icon="Clock" hint={`${round(state.energy.todayKwh, 2)} kWh so far`}>
            Today, hour by hour
          </SectionTitle>
          <HourlyChart data={state.energy.hourly} currentHour={currentHour} height={230} />
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle icon="BarChart3" hint={`${round(weekTotal, 1)} kWh total`}>
            Last seven days
          </SectionTitle>
          <WeeklyChart data={state.energy.weekly} height={230} />
        </Card>
      </div>

      {/* appliance distribution */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <Card className="p-4 sm:p-5">
          <SectionTitle icon="PieChart" hint="today">
            Appliance distribution
          </SectionTitle>
          <DistributionChart data={dist} height={260} />
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle icon="Layers" hint="share of today's consumption">
            Where the units went
          </SectionTitle>
          <ul className="space-y-2.5">
            {dist.map((d) => (
              <li key={d.id}>
                <div className="flex items-center gap-2.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                  <span className="flex-1 text-[12.5px] font-medium text-mist-100">{d.name}</span>
                  <span className="text-[12px] tabular-nums text-mist-300">{kwh(d.kwh)}</span>
                  <span className="w-12 text-right text-[12px] tabular-nums text-mist-400">{pct(d.value)}</span>
                  <span className="w-14 text-right text-[12px] tabular-nums text-mist-400">
                    {currency(costOf(d.kwh))}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/6">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${d.value}%`, background: d.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-white/6 pt-3 text-[11.5px] text-mist-500">
            Live draw right now:{' '}
            {Object.entries(power.byGroup)
              .filter(([, w]) => w > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([g, w]) => `${g} ${watts(w)}`)
              .join(' · ')}
          </p>
        </Card>
      </div>

      {/* saving opportunities */}
      <section>
        <SectionTitle
          icon="Sprout"
          hint={
            totalMonthlySaving > 0
              ? `up to ${currency(totalMonthlySaving)} a month available`
              : 'nothing wasteful detected'
          }
        >
          Energy Saving Opportunities
        </SectionTitle>

        {opportunities.length === 0 ? (
          <Card className="flex items-center gap-3 p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/25">
              <Icon name="CheckCircle2" size={18} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-mist-100">Nothing is being wasted right now</p>
              <p className="mt-0.5 text-[12px] text-mist-400">
                No idle loads, no cold setpoints, no unnecessary standby draw. I'll flag it the moment that
                changes.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {opportunities.map((o) => (
              <Card key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/25">
                  <Icon name={o.icon} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[13px] font-semibold text-mist-100">{o.title}</h4>
                  <p className="mt-1 text-[12px] leading-relaxed text-mist-400">{o.detail}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <StatusBadge tone="emerald" size="sm" icon="TrendingDown">
                      saves ~{o.savingKwhPerDay} kWh/day
                    </StatusBadge>
                    <StatusBadge tone="amber" size="sm" icon="IndianRupee">
                      ~{currency(o.savingPerMonth)}/month
                    </StatusBadge>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => api.run(o.effect, 'ai', `Applied: ${o.title}`)}
                >
                  {o.actionLabel}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* eco score */}
      <section>
        <SectionTitle icon="Leaf" hint="0-100, decomposed">
          Eco Score
        </SectionTitle>
        <EcoScoreCard detailed />
      </section>

      {/* tariff footnote */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-[11.5px] text-mist-500">
        <span className="flex items-center gap-1.5">
          <Icon name="Info" size={13} /> Tariff model
        </span>
        <span>Energy rate {TARIFF.currency}{TARIFF.ratePerKwh.toFixed(2)} / kWh</span>
        <span>Fixed charge {currency(TARIFF.fixedMonthlyCharge)} / month</span>
        <span>Grid emission factor 0.71 kg CO₂ / kWh</span>
        <span>Baseline comparison home 11.5 kWh / day</span>
      </Card>
    </div>
  )
}
