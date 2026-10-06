import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
  Eye,
  PenLine,
  FileDown,
  ChevronDown,
  BookText,
} from 'lucide-react'
import DocumentIssuePanel from './DocumentIssuePanel'
import DocumentStructurePanel from './DocumentStructurePanel'
import DocumentFormatPanel from './DocumentFormatPanel'
import DocumentOfficialLayoutPreview from './DocumentOfficialLayoutPreview'
import DocumentTextEditor, { type DocumentPageEditorHandle } from './DocumentTextEditor'
import DocumentTemplateSidebar from './DocumentTemplateSidebar'
import DocumentWordSourcePanel from './DocumentWordSourcePanel'
import DocumentTemplatePickerModal from './DocumentTemplatePickerModal'
import DocumentWriteModal from './DocumentWriteModal'
import DocumentProofreadSetupModal, {
  type ProofreadSetupSubmitPayload,
} from './DocumentProofreadSetupModal'
import DocumentEmptyState from './DocumentEmptyState'
import DocumentWorkflowBar, {
  canNavigateToWorkflowStep,
  completedThroughStep,
  type DocumentWorkflowStep,
} from './DocumentWorkflowBar'
import {
  applyFixableIssues,
  applySingleFix,
  formatDocument,
  revertSingleFix,
  type DocumentIssue,
} from '../utils/documentProofread'
import { importDocxFile } from '../utils/wordImport'
import { renderDocxPreview } from '../utils/docxPreview'
import { countCjkChars, hasTableLikeRows, normalizeDocxPlainText } from '../utils/docxTextExtract'
import {
  expandRangeToCjkWord,
  locateStructureItemInContent,
  refreshIssueRanges,
  resolveIssueRange,
} from '../utils/documentLocate'
import { resolveDocumentUndoKey } from '../utils/documentUndoKey'
import type { TextHighlightRange } from '../utils/documentLocate'
import { computeAiWriteHighlightRanges } from '../utils/documentAiHighlight'
import { getIssueCategoryLabel } from '../utils/documentProofread'
import { exportDocumentToDocx } from '../utils/docxExport'
import { documentEditorChrome } from '../utils/documentEditorChrome'
import { saveFile } from '../utils/saveFile'
import type { DocumentTemplate } from '../data/documentTemplates'
import type { DocumentWriteMode } from '../utils/documentWrite'
import { refineDocumentLocally } from '../utils/documentLocalRefine'
import {
  analyzeDocumentStructure,
  applyStructureSuggestionPatch,
  clearStoredStructureAnalysis,
  fingerprintDocumentContent,
  loadStoredStructureAnalysis,
  proposeStructureSuggestionPatch,
  saveStoredStructureAnalysis,
  type DocumentStructureAnalysisResult,
  type StructureSuggestionPatch,
} from '../utils/documentStructureAnalysis'
import { shouldAutoRerunStructureAfterPrepare } from '../utils/documentStructureAutoRefresh'
import {
  analyzeDocumentFormat,
  applyDocumentFormat,
  clearFormatCompleted,
  loadFormatCompleted,
  saveFormatCompleted,
  type FormatAdjustReport,
} from '../utils/documentFormatAdjust'
import { isDeepSeekConfigured, type ProofreadMode, type ProofreadPromptContext } from '../utils/deepseek'
import DocumentLocalRefineCard from './DocumentLocalRefineCard'

const DOCUMENT_STORAGE_KEY = 'chartcraft-document-draft'

interface DocumentUndoSnapshot {
  content: string
  adoptedIssueIds: string[]
}

type DocumentViewMode = 'preview' | 'text' | 'official'
type DocumentSidebarPanel = 'templates' | 'proofread' | 'source' | 'structure' | 'format'
type DocumentContentOrigin = 'none' | 'ai' | 'word' | 'template'

function loadDocumentDraft(): string {
  try {
    return localStorage.getItem(DOCUMENT_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveDocumentDraft(content: string) {
  try {
    localStorage.setItem(DOCUMENT_STORAGE_KEY, content)
  } catch {
    /* ignore */
  }
}


function loadInitialStructureState(): {
  report: DocumentStructureAnalysisResult | null
  appliedSuggestions: string[]
  analyzedAt: number | null
  fingerprint: string | null
} {
  const stored = loadStoredStructureAnalysis()
  if (!stored) {
    return { report: null, appliedSuggestions: [], analyzedAt: null, fingerprint: null }
  }
  return {
    report: stored.report,
    appliedSuggestions: stored.appliedSuggestions,
    analyzedAt: stored.analyzedAt,
    fingerprint: stored.contentFingerprint,
  }
}

interface DocumentWorkspaceProps {
  onSavedLabelChange: (label: string) => void
}

export default function DocumentWorkspace({
  onSavedLabelChange,
}: DocumentWorkspaceProps) {
  const [content, setContent] = useState(loadDocumentDraft)
  const [workflowStep, setWorkflowStep] = useState<DocumentWorkflowStep>(() =>
    loadDocumentDraft().trim() ? 'structure' : 'prepare',
  )
  const [lastSavedAt, setLastSavedAt] = useState<number>(Date.now())
  const [issues, setIssues] = useState<DocumentIssue[]>([])
  const [, setReviewMode] = useState<ProofreadMode | null>(null)
  const [proofreadGenreLabel, setProofreadGenreLabel] = useState<string | null>(null)
  const [proofreadSetupOpen, setProofreadSetupOpen] = useState(false)
  const [pendingProofreadMode, setPendingProofreadMode] = useState<ProofreadMode>('standard')
  const [contentOrigin, setContentOrigin] = useState<DocumentContentOrigin>('none')
  const [sidebarPanel, setSidebarPanel] = useState<DocumentSidebarPanel>('templates')
  const [proofreadCompleted, setProofreadCompleted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusIsError, setStatusIsError] = useState(false)
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null)
  const [locateHint, setLocateHint] = useState<string | null>(null)
  const [highlightRange, setHighlightRange] = useState<TextHighlightRange | null>(null)
  const [aiHighlightRanges, setAiHighlightRanges] = useState<TextHighlightRange[]>([])
  const [adoptedIssueIds, setAdoptedIssueIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<DocumentViewMode>('text')
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null)
  const [docxFileName, setDocxFileName] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [previewTextMismatch, setPreviewTextMismatch] = useState(false)
  const [textDriftedFromDocx, setTextDriftedFromDocx] = useState(false)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [showWriteModal, setShowWriteModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refineBusy, setRefineBusy] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [refineAnswer, setRefineAnswer] = useState<string | null>(null)
  const [initialStructure] = useState(loadInitialStructureState)
  const [structureReport, setStructureReport] = useState<DocumentStructureAnalysisResult | null>(
    initialStructure.report,
  )
  const [structureBusy, setStructureBusy] = useState(false)
  const [structureError, setStructureError] = useState<string | null>(null)
  const [structureOptimizeBusy, setStructureOptimizeBusy] = useState(false)
  const [structureOptimizeTarget, setStructureOptimizeTarget] = useState<string | null>(null)
  const [structurePendingPatch, setStructurePendingPatch] = useState<StructureSuggestionPatch | null>(null)
  const [structureExpanded, setStructureExpanded] = useState(false)
  const [structureAppliedSuggestions, setStructureAppliedSuggestions] = useState<string[]>(
    initialStructure.appliedSuggestions,
  )
  /** 已应用建议 → 写入正文的片段，便于再次点击定位 */
  const [structureAppliedSnippets, setStructureAppliedSnippets] = useState<Record<string, string>>({})
  const [structureAnalyzedAt, setStructureAnalyzedAt] = useState<number | null>(
    initialStructure.analyzedAt,
  )
  const [structureFingerprint, setStructureFingerprint] = useState<string | null>(
    initialStructure.fingerprint,
  )
  const [structureActiveItem, setStructureActiveItem] = useState<string | null>(null)
  /** 准备文档阶段改过正文；进入结构梳理且结果过期时自动重新梳理 */
  const [prepareContentChanged, setPrepareContentChanged] = useState(false)
  const [formatReport, setFormatReport] = useState<FormatAdjustReport | null>(null)
  const [formatBusy, setFormatBusy] = useState(false)
  const [formatConfirmOpen, setFormatConfirmOpen] = useState(false)
  const [formatCompleted, setFormatCompleted] = useState(false)
  const [editorSelection, setEditorSelection] = useState<{
    start: number
    end: number
    text: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<DocumentPageEditorHandle>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const importedTextRef = useRef<string>('')
  const importedRawTextRef = useRef<string>('')
  const locateTokenRef = useRef(0)
  const undoPastRef = useRef<DocumentUndoSnapshot[]>([])

  const adoptedIssueIdSet = useMemo(() => new Set(adoptedIssueIds), [adoptedIssueIds])
  const hasContent = content.trim().length > 0
  const preferSourceSidebar = contentOrigin === 'ai' || contentOrigin === 'word' || !!docxBuffer
  const fallbackSidebarPanel: DocumentSidebarPanel = preferSourceSidebar ? 'source' : 'templates'
  const workflowCompletedThrough = completedThroughStep({
    hasContent,
    proofreadFinished: proofreadCompleted,
    formatFinished: formatCompleted,
  })
  const isStepSidebar =
    workflowStep === 'structure' || workflowStep === 'proofread' || workflowStep === 'format'
  const structureRail = workflowStep === 'structure' && !structureExpanded && !structurePendingPatch
  const editorChrome = documentEditorChrome(workflowStep, Boolean(docxBuffer))
  const showSourceTab = preferSourceSidebar
  const showTemplatesTab = !docxBuffer
  const showContextTabs = !isStepSidebar && showSourceTab && showTemplatesTab
  const contextSidebarPanel: 'source' | 'templates' =
    sidebarPanel === 'templates' && showTemplatesTab
      ? 'templates'
      : showSourceTab
        ? 'source'
        : 'templates'

  const dismissStepSidebar = useCallback(() => {
    setWorkflowStep('export')
    setSidebarPanel(fallbackSidebarPanel)
    setActiveIssueId(null)
    setLocateHint(null)
    setHighlightRange(null)
  }, [fallbackSidebarPanel])

  const resetProofreadSession = useCallback(() => {
    undoPastRef.current = []
    setAdoptedIssueIds([])
  }, [])

  const captureUndoSnapshot = useCallback(() => {
    undoPastRef.current.push({
      content,
      adoptedIssueIds: [...adoptedIssueIds],
    })
    if (undoPastRef.current.length > 80) {
      undoPastRef.current.shift()
    }
  }, [content, adoptedIssueIds])

  const restoreUndoSnapshot = useCallback((snapshot: DocumentUndoSnapshot) => {
    setContent(snapshot.content)
    setAdoptedIssueIds(snapshot.adoptedIssueIds)
    if (docxBuffer && snapshot.content !== importedTextRef.current) {
      setTextDriftedFromDocx(true)
    }
    setAiHighlightRanges([])
    setHighlightRange(null)
    setLocateHint(null)
  }, [docxBuffer])

  const handleUndo = useCallback(() => {
    const past = undoPastRef.current
    if (past.length === 0) return false

    const snapshot = past.pop()
    if (!snapshot) return false

    restoreUndoSnapshot(snapshot)
    setStatusIsError(false)
    setStatusMessage('已撤销上一步')
    return true
  }, [restoreUndoSnapshot])

  useEffect(() => {
    if (!hasContent) {
      setWorkflowStep('prepare')
      setFormatReport(null)
      setFormatConfirmOpen(false)
      setFormatCompleted(false)
      clearFormatCompleted()
      return
    }
  }, [hasContent])

  useEffect(() => {
    if (!content.trim()) return
    setFormatCompleted(loadFormatCompleted(fingerprintDocumentContent(content)))
  }, [])

  useEffect(() => {
    // 上传 Word 后默认切到文档信息；AI 成稿允许手动切到职场模板
    if (docxBuffer && sidebarPanel === 'templates') {
      setSidebarPanel('source')
    }
  }, [docxBuffer, sidebarPanel])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const decision = resolveDocumentUndoKey({
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        key: event.key,
        target: event.target,
        undoCount: undoPastRef.current.length,
      })
      if (decision === 'undo') {
        event.preventDefault()
        handleUndo()
        return
      }
      if (decision === 'blocked') {
        event.preventDefault()
        return
      }

      if (!(event.ctrlKey || event.metaKey) || event.key !== 'z' || event.shiftKey) return
      if (undoPastRef.current.length === 0) return

      const target = event.target as HTMLElement | null
      if (!target?.closest('.panel-document')) return
      if (target.tagName === 'INPUT') return
      if (target.tagName === 'TEXTAREA' && !target.classList.contains('document-editor')) return

      event.preventDefault()
      handleUndo()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveDocumentDraft(content)
      setLastSavedAt(Date.now())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [content])

  useEffect(() => {
    if (!exportMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportMenuOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [exportMenuOpen])

  useEffect(() => {
    if (!editorChrome.showOfficialTab && viewMode === 'official') {
      setViewMode('text')
    }
  }, [editorChrome.showOfficialTab, viewMode])

  useEffect(() => {
    if (!docxBuffer || viewMode !== 'preview' || !previewRef.current) {
      return
    }

    let cancelled = false
    setPreviewReady(false)
    setPreviewError(null)
    setPreviewTextMismatch(false)

    void renderDocxPreview(docxBuffer, previewRef.current)
      .then(({ visibleText }) => {
        if (cancelled) return

        const sourceText = importedRawTextRef.current || importedTextRef.current
        const sourceNorm = normalizeDocxPlainText(sourceText)
        const previewNorm = normalizeDocxPlainText(visibleText)
        const sourceCjk = countCjkChars(sourceText)
        const previewCjk = countCjkChars(visibleText)

        const likelyMissingChars =
          previewCjk < sourceCjk ||
          (sourceNorm.length > previewNorm.length + 2 && !previewNorm.includes(sourceNorm.slice(0, 32)))

        setPreviewTextMismatch(likelyMissingChars)
        setPreviewReady(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : 'Word 版式预览渲染失败')
          setPreviewReady(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [docxBuffer, viewMode])

  const savedLabel = useMemo(() => {
    const date = new Date(lastSavedAt)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }, [lastSavedAt])

  useEffect(() => {
    onSavedLabelChange(savedLabel)
  }, [savedLabel, onSavedLabelChange])

  const openProofreadSetup = useCallback((mode: ProofreadMode) => {
    if (!content.trim()) {
      setStatusIsError(true)
      setStatusMessage('请先输入或上传文档内容')
      return
    }
    setPendingProofreadMode(mode)
    setProofreadSetupOpen(true)
  }, [content])

  const runReview = useCallback(async (mode: ProofreadMode, promptContext: ProofreadPromptContext) => {
    const { checkWithDeepSeek, isDeepSeekConfigured } = await import('../utils/deepseek')
    if (!isDeepSeekConfigured()) {
      setStatusIsError(true)
      setStatusMessage('未配置 DeepSeek：请在项目根目录 .env.local 中设置 DEEPSEEK_API_KEY 后重启 dev')
      return
    }

    setBusy(true)
    setStatusMessage(null)
    setStatusIsError(false)

    try {
      setStatusMessage(
        mode === 'deep'
          ? `正在深度审阅（${promptContext.genreLabel} · 逻辑/严谨），比普通校对更慢…`
          : `正在智能校对（${promptContext.genreLabel} · AI）…`,
      )
      const proofreadResult = await checkWithDeepSeek(content, {
        isTableDocument: hasTableLikeRows(content),
        mode,
        rescan: proofreadCompleted,
        promptContext,
        onProgress: mode === 'deep' ? (message) => setStatusMessage(message) : undefined,
      })
      const dsIssues = proofreadResult.issues
      setIssues(dsIssues)
      setReviewMode(mode)
      setProofreadGenreLabel(promptContext.genreLabel)
      resetProofreadSession()
      setSidebarPanel('proofread')
      setProofreadCompleted(true)
      setWorkflowStep('proofread')
      setViewMode('text')
      setStatusIsError(false)
      if (proofreadResult.usedLocalFallback) {
        setStatusMessage(
          dsIssues.length > 0
            ? `AI 返回格式异常，已改用本地规则校对，发现 ${dsIssues.length} 项建议`
            : 'AI 返回格式异常，已改用本地规则校对，未发现需要修改的问题',
        )
      } else if (mode === 'deep') {
        const logicCount = dsIssues.filter((issue) => issue.category === 'logic').length
        const rigorCount = dsIssues.filter((issue) => issue.category === 'rigor').length
        setStatusMessage(
          dsIssues.length > 0
            ? `深度审阅完成：逻辑 ${logicCount} · 严谨 ${rigorCount}，共 ${dsIssues.length} 项，请在右侧查看`
            : '深度审阅完成，未发现逻辑或表述方面的明显问题',
        )
      } else {
        setStatusMessage(
          dsIssues.length > 0
            ? proofreadCompleted
              ? `复校完成：仍有 ${dsIssues.length} 项硬伤建议（已收紧标准），请逐条确认`
              : `发现 ${dsIssues.length} 项建议（${promptContext.genreLabel} · AI），请在右侧查看并逐条确认`
            : proofreadCompleted
              ? '复校完成：未发现明显硬伤'
              : '未发现需要修改的问题',
        )
      }
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : mode === 'deep' ? '深度审阅失败' : '智能校对失败')
      setIssues([])
      setReviewMode(null)
      setProofreadGenreLabel(null)
      setSidebarPanel(preferSourceSidebar ? 'source' : 'templates')
    } finally {
      setBusy(false)
    }
  }, [content, resetProofreadSession, preferSourceSidebar, proofreadCompleted])

  const handleProofreadSetupSubmit = useCallback(
    (payload: ProofreadSetupSubmitPayload) => {
      setProofreadSetupOpen(false)
      void runReview(payload.mode, {
        ...payload.promptContext,
        rescan: proofreadCompleted,
      })
    },
    [runReview, proofreadCompleted],
  )

  const handleWordUpload = useCallback(async (file: File) => {
    setBusy(true)
    setStatusMessage(null)
    setStatusIsError(false)

    try {
      const { text, warnings, arrayBuffer, fileName, hasTables } = await importDocxFile(file)
      const formatted = formatDocument(text)
      setContent(formatted)
      importedTextRef.current = formatted
      importedRawTextRef.current = text
      setDocxBuffer(arrayBuffer)
      setDocxFileName(fileName)
      setTextDriftedFromDocx(false)
      setPreviewTextMismatch(false)
      setViewMode('text')
      setPrepareContentChanged(true)
      setWorkflowStep('structure')
      setPreviewError(null)
      resetProofreadSession()
      setIssues([])
      setReviewMode(null)
      setProofreadGenreLabel(null)
      setSidebarPanel('source')
      setActiveIssueId(null)
      setLocateHint(null)
      setHighlightRange(null)
      setStatusIsError(false)
      setActiveTemplateId(null)
      setContentOrigin('word')
      const tableHint = hasTables ? '；表格在「文本编辑」中以 | 分隔列' : ''
      setStatusMessage(
        warnings.length > 0
          ? `Word 已导入并已整理段落格式${tableHint}（${warnings.length} 条提示）`
          : hasTables
            ? 'Word 已导入并已整理段落格式；表格文本请切换到「文本编辑」（列以 | 分隔）'
            : 'Word 已导入并已整理段落格式；可点「对照原 Word」查看原排版',
      )
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : 'Word 文档导入失败')
    } finally {
      setBusy(false)
    }
  }, [resetProofreadSession])

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void handleWordUpload(file)
    },
    [handleWordUpload],
  )

  const applyDocumentTemplate = useCallback(
    (template: DocumentTemplate) => {
      const formatted = formatDocument(template.content)
      setContent(formatted)
      importedTextRef.current = formatted
      importedRawTextRef.current = ''
      setDocxBuffer(null)
      setDocxFileName(`${template.name}.docx`)
      setTextDriftedFromDocx(false)
      setViewMode('text')
      setPrepareContentChanged(true)
      setWorkflowStep('structure')
      setActiveTemplateId(template.id)
      setContentOrigin('template')
      resetProofreadSession()
      setIssues([])
      setReviewMode(null)
      setProofreadGenreLabel(null)
      setSidebarPanel('templates')
      setActiveIssueId(null)
      setLocateHint(null)
      setHighlightRange(null)
      setStatusIsError(false)
      setStatusMessage(`已载入「${template.name}」模板，请编辑【】占位内容后导出 Word`)
    },
    [resetProofreadSession],
  )

  const handleApplyTemplate = useCallback(
    (template: DocumentTemplate) => {
      if (content.trim()) {
        const confirmed = window.confirm(
          `将用「${template.name}」模板替换当前文本内容，是否继续？`,
        )
        if (!confirmed) return
      }
      applyDocumentTemplate(template)
    },
    [applyDocumentTemplate, content],
  )

  const handleWriteGenerated = useCallback(
    (payload: {
      content: string
      templateId?: string | null
      mode: DocumentWriteMode
      title: string
    }) => {
      const previousContent = content
      const formatted = formatDocument(payload.content)
      const highlights = computeAiWriteHighlightRanges(previousContent, formatted)
      setContent(formatted)
      setAiHighlightRanges(highlights)
      importedTextRef.current = formatted
      importedRawTextRef.current = ''
      setDocxBuffer(null)
      setDocxFileName(`${payload.title.replace(/[\\/:*?"<>|]/g, '') || '公文'}.docx`)
      setTextDriftedFromDocx(false)
      setViewMode('text')
      setPrepareContentChanged(true)
      setWorkflowStep('structure')
      setActiveTemplateId(payload.templateId ?? null)
      setContentOrigin('ai')
      resetProofreadSession()
      setIssues([])
      setReviewMode(null)
      setProofreadGenreLabel(null)
      setSidebarPanel('source')
      setActiveIssueId(null)
      setLocateHint(null)
      setHighlightRange(null)
      setStatusIsError(false)
      setStatusMessage(
        payload.mode === 'outline'
          ? `AI 已生成「${payload.title}」大纲，请编辑完善后再次生成全文或导出`
          : `AI 已生成「${payload.title}」全文，请核对【】占位内容后导出 Word`,
      )
    },
    [resetProofreadSession, content],
  )

  const handleApplyAll = useCallback(() => {
    const pending = issues.filter(
      (issue) => issue.autoFixable && issue.start !== issue.end && !adoptedIssueIdSet.has(issue.id),
    )
    if (pending.length === 0) return

    captureUndoSnapshot()
    const fixed = applyFixableIssues(content, pending)
    setContent(fixed)
    setIssues((prev) => refreshIssueRanges(fixed, prev))
    setViewMode('text')
    if (docxBuffer) setTextDriftedFromDocx(true)
    setAdoptedIssueIds((prev) => [...new Set([...prev, ...pending.map((issue) => issue.id)])])
    setStatusIsError(false)
    setStatusMessage(`已采纳 ${pending.length} 项修改`)
  }, [issues, adoptedIssueIdSet, captureUndoSnapshot, content, docxBuffer])

  const handleToggleAdopt = useCallback(
    (issue: DocumentIssue) => {
      if (!issue.autoFixable || issue.start === issue.end) return

      const adopted = adoptedIssueIdSet.has(issue.id)
      captureUndoSnapshot()

      let next = content
      if (adopted) {
        next = revertSingleFix(content, issue)
        setContent(next)
        setAdoptedIssueIds((prev) => prev.filter((id) => id !== issue.id))
        setStatusIsError(false)
        setStatusMessage('已取消采纳')
      } else {
        next = applySingleFix(content, issue)
        setContent(next)
        setAdoptedIssueIds((prev) => (prev.includes(issue.id) ? prev : [...prev, issue.id]))
        setStatusIsError(false)
        setStatusMessage('已采纳修改')
      }

      setIssues((prev) => refreshIssueRanges(next, prev))
      setViewMode('text')
      if (docxBuffer) setTextDriftedFromDocx(true)

      if (activeIssueId === issue.id) {
        const nextAdopted = !adopted
        window.requestAnimationFrame(() => {
          const editor = editorRef.current
          if (!editor) return
          const range = resolveIssueRange(next, issue)
          if (range) {
            const visual = expandRangeToCjkWord(next, range)
            setHighlightRange({ ...visual, adopted: nextAdopted })
            editor.scrollToRange(visual.start, visual.end)
          }
        })
      }
    },
    [activeIssueId, adoptedIssueIdSet, captureUndoSnapshot, content, docxBuffer],
  )

  const handleToggleAdoptGroup = useCallback(
    (groupIssues: DocumentIssue[]) => {
      const fixable = groupIssues.filter((issue) => issue.autoFixable && issue.start !== issue.end)
      if (fixable.length === 0) return

      const allAdopted = fixable.every((issue) => adoptedIssueIdSet.has(issue.id))
      captureUndoSnapshot()

      if (allAdopted) {
        let next = content
        for (const issue of [...fixable].sort((a, b) => b.start - a.start)) {
          next = revertSingleFix(next, issue)
        }
        setContent(next)
        setIssues((prev) => refreshIssueRanges(next, prev))
        setAdoptedIssueIds((prev) => prev.filter((id) => !fixable.some((issue) => issue.id === id)))
        setStatusIsError(false)
        setStatusMessage(`已取消采纳 ${fixable.length} 处修改`)
      } else {
        const pending = fixable.filter((issue) => !adoptedIssueIdSet.has(issue.id))
        const next = applyFixableIssues(content, pending)
        setContent(next)
        setIssues((prev) => refreshIssueRanges(next, prev))
        setAdoptedIssueIds((prev) => [...new Set([...prev, ...pending.map((issue) => issue.id)])])
        setStatusIsError(false)
        setStatusMessage(
          pending.length > 1 ? `已采纳 ${pending.length} 处相同修改` : '已采纳修改',
        )
      }

      setViewMode('text')
      if (docxBuffer) setTextDriftedFromDocx(true)
    },
    [adoptedIssueIdSet, captureUndoSnapshot, content, docxBuffer],
  )

  const handleLocateIssue = useCallback(
    (issue: DocumentIssue) => {
      const token = ++locateTokenRef.current
      setActiveIssueId(issue.id)
      setViewMode('text')

      const runLocate = (attempt = 0) => {
        if (token !== locateTokenRef.current) return

        const editor = editorRef.current
        if (!editor) {
          if (attempt < 24) {
            window.requestAnimationFrame(() => runLocate(attempt + 1))
          }
          return
        }

        // 即使 start/end 失效，也按 original/suggestion 在正文中重定位
        const range = resolveIssueRange(content, issue)
        if (token !== locateTokenRef.current) return

        if (range) {
          const adopted = adoptedIssueIdSet.has(issue.id)
          const visual = expandRangeToCjkWord(content, range)
          setHighlightRange({ ...visual, adopted })
          setLocateHint(
            `${adopted ? '已采纳 · ' : ''}${getIssueCategoryLabel(issue.category)}：${issue.message}${
              issue.original
                ? ` · 「${issue.original}」→「${issue.suggestion || '删除'}」`
                : ''
            }`,
          )
          editor.scrollToRange(visual.start, visual.end)
          window.requestAnimationFrame(() => {
            if (token !== locateTokenRef.current) return
            editor.scrollToRange(visual.start, visual.end)
          })
          return
        }

        setHighlightRange(null)
        if (!issue.original && issue.start >= issue.end) {
          setLocateHint(
            `${getIssueCategoryLabel(issue.category)}：${issue.message}（全文级提醒，无具体定位）`,
          )
          editor.scrollToTop()
        } else {
          setLocateHint(
            adoptedIssueIdSet.has(issue.id)
              ? '已采纳项在正文中未找到对应位置'
              : '该问题在正文中未找到对应原文，可能已被修改',
          )
        }
        setStatusIsError(false)
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(runLocate)
      })
    },
    [content, adoptedIssueIdSet],
  )

  const handleExportTxt = useCallback(() => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '报告文档.txt'
    link.click()
    URL.revokeObjectURL(url)
  }, [content])

  const handleExportDocx = useCallback(
    async (preferFormatted: boolean) => {
      if (!content.trim()) {
        setStatusIsError(true)
        setStatusMessage('文档内容为空，无法导出 Word')
        return
      }

      if (!preferFormatted && !docxBuffer) {
        setStatusIsError(true)
        setStatusMessage('请先上传 Word 文档，或直接「导出 Word」（将按智能排版结果生成）')
        return
      }

      setBusy(true)
      setStatusMessage(null)
      setStatusIsError(false)

      try {
        setStatusMessage(preferFormatted ? '正在导出 Word…' : '正在保留原版式导出…')
        const { buffer, warnings, fileName } = await exportDocumentToDocx(content, {
          originalBuffer: docxBuffer,
          originalFullText: importedRawTextRef.current || importedTextRef.current,
          fileName: docxFileName,
          preferFormatted,
        })

        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })

        const saved = await saveFile(blob, {
          suggestedName: fileName,
          description: 'Word 文档',
          accept: {
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
          },
        })

        if (!saved) {
          setStatusMessage(null)
          return
        }

        setStatusIsError(false)
        if (preferFormatted) {
          setStatusMessage(
            warnings.length > 0
              ? `Word 已导出：${fileName}（${warnings[0]}）`
              : `Word 已导出：${fileName}`,
          )
        } else {
          setStatusMessage(
            warnings.length > 0
              ? `保留原版式 Word 已导出：${fileName}（${warnings[0]}）`
              : `保留原版式 Word 已导出：${fileName}（已写回校对内容并保留原排版）`,
          )
        }
      } catch (err) {
        setStatusIsError(true)
        setStatusMessage(err instanceof Error ? err.message : 'Word 导出失败')
      } finally {
        setBusy(false)
      }
    },
    [content, docxBuffer, docxFileName],
  )

  const handleExportMenuAction = useCallback(
    (action: 'original-docx' | 'formatted-docx' | 'txt') => {
      setExportMenuOpen(false)
      if (action === 'txt') {
        handleExportTxt()
        return
      }
      void handleExportDocx(action === 'formatted-docx')
    },
    [handleExportDocx, handleExportTxt],
  )

  const selectedPreview = useMemo(() => {
    const text = editorSelection?.text
    if (!text) return null
    const compact = text.replace(/\s+/g, ' ').trim()
    if (!compact) return null
    return compact.length > 160 ? `${compact.slice(0, 160)}…` : compact
  }, [editorSelection])

  const handleLocalRefine = useCallback(async () => {
    if (!content.trim()) {
      setRefineError('正文为空，无法优化')
      return
    }
    if (!refinePrompt.trim()) {
      setRefineError('请先填写调整要求')
      return
    }
    if (!isDeepSeekConfigured()) {
      setRefineError('未配置 DeepSeek：请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY 后重启')
      return
    }

    setRefineBusy(true)
    setBusy(true)
    setRefineError(null)
    setRefineAnswer(null)
    setStatusMessage(null)

    try {
      const liveSelection = (() => {
        const live = editorRef.current?.getPlainSelection() ?? null
        if (!live || live.end <= live.start) return editorSelection
        return live
      })()

      const result = await refineDocumentLocally({
        content,
        instruction: refinePrompt,
        selection: liveSelection,
      })

      if (result.mode === 'answer') {
        setRefineAnswer(result.answer ?? '')
        if (result.changedRange.end > result.changedRange.start) {
          setHighlightRange({ ...result.changedRange })
        }
        setStatusIsError(false)
        setStatusMessage('已结合正文回答问题（未改写正文）；可点「按此思路改写选中内容」继续优化')
        return
      }

      captureUndoSnapshot()
      const formatted = formatDocument(result.content)
      const highlights = computeAiWriteHighlightRanges(content, formatted)

      setContent(formatted)
      setAiHighlightRanges(highlights)
      setEditorSelection(null)
      setHighlightRange(null)
      setLocateHint(null)
      setRefineAnswer(null)
      setViewMode('text')
      setWorkflowStep('structure')
      if (docxBuffer) setTextDriftedFromDocx(true)
      setStatusIsError(false)
      setStatusMessage(
        result.mode === 'selection'
          ? '已按提示词优化选中内容，紫色高亮为本次改动；Ctrl+Z 可撤销'
          : '已按提示词完成局部优化，紫色高亮为本次改动；Ctrl+Z 可撤销',
      )
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : '局部优化失败，请重试')
    } finally {
      setRefineBusy(false)
      setBusy(false)
    }
  }, [content, refinePrompt, editorSelection, docxBuffer, captureUndoSnapshot])

  const handleApplyAnswerAsRewrite = useCallback(() => {
    if (!refineAnswer?.trim() || !refinePrompt.trim()) return
    setRefinePrompt(
      `请改写选中内容，补强与全文主题的逻辑关联。用户关切：${refinePrompt.trim()}\n改写时参考以下思路（勿照抄成说明文字，要写进正文表述）：\n${refineAnswer.trim()}`,
    )
    setRefineAnswer(null)
  }, [refineAnswer, refinePrompt])

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value)
      if (workflowStep === 'prepare') {
        setPrepareContentChanged(true)
      }
      setAiHighlightRanges([])
      setHighlightRange(null)
      setLocateHint(null)
      setEditorSelection(null)
      setRefineError(null)
      setRefineAnswer(null)
      setFormatReport(null)
      setFormatConfirmOpen(false)
      setFormatCompleted(false)
      clearFormatCompleted()
      if (issues.length > 0 || adoptedIssueIds.length > 0) {
        setIssues([])
        setReviewMode(null)
        setProofreadGenreLabel(null)
        setSidebarPanel(preferSourceSidebar ? 'source' : 'templates')
        setProofreadCompleted(false)
        setAdoptedIssueIds([])
        setActiveIssueId(null)
        setLocateHint(null)
        setHighlightRange(null)
      }
      if (docxBuffer && value !== importedTextRef.current) {
        setTextDriftedFromDocx(true)
      }
      if (!value.trim()) {
        setContentOrigin('none')
      }
    },
    [docxBuffer, issues.length, adoptedIssueIds.length, preferSourceSidebar, workflowStep],
  )


  const runStructureAnalysis = useCallback(async () => {
    if (!content.trim()) {
      setStatusIsError(true)
      setStatusMessage('请先输入或上传文档内容')
      return
    }
    if (!isDeepSeekConfigured()) {
      setStatusIsError(true)
      setStatusMessage('未配置 DeepSeek：请在项目根目录 .env.local 中设置 DEEPSEEK_API_KEY 后重启 dev')
      return
    }

    setStructureBusy(true)
    setBusy(true)
    setStructureError(null)
    setStatusIsError(false)
    setStatusMessage('正在梳理全文结构与逻辑…')
    setSidebarPanel('structure')

    try {
      const report = await analyzeDocumentStructure(content, {
        genreLabel: proofreadGenreLabel ?? undefined,
      })
      const analyzedAt = Date.now()
      const fingerprint = fingerprintDocumentContent(content)
      setStructureReport(report)
      setStructurePendingPatch(null)
      setStructureAppliedSuggestions([])
      setStructureAppliedSnippets({})
      setStructureActiveItem(null)
      setStructureAnalyzedAt(analyzedAt)
      setStructureFingerprint(fingerprint)
      saveStoredStructureAnalysis({
        contentFingerprint: fingerprint,
        report,
        appliedSuggestions: [],
        analyzedAt,
        genreLabel: proofreadGenreLabel,
      })
      setStatusMessage('结构梳理完成：结果已保存到本机，可对建议逐条智能优化')
    } catch (err) {
      setStructureError(err instanceof Error ? err.message : '结构梳理失败，请重试')
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : '结构梳理失败，请重试')
    } finally {
      setStructureBusy(false)
      setBusy(false)
    }
  }, [content, proofreadGenreLabel])

  const structureAppliedSet = useMemo(
    () => new Set(structureAppliedSuggestions),
    [structureAppliedSuggestions],
  )

  const structureStale = useMemo(() => {
    if (!structureReport || !structureFingerprint) return false
    const current = fingerprintDocumentContent(content)
    return Boolean(current) && current !== structureFingerprint
  }, [structureReport, structureFingerprint, content])

  useEffect(() => {
    if (!structureReport || !structureFingerprint || !structureAnalyzedAt) {
      if (!content.trim()) clearStoredStructureAnalysis()
      return
    }
    saveStoredStructureAnalysis({
      contentFingerprint: structureFingerprint,
      report: structureReport,
      appliedSuggestions: structureAppliedSuggestions,
      analyzedAt: structureAnalyzedAt,
      genreLabel: proofreadGenreLabel,
    })
  }, [
    structureReport,
    structureFingerprint,
    structureAnalyzedAt,
    structureAppliedSuggestions,
    proofreadGenreLabel,
    content,
  ])

  useEffect(() => {
    if (content.trim()) return
    setStructureReport(null)
    setStructureAppliedSuggestions([])
    setStructureAppliedSnippets({})
    setStructureAnalyzedAt(null)
    setStructureFingerprint(null)
    setStructurePendingPatch(null)
    setStructureError(null)
    clearStoredStructureAnalysis()
  }, [content])

  const handleOptimizeStructureSuggestion = useCallback(
    async (suggestion: string) => {
      if (!content.trim() || structureOptimizeBusy || structurePendingPatch) return
      if (!isDeepSeekConfigured()) {
        setStructureError('未配置 DeepSeek：请在 .env.local 中设置 DEEPSEEK_API_KEY 后重启')
        return
      }

      setStructureOptimizeBusy(true)
      setStructureOptimizeTarget(suggestion)
      setStructureError(null)
      setStatusIsError(false)
      setStatusMessage('正在根据该条建议生成改写方案…')

      try {
        const patch = await proposeStructureSuggestionPatch(content, suggestion, {
          genreLabel: proofreadGenreLabel ?? undefined,
        })
        setStructurePendingPatch(patch)
        setViewMode('text')
        setWorkflowStep('structure')
        const originalIndex = content.indexOf(patch.original)
        if (originalIndex >= 0) {
          const range = {
            start: originalIndex,
            end: originalIndex + patch.original.length,
          }
          setHighlightRange(range)
          setAiHighlightRanges([])
          setLocateHint('左侧高亮为即将改写的原文片段，确认后才会写入')
          window.requestAnimationFrame(() => {
            const editor = editorRef.current
            if (editor) editor.scrollToRange(range.start, range.end)
          })
        }
        setStatusMessage('已生成改写预览，请确认后再应用到正文')
      } catch (err) {
        setStructureError(err instanceof Error ? err.message : '生成优化方案失败，请重试')
        setStatusIsError(true)
        setStatusMessage(err instanceof Error ? err.message : '生成优化方案失败，请重试')
      } finally {
        setStructureOptimizeBusy(false)
        setStructureOptimizeTarget(null)
      }
    },
    [content, proofreadGenreLabel, structureOptimizeBusy, structurePendingPatch],
  )

  const handleConfirmStructurePatch = useCallback(() => {
    if (!structurePendingPatch) return
    const applied = applyStructureSuggestionPatch(content, structurePendingPatch)
    if (!applied) {
      setStructureError('正文已变化，找不到对应片段，请重新生成方案')
      setStructurePendingPatch(null)
      return
    }

    captureUndoSnapshot()
    const before = content
    const formatted = formatDocument(applied.content)
    const diffHighlights = computeAiWriteHighlightRanges(before, formatted).map((range) => ({
      ...range,
      adopted: true,
    }))
    // 优先用替换后文本在排版结果中定位，保证高亮对准写入内容
    let primary = diffHighlights[0] ?? null
    const replacement = structurePendingPatch.replacement.trim()
    if (replacement) {
      const hit = formatted.indexOf(structurePendingPatch.replacement)
      const hitTrimmed = hit < 0 ? formatted.indexOf(replacement) : hit
      if (hitTrimmed >= 0) {
        const length =
          hit >= 0 ? structurePendingPatch.replacement.length : replacement.length
        primary = { start: hitTrimmed, end: hitTrimmed + length, adopted: true }
      }
    }
    const highlights =
      diffHighlights.length > 0
        ? diffHighlights
        : primary
          ? [primary]
          : []

    setContent(formatted)
    setAiHighlightRanges(highlights)
    if (primary) {
      const focusRange = { start: primary.start, end: primary.end, adopted: true as const }
      setHighlightRange(focusRange)
      const snippet = formatted.slice(focusRange.start, focusRange.end)
      if (snippet.trim()) {
        setStructureAppliedSnippets((prev) => ({
          ...prev,
          [structurePendingPatch.suggestion]: snippet,
        }))
      }
      window.requestAnimationFrame(() => {
        const editor = editorRef.current
        if (editor) {
          editor.scrollToRange(focusRange.start, focusRange.end)
        }
      })
    } else {
      setHighlightRange(null)
    }
    setLocateHint('左侧绿色高亮为本次结构优化写入的正文，可点击建议再次定位')
    setViewMode('text')
    setWorkflowStep('structure')
    if (docxBuffer) setTextDriftedFromDocx(true)
    setStructureAppliedSuggestions((prev) =>
      prev.includes(structurePendingPatch.suggestion)
        ? prev
        : [...prev, structurePendingPatch.suggestion],
    )
    setStructurePendingPatch(null)
    setStatusIsError(false)
    setStatusMessage('已应用该条结构优化，左侧已高亮修改处；Ctrl+Z 可撤销')
  }, [structurePendingPatch, content, captureUndoSnapshot, docxBuffer])

  const handleCancelStructurePatch = useCallback(() => {
    setStructurePendingPatch(null)
    setHighlightRange(null)
    setLocateHint(null)
    setStatusMessage('已取消本次结构优化')
  }, [])


  const runFormatAnalysis = useCallback(async () => {
    if (!content.trim()) {
      setStatusIsError(true)
      setStatusMessage('请先输入或上传文档内容')
      return
    }
    setFormatBusy(true)
    setFormatConfirmOpen(false)
    setSidebarPanel('format')
    setWorkflowStep('format')
    setStatusIsError(false)
    setStatusMessage('正在检查格式…')
    try {
      // 让出一帧，确保「检查中」状态能渲染出来
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve())
      })
      const report = analyzeDocumentFormat(content)
      setFormatReport({ ...report, items: [...report.items] })
      setViewMode('official')
      const autoCount = report.items.filter((item) => item.autoApply).length
      setStatusIsError(false)
      setStatusMessage(
        report.changed
          ? `智能排版检查完成：可自动调整 ${autoCount} 项；确认后写入正文，导出无需再排版`
          : '智能排版检查完成：正文已可直接导出 Word',
      )
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : '格式检查失败')
    } finally {
      setFormatBusy(false)
    }
  }, [content])

  const handleConfirmFormatApply = useCallback(() => {
    if (!formatReport?.changed) {
      setFormatConfirmOpen(false)
      return
    }
    captureUndoSnapshot()
    const next = applyDocumentFormat(content)
    const highlights = computeAiWriteHighlightRanges(content, next)
    setContent(next)
    setAiHighlightRanges(highlights)
    setHighlightRange(null)
    setLocateHint(null)
    setViewMode('text')
    if (docxBuffer) setTextDriftedFromDocx(true)
    const fp = fingerprintDocumentContent(next)
    setFormatCompleted(true)
    saveFormatCompleted(fp)
    setFormatReport(analyzeDocumentFormat(next))
    setFormatConfirmOpen(false)
    setWorkflowStep('format')
    setViewMode('official')
    setStatusIsError(false)
    setStatusMessage('已应用智能排版，左侧为公文版式预览；导出 Word 将直接使用本次结果。Ctrl+Z 可撤销')
  }, [formatReport, content, captureUndoSnapshot, docxBuffer])

  const openFormatStep = useCallback(() => {
    setSidebarPanel('format')
    setWorkflowStep('format')
    setViewMode('official')
    if (!formatReport) {
      void runFormatAnalysis()
    }
  }, [formatReport, runFormatAnalysis])

  useEffect(() => {
    if (workflowStep !== 'format' || formatReport || formatBusy || !hasContent) return
    void runFormatAnalysis()
  }, [workflowStep, formatReport, formatBusy, hasContent, runFormatAnalysis])

  const openOrRunStructureAnalysis = useCallback(() => {
    setSidebarPanel('structure')
    setWorkflowStep('structure')
    setViewMode('text')
    setStructureError(null)
    if (
      shouldAutoRerunStructureAfterPrepare({
        workflowStep: 'structure',
        prepareContentChanged,
        hasContent: Boolean(content.trim()),
        structureBusy,
        hasStructureReport: Boolean(structureReport),
        structureStale,
      })
    ) {
      setStatusIsError(false)
      setStatusMessage('准备文档已更新，正在重新梳理结构…')
      return
    }
    if (structureReport) {
      setStatusIsError(false)
      setStatusMessage(
        structureStale
          ? '已加载上次结构梳理（正文已改动，可点重新梳理）'
          : '已加载上次结构梳理结果',
      )
      return
    }
    setPrepareContentChanged(false)
    void runStructureAnalysis()
  }, [
    structureReport,
    structureStale,
    runStructureAnalysis,
    prepareContentChanged,
    content,
    structureBusy,
  ])

  useEffect(() => {
    if (
      !shouldAutoRerunStructureAfterPrepare({
        workflowStep,
        prepareContentChanged,
        hasContent: Boolean(content.trim()),
        structureBusy,
        hasStructureReport: Boolean(structureReport),
        structureStale,
      })
    ) {
      if (
        workflowStep === 'structure' &&
        prepareContentChanged &&
        structureReport &&
        !structureStale
      ) {
        setPrepareContentChanged(false)
      }
      return
    }
    setPrepareContentChanged(false)
    void runStructureAnalysis()
  }, [
    workflowStep,
    prepareContentChanged,
    content,
    structureBusy,
    structureReport,
    structureStale,
    runStructureAnalysis,
  ])

  const handleWorkflowStepClick = useCallback(
    (step: DocumentWorkflowStep) => {
      if (!canNavigateToWorkflowStep(step, { activeStep: workflowStep, hasContent })) {
        return
      }

      if (step === 'prepare' && !statusIsError) {
        setStatusMessage(null)
      }

      if (step === 'export') {
        setExportMenuOpen(true)
      } else {
        setExportMenuOpen(false)
      }

      if (step === 'structure') {
        openOrRunStructureAnalysis()
        return
      }

      setWorkflowStep(step)
      setViewMode(step === 'format' ? 'official' : 'text')

      if (step === 'prepare' || step === 'export') {
        setSidebarPanel(preferSourceSidebar ? 'source' : 'templates')
      } else if (step === 'proofread') {
        setSidebarPanel('proofread')
      } else if (step === 'format') {
        setSidebarPanel('format')
      }
    },
    [workflowStep, hasContent, preferSourceSidebar, openOrRunStructureAnalysis, statusIsError],
  )

  const handleLocateStructureItem = useCallback(
    (item: string) => {
      const token = ++locateTokenRef.current
      setStructureActiveItem(item)
      setViewMode('text')
      setWorkflowStep('structure')
      setActiveIssueId(null)

      const runLocate = (attempt = 0) => {
        if (token !== locateTokenRef.current) return
        const editor = editorRef.current
        if (!editor) {
          if (attempt < 24) {
            window.requestAnimationFrame(() => runLocate(attempt + 1))
          }
          return
        }

        const appliedSnippet = structureAppliedSnippets[item]
        if (appliedSnippet) {
          const index = content.indexOf(appliedSnippet)
          if (index >= 0) {
            const range = { start: index, end: index + appliedSnippet.length, adopted: true as const }
            setHighlightRange(range)
            setAiHighlightRanges([range])
            editor.scrollToRange(range.start, range.end)
            setLocateHint('已定位到该条建议写入的正文（绿色高亮）')
            setStatusIsError(false)
            window.requestAnimationFrame(() => {
              if (token !== locateTokenRef.current) return
              editor.scrollToRange(range.start, range.end)
            })
            return
          }
        }

        const range = locateStructureItemInContent(content, item)
        if (token !== locateTokenRef.current) return

        if (range) {
          const visual = expandRangeToCjkWord(content, range)
          setHighlightRange({ ...visual })
          setAiHighlightRanges([])
          editor.scrollToRange(range.start, range.end)
          setLocateHint(`已定位结构条目：${item.replace(/\s+/g, ' ').trim().slice(0, 48)}`)
          setStatusIsError(false)
          window.requestAnimationFrame(() => {
            if (token !== locateTokenRef.current) return
            editor.scrollToRange(visual.start, visual.end)
          })
          return
        }

        setHighlightRange(null)
        setAiHighlightRanges([])
        setLocateHint(
          appliedSnippet
            ? '该条已应用内容可能已被改动，未能再次定位；可在正文中搜索相关表述'
            : '未在正文中找到对应位置，可换一条更贴近原文标题的条目，或重新梳理后再试',
        )
        setStatusIsError(false)
      }

      window.requestAnimationFrame(() => runLocate())
    },
    [content, structureAppliedSnippets],
  )

  return (
    <main
      className={`app-main document-main${workflowStep === 'proofread' ? ' document-workspace-proofread' : ''}${
        hasContent && workflowStep !== 'prepare' ? ' document-workspace-compact' : ''
      }`}
    >
      <section
        className={`panel panel-document${workflowStep === 'proofread' ? ' document-panel-proofread' : ''}`}
      >
        <div className="panel-header document-toolbar-header">
          <div className="document-panel-title">
            <FileText size={20} />
            <div>
              <h2>文档编辑</h2>
              <p>职场公文 · 结构 · 校对 · 排版 · 导出</p>
            </div>
          </div>
          <div className="document-toolbar-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={handleFileChange}
            />
            {hasContent && workflowStep !== 'prepare' ? (
              <div className="document-export-dropdown" ref={exportMenuRef}>
                <button
                  type="button"
                  className={`btn btn-sm document-export-trigger${workflowStep === 'export' ? ' btn-primary' : ' btn-ghost'}`}
                  disabled={busy}
                  aria-expanded={exportMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setExportMenuOpen((open) => !open)}
                >
                  {busy ? <Loader2 size={14} className="spin" /> : <FileDown size={14} />}
                  导出文件
                  <ChevronDown size={14} className={`document-export-chevron${exportMenuOpen ? ' open' : ''}`} />
                </button>
                {exportMenuOpen ? (
                  <div className="document-export-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={busy}
                      title="按智能排版步骤的结果生成 Word（GB/T 9704）"
                      onClick={() => handleExportMenuAction('formatted-docx')}
                    >
                      导出 Word
                    </button>
                    {docxBuffer ? (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy}
                        title="写回上传的 Word 并保留原文件版式"
                        onClick={() => handleExportMenuAction('original-docx')}
                      >
                        保留原版式导出
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={busy}
                      onClick={() => handleExportMenuAction('txt')}
                    >
                      导出 TXT
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <DocumentWorkflowBar
          activeStep={workflowStep}
          completedThrough={workflowCompletedThrough}
          hasContent={hasContent}
          onStepClick={handleWorkflowStepClick}
        />

        {statusMessage && (workflowStep !== 'prepare' || statusIsError) ? (
          <div className={`document-status-bar${statusIsError ? ' error' : ' success'}`}>
            {statusIsError ? <AlertCircle size={14} /> : <Sparkles size={14} />}
            {statusMessage}
          </div>
        ) : null}

        <div
          className={`document-layout-split${workflowStep === 'prepare' ? ' prepare-only' : ''}${
            isStepSidebar && !structureRail ? ' document-layout-wide-sidebar' : ''
          }${structureRail ? ' document-layout-structure-rail' : ''}`}
        >
          <div className="document-editor-column">
            <div className="document-workspace-main">
              <div className="document-editor-shell">
                {workflowStep !== 'prepare' &&
                (editorChrome.showTextTab ||
                  editorChrome.showOfficialTab ||
                  editorChrome.showOriginalWordLink) ? (
                <div
                  className="document-view-tabs"
                  role={editorChrome.showTextTab || editorChrome.showOfficialTab ? 'tablist' : 'toolbar'}
                  aria-label={
                    editorChrome.showTextTab || editorChrome.showOfficialTab ? '文档视图' : '对照原 Word'
                  }
                >
                  {editorChrome.showTextTab ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'text'}
                    className={`document-view-tab${viewMode === 'text' ? ' active' : ''}`}
                    onClick={() => setViewMode('text')}
                  >
                    <PenLine size={14} />
                    文本编辑
                  </button>
                  ) : null}
                  {editorChrome.showOfficialTab ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'official'}
                    className={`document-view-tab${viewMode === 'official' ? ' active' : ''}`}
                    disabled={!hasContent}
                    onClick={() => setViewMode('official')}
                  >
                    <BookText size={14} />
                    公文版式
                  </button>
                  ) : null}
                  {editorChrome.showOriginalWordLink ? (
                  <button
                    type="button"
                    className={`document-view-original${viewMode === 'preview' ? ' active' : ''}`}
                    onClick={() => setViewMode(viewMode === 'preview' ? 'text' : 'preview')}
                  >
                    <Eye size={14} />
                    {viewMode === 'preview' ? '返回文本编辑' : '对照原 Word'}
                    {viewMode !== 'preview' && docxFileName ? (
                      <span className="document-view-tab-name">{docxFileName}</span>
                    ) : null}
                  </button>
                  ) : null}
                </div>
                ) : null}

                <div className={`document-single-view${workflowStep === 'prepare' ? ' prepare-view' : ''}`}>
                  {viewMode === 'preview' && previewTextMismatch ? (
                    <div className="document-preview-stale-hint document-preview-mismatch-hint" role="status">
                      版式预览可能存在漏字，请切换到「文本编辑」查看完整内容。
                    </div>
                  ) : null}

                  {viewMode === 'preview' && textDriftedFromDocx ? (
                    <div className="document-preview-stale-hint" role="status">
                      文本已修改，版式预览仍为上传时的 Word 原文。
                    </div>
                  ) : null}

                  {viewMode === 'preview' ? (
                    <div className="document-preview-wrap">
                      {!docxBuffer ? (
                        <p className="document-preview-empty">上传 Word 后可在此查看与原文相近的版式</p>
                      ) : previewError ? (
                        <p className="document-preview-empty error">{previewError}</p>
                      ) : !previewReady ? (
                        <div className="document-preview-loading">
                          <Loader2 size={20} className="spin" />
                          正在渲染 Word 版式…
                        </div>
                      ) : null}
                      <div
                        ref={previewRef}
                        className="document-preview-canvas"
                        hidden={!docxBuffer || !!previewError || !previewReady}
                      />
                    </div>
                  ) : null}

                  {viewMode === 'text' && hasTableLikeRows(content) ? (
                    <div className="document-table-hint" role="status">
                      表格文本：列与列之间为「 | 」
                      {editorChrome.showOriginalWordLink ? '；点「对照原 Word」可查看原格式' : ''}
                      。
                    </div>
                  ) : null}

                  {aiHighlightRanges.length > 0 &&
                  viewMode === 'text' &&
                  !highlightRange &&
                  !locateHint ? (
                    <div className="document-ai-highlight-hint" role="status">
                      {aiHighlightRanges.some((range) => range.adopted)
                        ? '绿色高亮为结构优化写入的内容；点击右侧建议可再次定位。'
                        : '紫色高亮为 AI 本次生成/修改的内容；编辑文档后高亮自动消失。'}
                    </div>
                  ) : null}

                  {locateHint && viewMode === 'text' ? (
                    <div className="document-locate-hint" role="status">
                      {locateHint}
                    </div>
                  ) : null}

                  {viewMode === 'text' && (!hasContent || workflowStep === 'prepare') ? (
                    <DocumentEmptyState
                      busy={busy}
                      onWrite={() => setShowWriteModal(true)}
                      onUpload={() => fileInputRef.current?.click()}
                      onBrowseTemplates={() => {
                        setSidebarPanel('templates')
                        setShowTemplateModal(true)
                      }}
                    />
                  ) : null}

                  {viewMode === 'text' && hasContent && workflowStep !== 'prepare' ? (
                    <DocumentTextEditor
                      ref={editorRef}
                      value={content}
                      layoutMode={workflowStep === 'structure' ? 'official' : 'manuscript'}
                      highlightRange={highlightRange}
                      aiHighlightRanges={aiHighlightRanges}
                      onChange={handleContentChange}
                      onSelectionChange={setEditorSelection}
                      placeholder="在此输入报告正文…"
                    />
                  ) : null}

                  {viewMode === 'official' && hasContent && workflowStep !== 'prepare' ? (
                    <DocumentOfficialLayoutPreview
                      content={
                        formatReport?.changed && formatReport.previewContent !== content
                          ? formatReport.previewContent
                          : content
                      }
                      banner={
                        formatReport?.changed && formatReport.previewContent !== content
                          ? '以下为智能排版预览（尚未写入正文）。确认应用后才会保存；编辑请切到「文本编辑」。'
                          : '公文版式预览：标题居中、层次加粗、正文首行缩进。编辑请切到「文本编辑」。'
                      }
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {workflowStep !== 'prepare' ? (
          <aside className="document-sidebar">
            {!isStepSidebar && showContextTabs ? (
              <div className="document-sidebar-tabs" role="tablist" aria-label="右侧面板">
                <button
                  type="button"
                  role="tab"
                  aria-selected={contextSidebarPanel === 'source'}
                  className={`document-sidebar-tab${contextSidebarPanel === 'source' ? ' active' : ''}`}
                  onClick={() => setSidebarPanel('source')}
                >
                  文档信息
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={contextSidebarPanel === 'templates'}
                  className={`document-sidebar-tab${contextSidebarPanel === 'templates' ? ' active' : ''}`}
                  onClick={() => setSidebarPanel('templates')}
                >
                  职场模板
                </button>
              </div>
            ) : null}
            <div className="document-sidebar-panel">
              {workflowStep === 'format' ? (
                <DocumentFormatPanel
                  report={formatReport}
                  busy={formatBusy}
                  confirmOpen={formatConfirmOpen}
                  applied={formatCompleted && !(formatReport?.changed)}
                  onAnalyze={() => void runFormatAnalysis()}
                  onRequestApply={() => setFormatConfirmOpen(true)}
                  onConfirmApply={handleConfirmFormatApply}
                  onCancelApply={() => setFormatConfirmOpen(false)}
                  onDismiss={dismissStepSidebar}
                  onShowOfficialPreview={() => setViewMode('official')}
                  onGoExport={() => {
                    const fp = fingerprintDocumentContent(content)
                    setFormatCompleted(true)
                    saveFormatCompleted(fp)
                    setWorkflowStep('export')
                    void handleExportDocx(true)
                  }}
                />
              ) : workflowStep === 'structure' ? (
                <DocumentStructurePanel
                  report={structureReport}
                  busy={structureBusy}
                  error={structureError}
                  optimizeBusy={structureOptimizeBusy}
                  optimizeTarget={structureOptimizeTarget}
                  pendingPatch={structurePendingPatch}
                  appliedSuggestions={structureAppliedSet}
                  analyzedAt={structureAnalyzedAt}
                  stale={structureStale}
                  activeLocateItem={structureActiveItem}
                  onRefresh={() => void runStructureAnalysis()}
                  onDismiss={dismissStepSidebar}
                  onLocateItem={handleLocateStructureItem}
                  onOptimizeSuggestion={(suggestion) => void handleOptimizeStructureSuggestion(suggestion)}
                  onConfirmPatch={handleConfirmStructurePatch}
                  onCancelPatch={handleCancelStructurePatch}
                  collapsed={structureRail}
                  onToggleCollapsed={() => setStructureExpanded((expanded) => !expanded)}
                />
              ) : workflowStep === 'proofread' ? (
                <DocumentIssuePanel
                  issues={issues}
                  content={content}
                  genreLabel={proofreadGenreLabel}
                  completed={proofreadCompleted}
                  activeIssueId={activeIssueId}
                  adoptedIssueIds={adoptedIssueIdSet}
                  busy={busy}
                  onLocate={handleLocateIssue}
                  onToggleAdopt={handleToggleAdopt}
                  onToggleAdoptGroup={handleToggleAdoptGroup}
                  onApplyAll={handleApplyAll}
                  onStartProofread={() => openProofreadSetup('standard')}
                  onGoFormat={() => openFormatStep()}
                  onDismiss={() => {
                    dismissStepSidebar()
                    resetProofreadSession()
                  }}
                />
              ) : contextSidebarPanel === 'source' && preferSourceSidebar ? (
                <DocumentWordSourcePanel
                  kind={contentOrigin === 'ai' || !docxBuffer ? 'ai' : 'word'}
                  fileName={docxFileName}
                  textDrifted={textDriftedFromDocx}
                  onOpenPreview={() => setViewMode('preview')}
                  onReupload={() => fileInputRef.current?.click()}
                  onBrowseTemplates={
                    contentOrigin === 'ai'
                      ? () => {
                          setSidebarPanel('templates')
                          setShowTemplateModal(true)
                        }
                      : undefined
                  }
                  refinePrompt={refinePrompt}
                  onRefinePromptChange={(value) => {
                    setRefinePrompt(value)
                    setRefineAnswer(null)
                  }}
                  selectedPreview={selectedPreview}
                  refineBusy={refineBusy}
                  refineError={refineError}
                  refineAnswer={refineAnswer}
                  refineDisabled={!hasContent || busy}
                  onRefine={() => void handleLocalRefine()}
                  onApplyAnswerAsRewrite={
                    selectedPreview?.trim() ? handleApplyAnswerAsRewrite : undefined
                  }
                />
              ) : (
                <div className="document-sidebar-stack">
                  {hasContent ? (
                    <DocumentLocalRefineCard
                      prompt={refinePrompt}
                      onPromptChange={(value) => {
                        setRefinePrompt(value)
                        setRefineAnswer(null)
                      }}
                      selectedPreview={selectedPreview}
                      busy={refineBusy}
                      error={refineError}
                      answer={refineAnswer}
                      disabled={!hasContent || busy}
                      onSubmit={() => void handleLocalRefine()}
                      onApplyAnswerAsRewrite={
                        selectedPreview?.trim() ? handleApplyAnswerAsRewrite : undefined
                      }
                    />
                  ) : null}
                  <DocumentTemplateSidebar
                    activeTemplateId={activeTemplateId}
                    onOpenLibrary={() => setShowTemplateModal(true)}
                    onApply={handleApplyTemplate}
                  />
                </div>
              )}
            </div>
          </aside>
          ) : null}
        </div>
      </section>

      <DocumentWriteModal
        open={showWriteModal}
        onClose={() => setShowWriteModal(false)}
        onGenerated={handleWriteGenerated}
      />

      <DocumentProofreadSetupModal
        open={proofreadSetupOpen}
        mode={pendingProofreadMode}
        content={content}
        isTableDocument={hasTableLikeRows(content)}
        onClose={() => setProofreadSetupOpen(false)}
        onSubmit={handleProofreadSetupSubmit}
      />

      <DocumentTemplatePickerModal
        open={showTemplateModal}
        activeTemplateId={activeTemplateId}
        onClose={() => setShowTemplateModal(false)}
        onApply={handleApplyTemplate}
        onSelect={(template) => setActiveTemplateId(template.id)}
      />
    </main>
  )
}
