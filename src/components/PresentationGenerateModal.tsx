import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Sparkles, Trash2, X } from 'lucide-react'
import { getPresentationTemplateById } from '../data/presentationTemplates'
import { generatePresentationOutline } from '../utils/presentationWrite'
import { readWriteReferenceFile } from '../utils/documentWrite'
import { isDeepSeekConfigured } from '../utils/deepseek'
import type { PresentationOutline } from '../types/presentation'

interface UploadedReference {
  id: string
  name: string
  text: string
}

function createFileId(): string {
  return `ppt-ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function buildCombinedReference(workspaceText: string, uploaded: UploadedReference | null): string | undefined {
  const parts: string[] = []
  if (workspaceText.trim()) {
    parts.push(`【文档工作区正文】\n${workspaceText.trim()}`)
  }
  if (uploaded?.text.trim()) {
    parts.push(`【上传参考文档：${uploaded.name}】\n${uploaded.text.trim()}`)
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined
}

interface PresentationGenerateModalProps {
  open: boolean
  onClose: () => void
  templateId: string
  sourceDocument?: string
  initialPrompt?: string
  onGenerated: (payload: { outline: PresentationOutline; prompt: string }) => void
}

const DEFAULT_PROMPT = '请根据参考材料生成一份领导汇报 PPT，突出工作成效、存在问题与下一步安排。'

export default function PresentationGenerateModal({
  open,
  onClose,
  templateId,
  sourceDocument = '',
  initialPrompt = '',
  onGenerated,
}: PresentationGenerateModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt || DEFAULT_PROMPT)
  const [useDocument, setUseDocument] = useState(Boolean(sourceDocument.trim()))
  const [uploadedReference, setUploadedReference] = useState<UploadedReference | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPrompt(initialPrompt || DEFAULT_PROMPT)
    setUseDocument(Boolean(sourceDocument.trim()))
    setUploadedReference(null)
    setError(null)
  }, [open, initialPrompt, sourceDocument])

  const handleUploadReference = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)

    const file = files[0]
    try {
      const text = await readWriteReferenceFile(file)
      setUploadedReference({ id: createFileId(), name: file.name, text })
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件读取失败')
    }
  }, [])

  const runGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('请先填写汇报需求')
      return
    }
    if (!isDeepSeekConfigured()) {
      setError('未配置 DeepSeek：请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY 后重启 dev')
      return
    }

    setBusy(true)
    setError(null)

    const combinedReference = buildCombinedReference(
      useDocument ? sourceDocument : '',
      uploadedReference,
    )

    try {
      const outline = await generatePresentationOutline({
        prompt,
        templateId,
        sourceDocument: combinedReference,
      })
      onGenerated({ outline, prompt })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setBusy(false)
    }
  }, [prompt, templateId, useDocument, sourceDocument, uploadedReference, onGenerated, onClose])

  if (!open) return null

  const template = getPresentationTemplateById(templateId)

  return (
    <div className="doc-write-overlay" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="doc-write-modal presentation-generate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ppt-generate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="doc-write-header">
          <div className="doc-write-brand">
            <span className="doc-write-logo presentation-generate-logo" aria-hidden="true">
              P
            </span>
            <h2 id="ppt-generate-title">生成汇报 PPT</h2>
          </div>
          <button type="button" className="doc-write-close" aria-label="关闭" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="doc-write-body">
          {template ? (
            <div className="doc-write-template-link" role="status">
              当前模板：<strong>{template.name}</strong>（{template.suggestedStructure}）
            </div>
          ) : null}

          <textarea
            className="doc-write-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={DEFAULT_PROMPT}
            rows={4}
            disabled={busy}
          />

          <label className="doc-write-save-check presentation-use-document">
            <input
              type="checkbox"
              checked={useDocument}
              onChange={(event) => setUseDocument(event.target.checked)}
              disabled={busy || !sourceDocument.trim()}
            />
            使用文档工作区正文作为参考材料
            {!sourceDocument.trim() ? '（文档工作区暂无内容）' : ''}
          </label>

          <section className="presentation-reference-upload">
            <div className="doc-write-material-head">
              <h3>上传参考文档</h3>
              <span className="presentation-reference-hint">可与上方工作区正文叠加使用</span>
            </div>
            <input
              ref={referenceInputRef}
              type="file"
              accept=".docx,.txt,.md"
              hidden
              disabled={busy}
              onChange={(event) => {
                void handleUploadReference(event.target.files)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              className="doc-write-upload-zone"
              disabled={busy}
              onClick={() => referenceInputRef.current?.click()}
            >
              {uploadedReference ? (
                <ul className="doc-write-file-list">
                  <li className="doc-write-file-item">
                    <FileText size={14} />
                    <span className="doc-write-file-name" title={uploadedReference.name}>
                      {uploadedReference.name}
                    </span>
                    <button
                      type="button"
                      className="doc-write-file-remove"
                      aria-label="移除"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation()
                        setUploadedReference(null)
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                </ul>
              ) : (
                <p className="doc-write-file-empty">
                  点击上传参考文档（.docx / .txt，最多 1 个，AI 将提炼要点写入幻灯片）
                </p>
              )}
            </button>
          </section>

          {error ? <p className="doc-write-error">{error}</p> : null}
        </div>

        <footer className="doc-write-footer presentation-generate-footer">
          <button
            type="button"
            className="btn btn-sm btn-primary doc-write-btn-primary"
            disabled={busy}
            onClick={() => void runGenerate()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            生成内容
          </button>
        </footer>
      </div>
    </div>
  )
}
