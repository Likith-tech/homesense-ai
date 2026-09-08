import Icon from './Icon'

/**
 * Shared visual primitives. Everything in HomeSense AI is built from these, so
 * spacing, radii and tone mapping stay identical across all seven pages.
 */

/* ------------------------------------------------------------------- tones */

export const TONES = {
  emerald: {
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/12',
    ring: 'ring-emerald-400/25',
    dot: 'bg-emerald-400',
    bar: 'from-emerald-400 to-teal-300',
    glow: 'shadow-[0_0_28px_-8px_rgba(52,211,153,0.55)]',
    hex: '#34d399',
  },
  lime: {
    text: 'text-lime-300', bg: 'bg-lime-500/12', ring: 'ring-lime-400/25', dot: 'bg-lime-400',
    bar: 'from-lime-400 to-emerald-300', glow: 'shadow-[0_0_28px_-8px_rgba(163,230,53,0.5)]', hex: '#a3e635',
  },
  amber: {
    text: 'text-amber-300', bg: 'bg-amber-500/12', ring: 'ring-amber-400/25', dot: 'bg-amber-400',
    bar: 'from-amber-400 to-orange-300', glow: 'shadow-[0_0_28px_-8px_rgba(251,191,36,0.5)]', hex: '#fbbf24',
  },
  orange: {
    text: 'text-orange-300', bg: 'bg-orange-500/12', ring: 'ring-orange-400/25', dot: 'bg-orange-400',
    bar: 'from-orange-400 to-red-300', glow: 'shadow-[0_0_28px_-8px_rgba(251,146,60,0.5)]', hex: '#fb923c',
  },
  rose: {
    text: 'text-rose-300', bg: 'bg-rose-500/12', ring: 'ring-rose-400/30', dot: 'bg-rose-400',
    bar: 'from-rose-400 to-pink-300', glow: 'shadow-[0_0_30px_-8px_rgba(251,113,133,0.6)]', hex: '#fb7185',
  },
  sky: {
    text: 'text-sky-300', bg: 'bg-sky-500/12', ring: 'ring-sky-400/25', dot: 'bg-sky-400',
    bar: 'from-sky-400 to-cyan-300', glow: 'shadow-[0_0_28px_-8px_rgba(56,189,248,0.5)]', hex: '#38bdf8',
  },
  cyan: {
    text: 'text-cyan-300', bg: 'bg-cyan-500/12', ring: 'ring-cyan-400/25', dot: 'bg-cyan-400',
    bar: 'from-cyan-400 to-teal-300', glow: 'shadow-[0_0_28px_-8px_rgba(34,211,238,0.5)]', hex: '#22d3ee',
  },
  indigo: {
    text: 'text-indigo-300', bg: 'bg-indigo-500/12', ring: 'ring-indigo-400/25', dot: 'bg-indigo-400',
    bar: 'from-indigo-400 to-violet-300', glow: 'shadow-[0_0_28px_-8px_rgba(129,140,248,0.5)]', hex: '#818cf8',
  },
  violet: {
    text: 'text-violet-300', bg: 'bg-violet-500/12', ring: 'ring-violet-400/25', dot: 'bg-violet-400',
    bar: 'from-violet-400 to-fuchsia-300', glow: 'shadow-[0_0_28px_-8px_rgba(167,139,250,0.5)]', hex: '#a78bfa',
  },
  slate: {
    text: 'text-mist-300', bg: 'bg-white/5', ring: 'ring-white/10', dot: 'bg-mist-400',
    bar: 'from-mist-400 to-mist-300', glow: '', hex: '#8494ad',
  },
}

export const tone = (name) => TONES[name] || TONES.slate

export const SEVERITY_TONE = {
  critical: 'rose',
  warning: 'amber',
  info: 'sky',
  success: 'emerald',
}

export const cx = (...parts) => parts.filter(Boolean).join(' ')

/* -------------------------------------------------------------------- card */

export function Card({ className = '', children, glow, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={cx(
        'glass rounded-2xl transition-colors duration-300',
        glow && tone(glow).glow,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ icon, title, subtitle, tone: t = 'slate', action, className = '' }) {
  const c = tone(t)
  return (
    <div className={cx('flex items-start justify-between gap-3', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl ring-1', c.bg, c.ring, c.text)}>
            <Icon name={icon} size={17} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-wide text-mist-100 uppercase">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-mist-400 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({ icon, children, hint, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon && <Icon name={icon} size={17} className="text-mist-400" />}
        <h2 className="text-base font-semibold text-mist-100">{children}</h2>
        {hint && <span className="text-xs text-mist-500">{hint}</span>}
      </div>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------ badges */

export function StatusBadge({ tone: t = 'slate', icon, children, pulse, size = 'md', className = '' }) {
  const c = tone(t)
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full ring-1 font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11.5px]',
        c.bg, c.ring, c.text, className,
      )}
    >
      {pulse ? (
        <span className="relative flex size-1.5">
          <span className={cx('absolute inline-flex size-full rounded-full opacity-75 animate-pulse-ring', c.dot)} />
          <span className={cx('relative inline-flex size-1.5 rounded-full', c.dot)} />
        </span>
      ) : icon ? (
        <Icon name={icon} size={size === 'sm' ? 11 : 12.5} />
      ) : null}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ toggle */

export function Toggle({ checked, onChange, disabled, label, tone: t = 'emerald', size = 'md' }) {
  const c = tone(t)
  const big = size === 'md'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cx(
        'relative shrink-0 rounded-full ring-1 transition-all duration-300 ease-out',
        big ? 'h-6 w-11' : 'h-5 w-9',
        checked ? cx(c.bg.replace('/12', '/25'), c.ring, c.glow) : 'bg-ink-700 ring-white/10',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:ring-white/25',
      )}
    >
      <span
        className={cx(
          'absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ease-out',
          big ? 'size-4.5' : 'size-3.5',
          checked ? cx('bg-white shadow-lg', big ? 'left-6' : 'left-5') : 'bg-mist-400 left-1',
        )}
        style={big ? { width: 18, height: 18 } : { width: 14, height: 14 }}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ button */

const BUTTON_VARIANTS = {
  primary:
    'bg-emerald-400 text-ink-950 hover:bg-emerald-300 font-semibold shadow-[0_10px_30px_-12px_rgba(52,211,153,0.8)]',
  ai: 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400 font-semibold shadow-[0_10px_30px_-12px_rgba(139,92,246,0.9)]',
  danger: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25 font-medium',
  ghost: 'bg-white/5 text-mist-200 ring-1 ring-white/10 hover:bg-white/10 hover:text-mist-100 font-medium',
  subtle: 'text-mist-400 hover:text-mist-100 hover:bg-white/5 font-medium',
}

export function Button({
  variant = 'ghost',
  icon,
  iconRight,
  children,
  className = '',
  size = 'md',
  ...rest
}) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-sm' : 'px-3.5 py-2 text-[13px]',
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.ghost,
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 13 : 15} />}
    </button>
  )
}

/* ------------------------------------------------------------------- meter */

export function Meter({ value, max = 100, tone: t = 'emerald', className = '', height = 'h-1.5' }) {
  const pctValue = Math.max(0, Math.min(100, (value / max) * 100))
  const c = tone(t)
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-white/7', height, className)}>
      <div
        className={cx('h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', c.bar)}
        style={{ width: `${pctValue}%` }}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- stat tile */

export function StatTile({ icon, label, value, unit, hint, tone: t = 'slate', trend, className = '' }) {
  const c = tone(t)
  return (
    <div className={cx('glass rounded-2xl p-4 sm:p-[18px]', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cx('grid size-8 place-items-center rounded-lg ring-1', c.bg, c.ring, c.text)}>
          <Icon name={icon} size={15} />
        </span>
        {trend && (
          <span
            className={cx(
              'inline-flex items-center gap-1 text-[11px] font-medium',
              trend.dir === 'up' ? 'text-rose-300' : trend.dir === 'down' ? 'text-emerald-300' : 'text-mist-400',
            )}
          >
            <Icon name={trend.dir === 'up' ? 'ArrowUpRight' : trend.dir === 'down' ? 'ArrowDownRight' : 'Minus'} size={12} />
            {trend.label}
          </span>
        )}
      </div>
      <p className="mt-3.5 text-[11px] font-medium uppercase tracking-wider text-mist-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-1 font-semibold text-mist-100">
        <span className="text-2xl tabular-nums leading-none sm:text-[26px]">{value}</span>
        {unit && <span className="text-xs font-medium text-mist-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-mist-500">{hint}</p>}
    </div>
  )
}

/* ------------------------------------------------------------ progress ring */

export function ProgressRing({ value, size = 132, stroke = 10, tone: t = 'emerald', children }) {
  const c = tone(t)
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100)
  const gid = `ring-${t}`
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c.hex} />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------- empty state */

export function EmptyState({ icon = 'Boxes', title, detail, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-white/5 text-mist-400 ring-1 ring-white/10">
        <Icon name={icon} size={19} />
      </span>
      <p className="mt-3 text-sm font-medium text-mist-200">{title}</p>
      {detail && <p className="mt-1 max-w-sm text-xs leading-relaxed text-mist-500">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------------- form field */

export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-mist-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-mist-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl bg-ink-850/80 px-3 py-2 text-[13px] text-mist-100 ring-1 ring-white/10 outline-none transition placeholder:text-mist-500 focus:ring-emerald-400/50'

export function Select({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputClass, 'cursor-pointer appearance-none pr-8', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238494ad' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-850 text-mist-100">
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------- modal */

export function Modal({ open, onClose, title, subtitle, icon, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        className={cx(
          'glass-strong relative z-10 my-auto w-full animate-slide-up rounded-t-3xl sm:rounded-3xl',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 p-5">
          <div className="flex items-start gap-3">
            {icon && (
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/25">
                <Icon name={icon} size={17} />
              </span>
            )}
            <div>
              <h3 className="text-[15px] font-semibold text-mist-100">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs text-mist-400">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-mist-400 transition hover:bg-white/5 hover:text-mist-100"
          >
            <Icon name="X" size={17} />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/8 p-4">{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- live pulse */

export function LivePulse({ label = 'Live', tone: t = 'emerald' }) {
  const c = tone(t)
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-mist-400">
      <span className="relative flex size-1.5">
        <span className={cx('absolute inline-flex size-full rounded-full animate-pulse-ring', c.dot)} />
        <span className={cx('relative inline-flex size-1.5 rounded-full', c.dot)} />
      </span>
      {label}
    </span>
  )
}
