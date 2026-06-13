import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Upload,
  Sparkles,
  Loader2,
  AlertCircle,
  Eye,
  PenLine,
  FileDown,
  Wand2,
  ChevronDown,
} from 'lucide-react'
import DocumentIssuePanel from './DocumentIssuePanel'
import DocumentTextEditor from './DocumentTextEditor'
import DocumentTemplateLibrary from './DocumentTemplateLibrary'
import DocumentWriteModal from './DocumentWriteModal'
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
import { locateIssueInTextarea } from '../utils/documentLocate'
import type { TextHighlightRange } from '../utils/documentLocate'
import { computeAiWriteHighlightRanges } from '../utils/documentAiHighlight'
import { getIssueCategoryLabel } from '../utils/documentProofread'
import { exportDocumentToDocx } from '../utils/docxExport'
import { saveFile } from '../utils/saveFile'
import type { DocumentTemplate } from '../data/documentTemplates'
import type { DocumentWriteMode } from '../utils/documentWrite'

const DOCUMENT_STORAGE_KEY = 'chartcraft-document-draft'

interface DocumentUndoSnapshot {
  content: string
  adoptedIssueIds: string[]
}

type DocumentViewMode = 'preview' | 'text'

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

interface DocumentWorkspaceProps {
  onSavedLabelChange: (label: string) => void
}

export default function DocumentWorkspace({
  onSavedLabelChange,
}: DocumentWorkspaceProps) {
  const [content, setContent] = useState(loadDocumentDraft)
  const [lastSavedAt, setLastSavedAt] = useState<number>(Date.now())
  const [issues, setIssues] = useState<DocumentIssue[]>([])
  const [showIssues, setShowIssues] = useState(false)
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const importedTextRef = useRef<string>('')
  const importedRawTextRef = useRef<string>('')
  const locateTokenRef = useRef(0)
  const undoPastRef = useRef<DocumentUndoSnapshot[]>([])

  const adoptedIssueIdSet = useMemo(() => new Set(adoptedIssueIds), [adoptedIssueIds])

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
    const onKeyDown = (event: KeyboardEvent) => {
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

  const runProofread = useCallback(async () => {
    if (!content.trim()) {
      setStatusIsError(true)
      setStatusMessage('请先输入或上传文档内容')
      return
    }

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
      setStatusMessage('正在智能校对，请稍候…')
      const dsIssues = await checkWithDeepSeek(content)
      setIssues(dsIssues)
      resetProofreadSession()
      setShowIssues(true)
      setViewMode('text')
      setStatusIsError(false)
      setStatusMessage(
        dsIssues.length > 0
          ? `发现 ${dsIssues.length} 项建议，请在右侧查看并逐条确认`
          : '未发现需要修改的问题',
      )
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : '智能校对失败')
      setIssues([])
      setShowIssues(false)
    } finally {
      setBusy(false)
    }
  }, [content, resetProofreadSession])

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
      setPreviewError(null)
      resetProofreadSession()
      setIssues([])
      setShowIssues(false)
      setActiveIssueId(null)
      setLocateHint(null)
      setHighlightRange(null)
      setStatusIsError(false)
      setActiveTemplateId(null)
      const tableHint = hasTables ? '；表格在「文本编辑」中以 | 分隔列' : ''
      setStatusMessage(
        warnings.length > 0
          ? `Word 已导入并已整理段落格式${tableHint}（${warnings.length} 条提示）`
          : hasTables
            ? 'Word 已导入并已整理段落格式；表格文本请切换到「文本编辑」（列以 | 分隔）'
            : 'Word 已导入并已整理段落格式；可在「版式预览」查看原 Word 排版',
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
      setActiveTemplateId(template.id)
      resetProofreadSession()
      setIssues([])
      setShowIssues(false)
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
      setActiveTemplateId(payload.templateId ?? null)
      resetProofreadSession()
      setIssues([])
      setShowIssues(false)
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

      setViewMode('text')
      if (docxBuffer) setTextDriftedFromDocx(true)

      if (activeIssueId === issue.id) {
        const nextAdopted = !adopted
        window.requestAnimationFrame(() => {
          const editor = editorRef.current
          if (!editor) return
          const range = locateIssueInTextarea(editor, issue, next)
          if (range) setHighlightRange({ ...range, adopted: nextAdopted })
        })
      }
    },
    [activeIssueId, adoptedIssueIdSet, captureUndoSnapshot, content, docxBuffer],
  )

  const handleLocateIssue = useCallback(
    (issue: DocumentIssue) => {
      const token = ++locateTokenRef.current
      setActiveIssueId(issue.id)
      setViewMode('text')

      if (issue.start >= issue.end) {
        setHighlightRange(null)
        setLocateHint(`${getIssueCategoryLabel(issue.category)}：${issue.message}`)
        editorRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      const runLocate = (attempt = 0) => {
        if (token !== locateTokenRef.current) return

        const editor = editorRef.current
        if (!editor) {
          if (attempt < 24) {
            window.requestAnimationFrame(() => runLocate(attempt + 1))
          }
          return
        }

        const range = locateIssueInTextarea(editor, issue, content)
        if (token !== locateTokenRef.current) return

        if (range) {
          const adopted = adoptedIssueIdSet.has(issue.id)
          setHighlightRange({ ...range, adopted })
          setLocateHint(
            `${adopted ? '已采纳 · ' : ''}${getIssueCategoryLabel(issue.category)}：${issue.message} · 「${issue.original}」→「${issue.suggestion || '删除'}」`,
          )
          window.requestAnimationFrame(() => {
            if (token !== locateTokenRef.current) return
            locateIssueInTextarea(editor, issue, content)
          })
        } else {
          setHighlightRange(null)
          setLocateHint(
            adoptedIssueIdSet.has(issue.id)
              ? '已采纳项在正文中未找到对应位置'
              : '该项可能已修正，正文中未找到对应原文',
          )
          setStatusIsError(false)
        }
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
        setStatusMessage('请先上传 Word 文档，或使用「智能排版后导出 Word」')
        return
      }

      setBusy(true)
      setStatusMessage(null)
      setStatusIsError(false)

      try {
        setStatusMessage(preferFormatted ? '正在智能排版并生成 Word…' : '正在保留原版式导出…')
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
              ? `智能排版 Word 已导出：${fileName}（${warnings[0]}）`
              : `智能排版 Word 已导出：${fileName}`,
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

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value)
      setAiHighlightRanges([])
      if (issues.length > 0 || adoptedIssueIds.length > 0) {
        setIssues([])
        setShowIssues(false)
        setAdoptedIssueIds([])
        setActiveIssueId(null)
        setLocateHint(null)
        setHighlightRange(null)
      }
      if (docxBuffer && value !== importedTextRef.current) {
        setTextDriftedFromDocx(true)
      }
    },
    [docxBuffer, issues.length, adoptedIssueIds.length],
  )

  return (
    <main className="app-main document-main">
      <section className="panel panel-document">
        <div className="panel-header document-toolbar-header">
          <div className="document-panel-title">
            <FileText size={20} />
            <div>
              <h2>文档编辑</h2>
              <p>国企公文模板 · 版式预览 · 文本校对 · 导出 Word</p>
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
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => setShowWriteModal(true)}
            >
              <Wand2 size={14} />
              写公文
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
              上传 Word
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => void runProofread()}
            >
              {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              智能校对
            </button>
            <div className="document-export-dropdown" ref={exportMenuRef}>
              <button
                type="button"
                className="btn btn-sm btn-primary document-export-trigger"
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
                    disabled={busy || !docxBuffer}
                    title={docxBuffer ? '写回上传的 Word 并保留原文件版式' : '请先上传 Word 文档'}
                    onClick={() => handleExportMenuAction('original-docx')}
                  >
                    保留原版式导出
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    title="按 GB/T 9704-2012 智能排版后生成 Word"
                    onClick={() => handleExportMenuAction('formatted-docx')}
                  >
                    智能排版后导出 Word
                  </button>
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
          </div>
        </div>

        {docxBuffer ? (
          <div className="document-export-hint" role="status">
            导出菜单中「保留原版式导出」将写回原文件版式；「智能排版后导出 Word」按 GB/T 9704 重新排版。
          </div>
        ) : (
          <div className="document-export-hint" role="status">
            未上传 Word 时，请使用「智能排版后导出 Word」；上传后可选择「保留原版式导出」。
          </div>
        )}

        {statusMessage ? (
          <div className={`document-status-bar${statusIsError ? ' error' : ' success'}`}>
            {statusIsError ? <AlertCircle size={14} /> : <Sparkles size={14} />}
            {statusMessage}
          </div>
        ) : null}

        <div className="document-layout-split">
          <div className="document-editor-column">
            <div className="document-workspace-main">
              <div className="document-editor-shell">
                <div className="document-view-tabs" role="tablist" aria-label="文档视图">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'preview'}
                className={`document-view-tab${viewMode === 'preview' ? ' active' : ''}`}
                disabled={!docxBuffer}
                onClick={() => setViewMode('preview')}
              >
                <Eye size={14} />
                版式预览
                {docxFileName ? <span className="document-view-tab-name">{docxFileName}</span> : null}
              </button>
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
            </div>

            <div className="document-single-view">
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
                  表格文本：列与列之间为「 | 」；切换到「版式预览」可查看 Word 原格式。
                </div>
              ) : null}

              {aiHighlightRanges.length > 0 && viewMode === 'text' && !highlightRange ? (
                <div className="document-ai-highlight-hint" role="status">
                  紫色高亮为 AI 本次生成/修改的内容；编辑文档后高亮自动消失。
                </div>
              ) : null}

              {locateHint && viewMode === 'text' ? (
                <div className="document-locate-hint" role="status">
                  {locateHint}
                </div>
              ) : null}

              {viewMode === 'text' ? (
                <DocumentTextEditor
                  editorRef={editorRef}
                  value={content}
                  highlightRange={highlightRange}
                  aiHighlightRanges={aiHighlightRanges}
                  onChange={handleContentChange}
                  placeholder="在此输入报告正文，或点击「上传 Word」导入 .docx 文档…"
                />
              ) : null}
            </div>
              </div>
            </div>

            <div className="data-hint document-editor-hint">
              <strong>说明：</strong>左侧编辑文档；右侧选择 GB/T 9704 公文模板载入骨架。
              校对结果在右侧显示；「导出文件」可选保留原版式、智能排版 Word 或 TXT。
            </div>
          </div>

          <aside className="document-sidebar">
            {showIssues ? (
              <DocumentIssuePanel
                issues={issues}
                activeIssueId={activeIssueId}
                adoptedIssueIds={adoptedIssueIdSet}
                busy={busy}
                onLocate={handleLocateIssue}
                onToggleAdopt={handleToggleAdopt}
                onApplyAll={handleApplyAll}
                onDismiss={() => {
                  setShowIssues(false)
                  setActiveIssueId(null)
                  setLocateHint(null)
                  setHighlightRange(null)
                  resetProofreadSession()
                }}
              />
            ) : (
              <DocumentTemplateLibrary
                activeTemplateId={activeTemplateId}
                onApply={handleApplyTemplate}
                onSelect={(template) => setActiveTemplateId(template.id)}
              />
            )}
          </aside>
        </div>
      </section>

      <DocumentWriteModal
        open={showWriteModal}
        onClose={() => setShowWriteModal(false)}
        currentEditorContent={content}
        activeTemplateId={activeTemplateId}
        onGenerated={handleWriteGenerated}
      />
    </main>
  )
}
