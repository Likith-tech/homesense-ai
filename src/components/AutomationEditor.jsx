import { useState } from 'react'
import Icon from './ui/Icon'
import { Button, Modal, Select, Field, inputClass, cx } from './ui/primitives'
import { useHome } from '../context/HomeContext'
import {
  CONDITION_TYPES,
  CONDITION_MAP,
  ACTION_TYPES,
  ACTION_MAP,
  defaultCondition,
  defaultAction,
  blankAutomation,
  describeAutomation,
  DEVICE_OPTIONS,
  AC_OPTIONS,
  ROOM_OPTIONS,
  MODE_OPTIONS,
} from '../utils/automations'

/** Renders the right input for one field of a condition or action. */
function DynamicField({ field, value, onChange }) {
  switch (field.kind) {
    case 'room':
      return <Select value={value} onChange={onChange} options={ROOM_OPTIONS} />
    case 'device':
      return <Select value={value} onChange={onChange} options={DEVICE_OPTIONS} />
    case 'ac':
      return <Select value={value} onChange={onChange} options={AC_OPTIONS} />
    case 'mode':
      return <Select value={value} onChange={onChange} options={MODE_OPTIONS} />
    case 'number':
      return (
        <input
          type="number"
          className={inputClass}
          value={value ?? ''}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )
    case 'text':
    default:
      return (
        <input
          type="text"
          className={inputClass}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

function RuleRow({ index, kind, item, types, typeMap, onChange, onRemove, canRemove }) {
  const def = typeMap[item.type]
  const fields = def?.fields ?? []
  const accent = kind === 'if' ? 'sky' : 'emerald'

  return (
    <div className="rounded-xl bg-ink-850/60 p-3 ring-1 ring-white/6">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cx(
            'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
            accent === 'sky' ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300',
          )}
        >
          {kind === 'if' ? (index === 0 ? 'If' : 'And') : index === 0 ? 'Then' : 'Also'}
        </span>
        <div className="min-w-0 flex-1">
          <Select
            value={item.type}
            onChange={(type) =>
              onChange(kind === 'if' ? defaultCondition(type) : defaultAction(type))
            }
            options={types.map((t) => ({ value: t.id, label: t.label }))}
          />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-mist-500 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} className={f.kind === 'text' ? 'col-span-2' : ''}>
              <DynamicField
                field={f}
                value={item[f.key]}
                onChange={(v) => onChange({ ...item, [f.key]: v })}
              />
            </Field>
          ))}
        </div>
      )}
    </div>
  )
}

/** Deep-enough clone so editing a draft can never mutate the live rule. */
function cloneRule(rule) {
  if (!rule) return blankAutomation()
  return {
    ...rule,
    conditions: rule.conditions.map((c) => ({ ...c })),
    actions: rule.actions.map((a) => ({ ...a })),
  }
}

/**
 * The parent mounts this only while the dialog is open, and keys it by rule id,
 * so the draft is rebuilt by React rather than reset from an effect.
 */
export default function AutomationEditor({ rule, onClose }) {
  const { api } = useHome()
  const [draft, setDraft] = useState(() => cloneRule(rule))
  const [error, setError] = useState('')

  const patch = (p) => setDraft((d) => ({ ...d, ...p }))
  const preview = describeAutomation(draft)

  const save = () => {
    if (!draft.name.trim()) return setError('Give the rule a name so you can recognise it later.')
    if (!draft.conditions.length) return setError('Add at least one condition.')
    if (!draft.actions.length) return setError('Add at least one action.')

    api.saveAutomation({ ...draft, name: draft.name.trim(), wasTrue: false })
    api.toast(`Automation "${draft.name.trim()}" saved`, 'success')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      icon="Workflow"
      title={rule ? 'Edit automation' : 'New automation'}
      subtitle="Rules are edge-triggered: they fire once when the condition becomes true."
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="Save" onClick={save}>
            {rule ? 'Save changes' : 'Create automation'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              type="text"
              className={inputClass}
              value={draft.name}
              placeholder="e.g. Cool the living room"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Description" hint="Optional — shows on the rule card.">
            <input
              type="text"
              className={inputClass}
              value={draft.description}
              placeholder="What this rule is for"
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>
        </div>

        {/* conditions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-mist-400">Conditions</h4>
            {draft.conditions.length > 1 && (
              <div className="flex items-center gap-1 rounded-lg bg-ink-850 p-0.5 ring-1 ring-white/8">
                {['all', 'any'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => patch({ match: m })}
                    className={cx(
                      'rounded-md px-2 py-1 text-[11px] font-medium transition',
                      draft.match === m ? 'bg-white/10 text-mist-100' : 'text-mist-500 hover:text-mist-300',
                    )}
                  >
                    Match {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {draft.conditions.map((c, i) => (
              <RuleRow
                key={i}
                index={i}
                kind="if"
                item={c}
                types={CONDITION_TYPES}
                typeMap={CONDITION_MAP}
                canRemove={draft.conditions.length > 1}
                onChange={(next) =>
                  patch({ conditions: draft.conditions.map((x, j) => (j === i ? next : x)) })
                }
                onRemove={() => patch({ conditions: draft.conditions.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
          <Button
            variant="subtle"
            size="sm"
            icon="Plus"
            className="mt-2"
            onClick={() => patch({ conditions: [...draft.conditions, defaultCondition('home_mode_is')] })}
          >
            Add condition
          </Button>
        </div>

        {/* actions */}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mist-400">Actions</h4>
          <div className="space-y-2">
            {draft.actions.map((a, i) => (
              <RuleRow
                key={i}
                index={i}
                kind="then"
                item={a}
                types={ACTION_TYPES}
                typeMap={ACTION_MAP}
                canRemove={draft.actions.length > 1}
                onChange={(next) => patch({ actions: draft.actions.map((x, j) => (j === i ? next : x)) })}
                onRemove={() => patch({ actions: draft.actions.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
          <Button
            variant="subtle"
            size="sm"
            icon="Plus"
            className="mt-2"
            onClick={() => patch({ actions: [...draft.actions, defaultAction('DEVICE_OFF')] })}
          >
            Add action
          </Button>
        </div>

        {/* live preview */}
        <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-transparent p-3.5 ring-1 ring-violet-400/20">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Icon name="Eye" size={13} className="text-violet-300" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">Preview</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-mist-200">
            <span className="text-sky-300">IF</span> {preview.when}{' '}
            <span className="text-emerald-300">THEN</span> {preview.then}
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300 ring-1 ring-rose-400/25">
            <Icon name="AlertTriangle" size={14} />
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
