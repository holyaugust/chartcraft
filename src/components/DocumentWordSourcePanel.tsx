import { Eye, FileText, Sparkles, FileDown, Upload, Wand2 } from 'lucide-react'
import DocumentLocalRefineCard from './DocumentLocalRefineCard'

export type DocumentSourceKind = 'word' | 'ai'

interface DocumentWordSourcePanelProps {
  kind?: DocumentSourceKind
  fileName: string | null
  textDrifted?: boolean
  onOpenPreview?: () => void
  onBrowseTemplates?: () => void
  onReupload?: () => void
  refinePrompt: string
  onRefinePromptChange: (value: string) => void
  selectedPreview: string | null
  refineBusy: boolean
  refineError: string | null
  refineAnswer?: string | null
  refineDisabled?: boolean
  onRefine: () => void
  onApplyAnswerAsRewrite?: () => void
}

export default function DocumentWordSourcePanel({
  kind = 'word',
  fileName,
  textDrifted = false,
  onOpenPreview,
  onBrowseTemplates,
  onReupload,
  refinePrompt,
  onRefinePromptChange,
  selectedPreview,
  refineBusy,
  refineError,
  refineAnswer = null,
  refineDisabled = false,
  onRefine,
  onApplyAnswerAsRewrite,
}: DocumentWordSourcePanelProps) {
  const refineCard = (
    <DocumentLocalRefineCard
      prompt={refinePrompt}
      onPromptChange={onRefinePromptChange}
      selectedPreview={selectedPreview}
      busy={refineBusy}
      error={refineError}
      answer={refineAnswer}
      disabled={refineDisabled}
      onSubmit={onRefine}
      onApplyAnswerAsRewrite={onApplyAnswerAsRewrite}
    />
  )

  if (kind === 'ai') {
    return (
      <section className="document-word-source-panel" aria-label="AI 生成文档">
        <div className="document-word-source-head">
          <Wand2 size={18} />
          <div>
            <h3>AI 已生成</h3>
            <p>{fileName?.replace(/\.docx$/i, '') || '未命名文档'}</p>
          </div>
        </div>

        <p className="document-word-source-lead">
          正文已由 AI 生成。可在下方输入提示词，对选中段落或指定局部做调整优化。
        </p>

        {refineCard}

        <ul className="document-word-source-steps">
          <li>
            <FileText size={14} />
            <span>核对正文中的 ××× / 【】 占位内容</span>
          </li>
          <li>
            <Sparkles size={14} />
            <span>在流程条进入「智能校对」，于侧栏启动检查</span>
          </li>
          <li>
            <FileDown size={14} />
            <span>确认无误后点右上角导出 Word</span>
          </li>
        </ul>

        <div className="document-word-source-footer">
          {onReupload ? (
            <button type="button" className="document-word-source-secondary" onClick={onReupload}>
              <Upload size={14} />
              重新上传 Word
            </button>
          ) : null}
          {onBrowseTemplates ? (
            <button type="button" className="document-word-source-secondary" onClick={onBrowseTemplates}>
              仍需套用职场模板
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="document-word-source-panel" aria-label="已上传 Word 文档">
      <div className="document-word-source-head">
        <FileText size={18} />
        <div>
          <h3>已上传 Word</h3>
          <p>{fileName ?? '未命名文档.docx'}</p>
        </div>
      </div>

      <p className="document-word-source-lead">
        正文已从 Word 提取。可在下方输入提示词，对局部内容进行调整优化。
      </p>

      {refineCard}

      {textDrifted ? (
        <p className="document-word-source-note" role="status">
          文本已修改。请先完成「智能排版」；导出 Word 将按排版结果生成。若需对照原稿，可选「保留原版式导出」。
        </p>
      ) : null}

      <ul className="document-word-source-steps">
        <li>
          <Eye size={14} />
          <span>
            切换到「版式预览」对照原 Word 排版
            {onOpenPreview ? (
              <button type="button" className="document-word-source-link" onClick={onOpenPreview}>
                立即查看
              </button>
            ) : null}
          </span>
        </li>
        <li>
          <Sparkles size={14} />
          <span>在流程条进入「智能校对」，于侧栏启动检查</span>
        </li>
        <li>
          <FileDown size={14} />
          <span>完成「智能排版」后导出；上传过原稿时可另选保留原版式</span>
        </li>
      </ul>

      {onReupload ? (
        <div className="document-word-source-footer">
          <button type="button" className="document-word-source-secondary" onClick={onReupload}>
            <Upload size={14} />
            重新上传
          </button>
        </div>
      ) : null}
    </section>
  )
}
