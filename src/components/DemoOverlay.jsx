import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { Button, cx } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { DEMO_STEPS, resolveNarration } from '../utils/demo'

/**
 * The guided-demo HUD. It reports what the engine is doing, it does not drive
 * it — every value it shows is read back out of live state.
 */
export default function DemoOverlay() {
  const { state, api, dispatch } = useHome()
  const running = state.demo.running
  const index = state.demo.step
  const step = DEMO_STEPS[index]

  // Progress is stamped with the step it was measured for, so a stale reading
  // from the previous step can never bleed into the new one. That keeps the
  // reset out of the effect body and keeps render free of Date.now().
  const [progress, setProgress] = useState({ step: -1, elapsed: 0 })
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(
      () => setProgress({ step: index, elapsed: Date.now() - state.demo.stepStartedAt }),
      120,
    )
    return () => clearInterval(id)
  }, [running, index, state.demo.stepStartedAt])

  if (!running || !step) return null

  const elapsed = progress.step === index ? progress.elapsed : 0
  const duration = Math.max(step.minMs ?? 4000, 1)
  const stepPct = Math.min(100, (elapsed / duration) * 100)
  const overall = ((index + Math.min(1, elapsed / duration)) / DEMO_STEPS.length) * 100

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] p-3 sm:p-5">
      <div className="glass-strong pointer-events-auto mx-auto max-w-4xl animate-slide-up overflow-hidden rounded-3xl ring-1 ring-violet-400/25">
        {/* overall progress */}
        <div className="h-1 w-full bg-white/6">
          <div
            className="h-full bg-gradient-to-r from-violet-400 via-indigo-400 to-emerald-400 transition-[width] duration-200 ease-linear"
            style={{ width: `${overall}%` }}
          />
        </div>

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
          <div className="flex items-center gap-3 sm:flex-col sm:items-start">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 ring-1 ring-violet-400/35">
              <Icon name="Sparkles" size={18} className="text-violet-200" />
              <span className="absolute inset-0 animate-pulse-ring rounded-2xl ring-2 ring-violet-400/40" />
            </span>
            <div className="sm:hidden">
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-violet-300">
                Guided demo · step {step.id} of {DEMO_STEPS.length}
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="hidden text-[10.5px] font-semibold uppercase tracking-widest text-violet-300 sm:block">
              Guided demo · step {step.id} of {DEMO_STEPS.length}
            </p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-mist-100 sm:text-base">{step.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">
              {resolveNarration(step, state)}
            </p>

            {/* step rail */}
            <div className="mt-3 flex gap-1">
              {DEMO_STEPS.map((s, i) => (
                <div
                  key={s.id}
                  title={`${s.id}. ${s.title}`}
                  className={cx(
                    'h-1 flex-1 overflow-hidden rounded-full transition-colors duration-300',
                    i < index ? 'bg-emerald-400/70' : i === index ? 'bg-white/15' : 'bg-white/6',
                  )}
                >
                  {i === index && (
                    <div
                      className="h-full rounded-full bg-violet-300 transition-[width] duration-200 ease-linear"
                      style={{ width: `${stepPct}%` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon="MoveRight"
              onClick={() =>
                index + 1 >= DEMO_STEPS.length
                  ? api.stopDemo()
                  : dispatch({ type: 'DEMO_STEP', index: index + 1 })
              }
            >
              Skip
            </Button>
            <Button variant="danger" size="sm" icon="Square" onClick={api.stopDemo}>
              Stop
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
