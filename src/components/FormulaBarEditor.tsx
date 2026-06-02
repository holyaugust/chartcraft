import type { Ref } from 'react'
import FormulaOverlayInput from './FormulaOverlayInput'

interface FormulaBarEditorProps {
  value: string
  disabled?: boolean
  placeholder?: string
  inputRef?: Ref<HTMLInputElement>
  onChange: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export default function FormulaBarEditor(props: FormulaBarEditorProps) {
  return (
    <FormulaOverlayInput
      {...props}
      className="formula-bar-input"
      wrapClassName="formula-bar-input-wrap"
      highlightClassName="formula-bar-highlight"
    />
  )
}
