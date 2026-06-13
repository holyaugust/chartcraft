import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  FileDown,
  Loader2,
  Presentation,
  Sparkles,
  AlertCircle,
  Upload,
  Trash2,
  FileText,
  LayoutGrid,
  PenLine,
} from 'lucide-react'
import PresentationGenerateModal from './PresentationGenerateModal'
import PresentationTemplateLibrary from './PresentationTemplateLibrary'
import PresentationSlidePreview from './PresentationSlidePreview'
import { PRESENTATION_TEMPLATES } from '../data/presentationTemplates'
import {
  outlineToPreviewText,
  previewTextToOutline,
} from '../utils/presentationWrite'
import { buildPresentationFileName, exportPresentation } from '../utils/pptxExport'
import { importPptxFile, type ImportedPptx } from '../utils/pptxImport'
import { clearUploadedPptxDraft, loadUploadedPptxDraft, saveUploadedPptxDraft } from '../utils/pptxDraftStorage'
import type { PresentationTemplateSlideHint } from '../utils/presentationWrite'
import { getProjectChartTitle, renderProjectChartDataUrl } from '../utils/presentationChart'
import { saveFile } from '../utils/saveFile'
import {
  loadDocumentDraftForPresentation,
  loadPresentationDraft,
  savePresentationDraft,
} from '../utils/presentationStorage'
import type { PresentationOutline, PresentationSlide, PresentationTemplate } from '../types/presentation'

type ViewMode = 'preview' | 'text'
type ExportMode = 'new' | 'writeback'

interface PresentationWorkspaceProps {
  onSavedLabelChange: (label: string) => void
  seedDocument?: string | null
  onSeedConsumed?: () => void
  chartSeed?: boolean
  onChartSeedConsumed?: () => void
}

function parseStoredOutline(outlineJson: string, previewText: string): PresentationOutline | null {
  if (outlineJson.trim()) {
    try {
      return JSON.parse(outlineJson) as PresentationOutline
    } catch {
      /* fall through */
    }
  }
  return previewTextToOutline(previewText)
}

function updateSlideAt(outline: PresentationOutline, index: number, patch: Partial<PresentationSlide>): PresentationOutline {
  return {
    ...outline,
    slides: outline.slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)),
  }
}

export default function PresentationWorkspace({
  onSavedLabelChange,
  seedDocument = null,
  onSeedConsumed,
  chartSeed = false,
  onChartSeedConsumed,
}: PresentationWorkspaceProps) {
  const initial = loadPresentationDraft()
  const [templateId, setTemplateId] = useState(initial.templateId || PRESENTATION_TEMPLATES[0].id)
  const [previewText, setPreviewText] = useState(initial.previewText)
  const [outlineJson, setOutlineJson] = useState(initial.outlineJson)
  const [savedPrompt, setSavedPrompt] = useState(initial.prompt)
  const [uploadedPptxFileName, setUploadedPptxFileName] = useState(initial.uploadedPptxFileName ?? '')
  const uploadedPptxRef = useRef<ImportedPptx | null>(null)
  const pptxInputRef = useRef<HTMLInputElement>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusIsError, setStatusIsError] = useState(false)
  const [pptxReady, setPptxReady] = useState(false)

  const template = useMemo(
    () => PRESENTATION_TEMPLATES.find((item) => item.id === templateId) ?? PRESENTATION_TEMPLATES[0],
    [templateId],
  )

  const outline = useMemo(
    () => parseStoredOutline(outlineJson, previewText),
    [outlineJson, previewText],
  )

  const documentDraft = useMemo(() => loadDocumentDraftForPresentation(), [showGenerateModal, seedDocument])
  const sourceDocument = useMemo(() => {
    const parts: string[] = []
    if (seedDocument?.trim()) parts.push(seedDocument.trim())
    else if (documentDraft.trim()) parts.push(documentDraft.trim())
    if (uploadedPptxRef.current?.combinedText.trim()) {
      parts.push(`【已上传 PPT 提取】\n${uploadedPptxRef.current.combinedText.trim()}`)
    }
    return parts.join('\n\n')
  }, [seedDocument, documentDraft, uploadedPptxFileName, showGenerateModal])

  const activeSlide = outline?.slides[activeSlideIndex] ?? null

  const templateSlideHints = useMemo<PresentationTemplateSlideHint[] | undefined>(() => {
    if (!uploadedPptxRef.current) return undefined
    return uploadedPptxRef.current.slides.map((slide) => ({
      index: slide.index,
      suggestedLayout: slide.suggestedLayout,
      sampleTexts: slide.texts,
      placeholderTypes: slide.placeholderTypes,
    }))
  }, [uploadedPptxFileName, pptxReady])

  const slideCountMismatch = useMemo(() => {
    if (!uploadedPptxRef.current || !outline) return null
    const templateCount = uploadedPptxRef.current.slideCount
    const outlineCount = outline.slides.length
    if (templateCount === outlineCount) return null
    return { templateCount, outlineCount }
  }, [outline, uploadedPptxFileName, pptxReady])

  const savedLabel = useMemo(() => {
    const date = new Date(lastSavedAt)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }, [lastSavedAt])

  const applyOutline = useCallback((next: PresentationOutline) => {
    setOutlineJson(JSON.stringify(next))
    setPreviewText(outlineToPreviewText(next))
  }, [])

  const resolveOutlineForExport = useCallback((): PresentationOutline | null => {
    if (viewMode === 'text') {
      const fromText = previewTextToOutline(previewText, outline?.title)
      if (fromText) return fromText
    }
    return parseStoredOutline(outlineJson, previewText)
  }, [viewMode, previewText, outlineJson, outline?.title])

  useEffect(() => {
    onSavedLabelChange(savedLabel)
  }, [savedLabel, onSavedLabelChange])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      savePresentationDraft({
        templateId,
        previewText,
        outlineJson,
        prompt: savedPrompt,
        uploadedPptxFileName: uploadedPptxFileName || undefined,
      })
      setLastSavedAt(Date.now())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [templateId, previewText, outlineJson, savedPrompt, uploadedPptxFileName])

  useEffect(() => {
    if (!seedDocument?.trim()) return
    setShowGenerateModal(true)
    onSeedConsumed?.()
  }, [seedDocument, onSeedConsumed])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (uploadedPptxRef.current) {
        setPptxReady(true)
        return
      }
      const stored = await loadUploadedPptxDraft()
      if (cancelled || !stored) return
      try {
        const imported = await importPptxFile(new File([stored.arrayBuffer], stored.fileName))
        uploadedPptxRef.current = imported
        setUploadedPptxFileName(imported.fileName)
        setPptxReady(true)
      } catch {
        await clearUploadedPptxDraft()
        setUploadedPptxFileName('')
        setPptxReady(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const insertChartSlide = useCallback(async () => {
    setBusy(true)
    setStatusMessage(null)
    setStatusIsError(false)
    try {
      const dataUrl = await renderProjectChartDataUrl()
      if (!dataUrl) {
        throw new Error('图表工作区暂无可用数据，请先在图表页配置表格与图表')
      }

      const chartTitle = getProjectChartTitle()
      const chartSlide: PresentationSlide = {
        layout: 'chart',
        title: chartTitle,
        chartImageDataUrl: dataUrl,
      }

      const base = resolveOutlineForExport() ?? {
        title: chartTitle,
        slides: [],
      }

      const closingIndex = base.slides.findIndex((slide) => slide.layout === 'closing')
      const slides =
        closingIndex >= 0
          ? [...base.slides.slice(0, closingIndex), chartSlide, ...base.slides.slice(closingIndex)]
          : [...base.slides, chartSlide]

      applyOutline({ ...base, slides })
      setActiveSlideIndex(closingIndex >= 0 ? closingIndex : slides.length - 1)
      setViewMode('preview')
      setStatusIsError(false)
      setStatusMessage('已插入图表页（数据来自图表工作区当前草稿）')
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : '插入图表失败')
    } finally {
      setBusy(false)
    }
  }, [applyOutline, resolveOutlineForExport])

  useEffect(() => {
    if (!chartSeed) return
    void insertChartSlide()
    onChartSeedConsumed?.()
  }, [chartSeed, insertChartSlide, onChartSeedConsumed])

  const handleGenerated = useCallback(
    (payload: { outline: PresentationOutline; prompt: string }) => {
      applyOutline(payload.outline)
      setSavedPrompt(payload.prompt)
      setActiveSlideIndex(0)
      setViewMode('preview')
      setStatusIsError(false)
      setStatusMessage(`已生成 ${payload.outline.slides.length} 页汇报大纲，可在版式预览中查看与编辑`)
    },
    [applyOutline],
  )

  const handleUploadPptx = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setStatusMessage(null)
    setStatusIsError(false)
    try {
      const imported = await importPptxFile(files[0])
      uploadedPptxRef.current = imported
      setUploadedPptxFileName(imported.fileName)
      setPptxReady(true)
      await saveUploadedPptxDraft(imported.fileName, imported.arrayBuffer)
      setStatusIsError(false)
      setStatusMessage(
        `已加载 ${imported.fileName}（${imported.slideCount} 页）。请点「生成汇报」按模板页数生成大纲，导出时选「写回原版式」。`,
      )
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : 'PPT 上传失败')
    } finally {
      setBusy(false)
    }
  }, [])

  const clearUploadedPptx = useCallback(() => {
    uploadedPptxRef.current = null
    setUploadedPptxFileName('')
    setPptxReady(false)
    void clearUploadedPptxDraft()
  }, [])

  const handleExport = useCallback(
    async (mode: ExportMode) => {
      const resolved = resolveOutlineForExport()
      if (!resolved?.slides.length) {
        setStatusIsError(true)
        setStatusMessage('请先生成汇报内容')
        return
      }

      if (mode === 'writeback' && !uploadedPptxRef.current) {
        setStatusIsError(true)
        setStatusMessage('写回导出需先上传原 pptx 模板')
        return
      }

      setBusy(true)
      setStatusMessage(null)
      setStatusIsError(false)
      setExportMenuOpen(false)

      try {
        if (viewMode === 'text') {
          applyOutline(resolved)
        }

        setStatusMessage(mode === 'writeback' ? '正在写回原 PPT…' : '正在生成 PPT 文件…')

        const { blob, writeBackInfo } = await exportPresentation(resolved, template, {
          writeBackBuffer: mode === 'writeback' ? uploadedPptxRef.current?.arrayBuffer : undefined,
          templateSlides: mode === 'writeback' ? uploadedPptxRef.current?.slides : undefined,
        })

        const fileName =
          mode === 'writeback' && uploadedPptxFileName
            ? uploadedPptxFileName.replace(/\.pptx$/i, '') + '-已更新.pptx'
            : buildPresentationFileName(resolved.title)

        const saved = await saveFile(blob, {
          suggestedName: fileName,
          description: 'PowerPoint 演示文稿',
          accept: {
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
          },
        })

        if (!saved) {
          setStatusMessage(null)
          return
        }

        setStatusIsError(false)
        if (writeBackInfo) {
          const parts: string[] = []
          parts.push(`已写回 ${writeBackInfo.updatedCount}/${writeBackInfo.templateSlideCount} 页：${fileName}`)
          if (writeBackInfo.skippedCount > 0) {
            parts.push(`大纲比模板多 ${writeBackInfo.skippedCount} 页未写入`)
          } else if (writeBackInfo.updatedCount < writeBackInfo.templateSlideCount) {
            parts.push(`模板多 ${writeBackInfo.templateSlideCount - writeBackInfo.updatedCount} 页仍保留原示例文字`)
          }
          setStatusMessage(parts.join('；'))
        } else {
          setStatusMessage(`PPT 已导出：${fileName}`)
        }
      } catch (err) {
        setStatusIsError(true)
        setStatusMessage(err instanceof Error ? err.message : 'PPT 导出失败')
      } finally {
        setBusy(false)
      }
    },
    [resolveOutlineForExport, template, viewMode, applyOutline, uploadedPptxFileName],
  )

  const handleSlidePatch = useCallback(
    (patch: Partial<PresentationSlide>) => {
      if (!outline) return
      applyOutline(updateSlideAt(outline, activeSlideIndex, patch))
    },
    [outline, activeSlideIndex, applyOutline],
  )

  return (
    <main className="app-main document-main presentation-main">
      <section className="panel panel-document panel-presentation">
        <div className="panel-header document-toolbar-header">
          <div className="document-panel-title">
            <Presentation size={20} />
            <div>
              <h2>汇报编辑</h2>
              <p>AI 大纲 · 版式预览 · 上传写回 · 图表嵌入</p>
            </div>
          </div>
          <div className="document-toolbar-actions">
            <div className="presentation-view-tabs" role="tablist" aria-label="大纲视图">
              <button
                type="button"
                role="tab"
                className={`presentation-view-tab${viewMode === 'preview' ? ' active' : ''}`}
                aria-selected={viewMode === 'preview'}
                disabled={busy || !outline}
                onClick={() => setViewMode('preview')}
              >
                <LayoutGrid size={14} />
                版式预览
              </button>
              <button
                type="button"
                role="tab"
                className={`presentation-view-tab${viewMode === 'text' ? ' active' : ''}`}
                aria-selected={viewMode === 'text'}
                disabled={busy}
                onClick={() => setViewMode('text')}
              >
                <PenLine size={14} />
                文本大纲
              </button>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={() => void insertChartSlide()}
              title="插入图表工作区当前图表"
            >
              <BarChart3 size={14} />
              插入图表
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => setShowGenerateModal(true)}
            >
              <Sparkles size={14} />
              生成汇报
            </button>
            <div className="presentation-export-dropdown">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy || !outlineJson}
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                {busy ? <Loader2 size={14} className="spin" /> : <FileDown size={14} />}
                导出 PPT
                <ChevronDown size={12} />
              </button>
              {exportMenuOpen ? (
                <div className="presentation-export-menu" role="menu">
                  <button type="button" role="menuitem" disabled={busy} onClick={() => void handleExport('new')}>
                    新建导出（ChartCraft 简易版式）
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy || !uploadedPptxRef.current}
                    onClick={() => void handleExport('writeback')}
                  >
                    写回原版式（推荐）
                    {!uploadedPptxRef.current ? '（需先上传 pptx）' : ''}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div className={`document-status-bar${statusIsError ? ' error' : ' success'}`}>
            {statusIsError ? <AlertCircle size={14} /> : <Sparkles size={14} />}
            {statusMessage}
          </div>
        ) : null}

        <div className="document-layout-split">
          <div className="document-editor-column">
            <div className="document-workspace-main">
              {viewMode === 'preview' ? (
                outline ? (
                  <PresentationSlidePreview
                    outline={outline}
                    template={template}
                    activeIndex={activeSlideIndex}
                    onSelect={setActiveSlideIndex}
                  />
                ) : (
                  <div className="presentation-empty-state">
                    <p>点击「生成汇报」创建 PPT 大纲，或上传现有 pptx 后 AI 改写再写回。</p>
                  </div>
                )
              ) : (
                <div className="document-editor-shell presentation-editor-shell">
                  <textarea
                    className="document-editor presentation-outline-editor"
                    value={previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    placeholder="Markdown 风格大纲；切换回版式预览或导出时会自动解析。"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
            <div className="data-hint document-editor-hint">
              <strong>写回说明：</strong>左侧「版式预览」仍是 ChartCraft 简易样式，<strong>不代表</strong>上传模板效果；请上传 pptx → 生成汇报 → 导出时选「写回原版式」并在 PowerPoint 中打开查看。
              {slideCountMismatch ? (
                <>
                  {' '}
                  当前大纲 {slideCountMismatch.outlineCount} 页，模板 {slideCountMismatch.templateCount} 页，建议重新「生成汇报」以按模板对齐。
                </>
              ) : null}
            </div>
          </div>

          <aside className="document-sidebar presentation-sidebar">
            <PresentationTemplateLibrary
              activeTemplateId={templateId}
              onSelect={(item: PresentationTemplate) => setTemplateId(item.id)}
            />

            <section className="presentation-upload-block">
              <div className="doc-write-material-head">
                <h3>上传 PPT 模板</h3>
              </div>
              <input
                ref={pptxInputRef}
                type="file"
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                hidden
                disabled={busy}
                onChange={(event) => {
                  void handleUploadPptx(event.target.files)
                  event.target.value = ''
                }}
              />
              {uploadedPptxFileName ? (
                <div className="presentation-uploaded-file">
                  <FileText size={14} />
                  <span title={uploadedPptxFileName}>
                    {uploadedPptxFileName}
                    {uploadedPptxRef.current ? `（${uploadedPptxRef.current.slideCount} 页）` : ''}
                  </span>
                  <button type="button" className="doc-write-file-remove" aria-label="移除" disabled={busy} onClick={clearUploadedPptx}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="doc-write-upload-zone presentation-pptx-upload"
                  disabled={busy}
                  onClick={() => pptxInputRef.current?.click()}
                >
                  <Upload size={16} />
                  <span>上传 .pptx（写回原版式 / 提取参考）</span>
                </button>
              )}
            </section>

            {activeSlide && outline ? (
              <section className="presentation-slide-editor">
                <div className="doc-write-material-head">
                  <h3>编辑第 {activeSlideIndex + 1} 页</h3>
                  <span className="presentation-reference-hint">{activeSlide.layout}</span>
                </div>
                <label className="presentation-field">
                  <span>页标题</span>
                  <input
                    type="text"
                    value={activeSlide.title}
                    disabled={busy}
                    onChange={(event) => handleSlidePatch({ title: event.target.value })}
                  />
                </label>
                {activeSlide.layout !== 'title' && activeSlide.layout !== 'chart' ? (
                  <label className="presentation-field">
                    <span>要点（每行一条）</span>
                    <textarea
                      rows={5}
                      value={(activeSlide.bullets ?? []).join('\n')}
                      disabled={busy}
                      onChange={(event) =>
                        handleSlidePatch({
                          bullets: event.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                ) : null}
                {activeSlide.layout === 'chart' ? (
                  <p className="presentation-slide-editor-hint">图表页图片来自「插入图表」，重新插入可更新数据。</p>
                ) : null}
              </section>
            ) : null}
          </aside>
        </div>
      </section>

      <PresentationGenerateModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        templateId={templateId}
        sourceDocument={sourceDocument}
        initialPrompt={savedPrompt}
        templateSlideHints={templateSlideHints}
        onGenerated={handleGenerated}
      />
    </main>
  )
}
