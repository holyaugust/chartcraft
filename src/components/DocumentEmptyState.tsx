import { FileText, LayoutTemplate, Upload, Wand2 } from 'lucide-react'

interface DocumentEmptyStateProps {
  busy: boolean
  onWrite: () => void
  onUpload: () => void
  onBrowseTemplates: () => void
}

export default function DocumentEmptyState({
  busy,
  onWrite,
  onUpload,
  onBrowseTemplates,
}: DocumentEmptyStateProps) {
  return (
    <div className="document-empty-state">
      <div className="document-empty-state-head">
        <FileText size={28} strokeWidth={1.6} />
        <h3>开始编辑文档</h3>
        <p>选一种方式准备正文，完成后可进行智能校对并导出 Word。</p>
      </div>
      <div className="document-empty-state-grid">
        <button type="button" className="document-empty-card" disabled={busy} onClick={onWrite}>
          <span className="document-empty-card-icon">
            <Wand2 size={22} />
          </span>
          <strong>AI 写文书</strong>
          <span>按主题生成通知、汇报、总结等初稿</span>
        </button>
        <button type="button" className="document-empty-card" disabled={busy} onClick={onUpload}>
          <span className="document-empty-card-icon">
            <Upload size={22} />
          </span>
          <strong>上传 Word</strong>
          <span>导入 .docx，保留版式预览</span>
        </button>
        <button type="button" className="document-empty-card" disabled={busy} onClick={onBrowseTemplates}>
          <span className="document-empty-card-icon">
            <LayoutTemplate size={22} />
          </span>
          <strong>套用模板</strong>
          <span>浏览模板库，载入 GB/T 9704 公文骨架</span>
        </button>
      </div>
    </div>
  )
}
