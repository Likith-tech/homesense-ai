import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon'
import { cx, StatusBadge, LivePulse } from '../ui/primitives'
import { useHome } from '../../context/HomeContext'
import { APP } from '../../data/constants'
import { watts, kwh } from '../../utils/format'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'LayoutDashboard', end: true },
  { to: '/rooms', label: 'Rooms', icon: 'Sofa' },
  { to: '/devices', label: 'Devices', icon: 'Boxes' },
  { to: '/energy', label: 'Energy', icon: 'Zap' },
  { to: '/automations', label: 'Automations', icon: 'Workflow' },
  { to: '/security', label: 'Security', icon: 'ShieldCheck' },
  { to: '/assistant', label: 'AI Assistant', icon: 'Sparkles' },
  { to: '/about', label: 'About', icon: 'Info' },
]

function NavItem({ item, onNavigate, badge }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200',
          isActive
            ? 'bg-white/8 text-mist-100 ring-1 ring-white/10'
            : 'text-mist-400 hover:bg-white/4 hover:text-mist-200',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cx(
              'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-400 transition-all duration-300',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon
            name={item.icon}
            size={17}
            className={cx('transition-colors', isActive ? 'text-emerald-300' : 'text-mist-500 group-hover:text-mist-300')}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {badge}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ onNavigate }) {
  const { state, power, eco, insights } = useHome()
  const alerting = state.security.status === 'alert' && !state.security.acknowledged
  const actionable = insights.filter((i) => i.severity === 'critical' || i.severity === 'warning').length

  return (
    <div className="flex h-full flex-col gap-5 p-4">
      {/* brand */}
      <div className="flex items-center gap-3 px-2 pt-2">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400/25 to-cyan-400/10 ring-1 ring-emerald-400/30">
          <Icon name="House" size={19} className="text-emerald-300" />
          <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-violet-500 ring-2 ring-ink-900">
            <Icon name="Sparkles" size={9} className="text-white" />
          </span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-mist-100">{APP.name}</p>
          <LivePulse label="Simulation running" />
        </div>
      </div>

      {/* navigation */}
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            onNavigate={onNavigate}
            badge={
              item.to === '/security' && alerting ? (
                <StatusBadge tone="rose" size="sm" pulse>
                  Alert
                </StatusBadge>
              ) : item.to === '/' && actionable > 0 ? (
                <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold text-mist-300">
                  {actionable}
                </span>
              ) : null
            }
          />
        ))}
      </nav>

      {/* live summary */}
      <div className="mt-auto space-y-2.5">
        <div className="glass rounded-2xl p-3.5">
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-mist-500">Live household load</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-mist-100">{watts(power.total)}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-mist-500">
            <span>{kwh(state.energy.todayKwh)} today</span>
            <span>{power.active} active</span>
          </div>
        </div>

        <div className="glass rounded-2xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-mist-500">Eco score</p>
            <Icon name="Leaf" size={13} className="text-emerald-300" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold tabular-nums text-mist-100">{eco.score}</span>
            <span className="text-[11px] text-mist-500">/ 100 · {eco.band.label}</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-[width] duration-700"
              style={{ width: `${eco.score}%` }}
            />
          </div>
        </div>

        <p className="px-1 text-[10px] leading-relaxed text-mist-500">
          Simulated IoT · no hardware connected · v{APP.version}
        </p>
      </div>
    </div>
  )
}
