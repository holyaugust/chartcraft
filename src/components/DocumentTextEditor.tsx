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
  onSelectionChange?: (selection: { start: number; end: number; text: string } | null) => void
}

export default function DocumentTextEditor({
  value,
  onChange,
  highlightRange,
  aiHighlightRanges = [],
  className = '',
  placeholder,
  editorRef,
  onSelectionChange,
}: DocumentTextEditorProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const textareaRef = editorRef ?? innerRef

  const displayHtml = useMemo(
    () => buildEditorDisplayHtml(value, highlightRange, aiHighlightRanges),
    [value, highlightRange, aiHighlightRanges],
  )

  const hasAiHighlight = aiHighlightRanges.some((range) => range.start < range.end)
  const hasAdoptedAiHighlight = aiHighlightRanges.some(
    (range) => range.adopted && range.start < range.end,
  )
  const highlightMode = highlightRange
    ? highlightRange.adopted
      ? 'proofread-adopted'
      : 'proofread-pending'
    : hasAdoptedAiHighlight
      ? 'proofread-adopted'
      : hasAiHighlight
        ? 'ai-write'
        : null

  const syncBackdropMetrics = useCallback(() => {
    const textarea = textareaRef.current
    const backdrop = backdropRef.current
    if (!textarea || !backdrop) return
    // 滚动条占宽会使 textarea 内容区变窄；高亮层必须同步缩进，否则换行/光标错位
    const scrollbarWidth = Math.max(0, textarea.offsetWidth - textarea.clientWidth)
    backdrop.style.right = `${scrollbarWidth}px`
    backdrop.scrollTop = textarea.scrollTop
    backdrop.scrollLeft = textarea.scrollLeft
  }, [textareaRef])

  const syncBackdropScroll = useCallback(() => {
    syncBackdropMetrics()
  }, [syncBackdropMetrics])

  const emitSelection = useCallback(() => {
    if (!onSelectionChange) return
    const textarea = textareaRef.current
    if (!textarea) {
      onSelectionChange(null)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (end <= start) {
      onSelectionChange(null)
      return
    }
    onSelectionChange({
      start,
      end,
      text: value.slice(start, end),
    })
  }, [onSelectionChange, textareaRef, value])

  useEffect(() => {
    if (!onSelectionChange) return
    const textarea = textareaRef.current
    if (!textarea) return

    const onSelectionChangeEvent = () => {
      if (document.activeElement !== textarea) return
      emitSelection()
    }

    document.addEventListener('selectionchange', onSelectionChangeEvent)
    return () => document.removeEventListener('selectionchange', onSelectionChangeEvent)
  }, [emitSelection, onSelectionChange, textareaRef])

  useEffect(() => {
    const textarea = textareaRef.current
    const backdrop = backdropRef.current
    if (!textarea) return

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncBackdropMetrics()) : null
    ro?.observe(textarea)
    window.addEventListener('resize', syncBackdropMetrics)

    if (highlightRange) {
      textarea.setSelectionRange(highlightRange.start, highlightRange.end)

      const runScroll = () => {
        scrollEditorToIssueRange(textarea, highlightRange.start, highlightRange.end, backdrop)
      }

      // 连续两帧：第一帧应对布局未稳定；第二帧应对上方 locateHint 插入后高度变化
      runScroll()
      window.requestAnimationFrame(() => {
        runScroll()
        window.requestAnimationFrame(() => {
          runScroll()
          syncBackdropMetrics()
        })
      })
    } else {
      syncBackdropMetrics()
    }

    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', syncBackdropMetrics)
    }
  }, [highlightRange, value, displayHtml, syncBackdropMetrics, textareaRef])

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
        onSelect={emitSelection}
        onKeyUp={emitSelection}
        onMouseUp={emitSelection}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}

export type { TextHighlightRange }
