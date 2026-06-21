import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight, Download, FileText, FileUp, Loader2, Palette, Sparkles, Trash2 } from 'lucide-react'

import PptBeautifyOutlinePreview from './PptBeautifyOutlinePreview'

import PptMasterGeneratePanel from './PptMasterGeneratePanel'

import PptBeautifyFullPreview from './PptBeautifyFullPreview'

import PptBeautifySlideList from './PptBeautifySlideList'

import { PPT_COVER_THEMES, getPptCoverTheme } from '../data/pptCoverThemes'

import { PRESENTATION_TEMPLATES } from '../data/presentationTemplates'

import {
  FULL_BEAUTIFY_EXPORT_MODE_LABELS,
  PPT_BEAUTIFY_VIEW_LABELS,
  TEMPLATE_EXPORT_PHASE_LABELS,
  type FullBeautifyExportMode,
  type PptBeautifyView,
  type PptMaterialSourcePayload,
  type TemplateExportPhase,
} from '../types/pptBeautify'

import type { PresentationOutline, PresentationSlideLayout } from '../types/presentation'

import {
  FULL_DECK_MAX_SLIDES,
  PPT_LAYOUT_LABELS,
  analyzePptxPageTypes,
  buildFullBeautifyFileName,
  exportFullBeautifiedPptx,
  outlineToImportedPptx,
  type FullBeautifyTemplateSource,
} from '../utils/pptBeautifyFull'

import { exportFullBeautifiedVisualPptx } from '../utils/pptBeautifyFullVisualExport'

import { importPptxFile, type ImportedPptx } from '../utils/pptxImport'

import { loadPresentationDraft, savePresentationDraft } from '../utils/presentationStorage'

import {
  ADAPTIVE_PRESENTATION_TEMPLATE_ID,
  generatePresentationOutline,
  outlineToPreviewText,
} from '../utils/presentationWrite'

import { DEFAULT_PROJECT_PROMPT, readPptSourceDocument } from '../utils/pptSourceDocument'

import { isDeepSeekConfigured } from '../utils/deepseek'

import { beginSaveFile } from '../utils/saveFile'

import { loadEnterpriseTemplateMeta, registerEnterpriseTemplate } from '../utils/pptBeautifyEnterprise'

const FIXED_TEMPLATE_IDS = new Set(PRESENTATION_TEMPLATES.map((item) => item.id))

const TEMPLATE_SOURCE_ACCEPT = '.docx,.txt,.md,.markdown'

function resolveTemplateOverride(storedTemplateId: string): string | null {
  if (!storedTemplateId || storedTemplateId === ADAPTIVE_PRESENTATION_TEMPLATE_ID) {
    return null
  }
  return FIXED_TEMPLATE_IDS.has(storedTemplateId) ? storedTemplateId : null
}

function buildOutlineGenKey(
  source: PptMaterialSourcePayload | null,
  templateOverrideId: string | null,
): string {
  if (!source) return ''
  return `${source.name}:${source.text.length}:${source.prompt}:${templateOverrideId ?? 'adaptive'}`
}

interface PptBeautifyWorkspaceProps {
  onSavedLabelChange: (label: string) => void
}

export default function PptBeautifyWorkspace({ onSavedLabelChange }: PptBeautifyWorkspaceProps) {
  const initialDraft = loadPresentationDraft()

  const [pptView, setPptView] = useState<PptBeautifyView>('ai-design')

  const [templatePhase, setTemplatePhase] = useState<TemplateExportPhase>('outline')

  const [templateSource, setTemplateSource] = useState<PptMaterialSourcePayload | null>(null)

  const [templatePrompt, setTemplatePrompt] = useState(initialDraft.prompt || DEFAULT_PROJECT_PROMPT)

  const [busy, setBusy] = useState(false)

  const [statusMessage, setStatusMessage] = useState('')

  const [statusIsError, setStatusIsError] = useState(false)

  const [enterpriseCount, setEnterpriseCount] = useState(() => loadEnterpriseTemplateMeta().length)

  const [enterpriseTemplates, setEnterpriseTemplates] = useState(() => loadEnterpriseTemplateMeta())

  const enterpriseRef = useRef<HTMLInputElement>(null)

  const templateDocInputRef = useRef<HTMLInputElement>(null)

  const [templateOverrideId, setTemplateOverrideId] = useState<string | null>(() =>
    resolveTemplateOverride(initialDraft.templateId),
  )

  const [advancedOpen, setAdvancedOpen] = useState(() => resolveTemplateOverride(initialDraft.templateId) !== null)

  const [previewText, setPreviewText] = useState(initialDraft.previewText)

  const [outlineViewMode, setOutlineViewMode] = useState<'preview' | 'text'>('preview')

  const [activeOutlineSlideIndex, setActiveOutlineSlideIndex] = useState(0)

  const outlineGenKeyRef = useRef('')

  const skipTemplateAutoGenRef = useRef(true)

  const [outlineSource, setOutlineSource] = useState<PresentationOutline | null>(() => {
    if (!initialDraft.outlineJson.trim()) return null
    try {
      return JSON.parse(initialDraft.outlineJson) as PresentationOutline
    } catch {
      return null
    }
  })

  const [fullSource, setFullSource] = useState<ImportedPptx | null>(() => {
    if (!initialDraft.outlineJson.trim()) return null
    try {
      return outlineToImportedPptx(JSON.parse(initialDraft.outlineJson) as PresentationOutline)
    } catch {
      return null
    }
  })

  const [fullSourceFromOutline, setFullSourceFromOutline] = useState(() => Boolean(initialDraft.outlineJson.trim()))

  const [fullThemeId, setFullThemeId] = useState(PPT_COVER_THEMES[0].id)

  const [fullTemplateKind, setFullTemplateKind] = useState<'builtin' | 'enterprise'>('builtin')

  const [fullEnterpriseId, setFullEnterpriseId] = useState('')

  const [layoutOverrides, setLayoutOverrides] = useState<Partial<Record<number, PresentationSlideLayout>>>({})

  const [activeFullSlideIndex, setActiveFullSlideIndex] = useState(0)

  const fullFileRef = useRef<HTMLInputElement>(null)

  const setStatus = useCallback((message: string, isError = false) => {
    setStatusMessage(message)
    setStatusIsError(isError)
  }, [])

  const previewTemplate = useMemo(() => {
    if (templateOverrideId) {
      return PRESENTATION_TEMPLATES.find((item) => item.id === templateOverrideId) ?? PRESENTATION_TEMPLATES[0]
    }
    return PRESENTATION_TEMPLATES[0]
  }, [templateOverrideId])

  const persistTemplateId = templateOverrideId ?? ADAPTIVE_PRESENTATION_TEMPLATE_ID

  const handleOutlineReady = useCallback(
    (outline: PresentationOutline) => {
      setOutlineSource(outline)
      setPreviewText(outlineToPreviewText(outline))
      const imported = outlineToImportedPptx(outline)
      setFullSource(imported)
      setFullSourceFromOutline(true)
      setLayoutOverrides({})
      setActiveFullSlideIndex(0)
      savePresentationDraft({
        templateId: persistTemplateId,
        previewText: outlineToPreviewText(outline),
        outlineJson: JSON.stringify(outline),
        prompt: templatePrompt,
      })
      onSavedLabelChange(
        `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
      )
    },
    [onSavedLabelChange, persistTemplateId, templatePrompt],
  )

  const generateOutline = useCallback(
    async (options?: { templateOverrideId?: string | null }) => {
      if (!templateSource?.text.trim()) {
        setStatus('请先上传 Word 或文本材料', true)
        return false
      }
      const activePrompt = templateSource.prompt.trim() || templatePrompt.trim()
      if (!activePrompt) {
        setStatus('请填写生成要求', true)
        return false
      }
      if (!isDeepSeekConfigured()) {
        setStatus('未配置 DeepSeek：请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY 后重启 dev', true)
        return false
      }

      const overrideId =
        options?.templateOverrideId !== undefined ? options.templateOverrideId : templateOverrideId
      const requestTemplateId = overrideId ?? ADAPTIVE_PRESENTATION_TEMPLATE_ID
      const modeLabel = overrideId
        ? PRESENTATION_TEMPLATES.find((item) => item.id === overrideId)?.name ?? '固定模板'
        : '智能结构'

      setBusy(true)
      setStatus(`正在根据「${templateSource.name}」生成 PPT 大纲（${modeLabel}）…`)
      try {
        const next = await generatePresentationOutline({
          prompt: activePrompt,
          templateId: requestTemplateId,
          sourceDocument: templateSource.text,
        })
        handleOutlineReady(next)
        outlineGenKeyRef.current = buildOutlineGenKey(templateSource, overrideId ?? null)
        setStatus(`大纲已生成：共 ${next.slides.length} 页 · ${next.title}`)
        return true
      } catch (err) {
        setStatus(err instanceof Error ? err.message : '大纲生成失败', true)
        return false
      } finally {
        setBusy(false)
      }
    },
    [handleOutlineReady, setStatus, templatePrompt, templateSource, templateOverrideId],
  )

  const handleTemplateDocUpload = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const doc = await readPptSourceDocument(file)
        if (doc.kind === 'pdf') {
          setStatus('模板导出不支持 PDF，请使用「AI一键设计」', true)
          return
        }
        const next: PptMaterialSourcePayload = {
          file: doc.file,
          text: doc.text,
          name: doc.name,
          prompt: templatePrompt,
        }
        setTemplateSource(next)
        setStatus(`已读取「${doc.name}」（${doc.text.length.toLocaleString()} 字）`)
        outlineGenKeyRef.current = ''
        if (pptView === 'template-export' && templatePhase === 'outline') {
          await generateOutline()
        }
      } catch (err) {
        setTemplateSource(null)
        setStatus(err instanceof Error ? err.message : '文档读取失败', true)
      } finally {
        setBusy(false)
      }
    },
    [generateOutline, pptView, setStatus, templatePhase, templatePrompt],
  )

  useEffect(() => {
    if (pptView !== 'template-export' || templatePhase !== 'outline' || !templateSource?.text.trim() || busy) return
    const nextKey = buildOutlineGenKey(templateSource, templateOverrideId)
    if (outlineGenKeyRef.current === nextKey && outlineSource) return
    void generateOutline()
  }, [pptView, templateSource, templatePhase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (skipTemplateAutoGenRef.current) {
      skipTemplateAutoGenRef.current = false
      return
    }
    if (pptView !== 'template-export' || templatePhase !== 'outline' || !templateSource?.text.trim() || busy) return
    void generateOutline({ templateOverrideId })
  }, [templateOverrideId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDesignDraftComplete = useCallback(
    (_slideCount?: number) => {
      onSavedLabelChange(
        `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
      )
    },
    [onSavedLabelChange],
  )

  const fullTemplateSource = useMemo((): FullBeautifyTemplateSource | null => {
    if (fullTemplateKind === 'enterprise') {
      if (!fullEnterpriseId) return null
      return { kind: 'enterprise', templateId: fullEnterpriseId }
    }
    return { kind: 'builtin', themeId: fullThemeId }
  }, [fullTemplateKind, fullEnterpriseId, fullThemeId])

  const fullPreviewTheme = useMemo(
    () => getPptCoverTheme(fullThemeId) ?? PPT_COVER_THEMES[0],
    [fullThemeId],
  )

  const handleImportFullPptx = useCallback(async (file: File) => {
    setBusy(true)
    setStatusMessage('')
    setStatusIsError(false)
    try {
      const analysis = await analyzePptxPageTypes(file)
      setFullSource(analysis.imported)
      setFullSourceFromOutline(false)
      setLayoutOverrides({})
      setActiveFullSlideIndex(0)
      const typeSummary = analysis.pageTypes
        .map((layout, index) => `${index + 1}:${PPT_LAYOUT_LABELS[layout]}`)
        .join(' · ')
      setStatusMessage(`已分析「${file.name}」共 ${analysis.imported.slideCount} 页 · ${typeSummary}`)
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : 'PPT 分析失败')
    } finally {
      setBusy(false)
    }
  }, [])

  const handleExportFull = useCallback(async (mode: FullBeautifyExportMode) => {
    if (busy || !fullSource) return
    if (mode === 'editable' && !fullTemplateSource) return
    if (mode === 'visual' && fullTemplateKind === 'enterprise') return

    const themeKey =
      fullTemplateSource?.kind === 'builtin'
        ? fullTemplateSource.themeId
        : fullEnterpriseId || fullThemeId

    const saveOptions = {
      suggestedName: buildFullBeautifyFileName(fullSource.fileName, themeKey, mode),
      description: 'PowerPoint 演示文稿',
      accept: {
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      },
    }

    let saveSession: Awaited<ReturnType<typeof beginSaveFile>>
    try {
      saveSession = await beginSaveFile(saveOptions)
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : '无法打开保存对话框')
      return
    }

    if (!saveSession) {
      setStatusMessage('已取消下载')
      return
    }

    setBusy(true)
    setStatusMessage(mode === 'visual' ? '高保真导出中，请稍候…' : '正在导出，请稍候…')
    setStatusIsError(false)

    try {
      const result =
        mode === 'visual'
          ? await exportFullBeautifiedVisualPptx(fullSource, fullThemeId, {
              layoutOverrides,
              onProgress: (current, total) => {
                setStatusMessage(`高保真导出中：正在生成第 ${current}/${total} 页…`)
              },
            })
          : await exportFullBeautifiedPptx(fullSource, fullTemplateSource!, { layoutOverrides })

      const saved = await saveSession.write(result.blob)
      const warnText = result.warnings.length > 0 ? ` · ${result.warnings.join('；')}` : ''
      const modeLabel = FULL_BEAUTIFY_EXPORT_MODE_LABELS[mode]
      setStatusMessage(
        saved
          ? `全文美化完成（${modeLabel}）：已导出 ${result.updatedCount} 页${warnText}`
          : '已取消下载',
      )
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : '全文导出失败')
    } finally {
      setBusy(false)
    }
  }, [
    busy,
    fullSource,
    fullTemplateSource,
    layoutOverrides,
    fullEnterpriseId,
    fullThemeId,
    fullTemplateKind,
  ])

  const handleSelectTemplateOverride = (nextId: string | null) => {
    skipTemplateAutoGenRef.current = false
    setTemplateOverrideId(nextId)
  }

  const goTemplateBeautifyPhase = useCallback(() => {
    if (!outlineSource || !fullSource) {
      setStatus('请先生成并确认大纲', true)
      return
    }
    setTemplatePhase('beautify')
  }, [fullSource, outlineSource, setStatus])

  const openTemplateExport = useCallback(() => {
    setPptView('template-export')
    if (!outlineSource) setTemplatePhase('outline')
  }, [outlineSource])

  const updateTemplatePrompt = (next: string) => {
    setTemplatePrompt(next)
    if (templateSource) {
      setTemplateSource({ ...templateSource, prompt: next })
    }
  }

  return (
    <main className="app-main document-main ppt-beautify-main">
      <section className="panel panel-document panel-ppt-beautify">
        <div className="panel-header document-toolbar-header">
          <div className="document-panel-title">
            <Palette size={20} />
            <div>
              <h2>PPT 美化</h2>
              <p>
                {pptView === 'ai-design'
                  ? `${PPT_BEAUTIFY_VIEW_LABELS['ai-design']} · 成稿后直接下载`
                  : templatePhase === 'outline'
                    ? `${PPT_BEAUTIFY_VIEW_LABELS['template-export']} · ${TEMPLATE_EXPORT_PHASE_LABELS.outline}`
                    : `${PPT_BEAUTIFY_VIEW_LABELS['template-export']} · ${TEMPLATE_EXPORT_PHASE_LABELS.beautify}`}
              </p>
            </div>
          </div>

          <div className="document-toolbar-actions">
            <div className="ppt-beautify-output-mode-switch" role="tablist" aria-label="出稿方式">
              <button
                type="button"
                role="tab"
                aria-selected={pptView === 'ai-design'}
                className={`ppt-beautify-output-mode-btn${pptView === 'ai-design' ? ' active' : ''}`}
                disabled={busy}
                title="Sidecar 逐页 AI 成稿，生成后直接下载"
                onClick={() => setPptView('ai-design')}
              >
                AI一键设计
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pptView === 'template-export'}
                className={`ppt-beautify-output-mode-btn${pptView === 'template-export' ? ' active' : ''}`}
                disabled={busy}
                title="生成大纲、选主题模板导出"
                onClick={openTemplateExport}
              >
                模板导出
              </button>
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div className={`document-status-bar${statusIsError ? ' error' : ' success'}`}>
            {statusIsError ? <AlertCircle size={14} /> : <Sparkles size={14} />}
            {statusMessage}
          </div>
        ) : null}

        {pptView === 'ai-design' ? (
          <PptMasterGeneratePanel
            busy={busy}
            onBusyChange={setBusy}
            onStatus={setStatus}
            onDesignDraftComplete={handleDesignDraftComplete}
            initialPrompt={templatePrompt}
          />
        ) : null}

        {pptView === 'template-export' ? (
          <>
            <nav className="ppt-beautify-template-steps" aria-label="模板导出步骤">
              <button
                type="button"
                className={`ppt-beautify-template-step${templatePhase === 'outline' ? ' active' : ''}${outlineSource ? ' done' : ''}`}
                onClick={() => setTemplatePhase('outline')}
              >
                <span className="ppt-beautify-template-step-num">1</span>
                {TEMPLATE_EXPORT_PHASE_LABELS.outline}
              </button>
              <span className="ppt-beautify-template-step-line" aria-hidden="true" />
              <button
                type="button"
                className={`ppt-beautify-template-step${templatePhase === 'beautify' ? ' active' : ''}`}
                disabled={!outlineSource}
                onClick={() => goTemplateBeautifyPhase()}
              >
                <span className="ppt-beautify-template-step-num">2</span>
                {TEMPLATE_EXPORT_PHASE_LABELS.beautify}
              </button>
            </nav>

            <div className="ppt-beautify-layout ppt-beautify-full-layout">
              <aside className="ppt-beautify-sidebar">
                {templatePhase === 'outline' ? (
                  <>
                    <section className="ppt-beautify-block">
                      <h3>上传材料</h3>
                      <input
                        ref={templateDocInputRef}
                        type="file"
                        accept={TEMPLATE_SOURCE_ACCEPT}
                        hidden
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleTemplateDocUpload(file)
                          e.target.value = ''
                        }}
                      />
                      <button
                        type="button"
                        className="doc-write-upload-zone ppt-beautify-upload"
                        disabled={busy}
                        onClick={() => templateDocInputRef.current?.click()}
                      >
                        {templateSource ? (
                          <span className="ppt-beautify-doc-uploaded">
                            <FileText size={16} />
                            {templateSource.name}
                            <button
                              type="button"
                              className="ppt-beautify-doc-remove"
                              aria-label="移除文档"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation()
                                setTemplateSource(null)
                                setOutlineSource(null)
                                setPreviewText('')
                                outlineGenKeyRef.current = ''
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
                      {templateSource?.text.trim() ? (
                        <p className="ppt-beautify-full-meta">
                          已提取 {templateSource.text.length.toLocaleString()} 字
                        </p>
                      ) : null}
                    </section>

                    <section className="ppt-beautify-block">
                      <h3>生成要求</h3>
                      <textarea
                        className="ppt-beautify-outline-prompt"
                        value={templatePrompt}
                        rows={4}
                        disabled={busy}
                        placeholder={DEFAULT_PROJECT_PROMPT}
                        onChange={(e) => updateTemplatePrompt(e.target.value)}
                      />
                    </section>

                    <section className="ppt-beautify-block ppt-beautify-advanced-block">
                      <button
                        type="button"
                        className="ppt-beautify-advanced-toggle"
                        aria-expanded={advancedOpen}
                        onClick={() => setAdvancedOpen((open) => !open)}
                      >
                        <span>
                          高级 · 大纲结构
                          {!templateOverrideId ? (
                            <span className="ppt-beautify-mode-badge ppt-beautify-mode-badge-inline">智能结构</span>
                          ) : null}
                        </span>
                        <ChevronDown size={16} className={advancedOpen ? 'expanded' : ''} aria-hidden="true" />
                      </button>
                      {advancedOpen ? (
                        <div className="ppt-beautify-advanced-body">
                          <p className="ppt-beautify-full-meta">切换结构后自动重新生成大纲。</p>
                          <button
                            type="button"
                            className={`ppt-beautify-outline-template ppt-beautify-adaptive-option${!templateOverrideId ? ' active' : ''}`}
                            disabled={busy || !templateSource?.text.trim()}
                            onClick={() => handleSelectTemplateOverride(null)}
                          >
                            <strong>智能结构（推荐）</strong>
                            <span>按文档性质组织章节与页型</span>
                          </button>
                          <div className="ppt-beautify-outline-templates">
                            {PRESENTATION_TEMPLATES.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`ppt-beautify-outline-template${templateOverrideId === item.id ? ' active' : ''}`}
                                disabled={busy || !templateSource?.text.trim()}
                                onClick={() => handleSelectTemplateOverride(item.id)}
                              >
                                <strong>{item.name}</strong>
                                <span>{item.suggestedStructure}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-sm btn-primary ppt-beautify-generate-btn"
                        disabled={busy || !templateSource?.text.trim()}
                        onClick={() => void generateOutline()}
                      >
                        {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                        {outlineSource ? '重新生成大纲' : '生成 PPT 大纲'}
                      </button>
                    </section>
                  </>
                ) : (
                  <>
                    <section className="ppt-beautify-block ppt-beautify-outline-sync">
                      <h3>大纲摘要</h3>
                      <p>
                        {outlineSource ? (
                          <>
                            共 <strong>{outlineSource.slides.length}</strong> 页 · {outlineSource.title}
                          </>
                        ) : (
                          '尚未生成大纲'
                        )}
                      </p>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setTemplatePhase('outline')}
                      >
                        返回修改大纲
                      </button>
                    </section>

                    <section className="ppt-beautify-block">
                      <h3>模板来源</h3>
                      <div className="ppt-beautify-template-source">
                        <label className="ppt-beautify-radio">
                          <input
                            type="radio"
                            name="full-template-kind"
                            checked={fullTemplateKind === 'builtin'}
                            onChange={() => setFullTemplateKind('builtin')}
                          />
                          内置主题（{PPT_COVER_THEMES.length} 套）
                        </label>
                        <label className={`ppt-beautify-radio${enterpriseCount === 0 ? ' disabled' : ''}`}>
                          <input
                            type="radio"
                            name="full-template-kind"
                            checked={fullTemplateKind === 'enterprise'}
                            disabled={enterpriseCount === 0}
                            onChange={() => {
                              setFullTemplateKind('enterprise')
                              if (!fullEnterpriseId && enterpriseTemplates[0]) {
                                setFullEnterpriseId(enterpriseTemplates[0].id)
                              }
                            }}
                          />
                          企业模板（{enterpriseCount}）
                        </label>
                      </div>

                      {fullTemplateKind === 'builtin' ? (
                        <div className="ppt-beautify-theme-grid ppt-beautify-theme-grid-compact">
                          {PPT_COVER_THEMES.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`ppt-beautify-theme-card${fullThemeId === item.id ? ' active' : ''}`}
                              onClick={() => setFullThemeId(item.id)}
                            >
                              <span
                                className="ppt-beautify-theme-swatch"
                                style={{ background: item.preview.background }}
                              />
                              <strong>{item.name}</strong>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="ppt-beautify-enterprise-list">
                          {enterpriseTemplates.length === 0 ? (
                            <p className="ppt-beautify-phase-note">请先上传企业模板</p>
                          ) : (
                            enterpriseTemplates.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`ppt-beautify-enterprise-item${fullEnterpriseId === item.id ? ' active' : ''}`}
                                onClick={() => setFullEnterpriseId(item.id)}
                              >
                                <strong>{item.name}</strong>
                                <span>{item.pageTypes.join(' · ') || '自动识别页型'}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </section>

                    <section className="ppt-beautify-block">
                      <h3>企业模板库</h3>
                      <input
                        ref={enterpriseRef}
                        type="file"
                        accept=".pptx"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          void (async () => {
                            setBusy(true)
                            try {
                              const buffer = await file.arrayBuffer()
                              const imported = await importPptxFile(
                                new File([buffer], file.name, {
                                  type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                                }),
                              )
                              const pageTypes = imported.slides.map((slide) => slide.suggestedLayout)
                              await registerEnterpriseTemplate({
                                name: file.name.replace(/\.pptx$/i, ''),
                                fileName: file.name,
                                buffer,
                                pageTypes,
                              })
                              const list = loadEnterpriseTemplateMeta()
                              setEnterpriseTemplates(list)
                              setEnterpriseCount(list.length)
                              if (!fullEnterpriseId && list[0]) {
                                setFullEnterpriseId(list[0].id)
                              }
                              setStatusIsError(false)
                              setStatusMessage(
                                `企业模板「${file.name}」已注册（${pageTypes.length} 页 · ${pageTypes.map((t) => PPT_LAYOUT_LABELS[t as PresentationSlideLayout] ?? t).join(' / ')}）`,
                              )
                            } catch (err) {
                              setStatusIsError(true)
                              setStatusMessage(err instanceof Error ? err.message : '模板注册失败')
                            } finally {
                              setBusy(false)
                            }
                          })()
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost ppt-beautify-enterprise-btn"
                        disabled={busy}
                        onClick={() => enterpriseRef.current?.click()}
                      >
                        <FileUp size={14} />
                        上传企业模板（.pptx）
                      </button>
                    </section>

                    <section className="ppt-beautify-block">
                      <h3>或上传已有 PPT</h3>
                      <input
                        ref={fullFileRef}
                        type="file"
                        accept=".pptx"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleImportFullPptx(file)
                        }}
                      />
                      <button
                        type="button"
                        className="doc-write-upload-zone ppt-beautify-upload"
                        disabled={busy}
                        onClick={() => fullFileRef.current?.click()}
                      >
                        <FileUp size={18} />
                        <span>
                          {fullSource && !fullSourceFromOutline
                            ? `已加载：${fullSource.fileName}`
                            : '上传 .pptx 替换大纲内容'}
                        </span>
                      </button>
                      {fullSource ? (
                        <p className="ppt-beautify-full-meta">
                          共 {fullSource.slideCount} 页 · 最多 {FULL_DECK_MAX_SLIDES} 页
                        </p>
                      ) : null}
                    </section>
                  </>
                )}
              </aside>

              <div className="ppt-beautify-full-main">
                {templatePhase === 'outline' ? (
                  <>
                    <PptBeautifyOutlinePreview
                      busy={busy}
                      outline={outlineSource}
                      previewText={previewText}
                      viewMode={outlineViewMode}
                      onViewModeChange={setOutlineViewMode}
                      onPreviewTextChange={setPreviewText}
                      onOutlineChange={handleOutlineReady}
                      activeSlideIndex={activeOutlineSlideIndex}
                      onActiveSlideIndexChange={setActiveOutlineSlideIndex}
                      previewTemplate={previewTemplate}
                      emptyMessage="上传材料后将在此自动生成并预览 PPT 大纲"
                    />
                    <div className="ppt-beautify-template-phase-footer">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy || !outlineSource}
                        onClick={() => goTemplateBeautifyPhase()}
                      >
                        下一步：模板美化
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="ppt-beautify-full-preview-header">
                      <h4>套版预览</h4>
                      <div className="ppt-beautify-export-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={busy || !fullSource || !fullTemplateSource}
                          title="基于模板写回文字，可在 PowerPoint 中修改内容"
                          onClick={() => void handleExportFull('editable')}
                        >
                          {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                          可编辑导出
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={busy || !fullSource || fullTemplateKind === 'enterprise'}
                          title={
                            fullTemplateKind === 'enterprise'
                              ? '高保真导出仅支持内置主题'
                              : '按 HTML 预览逐页截图，视觉与预览一致，文字不可编辑'
                          }
                          onClick={() => void handleExportFull('visual')}
                        >
                          高保真导出
                        </button>
                      </div>
                    </div>

                    <PptBeautifyFullPreview
                      slides={fullSource?.slides ?? []}
                      theme={fullPreviewTheme}
                      layoutOverrides={layoutOverrides}
                      activeIndex={activeFullSlideIndex}
                      onSelect={setActiveFullSlideIndex}
                      enterprisePreview={fullTemplateKind === 'enterprise'}
                    />

                    <details className="ppt-beautify-full-layout-details">
                      <summary>页型微调（可选）</summary>
                      <PptBeautifySlideList
                        slides={fullSource?.slides ?? []}
                        layoutOverrides={layoutOverrides}
                        onLayoutChange={(slideIndex, layout) => {
                          setLayoutOverrides((prev) => ({ ...prev, [slideIndex]: layout }))
                        }}
                      />
                    </details>

                    <p className="ppt-beautify-compare-hint">
                      统一套用所选主题，全部页面一并预览与导出。
                    </p>
                  </>
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}
