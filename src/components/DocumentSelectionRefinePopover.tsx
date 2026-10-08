import { useEffect, useRef, useState } from 'react'
import { GripVertical, Loader2, Sparkles } from 'lucide-react'
import { isConsultativePrompt } from '../utils/documentLocalRefine'

export interface SelectionAnchorRect {
  top: number
  left: number
  bottom: number
  width: number
  height: number
}

const POPOVER_WIDTH = 320
const POPOVER_GAP = 8
const VIEWPORT_PAD = 8
/** Approximate height used only for viewport clamping while dragging. */
const POPOVER_MIN_HEIGHT = 180

export function selectionRefinePopoverStyle(
  anchor: SelectionAnchorRect,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
  dragOffset: { x: number; y: number } = { x: 0, y: 0 },
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800,
): {
  position: 'fixed'
  top: number
  left: number
  width: number
} {
  const baseLeft = Math.max(
    VIEWPORT_PAD,
    Math.min(anchor.left, viewportWidth - POPOVER_WIDTH - VIEWPORT_PAD),
  )
  const baseTop = anchor.bottom + POPOVER_GAP
  const left = Math.max(
    VIEWPORT_PAD,
    Math.min(baseLeft + dragOffset.x, viewportWidth - POPOVER_WIDTH - VIEWPORT_PAD),
  )
  const top = Math.max(
    VIEWPORT_PAD,
    Math.min(baseTop + dragOffset.y, viewportHeight - POPOVER_MIN_HEIGHT - VIEWPORT_PAD),
  )
  return {
    position: 'fixed',
    top,
    left,
    width: POPOVER_WIDTH,
  }
}

function anchorKey(anchor: SelectionAnchorRect): string {
  return `${anchor.top},${anchor.left},${anchor.bottom},${anchor.width},${anchor.height}`
}

interface DocumentSelectionRefinePopoverProps {
  open: boolean
  selectedPreview: string
  prompt: string
  onPromptChange: (value: string) => void
  busy: boolean
  error: string | null
  answer?: string | null
  disabled?: boolean
  onSubmit: () => void
  onDismiss: () => void
  onApplyAnswerAsRewrite?: () => void
  anchor: SelectionAnchorRect
}

export default function DocumentSelectionRefinePopover({
  open,
  selectedPreview,
  prompt,
  onPromptChange,
  busy,
  error,
  answer = null,
  disabled = false,
  onSubmit,
  onDismiss,
  onApplyAnswerAsRewrite,
  anchor,
}: DocumentSelectionRefinePopoverProps) {
  const asking = isConsultativePrompt(prompt)
  const canSubmit = Boolean(prompt.trim()) && !busy && !disabled
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragSessionRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const lastAnchorKeyRef = useRef(anchorKey(anchor))

  useEffect(() => {
    const nextKey = anchorKey(anchor)
    if (nextKey !== lastAnchorKeyRef.current) {
      lastAnchorKeyRef.current = nextKey
      setDragOffset({ x: 0, y: 0 })
    }
  }, [anchor])

  useEffect(() => {
    if (!open) {
      setDragOffset({ x: 0, y: 0 })
      dragSessionRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onDismiss])

  useEffect(() => {
    if (!open) return

    const onPointerMove = (event: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session) return
      event.preventDefault()
      setDragOffset({
        x: session.originX + (event.clientX - session.startX),
        y: session.originY + (event.clientY - session.startY),
      })
    }

    const onPointerUp = () => {
      dragSessionRef.current = null
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [open])

  if (!open) return null

  return (
    <section
      className="document-selection-refine"
      aria-label="按指令修改选中内容"
      style={selectionRefinePopoverStyle(anchor, undefined, dragOffset)}
    >
      <div
        className="document-selection-refine-head"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          dragSessionRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: dragOffset.x,
            originY: dragOffset.y,
          }
        }}
      >
        <GripVertical size={14} aria-hidden />
        <Sparkles size={14} />
        <span>按指令修改选中内容</span>
      </div>
      <p className="document-selection-refine-preview" title={selectedPreview}>
        {selectedPreview}
      </p>
      <textarea
        className="document-selection-refine-input"
        value={prompt}
        rows={3}
        disabled={busy || disabled}
        placeholder={asking ? '提问后将结合这段作答，不直接改写' : '例如：更正式一点 / 压缩成两句'}
        onChange={(event) => onPromptChange(event.target.value)}
      />
      {answer ? (
        <div className="document-selection-refine-answer">
          <span>回答</span>
          <p>{answer}</p>
          {onApplyAnswerAsRewrite ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy || disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onApplyAnswerAsRewrite}
            >
              按此思路改写选中内容
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="document-selection-refine-error">{error}</p> : null}
      <button
        type="button"
        className="btn btn-sm btn-primary document-selection-refine-submit"
        disabled={!canSubmit}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSubmit}
      >
        {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
        {busy ? (asking ? '分析中…' : '优化中…') : asking ? '提问分析' : '应用'}
      </button>
    </section>
  )
}
