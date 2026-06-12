import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Code2,
  Eye,
  FileDown,
  Loader2,
  Sparkles,
  Upload,
  Trash2,
  FileText,
} from 'lucide-react'
import type { ColorSchemeId } from '../types'
import type { DiagramKind } from '../types/diagram'
import {
  DEFAULT_FLOWCHART_TEMPLATE_ID,
  getFlowchartTemplateById,
  type FlowchartTemplate,
} from '../data/flowchartTemplates'
import {
  DEFAULT_MINDMAP_TEMPLATE_ID,
  getMindmapTemplateById,
  type MindmapTemplate,
} from '../data/mindmapTemplates'
import DiagramColorSchemePicker from './DiagramColorSchemePicker'
import FlowchartTemplateLibrary from './FlowchartTemplateLibrary'
import MindmapTemplateLibrary from './MindmapTemplateLibrary'
import { generateDiagramMermaid } from '../utils/diagramWrite'
import { DEFAULT_DIAGRAM_COLOR_SCHEME_ID, getDiagramColorTheme } from '../utils/diagramColorSchemes'
import { getDiagramKindLabel, loadDiagramDraft, saveDiagramDraft } from '../utils/diagramStorage'
import { renderMermaidToSvg, svgToPngBlob } from '../utils/diagramRender'
import {
  findEditableNodeFromEvent,
  getInlineLabelElement,
  getSvgNodeText,
  readInlineLabelText,
  resolveEditableNodeGroup,
  selectElementContents,
  updateFlowchartNodeLabel,
  updateMindmapNodeLabel,
} from '../utils/diagramSourceEdit'
import { readWriteReferenceFile } from '../utils/documentWrite'
import { isDeepSeekConfigured } from '../utils/deepseek'
import { saveFile } from '../utils/saveFile'
import { loadDocumentDraftForPresentation } from '../utils/presentationStorage'

type ViewMode = 'preview' | 'source'

const PREVIEW_ZOOM_MIN = 40
const PREVIEW_ZOOM_MAX = 200
const PREVIEW_ZOOM_DEFAULT = 100
const PAN_DRAG_THRESHOLD = 5

interface InlineEditSession {
  element: HTMLElement
  nodeId?: string
  lineIndex?: number
  originalText: string
  cleanup: () => void
}

interface DiagramWorkspaceProps {
  kind: DiagramKind
  onSavedLabelChange: (label: string) => void
}

export default function DiagramWorkspace({ kind, onSavedLabelChange }: DiagramWorkspaceProps) {
  const initial = loadDiagramDraft(kind)
  const [title, setTitle] = useState(initial.title)
  const [source, setSource] = useState(initial.source)
  const [prompt, setPrompt] = useState(initial.prompt)
  const [flowchartTemplateId, setFlowchartTemplateId] = useState(
    initial.flowchartTemplateId ?? DEFAULT_FLOWCHART_TEMPLATE_ID,
  )
  const [mindmapTemplateId, setMindmapTemplateId] = useState(
    initial.mindmapTemplateId ?? DEFAULT_MINDMAP_TEMPLATE_ID,
  )
  const [colorSchemeId, setColorSchemeId] = useState<ColorSchemeId>(
    initial.colorSchemeId ?? (kind === 'mindmap' ? 'sunset' : DEFAULT_DIAGRAM_COLOR_SCHEME_ID),
  )
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [previewZoom, setPreviewZoom] = useState(PREVIEW_ZOOM_DEFAULT)
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [svgMarkup, setSvgMarkup] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusIsError, setStatusIsError] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(Date.now())
  const [referenceFileName, setReferenceFileName] = useState('')
  const referenceTextRef = useRef('')
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const previewShellRef = useRef<HTMLDivElement>(null)
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const panActiveRef = useRef(false)
  const inlineEditSessionRef = useRef<InlineEditSession | null>(null)

  const kindLabel = getDiagramKindLabel(kind)
  const activeFlowchartTemplate =
    kind === 'flowchart' ? getFlowchartTemplateById(flowchartTemplateId) : undefined
  const activeMindmapTemplate =
    kind === 'mindmap' ? getMindmapTemplateById(mindmapTemplateId) : undefined
  const activeColorTheme = getDiagramColorTheme(colorSchemeId)
  const previewBackground =
    kind === 'mindmap' ? '#ffffff' : activeColorTheme.previewBackground

  const savedLabel = useMemo(() => {
    const date = new Date(lastSavedAt)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }, [lastSavedAt])

  useEffect(() => {
    onSavedLabelChange(savedLabel)
  }, [savedLabel, onSavedLabelChange])

  const finishInlineEdit = useCallback(
    (cancel = false) => {
      const session = inlineEditSessionRef.current
      if (!session) return

      session.cleanup()
      const { element, nodeId, lineIndex, originalText } = session
      inlineEditSessionRef.current = null
      setIsInlineEditing(false)

      element.contentEditable = 'false'
      element.classList.remove('diagram-node-inline-editing')
      element.spellcheck = false

      const nextText = cancel ? originalText : readInlineLabelText(element)
      if (cancel || !nextText) {
        element.textContent = originalText
        return
      }

      if (nextText === originalText) {
        element.textContent = originalText
        return
      }

      if (kind === 'flowchart' && nodeId) {
        setSource((prev) => updateFlowchartNodeLabel(prev, nodeId, nextText))
      } else if (kind === 'mindmap' && lineIndex != null && !Number.isNaN(lineIndex)) {
        setSource((prev) => updateMindmapNodeLabel(prev, lineIndex, nextText))
      } else {
        element.textContent = originalText
        return
      }

      setStatusIsError(false)
      setStatusMessage('节点文字已更新')
    },
    [kind],
  )

  useEffect(() => {
    setPreviewPan({ x: 0, y: 0 })
    const session = inlineEditSessionRef.current
    if (session) {
      session.cleanup()
      session.element.contentEditable = 'false'
      session.element.classList.remove('diagram-node-inline-editing')
      inlineEditSessionRef.current = null
      setIsInlineEditing(false)
    }
  }, [svgMarkup])

  const previewZoomRef = useRef(previewZoom)
  const previewPanRef = useRef(previewPan)
  useEffect(() => {
    previewZoomRef.current = previewZoom
  }, [previewZoom])
  useEffect(() => {
    previewPanRef.current = previewPan
  }, [previewPan])

  useEffect(() => {
    const shell = previewShellRef.current
    if (!shell || !svgMarkup || renderError) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = shell.getBoundingClientRect()
      const step = event.deltaY > 0 ? -5 : 5
      const currentZoom = previewZoomRef.current
      const currentPan = previewPanRef.current
      const nextZoom = Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, currentZoom + step))
      if (nextZoom === currentZoom) return

      const px = event.clientX - rect.left - rect.width / 2
      const py = event.clientY - rect.top - rect.height / 2
      const scaleRatio = nextZoom / currentZoom

      setPreviewZoom(nextZoom)
      setPreviewPan({
        x: px - (px - currentPan.x) * scaleRatio,
        y: py - (py - currentPan.y) * scaleRatio,
      })
    }

    shell.addEventListener('wheel', handleWheel, { passive: false })
    return () => shell.removeEventListener('wheel', handleWheel)
  }, [svgMarkup, renderError])

  const handlePreviewPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !svgMarkup || renderError || isInlineEditing) return
      const target = event.target as HTMLElement
      if (target.closest('[contenteditable="true"], .diagram-node-inline-editing')) return
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: previewPan.x,
        panY: previewPan.y,
      }
      panActiveRef.current = false
      setIsPanning(false)
    },
    [svgMarkup, renderError, isInlineEditing, previewPan.x, previewPan.y],
  )

  const handlePreviewPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!panActiveRef.current) {
      if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD) return
      panActiveRef.current = true
      setIsPanning(true)
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    }
    setPreviewPan({
      x: start.panX + dx,
      y: start.panY + dy,
    })
  }, [])

  const endPreviewPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return
    panStartRef.current = null
    panActiveRef.current = false
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const startInlineEdit = useCallback(
    (target: Element) => {
      if (inlineEditSessionRef.current) {
        finishInlineEdit(false)
      }

      const nodeGroup = resolveEditableNodeGroup(target)
      if (!nodeGroup) return

      const labelEl = getInlineLabelElement(nodeGroup)
      if (!labelEl) return

      const nodeId = nodeGroup.getAttribute('data-cc-node-id') ?? undefined
      const lineIndexRaw = nodeGroup.getAttribute('data-cc-line-index')
      const lineIndex =
        lineIndexRaw != null ? Number.parseInt(lineIndexRaw, 10) : undefined
      const originalText =
        nodeGroup.getAttribute('data-cc-label') ||
        readInlineLabelText(labelEl) ||
        getSvgNodeText(nodeGroup)

      labelEl.textContent = originalText
      labelEl.contentEditable = 'true'
      labelEl.spellcheck = false
      labelEl.classList.add('diagram-node-inline-editing')

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          finishInlineEdit(false)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          finishInlineEdit(true)
        }
      }

      const onBlur = () => {
        window.setTimeout(() => {
          if (inlineEditSessionRef.current?.element === labelEl) {
            finishInlineEdit(false)
          }
        }, 0)
      }

      labelEl.addEventListener('keydown', onKeyDown)
      labelEl.addEventListener('blur', onBlur)

      inlineEditSessionRef.current = {
        element: labelEl,
        nodeId,
        lineIndex,
        originalText,
        cleanup: () => {
          labelEl.removeEventListener('keydown', onKeyDown)
          labelEl.removeEventListener('blur', onBlur)
        },
      }
      setIsInlineEditing(true)

      window.requestAnimationFrame(() => {
        labelEl.focus()
        selectElementContents(labelEl)
      })
    },
    [finishInlineEdit],
  )

  const handlePreviewDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!svgMarkup || renderError) return
      const node = findEditableNodeFromEvent(event.nativeEvent)
      if (!node) return
      event.preventDefault()
      event.stopPropagation()
      panStartRef.current = null
      panActiveRef.current = false
      setIsPanning(false)
      startInlineEdit(node)
    },
    [svgMarkup, renderError, startInlineEdit],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveDiagramDraft(kind, {
        source,
        prompt,
        title,
        flowchartTemplateId: kind === 'flowchart' ? flowchartTemplateId : undefined,
        mindmapTemplateId: kind === 'mindmap' ? mindmapTemplateId : undefined,
        colorSchemeId,
      })
      setLastSavedAt(Date.now())
    }, 400)
    return () => {
      window.clearTimeout(timer)
      saveDiagramDraft(kind, {
        source,
        prompt,
        title,
        flowchartTemplateId: kind === 'flowchart' ? flowchartTemplateId : undefined,
        mindmapTemplateId: kind === 'mindmap' ? mindmapTemplateId : undefined,
        colorSchemeId,
      })
    }
  }, [kind, source, prompt, title, flowchartTemplateId, mindmapTemplateId, colorSchemeId])

  const refreshPreview = useCallback(async () => {
    if (!source.trim()) {
      setSvgMarkup('')
      setRenderError('请先输入或生成 Mermaid 代码')
      return
    }

    setRenderError(null)
    try {
      const svg = await renderMermaidToSvg(source, kind, colorSchemeId, activeMindmapTemplate)
      setSvgMarkup(svg)
    } catch (err) {
      setSvgMarkup('')
      setRenderError(err instanceof Error ? err.message : '渲染失败')
    }
  }, [source, kind, colorSchemeId, activeMindmapTemplate])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPreview()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [refreshPreview])

  const handleApplyFlowchartTemplate = useCallback((template: FlowchartTemplate, withSample: boolean) => {
    setFlowchartTemplateId(template.id)
    setSource(withSample ? template.sampleSource : template.skeletonSource)
    setViewMode('preview')
    setStatusIsError(false)
    setStatusMessage(withSample ? `已载入「${template.name}」示例` : `已应用「${template.name}」样式骨架`)
  }, [])

  const handleApplyMindmapTemplate = useCallback((template: MindmapTemplate, withSample: boolean) => {
    setMindmapTemplateId(template.id)
    setSource(withSample ? template.sampleSource : template.skeletonSource)
    setViewMode('preview')
    setStatusIsError(false)
    setStatusMessage(withSample ? `已载入「${template.name}」示例` : `已应用「${template.name}」样式骨架`)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setStatusIsError(true)
      setStatusMessage('请先填写生成需求')
      return
    }
    if (!isDeepSeekConfigured()) {
      setStatusIsError(true)
      setStatusMessage('未配置 DeepSeek：请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY')
      return
    }

    setBusy(true)
    setStatusMessage(null)
    setStatusIsError(false)

    try {
      const docDraft = loadDocumentDraftForPresentation()
      const combinedRef = [referenceTextRef.current.trim(), docDraft.trim()].filter(Boolean).join('\n\n') || undefined
      const next = await generateDiagramMermaid({
        kind,
        prompt,
        sourceDocument: combinedRef,
        flowchartTemplate: kind === 'flowchart' ? activeFlowchartTemplate : undefined,
        mindmapTemplate: kind === 'mindmap' ? activeMindmapTemplate : undefined,
      })
      setSource(next)
      setViewMode('preview')
      setStatusIsError(false)
      setStatusMessage(`${kindLabel}已生成，可在预览中查看或继续编辑代码`)
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : '生成失败')
    } finally {
      setBusy(false)
    }
  }, [kind, prompt, kindLabel, activeFlowchartTemplate, activeMindmapTemplate])

  const handleUploadReference = useCallback(async (file: File) => {
    setBusy(true)
    setStatusMessage(null)
    setStatusIsError(false)
    try {
      const text = await readWriteReferenceFile(file)
      referenceTextRef.current = text
      setReferenceFileName(file.name)
      setStatusIsError(false)
      setStatusMessage(`已加载参考文档「${file.name}」`)
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : '参考文档读取失败')
    } finally {
      setBusy(false)
    }
  }, [])

  const handleExportSvg = useCallback(async () => {
    if (!svgMarkup) {
      setStatusIsError(true)
      setStatusMessage('请先确保预览渲染成功')
      return
    }
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
    const saved = await saveFile(blob, {
      suggestedName: `${title || kindLabel}.svg`,
      description: 'SVG 矢量图',
      accept: { 'image/svg+xml': ['.svg'] },
    })
    if (saved) {
      setStatusIsError(false)
      setStatusMessage('SVG 已导出')
    }
  }, [svgMarkup, title, kindLabel])

  const handleExportPng = useCallback(async () => {
    if (!svgMarkup) {
      setStatusIsError(true)
      setStatusMessage('请先确保预览渲染成功')
      return
    }
    setBusy(true)
    try {
      const blob = await svgToPngBlob(svgMarkup, 2, activeColorTheme.exportBackground)
      const saved = await saveFile(blob, {
        suggestedName: `${title || kindLabel}.png`,
        description: 'PNG 图片',
        accept: { 'image/png': ['.png'] },
      })
      if (saved) {
        setStatusIsError(false)
        setStatusMessage('PNG 已导出')
      }
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : 'PNG 导出失败')
    } finally {
      setBusy(false)
    }
  }, [svgMarkup, title, kindLabel, activeColorTheme.exportBackground])

  return (
    <main className="app-main document-main diagram-main">
      <section className="panel panel-document panel-diagram">
        <div className="panel-header document-toolbar-header">
          <div className="document-panel-title">
            {kind === 'flowchart' ? <Code2 size={20} /> : <Sparkles size={20} />}
            <div>
              <h2>{kindLabel}</h2>
              <p>{kind === 'flowchart' ? 'AI 生成 · Mermaid 编辑 · SVG/PNG 导出' : '树形导图 · AI 生成 · SVG/PNG 导出'}</p>
            </div>
          </div>
          <div className="document-toolbar-actions">
            <div className="presentation-view-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`presentation-view-tab${viewMode === 'preview' ? ' active' : ''}`}
                aria-selected={viewMode === 'preview'}
                disabled={busy}
                onClick={() => setViewMode('preview')}
              >
                <Eye size={14} />
                预览
              </button>
              <button
                type="button"
                role="tab"
                className={`presentation-view-tab${viewMode === 'source' ? ' active' : ''}`}
                aria-selected={viewMode === 'source'}
                disabled={busy}
                onClick={() => setViewMode('source')}
              >
                <Code2 size={14} />
                源码
              </button>
            </div>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void handleGenerate()}>
              {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              AI 生成
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy || !svgMarkup} onClick={() => void handleExportSvg()}>
              <FileDown size={14} />
              SVG
            </button>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy || !svgMarkup} onClick={() => void handleExportPng()}>
              <FileDown size={14} />
              PNG
            </button>
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
            <div className="document-workspace-main diagram-workspace-main">
              {viewMode === 'preview' ? (
                <div
                  ref={previewShellRef}
                  className={`diagram-preview-shell diagram-preview-panel${
                    kind === 'mindmap' ? ' diagram-preview-shell-mindmap' : ''
                  }${svgMarkup && !renderError ? ' diagram-preview-shell-pannable' : ''}${
                    isPanning ? ' diagram-preview-shell-dragging' : ''
                  }`}
                  style={{ background: previewBackground }}
                  title="双击节点直接改字；按住左键拖拽平移，滚轮缩放"
                  onDoubleClick={handlePreviewDoubleClick}
                  onPointerDown={handlePreviewPointerDown}
                  onPointerMove={handlePreviewPointerMove}
                  onPointerUp={endPreviewPan}
                  onPointerCancel={endPreviewPan}
                >
                  {renderError ? (
                    <div className="presentation-empty-state diagram-render-error">
                      <p>{renderError}</p>
                      <div className="diagram-render-error-actions">
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => void refreshPreview()}>
                          刷新重试
                        </button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setViewMode('source')}>
                          编辑源码
                        </button>
                      </div>
                    </div>
                  ) : svgMarkup ? (
                    <div
                      ref={previewRef}
                      className="diagram-preview-canvas"
                      style={{
                        transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom / 100})`,
                        transformOrigin: 'center center',
                        transition: isPanning ? 'none' : 'transform 0.12s ease-out',
                      }}
                      dangerouslySetInnerHTML={{ __html: svgMarkup }}
                    />
                  ) : (
                    <div className="presentation-empty-state">
                      <Loader2 size={24} className="spin" />
                      <p>正在渲染…</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="document-editor-shell diagram-editor-shell">
                  <textarea
                    className="document-editor diagram-source-editor"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    spellCheck={false}
                    placeholder={
                      kind === 'flowchart'
                        ? 'flowchart TD\n  A[开始] --> B[结束]'
                        : '---\nconfig:\n  layout: tidy-tree\n---\nmindmap\n  root((主题))\n    分支A\n      子项'
                    }
                  />
                </div>
              )}
            </div>
            <div className="data-hint document-editor-hint">
              <strong>{kindLabel}：</strong>
              {kind === 'flowchart'
                ? '右侧选择版式样式与配色，描述业务流程后 AI 生成；预览区双击节点直接改字，左键拖拽平移，滚轮缩放。'
                : '右侧选择导图样式，从中心主题树形展开；预览区双击节点直接改字，左键拖拽平移，滚轮缩放。'}
            </div>
          </div>

          <aside className="document-sidebar diagram-sidebar">
            {kind === 'flowchart' ? (
              <FlowchartTemplateLibrary
                activeTemplateId={flowchartTemplateId}
                onApply={handleApplyFlowchartTemplate}
              />
            ) : (
              <MindmapTemplateLibrary
                activeTemplateId={mindmapTemplateId}
                onApply={handleApplyMindmapTemplate}
              />
            )}

            <div className="diagram-sidebar-settings">
              <DiagramColorSchemePicker
                value={colorSchemeId}
                disabled={busy}
                onChange={setColorSchemeId}
              />

              <section className="diagram-side-block">
                <div className="doc-write-material-head">
                  <h3>标题</h3>
                </div>
                <input
                  className="diagram-title-input"
                  type="text"
                  value={title}
                  disabled={busy}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={`${kindLabel}标题`}
                />
              </section>

              <section className="diagram-side-block">
                <div className="doc-write-material-head">
                  <h3>生成需求</h3>
                  {kind === 'flowchart' && activeFlowchartTemplate ? (
                    <span className="presentation-reference-hint">{activeFlowchartTemplate.name}</span>
                  ) : null}
                  {kind === 'mindmap' && activeMindmapTemplate ? (
                    <span className="presentation-reference-hint">{activeMindmapTemplate.name}</span>
                  ) : null}
                </div>
                <textarea
                  className="diagram-prompt-input"
                  rows={5}
                  value={prompt}
                  disabled={busy}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={
                    kind === 'flowchart'
                      ? '例如：描述项目立项审批流程，包含申请、部门审核、领导审批、归档。'
                      : '例如：围绕股权处置议题，展开两个并列方案，每个方案下列路径、情形与要点。'
                  }
                />
              </section>

              <section className="diagram-side-block">
                <div className="doc-write-material-head">
                  <h3>参考文档</h3>
                  <span className="presentation-reference-hint">可选 .docx</span>
                </div>
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept=".docx,.txt,.md"
                  hidden
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void handleUploadReference(file)
                  }}
                />
                {referenceFileName ? (
                  <div className="presentation-uploaded-file">
                    <FileText size={14} />
                    <span title={referenceFileName}>{referenceFileName}</span>
                    <button
                      type="button"
                      className="doc-write-file-remove"
                      aria-label="移除"
                      disabled={busy}
                      onClick={() => {
                        referenceTextRef.current = ''
                        setReferenceFileName('')
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="doc-write-upload-zone presentation-pptx-upload"
                    disabled={busy}
                    onClick={() => referenceInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    <span>上传参考文档</span>
                  </button>
                )}
              </section>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
