import { useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import { Button, StatusBadge, cx, tone } from '../ui/primitives'
import { useHome } from '../../context/HomeContext'
import { HOME_MODES, SECURITY_STATUS } from '../../data/constants'
import { clock, dateLabel, watts } from '../../utils/format'
import { NAV_ITEMS } from './Sidebar'

const MODE_ICONS = { home: 'House', away: 'MapPin', night: 'Moon' }

function ModeSwitcher() {
  const { state, api } = useHome()
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-ink-850/70 p-1 ring-1 ring-white/8">
      {Object.values(HOME_MODES).map((m) => {
        const active = state.homeMode === m.id
        const c = tone(m.tone)
        return (
          <button
            key={m.id}
            type="button"
            title={m.description}
            onClick={() => api.setHomeMode(m.id)}
            className={cx(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-200',
              active ? cx(c.bg, c.text, 'ring-1', c.ring) : 'text-mist-500 hover:text-mist-200',
            )}
          >
            <Icon name={MODE_ICONS[m.id]} size={13} />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function TopBar({ onOpenNav }) {
  const { state, power, api } = useHome()
  const { pathname } = useLocation()
  const current = NAV_ITEMS.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))
  const sec = SECURITY_STATUS[state.security.status] ?? SECURITY_STATUS.secure
  const alerting = state.security.status === 'alert' && !state.security.acknowledged

  return (
    <header className="sticky top-0 z-30 border-b border-white/6 bg-ink-950/75 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="rounded-xl p-2 text-mist-300 ring-1 ring-white/10 transition hover:bg-white/5 lg:hidden"
        >
          <Icon name="Menu" size={18} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold text-mist-100 sm:text-base">
            {current?.label ?? 'HomeSense AI'}
          </h1>
          <p className="hidden text-[11.5px] text-mist-500 sm:block">
            {dateLabel(state.simTime)} · simulated clock {clock(state.simTime)}
          </p>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <StatusBadge tone={power.total > 1800 ? 'amber' : 'emerald'} icon="Zap">
            {watts(power.total)}
          </StatusBadge>
          <StatusBadge tone={sec.tone} icon={alerting ? 'ShieldAlert' : 'ShieldCheck'} pulse={alerting}>
            {sec.label}
          </StatusBadge>
        </div>

        <ModeSwitcher />

        {/*
          One button, responsive label. Two buttons with `hidden`/`sm:hidden`
          would collide with Button's own `inline-flex` base class — equal
          specificity, so stylesheet order decides and both end up visible.
          A plain <span> carries no base display, so hiding it is safe.
        */}
        <Button
          variant={state.demo.running ? 'danger' : 'ai'}
          icon={state.demo.running ? 'Square' : 'Play'}
          onClick={() => (state.demo.running ? api.stopDemo() : api.startDemo())}
          aria-label={state.demo.running ? 'Stop demo' : 'Start demo'}
        >
          <span className="hidden sm:inline">
            {state.demo.running ? 'Stop demo' : 'Start Demo'}
          </span>
        </Button>
      </div>

      {/* compact live strip for small screens */}
      <div className="flex items-center gap-2 overflow-x-auto border-t border-white/5 px-4 py-2 no-scrollbar md:hidden">
        <StatusBadge tone={power.total > 1800 ? 'amber' : 'emerald'} icon="Zap" size="sm">
          {watts(power.total)}
        </StatusBadge>
        <StatusBadge tone={sec.tone} icon={alerting ? 'ShieldAlert' : 'ShieldCheck'} size="sm" pulse={alerting}>
          {sec.label}
        </StatusBadge>
        <StatusBadge tone="slate" icon="Clock" size="sm">
          {clock(state.simTime)}
        </StatusBadge>
        <StatusBadge tone="slate" icon="Boxes" size="sm">
          {power.active} active
        </StatusBadge>
      </div>
    </header>
  )
}
