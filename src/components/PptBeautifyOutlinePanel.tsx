import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChevronDown, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react'

import PresentationSlidePreview from './PresentationSlidePreview'

import { PRESENTATION_TEMPLATES } from '../data/presentationTemplates'

import type { PresentationOutline } from '../types/presentation'

import { isDeepSeekConfigured } from '../utils/deepseek'

import {
  ADAPTIVE_PRESENTATION_TEMPLATE_ID,
  generatePresentationOutline,
  outlineToPreviewText,
  previewTextToOutline,
} from '../utils/presentationWrite'

import { loadPresentationDraft, savePresentationDraft } from '../utils/presentationStorage'
import {
  DEFAULT_PROJECT_PROMPT,
  readPptSourceDocument,
  type PptSourceDocument,
} from '../utils/pptSourceDocument'

const FIXED_TEMPLATE_IDS = new Set(PRESENTATION_TEMPLATES.map((item) => item.id))

function resolveTemplateOverride(storedTemplateId: string): string | null {
  if (!storedTemplateId || storedTemplateId === ADAPTIVE_PRESENTATION_TEMPLATE_ID) {
    return null
  }
  return FIXED_TEMPLATE_IDS.has(storedTemplateId) ? storedTemplateId : null
}

interface UploadedDoc {
  name: string
  text: string
  kind: PptSourceDocument['kind']
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

  const [templateOverrideId, setTemplateOverrideId] = useState<string | null>(() =>
    resolveTemplateOverride(initial.templateId),
  )
  const [advancedOpen, setAdvancedOpen] = useState(() => resolveTemplateOverride(initial.templateId) !== null)
  const [prompt, setPrompt] = useState(initial.prompt || DEFAULT_PROJECT_PROMPT)
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDoc | null>(null)
  const [previewText, setPreviewText] = useState(initial.previewText)
  const [outlineJson, setOutlineJson] = useState(initial.outlineJson)
  const [viewMode, setViewMode] = useState<'preview' | 'text'>('preview')
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)

  const docInputRef = useRef<HTMLInputElement>(null)
  const skipTemplateAutoGenRef = useRef(true)
  const sourceGenKeyRef = useRef('')

  const previewTemplate = useMemo(() => {
    if (templateOverrideId) {
      return PRESENTATION_TEMPLATES.find((item) => item.id === templateOverrideId) ?? PRESENTATION_TEMPLATES[0]
    }
    return PRESENTATION_TEMPLATES[0]
  }, [templateOverrideId])

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

  const persistTemplateId = templateOverrideId ?? ADAPTIVE_PRESENTATION_TEMPLATE_ID

  const applyOutline = useCallback(
    (next: PresentationOutline, savedTemplateId = persistTemplateId) => {
      setOutlineJson(JSON.stringify(next))
      setPreviewText(outlineToPreviewText(next))
      savePresentationDraft({
        templateId: savedTemplateId,
        previewText: outlineToPreviewText(next),
        outlineJson: JSON.stringify(next),
        prompt,
      })
      onOutlineReady(next)
    },
    [onOutlineReady, persistTemplateId, prompt],
  )

  const generateFromDoc = useCallback(
    async (
      doc: UploadedDoc,
      options?: { templateOverrideId?: string | null; prompt?: string },
    ) => {
      if (!doc.text.trim()) {
        if (doc.kind === 'pdf') {
          onStatus('PDF 无法生成标准大纲，请切换到「智能设计稿」', true)
        } else {
          onStatus('文档中未识别到可用文字', true)
        }
        return
      }

      const activePrompt = options?.prompt ?? prompt
      const overrideId =
        options?.templateOverrideId !== undefined ? options.templateOverrideId : templateOverrideId
      const requestTemplateId = overrideId ?? ADAPTIVE_PRESENTATION_TEMPLATE_ID

      if (!activePrompt.trim()) {
        onStatus('请填写汇报需求', true)
        return
      }
      if (!isDeepSeekConfigured()) {
        onStatus('未配置 DeepSeek：请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY 后重启 dev', true)
        return
      }

      const modeLabel = overrideId
        ? PRESENTATION_TEMPLATES.find((item) => item.id === overrideId)?.name ?? '固定模板'
        : '智能结构'

      onBusyChange(true)
      onStatus(`正在根据「${doc.name}」生成 PPT 大纲（${modeLabel}）…`)
      try {
        const next = await generatePresentationOutline({
          prompt: activePrompt,
          templateId: requestTemplateId,
          sourceDocument: doc.text,
        })
        applyOutline(next, overrideId ?? ADAPTIVE_PRESENTATION_TEMPLATE_ID)
        onStatus(`大纲已生成：共 ${next.slides.length} 页 · ${next.title}`)
      } catch (err) {
        onStatus(err instanceof Error ? err.message : '大纲生成失败', true)
      } finally {
        onBusyChange(false)
      }
    },
    [applyOutline, onBusyChange, onStatus, prompt, templateOverrideId],
  )

  const handleUploadDoc = useCallback(
    async (file: File) => {
      onBusyChange(true)
      try {
        const doc = await readPptSourceDocument(file)
        const next: UploadedDoc = { name: doc.name, text: doc.text, kind: doc.kind }
        setUploadedDoc(next)
        if (doc.kind === 'pdf') {
          onStatus(`已上传 PDF「${doc.name}」，标准大纲不支持，请用「智能设计稿」`, true)
          return
        }
        onStatus(`已读取「${doc.name}」（${doc.text.length.toLocaleString()} 字），正在生成大纲…`)
        setActiveSlideIndex(0)
        setViewMode('preview')
        sourceGenKeyRef.current = `${doc.name}:${doc.text.length}`
        await generateFromDoc(next)
      } catch (err) {
        setUploadedDoc(null)
        onStatus(err instanceof Error ? err.message : '文档读取失败', true)
      } finally {
        onBusyChange(false)
      }
    },
    [generateFromDoc, onBusyChange, onStatus],
  )

  useEffect(() => {
    if (skipTemplateAutoGenRef.current) {
      skipTemplateAutoGenRef.current = false
      return
    }
    if (!uploadedDoc?.text.trim() || busy) return
    void generateFromDoc(uploadedDoc)
  }, [templateOverrideId]) // eslint-disable-line react-hooks/exhaustive-deps -- 切换固定模板时重生成

  const handleGenerate = useCallback(async () => {
    if (!uploadedDoc?.text.trim()) {
      if (uploadedDoc?.kind === 'pdf') {
        onStatus('PDF 无法生成标准大纲，请切换到「智能设计稿」', true)
      } else {
        onStatus('请先上传参考文档（Word / 文本）', true)
      }
      return
    }
    await generateFromDoc(uploadedDoc)
  }, [generateFromDoc, onStatus, uploadedDoc])

  const handleSelectTemplateOverride = (nextId: string | null) => {
    skipTemplateAutoGenRef.current = false
    setTemplateOverrideId(nextId)
  }

  const handlePreviewTextChange = (text: string) => {
    setPreviewText(text)
    setOutlineJson('')
    const parsed = previewTextToOutline(text)
    if (parsed) onOutlineReady(parsed)
  }

  const hasOutlineSource = Boolean(uploadedDoc?.text.trim())

  return (
    <div className="ppt-beautify-layout ppt-beautify-outline-layout">
      <aside className="ppt-beautify-sidebar">
        <section className="ppt-beautify-block">
          <h3>上传材料</h3>
          <input
            ref={docInputRef}
            type="file"
            accept=".docx,.txt,.md,.markdown"
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
                    setOutlineJson('')
                    setPreviewText('')
                    setActiveSlideIndex(0)
                    sourceGenKeyRef.current = ''
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ) : (
              <>
                <FileText size={18} />
                <span>Word / Markdown / 文本</span>
              </>
            )}
          </button>
          {uploadedDoc?.text.trim() ? (
            <p className="ppt-beautify-full-meta">已提取 {uploadedDoc.text.length.toLocaleString()} 字</p>
          ) : uploadedDoc?.kind === 'pdf' ? (
            <p className="ppt-beautify-compare-hint">PDF 请切换到「智能设计稿」</p>
          ) : null}
        </section>

        <section className="ppt-beautify-block ppt-beautify-advanced-block">
          <button
            type="button"
            className="ppt-beautify-advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <span>
              高级 · 可选固定模板
              {!templateOverrideId ? (
                <span className="ppt-beautify-mode-badge ppt-beautify-mode-badge-inline">当前：智能结构</span>
              ) : null}
            </span>
            <ChevronDown size={16} className={advancedOpen ? 'expanded' : ''} aria-hidden="true" />
          </button>
          {advancedOpen ? (
            <div className="ppt-beautify-advanced-body">
              <p className="ppt-beautify-full-meta">
                默认由 AI 根据材料自定章节。若需固定页型骨架，可任选下列模板。
              </p>
              <button
                type="button"
                className={`ppt-beautify-outline-template ppt-beautify-adaptive-option${!templateOverrideId ? ' active' : ''}`}
                disabled={busy || !hasOutlineSource}
                onClick={() => handleSelectTemplateOverride(null)}
              >
                <strong>智能结构（推荐）</strong>
                <span>不限定体裁，按文档性质组织章节与页型</span>
              </button>
              <div className="ppt-beautify-outline-templates">
                {PRESENTATION_TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ppt-beautify-outline-template${templateOverrideId === item.id ? ' active' : ''}`}
                    disabled={busy || !hasOutlineSource}
                    onClick={() => handleSelectTemplateOverride(item.id)}
                  >
                    <strong>{item.name}</strong>
                    <span>{item.suggestedStructure}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="ppt-beautify-block">
          <h3>生成要求</h3>
          <textarea
            className="ppt-beautify-outline-prompt"
            value={prompt}
            rows={4}
            disabled={busy}
            placeholder={DEFAULT_PROJECT_PROMPT}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary ppt-beautify-generate-btn"
            disabled={busy || !hasOutlineSource}
            onClick={() => void handleGenerate()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {outline ? '重新生成大纲' : '根据文档生成 PPT 大纲'}
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

        {busy && !outline ? (
          <div className="ppt-beautify-slide-empty ppt-beautify-outline-loading">
            <Loader2 size={28} className="spin" />
            <p>正在分析文档并生成 PPT 大纲，请稍候…</p>
          </div>
        ) : !outline ? (
          <p className="ppt-beautify-slide-empty">
            上传文档后将在此自动预览 PPT 页结构与要点
          </p>
        ) : viewMode === 'preview' ? (
          <PresentationSlidePreview
            outline={outline}
            template={previewTemplate}
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
