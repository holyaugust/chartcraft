import { useCallback, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Sparkles, Trash2 } from 'lucide-react'
import PresentationSlidePreview from './PresentationSlidePreview'
import { PRESENTATION_TEMPLATES } from '../data/presentationTemplates'
import type { PresentationOutline } from '../types/presentation'
import { readWriteReferenceFile } from '../utils/documentWrite'
import { isDeepSeekConfigured } from '../utils/deepseek'
import {
  generatePresentationOutline,
  outlineToPreviewText,
  previewTextToOutline,
} from '../utils/presentationWrite'
import { loadPresentationDraft, savePresentationDraft } from '../utils/presentationStorage'

const DEFAULT_OUTLINE_PROMPT = '请根据上传文档内容，生成一份结构清晰的汇报 PPT 大纲，突出核心结论与关键数据。'

interface UploadedDoc {
  name: string
  text: string
}

interface PptBeautifyOutlinePanelProps {
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onStatus: (message: string, isError?: boolean) => void
  onOutlineReady: (outline: PresentationOutline) => void
}

export default function PptBeautifyOutlinePanel({
  busy,
  onBusyChange,
  onStatus,
  onOutlineReady,
}: PptBeautifyOutlinePanelProps) {
  const initial = loadPresentationDraft()
  const [templateId, setTemplateId] = useState(initial.templateId || PRESENTATION_TEMPLATES[0].id)
  const [prompt, setPrompt] = useState(initial.prompt || DEFAULT_OUTLINE_PROMPT)
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDoc | null>(null)
  const [previewText, setPreviewText] = useState(initial.previewText)
  const [outlineJson, setOutlineJson] = useState(initial.outlineJson)
  const [viewMode, setViewMode] = useState<'preview' | 'text'>('preview')
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const docInputRef = useRef<HTMLInputElement>(null)

  const template = useMemo(
    () => PRESENTATION_TEMPLATES.find((item) => item.id === templateId) ?? PRESENTATION_TEMPLATES[0],
    [templateId],
  )

  const outline = useMemo(() => {
    if (outlineJson.trim()) {
      try {
        return JSON.parse(outlineJson) as PresentationOutline
      } catch {
        /* fall through */
      }
    }
    return previewTextToOutline(previewText)
  }, [outlineJson, previewText])

  const applyOutline = useCallback(
    (next: PresentationOutline) => {
      setOutlineJson(JSON.stringify(next))
      setPreviewText(outlineToPreviewText(next))
      savePresentationDraft({
        templateId,
        previewText: outlineToPreviewText(next),
        outlineJson: JSON.stringify(next),
        prompt,
      })
      onOutlineReady(next)
    },
    [onOutlineReady, prompt, templateId],
  )

  const handleUploadDoc = useCallback(
    async (file: File) => {
      onBusyChange(true)
      onStatus('')
      try {
        const text = await readWriteReferenceFile(file)
        if (!text.trim()) {
          throw new Error('文档中未识别到可用文字')
        }
        setUploadedDoc({ name: file.name, text })
        onStatus(`已读取「${file.name}」（${text.length} 字），填写需求后点击生成大纲`)
      } catch (err) {
        onStatus(err instanceof Error ? err.message : '文档读取失败', true)
      } finally {
        onBusyChange(false)
      }
    },
    [onBusyChange, onStatus],
  )

  const handleGenerate = useCallback(async () => {
    if (!uploadedDoc?.text.trim()) {
      onStatus('请先上传参考文档（.docx / .txt / .md）', true)
      return
    }
    if (!prompt.trim()) {
      onStatus('请填写汇报需求', true)
      return
    }
    if (!isDeepSeekConfigured()) {
      onStatus('未配置 DeepSeek：请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY 后重启 dev', true)
      return
    }

    onBusyChange(true)
    onStatus('正在根据文档生成 PPT 大纲…')
    try {
      const next = await generatePresentationOutline({
        prompt,
        templateId,
        sourceDocument: uploadedDoc.text,
      })
      applyOutline(next)
      onStatus(`大纲已生成：共 ${next.slides.length} 页 · ${next.title}`)
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '大纲生成失败', true)
    } finally {
      onBusyChange(false)
    }
  }, [applyOutline, onBusyChange, onStatus, prompt, templateId, uploadedDoc])

  const handlePreviewTextChange = (text: string) => {
    setPreviewText(text)
    setOutlineJson('')
    const parsed = previewTextToOutline(text)
    if (parsed) onOutlineReady(parsed)
  }

  return (
    <div className="ppt-beautify-layout ppt-beautify-outline-layout">
      <aside className="ppt-beautify-sidebar">
        <section className="ppt-beautify-block">
          <h3>第一步 · 上传文档</h3>
          <input
            ref={docInputRef}
            type="file"
            accept=".docx,.txt,.md"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUploadDoc(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="doc-write-upload-zone ppt-beautify-upload"
            disabled={busy}
            onClick={() => docInputRef.current?.click()}
          >
            {uploadedDoc ? (
              <span className="ppt-beautify-doc-uploaded">
                <FileText size={16} />
                {uploadedDoc.name}
                <button
                  type="button"
                  className="ppt-beautify-doc-remove"
                  aria-label="移除文档"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation()
                    setUploadedDoc(null)
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ) : (
              <>
                <FileText size={18} />
                <span>上传 Word / 文本（.docx · .txt · .md）</span>
              </>
            )}
          </button>
          {uploadedDoc ? (
            <p className="ppt-beautify-full-meta">已提取 {uploadedDoc.text.length} 字，将作为 AI 参考材料</p>
          ) : null}
        </section>

        <section className="ppt-beautify-block">
          <h3>汇报类型</h3>
          <div className="ppt-beautify-outline-templates">
            {PRESENTATION_TEMPLATES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ppt-beautify-outline-template${templateId === item.id ? ' active' : ''}`}
                disabled={busy}
                onClick={() => setTemplateId(item.id)}
              >
                <strong>{item.name}</strong>
                <span>{item.suggestedStructure}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="ppt-beautify-block">
          <h3>生成要求</h3>
          <textarea
            className="ppt-beautify-outline-prompt"
            value={prompt}
            rows={4}
            disabled={busy}
            placeholder={DEFAULT_OUTLINE_PROMPT}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary ppt-beautify-generate-btn"
            disabled={busy || !uploadedDoc}
            onClick={() => void handleGenerate()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            根据文档生成 PPT 大纲
          </button>
        </section>
      </aside>

      <div className="ppt-beautify-outline-main">
        <div className="ppt-beautify-outline-toolbar">
          <h4>PPT 大纲{outline ? ` · ${outline.slides.length} 页` : ''}</h4>
          <div className="ppt-beautify-outline-view-toggle">
            <button
              type="button"
              className={viewMode === 'preview' ? 'active' : ''}
              disabled={!outline}
              onClick={() => setViewMode('preview')}
            >
              卡片预览
            </button>
            <button
              type="button"
              className={viewMode === 'text' ? 'active' : ''}
              disabled={!outline}
              onClick={() => setViewMode('text')}
            >
              文本编辑
            </button>
          </div>
        </div>

        {!outline ? (
          <p className="ppt-beautify-slide-empty">上传文档并生成后，将在此预览 PPT 页结构与要点</p>
        ) : viewMode === 'preview' ? (
          <PresentationSlidePreview
            outline={outline}
            template={template}
            activeIndex={activeSlideIndex}
            onSelect={setActiveSlideIndex}
          />
        ) : (
          <textarea
            className="ppt-beautify-outline-text"
            value={previewText}
            onChange={(e) => handlePreviewTextChange(e.target.value)}
          />
        )}

        {outline ? (
          <p className="ppt-beautify-compare-hint">
            大纲生成后可进入「封面美化」「全文美化」阶段；封面字段与全文页内容将自动同步。
          </p>
        ) : null}
      </div>
    </div>
  )
}
