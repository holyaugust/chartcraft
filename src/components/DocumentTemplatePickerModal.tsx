import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LayoutTemplate, X } from 'lucide-react'
import DocumentTemplateLibrary from './DocumentTemplateLibrary'
import type { DocumentTemplate } from '../data/documentTemplates'
import { DOCUMENT_TEMPLATES } from '../data/documentTemplates'

interface DocumentTemplatePickerModalProps {
  open: boolean
  activeTemplateId?: string | null
  onClose: () => void
  onApply: (template: DocumentTemplate) => void
  onSelect?: (template: DocumentTemplate) => void
}

export default function DocumentTemplatePickerModal({
  open,
  activeTemplateId,
  onClose,
  onApply,
  onSelect,
}: DocumentTemplatePickerModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="doc-template-overlay" role="presentation" onClick={onClose}>
      <div
        className="doc-template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-template-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="doc-template-modal-header">
          <div className="doc-template-modal-brand">
            <span className="doc-template-modal-icon" aria-hidden="true">
              <LayoutTemplate size={20} />
            </span>
            <div>
              <h2 id="doc-template-modal-title">职场公文模板库</h2>
              <p>共 {DOCUMENT_TEMPLATES.length} 套 · 七大类 · 点击卡片选用</p>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-icon-only" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <DocumentTemplateLibrary
          layout="modal"
          activeTemplateId={activeTemplateId}
          onApply={(template) => {
            onApply(template)
            onClose()
          }}
          onSelect={onSelect}
        />
      </div>
    </div>,
    document.body,
  )
}
