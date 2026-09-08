import Icon from './ui/Icon'
import { cx, tone } from './ui/primitives'
import { useHome } from '../context/HomeContext'

const TOAST_STYLE = {
  success: { tone: 'emerald', icon: 'CheckCircle2' },
  info: { tone: 'sky', icon: 'Info' },
  warning: { tone: 'amber', icon: 'AlertTriangle' },
  error: { tone: 'rose', icon: 'CircleAlert' },
  ai: { tone: 'violet', icon: 'Sparkles' },
}

export default function ToastHost() {
  const { toasts, api } = useHome()
  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => {
        const style = TOAST_STYLE[t.tone] || TOAST_STYLE.info
        const c = tone(style.tone)
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => api.dismissToast(t.id)}
            className={cx(
              'glass-strong pointer-events-auto flex w-full max-w-md animate-slide-up items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition hover:brightness-110',
              c.ring,
            )}
          >
            <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', c.bg, c.text)}>
              <Icon name={style.icon} size={15} />
            </span>
            <span className="flex-1 text-[13px] leading-snug text-mist-100">{t.message}</span>
            <Icon name="X" size={14} className="shrink-0 text-mist-500" />
          </button>
        )
      })}
    </div>
  )
}
