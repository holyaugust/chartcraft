import { useMemo, type CSSProperties, type ReactNode, type Ref } from 'react'
import { FORMULA_REF_COLORS, isFormula, parseFormulaReferences, type FormulaReference } from '../utils/formulaEngine'

export function renderColoredFormula(formula: string, refs: FormulaReference[]) {
  if (!refs.length) return formula

  const parts: ReactNode[] = []
  let last = 0

  for (const ref of refs) {
    if (ref.start > last) {
      parts.push(<span key={`t-${last}`}>{formula.slice(last, ref.start)}</span>)
    }
    const color = FORMULA_REF_COLORS[ref.colorIndex]
    parts.push(
      <span
        key={`r-${ref.start}`}
        className="formula-ref-token"
        style={{ color: color.border, backgroundColor: color.bg }}
      >
        {formula.slice(ref.start, ref.end)}
      </span>,
    )
    last = ref.end
  }

  if (last < formula.length) {
    parts.push(<span key={`t-${last}`}>{formula.slice(last)}</span>)
  }

  return parts
}

interface FormulaOverlayInputProps {
  value: string
  disabled?: boolean
  placeholder?: string
  inputRef?: Ref<HTMLInputElement>
  onChange: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
  wrapClassName?: string
  highlightClassName?: string
  style?: CSSProperties
  highlightStyle?: CSSProperties
}

export default function FormulaOverlayInput({
  value,
  disabled,
  placeholder,
  inputRef,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  className = '',
  wrapClassName = 'formula-bar-input-wrap',
  highlightClassName = 'formula-bar-highlight',
  style,
  highlightStyle,
}: FormulaOverlayInputProps) {
  const refs = useMemo(
    () => (isFormula(value) ? parseFormulaReferences(value) : []),
    [value],
  )

  const showHighlight = !disabled && isFormula(value) && refs.length > 0

  return (
    <div className={wrapClassName}>
      {showHighlight && (
        <div className={highlightClassName} style={highlightStyle} aria-hidden="true">
          {renderColoredFormula(value, refs)}
        </div>
      )}
      <input
        ref={inputRef}
        className={`${className}${showHighlight ? ' formula-input-overlay' : ''}`}
        style={style}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
    </div>
  )
}
