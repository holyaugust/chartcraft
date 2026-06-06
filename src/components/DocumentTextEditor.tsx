import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildEditorDisplayHtml, scrollEditorToIssueRange, type TextHighlightRange } from '../utils/documentLocate'

interface DocumentTextEditorProps {
  value: string
  onChange: (value: string) => void
  highlightRange: TextHighlightRange | null
  aiHighlightRanges?: TextHighlightRange[]
  className?: string
  placeholder?: string
  editorRef?: React.RefObject<HTMLTextAreaElement | null>
}

export default function DocumentTextEditor({
  value,
  onChange,
  highlightRange,
  aiHighlightRanges = [],
  className = '',
  placeholder,
  editorRef,
}: DocumentTextEditorProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const textareaRef = editorRef ?? innerRef

  const displayHtml = useMemo(
    () => buildEditorDisplayHtml(value, highlightRange, aiHighlightRanges),
    [value, highlightRange, aiHighlightRanges],
  )

  const hasAiHighlight = aiHighlightRanges.some((range) => range.start < range.end)
  const highlightMode = highlightRange
    ? highlightRange.adopted
      ? 'proofread-adopted'
      : 'proofread-pending'
    : hasAiHighlight
      ? 'ai-write'
      : null

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
        highlightMode === 'proofread-pending'
          ? ' is-highlighting is-highlighting-pending'
          : highlightMode === 'proofread-adopted'
            ? ' is-highlighting is-highlighting-adopted'
            : highlightMode === 'ai-write'
              ? ' is-highlighting is-highlighting-ai'
              : ''
      }`.trim()}
    >
      <div ref={backdropRef} className="document-editor-backdrop" aria-hidden="true">
        <pre className="document-editor-backdrop-inner" dangerouslySetInnerHTML={{ __html: displayHtml }} />
      </div>
      <textarea
        ref={textareaRef}
        className={`document-editor document-editor-ghost${highlightMode ? ' document-editor-highlighting' : ''}`}
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
