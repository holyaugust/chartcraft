import { Loader2, Sparkles } from 'lucide-react'
import {
  DOCUMENT_LOCAL_REFINE_EXAMPLES,
  isConsultativePrompt,
} from '../utils/documentLocalRefine'

interface DocumentLocalRefineCardProps {
  prompt: string
  onPromptChange: (value: string) => void
  selectedPreview: string | null
  busy: boolean
  error: string | null
  answer?: string | null
  disabled?: boolean
  onSubmit: () => void
  onApplyAnswerAsRewrite?: () => void
}

export default function DocumentLocalRefineCard({
  prompt,
  onPromptChange,
  selectedPreview,
  busy,
  error,
  answer = null,
  disabled = false,
  onSubmit,
  onApplyAnswerAsRewrite,
}: DocumentLocalRefineCardProps) {
  const hasSelection = Boolean(selectedPreview?.trim())
  const asking = isConsultativePrompt(prompt)

  return (
    <section className="document-local-refine" aria-label="你想对这篇文档做什么">
      <div className="document-local-refine-head">
        <Sparkles size={15} />
        <div>
          <h4>你想对这篇文档做什么</h4>
          <p>
            {asking
              ? '已识别为分析/提炼：将结合正文作答，不会直接改写'
              : hasSelection
                ? '只改选中内容，速度更快'
                : '建议先选中再优化；未选中时会自动定位片段'}
          </p>
        </div>
      </div>

      {hasSelection ? (
        <div className="document-local-refine-selection" title={selectedPreview ?? undefined}>
          <span>已选中</span>
          <p>{selectedPreview}</p>
        </div>
      ) : (
        <p className="document-local-refine-hint">
          {asking
            ? '无需选中：将基于全文回答（如结构提炼、逻辑关系）。深度梳理也可走流程条「结构梳理」。'
            : '可输入改写要求（如「更正式」），也可直接提问（如「把这篇文档的结构提炼出来」）。'}
        </p>
      )}

      <textarea
        className="document-local-refine-input"
        value={prompt}
        rows={3}
        disabled={busy || disabled}
        placeholder="例如：这段更正式一点 / 这段和国资整合有什么关联？"
        onChange={(event) => onPromptChange(event.target.value)}
      />

      <div className="document-local-refine-chips">
        {DOCUMENT_LOCAL_REFINE_EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            className="document-local-refine-chip"
            disabled={busy || disabled}
            onClick={() => onPromptChange(example.prompt)}
          >
            {example.label}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="document-local-refine-answer">
          <span>回答</span>
          <p>{answer}</p>
          {onApplyAnswerAsRewrite ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost document-local-refine-answer-action"
              disabled={busy || disabled}
              onClick={onApplyAnswerAsRewrite}
            >
              按此思路改写选中内容
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="document-local-refine-error">{error}</p> : null}

      <button
        type="button"
        className="btn btn-sm btn-primary document-local-refine-submit"
        disabled={busy || disabled || !prompt.trim()}
        onClick={onSubmit}
      >
        {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
        {busy ? (asking ? '分析中…' : '优化中…') : asking ? '提问分析' : '应用优化'}
      </button>
    </section>
  )
}
