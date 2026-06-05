import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildHighlightedHtml, scrollEditorToIssueRange, type TextHighlightRange } from '../utils/documentLocate'

interface DocumentTextEditorProps {
  value: string
  onChange: (value: string) => void
  highlightRange: TextHighlightRange | null
  className?: string
  placeholder?: string
  editorRef?: React.RefObject<HTMLTextAreaElement | null>
}

export default function DocumentTextEditor({
  value,
  onChange,
  highlightRange,
  className = '',
  placeholder,
  editorRef,
}: DocumentTextEditorProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const textareaRef = editorRef ?? innerRef

  const highlightedHtml = useMemo(
    () => buildHighlightedHtml(value, highlightRange),
    [value, highlightRange],
  )

  const syncBackdropScroll = useCallback(() => {
    const textarea = textareaRef.current
    const backdrop = backdropRef.current
    if (!textarea || !backdrop) return
    backdrop.scrollTop = textarea.scrollTop
    backdrop.scrollLeft = textarea.scrollLeft
  }, [textareaRef])

  useEffect(() => {
    const textarea = textareaRef.current
    const backdrop = backdropRef.current
    if (!textarea) return

    if (highlightRange) {
      textarea.setSelectionRange(highlightRange.start, highlightRange.start)

      const runScroll = () => {
        scrollEditorToIssueRange(textarea, highlightRange.start, highlightRange.end, backdrop)
      }

      runScroll()
      window.requestAnimationFrame(() => {
        runScroll()
        syncBackdropScroll()
      })
      return
    }

    syncBackdropScroll()
  }, [highlightRange, value, syncBackdropScroll, textareaRef])

  return (
    <div
      className={`document-editor-wrap ${className}${
        highlightRange
          ? highlightRange.adopted
            ? ' is-highlighting is-highlighting-adopted'
            : ' is-highlighting is-highlighting-pending'
          : ''
      }`.trim()}
    >
      <div ref={backdropRef} className="document-editor-backdrop" aria-hidden="true">
        <pre className="document-editor-backdrop-inner" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </div>
      <textarea
        ref={textareaRef}
        className={`document-editor${highlightRange ? ' document-editor-highlighting' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncBackdropScroll}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}

export type { TextHighlightRange }
