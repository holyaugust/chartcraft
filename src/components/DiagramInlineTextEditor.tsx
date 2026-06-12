import { useEffect, useRef } from 'react'

export interface DiagramInlineTextEditorProps {
  left: number
  top: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}

export default function DiagramInlineTextEditor({
  left,
  top,
  width,
  height,
  fontSize,
  fontFamily,
  fontWeight,
  color,
  textAlign,
  value,
  onChange,
  onCommit,
  onCancel,
}: DiagramInlineTextEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.select()
  }, [])

  return (
    <textarea
      ref={inputRef}
      className="diagram-inline-text-editor"
      style={{
        left,
        top,
        width,
        height,
        fontSize,
        fontFamily,
        fontWeight,
        color,
        textAlign,
      }}
      value={value}
      rows={1}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          onCommit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onBlur={() => {
        window.setTimeout(() => {
          if (!inputRef.current || document.activeElement === inputRef.current) return
          onCommit()
        }, 120)
      }}
    />
  )
}
