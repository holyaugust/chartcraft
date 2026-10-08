import { useEffect } from 'react'
import { MousePointerClick, X } from 'lucide-react'
import { saveSelectionRefineHintDismissed } from '../utils/documentSelectionRefineHint'

const AUTO_DISMISS_MS = 6000

interface DocumentSelectionRefineHintProps {
  open: boolean
  onDismiss: () => void
}

export default function DocumentSelectionRefineHint({
  open,
  onDismiss,
}: DocumentSelectionRefineHintProps) {
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      saveSelectionRefineHintDismissed()
      onDismiss()
    }, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [open, onDismiss])

  if (!open) return null

  const dismiss = () => {
    saveSelectionRefineHintDismissed()
    onDismiss()
  }

  return (
    <aside className="document-selection-refine-hint" aria-label="选区改写提示" role="status">
      <MousePointerClick size={16} aria-hidden />
      <p>选中一段文字，即可按你的指令改写</p>
      <button type="button" className="btn btn-sm btn-ghost" onClick={dismiss}>
        知道了
      </button>
      <button
        type="button"
        className="document-selection-refine-hint-close"
        aria-label="关闭提示"
        onClick={dismiss}
      >
        <X size={14} />
      </button>
    </aside>
  )
}
