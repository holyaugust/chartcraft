import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import DiagramFlowchartToolbar, { DiagramLinkPickBanner } from './DiagramFlowchartToolbar'
import DiagramInlineTextEditor from './DiagramInlineTextEditor'
import DiagramNodeToolbar from './DiagramNodeToolbar'
import FlowchartTemplateLibrary from './FlowchartTemplateLibrary'
import MindmapTemplateLibrary from './MindmapTemplateLibrary'
import { generateDiagramMermaid, modifyFlowchartNodeWithAi } from '../utils/diagramWrite'
import { DEFAULT_DIAGRAM_COLOR_SCHEME_ID, getDiagramColorTheme, getMindmapPreviewBackground } from '../utils/diagramColorSchemes'
import { getDiagramKindLabel, loadDiagramDraft, saveDiagramDraft } from '../utils/diagramStorage'
import { renderMermaidToSvg, svgToPngBlob } from '../utils/diagramRender'
import {
  applyFlowchartLinkPickColorVars,
  attachDiagramEditMetadataToDom,
  clearFlowchartLinkPickColorVars,
  computeNodeEditLayout,
  findEditableNodeFromEvent,
  getInlineLabelElement,
  getSvgNodeText,
  readInlineLabelText,
  resolveEditableNodeGroup,
  resolveNodeEditTarget,
  selectElementContents,
  updateFlowchartNodeLabel,
  updateMindmapNodeLabel,
} from '../utils/diagramSourceEdit'
import {
  addFlowchartBranch,
  addFlowchartNodeDownstream,
  addMindmapChild,
  addMindmapSibling,
  connectFlowchartNodes,
  deleteFlowchartNode,
  deleteMindmapNode,
  getNodeSelectionFromElement,
  isFlowchartDecision,
  type DiagramNodeSelection,
} from '../utils/diagramStructureEdit'
import { readWriteReferenceFile } from '../utils/documentWrite'
import { isDeepSeekConfigured } from '../utils/deepseek'
import { saveFile } from '../utils/saveFile'
import { loadDocumentDraftForPresentation } from '../utils/presentationStorage'
import { useDiagramSourceHistory } from '../hooks/useDiagramSourceHistory'

type ViewMode = 'preview' | 'source'

const PREVIEW_ZOOM_MIN = 40
const PREVIEW_ZOOM_MAX = 200
const PREVIEW_ZOOM_DEFAULT = 100
const PAN_DRAG_THRESHOLD = 5
const DOUBLE_CLICK_MS = 400

const LINK_PICK_HOVER_CLASS = 'diagram-node-link-hover'
const LINK_PICK_PICKED_CLASS = 'diagram-node-link-picked'
const LINK_PICK_DISABLED_CLASS = 'diagram-node-link-disabled'

function clearLinkPickTargetHighlight(el: Element | null) {
  clearFlowchartLinkPickColorVars(el)
  el?.classList.remove(LINK_PICK_HOVER_CLASS, LINK_PICK_PICKED_CLASS, LINK_PICK_DISABLED_CLASS)
  el?.querySelectorAll('foreignObject div, foreignObject span, foreignObject p').forEach((labelEl) => {
    labelEl.classList.remove(
      'diagram-node-link-label-highlight',
      'diagram-node-link-label-picked',
      'diagram-node-link-label-disabled',
    )
  })
}

function resolveLinkPickNodeGroup(clientX: number, clientY: number): Element | null {
  const group = resolveLinkPickTargetGroup(clientX, clientY)
  if (!group) return null
  return group.closest('g.node') ?? group
}

function applyLinkPickTargetHighlight(nodeGroup: Element, mode: 'hover' | 'picked' | 'disabled') {
  nodeGroup.classList.remove(LINK_PICK_HOVER_CLASS, LINK_PICK_PICKED_CLASS, LINK_PICK_DISABLED_CLASS)
  nodeGroup.classList.add(
    mode === 'hover'
      ? LINK_PICK_HOVER_CLASS
      : mode === 'picked'
        ? LINK_PICK_PICKED_CLASS
        : LINK_PICK_DISABLED_CLASS,
  )
  applyFlowchartLinkPickColorVars(nodeGroup, mode)
  nodeGroup.querySelectorAll('foreignObject div, foreignObject span, foreignObject p').forEach((labelEl) => {
    labelEl.classList.remove(
      'diagram-node-link-label-highlight',
      'diagram-node-link-label-picked',
      'diagram-node-link-label-disabled',
    )
    if (mode === 'hover') labelEl.classList.add('diagram-node-link-label-highlight')
    if (mode === 'picked') {
      labelEl.classList.add('diagram-node-link-label-highlight', 'diagram-node-link-label-picked')
    }
    if (mode === 'disabled') labelEl.classList.add('diagram-node-link-label-disabled')
  })
}

function resolveLinkPickTargetGroup(clientX: number, clientY: number): Element | null {
  const hit = document.elementFromPoint(clientX, clientY)
  if (!hit) return null
  if (
    (hit as HTMLElement).closest(
      '.diagram-link-pick-banner, .diagram-node-toolbar, .diagram-flowchart-toolbar, .diagram-inline-text-editor',
    )
  ) {
    return null
  }
  return resolveEditableNodeGroup(hit)
}

interface InlineEditSession {
  mode: 'dom' | 'overlay'
  element?: HTMLElement
  nodeId?: string
  lineIndex?: number
  originalText: string
  text: string
  layout?: ReturnType<typeof computeNodeEditLayout>
  cleanup?: () => void
}

interface FlowchartLinkPick {
  fromNodeId: string
  fromLabel: string
  edgeLabel?: string
}

interface DiagramWorkspaceProps {
  kind: DiagramKind
  onSavedLabelChange: (label: string) => void
}

export default function DiagramWorkspace({ kind, onSavedLabelChange }: DiagramWorkspaceProps) {
  const initial = loadDiagramDraft(kind)
  const [title, setTitle] = useState(initial.title)
  const { source, setSource, setSourceDebounced, undo, redo } = useDiagramSourceHistory(initial.source)
  const [prompt, setPrompt] = useState(initial.prompt)
  const [flowchartTemplateId, setFlowchartTemplateId] = useState(
    initial.flowchartTemplateId ?? DEFAULT_FLOWCHART_TEMPLATE_ID,
  )
  const [mindmapTemplateId, setMindmapTemplateId] = useState(
    initial.mindmapTemplateId ?? DEFAULT_MINDMAP_TEMPLATE_ID,
  )
  const [colorSchemeId, setColorSchemeId] = useState<ColorSchemeId>(
    initial.colorSchemeId ?? (kind === 'mindmap' ? 'vivid' : DEFAULT_DIAGRAM_COLOR_SCHEME_ID),
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
  const [inlineEditState, setInlineEditState] = useState<InlineEditSession | null>(null)
  const pointerDownNodeRef = useRef<Element | null>(null)
  const selectedNodeRef = useRef<DiagramNodeSelection | null>(null)
  const [selectedNode, setSelectedNode] = useState<DiagramNodeSelection | null>(null)
  const [showNodeToolbar, setShowNodeToolbar] = useState(false)
  const [toolbarPos, setToolbarPos] = useState({ left: 0, top: 0 })
  const toolbarDelayRef = useRef<number | null>(null)
  const suppressSelectionUntilRef = useRef(0)
  const lastPointerClickRef = useRef<{ time: number; node: Element | null }>({ time: 0, node: null })
  const linkPickModeRef = useRef<FlowchartLinkPick | null>(null)
  const linkPickHoverElRef = useRef<Element | null>(null)
  const linkPickPickedElRef = useRef<Element | null>(null)
  const [flowchartEdgeLabel, setFlowchartEdgeLabel] = useState('')
  const [linkPickMode, setLinkPickMode] = useState<FlowchartLinkPick | null>(null)
  const [nodeAiPrompt, setNodeAiPrompt] = useState('')
  const [nodeAiBusy, setNodeAiBusy] = useState(false)

  const kindLabel = getDiagramKindLabel(kind)
  const activeFlowchartTemplate =
    kind === 'flowchart' ? getFlowchartTemplateById(flowchartTemplateId) : undefined
  const activeMindmapTemplate =
    kind === 'mindmap' ? getMindmapTemplateById(mindmapTemplateId) : undefined
  const activeColorTheme = getDiagramColorTheme(colorSchemeId)
  const previewBackground =
    kind === 'mindmap' ? getMindmapPreviewBackground(colorSchemeId) : activeColorTheme.previewBackground

  const savedLabel = useMemo(() => {
    const date = new Date(lastSavedAt)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }, [lastSavedAt])

  useEffect(() => {
    onSavedLabelChange(savedLabel)
  }, [savedLabel, onSavedLabelChange])

  useEffect(() => {
    selectedNodeRef.current = selectedNode
  }, [selectedNode])

  useEffect(() => {
    linkPickModeRef.current = linkPickMode
  }, [linkPickMode])

  const clearLinkPickHover = useCallback(() => {
    clearLinkPickTargetHighlight(linkPickHoverElRef.current)
    linkPickHoverElRef.current = null
  }, [])

  const clearLinkPickHighlights = useCallback(() => {
    clearLinkPickHover()
    clearLinkPickTargetHighlight(linkPickPickedElRef.current)
    linkPickPickedElRef.current = null
  }, [clearLinkPickHover])

  const updateLinkPickHover = useCallback(
    (clientX: number, clientY: number, fromNodeId: string) => {
      if (panActiveRef.current) {
        clearLinkPickHover()
        return
      }
      const nodeGroup = resolveLinkPickNodeGroup(clientX, clientY)
      if (linkPickHoverElRef.current === nodeGroup) return

      clearLinkPickTargetHighlight(linkPickHoverElRef.current)
      linkPickHoverElRef.current = nodeGroup

      if (!nodeGroup) return
      const nodeId = nodeGroup.getAttribute('data-cc-node-id')
      applyLinkPickTargetHighlight(
        nodeGroup,
        nodeId === fromNodeId ? 'disabled' : 'hover',
      )
    },
    [clearLinkPickHover],
  )

  const markLinkPickTargetPicked = useCallback(
    (nodeGroup: Element) => {
      clearLinkPickHover()
      clearLinkPickTargetHighlight(linkPickPickedElRef.current)
      linkPickPickedElRef.current = nodeGroup
      applyLinkPickTargetHighlight(nodeGroup, 'picked')
    },
    [clearLinkPickHover],
  )

  useEffect(() => {
    if (!linkPickMode) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLinkPickMode(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [linkPickMode])

  useEffect(() => {
    if (!linkPickMode) {
      clearLinkPickHighlights()
      return
    }
    const shell = previewShellRef.current
    if (!shell) return

    const fromNodeId = linkPickMode.fromNodeId
    const onPointerMove = (event: PointerEvent) => {
      updateLinkPickHover(event.clientX, event.clientY, fromNodeId)
    }
    const onPointerLeave = () => clearLinkPickHover()

    shell.addEventListener('pointermove', onPointerMove)
    shell.addEventListener('pointerleave', onPointerLeave)
    return () => {
      shell.removeEventListener('pointermove', onPointerMove)
      shell.removeEventListener('pointerleave', onPointerLeave)
      clearLinkPickHighlights()
    }
  }, [linkPickMode, updateLinkPickHover, clearLinkPickHover, clearLinkPickHighlights])

  useEffect(() => {
    if (!selectedNode || isInlineEditing) {
      setShowNodeToolbar(false)
      if (toolbarDelayRef.current != null) {
        window.clearTimeout(toolbarDelayRef.current)
        toolbarDelayRef.current = null
      }
      return
    }

    setShowNodeToolbar(false)
    if (toolbarDelayRef.current != null) {
      window.clearTimeout(toolbarDelayRef.current)
    }
    toolbarDelayRef.current = window.setTimeout(() => {
      toolbarDelayRef.current = null
      setShowNodeToolbar(true)
    }, 450)

    return () => {
      if (toolbarDelayRef.current != null) {
        window.clearTimeout(toolbarDelayRef.current)
        toolbarDelayRef.current = null
      }
    }
  }, [selectedNode, isInlineEditing])

  const finishInlineEdit = useCallback(
    (cancel = false) => {
      const session = inlineEditSessionRef.current
      if (!session) return

      session.cleanup?.()
      const { mode, element, nodeId, lineIndex, originalText, text } = session
      inlineEditSessionRef.current = null
      setInlineEditState(null)
      setIsInlineEditing(false)

      if (mode === 'dom' && element) {
        element.contentEditable = 'false'
        element.classList.remove('diagram-node-inline-editing')
        element.spellcheck = false
      }

      const nextText = (cancel ? originalText : mode === 'dom' && element ? readInlineLabelText(element) : text).trim()
      if (cancel || !nextText || nextText === originalText) {
        if (mode === 'dom' && element) element.textContent = originalText
        return
      }

      if (kind === 'flowchart' && nodeId) {
        setSource((prev) => updateFlowchartNodeLabel(prev, nodeId, nextText))
      } else if (kind === 'mindmap' && lineIndex != null && !Number.isNaN(lineIndex)) {
        setSource((prev) => updateMindmapNodeLabel(prev, lineIndex, nextText))
      } else {
        if (mode === 'dom' && element) element.textContent = originalText
        return
      }

      setStatusIsError(false)
      setStatusMessage('节点文字已更新')
    },
    [kind, setSource],
  )

  useEffect(() => {
    setPreviewPan({ x: 0, y: 0 })
    setSelectedNode(null)
    linkPickHoverElRef.current = null
    linkPickPickedElRef.current = null
    const session = inlineEditSessionRef.current
    if (session) {
      session.cleanup?.()
      if (session.mode === 'dom' && session.element) {
        session.element.contentEditable = 'false'
        session.element.classList.remove('diagram-node-inline-editing')
      }
    }
    inlineEditSessionRef.current = null
    setInlineEditState(null)
    setIsInlineEditing(false)
  }, [svgMarkup])

  useLayoutEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !svgMarkup) return
    attachDiagramEditMetadataToDom(canvas, source, kind)
  }, [svgMarkup, source, kind])

  useLayoutEffect(() => {
    const canvas = previewRef.current
    const shell = previewShellRef.current
    if (!canvas || !shell || !selectedNode) return

    canvas.querySelectorAll('.diagram-node-selected').forEach((node) => {
      node.classList.remove('diagram-node-selected')
    })

    const selector = selectedNode.nodeId
      ? `[data-cc-node-id="${selectedNode.nodeId}"]`
      : `[data-cc-line-index="${selectedNode.lineIndex}"]`
    const el = canvas.querySelector(selector)
    if (!el) {
      setSelectedNode(null)
      return
    }

    el.classList.add('diagram-node-selected')
    const shellRect = shell.getBoundingClientRect()
    const nodeRect = el.getBoundingClientRect()
    setToolbarPos({
      left: nodeRect.left - shellRect.left + nodeRect.width / 2,
      top: nodeRect.bottom - shellRect.top + 8,
    })

    return () => {
      el.classList.remove('diagram-node-selected')
    }
  }, [selectedNode, svgMarkup, previewPan, previewZoom])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return

      const isRedo = key === 'y' || (key === 'z' && event.shiftKey)
      const isUndo = key === 'z' && !event.shiftKey
      if (!isUndo && !isRedo) return

      if (inlineEditSessionRef.current) {
        finishInlineEdit(true)
      }

      const handled = isRedo ? redo() : undo()
      if (!handled) return

      event.preventDefault()
      setSelectedNode(null)
      setStatusIsError(false)
      setStatusMessage(isRedo ? '已重做' : '已撤销')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, finishInlineEdit])

  const resolveFlowchartNodeId = useCallback(
    (element: Element) => resolveNodeEditTarget(element, source, 'flowchart').nodeId,
    [source],
  )

  const applyStructureChange = useCallback(
    (updater: (prev: string) => string, message: string) => {
      if (inlineEditSessionRef.current) {
        const session = inlineEditSessionRef.current
        session.cleanup?.()
        if (session.mode === 'dom' && session.element) {
          session.element.contentEditable = 'false'
          session.element.classList.remove('diagram-node-inline-editing')
        }
        inlineEditSessionRef.current = null
        setInlineEditState(null)
        setIsInlineEditing(false)
      }
      setLinkPickMode(null)
      setSource((prev) => updater(prev))
      setSelectedNode(null)
      setStatusIsError(false)
      setStatusMessage(message)
    },
    [setSource],
  )

  const startFlowchartLinkPick = useCallback(() => {
    const node = selectedNodeRef.current
    if (!node?.nodeId) return
    setShowNodeToolbar(false)
    setLinkPickMode({
      fromNodeId: node.nodeId,
      fromLabel: node.label || node.nodeId,
      edgeLabel: flowchartEdgeLabel.trim() || undefined,
    })
    setStatusIsError(false)
    setStatusMessage(`请悬浮并单击目标节点（从「${node.label || node.nodeId}」出发）`)
  }, [flowchartEdgeLabel])

  const handleAddFlowchartStep = useCallback(() => {
    const node = selectedNodeRef.current
    if (!node?.nodeId) return
    const edgeLabel = flowchartEdgeLabel.trim() || undefined
    applyStructureChange(
      (prev) => addFlowchartNodeDownstream(prev, node.nodeId!, 'step', undefined, edgeLabel),
      edgeLabel ? `已添加步骤（${edgeLabel}）` : '已添加步骤节点',
    )
  }, [applyStructureChange, flowchartEdgeLabel])

  const handleAddFlowchartDecision = useCallback(() => {
    const node = selectedNodeRef.current
    if (!node?.nodeId) return
    const edgeLabel = flowchartEdgeLabel.trim() || undefined
    applyStructureChange(
      (prev) => addFlowchartNodeDownstream(prev, node.nodeId!, 'decision', undefined, edgeLabel),
      edgeLabel ? `已添加判断（${edgeLabel}）` : '已添加判断节点',
    )
  }, [applyStructureChange, flowchartEdgeLabel])

  const handleAddFlowchartBranch = useCallback(() => {
    const node = selectedNodeRef.current
    if (!node?.nodeId) return
    const edgeLabel = flowchartEdgeLabel.trim() || undefined
    applyStructureChange(
      (prev) => addFlowchartBranch(prev, node.nodeId!, 'step', undefined, edgeLabel),
      edgeLabel ? `已添加分支（${edgeLabel}）` : '已添加分支',
    )
  }, [applyStructureChange, flowchartEdgeLabel])

  const handleFlowchartAiModify = useCallback(async () => {
    const node = selectedNodeRef.current
    if (!node?.nodeId || !nodeAiPrompt.trim()) return
    if (!isDeepSeekConfigured()) {
      setStatusIsError(true)
      setStatusMessage('未配置 DeepSeek：请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY')
      return
    }

    setNodeAiBusy(true)
    setStatusMessage(null)
    setStatusIsError(false)
    try {
      const next = await modifyFlowchartNodeWithAi({
        source,
        selectedNodeId: node.nodeId,
        selectedNodeLabel: node.label || node.nodeId,
        instruction: nodeAiPrompt,
        flowchartTemplate: activeFlowchartTemplate,
      })
      setLinkPickMode(null)
      setSource(next)
      setSelectedNode(null)
      setNodeAiPrompt('')
      setStatusIsError(false)
      setStatusMessage(`已按 AI 建议更新「${node.label || node.nodeId}」相关分支`)
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : 'AI 修改失败')
    } finally {
      setNodeAiBusy(false)
    }
  }, [nodeAiPrompt, source, activeFlowchartTemplate, setSource])

  const handleAddMindmapChild = useCallback(() => {
    const node = selectedNodeRef.current
    if (node?.lineIndex == null) return
    applyStructureChange((prev) => addMindmapChild(prev, node.lineIndex!), '已添加子节点')
  }, [applyStructureChange])

  const handleAddMindmapSibling = useCallback(() => {
    const node = selectedNodeRef.current
    if (node?.lineIndex == null || node.isRoot) return
    applyStructureChange((prev) => addMindmapSibling(prev, node.lineIndex!), '已添加同级节点')
  }, [applyStructureChange])

  const handleDeleteSelectedNode = useCallback(() => {
    const node = selectedNodeRef.current
    if (!node || node.isRoot) return
    if (kind === 'flowchart' && node.nodeId) {
      applyStructureChange((prev) => deleteFlowchartNode(prev, node.nodeId!), '已删除节点')
    } else if (kind === 'mindmap' && node.lineIndex != null) {
      applyStructureChange((prev) => deleteMindmapNode(prev, node.lineIndex!), '已删除节点')
    }
  }, [kind, applyStructureChange])

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
      if (
        target.closest(
          '[contenteditable="true"], .diagram-node-inline-editing, .diagram-inline-text-editor, .diagram-node-toolbar, .diagram-flowchart-toolbar, .diagram-link-pick-banner',
        )
      ) {
        return
      }

      const clicked = resolveEditableNodeGroup(event.target as Element)
      pointerDownNodeRef.current = clicked

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
      clearLinkPickTargetHighlight(linkPickHoverElRef.current)
      linkPickHoverElRef.current = null
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    }
    setPreviewPan({
      x: start.panX + dx,
      y: start.panY + dy,
    })
  }, [])

  const getNodeClickKey = useCallback((node: Element) => {
    return (
      node.getAttribute('data-cc-node-id') ??
      node.getAttribute('data-cc-line-index') ??
      node.getAttribute('id') ??
      getSvgNodeText(node)
    )
  }, [])

  const startInlineEdit = useCallback(
    (target: Element) => {
      if (inlineEditSessionRef.current) {
        finishInlineEdit(false)
      }

      const shell = previewShellRef.current
      const nodeGroup = resolveEditableNodeGroup(target)
      if (!nodeGroup || !shell) return

      const editTarget = resolveNodeEditTarget(nodeGroup, source, kind)
      const labelEl = getInlineLabelElement(nodeGroup)
      const originalText =
        nodeGroup.getAttribute('data-cc-label') ||
        (labelEl ? readInlineLabelText(labelEl) : '') ||
        getSvgNodeText(nodeGroup) ||
        '节点'

      const nodeId = editTarget.nodeId
      const lineIndex = editTarget.lineIndex

      if (labelEl) {
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
            if (inlineEditSessionRef.current?.element !== labelEl) return
            finishInlineEdit(false)
          }, 0)
        }

        labelEl.addEventListener('keydown', onKeyDown)
        labelEl.addEventListener('blur', onBlur)

        inlineEditSessionRef.current = {
          mode: 'dom',
          element: labelEl,
          nodeId,
          lineIndex,
          originalText,
          text: originalText,
          cleanup: () => {
            labelEl.removeEventListener('keydown', onKeyDown)
            labelEl.removeEventListener('blur', onBlur)
          },
        }
        setInlineEditState(null)
        setIsInlineEditing(true)
        setSelectedNode(null)
        setShowNodeToolbar(false)

        window.requestAnimationFrame(() => {
          labelEl.focus()
          selectElementContents(labelEl)
        })
        return
      }

      const layout = computeNodeEditLayout(nodeGroup, shell)
      const session: InlineEditSession = {
        mode: 'overlay',
        nodeId,
        lineIndex,
        originalText,
        text: originalText,
        layout: { ...layout, text: originalText },
      }
      inlineEditSessionRef.current = session
      setInlineEditState(session)
      setIsInlineEditing(true)
      setSelectedNode(null)
      setShowNodeToolbar(false)
    },
    [finishInlineEdit, source, kind],
  )

  const openInlineEditFromEvent = useCallback(
    (event: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
      if (!svgMarkup || renderError) return false

      const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event
      const node = findEditableNodeFromEvent(nativeEvent)
      if (!node) return false

      nativeEvent.preventDefault()
      nativeEvent.stopPropagation()
      panStartRef.current = null
      panActiveRef.current = false
      pointerDownNodeRef.current = null
      lastPointerClickRef.current = { time: 0, node: null }
      setIsPanning(false)
      setSelectedNode(null)
      setShowNodeToolbar(false)
      if (toolbarDelayRef.current != null) {
        window.clearTimeout(toolbarDelayRef.current)
        toolbarDelayRef.current = null
      }
      startInlineEdit(node)
      return true
    },
    [svgMarkup, renderError, startInlineEdit],
  )

  const handlePreviewDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      openInlineEditFromEvent(event)
    },
    [openInlineEditFromEvent],
  )

  const endPreviewPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('.diagram-node-toolbar, .diagram-flowchart-toolbar, .diagram-inline-text-editor, .diagram-link-pick-banner')) return

    const clickedNode = pointerDownNodeRef.current
    const wasPanning = panActiveRef.current

    if (panStartRef.current) {
      panStartRef.current = null
      panActiveRef.current = false
      setIsPanning(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }

    pointerDownNodeRef.current = null

    const activeLinkPick = linkPickModeRef.current
    if (!wasPanning && !isInlineEditing && clickedNode && activeLinkPick) {
      const nodeGroup = resolveEditableNodeGroup(clickedNode) ?? clickedNode
      const targetNodeId = resolveFlowchartNodeId(nodeGroup)
      if (targetNodeId && targetNodeId !== activeLinkPick.fromNodeId) {
        const edgeLabel = activeLinkPick.edgeLabel
        const targetLabel = nodeGroup.getAttribute('data-cc-label') || targetNodeId
        markLinkPickTargetPicked(nodeGroup)
        applyStructureChange(
          (prev) => connectFlowchartNodes(prev, activeLinkPick.fromNodeId, targetNodeId, edgeLabel),
          edgeLabel
            ? `已连接：${activeLinkPick.fromLabel} --${edgeLabel}→ ${targetLabel}`
            : `已连接到「${targetLabel}」`,
        )
        return
      }
      if (targetNodeId === activeLinkPick.fromNodeId) {
        setStatusIsError(true)
        setStatusMessage('不能连接到自身，请选择其他节点')
      }
      return
    }

    if (!wasPanning && !isInlineEditing && clickedNode) {
      const now = Date.now()
      const prevClick = lastPointerClickRef.current
      const nodeKey = getNodeClickKey(clickedNode)
      const prevKey = prevClick.node ? getNodeClickKey(prevClick.node) : ''
      const isDoubleClick =
        now - prevClick.time < DOUBLE_CLICK_MS &&
        prevKey !== '' &&
        prevKey === nodeKey

      if (isDoubleClick) {
        lastPointerClickRef.current = { time: 0, node: null }
        suppressSelectionUntilRef.current = now + 500
        setSelectedNode(null)
        setShowNodeToolbar(false)
        if (toolbarDelayRef.current != null) {
          window.clearTimeout(toolbarDelayRef.current)
          toolbarDelayRef.current = null
        }
        startInlineEdit(clickedNode)
        return
      }

      lastPointerClickRef.current = { time: now, node: clickedNode }
    }

    if (!wasPanning && !isInlineEditing) {
      if (Date.now() < suppressSelectionUntilRef.current) return
      if (clickedNode) {
        const selection = getNodeSelectionFromElement(clickedNode)
        if (selection) setSelectedNode(selection)
      } else {
        setSelectedNode(null)
      }
    }
  }, [
    isInlineEditing,
    startInlineEdit,
    getNodeClickKey,
    applyStructureChange,
    resolveFlowchartNodeId,
    markLinkPickTargetPicked,
  ])

  useEffect(() => {
    const shell = previewShellRef.current
    if (!shell || !svgMarkup || renderError) return

    const onNativeDoubleClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('.diagram-node-toolbar, .diagram-inline-text-editor')) return
      openInlineEditFromEvent(event)
    }

    shell.addEventListener('dblclick', onNativeDoubleClick, true)
    return () => shell.removeEventListener('dblclick', onNativeDoubleClick, true)
  }, [svgMarkup, renderError, openInlineEditFromEvent])

  const handleInlineEditChange = useCallback((text: string) => {
    const session = inlineEditSessionRef.current
    if (!session) return
    const next = { ...session, text }
    inlineEditSessionRef.current = next
    setInlineEditState(next)
  }, [])

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
    if (!source.trim()) {
      setStatusIsError(true)
      setStatusMessage('请先确保预览渲染成功')
      return
    }
    setBusy(true)
    try {
      const exportSvg = await renderMermaidToSvg(source, kind, colorSchemeId, activeMindmapTemplate, {
        htmlLabels: false,
        attachEditMetadata: false,
      })
      const blob = await svgToPngBlob(exportSvg, 2, activeColorTheme.exportBackground)
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
  }, [source, kind, colorSchemeId, activeMindmapTemplate, title, kindLabel, activeColorTheme.exportBackground])

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
                    linkPickMode ? ' diagram-preview-shell-linking' : ''
                  }${isPanning ? ' diagram-preview-shell-dragging' : ''}`}
                  style={{ background: previewBackground }}
                  title="单击选中节点可增删；双击改字；Ctrl+Z 撤销；拖拽平移，滚轮缩放"
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
                  {linkPickMode ? (
                    <DiagramLinkPickBanner
                      message={`从「${linkPickMode.fromLabel}」连接到目标 — 悬浮高亮，单击选中${linkPickMode.edgeLabel ? `（标签：${linkPickMode.edgeLabel}）` : ''}`}
                      onCancel={() => setLinkPickMode(null)}
                    />
                  ) : null}
                  {inlineEditState?.mode === 'overlay' && inlineEditState.layout ? (
                    <DiagramInlineTextEditor
                      left={inlineEditState.layout.left}
                      top={inlineEditState.layout.top}
                      width={inlineEditState.layout.width}
                      height={inlineEditState.layout.height}
                      fontSize={inlineEditState.layout.fontSize}
                      fontFamily={inlineEditState.layout.fontFamily}
                      fontWeight={inlineEditState.layout.fontWeight}
                      color={inlineEditState.layout.color}
                      textAlign={inlineEditState.layout.textAlign}
                      value={inlineEditState.text}
                      onChange={handleInlineEditChange}
                      onCommit={() => finishInlineEdit(false)}
                      onCancel={() => finishInlineEdit(true)}
                    />
                  ) : null}
                  {selectedNode &&
                  showNodeToolbar &&
                  viewMode === 'preview' &&
                  !renderError &&
                  !isInlineEditing &&
                  !linkPickMode ? (
                    kind === 'flowchart' ? (
                      <DiagramFlowchartToolbar
                        label={selectedNode.label}
                        isDecision={
                          selectedNode.nodeId
                            ? isFlowchartDecision(source, selectedNode.nodeId)
                            : false
                        }
                        left={toolbarPos.left}
                        top={toolbarPos.top}
                        selectionKey={selectedNode.nodeId ?? String(selectedNode.lineIndex ?? '')}
                        edgeLabel={flowchartEdgeLabel}
                        aiPrompt={nodeAiPrompt}
                        aiBusy={nodeAiBusy}
                        onEdgeLabelChange={setFlowchartEdgeLabel}
                        onAddStep={handleAddFlowchartStep}
                        onAddDecision={handleAddFlowchartDecision}
                        onAddBranch={handleAddFlowchartBranch}
                        onStartConnect={startFlowchartLinkPick}
                        onAiPromptChange={setNodeAiPrompt}
                        onAiModify={() => void handleFlowchartAiModify()}
                        onDelete={handleDeleteSelectedNode}
                      />
                    ) : (
                      <DiagramNodeToolbar
                        kind={kind}
                        label={selectedNode.label}
                        isRoot={selectedNode.isRoot}
                        isDecision={false}
                        left={toolbarPos.left}
                        top={toolbarPos.top}
                        onAddStep={handleAddFlowchartStep}
                        onAddDecision={handleAddFlowchartDecision}
                        onAddBranch={handleAddFlowchartBranch}
                        onAddChild={handleAddMindmapChild}
                        onAddSibling={handleAddMindmapSibling}
                        onDelete={handleDeleteSelectedNode}
                      />
                    )
                  ) : null}
                </div>
              ) : (
                <div className="document-editor-shell diagram-editor-shell">
                  <textarea
                    className="document-editor diagram-source-editor"
                    value={source}
                    onChange={(event) => setSourceDebounced(event.target.value)}
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
                ? '预览区单击节点：选箭头标签后添加步骤/分支，或先加节点再「连接到」目标；AI 改分支；双击改字；Ctrl+Z 撤销。'
                : '预览区单击节点可添加/删除子节点或同级；双击改字；Ctrl+Z 撤销、Ctrl+Y 重做；拖拽平移，滚轮缩放。'}
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
