import { Loader2 } from 'lucide-react'

interface DocumentProofreadBusyOverlayProps {
  open: boolean
  message: string
}

export default function DocumentProofreadBusyOverlay({
  open,
  message,
}: DocumentProofreadBusyOverlayProps) {
  if (!open) return null

  return (
    <div
      className="document-proofread-busy-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="document-proofread-busy-card">
        <Loader2 size={28} className="spin" aria-hidden />
        <p className="document-proofread-busy-title">{message}</p>
        <p className="document-proofread-busy-hint">请稍候，完成后结果将显示在右侧</p>
      </div>
    </div>
  )
}
