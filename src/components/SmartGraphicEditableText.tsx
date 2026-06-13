import { useEffect, useRef } from 'react'
import type { SmartGraphicElementId } from '../utils/smartGraphicEdit'

interface SmartGraphicEditableTextProps {
  elementId: SmartGraphicElementId
  value: string
  className?: string
  tag?: 'span' | 'h2' | 'h4' | 'p' | 'strong'
  multiline?: boolean
  editable?: boolean
  selectedElement?: SmartGraphicElementId | null
  onSelect?: (elementId: SmartGraphicElementId | null) => void
  onChange?: (elementId: SmartGraphicElementId, value: string) => void
}

export default function SmartGraphicEditableText({
  elementId,
  value,
  className = '',
  tag: Tag = 'span',
  multiline = false,
  editable = false,
  selectedElement,
  onSelect,
  onChange,
}: SmartGraphicEditableTextProps) {
  const ref = useRef<HTMLElement>(null)
  const isSelected = selectedElement === elementId
  const isEditing = editable && isSelected

  useEffect(() => {
    if (isEditing || !ref.current) return
    if (ref.current.textContent !== value) {
      ref.current.textContent = value
    }
  }, [value, isEditing])

  useEffect(() => {
    if (!isEditing || !ref.current) return
    ref.current.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(ref.current)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [isEditing])

  if (!editable) {
    return <Tag className={className}>{value}</Tag>
  }

  const commit = () => {
    const next = ref.current?.textContent?.trim() ?? ''
    if (next !== value) onChange?.(elementId, next)
  }

  return (
    <Tag
      ref={ref as never}
      className={`sg-editable-text${isSelected ? ' is-selected' : ''}${isEditing ? ' is-editing' : ''} ${className}`.trim()}
      contentEditable={isEditing}
      suppressContentEditableWarning
      title="点击选中，再次点击编辑"
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.(elementId)
      }}
      onBlur={() => {
        if (isEditing) commit()
      }}
      onKeyDown={(event) => {
        if (!isEditing) return
        if (event.key === 'Enter' && !multiline) {
          event.preventDefault()
          commit()
          ;(event.target as HTMLElement).blur()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          if (ref.current) ref.current.textContent = value
          ;(event.target as HTMLElement).blur()
        }
      }}
    >
      {value}
    </Tag>
  )
}
