import { useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon'
import { Card, cx, tone } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import { computeHomeSenseScore, bandForScore } from '../utils/homeSenseScore'

/**
 * The headline number of the whole app. Recomputed from live state on every
 * render (never stored), so it can never drift from what the rest of the UI
 * shows. A ref tracks the previous reading purely to explain *why* the score
 * just moved — every change listed below the "87 → 93" line is a real pillar
 * delta observed on the live client between two renders, not scripted.
 */
export default function HomeSenseScoreCard() {
  const { state } = useHome()
  const result = computeHomeSenseScore(state)
  const band = bandForScore(result.overall)
  const c = tone(band.tone)

  const prevRef = useRef(null)
  const [change, setChange] = useState(null) // { from, to, moves: [{label, delta, reason}] }
  const [expandedPillar, setExpandedPillar] = useState(null)

  useEffect(() => {
    const prev = prevRef.current
    if (prev && prev.overall !== result.overall) {
      const moves = []
      for (const p of result.pillars) {
        const before = prev.pillars.find((x) => x.id === p.id)
        if (!before) continue
        const delta = p.score - before.score
        if (Math.abs(delta) >= 1) moves.push({ label: p.label, delta: round1(delta), reason: p.reason })
      }
      moves.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      setChange({ from: prev.overall, to: result.overall, moves })
      const t = setTimeout(() => setChange(null), 9000)
      prevRef.current = result
      return () => clearTimeout(t)
    }
    prevRef.current = result
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.overall])

  const expanded = result.pillars.find((p) => p.id === expandedPillar)

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <div className={cx('pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-30 blur-3xl', c.bg)} />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-4">
          <div className="relative grid size-24 shrink-0 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(result.overall / 100) * 264} 264`}
                className={cx('transition-all duration-700', c.text)}
              />
            </svg>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums leading-none text-mist-100">{result.overall}</p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-mist-500">/ 100</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mist-500">HomeSense Score</p>
            <p className={cx('text-lg font-semibold', c.text)}>{band.label}</p>
            {change && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-mist-300">
                <Icon name={change.to >= change.from ? 'TrendingUp' : 'TrendingDown'} size={11} className={change.to >= change.from ? 'text-emerald-300' : 'text-rose-300'} />
                {change.from} → {change.to}
              </p>
            )}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
          {result.pillars.map((p) => {
            const pc = tone(bandForScore(p.score).tone)
            const isOpen = expandedPillar === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setExpandedPillar(isOpen ? null : p.id)}
                className={cx(
                  'rounded-xl bg-white/4 p-2.5 text-left ring-1 transition hover:bg-white/7',
                  isOpen ? cx('ring-1', pc.ring) : 'ring-white/6',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-mist-500">{p.label}</span>
                </div>
                <p className={cx('mt-1 text-lg font-semibold tabular-nums leading-none', pc.text)}>{p.score}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
                  <div className={cx('h-full rounded-full bg-gradient-to-r', pc.bar)} style={{ width: `${p.score}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {expanded && (
        <div className="relative mt-4 flex items-start gap-2 border-t border-white/6 pt-3.5">
          <Icon name="Gauge" size={13} className="mt-0.5 shrink-0 text-sky-300" />
          <p className="text-[11.5px] leading-relaxed text-mist-400">
            <span className="font-medium text-mist-300">
              {expanded.label} {expanded.score}/100 —{' '}
            </span>
            {expanded.reason}
          </p>
        </div>
      )}

      {!expanded && change && change.moves.length > 0 && (
        <div className="relative mt-4 space-y-1 border-t border-white/6 pt-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mist-500">Why the score changed</p>
          {change.moves.map((m) => (
            <p key={m.label} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-mist-400">
              <Icon name={m.delta >= 0 ? 'TrendingUp' : 'TrendingDown'} size={11} className={cx('mt-0.5 shrink-0', m.delta >= 0 ? 'text-emerald-300' : 'text-rose-300')} />
              <span>
                <span className="font-medium text-mist-300">
                  {m.label} {m.delta >= 0 ? '+' : ''}
                  {m.delta}
                </span>{' '}
                — {m.reason}
              </span>
            </p>
          ))}
        </div>
      )}

      {!expanded && !change && result.weakest.score < 75 && (
        <div className="relative mt-4 flex items-start gap-2 border-t border-white/6 pt-3.5">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-[11.5px] leading-relaxed text-mist-400">
            <span className="font-medium text-mist-300">{result.weakest.label} is holding the score back: </span>
            {result.weakest.reason}
          </p>
        </div>
      )}
    </Card>
  )
}

function round1(n) {
  return Math.round(n * 10) / 10
}
